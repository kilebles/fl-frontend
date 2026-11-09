"use client"

import { useReelOptions, useReelVoiceSources } from "@/components/reels/queries"
import { DEFAULT_TEXT, type AiMode, type Draft, type TextDraft } from "@/components/reels/wizard-draft"
import { useScenarioOptions } from "@/components/script/queries"
import { Label, Pick, Seg } from "@/components/script/ui"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import type { ReelSettings } from "@/lib/api"

type Up = (fn: (d: Draft) => Draft) => void

const AI_MODES: { value: AiMode; label: string }[] = [
  { value: "i2v", label: "Картинка → видео" },
  { value: "flash_i2v", label: "Картинка → видео (flash)" },
]

const code = (c: string | null | undefined) => (c ?? "").trim().toUpperCase().replace("-", "_")

function Tip({ text }: { text: string }) {
  return (
    <Tooltip>
      <TooltipTrigger render={<span />} className="inline-grid size-4 cursor-help place-items-center rounded-full border border-line-strong font-mono text-[10px] text-faint hover:text-foreground">
        ?
      </TooltipTrigger>
      <TooltipContent className="max-w-72 leading-snug">{text}</TooltipContent>
    </Tooltip>
  )
}

/** The reel's base language: the «Озвучка» project's for a ready voiceover, otherwise the script's. */
function useBaseLang(d: Draft) {
  const fromVoice = d.script.mode === "ready" && d.script.from === "voice"
  const { data: voices } = useReelVoiceSources(fromVoice)
  if (fromVoice) return code(voices?.find((v) => String(v.id) === d.script.voiceJob)?.language)
  return code(d.script.language)
}

/** Chapter titles by default — as the montage style has them. */
function useStyleTitles(style: string) {
  const { data: options } = useReelOptions()
  const s = options?.montage.find((m) => m.value === style)
  return { label: s?.label ?? "", on: s?.titles !== false }
}

/** Text and AI model of a niche preset (the niche's last reel); older presets: the defaults. */
export function textFromPreset(p: Partial<ReelSettings>): Pick<Draft, "text" | "ai"> {
  return { text: { ...DEFAULT_TEXT, ...(p.text ?? {}) }, ai: { mode: p.ai?.mode === "flash_i2v" ? "flash_i2v" : "i2v" } }
}

/** «Надписи: EN, цифры и даты, главы · ИИ-кадры flash» — for the summary and the reel screen. */
export function textLine(t: Partial<TextDraft> | undefined, ai: string | undefined, base: string, titles: boolean) {
  const words = [`надписи ${t?.lang || base || "как у ролика"}`, t?.numbers === false ? "" : "цифры и даты", (t?.chapters ?? titles) ? "главы" : "без глав"]
  return [words.filter(Boolean).join(", "), ai === "flash_i2v" ? "ИИ-кадры flash" : ""].filter(Boolean).join(" · ")
}

export function TextSummary({ d }: { d: Draft }) {
  const base = useBaseLang(d)
  const titles = useStyleTitles(d.montage.style)
  return <span className="text-foreground-2">{textLine(d.text, d.ai.mode, base, titles.on)}</span>
}

/** «Модель ИИ-кадров»: Veo image → video or its flash variant; the host keeps its own model. */
export function AiModePick({ d, up }: { d: Draft; up: Up }) {
  const { data: options } = useReelOptions()
  const modes = options?.ai_modes?.length ? options.ai_modes : AI_MODES
  return (
    <div>
      <Label aside={d.host.on ? <span className="font-mono text-[11px] text-faint">ведущий — своей моделью</span> : undefined}>Модель ИИ-кадров</Label>
      <Seg value={d.ai.mode} onChange={(v) => up((x) => ({ ...x, ai: { mode: v as AiMode } }))} options={modes.map((m) => [m.value, m.label] as const)} />
    </div>
  )
}

/** «Надписи в кадре»: one language for infographics, numbers and dates and chapter titles; numbers and dates on/off. */
export function TextPick({ d, up }: { d: Draft; up: Up }) {
  const { data: so } = useScenarioOptions()
  const base = useBaseLang(d)
  const t = d.text
  const set = (patch: Partial<TextDraft>) => up((x) => ({ ...x, text: { ...x.text, ...patch } }))
  const names = new Map((so?.languages ?? []).map((l) => [code(l.code), l.name]))
  const own = [...new Set([base, ...d.voice.targets.map(code), code(t.lang)].filter(Boolean))]
  const options = [
    { value: "", label: "Как у ролика", hint: base || "язык сценария" },
    ...own.map((c) => ({ value: c, label: names.get(c) ?? c, hint: c === base ? `${c} · основной` : d.voice.targets.map(code).includes(c) ? `${c} · перевод` : c })),
    ...[...names.keys()].filter((c) => !own.includes(c)).map((c) => ({ value: c, label: names.get(c)!, hint: c })),
  ]
  return (
    <div>
      <Label aside={<span className="font-mono text-[11px] text-faint">инфографика, цифры, главы</span>}>Язык надписей</Label>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
        <Pick value={code(t.lang)} onChange={(v) => set({ lang: v })} options={options} />
        <label className="flex cursor-pointer items-center gap-2.5 text-sm">
          <input type="checkbox" checked={t.numbers} onChange={(e) => set({ numbers: e.target.checked })} className="size-4 accent-[var(--pick)]" />
          <span className={t.numbers ? "font-medium text-foreground" : "text-muted-foreground"}>Цифры и даты</span>
          <Tip text="Ключевые цифры и даты из озвучки — текстом в кадре, выборочно: мозг решает, какие и как показать (внизу, по центру или в углу)." />
        </label>
      </div>
    </div>
  )
}

/** «Надписи глав» under the pauses: the chapter title on screen at its start; null in the draft — as the montage style. */
export function ChapterTitlesCheck({ d, up }: { d: Draft; up: Up }) {
  const style = useStyleTitles(d.montage.style)
  const on = d.text.chapters ?? style.on
  const set = (v: boolean) => up((x) => ({ ...x, text: { ...x.text, chapters: v === style.on ? null : v } }))
  return (
    <label className="mt-3 flex cursor-pointer items-center gap-2.5 text-sm">
      <input type="checkbox" checked={on} onChange={(e) => set(e.target.checked)} className="size-4 accent-[var(--pick)]" />
      <span className={on ? "font-medium text-foreground" : "text-muted-foreground"}>Надписи глав</span>
      <Tip text="Название главы на экране в её начале — на языке надписей." />
      {d.text.chapters === null && style.label && <span className="font-mono text-[11px] text-faint">как в стиле «{style.label}»</span>}
    </label>
  )
}
