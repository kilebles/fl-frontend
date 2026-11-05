"use client"

import type { ReelShares } from "@/lib/api"
import { PRESETS, STYLES } from "@/components/reels/parts"

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
