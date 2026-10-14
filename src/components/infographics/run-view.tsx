"use client"

import { useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { AlertTriangle, ArrowLeft, Download, Loader2, Play, RotateCcw, Trash2 } from "lucide-react"
import { motion } from "motion/react"
import { toast } from "sonner"

import { stagePercent, stageText } from "@/components/infographics/infographics-view"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { infographicActive, infographics, type InfographicCard } from "@/lib/api"
import { timeAgo } from "@/lib/format"
import { keys, useInfographicCategories, useInfographicRun } from "@/lib/queries"

function CardTile({ card, label, onOpen }: { card: InfographicCard; label: string; onOpen: () => void }) {
  const video = useRef<HTMLVideoElement>(null)
  return (
    <motion.button
      layout
      type="button"
      disabled={!card.video_url}
      onClick={onOpen}
      onMouseEnter={() => video.current?.play().catch(() => {})}
      onMouseLeave={() => {
        if (video.current) {
          video.current.pause()
          video.current.currentTime = 0
        }
      }}
      className="group flex flex-col overflow-hidden rounded-2xl border border-line bg-surface-2 text-left transition-colors enabled:hover:border-line-strong"
    >
      <div className="relative aspect-video overflow-hidden bg-background">
        {card.video_url ? (
          <>
            <video ref={video} src={card.video_url} muted loop playsInline preload="metadata" className="size-full object-cover" />
            <span className="absolute right-2.5 bottom-2.5 grid size-8 place-items-center rounded-full bg-black/50 text-white backdrop-blur-md transition-opacity group-hover:opacity-0">
              <Play className="size-3.5 fill-current" />
            </span>
          </>
        ) : (
          <>
            {card.image_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={card.image_url} alt="" className="size-full object-contain opacity-40" />
            )}
            <span className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur-md">
              <Loader2 className="size-3 animate-spin" /> Рендер
            </span>
          </>
        )}
      </div>
      <div className="flex items-start gap-2 p-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{card.name}</p>
          <p className="text-xs text-muted-foreground">{card.years || "—"}</p>
        </div>
        <span className="shrink-0 rounded-full bg-elev px-2 py-0.5 text-[11px] text-muted-foreground">{label}</span>
      </div>
    </motion.button>
  )
}

export function InfographicRunView({ id }: { id: string }) {
  const router = useRouter()
  const qc = useQueryClient()
  const { data: run, error } = useInfographicRun(id)
  const { data: categories } = useInfographicCategories()
  const [open, setOpen] = useState<InfographicCard | null>(null)
  const label = (category: string) => categories?.find((c) => c.id === category)?.label ?? category

  const retry = useMutation({
    mutationFn: () => infographics.retry(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.infographicRun(id) }),
    onError: (e) => toast.error(e.message),
  })
  const remove = useMutation({
    mutationFn: () => infographics.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.infographicRuns })
      router.push("/infographics")
    },
    onError: (e) => toast.error(e.message),
  })

  if (error) {
    return (
      <div className="mx-auto max-w-xl px-6 pt-24 text-center">
        <p className="text-muted-foreground">{error.message}</p>
        <Link href="/infographics" className="mt-4 inline-flex items-center gap-2 text-sm text-electric">
          <ArrowLeft className="size-4" /> Инфографика
        </Link>
      </div>
    )
  }
  if (!run) return <div className="mx-auto max-w-6xl px-4 pt-8 sm:px-6 lg:px-10"><div className="shimmer h-40 rounded-2xl" /></div>

  const active = infographicActive(run)

  return (
    <div className="mx-auto max-w-6xl px-4 pt-6 pb-20 sm:px-6 md:pt-8 lg:px-10">
      <Link href="/infographics" className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
        <ArrowLeft className="size-4" /> Инфографика
      </Link>

      <div className="mb-6 flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-semibold tracking-tight">{run.scenario_name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {run.categories.map(label).join(", ")} · {timeAgo(run.created_at)}
          </p>
        </div>
        {run.state === "failed" && (
          <button
            type="button"
            onClick={() => retry.mutate()}
            className="glow-electric inline-flex h-10 items-center gap-2 rounded-xl bg-electric px-4 text-sm font-semibold text-white hover:brightness-110"
          >
            <RotateCcw className="size-4" /> Повторить
          </button>
        )}
        <button
          type="button"
          onClick={() => confirm("Удалить вместе с роликами?") && remove.mutate()}
          className="grid size-10 place-items-center rounded-xl text-muted-foreground transition-colors hover:bg-danger/10 hover:text-danger"
          aria-label="Удалить"
        >
          <Trash2 className="size-4" />
        </button>
      </div>

      {active && (
        <div className="mb-6 rounded-2xl border border-line bg-surface p-5">
          <div className="mb-3 flex justify-between text-sm text-muted-foreground tabular-nums">
            <span>{stageText(run)}</span>
            <span className="font-mono">{stagePercent(run)}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-elev">
            <motion.div className="bar-running h-full rounded-full" initial={false} animate={{ width: `${Math.max(stagePercent(run), 3)}%` }} />
          </div>
        </div>
      )}

      {run.state === "failed" && run.error && (
        <p className="mb-6 flex items-start gap-2 rounded-2xl border border-danger/25 bg-danger/10 p-4 text-sm text-danger">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" /> {run.error}
        </p>
      )}

      {run.cards.length > 0 ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {run.cards.map((card) => (
            <CardTile key={card.id} card={card} label={label(card.category)} onOpen={() => setOpen(card)} />
          ))}
        </div>
      ) : (
        !active && <p className="rounded-2xl border border-dashed border-line-strong p-10 text-center text-sm text-muted-foreground">Ничего не найдено</p>
      )}

      <Dialog open={open !== null} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="max-w-[calc(100%-2rem)] gap-0 overflow-hidden border-line-strong bg-surface p-0 sm:max-w-5xl">
          {open && (
            <>
              {open.video_url && <video key={open.video_url} src={open.video_url} controls autoPlay playsInline className="max-h-[70vh] w-full bg-black" />}
              <div className="flex items-start gap-4 p-5">
                <div className="min-w-0 flex-1">
                  <DialogTitle className="text-lg font-semibold">{open.name}</DialogTitle>
                  <p className="mt-0.5 text-sm text-muted-foreground">{open.years}</p>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                    <span className="font-mono text-xs text-faint">{open.paragraph_number}</span> {open.paragraph}
                  </p>
                </div>
                {open.download_url && (
                  <a href={open.download_url} className="inline-flex h-10 shrink-0 items-center gap-2 rounded-xl border border-line-strong bg-surface-2 px-4 text-sm font-medium transition-colors hover:border-electric/50 hover:text-electric">
                    <Download className="size-4" /> Скачать
                  </a>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
