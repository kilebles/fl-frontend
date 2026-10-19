"use client"

import { useRouter } from "next/navigation"
import { Archive, Ban, ChevronDown, Download, Film, Image as ImageIcon, MoreHorizontal, RotateCcw, Trash2 } from "lucide-react"

import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { api, isFinished, type JobStatus } from "@/lib/api"
import { useJobActions } from "@/lib/queries"
import { cn } from "@/lib/utils"

const RETRYABLE = ["stopped", "failed", "cancelled"]

export function DownloadZipButton({ job, className }: { job: JobStatus; className?: string }) {
  const { videos_done: videos, images_done: images } = job.progress
  if (videos === 0 && images === 0) return null

  const baseClass = cn(
    "inline-flex h-9 items-center gap-2 rounded-[3px] border border-electric/50 bg-electric-soft px-3.5 text-sm font-medium text-electric-text transition-colors hover:border-electric hover:bg-electric/20",
    className
  )

  if (videos > 0 && images > 0) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger onClick={(e) => e.stopPropagation()} className={baseClass}>
          <Download className="size-3.5" /> Скачать всё (.zip) <ChevronDown className="size-3.5 opacity-80" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-60">
          <DropdownMenuItem onClick={() => (window.location.href = api.zipUrl(job.id, "video"))}>
            <Film /> <span className="flex-1">Скачать видео (.zip)</span>
            <span className="font-mono text-xs text-muted-foreground">{videos} шт.</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => (window.location.href = api.zipUrl(job.id, "image"))}>
            <ImageIcon /> <span className="flex-1">Скачать картинки (.zip)</span>
            <span className="font-mono text-xs text-muted-foreground">{images} шт.</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => (window.location.href = api.zipUrl(job.id, "all"))}>
            <Archive /> <span className="flex-1">Скачать всё вместе (.zip)</span>
            <span className="font-mono text-xs text-muted-foreground">{videos + images} шт.</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  return (
    <a href={api.zipUrl(job.id)} onClick={(e) => e.stopPropagation()} className={baseClass}>
      <Download className="size-3.5" /> Скачать всё (.zip)
    </a>
  )
}

export function JobMenu({ job, redirect }: { job: JobStatus; redirect?: boolean }) {
  const router = useRouter()
  const actions = useJobActions()
  const { videos_done: videos, images_done: images } = job.progress
  const hasFiles = videos > 0 || images > 0

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        onClick={(e) => e.preventDefault()}
        className="grid size-9 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-elev hover:text-foreground aria-expanded:bg-elev"
      >
        <MoreHorizontal className="size-4.5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-52">
        {videos > 0 && images > 0 ? (
          <>
            <DropdownMenuItem onClick={() => (window.location.href = api.zipUrl(job.id, "video"))}>
              <Film /> Скачать видео (.zip)
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => (window.location.href = api.zipUrl(job.id, "image"))}>
              <ImageIcon /> Скачать картинки (.zip)
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => (window.location.href = api.zipUrl(job.id, "all"))}>
              <Archive /> Скачать всё (.zip)
            </DropdownMenuItem>
          </>
        ) : hasFiles ? (
          <DropdownMenuItem onClick={() => (window.location.href = api.zipUrl(job.id))}>
            <Download /> Скачать (.zip)
          </DropdownMenuItem>
        ) : null}
        {hasFiles && <DropdownMenuSeparator />}
        {!isFinished(job.state) && (
          <DropdownMenuItem onClick={() => actions.cancel.mutate(job.id)}>
            <Ban /> Отменить
          </DropdownMenuItem>
        )}
        {RETRYABLE.includes(job.state) && (
          <DropdownMenuItem onClick={() => actions.retry.mutate(job.id)}>
            <RotateCcw /> Догенерировать
          </DropdownMenuItem>
        )}
        {(!isFinished(job.state) || RETRYABLE.includes(job.state)) && <DropdownMenuSeparator />}
        <DropdownMenuItem
          variant="destructive"
          onClick={() => {
            if (!confirm("Удалить задачу вместе со всеми результатами?")) return
            actions.remove.mutate(job.id, { onSuccess: () => redirect && router.push("/batch") })
          }}
        >
          <Trash2 /> Удалить
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
