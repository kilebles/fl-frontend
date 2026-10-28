"use client"

import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { Download, Loader2, Trash2 } from "lucide-react"

import { ConfirmDialog, minutes, stepText, useNow } from "@/components/script/parts"
import { skeys, useScenarioProjects } from "@/components/script/queries"
import { SendButtons } from "@/components/script/send"
import { StageBars } from "@/components/script/stage-line"
import { scenario, type ScenarioProject } from "@/lib/api"
import { timeAgo } from "@/lib/format"

const ACTIVE = new Set(["queued", "running", "waiting_limit", "brief_queued", "brief_running"])

function StatusCell({ p }: { p: ScenarioProject }) {
  if (p.status === "done") return <span className="font-medium text-ok">Готов</span>
  if (p.status === "error" || p.status === "brief_error")
    return <span className="line-clamp-2 text-danger">{p.job?.error || p.task?.error || "Ошибка"}</span>
  if (p.status === "stopped" || p.status === "paused") return <span className="text-warn">Остановлен</span>
  if (p.status === "ready") return <span className="font-medium text-pick-text">Бриф готов</span>
  if (p.status === "draft") return <span className="text-faint">Черновик</span>
  return <span className="truncate text-muted-foreground">{stepText(p)}</span>
}

function Row({ p, now, onOpen, onDelete }: { p: ScenarioProject; now: number | null; onOpen: () => void; onDelete: () => void }) {
  const docx = p.job?.files.find((f) => f.name.endsWith(".docx"))
  const meta = [
    p.niche_name || "без ниши",
    p.params.language.value?.toUpperCase(),
    p.params.length.value.chars ? minutes(p.params.length.value.minutes) : "",
    p.model_label || "по этапам",
    now !== null ? timeAgo(p.created, now) : "",
  ].filter(Boolean)
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter") onOpen()
      }}
      className="group grid cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-center gap-x-6 gap-y-2 border-b border-line px-4 py-3.5 transition-colors last:border-b-0 hover:bg-surface-2/60 sm:grid-cols-[minmax(0,1fr)_minmax(0,340px)_minmax(0,150px)_200px]"
    >
      <div className="min-w-0">
        <div className="truncate text-sm font-medium">{p.title || p.params.topic || "Без названия"}</div>
        <div className="mt-0.5 truncate font-mono text-[11px] text-faint">{meta.join(" · ")}</div>
      </div>
      <div className="order-last col-span-2 min-w-0 sm:order-none sm:col-span-1">
        <StageBars stages={p.stages} />
      </div>
      <div className="hidden min-w-0 text-xs sm:block">
        <StatusCell p={p} />
      </div>
      <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
        {p.status === "done" && <SendButtons project={p} className="opacity-100 transition-opacity sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100" />}
        {docx && (
          <a
            href={scenario.fileUrl(p.id, docx.name)}
            download
            title="Скачать .docx"
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
  const { data, isLoading, error } = useScenarioProjects()
  const now = useNow()
  const [del, setDel] = useState<ScenarioProject | null>(null)
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
          del && ACTIVE.has(del.status) && del.job
            ? "Сценарий в работе — сначала останови его."
            : "Проект пропадёт из списка. Готовые файлы останутся на сервере в папке запуска."
        }
        onClose={() => setDel(null)}
        onConfirm={async () => {
          await scenario.deleteProject(del!.id)
          qc.invalidateQueries({ queryKey: skeys.projects })
        }}
      />
    </>
  )
}

export const isActive = (p: ScenarioProject) => ACTIVE.has(p.status)
