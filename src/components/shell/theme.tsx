"use client"

import { useSyncExternalStore } from "react"

import { THEME_KEY as KEY } from "@/lib/theme-script"

export type Theme = "dark" | "claude"

function current(): Theme {
  return document.documentElement.dataset.theme === "claude" ? "claude" : "dark"
}

const listeners = new Set<() => void>()

export function setTheme(theme: Theme) {
  const root = document.documentElement
  if (theme === "claude") {
    root.dataset.theme = "claude"
    root.classList.remove("dark")
  } else {
    delete root.dataset.theme
    root.classList.add("dark")
  }
  try {
    localStorage.setItem(KEY, theme)
  } catch {}
  listeners.forEach((l) => l())
}

export function useTheme(): Theme {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    current,
    () => "dark"
  )
}
