"use client"

import { useEffect } from "react"
import { ChevronLeft, ChevronRight, Download } from "lucide-react"

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import type { RowResult } from "@/components/jobs/result-card"
import { bytes } from "@/lib/format"

export function Lightbox({ results, index, onIndex }: { results: RowResult[]; index: number | null; onIndex: (i: number | null) => void }) {
  const result = index === null ? null : results[index]

  useEffect(() => {
    if (index === null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" && index < results.length - 1) onIndex(index + 1)
      if (e.key === "ArrowLeft" && index > 0) onIndex(index - 1)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [index, results.length, onIndex])

  return (
    <Dialog open={result !== null} onOpenChange={(open) => !open && onIndex(null)}>
      <DialogContent className="max-w-[calc(100%-2rem)] gap-0 overflow-hidden border-line-strong bg-surface p-0 sm:max-w-6xl">
        {result && (
          <div className="grid lg:grid-cols-[1fr_320px]">
            <div className="relative grid min-h-64 place-items-center bg-black">
              {result.video?.url ? (
                <video key={result.video.url} src={result.video.url} poster={result.image?.url ?? undefined} controls autoPlay loop playsInline className="max-h-[78vh] w-full" />
              ) : result.image?.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={result.image.url} alt="" className="max-h-[78vh] w-full object-contain" />
              ) : (
                <p className="p-10 text-sm text-muted-foreground">Нет файла</p>
              )}
              {index! > 0 && (
                <button type="button" onClick={() => onIndex(index! - 1)} className="absolute top-1/2 left-3 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-black/50 text-white backdrop-blur-md hover:bg-black/70">
                  <ChevronLeft className="size-5" />
                </button>
              )}
              {index! < results.length - 1 && (
                <button type="button" onClick={() => onIndex(index! + 1)} className="absolute top-1/2 right-3 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-black/50 text-white backdrop-blur-md hover:bg-black/70">
                  <ChevronRight className="size-5" />
                </button>
              )}
            </div>
            <div className="flex flex-col gap-5 p-5">
              <DialogTitle className="flex items-baseline gap-2 text-lg font-semibold">
                Строка <span className="font-mono text-electric">#{result.row.name}</span>
                <span className="ml-auto font-mono text-xs font-normal text-faint">
                  {index! + 1}/{results.length}
                </span>
              </DialogTitle>
              {result.row.image_prompt && (
                <div>
                  <p className="mb-1.5 text-xs text-faint">Промпт картинки</p>
                  <p className="text-sm leading-relaxed">{result.row.image_prompt}</p>
                </div>
              )}
              {result.row.prompt && (
                <div>
                  <p className="mb-1.5 text-xs text-faint">Промпт видео</p>
                  <p className="text-sm leading-relaxed">{result.row.prompt}</p>
                </div>
              )}
              {result.skip && (
                <div className="rounded-xl border border-danger/20 bg-danger/10 p-3">
                  <p className="mb-1 text-xs font-medium text-danger">Пропущено</p>
                  <p className="text-xs leading-relaxed break-words text-muted-foreground">{result.skip.reason}</p>
                </div>
              )}
              <div className="mt-auto flex flex-col gap-2">
                {[result.video, result.image].map(
                  (f) =>
                    f?.download_url && (
                      <a key={f.name} href={f.download_url} className="flex h-10 items-center gap-2 rounded-xl border border-line-strong bg-surface-2 px-3 text-sm font-medium transition-colors hover:border-electric/50 hover:text-electric">
                        <Download className="size-4" /> {f.kind === "video" ? "Видео" : "Картинка"}
                        <span className="ml-auto font-mono text-xs text-faint">{bytes(f.size)}</span>
                      </a>
                    )
                )}
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
