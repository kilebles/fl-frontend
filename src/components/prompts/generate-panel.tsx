"use client"

import { useState } from "react"
import Link from "next/link"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Loader2, Sparkles } from "lucide-react"
import { motion } from "motion/react"
import { toast } from "sonner"

import { Dropzone } from "@/components/create/dropzone"
import { Select } from "@/components/prompts/select"
import { prompts, runActive, type PromptRun } from "@/lib/api"
import { plural, timeAgo } from "@/lib/format"
import { useCurrentProject } from "@/lib/project"
import { keys, usePromptModels, useRuns, useTemplates } from "@/lib/queries"
import { cn } from "@/lib/utils"

const PAIR_COUNTS = [2, 4, 6, 8, 12]

function pairOptions(total: number) {
  const counts = new Set(PAIR_COUNTS.filter((n) => n <= total))
  if (total > 0) counts.add(total)
  return [...counts].sort((a, b) => a - b).map((n) => ({ value: n, label: `${n} ${plural(n, "пара", "пары", "пар")} на абзац` }))
}

const RUN_STATE: Record<PromptRun["state"], string> = {
  queued: "В очереди",
  running: "Генерация",
  done: "Готово",
  failed: "Ошибка",
}

function RunCard({ run }: { run: PromptRun }) {
  const active = runActive(run)
  const value = run.total ? Math.round((run.done / run.total) * 100) : 0
  return (
    <Link
      href={`/prompts/runs/${run.id}`}
      className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-3 rounded-2xl border border-line bg-surface p-4 transition-colors hover:border-line-strong hover:bg-surface-2 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_auto]"
    >
      <div className="min-w-0">
        <p className="truncate font-semibold">{run.scenario_name}</p>
        <p className="mt-0.5 truncate text-[13px] text-muted-foreground">
          {run.template_title} · {run.pair_count} {plural(run.pair_count, "пара", "пары", "пар")} · {timeAgo(run.created_at)}
        </p>
      </div>
      <div className="col-span-2 row-start-2 md:col-span-1 md:row-start-auto">
        <div className="mb-1.5 flex justify-between text-xs text-muted-foreground tabular-nums">
          <span>
            {run.done} из {run.total} {plural(run.total, "абзаца", "абзацев", "абзацев")}
          </span>
          <span className="font-mono">{value}%</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-elev">
          <motion.div
            className={cn("h-full rounded-full", active ? "bar-running" : run.state === "done" ? "bg-ok" : "bg-danger")}
            initial={false}
            animate={{ width: `${run.state === "failed" ? 100 : value}%` }}
          />
        </div>
      </div>
      <span
        className={cn(
          "rounded-full px-2.5 py-1 text-[11px] font-semibold",
          active ? "bg-electric/12 text-electric" : run.state === "done" ? "bg-ok/12 text-ok" : "bg-danger/12 text-danger"
        )}
      >
        {RUN_STATE[run.state]}
      </span>
    </Link>
  )
}

export function GeneratePanel() {
  const qc = useQueryClient()
  const { data: templates } = useTemplates()
  const { data: models } = usePromptModels()
  const { data: allRuns } = useRuns()
  const [projectId] = useCurrentProject()
  const runs = allRuns?.filter((r) => !projectId || r.project_id === projectId)
  const [templateId, setTemplateId] = useState<string | null>(null)
  const [model, setModel] = useState("gemini-2.5-flash")
  const [pairCount, setPairCount] = useState<number | null>(null)
  const [file, setFile] = useState<File | null>(null)

  const template = templates?.find((t) => t.id === templateId)
  const counts = pairOptions(template?.pairs ?? 0)
  const pairs = pairCount && counts.some((c) => c.value === pairCount) ? pairCount : (counts.find((c) => c.value === 4)?.value ?? counts[0]?.value ?? null)

  const submit = useMutation({
    mutationFn: () => prompts.createRun(file!, templateId!, model, pairs!, projectId),
    onSuccess: () => {
      setFile(null)
      qc.invalidateQueries({ queryKey: keys.runs })
    },
    onError: (e) => toast.error(e.message),
  })

  return (
    <div className="flex flex-col gap-8">
      <section className="grid gap-4 rounded-2xl border border-line bg-surface p-5 lg:grid-cols-[1fr_1.1fr]">
        <Dropzone
          accept=".docx,.txt"
          title="Сценарий"
          hint=".docx или .txt"
          fileName={file?.name}
          onFile={setFile}
          onClear={() => setFile(null)}
          className="min-h-40 lg:h-full"
        />
        <div className="flex flex-col gap-4">
          <Select
            label="Шаблон"
            value={templateId}
            onChange={(v) => setTemplateId(v)}
            placeholder={templates?.length ? "Выберите шаблон" : "Сначала загрузите бриф во вкладке «Шаблоны»"}
            options={(templates ?? []).map((t) => ({ value: t.id, label: t.title, hint: `${t.pairs} ${plural(t.pairs, "пара", "пары", "пар")}` }))}
          />
          <div className="grid grid-cols-2 gap-3">
            <Select label="Модель" value={model} onChange={setModel} options={(models ?? []).map((m) => ({ value: m.id, label: m.label }))} />
            <Select label="Пар на абзац" value={pairs} onChange={setPairCount} options={counts} placeholder="—" />
          </div>
          <button
            type="button"
            disabled={!file || !templateId || !pairs || submit.isPending}
            onClick={() => submit.mutate()}
            className="glow-electric mt-auto flex h-11 items-center justify-center gap-2 rounded-xl bg-electric font-semibold text-white transition hover:brightness-110 disabled:pointer-events-none disabled:opacity-40 disabled:shadow-none"
          >
            {submit.isPending ? <Loader2 className="size-4.5 animate-spin" /> : <Sparkles className="size-4.5" />}
            Сгенерировать
          </button>
        </div>
      </section>

      {!!runs?.length && (
        <section className="flex flex-col gap-2">
          {runs.map((run) => (
            <RunCard key={run.id} run={run} />
          ))}
        </section>
      )}
    </div>
  )
}
