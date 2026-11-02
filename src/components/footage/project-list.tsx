"use client"

import { Download, Mic, Paperclip, Trash2 } from "lucide-react"

import { PROJECTS } from "@/components/footage/mock"
import { StageBars, clock } from "@/components/footage/parts"
import type { FootageProject } from "@/components/footage/types"
import { useNow } from "@/components/script/parts"
import { timeAgo } from "@/lib/format"

function StatusCell({ p }: { p: FootageProject }) {
  const s = p.stats
  if (p.status === "done")
    return (
      <span className="flex flex-col gap-0.5">
        <span>
          <span className="font-medium text-ok">{s.ok}</span>
          <span className="text-faint"> из {s.total} найдено</span>
        </span>
        <span className="font-mono text-[11px] text-faint">
          {s.not_found + s.error} на ИИ · {s.handoff} в графику
        </span>
      </span>
    )
  if (p.status === "error") return <span className="line-clamp-2 text-danger">{p.error || "Ошибка"}</span>
  if (p.status === "stopped") return <span className="text-warn">Остановлен</span>
  if (p.status === "queued") return <span className="text-muted-foreground">в очереди</span>
  const active = p.stages.find((x) => x.state === "active")
  return (
    <span className="flex flex-col gap-0.5">
      <span className="truncate text-pick-text">{p.step}</span>
      {active?.total ? (
        <span className="font-mono text-[11px] text-faint">
          {active.done}/{active.total}{s.ok ? ` · найдено ${s.ok}` : ""}
        </span>
      ) : null}
    </span>
  )
}

function Row({ p, now, onOpen }: { p: FootageProject; now: number | null; onOpen: () => void }) {
  const meta = [p.paragraphs + " абз.", clock(p.duration_sec), p.format, p.engine, now !== null ? timeAgo(p.created, now) : ""].filter(Boolean)
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter") onOpen()
      }}
      className="group grid cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-center gap-x-6 gap-y-2 border-b border-line px-4 py-3.5 transition-colors last:border-b-0 hover:bg-surface-2/60 sm:grid-cols-[minmax(0,1fr)_minmax(0,380px)_minmax(0,170px)_76px]"
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-sm font-medium">
          <span className="truncate">{p.title}</span>
        </div>
        <div className="mt-0.5 flex min-w-0 items-center gap-1.5 font-mono text-[11px] text-faint">
          {p.source.kind === "voice" ? <Mic className="size-3 shrink-0" /> : <Paperclip className="size-3 shrink-0" />}
          <span className="truncate">{meta.join(" · ")}</span>
        </div>
      </div>
      <div className="order-last col-span-2 min-w-0 sm:order-none sm:col-span-1">
        <StageBars stages={p.stages} />
      </div>
      <div className="hidden min-w-0 text-xs sm:block">
        <StatusCell p={p} />
      </div>
      <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
        {p.status === "done" && (
          <button
            type="button"
            title="Скачать кадры .zip"
            className="grid size-7 place-items-center rounded-[3px] text-muted-foreground hover:bg-elev hover:text-foreground"
          >
            <Download className="size-3.5" />
          </button>
        )}
        <button
          type="button"
          title="Удалить"
          className="grid size-7 place-items-center rounded-[3px] text-faint transition hover:bg-danger/15 hover:text-danger focus-visible:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>
    </div>
  )
}

export function ProjectList({ onOpen }: { onOpen: (id: string) => void }) {
  const now = useNow()
  return (
    <div className="overflow-hidden rounded-[4px] border border-line bg-surface">
      {PROJECTS.map((p) => (
        <Row key={p.id} p={p} now={now} onOpen={() => onOpen(p.id)} />
      ))}
    </div>
  )
}
