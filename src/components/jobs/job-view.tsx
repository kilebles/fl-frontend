"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { AlertTriangle, ArrowLeft, Ban, Film, Hourglass, Image as ImageIcon, RotateCcw } from "lucide-react"
import { motion } from "motion/react"

import { JobMenu } from "@/components/jobs/job-menu"
import { Lightbox } from "@/components/jobs/lightbox"
import { ResultCard, type RowResult } from "@/components/jobs/result-card"
import { StateBadge } from "@/components/jobs/state"
import { isFinished, type JobFile } from "@/lib/api"
import { jobTitle, percent, timeAgo } from "@/lib/format"
import { MODE_BY_ID, modeLabel } from "@/lib/modes"
import { useJob, useJobActions, useJobFiles } from "@/lib/queries"
import { cn } from "@/lib/utils"

type Filter = "all" | "done" | "skipped" | "pending"

function Stat({ icon: Icon, label, value, tone }: { icon: React.ElementType; label: string; value: number; tone?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className={cn("size-3.5", tone)} /> {label}
      </p>
      <p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  )
}

export function JobView({ id }: { id: string }) {
  const { data: job, error } = useJob(id)
  const live = !!job && !isFinished(job.state)
  const { data: files } = useJobFiles(id, live)
  const actions = useJobActions()
  const [filter, setFilter] = useState<Filter>("all")
  const [open, setOpen] = useState<number | null>(null)

  const results = useMemo<RowResult[]>(() => {
    if (!job) return []
    const meta = MODE_BY_ID[job.mode]
    const byRow = new Map<string, Partial<Record<JobFile["kind"], JobFile>>>()
    for (const f of files ?? []) byRow.set(f.row, { ...byRow.get(f.row), [f.kind]: f })
    return job.rows.map((row) => {
      const f = byRow.get(row.name) ?? {}
      const final = meta.makesVideos ? f.video : f.image
      const status: RowResult["status"] = final ? "done" : f.skip ? "skipped" : f.image ? "working" : "pending"
      return { row, image: f.image, video: f.video, skip: f.skip, status }
    })
  }, [job, files])

  const shown = useMemo(
    () => results.filter((r) => filter === "all" || (filter === "pending" ? r.status === "pending" || r.status === "working" : r.status === filter)),
    [results, filter]
  )

  if (error) {
    return (
      <div className="mx-auto max-w-xl px-6 pt-24 text-center">
        <h1 className="text-2xl font-semibold">Задача не найдена</h1>
        <p className="mt-2 text-muted-foreground">{error.message}</p>
        <Link href="/jobs" className="mt-6 inline-flex items-center gap-2 text-sm text-electric">
          <ArrowLeft className="size-4" /> Все задачи
        </Link>
      </div>
    )
  }
  if (!job) return <JobSkeleton />

  const meta = MODE_BY_ID[job.mode]
  const p = job.progress
  const value = percent(p)
  const counts = {
    all: results.length,
    done: results.filter((r) => r.status === "done").length,
    skipped: results.filter((r) => r.status === "skipped").length,
    pending: results.filter((r) => r.status === "pending" || r.status === "working").length,
  }

  return (
    <div className="mx-auto max-w-7xl px-4 pt-6 sm:px-6 md:pt-8 pb-20 lg:px-10">
      <Link href="/jobs" className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
        <ArrowLeft className="size-4" /> Задачи
      </Link>

      <motion.header initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mb-6 flex flex-wrap items-start gap-4">
        <div className="min-w-0 flex-1">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <StateBadge state={job.state} />
            <span className="inline-flex h-7 items-center rounded-full border border-line-strong px-3 text-xs text-muted-foreground">{modeLabel(job.mode)}</span>
            {job.position !== null && job.position > 0 && <span className="text-xs text-faint">#{job.position} в очереди</span>}
          </div>
          <h1 className="truncate text-3xl font-semibold tracking-tight md:text-4xl">{jobTitle(job)}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Создана {timeAgo(job.created_at)}
            {job.strategy === "sequential" && " · аккаунты по очереди"}
            {p.pass_num > 1 && ` · проход ${p.pass_num}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {["stopped", "failed", "cancelled"].includes(job.state) && p.remaining > 0 && (
            <button
              type="button"
              onClick={() => actions.retry.mutate(job.id)}
              className="glow-electric inline-flex h-10 items-center gap-2 rounded-xl bg-electric px-4 text-sm font-semibold text-white hover:brightness-110"
            >
              <RotateCcw className="size-4" /> Догенерировать {p.remaining}
            </button>
          )}
          <JobMenu job={job} redirect />
        </div>
      </motion.header>

      <div className="mb-3 rounded-2xl border border-line bg-surface p-5">
        <div className="mb-3 flex items-end justify-between">
          <p className="text-sm text-muted-foreground">
            Готово <span className="font-semibold text-foreground tabular-nums">{p.total - p.remaining}</span> из {p.total}
          </p>
          <p className="font-mono text-3xl font-semibold tabular-nums">{value}%</p>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-elev">
          <motion.div
            className={cn("h-full rounded-full", live ? "bar-running" : job.state === "done" ? "bg-ok" : "bg-faint")}
            initial={{ width: 0 }}
            animate={{ width: `${value}%` }}
            transition={{ type: "spring", stiffness: 90, damping: 22 }}
          />
        </div>
        {job.message && (
          <p className={cn("mt-4 flex items-start gap-2 text-sm", job.state === "failed" ? "text-danger" : "text-warn")}>
            <AlertTriangle className="mt-0.5 size-4 shrink-0" /> {job.message}
          </p>
        )}
      </div>

      <div className={cn("mb-10 grid gap-3", meta.makesImages && meta.makesVideos ? "grid-cols-2 md:grid-cols-4" : "grid-cols-3")}>
        {meta.makesImages && <Stat icon={ImageIcon} label="Картинки" value={p.images_done} tone="text-electric" />}
        {meta.makesVideos && <Stat icon={Film} label="Видео" value={p.videos_done} tone="text-electric" />}
        <Stat icon={Ban} label="Пропущено" value={p.skipped} tone="text-danger" />
        <Stat icon={Hourglass} label="Осталось" value={p.remaining} tone="text-warn" />
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold tracking-tight">Результаты</h2>
        <div className="inline-flex rounded-xl border border-line bg-surface p-1">
          {(
            [
              ["all", "Все"],
              ["done", "Готовые"],
              ["pending", "В работе"],
              ["skipped", "Пропущенные"],
            ] as [Filter, string][]
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={cn("relative h-8 rounded-lg px-3 text-[13px] font-medium transition-colors", filter === key ? "text-foreground" : "text-muted-foreground hover:text-foreground")}
            >
              {filter === key && <motion.span layoutId="result-filter" className="absolute inset-0 rounded-lg bg-elev ring-1 ring-line-strong" transition={{ type: "spring", stiffness: 500, damping: 38 }} />}
              <span className="relative">
                {label} <span className="font-mono text-xs text-faint">{counts[key]}</span>
              </span>
            </button>
          ))}
        </div>
      </div>

      {shown.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line-strong p-10 text-center text-sm text-muted-foreground">Здесь пока ничего нет</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {shown.map((r) => (
            <ResultCard key={r.row.name} result={r} live={live} onOpen={() => setOpen(shown.indexOf(r))} />
          ))}
        </div>
      )}

      <Lightbox results={shown} index={open} onIndex={setOpen} />
    </div>
  )
}

export function JobSkeleton() {
  return (
    <div className="mx-auto max-w-7xl px-4 pt-6 sm:px-6 md:pt-8 lg:px-10">
      <div className="shimmer mb-6 h-5 w-24 rounded-lg" />
      <div className="shimmer mb-3 h-10 w-80 rounded-xl" />
      <div className="shimmer mb-8 h-4 w-48 rounded-lg" />
      <div className="shimmer mb-3 h-24 rounded-2xl" />
      <div className="mb-10 grid grid-cols-4 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="shimmer h-20 rounded-2xl" />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-3">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="shimmer aspect-video rounded-2xl" />
        ))}
      </div>
    </div>
  )
}
