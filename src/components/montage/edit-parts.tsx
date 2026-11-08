"use client"

import { Film, Image as ImageIcon, Mic, Music } from "lucide-react"

import type { EditJob, EditMedia, EditStyle } from "@/lib/api"
import { cn } from "@/lib/utils"

export const MEDIA_ICON = { video: Film, image: ImageIcon, voice: Mic, music: Music } as const

/** The accent of each montage style (the same as the titles in fl-montage renderer/src/montage/Montage.tsx). */
export const EDIT_ACCENT: Record<EditStyle, string> = {
  classic: "#e8d9b5",
  epic: "#d4a94a",
  calm: "#f1e6d0",
  chronicle: "#e9dfc7",
  explainer: "#3d6bff",
  vlog: "#ffd400",
}

const STAGE_TEXT: Record<string, string> = {
  probe: "смотрю файлы",
  plan: "модель составляет план",
  music: "подбираю музыку",
  build: "клипы и звук",
  render: "рендер",
}

/** What the montage is doing now, in plain words. */
export function editStep(j: EditJob): string {
  const p = j.progress
  if (p.wait) return p.wait
  if (p.step) return p.step
  return STAGE_TEXT[p.stage ?? j.stage] ?? "запуск"
}

const SPAN: Record<string, [number, number]> = {
  probe: [0, 0.05],
  plan: [0.05, 0.3],
  music: [0.3, 0.35],
  build: [0.35, 0.6],
  render: [0.6, 1],
}

export function editShare(j: EditJob): number {
  if (j.status === "done") return 1
  const p = j.progress
  const [a, b] = SPAN[p.stage ?? j.stage] ?? [0, 0]
  const part = p.total ? Math.min(1, (p.done ?? 0) / p.total) : 0
  return a + (b - a) * part
}

export function EditProgress({ job }: { job: EditJob }) {
  const active = job.status === "running"
  const v = editShare(job)
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

/** 12.4 → «0:12», 75 → «1:15». */
export const secs = (s?: number | null) => {
  if (s === null || s === undefined) return "—"
  const r = Math.round(s)
  return `${Math.floor(r / 60)}:${String(r % 60).padStart(2, "0")}`
}

/** 3.25 → «3,3 с». */
export const sec1 = (s?: number | null) => (s === null || s === undefined ? "—" : `${s.toFixed(1).replace(".", ",")} с`)

export const mediaMeta = (m: EditMedia) =>
  [m.sec ? sec1(m.sec) : "", m.width && m.height ? `${m.width}×${m.height}` : "", m.kind === "video" && m.audio ? "со звуком" : ""]
    .filter(Boolean)
    .join(" · ")
