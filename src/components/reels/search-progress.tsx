"use client"

import { Loader2 } from "lucide-react"

import { CAT_BG, CAT_LABEL } from "@/components/reels/parts"
import { Card } from "@/components/script/ui"
import type { Reel, ReelCategory } from "@/lib/api"
import { cn } from "@/lib/utils"

/** One «Поиск видео» project of the reel while it runs (fl-reel `materials.search`). */
type SearchState = {
  status: string
  step: string
  done?: number | null
  total?: number | null
  found?: number | null
  shots: number
}

/** What newer brains add to `materials`: the live search per category and shots taken with the threshold lowered by 1. */
type FootageExtras = {
  search?: Partial<Record<ReelCategory, SearchState>>
  relaxed?: Partial<Record<ReelCategory, number>>
}

const ORDER: ReelCategory[] = ["video", "history"]

function stepText(s: SearchState) {
  if (s.status === "queued") return "в очереди «Поиска видео»"
  const count = s.total ? ` ${s.done ?? 0}/${s.total}` : ""
  return `${s.step || "поиск"}${count}`
}

/** «Поиск видео» while it runs: the module's step per category and how many shots are already found
 *  (the shots themselves count in «Материалы» only when the project ends — the files come as one archive). */
export function SearchProgressCard({ reel: r }: { reel: Reel }) {
  const x = (r.materials ?? null) as unknown as FootageExtras | null
  const live = r.status === "running" ? ORDER.filter((c) => x?.search?.[c]) : []
  const relaxed = ORDER.filter((c) => x?.relaxed?.[c])
  if (!live.length && !relaxed.length) return null
  return (
    <Card
      title="Поиск видео"
      aside={
        live.length > 0 && (
          <span className="flex items-center gap-1.5 font-mono text-[11px] text-faint">
            <Loader2 className="size-3 animate-spin" />
            идёт
          </span>
        )
      }
    >
      <div className="space-y-2.5">
        {live.map((c) => {
          const s = x!.search![c]!
          const found = s.found ?? 0
          return (
            <div key={c} className="grid grid-cols-[150px_1fr_auto] items-center gap-3 text-sm max-sm:grid-cols-[110px_1fr]">
              <span className="truncate text-foreground-2">{CAT_LABEL[c]}</span>
              <div className="h-1.5 overflow-hidden rounded-full bg-elev" title="найдено из заказанных">
                <div className={cn("h-full opacity-70", CAT_BG[c])} style={{ width: `${s.shots ? (100 * found) / s.shots : 0}%` }} />
              </div>
              <span className="font-mono text-[11px] text-faint max-sm:col-span-2">
                {stepText(s)} · найдено {found} из {s.shots}
              </span>
            </div>
          )
        })}
        {relaxed.length > 0 && (
          <p className={cn("font-mono text-[11px] text-faint", live.length > 0 && "border-t border-line pt-2.5")}>
            с порогом на 1 ниже: {relaxed.map((c) => `${CAT_LABEL[c].toLowerCase()} ${x!.relaxed![c]}`).join(" · ")}
          </p>
        )}
      </div>
    </Card>
  )
}
