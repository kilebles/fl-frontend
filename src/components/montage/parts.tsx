"use client"

import {
  BarChart3,
  CalendarRange,
  Grip,
  IdCard,
  Map as MapIcon,
  Network,
  Route,
  ScrollText,
  Sparkles,
  Swords,
  Table2,
  type LucideIcon,
} from "lucide-react"

import type { InfoJob, InfoPalette, InfoPaletteOption, InfoStyle, InfoType } from "@/lib/api"
import { plural } from "@/lib/format"
import { cn } from "@/lib/utils"

export const TYPE_ICON: Record<InfoType | "auto", LucideIcon> = {
  auto: Sparkles,
  timeline: CalendarRange,
  tree: Network,
  table: Table2,
  chart: BarChart3,
  map: MapIcon,
  facts: IdCard,
  battle: Swords,
  journey: Route,
  units: Grip,
  document: ScrollText,
}

/** Short names for chips and rows (the full ones come from /options). */
export const TYPE_SHORT: Record<InfoType | "auto", string> = {
  auto: "авто",
  timeline: "таймлайн",
  tree: "древо",
  table: "таблица",
  chart: "график",
  map: "карта",
  facts: "факты",
  battle: "схема боя",
  journey: "путь",
  units: "точки",
  document: "документ",
}

/** A small preview of each visual style (the same colours as renderer/src/theme.ts in fl-montage). */
export const STYLE_SWATCH: Record<InfoStyle, { bg: string; ink: string; accent: string; a: string; b: string; font: string; upper?: boolean }> = {
  parchment: { bg: "radial-gradient(ellipse at 50% 40%, #efe3c6, #cdb68a)", ink: "#33230f", accent: "#8e2a1c", a: "#9c2b1f", b: "#264f86", font: "Georgia, serif" },
  cinematic: { bg: "radial-gradient(ellipse at 50% 35%, #1d2229, #07080a)", ink: "#f1e8d6", accent: "#c9a45c", a: "#c8432f", b: "#4a7cc2", font: "Georgia, serif" },
  clean: { bg: "linear-gradient(180deg, #f7f8fa, #eceff3)", ink: "#15181d", accent: "#2f6bff", a: "#e4572e", b: "#2f6bff", font: "Inter, Arial, sans-serif" },
  chronicle: { bg: "radial-gradient(ellipse at 50% 45%, #ddd2ba, #b3a481)", ink: "#1d1b17", accent: "#7a1f14", a: "#7a1f14", b: "#2a2a2a", font: "'Arial Narrow', Arial, sans-serif", upper: true },
}

export function StyleSwatch({ style, className }: { style: InfoStyle; className?: string }) {
  return <PaletteSwatch style={style} className={className} />
}

/** The style's paper and type with a palette's colours (`/options` palettes[].swatches[style]: side A, side B, accent,
 *  mark); without colours — the style's own. large — for a big tile (bigger letters). */
export function PaletteSwatch({ style, colors = [], className, large }: { style: InfoStyle; colors?: string[]; className?: string; large?: boolean }) {
  const s = STYLE_SWATCH[style] ?? STYLE_SWATCH.parchment
  const [a = s.a, b = s.b, accent = s.accent, mark] = colors
  return (
    <span className={cn("relative block overflow-hidden rounded-[2px]", className)} style={{ background: s.bg }}>
      <span
        className={cn("absolute top-[18%] left-[10%] leading-none font-bold", large ? "text-[28px]" : "text-[13px]")}
        style={{ color: s.ink, fontFamily: s.font, textTransform: s.upper ? "uppercase" : "none" }}
      >
        Аа
      </span>
      <span className={cn("absolute left-[10%] h-[2px] w-[28%]", large ? "top-[56%]" : "top-[46%]")} style={{ background: accent }} />
      {mark && <span className={cn("absolute left-[10%] aspect-square w-[6%] rounded-full", large ? "top-[66%]" : "top-[58%]")} style={{ background: mark }} />}
      <span className="absolute right-[10%] bottom-[18%] h-[30%] w-[12%] rounded-[1px]" style={{ background: a }} />
      <span className="absolute right-[26%] bottom-[18%] h-[48%] w-[12%] rounded-[1px]" style={{ background: b }} />
    </span>
  )
}

/** «Цвета»: palettes of fl-montage over the chosen style (`swatches[style]`); the same picker in «Перерисовать». */
export function PalettePick({
  style,
  value,
  options,
  onChange,
  compact,
}: {
  style: InfoStyle
  value: InfoPalette
  options: InfoPaletteOption[]
  onChange: (p: InfoPalette) => void
  compact?: boolean
}) {
  return (
    <div className={cn("grid grid-cols-2 gap-2", compact && "sm:grid-cols-4")}>
      {options.map((p) => {
        const on = value === p.value
        return (
          <button
            key={p.value}
            type="button"
            title={p.hint}
            aria-pressed={on}
            onClick={() => onChange(p.value)}
            className={cn(
              "flex min-w-0 items-center gap-2.5 rounded-[3px] border p-1.5 pr-2.5 text-left transition-colors",
              on ? "border-pick/60 bg-pick-soft" : "border-line-strong hover:border-faint",
            )}
          >
            <PaletteSwatch style={style} colors={p.swatches?.[style]} className={cn("shrink-0", compact ? "h-8 w-12" : "h-10 w-16")} />
            <span className={cn("min-w-0 truncate text-[13px] leading-tight", on ? "font-medium text-pick-text" : "text-foreground-2")}>{p.label}</span>
          </button>
        )
      })}
    </div>
  )
}

export const infographicsText = (n: number) => `${n} ${plural(n, "инфографика", "инфографики", "инфографик")}`

/** 1 500 000 → «1,4 МБ». */
export function size(n: number) {
  if (n >= 1024 ** 3) return `${(n / 1024 ** 3).toFixed(1).replace(".", ",")} ГБ`
  if (n >= 1024 ** 2) return `${(n / 1024 ** 2).toFixed(1).replace(".", ",")} МБ`
  return `${Math.max(1, Math.round(n / 1024))} КБ`
}

/** What the job is doing now, in plain words. */
export function stepText(j: InfoJob): string {
  const p = j.progress
  if (p.wait) return p.wait
  if (p.step) return p.step
  if (j.stage === "extract") return "модель читает текст"
  if (j.stage === "render") return "рендер"
  return "запуск"
}

/** Share of the work done (extract is the first fifth, the render the rest). */
export function share(j: InfoJob): number {
  if (j.status === "done") return 1
  const p = j.progress
  const part = p.total ? Math.min(1, (p.done ?? 0) / p.total) : 0
  return p.stage === "render" || j.stage === "render" ? 0.2 + 0.8 * part : 0.2 * part
}

export function ProgressLine({ job }: { job: InfoJob }) {
  const active = job.status === "running"
  const v = share(job)
  return (
    <div className="h-1 overflow-hidden rounded-full bg-elev">
      <div
        className={cn(
          "h-full rounded-full transition-[width] duration-500",
          job.status === "done" ? "bg-ok" : job.status === "error" ? "bg-danger" : job.status === "stopped" ? "bg-warn" : "bg-pick",
          active && "bar-running",
        )}
        style={{ width: `${Math.max(active ? 4 : 0, v * 100)}%` }}
      />
    </div>
  )
}
