"use client"

import { Check, X } from "lucide-react"

import { plural } from "@/lib/format"
import type { FootageGroup, FootageProject, FootageStage, FootageStageKey } from "@/lib/api"
import { cn } from "@/lib/utils"

export const GROUPS: FootageGroup[] = ["archive", "youtube", "films", "stock"]
export const GROUP_LABEL: Record<FootageGroup, string> = { archive: "Архивы", youtube: "YouTube", films: "Фильмы", stock: "Стоки" }
export const GROUP_HINT: Record<FootageGroup, string> = {
  archive: "Commons, Internet Archive, The Met",
  youtube: "Creative Commons и каналы гос. архивов",
  films: "хроника, фильмы до 1931, Библиотека Конгресса, NASA",
  stock: "Pexels, Pixabay",
}
/** One hue per source group, the same in both themes. */
export const GROUP_COLOR: Record<FootageGroup, string> = {
  archive: "bg-[#c9a04f]",
  youtube: "bg-[#e0575b]",
  films: "bg-[#8b7cf0]",
  stock: "bg-[#4fb3a9]",
}

export const TYPE_LABEL: Record<string, string> = {
  location: "место",
  atmosphere: "атмосфера",
  artwork: "картина",
  artifact: "артефакт",
  archive: "хроника",
  reenactment: "реконструкция",
  portrait: "портрет",
}

export const ENGINE_LABEL: Record<string, string> = { agy: "agy (Gemini)", claude: "Claude Code", gemini_api: "Gemini API", "": "" }

/** 1 кадр, 3 кадра, 12 кадров. */
export const shotsText = (n: number) => `${n} ${plural(n, "кадр", "кадра", "кадров")}`

/** 75.4 → «1:15», 4000 → «1:06:40». */
export function clock(sec: number) {
  const s = Math.round(sec)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const r = String(s % 60).padStart(2, "0")
  return h ? `${h}:${String(m).padStart(2, "0")}:${r}` : `${m}:${r}`
}

export const aiCalls = (p: FootageProject) => Object.values(p.stats?.ai_usage ?? {}).reduce((a, u) => a + (u?.calls ?? 0), 0)

const NAMES: Record<FootageStageKey, string> = { plan: "шот-лист", search: "поиск", extra: "доп. круг", cut: "нарезка", done: "готово" }

/** Compact line for a project row: five bars with captions. */
export function StageBars({ stages }: { stages: FootageStage[] }) {
  return (
    <div className="grid grid-cols-5 gap-1.5">
      {stages.map((s) => {
        const part = s.state === "active" && s.total ? Math.max(0.06, (s.done ?? 0) / s.total) : null
        return (
          <div key={s.key} className="min-w-0">
            <div className="mb-1 truncate text-[11px]">
              <span
                className={cn(
                  s.state === "done" && "text-foreground-2",
                  s.state === "active" && "font-medium text-pick-text",
                  s.state === "error" && "text-danger",
                  (s.state === "todo" || s.state === "skipped") && "text-faint",
                  s.state === "skipped" && "line-through",
                )}
              >
                {NAMES[s.key]}
              </span>
            </div>
            <div className="h-1 overflow-hidden rounded-full bg-elev">
              <div
                className={cn(
                  "h-full rounded-full transition-[width] duration-700",
                  s.state === "done" && "w-full bg-ok/70",
                  s.state === "active" && "bar-pick",
                  s.state === "error" && "w-full bg-danger/70",
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
export function StageSteps({ stages, captions }: { stages: FootageStage[]; captions: Partial<Record<FootageStageKey, string>> }) {
  return (
    <ol className="grid grid-cols-2 gap-3 sm:grid-cols-5">
      {stages.map((s, i) => (
        <li key={s.key} className="flex min-w-0 items-start gap-2.5">
          <span
            className={cn(
              "grid size-6 shrink-0 place-items-center rounded-[3px] font-mono text-[11px]",
              s.state === "done" && "bg-ok/15 text-ok",
              s.state === "active" && "animate-pulse-dot bg-pick text-white",
              s.state === "error" && "bg-danger/15 text-danger",
              (s.state === "todo" || s.state === "skipped") && "border border-line-strong text-faint",
            )}
          >
            {s.state === "done" ? <Check className="size-3.5" /> : s.state === "error" ? <X className="size-3.5" /> : i + 1}
          </span>
          <span className="min-w-0">
            <span
              className={cn(
                "block text-sm first-letter:uppercase",
                s.state === "todo" || s.state === "skipped" ? "text-muted-foreground" : "font-medium",
                s.state === "skipped" && "line-through",
              )}
            >
              {NAMES[s.key]}
            </span>
            {captions[s.key] && <span className="block truncate font-mono text-[11px] text-faint">{captions[s.key]}</span>}
          </span>
        </li>
      ))}
    </ol>
  )
}

/** Share of found shots per source group: one stacked bar + legend. */
export function GroupBar({ by, className }: { by: Partial<Record<FootageGroup, number>>; className?: string }) {
  const groups = GROUPS.filter((g) => by[g])
  const total = groups.reduce((a, g) => a + (by[g] ?? 0), 0)
  if (!total) return null
  return (
    <div className={className}>
      <div className="flex h-1.5 overflow-hidden rounded-full bg-elev">
        {groups.map((g) => (
          <div key={g} className={cn("h-full", GROUP_COLOR[g])} style={{ width: `${((by[g] ?? 0) / total) * 100}%` }} />
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
        {groups.map((g) => (
          <span key={g} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className={cn("size-2 rounded-full", GROUP_COLOR[g])} />
            {GROUP_LABEL[g]}
            <span className="font-mono text-faint">{by[g]}</span>
          </span>
        ))}
      </div>
    </div>
  )
}
