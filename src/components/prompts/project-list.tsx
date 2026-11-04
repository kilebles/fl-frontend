"use client"

import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { Download, Loader2, Trash2 } from "lucide-react"

import { CopyAllButton, MODE_NAME, StageBars } from "@/components/prompts/parts"
import { pkeys, usePgProjects } from "@/components/prompts/queries"
import { ConfirmDialog, useNow } from "@/components/script/parts"
import { pgActive, promptgen, type PgProject } from "@/lib/api"
import { plural, timeAgo } from "@/lib/format"
import { useCurrentProject } from "@/lib/project"

export function statusText(p: PgProject): { text: string; tone: "ok" | "danger" | "warn" | "pick" | "muted" } {
  if (p.status === "done") {
    const bad = p.summary?.with_problems ?? 0
    return bad ? { text: `Готово · ${bad} с замечаниями`, tone: "warn" } : { text: "Готово", tone: "ok" }
  }
  if (p.status === "error") return { text: p.error || "Ошибка", tone: "danger" }
  if (p.status === "stopped") return { text: "Остановлен", tone: "warn" }
  if (p.status === "brief_ready") return { text: "Бриф ждёт проверки", tone: "pick" }
  if (p.status === "queued") return { text: "В очереди", tone: "muted" }
  if (p.waiting_until) return { text: "Ждёт сброса лимита", tone: "warn" }
  if (p.stop_requested) return { text: "Останавливается…", tone: "warn" }
  if (p.stage === "brief") return { text: "Пишет бриф", tone: "muted" }
  if (p.stage === "export") return { text: "Собирает файлы", tone: "muted" }
  return { text: `Промпты: ${p.progress.done} из ${p.progress.total}`, tone: "muted" }
}

const TONE = { ok: "font-medium text-ok", danger: "line-clamp-2 text-danger", warn: "text-warn", pick: "font-medium text-pick-text", muted: "truncate text-muted-foreground" }

export function projectMeta(p: PgProject, now: number | null) {
  return [
    p.niche_name || "без ниши",
    MODE_NAME[p.mode],
    p.mode === "avatar" ? `${p.pairs} сц.` : `${p.pairs} ${plural(p.pairs, "пара", "пары", "пар")}`,
    `${p.script.count} абз.`,
    p.base === "passport" ? "паспорт" : "",
    now !== null ? timeAgo(p.created, now) : "",
  ].filter(Boolean)
}

function Row({ p, now, onOpen, onDelete }: { p: PgProject; now: number | null; onOpen: () => void; onDelete: () => void }) {
  const st = statusText(p)
  const xlsx = p.files.find((f) => f.name.endsWith(".xlsx"))
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter") onOpen()
      }}
      className="group grid cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-center gap-x-6 gap-y-2 border-b border-line px-4 py-3.5 transition-colors last:border-b-0 hover:bg-surface-2/60 sm:grid-cols-[minmax(0,1fr)_minmax(0,340px)_minmax(0,170px)_220px]"
    >
      <div className="min-w-0">
        <div className="truncate text-sm font-medium">{p.title}</div>
        <div className="mt-0.5 truncate font-mono text-[11px] text-faint">{projectMeta(p, now).join(" · ")}</div>
      </div>
      <div className="order-last col-span-2 min-w-0 sm:order-none sm:col-span-1">
        <StageBars stages={p.stages} />
      </div>
      <div className="hidden min-w-0 text-xs sm:block">
        <span className={TONE[st.tone]}>{st.text}</span>
      </div>
      <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
        {p.status === "done" && (
          <CopyAllButton
            project={p}
            className="flex h-7 items-center gap-1 rounded-[3px] border border-pick/40 bg-pick-soft px-2 text-[11px] font-medium whitespace-nowrap text-pick-text transition hover:bg-pick hover:text-white disabled:opacity-50 sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100"
          />
        )}
        {xlsx && (
          <a
            href={promptgen.fileUrl(p.id, xlsx.name)}
            download
            title="Скачать .xlsx"
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
  const [projectId] = useCurrentProject()
  const { data, isLoading, error } = usePgProjects(projectId)
  const now = useNow()
  const [del, setDel] = useState<PgProject | null>(null)
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
        text={del && pgActive(del) && del.status === "running" ? "Проект в работе — сначала останови его." : "Проект и его файлы будут удалены."}
        onClose={() => setDel(null)}
        onConfirm={async () => {
          await promptgen.remove(del!.id)
          qc.invalidateQueries({ queryKey: pkeys.projectsAll })
        }}
      />
    </>
  )
}
