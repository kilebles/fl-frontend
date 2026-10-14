"use client"

import { useEffect, useRef, useState } from "react"
import { AlertTriangle, Ban, Loader2, Play } from "lucide-react"
import { AnimatePresence, motion } from "motion/react"

import { JobMenu } from "@/components/jobs/job-menu"
import { Lightbox } from "@/components/jobs/lightbox"
import type { RowResult } from "@/components/jobs/result-card"
import { isFinished, isSingle, type JobFile, type JobStatus } from "@/lib/api"
import { STATE_LABEL } from "@/lib/format"
import { MODE_BY_ID, modeLabel } from "@/lib/modes"
import { useJobFiles, useJobs } from "@/lib/queries"
import { cn } from "@/lib/utils"

function FeedCard({ job }: { job: JobStatus }) {
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

  return (
    <motion.div layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }} className="group relative">
      <button
        type="button"
        disabled={!final && !byKind.skip}
        onClick={() => setOpen(true)}
        onMouseEnter={() => video.current?.play().catch(() => {})}
        onMouseLeave={() => {
          if (video.current) {
            video.current.pause()
            video.current.currentTime = 0
          }
        }}
        className="block w-full overflow-hidden rounded-2xl border border-line bg-surface-2 text-left transition-colors enabled:hover:border-line-strong"
      >
        <div className="relative aspect-video overflow-hidden bg-background">
          {byKind.video?.url ? (
            <>
              <video ref={video} src={byKind.video.url} poster={byKind.image?.url ?? undefined} muted loop playsInline preload="metadata" className="size-full object-cover" />
              <span className="absolute right-2.5 bottom-2.5 grid size-8 place-items-center rounded-full bg-black/50 text-white backdrop-blur-md transition-opacity group-hover:opacity-0">
                <Play className="size-3.5 fill-current" />
              </span>
            </>
          ) : byKind.image?.url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={byKind.image.url} alt="" className={cn("size-full object-cover", !final && "opacity-50")} />
          ) : (
            <div className={cn("size-full", live && "shimmer")} />
          )}

          {live && !final && (
            <span className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur-md">
              <Loader2 className="size-3 animate-spin" /> {job.state === "queued" ? STATE_LABEL.queued : STATE_LABEL[job.state]}
            </span>
          )}
          {result.status === "skipped" && (
            <span className="absolute inset-0 grid place-items-center bg-background/60">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-danger/15 px-2.5 py-1 text-[11px] font-semibold text-danger">
                <Ban className="size-3" /> Отклонено
              </span>
            </span>
          )}
          {failed && result.status !== "skipped" && (
            <span className="absolute inset-0 grid place-items-center p-4 text-center">
              <span className="inline-flex items-center gap-1.5 text-xs text-danger">
                <AlertTriangle className="size-3.5 shrink-0" /> {job.state === "cancelled" ? STATE_LABEL.cancelled : "Не удалось сгенерировать"}
              </span>
            </span>
          )}
        </div>
        <div className="p-3">
          <p className="line-clamp-2 min-h-[2lh] text-[13px] leading-snug">{prompt}</p>
          <p className="mt-1.5 text-xs text-faint">{modeLabel(job.mode)}</p>
        </div>
      </button>
      <div className="absolute top-2 right-2 rounded-lg bg-black/40 opacity-0 backdrop-blur-md transition-opacity group-hover:opacity-100 has-aria-expanded:opacity-100">
        <JobMenu job={job} />
      </div>
      <Lightbox results={[result]} index={open ? 0 : null} onIndex={(i) => setOpen(i !== null)} />
    </motion.div>
  )
}

/** Single generations, oldest first: the newest lands right above the composer, chat-style. */
export function Feed() {
  const { data: jobs } = useJobs()
  const singles = (jobs ?? []).filter(isSingle).reverse()
  const end = useRef<HTMLDivElement>(null)
  const count = singles.length

  useEffect(() => {
    const scroller = end.current?.closest(".overflow-y-auto")
    if (!scroller) return
    const frame = requestAnimationFrame(() => scroller.scrollTo({ top: scroller.scrollHeight, behavior: "smooth" }))
    return () => cancelAnimationFrame(frame)
  }, [count])

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      <AnimatePresence initial={false}>
        {singles.map((job) => (
          <FeedCard key={job.id} job={job} />
        ))}
      </AnimatePresence>
      <div ref={end} className="col-span-full" />
    </div>
  )
}
