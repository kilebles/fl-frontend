import {
  ArrowRightLeft,
  Clapperboard,
  Film,
  Image as ImageIcon,
  Link2,
  type LucideIcon,
  Type,
  UserRound,
} from "lucide-react"

import type { AspectRatio, JobStatus, Mode, VideoDuration } from "@/lib/api"

export interface ModeMeta {
  id: Mode
  title: string
  short: string
  description: string
  /** Steps of the pipeline, drawn on the card. */
  steps: LucideIcon[]
  /** What the mode produces, for lists. */
  icon: LucideIcon
  flash?: boolean
  makesImages: boolean
  makesVideos: boolean
  needsVideoPrompt: boolean
  needsImagePrompt: boolean
  avatar?: boolean
  staticImage?: boolean
  endImage?: boolean
  requiresFrames?: boolean
  chain?: boolean
  durations: readonly VideoDuration[]
  defaultDuration: VideoDuration | null
  aspectRatios: readonly AspectRatio[]
  defaultAspectRatio: AspectRatio
}

export const MODES: ModeMeta[] = [
  {
    id: "t2v",
    title: "Текст → видео",
    short: "T2V",
    description: "Veo 3.1 · 4, 6 или 8 с",
    steps: [Type, Film],
    icon: Film,
    makesImages: false,
    makesVideos: true,
    needsVideoPrompt: true,
    needsImagePrompt: false,
    durations: [4, 6, 8],
    defaultDuration: 8,
    aspectRatios: ["16:9", "9:16"],
    defaultAspectRatio: "16:9",
  },
  {
    id: "flash_t2v",
    title: "Текст → видео",
    short: "Flash T2V",
    description: "Быстрая модель · 4–10 с",
    steps: [Type, Film],
    icon: Film,
    flash: true,
    makesImages: false,
    makesVideos: true,
    needsVideoPrompt: true,
    needsImagePrompt: false,
    durations: [4, 6, 8, 10],
    defaultDuration: 10,
    aspectRatios: ["16:9", "9:16"],
    defaultAspectRatio: "16:9",
  },
  {
    id: "img",
    title: "Текст → картинка",
    short: "IMG",
    description: "Без видео · 16:9, 9:16, 1:1",
    steps: [Type, ImageIcon],
    icon: ImageIcon,
    makesImages: true,
    makesVideos: false,
    needsVideoPrompt: false,
    needsImagePrompt: true,
    durations: [],
    defaultDuration: null,
    aspectRatios: ["16:9", "9:16", "1:1"],
    defaultAspectRatio: "16:9",
  },
  {
    id: "i2v",
    title: "Картинка → видео",
    short: "I2V",
    description: "Кадр, затем ролик · 4, 6 или 8 с",
    steps: [Type, ImageIcon, Film],
    icon: Film,
    makesImages: true,
    makesVideos: true,
    needsVideoPrompt: true,
    needsImagePrompt: true,
    staticImage: true,
    endImage: true,
    durations: [4, 6, 8],
    defaultDuration: 8,
    aspectRatios: ["16:9", "9:16"],
    defaultAspectRatio: "16:9",
  },
  {
    id: "fl2v",
    title: "Кадр А → Кадр Б",
    short: "FL2V",
    description: "Переход / облёт по 2 кадрам · 4, 6 или 8 с",
    steps: [ImageIcon, ArrowRightLeft, Film],
    icon: ArrowRightLeft,
    makesImages: false,
    makesVideos: true,
    needsVideoPrompt: true,
    needsImagePrompt: false,
    staticImage: true,
    endImage: true,
    requiresFrames: true,
    durations: [4, 6, 8],
    defaultDuration: 8,
    aspectRatios: ["16:9", "9:16"],
    defaultAspectRatio: "16:9",
  },
  {
    id: "flash_i2v",
    title: "Картинка → видео",
    short: "Flash I2V",
    description: "Быстрая модель · 4–10 с",
    steps: [Type, ImageIcon, Film],
    icon: Film,
    flash: true,
    makesImages: true,
    makesVideos: true,
    needsVideoPrompt: true,
    needsImagePrompt: true,
    durations: [4, 6, 8, 10],
    defaultDuration: 10,
    aspectRatios: ["16:9", "9:16"],
    defaultAspectRatio: "16:9",
  },
  {
    id: "i2i2v",
    title: "Аватар → видео",
    short: "I2I2V",
    description: "Один персонаж во всех кадрах · 4–8 с",
    steps: [UserRound, ImageIcon, Film],
    icon: Film,
    makesImages: true,
    makesVideos: true,
    needsVideoPrompt: true,
    needsImagePrompt: true,
    avatar: true,
    durations: [4, 6, 8],
    defaultDuration: 8,
    aspectRatios: ["16:9", "9:16"],
    defaultAspectRatio: "16:9",
  },
  {
    id: "f2v",
    title: "Цепочка клипов",
    short: "F2V",
    description: "Клип продолжает предыдущий · 4–10 с",
    steps: [Film, Link2, Clapperboard],
    icon: Clapperboard,
    makesImages: false,
    makesVideos: true,
    needsVideoPrompt: true,
    needsImagePrompt: false,
    chain: true,
    durations: [4, 6, 8, 10],
    defaultDuration: 8,
    aspectRatios: ["16:9", "9:16"],
    defaultAspectRatio: "16:9",
  },
]

export const MODE_BY_ID = Object.fromEntries(MODES.map((m) => [m.id, m])) as Record<Mode, ModeMeta>

export function modeLabel(mode: Mode): string {
  const meta = MODE_BY_ID[mode]
  return meta.flash ? `${meta.title} · Flash` : meta.title
}

export function resolveDuration(mode: ModeMeta, current: number | null | undefined): VideoDuration | null {
  if (!mode.durations.length) return null
  if (current && (mode.durations as readonly number[]).includes(current)) {
    return current as VideoDuration
  }
  return mode.defaultDuration
}

export function resolveAspectRatio(mode: ModeMeta, current: string | null | undefined): AspectRatio {
  if (current && (mode.aspectRatios as readonly string[]).includes(current)) {
    return current as AspectRatio
  }
  return mode.defaultAspectRatio
}

export function jobFormatBadge(job: Pick<JobStatus, "mode" | "duration" | "aspect_ratio">): string {
  const meta = MODE_BY_ID[job.mode]
  const ratio = job.aspect_ratio || meta.defaultAspectRatio
  const dur = meta.makesVideos ? (job.duration ?? meta.defaultDuration) : null
  return dur ? `${dur} с · ${ratio}` : ratio
}
