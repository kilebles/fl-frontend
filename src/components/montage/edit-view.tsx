"use client"

import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { AlertTriangle, Download, FolderArchive, Loader2, Music, RotateCcw, Square, Type, Wrench } from "lucide-react"
import { toast } from "sonner"

import { clock } from "@/components/footage/parts"
import { EDIT_ACCENT, EditProgress, MEDIA_ICON, editStep, mediaMeta, sec1, secs } from "@/components/montage/edit-parts"
import { size } from "@/components/montage/parts"
import { mkeys, useMontageOptions } from "@/components/montage/queries"
import { BTN_PRIMARY, BTN_SECONDARY, Card, INPUT, Label, Seg } from "@/components/script/ui"
import { edits, type EditJob, type EditSettings, type EditStyle } from "@/lib/api"
import { cn } from "@/lib/utils"

const ACTIVE = ["queued", "running"]
const TRANSITION: Record<string, string> = {
  cut: "склейка",
  dissolve: "растворение",
  fade: "через чёрное",
  flash: "вспышка",
  zoom: "зум-удар",
  slide: "сдвиг",
}
const TITLE_KIND: Record<string, string> = { title: "заголовок", lower: "плашка", caption: "подпись" }
const BAR = ["bg-pick/70", "bg-ok/60", "bg-warn/60", "bg-electric/50", "bg-danger/50", "bg-foreground-2/40"]

function Player({ job }: { job: EditJob }) {
  const portrait = job.settings.format === "9:16"
  const r = job.result
  return (
    <div className={cn("overflow-hidden rounded-[4px] border border-line bg-black", portrait ? "mx-auto aspect-[9/16] w-full max-w-[360px]" : "aspect-video w-full")}>
      {r?.video ? (
        <video
          key={r.video}
          src={edits.fileUrl(job.id, r.video)}
          poster={r.poster ? edits.fileUrl(job.id, r.poster) : undefined}
          controls
          playsInline
          preload="none"
          className="size-full object-contain"
        />
      ) : (
        <div className="grid size-full place-items-center px-6 text-center text-sm text-muted-foreground">
          {ACTIVE.includes(job.status) ? (
            <span className="flex flex-col items-center gap-2">
              <Loader2 className="size-5 animate-spin text-faint" />
              {job.status === "queued" ? "в очереди" : editStep(job)}
            </span>
          ) : (
            "Видео ещё нет"
          )}
        </div>
      )}
    </div>
  )
}

function PlanCard({ job }: { job: EditJob }) {
  const plan = job.plan
  const thumbs = Object.fromEntries(job.media.map((m) => [m.id, m.thumb]))
  if (!plan) return null
  return (
    <Card
      title="План монтажа"
      aside={
        <span className="font-mono text-[11px] text-faint">
          {[plan.by === "code" ? "кодом, без модели" : "модель", `${plan.segments.length} кусков`, secs(plan.length)].join(" · ")}
        </span>
      }
      bodyClass="p-0"
    >
      {plan.notes && <div className="border-b border-line px-4 py-2 text-xs text-muted-foreground">{plan.notes}</div>}
      <div className="flex h-2 w-full overflow-hidden">
        {plan.segments.map((s, i) => (
          <div key={i} title={`${s.name} · ${sec1(s.sec)}`} className={cn("h-full border-r border-surface", BAR[i % BAR.length])} style={{ width: `${(s.sec / plan.length) * 100}%` }} />
        ))}
      </div>
      <div className="max-h-[420px] divide-y divide-line overflow-y-auto">
        {plan.segments.map((s, i) => {
          const Icon = MEDIA_ICON[s.kind]
          const thumb = thumbs[s.media]
          return (
            <div key={i} className="grid grid-cols-[44px_56px_minmax(0,1fr)] items-center gap-3 px-4 py-2">
              <span className="font-mono text-[11px] text-muted-foreground">{secs(s.at)}</span>
              <div className="grid h-8 w-14 place-items-center overflow-hidden rounded-[2px] bg-background">
                {thumb ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={edits.fileUrl(job.id, thumb)} alt="" className="size-full object-cover" />
                ) : (
                  <Icon className="size-3.5 text-faint" />
                )}
              </div>
              <div className="min-w-0">
                <div className="flex min-w-0 items-center gap-1.5 text-[13px]">
                  <span className="truncate">{s.name || s.media}</span>
                  <span className="shrink-0 font-mono text-[11px] text-faint">
                    {s.kind === "video" && s.from != null && s.to != null ? `${sec1(s.from)}–${sec1(s.to)}` : "картинка"} → {sec1(s.sec)}
                    {s.speed !== 1 ? ` · ×${s.speed}` : ""}
                  </span>
                </div>
                <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[11px] text-muted-foreground">
                  <span className="shrink-0 rounded-[2px] bg-surface-2 px-1.5 py-px">{TRANSITION[s.transition] ?? s.transition}</span>
                  {s.sound && <span className="shrink-0 rounded-[2px] bg-ok/15 px-1.5 py-px text-ok">свой звук</span>}
                  {s.why && <span className="truncate">{s.why}</span>}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </Card>
  )
}

function SoundAndText({ job }: { job: EditJob }) {
  const m = job.music
  const titles = job.plan?.titles ?? []
  return (
    <Card title="Музыка и титры">
      <div className="flex flex-col gap-3 text-[13px]">
        <div className="flex items-start gap-2">
          <Music className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
          {!m ? (
            <span className="text-faint">{job.settings.music === "none" ? "Без музыки" : "подберётся после плана"}</span>
          ) : m.mode === "own" ? (
            <span>Своя: {m.name}</span>
          ) : m.mode === "epidemic" && m.track ? (
            <span>
              {m.track.title}
              {m.track.artists?.length ? <span className="text-muted-foreground"> — {m.track.artists.join(", ")}</span> : null}
              <span className="ml-1 font-mono text-[11px] text-faint">Epidemic{m.edited ? " · подогнан по длине" : ""}</span>
            </span>
          ) : (
            <span className="text-faint">Без музыки{m.note ? ` (${m.note})` : ""}</span>
          )}
        </div>
        {job.media.some((x) => x.kind === "voice") && (
          <div className="flex items-start gap-2">
            <MEDIA_ICON.voice className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
            <span>Озвучка: {job.media.find((x) => x.kind === "voice")?.name}</span>
          </div>
        )}
        <div className="flex items-start gap-2">
          <Type className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
          {titles.length ? (
            <div className="flex min-w-0 flex-col gap-1">
              {titles.map((t, i) => (
                <span key={i} className="min-w-0">
                  <span className="mr-1.5 font-mono text-[11px] text-faint">
                    {secs(t.at)} · {TITLE_KIND[t.kind] ?? t.kind}
                  </span>
                  {t.text}
                </span>
              ))}
            </div>
          ) : (
            <span className="text-faint">{job.plan ? "Без титров" : "титры — в плане"}</span>
          )}
        </div>
      </div>
    </Card>
  )
}

function Files({ job }: { job: EditJob }) {
  return (
    <Card title="Файлы" aside={<span className="font-mono text-[11px] text-faint">{size(job.media.reduce((a, m) => a + m.size, 0))}</span>}>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {job.media.map((m) => {
          const Icon = MEDIA_ICON[m.kind]
          return (
            <div key={m.id} className="min-w-0 overflow-hidden rounded-[3px] border border-line bg-background">
              <div className="relative grid aspect-video place-items-center overflow-hidden bg-surface-2">
                {m.thumb ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={edits.fileUrl(job.id, m.thumb)} alt="" className="absolute inset-0 size-full object-cover" />
                ) : (
                  <Icon className="size-5 text-faint" />
                )}
              </div>
              <div className="px-2 py-1.5">
                <div className="flex items-center gap-1 text-[12px]">
                  <span className="shrink-0 font-mono text-[10px] text-faint">{m.id}</span>
                  <span className="truncate">{m.name}</span>
                </div>
                <div className="truncate font-mono text-[10px] text-muted-foreground">{mediaMeta(m) || size(m.size)}</div>
              </div>
            </div>
          )
        })}
      </div>
    </Card>
  )
}

/** The same plan, built again with another style, format, quality or length — the model is not asked. */
function Rebuild({ job }: { job: EditJob }) {
  const qc = useQueryClient()
  const { data: options } = useMontageOptions()
  const s = job.settings
  const voice = job.media.some((m) => m.kind === "voice")
  const [style, setStyle] = useState<EditStyle>(s.style)
  const [format, setFormat] = useState(s.format)
  const [quality, setQuality] = useState(s.quality)
  const [duration, setDuration] = useState(s.duration ? String(s.duration) : "")
  const sec = Number(duration.replace(",", "."))
  const max = options?.edit?.limits.max_sec ?? 60
  const durOk = voice || duration === "" || (sec >= (options?.edit?.limits.min_sec ?? 5) && sec <= max)
  const dur = !voice && duration ? sec : null
  const same = style === s.style && format === s.format && quality === s.quality && (dur ?? null) === (s.duration ?? null)
  const go = useMutation({
    mutationFn: () => edits.rerender(job.id, { style, format, quality, duration: dur }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: mkeys.edit(job.id) })
      qc.invalidateQueries({ queryKey: mkeys.edits })
    },
    onError: (e) => toast.error(e.message),
  })
  return (
    <Card title="Пересобрать" aside={<span className="font-mono text-[11px] text-faint">тот же план, без модели</span>}>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-12">
        <div className="md:col-span-2 xl:col-span-12">
          <Label>Стиль</Label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
            {(options?.edit?.styles ?? []).map((o) => (
              <button
                key={o.value}
                type="button"
                title={o.hint}
                onClick={() => setStyle(o.value)}
                className={cn(
                  "flex min-w-0 items-center gap-2 rounded-[3px] border px-2.5 py-2 text-left text-[13px] transition-colors",
                  style === o.value ? "border-pick/60 bg-pick-soft font-medium text-pick-text" : "border-line-strong text-foreground-2 hover:border-faint",
                )}
              >
                <span className="size-2 shrink-0 rounded-full" style={{ background: EDIT_ACCENT[o.value] }} />
                <span className="truncate">{o.label}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="xl:col-span-3">
          <Label>Формат</Label>
          <Seg mono value={format} onChange={(v) => setFormat(v as EditSettings["format"])} options={[["9:16", "9:16"], ["16:9", "16:9"]]} />
        </div>
        <div className="xl:col-span-4">
          <Label>Качество</Label>
          <Seg mono value={quality} onChange={(v) => setQuality(v as EditSettings["quality"])} options={(options?.qualities ?? []).map((q) => [q.value, q.label] as const)} />
        </div>
        <div className="xl:col-span-2">
          <Label>Длительность, с</Label>
          <input
            value={voice ? "" : duration}
            disabled={voice}
            onChange={(e) => setDuration(e.target.value.replace(/[^\d.,]/g, "").slice(0, 4))}
            placeholder={voice ? "по озвучке" : "как в плане"}
            className={cn(INPUT, "font-mono disabled:opacity-60", !durOk && "border-danger text-danger")}
          />
        </div>
        <div className="flex items-end justify-end xl:col-span-3">
          <button type="button" disabled={ACTIVE.includes(job.status) || same || !durOk || go.isPending} onClick={() => go.mutate()} className={BTN_PRIMARY}>
            {go.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Wrench className="size-3.5" />}
            Пересобрать
          </button>
        </div>
      </div>
    </Card>
  )
}

export function EditView({ job }: { job: EditJob }) {
  const qc = useQueryClient()
  const refresh = () => {
    qc.invalidateQueries({ queryKey: mkeys.edit(job.id) })
    qc.invalidateQueries({ queryKey: mkeys.edits })
  }
  const act = useMutation({
    mutationFn: (what: "stop" | "resume" | "again") => (what === "stop" ? edits.stop(job.id) : edits.resume(job.id, what === "again")),
    onSuccess: refresh,
    onError: (e) => toast.error(e.message),
  })
  const busy = ACTIVE.includes(job.status)
  const r = job.result
  return (
    <div className="flex flex-col gap-5">
      <section className="rounded-[4px] border border-line bg-surface p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0 text-sm">
            {job.status === "done" ? (
              <span className="font-medium text-ok">Готово · {secs(r?.sec)}</span>
            ) : job.status === "error" ? (
              <span className="text-danger">{job.error || "Ошибка"}</span>
            ) : job.status === "stopped" ? (
              <span className="text-warn">Остановлен</span>
            ) : job.status === "queued" ? (
              <span className="text-muted-foreground">В очереди</span>
            ) : (
              <span className="text-pick-text">{editStep(job)}</span>
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
                <button type="button" onClick={() => act.mutate("again")} disabled={act.isPending} className={BTN_SECONDARY} title="Модель заново смотрит файлы и составляет новый план">
                  <RotateCcw className="size-3.5" />
                  Заново
                </button>
              </>
            )}
            {r?.project && !busy && (
              <a href={edits.fileUrl(job.id, r.project, true)} className={BTN_SECONDARY} title="Клипы, дорожки и таймлайн для DaVinci Resolve (File → Import → Timeline)">
                <FolderArchive className="size-3.5" />
                Проект DaVinci
              </a>
            )}
            {r?.video && !busy && (
              <a href={edits.fileUrl(job.id, r.video, true)} className={BTN_PRIMARY}>
                <Download className="size-3.5" />
                mp4 · {size(r.size)}
              </a>
            )}
          </div>
        </div>
        {job.status !== "done" && (
          <div className="mt-3">
            <EditProgress job={job} />
          </div>
        )}
        {job.problems?.length > 0 && (
          <div className="mt-3 flex items-start gap-2 text-xs text-warn">
            <AlertTriangle className="mt-px size-3.5 shrink-0" />
            <span>{job.problems.join("; ")}</span>
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-5">
          <Player job={job} />
          {job.description && (
            <Card title="Описание">
              <p className="text-[13px] leading-relaxed whitespace-pre-line text-foreground-2">{job.description}</p>
            </Card>
          )}
        </div>
        <div className="flex flex-col gap-5">
          <PlanCard job={job} />
          <SoundAndText job={job} />
        </div>
      </div>

      <Files job={job} />
      {job.plan && <Rebuild key={job.updated} job={job} />}
    </div>
  )
}
