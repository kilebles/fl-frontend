"use client"

import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { Download, FileText, Film, Loader2, Trash2, Type } from "lucide-react"

import { ProgressLine, TYPE_ICON, TYPE_SHORT, infographicsText, stepText } from "@/components/montage/parts"
import { mkeys, useInfoJobs } from "@/components/montage/queries"
import { ConfirmDialog, useNow } from "@/components/script/parts"
import { montage, type InfoJob, type InfoType } from "@/lib/api"
import { timeAgo } from "@/lib/format"

function StatusCell({ j }: { j: InfoJob }) {
  if (j.status === "done") {
    const ok = j.items.filter((i) => i.status === "done").length
    return (
      <span className="flex flex-col gap-0.5">
        <span className="font-medium text-ok">{infographicsText(ok)}</span>
        {ok < j.items.length && <span className="font-mono text-[11px] text-warn">{j.items.length - ok} не вышло</span>}
      </span>
    )
  }
  if (j.status === "error") return <span className="line-clamp-2 text-danger">{j.error || "Ошибка"}</span>
  if (j.status === "stopped") return <span className="text-warn">Остановлена</span>
  if (j.status === "queued") return <span className="text-muted-foreground">в очереди</span>
  return (
    <span className="flex flex-col gap-0.5">
      <span className="truncate text-pick-text">{stepText(j)}</span>
      {j.progress.total ? (
        <span className="font-mono text-[11px] text-faint">
          {Math.floor(j.progress.done ?? 0)}/{j.progress.total}
        </span>
      ) : null}
    </span>
  )
}

/** Types present in the job (or the one asked for, before the model answered). */
function Types({ j }: { j: InfoJob }) {
  const types = j.items.length ? [...new Set(j.items.map((i) => i.type))] : [j.settings.type]
  return (
    <div className="flex flex-wrap gap-1">
      {types.map((t) => {
        const Icon = TYPE_ICON[t as InfoType | "auto"]
        return (
          <span key={t} className="flex items-center gap-1 rounded-[2px] bg-surface-2 px-1.5 py-0.5 text-[11px] text-foreground-2">
            <Icon className="size-3 text-muted-foreground" />
            {TYPE_SHORT[t as InfoType | "auto"]}
          </span>
        )
      })}
    </div>
  )
}

function Row({ j, now, onOpen, onDelete }: { j: InfoJob; now: number | null; onOpen: () => void; onDelete: () => void }) {
  const s = j.settings
  const meta = [
    s.kind === "animated" ? "видео" : "картинки",
    s.format,
    s.quality === "2160" ? "4K" : `${s.quality}p`,
    j.source.kind === "orders" ? `из «Роликов» · ${j.source.orders} кадр.` : "",
    now !== null ? timeAgo(j.created, now) : "",
  ].filter(Boolean)
  const SourceIcon = j.source.kind === "orders" ? Film : j.source.kind === "file" ? FileText : Type
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter") onOpen()
      }}
      className="group grid cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-center gap-x-6 gap-y-2 border-b border-line px-4 py-3.5 transition-colors last:border-b-0 hover:bg-surface-2/60 sm:grid-cols-[minmax(0,1fr)_minmax(0,300px)_minmax(0,200px)_76px]"
    >
      <div className="min-w-0">
        <div className="truncate text-sm font-medium">{j.title}</div>
        <div className="mt-0.5 flex min-w-0 items-center gap-1.5 font-mono text-[11px] text-faint">
          <SourceIcon className="size-3 shrink-0" />
          <span className="truncate">{meta.join(" · ")}</span>
        </div>
      </div>
      <div className="order-last col-span-2 flex min-w-0 flex-col gap-2 sm:order-none sm:col-span-1">
        <Types j={j} />
        <ProgressLine job={j} />
      </div>
      <div className="hidden min-w-0 text-xs sm:block">
        <StatusCell j={j} />
      </div>
      <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
        {j.files > 0 && j.status !== "running" && (
          <a
            href={montage.zipUrl(j.id)}
            download
            title="Скачать всё .zip"
            className="grid size-7 place-items-center rounded-[3px] text-muted-foreground hover:bg-elev hover:text-foreground"
          >
            <Download className="size-3.5" />
          </a>
        )}
        <button
          type="button"
          title="Удалить"
          onClick={onDelete}
          className="grid size-7 place-items-center rounded-[3px] text-faint transition hover:bg-danger/15 hover:text-danger focus-visible:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>
    </div>
  )
}

export function JobList({ onOpen }: { onOpen: (id: string) => void }) {
  const qc = useQueryClient()
  const { data, isLoading, error } = useInfoJobs()
  const now = useNow()
  const [del, setDel] = useState<InfoJob | null>(null)
  if (isLoading)
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="size-4 animate-spin text-faint" />
      </div>
    )
  if (error) return <div className="py-10 text-center text-sm text-danger">{error.message}</div>
  if (!data?.length) return <div className="py-10 text-center text-sm text-faint">Инфографики пока нет</div>
  return (
    <>
      <div className="overflow-hidden rounded-[4px] border border-line bg-surface">
        {data.map((j) => (
          <Row key={j.id} j={j} now={now} onOpen={() => onOpen(j.id)} onDelete={() => setDel(j)} />
        ))}
      </div>
      <ConfirmDialog
        open={del !== null}
        title={`Удалить «${del?.title || "инфографику"}»?`}
        text={del?.status === "running" ? "Задача в работе — сначала останови её." : "Задача и все её файлы удалятся с сервера."}
        onClose={() => setDel(null)}
        onConfirm={async () => {
          await montage.remove(del!.id)
          qc.invalidateQueries({ queryKey: mkeys.jobs })
        }}
      />
    </>
  )
}
