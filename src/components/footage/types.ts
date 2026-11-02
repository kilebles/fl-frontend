/** fl-footage (/api/footage/*) — shapes the page works with. Mirrors footage/models.py and manifest.json. */

export type FootageGroup = "archive" | "youtube" | "films" | "stock"
export type ShotType = "location" | "atmosphere" | "artwork" | "artifact" | "archive" | "reenactment" | "portrait" | "ai_video" | "infographic" | "map"
export type ShotStatus = "ok" | "not_found" | "handoff" | "error"
export type FootageStageKey = "plan" | "search" | "extra" | "cut" | "done"
export type StageState = "todo" | "active" | "done" | "error" | "skipped"

export interface FootageStage {
  key: FootageStageKey
  state: StageState
  done?: number
  total?: number
}

export interface Candidate {
  key: string
  group: FootageGroup
  provider: string
  kind: "video" | "image"
  title: string
  page_url: string
  license: string
  author?: string
  score: number
  notes?: string
  /** (start, end) inside a long source, seconds */
  segment?: [number, number] | null
  duration?: number
  /** no confirmed free licence (YouTube «любые», films 1931–1963) */
  risky?: boolean
  /** placeholder tint for the mock preview */
  tint?: number
}

export interface Shot {
  id: string
  paragraph: number
  type: ShotType
  sec: number
  show: string
  status: ShotStatus
  chosen?: Candidate | null
  alternatives: Candidate[]
  message?: string
  /** a person replaced the pick on the page */
  manual?: boolean
}

export interface FootageParagraph {
  number: number
  chapter: string
  duration: number
  duration_source: "audio" | "chars"
  text: string
  shots: Shot[]
}

export interface FootageStats {
  total: number
  ok: number
  video: number
  image: number
  not_found: number
  handoff: number
  error: number
  risky: number
  by_group: Partial<Record<FootageGroup, number>>
}

export interface FootageProject {
  id: string
  title: string
  source: {
    kind: "voice" | "file"
    name: string
    language: string
    tracks: number
  }
  paragraphs: number
  duration_sec: number
  format: "16:9" | "9:16"
  engine: string
  groups: FootageGroup[]
  options: { yt_trusted: boolean; yt_any: boolean; film_risky: boolean }
  min_score: number
  status: "queued" | "running" | "waiting_limit" | "done" | "error" | "stopped"
  step?: string
  error?: string
  created: string
  elapsed_sec?: number
  ai_calls?: number
  stages: FootageStage[]
  stats: FootageStats
}

export interface VoiceSource {
  id: string
  title: string
  language: string
  paragraphs: number
  tracks: number
  chars: number
  duration_sec: number
  created: string
}

export interface SourceStatus {
  group: FootageGroup
  providers: {
    id: string
    name: string
    state: "ok" | "key" | "off" | "limit"
    note?: string
  }[]
}
