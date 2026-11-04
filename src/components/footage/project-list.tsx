"use client"

import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { Download, Loader2, Mic, Paperclip, Trash2 } from "lucide-react"

import { ENGINE_LABEL, StageBars, shotsText } from "@/components/footage/parts"
import { fkeys, useFootageProjects } from "@/components/footage/queries"
import { ConfirmDialog, useNow } from "@/components/script/parts"
import { footage, type FootageProject } from "@/lib/api"
import { timeAgo } from "@/lib/format"

function StatusCell({ p }: { p: FootageProject }) {
  const s = p.stats
  if (p.status === "done" && s?.plan_only) return <span className="font-medium text-ok">Шот-лист: {shotsText(s.total)}</span>
  if (p.status === "done" && s)
    return (
      <span className="flex flex-col gap-0.5">
        <span>
          <span className="font-medium text-ok">{s.ok ?? 0}</span>
          <span className="text-faint"> из {s.total} найдено</span>
        </span>
        <span className="font-mono text-[11px] text-faint">
          {(s.not_found ?? 0) + (s.error ?? 0)} на ИИ · {s.handoff ?? 0} в графику
        </span>
      </span>
    )
  if (p.status === "error") return <span className="line-clamp-2 text-danger">{p.error || "Ошибка"}</span>
  if (p.status === "stopped") return <span className="text-warn">Остановлен</span>
  if (p.status === "queued") return <span className="text-muted-foreground">в очереди</span>
  const pr = p.progress
  return (
    <span className="flex flex-col gap-0.5">
      <span className="truncate text-pick-text">{p.step || "запуск"}</span>
      {pr.total ? (
        <span className="font-mono text-[11px] text-faint">
          {pr.done ?? 0}/{pr.total}
          {pr.shots ? ` · ${shotsText(pr.shots)}` : ""}
        </span>
      ) : null}
    </span>
  )
}

function Row({ p, now, onOpen, onDelete }: { p: FootageProject; now: number | null; onOpen: () => void; onDelete: () => void }) {
  const meta = [
    `${p.source.paragraphs} абз.`,
    p.source.tracks ? "по озвучке" : "по тексту",
    p.options.format,
    ENGINE_LABEL[p.options.engine] ?? p.options.engine,
    p.options.min_score != null ? `порог ${p.options.min_score}` : "",
    now !== null ? timeAgo(p.created, now) : "",
  ].filter(Boolean)
  const clips = p.status === "done" && p.has_result && !p.stats?.plan_only
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter") onOpen()
      }}
      className="group grid cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-center gap-x-6 gap-y-2 border-b border-line px-4 py-3.5 transition-colors last:border-b-0 hover:bg-surface-2/60 sm:grid-cols-[minmax(0,1fr)_minmax(0,380px)_minmax(0,180px)_76px]"
    >
      <div className="min-w-0">
        <div className="truncate text-sm font-medium">{p.title}</div>
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
        {clips && (
          <a
            href={footage.zipUrl(p.id, "clips")}
            download
            title="Скачать кадры .zip"
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

export function ProjectList({ onOpen }: { onOpen: (id: string) => void }) {
  const qc = useQueryClient()
  const { data, isLoading, error } = useFootageProjects()
  const now = useNow()
  const [del, setDel] = useState<FootageProject | null>(null)
  if (isLoading)
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="size-4 animate-spin text-faint" />
      </div>
    )
  if (error) return <div className="py-10 text-center text-sm text-danger">{error.message}</div>
  if (!data?.length) return <div className="py-10 text-center text-sm text-faint">Проектов пока нет</div>
  return (
    <>
      <div className="overflow-hidden rounded-[4px] border border-line bg-surface">
        {data.map((p) => (
          <Row key={p.id} p={p} now={now} onOpen={() => onOpen(p.id)} onDelete={() => setDel(p)} />
        ))}
      </div>
      <ConfirmDialog
        open={del !== null}
        title={`Удалить «${del?.title || "проект"}»?`}
        text={
          del?.status === "running" ? "Поиск идёт — сначала останови его." : "Проект пропадёт из списка. Кадры и файлы останутся на сервере в папке результата."
        }
        onClose={() => setDel(null)}
        onConfirm={async () => {
          await footage.remove(del!.id)
          qc.invalidateQueries({ queryKey: fkeys.projects })
        }}
      />
    </>
  )
}
