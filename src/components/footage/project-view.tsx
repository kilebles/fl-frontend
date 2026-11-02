"use client"

import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { AlertTriangle, Download, FileText, Loader2, RotateCcw, Square, Trash2, TriangleAlert } from "lucide-react"
import { toast } from "sonner"

import { GroupBar, StageSteps, aiCalls, clock, shotsText } from "@/components/footage/parts"
import { fkeys, useFootageLog, useFootageOptions } from "@/components/footage/queries"
import { ConfirmDialog } from "@/components/script/parts"
import { setUrlParams } from "@/components/script/queries"
import { BTN_SECONDARY, Card } from "@/components/script/ui"
import { footage, type FootageLogEvent, type FootageProject } from "@/lib/api"
import { cn } from "@/lib/utils"

function Tile({
  label,
  value,
  sub,
  tone,
  aside,
}: {
  label: string
  value: React.ReactNode
  sub?: React.ReactNode
  tone?: "ok" | "warn" | "pick"
  aside?: React.ReactNode
}) {
  return (
    <div className="flex min-w-0 flex-col justify-between gap-2 rounded-[3px] border border-line bg-background p-3.5">
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        {label}
        {aside}
      </div>
      <div
        className={cn(
          "font-mono text-2xl leading-none font-medium",
          tone === "ok" && "text-ok",
          tone === "warn" && "text-warn",
          tone === "pick" && "text-pick-text",
        )}
      >
        {value}
      </div>
      {sub && <div className="truncate font-mono text-[11px] text-faint">{sub}</div>}
    </div>
  )
}

/** Log line in plain words; noisy per-shot events are left out. */
function logText(e: FootageLogEvent): string | null {
  switch (e.event) {
    case "log":
      return String(e.text ?? "")
    case "parsed":
      return `Сценарий: ${e.paragraphs} абзацев, с озвучкой ${e.with_audio}`
    case "planned":
      return `Шот-лист: ${shotsText(Number(e.shots))}, искать видео для ${e.searchable}`
    case "plan_error":
      return `Шот-лист: ошибка, повтор частями — ${String(e.error ?? "").slice(0, 200)}`
    case "plan_failed":
      return `Шот-лист не получен для абзацев: ${(e.paragraphs as number[] | undefined)?.join(", ")}`
    case "round":
      return `${typeof e.round === "number" ? `Раунд ${e.round}` : "Доп. круг"}: ${shotsText(Number(e.shots))}`
    case "fatal":
      return `Ошибка: ${e.error}`
    case "finished":
      return "Готово"
    default:
      return null
  }
}

function Log({ id }: { id: string }) {
  const { data } = useFootageLog(id)
  const lines = (data ?? [])
    .map((e) => [e.ts, logText(e)] as const)
    .filter(([, t]) => t)
    .slice(-14)
  if (!lines.length) return null
  return (
    <Card title="Ход работы" bodyClass="p-0">
      <ol className="max-h-80 overflow-y-auto py-1.5">
        {lines.map(([ts, t], i) => (
          <li key={i} className="grid grid-cols-[64px_minmax(0,1fr)] gap-3 px-4 py-1 font-mono text-[11px]">
            <span className="text-faint">{ts?.slice(11, 19)}</span>
            <span className="break-words text-foreground-2">{t}</span>
          </li>
        ))}
      </ol>
    </Card>
  )
}

export function ProjectView({ project: p }: { project: FootageProject }) {
  const qc = useQueryClient()
  const { data: options } = useFootageOptions()
  const [del, setDel] = useState(false)
  const act = useMutation({
    mutationFn: (what: "stop" | "resume") => footage[what](p.id),
    onSuccess: (data) => {
      qc.setQueryData(fkeys.project(p.id), data)
      qc.invalidateQueries({ queryKey: fkeys.projects })
    },
    onError: (e) => toast.error(e.message),
  })

  const s = p.stats
  const pr = p.progress
  const running = p.status === "running" || p.status === "queued"
  const done = p.status === "done"
  const planOnly = !!(s?.plan_only ?? p.options.plan_only)
  const ai = (s?.not_found ?? 0) + (s?.error ?? 0)
  const calls = aiCalls(p)
  const active = p.stages.find((x) => x.state === "active")

  const captions = {
    plan: pr.shots ? shotsText(pr.shots) : p.status === "queued" ? "в очереди" : active?.key === "plan" ? (p.step ?? "") : "",
    search: active?.key === "search" ? (p.step ?? "") : "",
    extra: active?.key === "extra" ? "только YouTube" : "",
    cut:
      active?.key === "cut" && active.total ? `${active.done}/${active.total}` : done && s && !planOnly ? `${s.video ?? 0} видео · ${s.image ?? 0} фото` : "",
    done: done ? [s?.elapsed_sec ? clock(s.elapsed_sec) : "", calls ? `${calls} вызовов ИИ` : ""].filter(Boolean).join(" · ") : "",
  }

  return (
    <div className="space-y-5">
      <div className="rounded-[4px] border border-line bg-surface px-5 py-4">
        <StageSteps stages={p.stages} captions={captions} />
      </div>

      {p.status === "error" && p.error && (
        <div className="flex items-start gap-2.5 rounded-[4px] border border-danger/40 bg-danger/10 px-4 py-3 text-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger" />
          <span className="whitespace-pre-wrap text-foreground-2">{p.error}</span>
        </div>
      )}
      {!!pr.plan_failed?.length && (
        <div className="flex items-start gap-2.5 rounded-[4px] border border-warn/40 bg-warn-soft px-4 py-3 text-sm">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warn" />
          <span className="text-foreground-2">Шот-лист не получен для абзацев {pr.plan_failed.join(", ")} — для них кадры не искались.</span>
        </div>
      )}

      <section className="rounded-[4px] border border-line bg-surface p-4">
        {done && s && !planOnly ? (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <Tile label="Все кадры" value={s.total} sub={`${p.source.paragraphs} абзацев`} />
            <Tile
              label="Найдено"
              value={s.ok ?? 0}
              tone="ok"
              sub={`${s.video ?? 0} видео · ${s.image ?? 0} фото · ${s.total ? Math.round(((s.ok ?? 0) / s.total) * 100) : 0}%`}
            />
            <Tile label="На ИИ" value={ai} tone="pick" sub={`${s.not_found ?? 0} не найдено · ${s.error ?? 0} ошибки`} />
            <Tile label="Карты и инфографика" value={s.handoff ?? 0} sub="в «Графику»" />
            <Tile
              label="Проверить лицензию"
              value={s.risky ?? 0}
              tone={s.risky ? "warn" : undefined}
              sub={s.risky ? "см. credits.txt" : "всё свободное"}
              aside={s.risky ? <TriangleAlert className="size-3.5 text-warn" /> : undefined}
            />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <Tile label="Абзацы" value={p.source.paragraphs} sub={p.source.tracks ? `по озвучке · ${p.source.tracks} дорожек` : "длительность по тексту"} />
            <Tile
              label="Кадров в шот-листе"
              value={pr.shots ?? s?.total ?? "—"}
              sub={pr.searchable ? `искать видео: ${pr.searchable}` : planOnly ? "только шот-лист" : ""}
            />
            <Tile
              label="Найдено"
              value={pr.counts?.ok ?? "—"}
              tone={pr.counts?.ok ? "ok" : undefined}
              sub={active?.total ? `${p.step} · ${active.done}/${active.total}` : (p.step ?? "")}
            />
            <Tile
              label="Порог"
              value={p.options.min_score ?? options?.defaults.min_score ?? "—"}
              sub={p.options.min_score != null ? "ниже — на ИИ" : "из настроек сервера"}
            />
            <Tile
              label="Формат"
              value={p.options.format}
              sub={p.options.groups.length === 4 ? "все источники" : `${p.options.groups.length} из 4 источников`}
            />
          </div>
        )}
        <div className="mt-4 flex flex-wrap items-end justify-between gap-4 border-t border-line pt-4">
          {done && s?.by_group ? <GroupBar by={s.by_group} className="min-w-64 flex-1" /> : <span className="flex-1" />}
          <div className="flex flex-wrap items-center gap-2">
            {running ? (
              <button
                type="button"
                disabled={act.isPending}
                onClick={() => act.mutate("stop")}
                className="flex h-10 items-center gap-2 rounded-[3px] border border-danger/40 bg-danger/10 px-4 text-sm font-medium text-danger hover:bg-danger/20"
              >
                <Square className="size-3" />
                Стоп
              </button>
            ) : (
              <button
                type="button"
                disabled={act.isPending}
                onClick={() => act.mutate("resume")}
                className={BTN_SECONDARY}
                title="Запустить заново в новую папку, прошлый результат останется"
              >
                {act.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <RotateCcw className="size-3.5" />}
                {done ? "Запустить заново" : "Продолжить"}
              </button>
            )}
            {done && p.has_result && (
              <a
                href={footage.zipUrl(p.id, "files")}
                download
                className={BTN_SECONDARY}
                title="manifest.json, timeline.edl, credits.txt, shots.json, review.html"
              >
                <FileText className="size-3.5" />
                {planOnly ? "Шот-лист .zip" : "EDL · атрибуция"}
              </a>
            )}
            {done && p.has_result && !planOnly && (
              <a
                href={footage.zipUrl(p.id, "clips")}
                download
                className="flex h-10 items-center gap-2 rounded-[3px] bg-inverse px-4 text-sm font-medium text-inverse-foreground hover:opacity-90"
              >
                <Download className="size-3.5" />
                Кадры .zip
              </a>
            )}
            <button
              type="button"
              title="Удалить проект"
              onClick={() => setDel(true)}
              className="grid size-10 place-items-center rounded-[3px] border border-line-strong text-faint hover:border-danger/40 hover:bg-danger/10 hover:text-danger"
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        </div>
      </section>

      <Log id={p.id} />

      <ConfirmDialog
        open={del}
        title={`Удалить «${p.title}»?`}
        text={
          p.status === "running" ? "Поиск идёт — сначала останови его." : "Проект пропадёт из списка. Кадры и файлы останутся на сервере в папке результата."
        }
        onClose={() => setDel(false)}
        onConfirm={async () => {
          await footage.remove(p.id)
          qc.invalidateQueries({ queryKey: fkeys.projects })
          setUrlParams({ p: null })
        }}
      />
    </div>
  )
}
