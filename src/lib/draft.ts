"use client"

import { useSyncExternalStore } from "react"

import type { AspectRatio, Mode, VideoDuration } from "@/lib/api"

/** The composer's text, mode, duration, and aspect ratio, shared so a feed card can put a prompt back into it. */
interface Draft {
  text: string
  mode: Mode | null
  duration: VideoDuration | null
  aspectRatio: AspectRatio | null
}

let draft: Draft = { text: "", mode: null, duration: null, aspectRatio: null }
const listeners = new Set<() => void>()

export function setDraft(next: Partial<Draft>) {
  draft = { ...draft, ...next }
  listeners.forEach((l) => l())
}

export function useDraft(): Draft {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => draft,
    () => draft
  )
}
