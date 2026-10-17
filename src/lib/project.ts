"use client"

import { useSyncExternalStore } from "react"

const KEY = "project"
const listeners = new Set<() => void>()

function read(): string | null {
  try {
    return localStorage.getItem(KEY)
  } catch {
    return null
  }
}

/** The project the screens work in; kept per browser. null = all generations, no project. */
export function useCurrentProject(): [string | null, (id: string | null) => void] {
  const id = useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    read,
    () => null
  )
  const set = (next: string | null) => {
    try {
      if (next) localStorage.setItem(KEY, next)
      else localStorage.removeItem(KEY)
    } catch {}
    listeners.forEach((l) => l())
  }
  return [id, set]
}

/** The current project's style suffix ("" when none): added to every prompt of the project. */
export function withStyle(text: string, style: string | undefined): string {
  const s = style?.trim()
  return s && text ? `${text}, ${s}` : text
}
