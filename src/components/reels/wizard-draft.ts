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
  /** targets — languages of translation (voice-module codes), voices — a voice per language over the profile default. */
  voice: { profile: string; name: string; targets: string[]; voices: Record<string, string> }
  host: { on: boolean; id: string; name: string; voice: string }
  storyboard: { shares: ReelShares; style: string; notes: string; engine: string }
  montage: { style: string; music: string }
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
  voice: { profile: "", name: "", targets: [], voices: {} },
  host: { on: false, id: "", name: "", voice: "" },
  storyboard: { shares: PRESETS[0].shares, style: STYLES[0].value, notes: "", engine: "" },
  montage: { style: "classic", music: "chapters" },
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
      storyboard: { ...EMPTY.storyboard, ...raw.storyboard, shares: { ...EMPTY.storyboard.shares, ...raw.storyboard?.shares } },
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
