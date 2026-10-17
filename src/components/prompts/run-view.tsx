"use client"

import { useMemo } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { AlertTriangle, ArrowLeft, ChevronDown, Download, Loader2, Rocket, Trash2 } from "lucide-react"
import { motion } from "motion/react"
import { toast } from "sonner"

import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { api, prompts, runActive, type GeneratedPair, type Mode } from "@/lib/api"
import { plural, timeAgo } from "@/lib/format"
import { modeLabel } from "@/lib/modes"
import { useCurrentProject, withStyle } from "@/lib/project"
import { keys, useProjectStyle, useRun } from "@/lib/queries"

const TARGET_MODES: Mode[] = ["i2v", "flash_i2v"]

export function RunView({ id }: { id: string }) {
  const router = useRouter()
  const qc = useQueryClient()
  const { data: run, error } = useRun(id)
  const [currentProject] = useCurrentProject()
  const projectId = run?.project_id ?? currentProject
  const style = useProjectStyle(projectId)

  const paragraphs = useMemo(() => {
    const groups = new Map<number, GeneratedPair[]>()
    for (const row of run?.rows ?? []) groups.set(row.paragraph_number, [...(groups.get(row.paragraph_number) ?? []), row])
    return [...groups.entries()]
  }, [run])

  const toProduction = useMutation({
    mutationFn: (mode: Mode) =>
      api.createJob({
        mode,
        title: run!.scenario_name,
        project_id: projectId,
        rows: run!.rows.map((r) => ({ name: `${r.paragraph_number}.${r.pair_number}`, prompt: withStyle(r.vid, style), image_prompt: withStyle(r.img, style) })),
      }),
    onSuccess: (job) => {
      qc.invalidateQueries({ queryKey: keys.jobs })
      router.push(`/jobs/${job.id}`)
    },
    onError: (e) => toast.error(e.message),
  })

  const remove = useMutation({
    mutationFn: () => prompts.removeRun(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.runs })
      router.push("/prompts")
    },
    onError: (e) => toast.error(e.message),
  })

  if (error) {
    return (
      <div className="mx-auto max-w-xl px-6 pt-24 text-center">
        <p className="text-muted-foreground">{error.message}</p>
        <Link href="/prompts" className="mt-4 inline-flex items-center gap-2 text-sm text-electric">
          <ArrowLeft className="size-4" /> Промпты
        </Link>
      </div>
    )
  }
  if (!run) return <div className="mx-auto max-w-6xl px-4 pt-8 sm:px-6 lg:px-10"><div className="shimmer h-40 rounded-2xl" /></div>

  const active = runActive(run)
  const value = run.total ? Math.round((run.done / run.total) * 100) : 0

  return (
    <div className="px-4 pt-6 pb-20 sm:px-7">
      <Link href="/prompts" className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
        <ArrowLeft className="size-4" /> Промпты
      </Link>

      <div className="mb-6 flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-semibold tracking-tight">{run.scenario_name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {run.template_title} · {run.pair_count} {plural(run.pair_count, "пара", "пары", "пар")} · {timeAgo(run.created_at)}
          </p>
        </div>
        {run.state === "done" && (
          <>
            <a href={prompts.xlsxUrl(id)} className="inline-flex h-10 items-center gap-2 rounded-xl border border-line-strong bg-surface px-4 text-sm font-medium transition-colors hover:border-electric/50 hover:text-electric">
              <Download className="size-4" /> xlsx
            </a>
            <DropdownMenu>
              <DropdownMenuTrigger className="glow-electric inline-flex h-10 items-center gap-2 rounded-xl bg-electric px-4 text-sm font-semibold text-white transition hover:brightness-110">
                {toProduction.isPending ? <Loader2 className="size-4 animate-spin" /> : <Rocket className="size-4" />} В производство
                <ChevronDown className="size-3.5" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" sideOffset={6} className="min-w-52 p-1.5">
                {TARGET_MODES.map((mode) => (
                  <DropdownMenuItem key={mode} onClick={() => toProduction.mutate(mode)} className="rounded-lg px-2.5 py-2">
                    {modeLabel(mode)}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        )}
        <button
          type="button"
          onClick={() => confirm("Удалить результат?") && remove.mutate()}
          className="grid size-10 place-items-center rounded-xl text-muted-foreground transition-colors hover:bg-danger/10 hover:text-danger"
          aria-label="Удалить"
        >
          <Trash2 className="size-4" />
        </button>
      </div>

      {active && (
        <div className="mb-6 rounded-2xl border border-line bg-surface p-5">
          <div className="mb-3 flex justify-between text-sm text-muted-foreground tabular-nums">
            <span>
              {run.done} из {run.total} {plural(run.total, "абзаца", "абзацев", "абзацев")}
            </span>
            <span className="font-mono">{value}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-elev">
            <motion.div className="bar-running h-full rounded-full" initial={false} animate={{ width: `${Math.max(value, 3)}%` }} />
          </div>
        </div>
      )}

      {run.state === "failed" && (
        <p className="mb-6 flex items-start gap-2 rounded-2xl border border-danger/25 bg-danger/10 p-4 text-sm text-danger">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" /> {run.error}
        </p>
      )}

      <div className="flex flex-col gap-4">
        {paragraphs.map(([number, rows]) => (
          <section key={number} className="overflow-hidden rounded-2xl border border-line bg-surface">
            <div className="flex gap-3 border-b border-line bg-surface-2/60 px-4 py-3">
              <span className="font-mono text-xs text-faint">{number}</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-muted-foreground">{rows[0].paragraph_text}</p>
                {rows[0].stock_queries.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {rows[0].stock_queries.map((q) => (
                      <span key={q} className="rounded-full bg-elev px-2.5 py-0.5 text-xs text-muted-foreground">
                        {q}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
            {rows.map((row) => (
              <div key={row.pair_number} className="grid gap-3 border-b border-line px-4 py-3 last:border-b-0 md:grid-cols-[2.5rem_1fr_1fr]">
                <span className="font-mono text-xs text-faint">
                  {row.paragraph_number}.{row.pair_number}
                </span>
                <p className="text-[13px] leading-relaxed">
                  <span className="mb-1 block text-xs text-faint">Картинка</span>
                  {row.img}
                </p>
                <p className="text-[13px] leading-relaxed">
                  <span className="mb-1 block text-xs text-faint">Видео</span>
                  {row.vid}
                </p>
              </div>
            ))}
          </section>
        ))}
      </div>
    </div>
  )
}
