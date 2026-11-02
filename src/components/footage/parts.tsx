"use client"

import { AlertTriangle, Check, Film, Image as ImageIcon, X } from "lucide-react"

import type { Candidate, FootageGroup, FootageStage, FootageStageKey, ShotType } from "@/components/footage/types"
import { cn } from "@/lib/utils"

export const GROUP_LABEL: Record<FootageGroup, string> = {
  archive: "Архивы",
  youtube: "YouTube",
  films: "Фильмы",
  stock: "Стоки",
}
export const GROUP_HINT: Record<FootageGroup, string> = {
  archive: "Commons, Internet Archive, The Met",
  youtube: "Creative Commons и каналы гос. архивов",
  films: "хроника, фильмы до 1931, LoC, NASA",
  stock: "Pexels, Pixabay",
}
/** Bars and dots per source group: one hue each, same in both themes. */
export const GROUP_COLOR: Record<FootageGroup, string> = {
  archive: "bg-[#c9a04f]",
  youtube: "bg-[#e0575b]",
  films: "bg-[#8b7cf0]",
  stock: "bg-[#4fb3a9]",
}

export const TYPE_LABEL: Record<ShotType, string> = {
  location: "место",
  atmosphere: "атмосфера",
  artwork: "картина",
  artifact: "артефакт",
  archive: "хроника",
  reenactment: "реконструкция",
  portrait: "портрет",
  ai_video: "ИИ-видео",
  infographic: "инфографика",
  map: "карта",
}

export const PROVIDER_LABEL: Record<string, string> = {
  commons: "Commons",
  internet_archive: "Internet Archive",
  met: "The Met",
  youtube: "YouTube",
  pexels: "Pexels",
  pixabay: "Pixabay",
  loc: "Библ. Конгресса",
  nasa: "NASA",
  nara: "NARA",
  dvids: "DVIDS",
}

/** 75.4 → «1:15». */
export function clock(sec: number) {
  const s = Math.round(sec)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const r = String(s % 60).padStart(2, "0")
  return h ? `${h}:${String(m).padStart(2, "0")}:${r}` : `${m}:${r}`
}

export const scoreColor = (s: number) => (s >= 8 ? "text-ok" : s >= 7 ? "text-foreground-2" : "text-warn")

/* Placeholder previews for the design pass: muted gradients per kind of picture. Real thumbnails come from the API. */
const TINTS = [
  "from-[#2b4a63] via-[#56707a] to-[#b9a581]", // coast, haze
  "from-[#203845] via-[#3e6470] to-[#8fb0b3]", // sea, stock
  "from-[#4a3b2b] via-[#7d6a52] to-[#c8b48e]", // stone, ruins
  "from-[#5b2e22] via-[#9a5c3b] to-[#d9a66b]", // fresco
  "from-[#3a342c] via-[#6e6253] to-[#a89a83]", // museum object, engraving
  "from-[#1f1f1f] via-[#4b4b4b] to-[#9a9a9a]", // black-and-white film
  "from-[#3a1f1a] via-[#7a3b26] to-[#d0874c]", // fire, reenactment
]

export function Thumb({
  c,
  ratio = "16:9",
  className,
  children,
}: {
  c?: Candidate | null
  ratio?: "16:9" | "9:16"
  className?: string
  children?: React.ReactNode
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[3px] bg-elev",
        ratio === "16:9" ? "aspect-video" : "aspect-[9/16]",
        c && `bg-gradient-to-br ${TINTS[(c.tint ?? 0) % TINTS.length]}`,
        c?.provider === "internet_archive" || c?.provider === "loc" ? "grayscale" : "",
        className,
      )}
    >
      {c && (
        <>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_35%,rgba(255,255,255,0.18),transparent_55%)]" />
          <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/45 to-transparent" />
        </>
      )}
      {children}
    </div>
  )
}

/** Small kind badge in a thumbnail corner: video with segment length or photo. */
export function KindBadge({ c, sec }: { c: Candidate; sec: number }) {
  return (
    <span className="flex items-center gap-1 rounded-[2px] bg-black/55 px-1.5 py-0.5 font-mono text-[10px] text-white backdrop-blur-sm">
      {c.kind === "video" ? <Film className="size-3" /> : <ImageIcon className="size-3" />}
      {c.kind === "video" ? `${sec.toFixed(1)} с` : "фото"}
    </span>
  )
}

export function RiskMark({ className }: { className?: string }) {
  return (
    <span
      title="Без подтверждённой свободной лицензии"
      className={cn("flex items-center gap-1 rounded-[2px] bg-warn px-1.5 py-0.5 text-[10px] font-medium text-black", className)}
    >
      <AlertTriangle className="size-3" />
      лицензия
    </span>
  )
}

const NAMES: Record<FootageStageKey, string> = {
  plan: "шот-лист",
  search: "поиск",
  extra: "доп. круг",
  cut: "нарезка",
  done: "готово",
}

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
            <span className={cn("block text-sm first-letter:uppercase", s.state === "todo" ? "text-muted-foreground" : "font-medium")}>{NAMES[s.key]}</span>
            {captions[s.key] && <span className="block truncate font-mono text-[11px] text-faint">{captions[s.key]}</span>}
          </span>
        </li>
      ))}
    </ol>
  )
}

/** Share of found shots per source group: one stacked bar + legend. */
export function GroupBar({ by, className, legend = true }: { by: Partial<Record<FootageGroup, number>>; className?: string; legend?: boolean }) {
  const groups = (Object.keys(GROUP_LABEL) as FootageGroup[]).filter((g) => by[g])
  const total = groups.reduce((a, g) => a + (by[g] ?? 0), 0)
  if (!total) return null
  return (
    <div className={className}>
      <div className="flex h-1.5 overflow-hidden rounded-full bg-elev">
        {groups.map((g) => (
          <div key={g} className={cn("h-full", GROUP_COLOR[g])} style={{ width: `${((by[g] ?? 0) / total) * 100}%` }} />
        ))}
      </div>
      {legend && (
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
          {groups.map((g) => (
            <span key={g} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className={cn("size-2 rounded-full", GROUP_COLOR[g])} />
              {GROUP_LABEL[g]}
              <span className="font-mono text-faint">{by[g]}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
