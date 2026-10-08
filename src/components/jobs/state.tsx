import type { JobState } from "@/lib/api"
import { STATE_LABEL, STATE_TONE } from "@/lib/format"
import { cn } from "@/lib/utils"

const LIVE: JobState[] = ["running", "waiting"]

export function StateDot({ state, className }: { state: JobState; className?: string }) {
  return (
    <span
      className={cn(
        "block size-2 rounded-full bg-current",
        STATE_TONE[state],
        LIVE.includes(state) && "animate-pulse-dot",
        className
      )}
    />
  )
}

export function StateBadge({ state, className }: { state: JobState; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-7 items-center gap-2 rounded-full border border-current/15 bg-current/8 px-3 text-xs font-medium",
        STATE_TONE[state],
        className
      )}
    >
      <StateDot state={state} />
      {STATE_LABEL[state]}
    </span>
  )
}
