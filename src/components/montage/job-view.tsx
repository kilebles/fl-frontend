"use client"

import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { AlertTriangle, Braces, Download, Loader2, Paintbrush, RotateCcw, Square, TriangleAlert } from "lucide-react"
import { toast } from "sonner"

import { clock } from "@/components/footage/parts"
import { ProgressLine, StyleSwatch, TYPE_ICON, infographicsText, size, stepText } from "@/components/montage/parts"
import { mkeys, useMontageOptions } from "@/components/montage/queries"
import { TextDialog } from "@/components/script/parts"
import { BTN_PRIMARY, BTN_SECONDARY, BTN_SMALL, Card, INPUT, Label, ON_BLUE, Seg } from "@/components/script/ui"
import { montage, type InfoItem, type InfoJob, type InfoRerender, type InfoSettings, type InfoStyle } from "@/lib/api"
import { cn } from "@/lib/utils"

const ACTIVE = ["queued", "running"]

function Preview({ job, item }: { job: InfoJob; item: InfoItem }) {
  const main = item.files.filter((f) => !f.name.includes("_alpha"))
  const [pick, setPick] = useState(0)
  const portrait = job.settings.format === "9:16"
  const f = main[Math.min(pick, main.length - 1)]
  return (
    <div className={cn("flex flex-col gap-2", portrait && "items-center")}>
      <div className={cn("overflow-hidden rounded-[3px] border border-line bg-background", portrait ? "aspect-[9/16] w-full max-w-[260px]" : "aspect-video w-full")}>
        {!f ? (
          <div className="grid size-full place-items-center text-xs text-faint">
            {item.status === "failed" ? <TriangleAlert className="size-5 text-danger" /> : ACTIVE.includes(job.status) ? <Loader2 className="size-4 animate-spin" /> : "нет файла"}
          </div>
        ) : f.name.endsWith(".mp4") ? (
          <video
            key={f.name}
            src={montage.fileUrl(job.id, f.name)}
            poster={item.poster ? montage.fileUrl(job.id, item.poster) : undefined}
            controls
            muted
            loop
            playsInline
            preload="none"
            className="size-full object-contain"
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={f.name} src={montage.fileUrl(job.id, f.name)} alt={item.title} className="size-full object-contain" />
        )}
      </div>
      {main.length > 1 && (
        <div className="flex flex-wrap gap-1">
          {main.map((m, i) => (
            <button
              key={m.name}
              type="button"
              onClick={() => setPick(i)}
              className={cn("rounded-[2px] px-2 py-1 font-mono text-[11px]", i === pick ? ON_BLUE : "bg-surface-2 text-muted-foreground hover:text-foreground")}
            >
              фаза {i + 1}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function ItemCard({ job, item, label, onData }: { job: InfoJob; item: InfoItem; label: string; onData: () => void }) {
  const Icon = TYPE_ICON[item.type]
  return (
    <section className="flex min-w-0 flex-col gap-3 rounded-[4px] border border-line bg-surface p-3">
      <Preview job={job} item={item} />
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Icon className="size-3.5" />
          {label}
          {job.source.kind === "orders" && <span className="font-mono text-faint">· кадр {item.key}</span>}
          {item.sec ? <span className="ml-auto font-mono text-faint">{item.sec.toFixed(1).replace(".", ",")} с</span> : null}
        </div>
        <div className="mt-1 truncate text-sm font-medium" title={item.title}>
          {item.title || "—"}
        </div>
        <div className="font-mono text-[11px] text-faint">{item.describe}</div>
        {item.status === "failed" && <div className="mt-1.5 line-clamp-3 text-xs text-danger">{item.error}</div>}
      </div>
      <div className="mt-auto flex flex-wrap items-center gap-1.5">
        {item.files.map((f) => (
          <a key={f.name} href={montage.fileUrl(job.id, f.name, true)} download className={BTN_SMALL} title={f.name}>
            <Download className="size-3" />
            {f.name.split(".").pop()?.toUpperCase()}
            {f.name.includes("_alpha") ? " без фона" : ""}
            {/_(\d+)(?:_alpha)?\.png$/.test(f.name) ? ` ${f.name.match(/_(\d+)(?:_alpha)?\.png$/)![1]}` : ""}
            <span className="font-normal text-faint">{size(f.size)}</span>
          </a>
        ))}
        {item.spec && (
          <button type="button" onClick={onData} className={cn(BTN_SMALL, "ml-auto")} title="Данные, которые нарисованы">
            <Braces className="size-3" />
            Данные
          </button>
        )}
      </div>
    </section>
  )
}

/** Draw again with other look or format: the data stays, the model is not asked. */
function Rerender({ job }: { job: InfoJob }) {
  const qc = useQueryClient()
  const { data: options } = useMontageOptions()
  const s = job.settings
  const [style, setStyle] = useState<InfoStyle>(s.style)
  const [kind, setKind] = useState(s.kind)
  const [format, setFormat] = useState(s.format)
  const [quality, setQuality] = useState(s.quality)
  const [alpha, setAlpha] = useState(s.alpha)
  const [duration, setDuration] = useState(s.duration ? String(s.duration) : "")
  const sec = Number(duration.replace(",", "."))
  const changes: InfoRerender = { style, kind, format, quality, alpha, duration: kind === "animated" && duration ? sec : null }
  const same = style === s.style && kind === s.kind && format === s.format && quality === s.quality && alpha === s.alpha && (changes.duration ?? null) === (s.duration ?? null)
  const go = useMutation({
    mutationFn: () => montage.rerender(job.id, changes),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: mkeys.job(job.id) })
      qc.invalidateQueries({ queryKey: mkeys.jobs })
    },
    onError: (e) => toast.error(e.message),
  })
  const busy = ACTIVE.includes(job.status)
  const canRedraw = !busy && job.items.some((i) => i.spec)
  return (
    <Card title="Перерисовать" aside={<span className="font-mono text-[11px] text-faint">без модели</span>}>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-12">
        <div className="md:col-span-2 xl:col-span-12">
          <Label>Стиль</Label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {(options?.styles ?? []).map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => setStyle(o.value)}
                className={cn(
                  "flex min-w-0 items-center gap-2 rounded-[3px] border p-1.5 text-left text-[13px] transition-colors",
                  style === o.value ? "border-pick/60 bg-pick-soft font-medium text-pick-text" : "border-line-strong text-foreground-2 hover:border-faint",
                )}
              >
                <StyleSwatch style={o.value} className="h-8 w-12 shrink-0" />
                <span className="truncate">{o.label}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="xl:col-span-3">
          <Label>Вид</Label>
          <Seg value={kind} onChange={(v) => setKind(v as InfoSettings["kind"])} options={[["animated", "Анимированная"], ["static", "Статичная"]]} />
        </div>
        <div className="xl:col-span-2">
          <Label>Формат</Label>
          <Seg mono value={format} onChange={(v) => setFormat(v as InfoSettings["format"])} options={[["16:9", "16:9"], ["9:16", "9:16"]]} />
        </div>
        <div className="xl:col-span-3">
          <Label>Качество</Label>
          <Seg mono value={quality} onChange={(v) => setQuality(v as InfoSettings["quality"])} options={(options?.qualities ?? []).map((q) => [q.value, q.label] as const)} />
        </div>
        <div className="xl:col-span-2">
          <Label>Длительность, с</Label>
          <input
            value={kind === "animated" ? duration : ""}
            disabled={kind !== "animated" || job.source.kind === "orders"}
            onChange={(e) => setDuration(e.target.value.replace(/[^\d.,]/g, "").slice(0, 4))}
            placeholder={job.source.kind === "orders" ? "как кадр" : "авто"}
            className={cn(INPUT, "font-mono disabled:opacity-50")}
          />
        </div>
        <div className="xl:col-span-2">
          <Label>Без фона</Label>
          <Seg value={alpha ? "1" : "0"} onChange={(v) => setAlpha(v === "1")} options={[["0", "нет"], ["1", "да", kind === "animated" ? "ProRes 4444 .mov — большой файл" : "png"]]} />
        </div>
      </div>
      <div className="mt-4 flex justify-end">
        <button type="button" disabled={!canRedraw || same || go.isPending} onClick={() => go.mutate()} className={BTN_PRIMARY}>
          {go.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Paintbrush className="size-3.5" />}
          Перерисовать
        </button>
      </div>
    </Card>
  )
}

export function JobView({ job }: { job: InfoJob }) {
  const qc = useQueryClient()
  const { data: options } = useMontageOptions()
  const [data, setData] = useState<InfoItem | null>(null)
  const refresh = () => {
    qc.invalidateQueries({ queryKey: mkeys.job(job.id) })
    qc.invalidateQueries({ queryKey: mkeys.jobs })
  }
  const act = useMutation({
    mutationFn: (what: "stop" | "resume" | "again") =>
      what === "stop" ? montage.stop(job.id) : montage.resume(job.id, what === "again"),
    onSuccess: refresh,
    onError: (e) => toast.error(e.message),
  })
  const busy = ACTIVE.includes(job.status)
  const label = (t: string) => options?.types.find((o) => o.value === t)?.label ?? t
  const done = job.items.filter((i) => i.status === "done").length
  return (
    <div className="flex flex-col gap-5">
      <section className="rounded-[4px] border border-line bg-surface p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0 text-sm">
            {job.status === "done" ? (
              <span className="font-medium text-ok">
                Готово: {infographicsText(done)}
                {done < job.items.length && <span className="text-warn"> · {job.items.length - done} не вышло</span>}
              </span>
            ) : job.status === "error" ? (
              <span className="text-danger">{job.error || "Ошибка"}</span>
            ) : job.status === "stopped" ? (
              <span className="text-warn">Остановлена</span>
            ) : job.status === "queued" ? (
              <span className="text-muted-foreground">В очереди</span>
            ) : (
              <span className="text-pick-text">{stepText(job)}</span>
            )}
            <span className="ml-2 font-mono text-[11px] text-faint">
              {[job.timing.sec ? clock(job.timing.sec) : "", job.usage?.calls ? `модель: ${job.usage.calls} выз.` : ""].filter(Boolean).join(" · ")}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {busy ? (
              <button type="button" onClick={() => act.mutate("stop")} disabled={act.isPending} className={BTN_SECONDARY}>
                <Square className="size-3.5" />
                Остановить
              </button>
            ) : (
              <>
                {(job.status === "stopped" || job.status === "error") && (
                  <button type="button" onClick={() => act.mutate("resume")} disabled={act.isPending} className={BTN_SECONDARY}>
                    <RotateCcw className="size-3.5" />
                    Продолжить
                  </button>
                )}
                <button type="button" onClick={() => act.mutate("again")} disabled={act.isPending} className={BTN_SECONDARY} title="Модель заново читает текст">
                  <RotateCcw className="size-3.5" />
                  Заново
                </button>
              </>
            )}
            {job.files > 0 && !busy && (
              <a href={montage.zipUrl(job.id)} download className={BTN_PRIMARY}>
                <Download className="size-3.5" />
                Скачать всё
              </a>
            )}
          </div>
        </div>
        <div className="mt-3">
          <ProgressLine job={job} />
        </div>
        {job.problems?.length > 0 && (
          <div className="mt-3 flex items-start gap-2 text-xs text-warn">
            <AlertTriangle className="mt-px size-3.5 shrink-0" />
            <span>Не вошло: {job.problems.join("; ")}</span>
          </div>
        )}
      </section>

      {job.items.length > 0 && (
        <div className={cn("grid gap-4", job.settings.format === "9:16" ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4" : "grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3")}>
          {job.items.map((it) => (
            <ItemCard key={`${it.key}-${it.files.length}`} job={job} item={it} label={label(it.type)} onData={() => setData(it)} />
          ))}
        </div>
      )}

      {job.items.some((i) => i.spec) && <Rerender key={job.updated} job={job} />}

      <TextDialog title={data ? `Данные: ${data.title}` : ""} text={data ? JSON.stringify(data.spec, null, 2) : null} onClose={() => setData(null)} />
    </div>
  )
}
