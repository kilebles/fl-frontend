"use client"

import { useRef } from "react"
import { Ban, Clock, Film, Image as ImageIcon, Play } from "lucide-react"
import { motion } from "motion/react"

import type { JobFile, JobRow } from "@/lib/api"
import { cn } from "@/lib/utils"

export interface RowResult {
  row: JobRow
  image?: JobFile
  video?: JobFile
  skip?: JobFile
  status: "done" | "skipped" | "working" | "pending"
}

export function ResultCard({ result, live, onOpen }: { result: RowResult; live: boolean; onOpen: () => void }) {
  const video = useRef<HTMLVideoElement>(null)
  const { row, image, status } = result
  const prompt = row.prompt || row.image_prompt
  const clickable = !!(result.video || image || result.skip)

  return (
    <motion.button
      type="button"
      layout
      disabled={!clickable}
      onClick={onOpen}
      onMouseEnter={() => video.current?.play().catch(() => {})}
      onMouseLeave={() => {
        if (video.current) {
          video.current.pause()
          video.current.currentTime = 0
        }
      }}
      className="group flex flex-col overflow-hidden rounded-2xl border border-line bg-surface-2 text-left transition-colors enabled:hover:border-line-strong disabled:cursor-default"
    >
      <div className="relative aspect-video overflow-hidden bg-background">
        {result.video?.url ? (
          <>
            <video
              ref={video}
              src={result.video.url}
              poster={image?.url ?? undefined}
              muted
              loop
              playsInline
              preload="metadata"
              className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            />
            <span className="absolute right-2.5 bottom-2.5 grid size-8 place-items-center rounded-full bg-black/50 text-white backdrop-blur-md transition-opacity group-hover:opacity-0">
              <Play className="size-3.5 fill-current" />
            </span>
          </>
        ) : image?.url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image.url} alt="" loading="lazy" className={cn("size-full object-cover transition-transform duration-500 group-hover:scale-[1.03]", status !== "done" && "opacity-60")} />
        ) : (
          <div className={cn("size-full", status === "pending" && live && "shimmer")} />
        )}

        {status === "working" && (
          <div className="absolute inset-0 flex items-end bg-linear-to-t from-black/70 to-transparent p-3">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-electric/90 px-2.5 py-1 text-[11px] font-semibold text-white">
              <Film className="size-3" /> Делаем видео
            </span>
          </div>
        )}
        {status === "pending" && (
          <div className="absolute inset-0 grid place-items-center">
            <span className="inline-flex items-center gap-1.5 text-xs text-faint">
              <Clock className="size-3.5" /> {live ? "В очереди" : "Не сделано"}
            </span>
          </div>
        )}
        {status === "skipped" && (
          <div className="absolute inset-0 grid place-items-center bg-background/60 backdrop-blur-[2px]">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-danger/15 px-2.5 py-1 text-[11px] font-semibold text-danger">
              <Ban className="size-3" /> Пропущено
            </span>
          </div>
        )}
        {status === "done" && !result.video && (
          <span className="absolute right-2.5 bottom-2.5 grid size-8 place-items-center rounded-full bg-black/50 text-white backdrop-blur-md">
            <ImageIcon className="size-3.5" />
          </span>
        )}
      </div>
      <div className="flex items-start gap-2.5 p-3">
        <span className="mt-px font-mono text-xs text-faint">#{row.name}</span>
        <p className="line-clamp-2 min-h-[2lh] text-[13px] leading-snug text-muted-foreground">{prompt}</p>
      </div>
    </motion.button>
  )
}
