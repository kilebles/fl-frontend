"use client"

import { useState } from "react"
import Link from "next/link"
import { AlertTriangle, ExternalLink, Pause, Play } from "lucide-react"

import { DownloadZipButton } from "@/components/jobs/job-menu"
import { isFinished, isSingle, type JobFile, type JobStatus } from "@/lib/api"
import { timeAgo } from "@/lib/format"
import { MODE_BY_ID } from "@/lib/modes"
import { useCurrentProject } from "@/lib/project"
import { useJob, useJobActions, useJobFiles, useJobs } from "@/lib/queries"
import { cn } from "@/lib/utils"

type RowState = "done" | "running" | "queued" | "error"

function batchState(job: JobStatus): { label: string; tone: string } {
  const p = job.progress
  switch (job.state) {
    case "running":
    case "waiting":
      return { label: "Идёт", tone: "bg-electric-soft text-electric-text" }
    case "queued":
      return { label: "В очереди", tone: "bg-surface-2 text-foreground-2" }
    case "cancelled":
      return { label: "На паузе", tone: "bg-warn-soft text-warn" }
    case "stopped":
    case "failed":
      return { label: p.remaining ? "Остановлен" : "Ошибка", tone: "bg-danger/12 text-danger" }
    case "done":
      return p.skipped ? { label: "Готово с ошибками", tone: "bg-danger/12 text-danger" } : { label: "Готово", tone: "bg-ok/12 text-ok" }
  }
}

/** Green done · blue in work · gray waiting · red errors. */
function SegmentBar({ job, className }: { job: JobStatus; className?: string }) {
  const p = job.progress
  const done = p.total - p.remaining - p.skipped
  const running = !isFinished(job.state) ? Math.min(p.remaining, 4) : 0
  const part = (n: number) => `${p.total ? (n / p.total) * 100 : 0}%`
  return (
    <div className={cn("flex h-1 gap-0.5 overflow-hidden", className)}>
      <span className="bg-ok" style={{ width: part(done) }} />
      <span className="bg-electric" style={{ width: part(running) }} />
      <span className="bg-danger" style={{ width: part(p.skipped) }} />
      <span className="flex-1 bg-elev" />
    </div>
  )
}

function meta(job: JobStatus) {
  const m = MODE_BY_ID[job.mode]
  return `${m.title}${m.flash ? " Flash" : ""} · 16:9 · ${timeAgo(job.created_at)}`
}

function BatchDetail({ job }: { job: JobStatus }) {
  const { data: detail } = useJob(job.id)
  const live = !isFinished(job.state)
  const { data: files } = useJobFiles(job.id, live)
  const actions = useJobActions()
  const [view, setView] = useState<"tiles" | "table">("tiles")
  const m = MODE_BY_ID[job.mode]

  const byRow = new Map<string, Set<JobFile["kind"]>>()
  for (const f of files ?? []) byRow.set(f.row, new Set([...(byRow.get(f.row) ?? []), f.kind]))
  const settled = (detail?.rows ?? []).map((row) => {
    const kinds = byRow.get(row.name) ?? new Set()
    const state: RowState = kinds.has(m.makesVideos ? "video" : "image") ? "done" : kinds.has("skip") ? "error" : "queued"
    return { row, state }
  })
  // the first few unfinished rows of a live batch are the ones in work
  const inWork = new Set(live ? settled.filter((r) => r.state === "queued").slice(0, 4).map((r) => r.row.name) : [])
  const rows = settled.map((r) => (inWork.has(r.row.name) ? { ...r, state: "running" as RowState } : r))


  const counts = { done: 0, running: 0, queued: 0, error: 0 }
  rows.forEach((r) => counts[r.state]++)
  const paused = job.state === "cancelled" || job.state === "stopped"

  return (
    <section className="flex flex-col gap-4 rounded-[4px] border border-line bg-surface p-5">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-lg font-semibold">{job.title || "Без названия"}</h3>
          <p className="mt-0.5 font-mono text-xs text-muted-foreground">{meta(job)}</p>
        </div>
        {live && (
          <button type="button" onClick={() => actions.cancel.mutate(job.id)} className="flex h-9 items-center gap-2 rounded-[3px] border border-line-strong px-3.5 text-sm hover:border-faint">
            <Pause className="size-3.5" /> Пауза
          </button>
        )}
        {paused && job.progress.remaining > 0 && (
          <button type="button" onClick={() => actions.retry.mutate(job.id)} className="flex h-9 items-center gap-2 rounded-[3px] border border-line-strong px-3.5 text-sm hover:border-faint">
            <Play className="size-3.5" /> Продолжить
          </button>
        )}
        <DownloadZipButton job={job} />
        <Link href={`/jobs/${job.id}`} className="flex h-9 items-center gap-2 rounded-[3px] border border-line-strong px-3.5 text-sm hover:border-faint">
          <ExternalLink className="size-3.5" /> Результаты
        </Link>
      </div>
      <SegmentBar job={job} className="h-1.5" />
      <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-foreground-2">
        {(
          [
            ["bg-ok", "Готово", counts.done],
            ["bg-electric", "Генерируется", counts.running],
            ["bg-faint", "В очереди", counts.queued],
            ["bg-danger", "Ошибки", counts.error],
          ] as const
        ).map(([dot, label, n]) => (
          <span key={label} className="flex items-center gap-2">
            <span className={cn("size-2 rounded-[1px]", dot)} /> {label} <span className="font-mono text-foreground">{n}</span>
          </span>
        ))}
      </div>
      <div className="flex justify-end">
        <div className="flex rounded-[3px] bg-surface-2 p-[3px] text-sm">
          {(
            [
              ["tiles", "Плитки"],
              ["table", "Таблица"],
            ] as const
          ).map(([key, label]) => (
            <button key={key} type="button" onClick={() => setView(key)} className={cn("rounded-[2px] px-3 py-1.5", view === key ? "bg-elev font-medium" : "text-foreground-2")}>
              {label}
            </button>
          ))}
        </div>
      </div>
      {view === "tiles" ? (
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
          {rows.map(({ row, state }) => (
            <div
              key={row.name}
              title={row.prompt ?? row.image_prompt ?? ""}
              className={cn(
                "relative aspect-[16/10] rounded-[3px] border p-1.5 font-mono text-[11px]",
                state === "done" && "border-line bg-ok/10",
                state === "running" && "border-electric bg-electric-soft",
                state === "queued" && "border-line bg-background text-faint",
                state === "error" && "border-danger/50 bg-danger/10"
              )}
            >
              {row.name}
              {state === "running" && <span className="bar-running absolute inset-x-0 bottom-0 h-[3px]" />}
            </div>
          ))}
        </div>
      ) : (
        <div className="overflow-hidden rounded-[3px] border border-line text-sm">
          {rows.map(({ row, state }) => (
            <div key={row.name} className="grid grid-cols-[3.5rem_1fr_7rem] gap-3 border-b border-line px-3 py-2 last:border-b-0">
              <span className="font-mono text-xs text-faint">{row.name}</span>
              <span className="truncate">{row.prompt ?? row.image_prompt}</span>
              <span className={cn("text-right text-xs", state === "done" ? "text-ok" : state === "error" ? "text-danger" : state === "running" ? "text-electric-text" : "text-faint")}>
                {{ done: "Готово", running: "Генерация", queued: "В очереди", error: "Ошибка" }[state]}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

export function BatchesPanel({ selected, onSelect }: { selected: string | null; onSelect: (id: string) => void }) {
  const { data: jobs, isLoading, error } = useJobs()
  const [projectId] = useCurrentProject()
  const batches = (jobs ?? []).filter((j) => !isSingle(j) && (!projectId || !j.project_id || j.project_id === projectId))
  const current = batches.find((j) => j.id === selected) ?? batches[0]

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <h2 className="text-lg font-semibold">Пакеты</h2>
      {isLoading ? (
        <div className="shimmer h-40 rounded-[4px]" />
      ) : error && !jobs ? (
        <div className="flex items-center gap-3 rounded-[4px] border border-danger/40 bg-danger/10 p-4 text-sm text-danger">
          <AlertTriangle className="size-4 shrink-0" />
          <span>Не удалось загрузить историю пакетов: {error.message}</span>
        </div>
      ) : batches.length === 0 ? (
        <p className="rounded-[4px] border border-dashed border-line-strong p-10 text-center text-sm text-muted-foreground">Пакетов пока нет</p>
      ) : (
        <>
          <div className="overflow-hidden rounded-[4px] border border-line bg-surface">
            {batches.map((job) => {
              const s = batchState(job)
              const on = job.id === current?.id
              return (
                <div
                  key={job.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => onSelect(job.id)}
                  onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onSelect(job.id)}
                  className={cn(
                    "grid w-full cursor-pointer grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto_auto] items-center gap-4 border-b border-l-2 border-b-line px-4 py-3.5 text-left transition-colors last:border-b-0",
                    on ? "border-l-electric bg-surface-2" : "border-l-transparent hover:bg-surface-2/60"
                  )}
                >
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{job.title || "Без названия"}</span>
                    <span className="block truncate font-mono text-xs text-muted-foreground">{meta(job)}</span>
                  </span>
                  <span>
                    <SegmentBar job={job} />
                    <span className="mt-1.5 block font-mono text-xs text-muted-foreground">
                      {job.progress.total - job.progress.remaining} / {job.progress.total}
                    </span>
                  </span>
                  <DownloadZipButton job={job} className="h-8 px-2.5 text-xs" />
                  <span className={cn("rounded-[2px] px-2 py-1 text-xs", s.tone)}>{s.label}</span>
                </div>
              )
            })}
          </div>
          {current && <BatchDetail key={current.id} job={current} />}
        </>
      )}
    </div>
  )
}
