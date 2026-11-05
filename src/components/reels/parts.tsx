"use client"

import { Check, Minus, Plus, X } from "lucide-react"

import { plural } from "@/lib/format"
import type { ReelCategory, ReelShares, ReelStep } from "@/lib/api"
import { cn } from "@/lib/utils"

export const CATEGORIES: ReelCategory[] = ["ai", "video", "history", "graphics"]
export const CAT_LABEL: Record<ReelCategory, string> = {
  ai: "ИИ-генерации",
  video: "Подбор видео",
  history: "Исторические кадры",
  graphics: "Графика",
}
export const CAT_SHORT: Record<ReelCategory, string> = { ai: "ИИ", video: "видео", history: "история", graphics: "графика" }
export const CAT_HINT: Record<ReelCategory, string> = {
  ai: "Промпты → Генерации (Veo)",
  video: "Поиск видео: стоки, YouTube",
  history: "Поиск видео: архивы и музеи",
  graphics: "Графика: карточки",
}
/** One hue per category, the same in both themes (graphics is not the light theme's terracotta accent). */
export const CAT_BG: Record<ReelCategory, string> = {
  ai: "bg-[#8b7cf0]",
  video: "bg-[#4fb3a9]",
  history: "bg-[#c9a04f]",
  graphics: "bg-[#d9658f]",
}
export const CAT_TEXT: Record<ReelCategory, string> = {
  ai: "text-[#8b7cf0]",
  video: "text-[#3e9c92]",
  history: "text-[#b08a3c]",
  graphics: "text-[#c9527c]",
}

export const TYPE_LABEL: Record<string, string> = {
  ai_video: "ИИ-сцена",
  location: "место",
  atmosphere: "атмосфера",
  reenactment: "реконструкция",
  artwork: "картина",
  artifact: "артефакт",
  portrait: "портрет",
  archive: "хроника",
  infographic: "карточка",
}

export const ENGINE_LABEL: Record<string, string> = { agy: "agy (Gemini)", claude: "Claude Code", fake: "тестовый", "": "" }

export const PRESETS: { label: string; shares: ReelShares }[] = [
  { label: "40 · 30 · 20 · 10", shares: { ai: 40, video: 30, history: 20, graphics: 10 } },
  { label: "30 · 30 · 30 · 10", shares: { ai: 30, video: 30, history: 30, graphics: 10 } },
]

export const shotsText = (n: number) => `${n} ${plural(n, "кадр", "кадра", "кадров")}`
export const parasText = (n: number) => `${n} ${plural(n, "абзац", "абзаца", "абзацев")}`

/** 75.4 → «1:15», 4000 → «1:06:40». */
export function clock(sec: number) {
  const s = Math.round(sec)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const r = String(s % 60).padStart(2, "0")
  return h ? `${h}:${String(m).padStart(2, "0")}:${r}` : `${m}:${r}`
}

export const sharesSum = (s: ReelShares) => CATEGORIES.reduce((a, c) => a + (Number(s[c]) || 0), 0)
export const sameShares = (a: ReelShares, b: ReelShares) => CATEGORIES.every((c) => Math.round(a[c]) === Math.round(b[c]))
export const roundShares = (s: ReelShares): ReelShares =>
  Object.fromEntries(CATEGORIES.map((c) => [c, Math.round(Number(s[c]) || 0)])) as ReelShares

/** Four shares in %, step 5 by the buttons or any number typed in; they must add up to 100. */
export function SharesInput({ value, onChange, short }: { value: ReelShares; onChange: (s: ReelShares) => void; short?: boolean }) {
  const set = (c: ReelCategory, v: number) => onChange({ ...value, [c]: Math.max(0, Math.min(100, Math.round(v))) })
  return (
    <div className="grid grid-cols-2 gap-[3px] rounded-[3px] bg-surface-2 p-[3px] sm:grid-cols-4">
      {CATEGORIES.map((c) => (
        <div key={c} className="flex min-w-0 flex-col gap-1.5 rounded-[2px] bg-background px-2.5 pt-2 pb-1.5" title={CAT_HINT[c]}>
          <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
            <span className={cn("size-2 shrink-0 rounded-full", value[c] ? CAT_BG[c] : "bg-line-strong")} />
            <span className="truncate first-letter:uppercase">{short ? CAT_SHORT[c] : CAT_LABEL[c]}</span>
          </span>
          <span className="flex items-center gap-1">
            <button
              type="button"
              aria-label={`${CAT_LABEL[c]}: меньше`}
              onClick={() => set(c, value[c] - 5)}
              className="grid size-6 shrink-0 place-items-center rounded-[2px] text-faint hover:bg-elev hover:text-foreground"
            >
              <Minus className="size-3" />
            </button>
            <input
              value={String(value[c])}
              inputMode="numeric"
              aria-label={CAT_LABEL[c]}
              onChange={(e) => set(c, Number(e.target.value.replace(/\D/g, "").slice(0, 3)) || 0)}
              className={cn("w-full min-w-0 bg-transparent text-center font-mono text-base outline-none", !value[c] && "text-faint")}
            />
            <button
              type="button"
              aria-label={`${CAT_LABEL[c]}: больше`}
              onClick={() => set(c, value[c] + 5)}
              className="grid size-6 shrink-0 place-items-center rounded-[2px] text-faint hover:bg-elev hover:text-foreground"
            >
              <Plus className="size-3" />
            </button>
          </span>
        </div>
      ))}
    </div>
  )
}

/** «сумма 95%» in red when the shares do not add up, and the two usual mixes. */
export function SharesAside({ value, onChange }: { value: ReelShares; onChange: (s: ReelShares) => void }) {
  const sum = sharesSum(value)
  return (
    <span className="flex items-center gap-2 text-xs">
      {PRESETS.map((p) => (
        <button
          key={p.label}
          type="button"
          onClick={() => onChange(p.shares)}
          className={cn("font-mono text-[11px]", sameShares(p.shares, value) ? "text-pick-text" : "text-faint hover:text-foreground")}
        >
          {p.label}
        </button>
      ))}
      <span className={cn("font-mono text-[11px]", sum === 100 ? "text-faint" : "font-medium text-danger")}>= {sum}%</span>
    </span>
  )
}

/** Stacked bar of the four shares (plan or fact). */
export function MixBar({ shares, className }: { shares: Partial<ReelShares>; className?: string }) {
  const total = CATEGORIES.reduce((a, c) => a + (shares[c] ?? 0), 0)
  return (
    <div className={cn("flex h-1.5 overflow-hidden rounded-full bg-elev", className)}>
      {total > 0 &&
        CATEGORIES.filter((c) => shares[c]).map((c) => (
          <div key={c} className={cn("h-full transition-[width] duration-700", CAT_BG[c])} style={{ width: `${((shares[c] ?? 0) / total) * 100}%` }} />
        ))}
    </div>
  )
}

const stepCaption = (s: ReelStep) => (s.state === "skipped" && s.key === "voice" ? "по тексту" : s.soon ? "скоро" : "")

/** Compact line for a reel row: five bars with captions. */
export function StepBars({ steps }: { steps: ReelStep[] }) {
  return (
    <div className="grid grid-cols-5 gap-1.5">
      {steps.map((s) => {
        const part = s.state === "active" && s.total ? Math.max(0.06, (s.done ?? 0) / s.total) : null
        return (
          <div key={s.key} className="min-w-0" title={stepCaption(s) || undefined}>
            <div className="mb-1 truncate text-[11px]">
              <span
                className={cn(
                  s.state === "done" && "text-foreground-2",
                  s.state === "active" && "font-medium text-pick-text",
                  (s.state === "error" || s.state === "stopped") && (s.state === "error" ? "text-danger" : "text-warn"),
                  (s.state === "todo" || s.state === "queued" || s.state === "skipped") && "text-faint",
                )}
              >
                {s.label}
              </span>
            </div>
            <div className="h-1 overflow-hidden rounded-full bg-elev">
              <div
                className={cn(
                  "h-full rounded-full transition-[width] duration-700",
                  s.state === "done" && "w-full bg-ok/70",
                  s.state === "skipped" && "w-full bg-line-strong",
                  s.state === "active" && "bar-pick",
                  s.state === "error" && "w-full bg-danger/70",
                  s.state === "stopped" && "w-full bg-warn/60",
                  s.soon && "w-full bg-[repeating-linear-gradient(90deg,var(--line-strong)_0_3px,transparent_3px_6px)]",
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

/** Large line for the open reel. */
export function StepSteps({ steps, captions }: { steps: ReelStep[]; captions: Partial<Record<string, string>> }) {
  return (
    <ol className="grid grid-cols-2 gap-3 sm:grid-cols-5">
      {steps.map((s, i) => (
        <li key={s.key} className={cn("flex min-w-0 items-start gap-2.5", s.soon && "opacity-60")}>
          <span
            className={cn(
              "grid size-6 shrink-0 place-items-center rounded-[3px] font-mono text-[11px]",
              s.state === "done" && "bg-ok/15 text-ok",
              s.state === "active" && "animate-pulse-dot bg-pick text-white",
              s.state === "error" && "bg-danger/15 text-danger",
              s.state === "stopped" && "bg-warn-soft text-warn",
              (s.state === "todo" || s.state === "queued" || s.state === "skipped") && "border border-line-strong text-faint",
              s.soon && "border-dashed",
            )}
          >
            {s.state === "done" ? <Check className="size-3.5" /> : s.state === "error" ? <X className="size-3.5" /> : i + 1}
          </span>
          <span className="min-w-0">
            <span
              className={cn(
                "block text-sm first-letter:uppercase",
                s.state === "done" || s.state === "active" ? "font-medium" : "text-muted-foreground",
                s.state === "skipped" && "line-through",
              )}
            >
              {s.label}
            </span>
            {(captions[s.key] || stepCaption(s)) && (
              <span className="block truncate font-mono text-[11px] text-faint">{captions[s.key] || stepCaption(s)}</span>
            )}
          </span>
        </li>
      ))}
    </ol>
  )
}
