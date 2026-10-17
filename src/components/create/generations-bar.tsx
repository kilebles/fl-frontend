"use client"

import Link from "next/link"
import { Search } from "lucide-react"

import { ProjectPicker } from "@/components/shell/project-picker"
import { isFinished, isSingle } from "@/lib/api"
import { useJobs } from "@/lib/queries"
import { cn } from "@/lib/utils"

/** Top bar of both generation screens: Вручную / Пакетом, project, and (manual) prompt search. */
export function GenerationsBar({ mode, search, onSearch, aside }: { mode: "manual" | "batch"; search?: string; onSearch?: (v: string) => void; aside?: React.ReactNode }) {
  const { data: jobs } = useJobs()
  const running = jobs?.filter((j) => !isSingle(j) && !isFinished(j.state)).length ?? 0

  return (
    <div className="flex flex-wrap items-center gap-3">
      <nav aria-label="Режим генерации" className="flex gap-1 rounded-[4px] border border-line-strong bg-surface p-[3px]">
        {(
          [
            ["manual", "/", "Вручную"],
            ["batch", "/batch", "Пакетом"],
          ] as const
        ).map(([key, href, label]) => (
          <Link
            key={key}
            href={href}
            aria-current={mode === key ? "page" : undefined}
            className={cn(
              "flex items-center gap-2 rounded-[3px] px-4 py-2 text-sm transition-colors",
              mode === key ? "bg-inverse font-medium text-inverse-foreground" : "text-foreground-2 hover:text-foreground"
            )}
          >
            {label}
            {key === "batch" && running > 0 && (
              <span className={cn("rounded-[2px] px-1.5 py-px font-mono text-[11px]", mode === key ? "bg-black/10" : "bg-electric-soft text-electric-text")}>{running} идёт</span>
            )}
          </Link>
        ))}
      </nav>
      <ProjectPicker />
      {onSearch && (
        <label className="flex h-[46px] min-w-56 flex-1 items-center gap-2.5 rounded-[4px] border border-line-strong bg-surface px-3.5 focus-within:border-electric/60">
          <Search className="size-4 shrink-0 text-muted-foreground" />
          <input value={search} onChange={(e) => onSearch(e.target.value)} placeholder="Поиск по промптам" className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-faint" />
        </label>
      )}
      {aside && <div className="ml-auto text-sm text-muted-foreground">{aside}</div>}
    </div>
  )
}
