"use client"

import { useState } from "react"
import Link from "next/link"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Check, Loader2, Sparkles } from "lucide-react"
import { motion } from "motion/react"
import { toast } from "sonner"

import { Dropzone } from "@/components/create/dropzone"
import { infographicActive, infographics, type InfographicRun } from "@/lib/api"
import { plural, timeAgo } from "@/lib/format"
import { keys, useInfographicCategories, useInfographicRuns } from "@/lib/queries"
import { cn } from "@/lib/utils"

export function stageText(run: InfographicRun): string {
  switch (run.state) {
    case "queued":
      return "В очереди"
    case "searching":
      return run.total ? `Поиск изображений · ${run.done} из ${run.total}, найдено ${run.found}` : "Анализ сценария"
    case "rendering":
      return `Рендер · ${run.done} из ${run.total}`
    case "done":
      return `${run.total} ${plural(run.total, "карточка", "карточки", "карточек")}`
    case "failed":
      return "Ошибка"
  }
}

export function stagePercent(run: InfographicRun): number {
  if (run.state === "done") return 100
  if (!run.total) return 0
  const part = run.done / run.total
  // the search is the first half of the work, the render the second
  return Math.round((run.state === "rendering" ? 50 + part * 50 : part * 50))
}

function RunCard({ run }: { run: InfographicRun }) {
  const active = infographicActive(run)
  return (
    <Link
      href={`/infographics/runs/${run.id}`}
      className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-3 rounded-2xl border border-line bg-surface p-4 transition-colors hover:border-line-strong hover:bg-surface-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_auto]"
    >
      <div className="min-w-0">
        <p className="truncate font-semibold">{run.scenario_name}</p>
        <p className="mt-0.5 text-[13px] text-muted-foreground">{timeAgo(run.created_at)}</p>
      </div>
      <div className="col-span-2 row-start-2 md:col-span-1 md:row-start-auto">
        <p className="mb-1.5 truncate text-xs text-muted-foreground">{stageText(run)}</p>
        <div className="h-1.5 overflow-hidden rounded-full bg-elev">
          <motion.div
            className={cn("h-full rounded-full", active ? "bar-running" : run.state === "done" ? "bg-ok" : "bg-danger")}
            initial={false}
            animate={{ width: `${run.state === "failed" ? 100 : Math.max(stagePercent(run), active ? 3 : 0)}%` }}
          />
        </div>
      </div>
      <span
        className={cn(
          "rounded-full px-2.5 py-1 text-[11px] font-semibold",
          active ? "bg-electric/12 text-electric" : run.state === "done" ? "bg-ok/12 text-ok" : "bg-danger/12 text-danger"
        )}
      >
        {active ? "В работе" : run.state === "done" ? "Готово" : "Ошибка"}
      </span>
    </Link>
  )
}

export function InfographicsView() {
  const qc = useQueryClient()
  const { data: categories } = useInfographicCategories()
  const { data: runs } = useInfographicRuns()
  const [file, setFile] = useState<File | null>(null)
  const [chosen, setChosen] = useState<string[]>(["people"])
  const [onePerPerson, setOnePerPerson] = useState(false)

  const toggle = (id: string) => setChosen((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]))

  const submit = useMutation({
    mutationFn: () => infographics.create(file!, chosen, onePerPerson),
    onSuccess: () => {
      setFile(null)
      qc.invalidateQueries({ queryKey: keys.infographicRuns })
    },
    onError: (e) => toast.error(e.message),
  })

  return (
    <div className="mx-auto max-w-6xl px-4 pt-8 pb-20 sm:px-6 md:pt-12 lg:px-10">
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">Инфографика</h1>

      <section className="mb-8 grid gap-4 rounded-2xl border border-line bg-surface p-5 lg:grid-cols-[1fr_1fr]">
        <Dropzone accept=".docx" title="Сценарий" hint=".docx" fileName={file?.name} onFile={setFile} onClear={() => setFile(null)} className="min-h-40 lg:h-full" />
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <span className="text-[13px] text-muted-foreground">Что искать</span>
            <div className="flex flex-wrap gap-2">
              {(categories ?? []).map((c) => {
                const on = chosen.includes(c.id)
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => toggle(c.id)}
                    className={cn(
                      "inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-sm transition-colors",
                      on ? "border-electric/50 bg-electric/12 text-foreground" : "border-line-strong text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {on && <Check className="size-3.5 text-electric" />}
                    {c.label}
                  </button>
                )
              })}
            </div>
          </div>
          <label className="flex cursor-pointer items-center gap-3 text-sm">
            <input type="checkbox" checked={onePerPerson} onChange={(e) => setOnePerPerson(e.target.checked)} className="size-4 accent-[var(--electric)]" />
            Одна карточка на каждого
          </label>
          <button
            type="button"
            disabled={!file || !chosen.length || submit.isPending}
            onClick={() => submit.mutate()}
            className="glow-electric mt-auto flex h-11 items-center justify-center gap-2 rounded-xl bg-electric font-semibold text-white transition hover:brightness-110 disabled:pointer-events-none disabled:opacity-40 disabled:shadow-none"
          >
            {submit.isPending ? <Loader2 className="size-4.5 animate-spin" /> : <Sparkles className="size-4.5" />}
            Создать
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
