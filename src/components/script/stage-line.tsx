import { Check, X } from "lucide-react"

import type { ScenarioStage, StageKey } from "@/lib/api"
import { cn } from "@/lib/utils"

const NAMES: Record<StageKey, string> = { brief: "бриф", plan: "план", chapters: "главы", done: "готово" }

/** Compact line for a project row: four bars with captions. */
export function StageBars({ stages }: { stages: ScenarioStage[] }) {
  return (
    <div className="grid grid-cols-4 gap-1.5">
      {stages.map((s) => {
        const part = s.state === "active" && s.total ? Math.max(0.08, (s.done ?? 0) / s.total) : null
        return (
          <div key={s.key} className="min-w-0">
            <div className="mb-1 flex items-baseline justify-between gap-1 text-[11px]">
              <span
                className={cn(
                  "truncate",
                  s.state === "done" && "text-foreground-2",
                  s.state === "active" && "font-medium text-pick-text",
                  s.state === "error" && "text-danger",
                  (s.state === "todo" || s.state === "skipped") && "text-faint",
                  s.state === "skipped" && "line-through"
                )}
              >
                {NAMES[s.key]}
              </span>
              {s.total ? (
                <span className="font-mono text-[10px] text-faint">
                  {s.state === "done" ? s.total : (s.done ?? 0)}/{s.total}
                </span>
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

/** Large line for the open project: numbered steps with a caption under each. */
export function StageSteps({ stages, captions }: { stages: ScenarioStage[]; captions: Partial<Record<StageKey, string>> }) {
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
              (s.state === "todo" || s.state === "skipped") && "border border-line-strong text-faint"
            )}
          >
            {s.state === "done" ? <Check className="size-3.5" /> : s.state === "error" ? <X className="size-3.5" /> : i + 1}
          </span>
          <span className="min-w-0">
            <span
              className={cn(
                "block text-sm capitalize",
                s.state === "todo" || s.state === "skipped" ? "text-muted-foreground" : "font-medium",
                s.state === "skipped" && "line-through"
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
