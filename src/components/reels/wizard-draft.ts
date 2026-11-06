"use client"

import type { FootageGroup, ReelShares } from "@/lib/api"
import { PRESETS, STYLES } from "@/components/reels/parts"

/** «Поиск видео» settings of one real category; empty strings — as set on the module's server. */
export type FootageDraft = {
  score: string
  groups: FootageGroup[]
  engine: string
  model: string
  ytFirst: boolean
  ytAny: boolean
  filmRisky: boolean
}

/** The first minutes apart; empty strings — the defaults (shot length from the montage style, any category score). */
export type IntroDraft = {
  on: boolean
  sec: number
  shares: ReelShares
  shot: [string, string]
  minFit: string
}

export type PausesDraft = { mode: "off" | "chapters" | "every" | "auto"; sec: number; everySec: number }
/** The title font of a new reel. */
export const DEFAULT_FONT = "constantia"

export const EMPTY_PAUSES: PausesDraft = { mode: "off", sec: 1.5, everySec: 60 }

export const ALL_GROUPS: FootageGroup[] = ["archive", "youtube", "films", "stock"]
export const EMPTY_FOOTAGE: FootageDraft = { score: "", groups: ALL_GROUPS, engine: "", model: "", ytFirst: false, ytAny: false, filmRisky: false }

/** Everything the six steps of «Новый ролик» collect; kept in the browser so the menu survives a trip to «Аватар». */
export type Draft = {
  step: number
  niche: string
  nicheName: string
  presetFrom: string
  title: string
  script: {
    mode: "topic" | "ready"
    topic: string
    minutes: string
    language: string
    tone: string
    model: string
    notes: string
    from: "voice" | "file"
    voiceJob: string
  }
  /** targets — languages of translation (voice-module codes), voices — a voice per language over the profile default;
   *  model — the translation model of «Озвучка» (empty: its default). */
  voice: { profile: string; name: string; targets: string[]; voices: Record<string, string>; model: string }
  host: { on: boolean; id: string; name: string; voice: string }
  /** pauses: off | chapters (end of each chapter) | every (~every N s, at a fitting place) | auto (the model decides). */
  storyboard: { shares: ReelShares; style: string; notes: string; engine: string; pauses: PausesDraft }
  /** font — the title font; "" — the montage style's font. */
  montage: { style: string; music: string; font: string }
  footage: { video: FootageDraft; history: FootageDraft }
  intro: IntroDraft
  format: "16:9" | "9:16"
}

export const EMPTY: Draft = {
  step: 0,
  niche: "",
  nicheName: "",
  presetFrom: "",
  title: "",
  script: { mode: "topic", topic: "", minutes: "20", language: "en", tone: "", model: "", notes: "", from: "voice", voiceJob: "" },
  voice: { profile: "", name: "", targets: [], voices: {}, model: "" },
  host: { on: false, id: "", name: "", voice: "" },
  storyboard: { shares: PRESETS[0].shares, style: STYLES[0].value, notes: "", engine: "", pauses: EMPTY_PAUSES },
  montage: { style: "classic", music: "chapters", font: DEFAULT_FONT },
  footage: { video: EMPTY_FOOTAGE, history: EMPTY_FOOTAGE },
  intro: { on: false, sec: 120, shares: PRESETS[0].shares, shot: ["", ""], minFit: "" },
  format: "16:9",
}

const KEY = "reels.draft"

export function loadDraft(): Draft {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "null")
    if (!raw || typeof raw !== "object") return EMPTY
    return {
      ...EMPTY,
      ...raw,
      script: { ...EMPTY.script, ...raw.script },
      voice: { ...EMPTY.voice, ...raw.voice },
      host: { ...EMPTY.host, ...raw.host },
      storyboard: {
        ...EMPTY.storyboard,
        ...raw.storyboard,
        shares: { ...EMPTY.storyboard.shares, ...raw.storyboard?.shares },
        pauses: { ...EMPTY_PAUSES, ...raw.storyboard?.pauses },
      },
      montage: { ...EMPTY.montage, ...raw.montage },
      footage: {
        video: { ...EMPTY_FOOTAGE, ...raw.footage?.video },
        history: { ...EMPTY_FOOTAGE, ...raw.footage?.history },
      },
      intro: { ...EMPTY.intro, ...raw.intro, shares: { ...EMPTY.intro.shares, ...raw.intro?.shares } },
    }
  } catch {
    return EMPTY
  }
}

export function saveDraft(d: Draft) {
  try {
    localStorage.setItem(KEY, JSON.stringify(d))
  } catch {}
}

export function clearDraft() {
  try {
    localStorage.removeItem(KEY)
  } catch {}
}
