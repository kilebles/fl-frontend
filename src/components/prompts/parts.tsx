"use client"

import { useRouter } from "next/navigation"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Check, ChevronDown, ClipboardCopy, Loader2, Rocket, X } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { api, promptgen, type Mode, type PgProject, type PgRow, type PgStage, type PgStageKey } from "@/lib/api"
import { plural } from "@/lib/format"
import { modeLabel } from "@/lib/modes"
import { useCurrentProject, withStyle } from "@/lib/project"
import { keys, useProjectStyle } from "@/lib/queries"
import { cn } from "@/lib/utils"

const NAMES: Record<PgStageKey, string> = { brief: "бриф", prompts: "промпты", check: "проверка", done: "готово" }

export const MODE_NAME = { regular: "обычный", avatar: "аватар" } as const

export const scenesWord = (n: number) => plural(n, "сцена", "сцены", "сцен")
export const parasWord = (n: number) => plural(n, "абзац", "абзаца", "абзацев")

/** Compact line for a project row: four bars with captions. */
export function StageBars({ stages }: { stages: PgStage[] }) {
  return (
    <div className="grid grid-cols-4 gap-1.5">
      {stages.map((s) => {
        const part = s.state === "active" && s.total ? Math.max(0.06, (s.done ?? 0) / s.total) : null
        return (
          <div key={s.key} className="min-w-0">
            <div className="mb-1 flex items-baseline justify-between gap-1 text-[11px]">
              <span
                className={cn(
                  "truncate",
                  s.state === "done" && "text-foreground-2",
                  s.state === "active" && "font-medium text-pick-text",
                  s.state === "error" && "text-danger",
                  s.state === "todo" && "text-faint"
                )}
              >
                {NAMES[s.key]}
              </span>
              {s.key === "prompts" && s.total ? (
                <span className="font-mono text-[10px] text-faint">
                  {s.state === "done" ? s.total : (s.done ?? 0)}/{s.total}
                </span>
              ) : s.key === "check" && s.flagged ? (
                <span className="font-mono text-[10px] text-warn">{s.flagged}⚠</span>
              ) : null}
            </div>
            <div className="h-1 overflow-hidden rounded-full bg-elev">
              <div
                className={cn(
                  "h-full rounded-full transition-[width] duration-700",
                  s.state === "done" && "w-full bg-ok/70",
                  s.state === "active" && "bar-pick",
                  s.state === "error" && "w-full bg-danger/70"
                )}
                style={part !== null ? { width: `${part * 100}%` } : s.state === "active" ? { width: "35%" } : undefined}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

/** Large line for the open project. */
export function StageSteps({ stages, captions }: { stages: PgStage[]; captions: Partial<Record<PgStageKey, string>> }) {
  return (
    <ol className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {stages.map((s, i) => (
        <li key={s.key} className="flex min-w-0 items-start gap-2.5">
          <span
            className={cn(
              "grid size-6 shrink-0 place-items-center rounded-[3px] font-mono text-[11px]",
              s.state === "done" && "bg-ok/15 text-ok",
              s.state === "active" && "animate-pulse-dot bg-pick text-white",
              s.state === "error" && "bg-danger/15 text-danger",
              s.state === "todo" && "border border-line-strong text-faint"
            )}
          >
            {s.state === "done" ? <Check className="size-3.5" /> : s.state === "error" ? <X className="size-3.5" /> : i + 1}
          </span>
          <span className="min-w-0">
            <span className={cn("block text-sm capitalize", s.state === "todo" ? "text-muted-foreground" : "font-medium")}>{NAMES[s.key]}</span>
            {captions[s.key] && <span className="block truncate font-mono text-[11px] text-faint">{captions[s.key]}</span>}
          </span>
        </li>
      ))}
    </ol>
  )
}

/** Rows as tab-separated text (number · image · video) — pastes into Google Sheets as three columns. */
export function rowsTsv(rows: PgRow[]) {
  const cell = (s: string) => s.replace(/[\t\r\n]+/g, " ")
  return rows.map((r) => [r.number, cell(r.img), cell(r.vid)].join("\t")).join("\n")
}

export function CopyAllButton({ project, rows, className }: { project: PgProject; rows?: PgRow[]; className?: string }) {
  const [state, setState] = useState<"idle" | "busy" | "done">("idle")
  return (
    <button
      type="button"
      disabled={state === "busy"}
      onClick={async () => {
        setState("busy")
        try {
          const list = rows ?? (await promptgen.result(project.id)).rows
          await navigator.clipboard.writeText(rowsTsv(list))
          setState("done")
          toast.success(`Скопировано: ${list.length} ${scenesWord(list.length)} — вставьте в Google Sheets`)
          setTimeout(() => setState("idle"), 1800)
        } catch (e) {
          setState("idle")
          toast.error(e instanceof Error ? e.message : "Не удалось скопировать")
        }
      }}
      className={className}
      title="Номер, промпт картинки, промпт видео — три колонки для Google Sheets"
    >
      {state === "busy" ? <Loader2 className="size-3.5 animate-spin" /> : state === "done" ? <Check className="size-3.5 text-ok" /> : <ClipboardCopy className="size-3.5" />}
      Скопировать всё
    </button>
  )
}

const DIRECT: Mode[] = ["i2v", "flash_i2v"]

/** «В производство»: straight into a batch (i2v / flash i2v), or to «Пакетом» to pick an avatar. */
export function ToProduction({ project, className }: { project: PgProject; className?: string }) {
  const router = useRouter()
  const qc = useQueryClient()
  const [current] = useCurrentProject()
  const projectId = project.project_id ?? current
  const style = useProjectStyle(projectId)
  const send = useMutation({
    mutationFn: async (mode: Mode) => {
      const { rows } = await promptgen.result(project.id)
      return api.createJob({
        mode,
        title: project.title,
        project_id: projectId,
        rows: rows.filter((r) => r.img || r.vid).map((r) => ({ name: r.number, prompt: withStyle(r.vid, style), image_prompt: withStyle(r.img, style) })),
      })
    },
    onSuccess: (job) => {
      qc.invalidateQueries({ queryKey: keys.jobs })
      router.push(`/jobs/${job.id}`)
    },
    onError: (e) => toast.error(e.message),
  })
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={cn("flex h-10 items-center gap-2 rounded-[3px] bg-electric px-4 text-sm font-medium text-white transition-opacity hover:opacity-90", className)}>
        {send.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Rocket className="size-3.5" />}В производство
        <ChevronDown className="size-3.5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={6} className="min-w-56 rounded-[4px] p-1">
        {project.mode === "avatar" && (
          <DropdownMenuItem onClick={() => router.push(`/batch?prompts=${project.id}&mode=i2i2v`)} className="rounded-[3px] px-2.5 py-2">
            {modeLabel("i2i2v")} <span className="ml-auto font-mono text-[11px] text-faint">выбрать аватар</span>
          </DropdownMenuItem>
        )}
        {DIRECT.map((mode) => (
          <DropdownMenuItem key={mode} onClick={() => send.mutate(mode)} className="rounded-[3px] px-2.5 py-2">
            {modeLabel(mode)}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
