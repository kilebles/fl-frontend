"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { AlertTriangle, Image as ImageIcon, Play } from "lucide-react"
import { toast } from "sonner"

import { JobMenu } from "@/components/jobs/job-menu"
import { Lightbox } from "@/components/jobs/lightbox"
import type { RowResult } from "@/components/jobs/result-card"
import { api, isFinished, isSingle, type JobFile, type JobStatus } from "@/lib/api"
import { setDraft } from "@/lib/draft"
import { MODE_BY_ID } from "@/lib/modes"
import { useCurrentProject } from "@/lib/project"
import { keys, useJobFiles, useJobs } from "@/lib/queries"
import { cn } from "@/lib/utils"

type Tab = "all" | "video" | "image"

function FeedCard({ job }: { job: JobStatus }) {
  const qc = useQueryClient()
  const live = !isFinished(job.state)
  const { data: files } = useJobFiles(job.id, live)
  const video = useRef<HTMLVideoElement>(null)
  const [open, setOpen] = useState(false)

  const byKind = Object.fromEntries((files ?? []).map((f) => [f.kind, f])) as Partial<Record<JobFile["kind"], JobFile>>
  const meta = MODE_BY_ID[job.mode]
  const final = meta.makesVideos ? byKind.video : byKind.image
  const prompt = job.title ?? ""
  const result: RowResult = {
    row: { name: "1", prompt: meta.makesVideos ? prompt : null, image_prompt: meta.makesImages ? prompt : null },
    image: byKind.image,
    video: byKind.video,
    skip: byKind.skip,
    status: final ? "done" : byKind.skip ? "skipped" : byKind.image ? "working" : "pending",
  }
  const failed = !final && isFinished(job.state)

  // "Повторить" makes a fresh generation of the same prompt and removes the failed one.
  const again = useMutation({
    mutationFn: async () => {
      await api.createJob({ mode: job.mode, title: job.title, project_id: job.project_id, rows: [result.row] })
      await api.remove(job.id)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.jobs }),
    onError: (e) => toast.error(e.message),
  })

  return (
    <div className="group flex flex-col gap-2">
      <div className={cn("relative aspect-video overflow-hidden rounded-[4px] border bg-surface-2", failed ? "border-danger/50 bg-danger/8" : "border-line")}>
        {byKind.video?.url ? (
          <button
            type="button"
            onClick={() => setOpen(true)}
            onMouseEnter={() => video.current?.play().catch(() => {})}
            onMouseLeave={() => {
              if (video.current) {
                video.current.pause()
                video.current.currentTime = 0
              }
            }}
            className="block size-full"
          >
            <video ref={video} src={byKind.video.url} poster={byKind.image?.url ?? undefined} muted loop playsInline preload="metadata" className="size-full object-cover" />
          </button>
        ) : byKind.image?.url ? (
          <button type="button" onClick={() => final && setOpen(true)} className="block size-full">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={byKind.image.url} alt="" className={cn("size-full object-cover", !final && "opacity-50")} />
          </button>
        ) : null}

        <span className="pointer-events-none absolute top-3 left-3 grid size-6 place-items-center rounded-[2px] bg-black/55 text-white">
          {meta.makesVideos ? <Play className="size-3 fill-current" /> : <ImageIcon className="size-3" />}
        </span>

        {live && !final && (
          <>
            <span className="absolute inset-0 grid place-items-center text-sm text-muted-foreground">
              {job.state === "queued" ? "В очереди" : byKind.image ? "Делаем видео…" : "Генерация…"}
            </span>
            <span className="bar-running absolute inset-x-0 bottom-0 h-[3px]" />
          </>
        )}

        {failed && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-center">
            <p className="flex items-center gap-2 text-[15px] text-danger">
              <AlertTriangle className="size-4" /> Не удалось сгенерировать
            </p>
            <p className="text-[13px] text-foreground-2">{byKind.skip ? "Модель отклонила запрос. Попробуйте изменить промпт." : "Генерация не прошла. Попробуйте ещё раз."}</p>
            <div className="mt-1 flex gap-2">
              <button
                type="button"
                onClick={() => setDraft({ text: prompt, mode: job.mode })}
                className="rounded-[3px] border border-line-strong bg-surface px-3 py-1.5 text-[13px] hover:border-faint"
              >
                Изменить промпт
              </button>
              <button
                type="button"
                disabled={again.isPending}
                onClick={() => again.mutate()}
                className="rounded-[3px] border border-line-strong bg-surface px-3 py-1.5 text-[13px] hover:border-faint disabled:opacity-50"
              >
                Повторить
              </button>
            </div>
          </div>
        )}

        <div className="absolute top-2 right-2 rounded-[3px] bg-black/45 opacity-0 transition-opacity group-hover:opacity-100 has-aria-expanded:opacity-100">
          <JobMenu job={job} />
        </div>
      </div>
      <div className="flex items-baseline gap-3 px-0.5">
        <p className="min-w-0 flex-1 truncate text-sm">{prompt}</p>
        <p className="shrink-0 font-mono text-[11px] text-muted-foreground">
          {meta.title}
          {meta.flash && " Flash"} · 16:9
        </p>
      </div>
      <Lightbox results={[result]} index={open ? 0 : null} onIndex={(i) => setOpen(i !== null)} />
    </div>
  )
}

/** Single generations of the current project, oldest first: the newest lands right above the composer. */
export function Feed({ search }: { search: string }) {
  const { data: jobs } = useJobs()
  const [projectId] = useCurrentProject()
  const [tab, setTab] = useState<Tab>("all")
  const end = useRef<HTMLDivElement>(null)

  const singles = useMemo(
    () => (jobs ?? []).filter((j) => isSingle(j) && (!projectId || j.project_id === projectId)).reverse(),
    [jobs, projectId]
  )
  const q = search.trim().toLowerCase()
  const counts = {
    all: singles.length,
    video: singles.filter((j) => MODE_BY_ID[j.mode].makesVideos).length,
    image: singles.filter((j) => !MODE_BY_ID[j.mode].makesVideos).length,
  }
  const shown = singles.filter(
    (j) => (tab === "all" || (tab === "video") === MODE_BY_ID[j.mode].makesVideos) && (!q || (j.title ?? "").toLowerCase().includes(q))
  )

  const count = singles.length
  useEffect(() => {
    const frame = requestAnimationFrame(() => end.current?.scrollIntoView({ block: "end", behavior: "smooth" }))
    return () => cancelAnimationFrame(frame)
  }, [count])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-1 border-b border-line">
        {(
          [
            ["all", "Всё"],
            ["video", "Видео"],
            ["image", "Картинки"],
          ] as [Tab, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={cn(
              "-mb-px flex items-baseline gap-2 border-b-2 px-3.5 py-2.5 text-[15px] transition-colors",
              tab === key ? "border-electric font-medium text-foreground" : "border-transparent text-foreground-2 hover:text-foreground"
            )}
          >
            {label} <span className="font-mono text-[11px] text-muted-foreground">{counts[key]}</span>
          </button>
        ))}
      </div>
      {shown.length ? (
        <div className="grid grid-cols-1 gap-x-4 gap-y-5 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((job) => (
            <FeedCard key={job.id} job={job} />
          ))}
        </div>
      ) : (
        <p className="py-16 text-center text-sm text-muted-foreground">{q ? "Ничего не найдено" : "Здесь появятся ваши генерации"}</p>
      )}
      <div ref={end} />
    </div>
  )
}
