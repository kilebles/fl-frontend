"use client"

import Link from "next/link"
import { ListVideo, Plus } from "lucide-react"
import { AnimatePresence, motion } from "motion/react"

import { JobMenu } from "@/components/jobs/job-menu"
import { StateBadge } from "@/components/jobs/state"
import { isFinished, isSingle, type JobStatus } from "@/lib/api"
import { jobTitle, percent, timeAgo } from "@/lib/format"
import { MODE_BY_ID, modeLabel } from "@/lib/modes"
import { useJobs } from "@/lib/queries"
import { cn } from "@/lib/utils"

function JobCard({ job }: { job: JobStatus }) {
  const meta = MODE_BY_ID[job.mode]
  const Icon = meta.icon
  const p = job.progress
  const value = percent(p)
  const live = !isFinished(job.state)
  return (
    <Link
      href={`/jobs/${job.id}`}
      className="group grid grid-cols-[auto_1fr_auto] items-center gap-4 rounded-2xl border border-line bg-surface p-4 transition-colors hover:border-line-strong hover:bg-surface-2 md:grid-cols-[auto_minmax(0,1.2fr)_minmax(0,1fr)_auto_auto]"
    >
      <span className={cn("grid size-12 place-items-center rounded-xl ring-1", live ? "bg-electric/15 text-electric ring-electric/25" : "bg-surface-2 text-muted-foreground ring-line")}>
        <Icon className="size-5" />
      </span>
      <div className="min-w-0">
        <p className="truncate font-semibold">{jobTitle(job)}</p>
        <p className="mt-0.5 truncate text-[13px] text-muted-foreground">
          {modeLabel(job.mode)} · {timeAgo(job.created_at)}
        </p>
      </div>
      <div className="col-span-3 row-start-2 md:col-span-1 md:row-start-auto">
        <div className="mb-1.5 flex justify-between text-xs text-muted-foreground tabular-nums">
          <span>
            {p.total - p.remaining} из {p.total}
            {p.skipped > 0 && <span className="text-faint"> · пропущено {p.skipped}</span>}
          </span>
          <span className="font-mono">{value}%</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-elev">
          <motion.div
            className={cn("h-full rounded-full", live ? "bar-running" : job.state === "done" ? "bg-ok" : "bg-faint")}
            initial={false}
            animate={{ width: `${value}%` }}
            transition={{ type: "spring", stiffness: 120, damping: 24 }}
          />
        </div>
      </div>
      <StateBadge state={job.state} className="hidden sm:inline-flex" />
      <JobMenu job={job} />
    </Link>
  )
}

export function BatchList() {
  const { data: all, isLoading, error } = useJobs()
  const jobs = all?.filter((j) => !isSingle(j))
  const active = jobs?.filter((j) => !isFinished(j.state)) ?? []
  const done = jobs?.filter((j) => isFinished(j.state)) ?? []

  return (
    <div className="mx-auto max-w-5xl px-4 pt-8 sm:px-6 md:pt-12 pb-20 lg:px-10">
<div className="mb-6 flex min-h-10 items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Производство</h1>
        {!!jobs?.length && (
          <Link href="/batch/new" className="glow-electric inline-flex h-10 items-center gap-2 rounded-full bg-electric px-4 text-sm font-semibold text-white transition hover:brightness-110">
            <Plus className="size-4" /> Новая задача
          </Link>
        )}
      </div>

      {error && <p className="rounded-2xl border border-danger/25 bg-danger/10 p-4 text-sm text-danger">{error.message}</p>}

      {isLoading && (
        <div className="flex flex-col gap-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="shimmer h-20 rounded-2xl" />
          ))}
        </div>
      )}

      {jobs && jobs.length === 0 && (
        <div className="flex flex-col items-center rounded-3xl border border-dashed border-line-strong px-6 py-20 text-center">
          <span className="mb-4 grid size-14 place-items-center rounded-2xl bg-electric/15 text-electric">
            <ListVideo className="size-6" />
          </span>
          <h2 className="text-lg font-semibold">Задач нет</h2>
          <Link href="/batch/new" className="glow-electric mt-6 inline-flex h-10 items-center gap-2 rounded-full bg-electric px-5 text-sm font-semibold text-white">
            <Plus className="size-4" /> Новая задача
          </Link>
        </div>
      )}

      {[
        { title: "Сейчас", list: active },
        { title: "История", list: done },
      ].map(
        ({ title, list }) =>
          list.length > 0 && (
            <section key={title} className="mb-8">
              <h2 className="mb-3 text-xs font-medium tracking-wide text-faint uppercase">{title}</h2>
              <div className="flex flex-col gap-2">
                <AnimatePresence initial={false}>
                  {list.map((job) => (
                    <motion.div key={job.id} layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.98 }}>
                      <JobCard job={job} />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </section>
          )
      )}
    </div>
  )
}
