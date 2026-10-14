"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Search } from "lucide-react"
import { AnimatePresence, motion } from "motion/react"

import { StateDot } from "@/components/jobs/state"
import { jobTitle, percent, STATE_LABEL } from "@/lib/format"
import { MODE_BY_ID, modeLabel } from "@/lib/modes"
import { useJobs } from "@/lib/queries"
import { cn } from "@/lib/utils"

const LIMIT = 8

/** Job search in the top bar: by title, mode or id; ⌘K / Ctrl+K focuses it. */
export function SearchBar() {
  const router = useRouter()
  const { data: jobs } = useJobs()
  const input = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        input.current?.focus()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = jobs ?? []
    if (!q) return list.slice(0, LIMIT)
    return list
      .filter((j) => [jobTitle(j), modeLabel(j.mode), MODE_BY_ID[j.mode].short, j.id].some((s) => s.toLowerCase().includes(q)))
      .slice(0, LIMIT)
  }, [jobs, query])

  const go = (id: string) => {
    setOpen(false)
    setQuery("")
    input.current?.blur()
    router.push(`/jobs/${id}`)
  }

  return (
    <div className="relative w-full max-w-lg">
      <label className="flex h-11 items-center gap-3 rounded-full border border-line-strong bg-surface px-4 transition-colors focus-within:border-electric/50 focus-within:bg-surface-2">
        <Search className="size-4 shrink-0 text-muted-foreground" />
        <input
          ref={input}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setActive(0)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault()
              setActive((i) => Math.min(i + 1, results.length - 1))
            } else if (e.key === "ArrowUp") {
              e.preventDefault()
              setActive((i) => Math.max(i - 1, 0))
            } else if (e.key === "Enter" && results[active]) {
              go(results[active].id)
            } else if (e.key === "Escape") {
              input.current?.blur()
            }
          }}
          placeholder="Поиск задач"
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        <kbd className="hidden rounded-md border border-line-strong px-1.5 py-0.5 font-mono text-[11px] text-faint sm:block">⌘K</kbd>
      </label>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.12 }}
            className="absolute inset-x-0 top-13 z-50 overflow-hidden rounded-2xl border border-line-strong bg-popover p-1.5 shadow-2xl shadow-black/50"
          >
            {results.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                {jobs?.length ? "Ничего не найдено" : "Задач пока нет"}
              </p>
            ) : (
              <>
                {!query.trim() && <p className="px-3 pt-1.5 pb-1 text-xs text-faint">Последние задачи</p>}
                {results.map((job, i) => {
                  const Icon = MODE_BY_ID[job.mode].icon
                  return (
                    <button
                      key={job.id}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onMouseEnter={() => setActive(i)}
                      onClick={() => go(job.id)}
                      className={cn("flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left", i === active && "bg-elev")}
                    >
                      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-surface-2 ring-1 ring-line">
                        <Icon className="size-4 text-muted-foreground" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{jobTitle(job)}</span>
                        <span className="block truncate text-xs text-muted-foreground">{modeLabel(job.mode)}</span>
                      </span>
                      <span className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                        <StateDot state={job.state} />
                        {job.state === "done" ? STATE_LABEL.done : `${percent(job.progress)}%`}
                      </span>
                    </button>
                  )
                })}
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
