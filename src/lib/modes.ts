import {
  Clapperboard,
  Film,
  Image as ImageIcon,
  Link2,
  type LucideIcon,
  Type,
  UserRound,
} from "lucide-react"

import type { Mode } from "@/lib/api"

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
  chain?: boolean
}

export const MODES: ModeMeta[] = [
  {
    id: "t2v",
    title: "Текст → видео",
    short: "T2V",
    description: "Промпт превращается в ролик Veo.",
    steps: [Type, Film],
    icon: Film,
    makesImages: false,
    makesVideos: true,
    needsVideoPrompt: true,
    needsImagePrompt: false,
  },
  {
    id: "flash_t2v",
    title: "Текст → видео",
    short: "Flash T2V",
    description: "Быстрая модель, ролики по 10 секунд.",
    steps: [Type, Film],
    icon: Film,
    flash: true,
    makesImages: false,
    makesVideos: true,
    needsVideoPrompt: true,
    needsImagePrompt: false,
  },
  {
    id: "img",
    title: "Текст → картинка",
    short: "IMG",
    description: "Только картинки, без видео.",
    steps: [Type, ImageIcon],
    icon: ImageIcon,
    makesImages: true,
    makesVideos: false,
    needsVideoPrompt: false,
    needsImagePrompt: true,
  },
  {
    id: "i2v",
    title: "Картинка → видео",
    short: "I2V",
    description: "Сначала кадр по промпту, затем ролик из него. Можно одну картинку на все видео.",
    steps: [Type, ImageIcon, Film],
    icon: Film,
    makesImages: true,
    makesVideos: true,
    needsVideoPrompt: true,
    needsImagePrompt: true,
    staticImage: true,
  },
  {
    id: "flash_i2v",
    title: "Картинка → видео",
    short: "Flash I2V",
    description: "Кадр по промпту и быстрый ролик на 10 секунд.",
    steps: [Type, ImageIcon, Film],
    icon: Film,
    flash: true,
    makesImages: true,
    makesVideos: true,
    needsVideoPrompt: true,
    needsImagePrompt: true,
  },
  {
    id: "i2i2v",
    title: "Аватар → видео",
    short: "I2I2V",
    description: "Один персонаж во всех кадрах: аватар задаёт внешность.",
    steps: [UserRound, ImageIcon, Film],
    icon: Film,
    makesImages: true,
    makesVideos: true,
    needsVideoPrompt: true,
    needsImagePrompt: true,
    avatar: true,
  },
  {
    id: "f2v",
    title: "Цепочка клипов",
    short: "F2V",
    description: "Каждый клип продолжает последний кадр предыдущего — сплошная история.",
    steps: [Film, Link2, Clapperboard],
    icon: Clapperboard,
    makesImages: false,
    makesVideos: true,
    needsVideoPrompt: true,
    needsImagePrompt: false,
    chain: true,
  },
]

export const MODE_BY_ID = Object.fromEntries(MODES.map((m) => [m.id, m])) as Record<Mode, ModeMeta>

export function modeLabel(mode: Mode): string {
  const meta = MODE_BY_ID[mode]
  return meta.flash ? `${meta.title} · Flash` : meta.title
}
