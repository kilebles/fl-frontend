export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000").replace(/\/$/, "")
const API_TOKEN = process.env.NEXT_PUBLIC_API_TOKEN ?? ""

export type Mode = "t2v" | "flash_t2v" | "img" | "i2v" | "flash_i2v" | "i2i2v" | "f2v"
export type Strategy = "parallel" | "sequential"
export type JobState = "queued" | "running" | "waiting" | "done" | "stopped" | "failed" | "cancelled"

export interface JobRow {
  name: string
  prompt?: string | null
  image_prompt?: string | null
}

export interface JobProgress {
  total: number
  images_done: number
  videos_done: number
  skipped: number
  remaining: number
  pass_num: number
}

export interface JobStatus {
  id: string
  title: string | null
  project_id: string | null
  mode: Mode
  strategy: Strategy
  state: JobState
  progress: JobProgress
  message: string | null
  created_at: string
  started_at: string | null
  finished_at: string | null
}

export interface JobDetail extends JobStatus {
  rows: JobRow[]
  position: number | null
  video_model_key: string | null
  avatar: string | null
  static_image: string | null
}

export interface JobFile {
  name: string
  row: string
  kind: "image" | "video" | "skip"
  size: number
  reason: string | null
  url: string | null
  download_url: string | null
  created_at: string
}

export interface JobRequest {
  mode: Mode
  rows: JobRow[]
  title?: string | null
  project_id?: string | null
  strategy?: Strategy
  avatar?: string | null
  static_image?: string | null
}

export interface Upload {
  key: string
  name: string
  size: number
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

function headers(extra?: HeadersInit): HeadersInit {
  return { ...(API_TOKEN ? { Authorization: `Bearer ${API_TOKEN}` } : {}), ...extra }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${API_URL}${path}`, { ...init, headers: headers(init?.headers) })
  } catch {
    throw new ApiError(0, "Сервер недоступен — запущен ли scripts/serve.py?")
  }
  if (!res.ok) {
    let message = res.statusText
    try {
      const body = await res.json()
      message = typeof body.detail === "string" ? body.detail : (body.detail?.[0]?.msg ?? message)
    } catch {}
    throw new ApiError(res.status, message)
  }
  return res.status === 204 ? (undefined as T) : res.json()
}

function json(method: string, body?: unknown): RequestInit {
  return {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  }
}

export const api = {
  jobs: (projectId?: string | null) => request<JobStatus[]>(`/api/jobs${projectId ? `?project_id=${projectId}` : ""}`),
  job: (id: string) => request<JobDetail>(`/api/jobs/${id}`),
  files: (id: string) => request<JobFile[]>(`/api/jobs/${id}/files`),
  createJob: (body: JobRequest) => request<JobStatus>("/api/jobs", json("POST", body)),
  cancel: (id: string) => request<JobStatus>(`/api/jobs/${id}/cancel`, json("POST")),
  retry: (id: string) => request<JobStatus>(`/api/jobs/${id}/retry`, json("POST")),
  remove: (id: string) => request<void>(`/api/jobs/${id}`, { method: "DELETE" }),
  upload: (file: File) => {
    const form = new FormData()
    form.append("file", file)
    return request<Upload>("/api/uploads", { method: "POST", body: form })
  },
  rowsFromXlsx: (file: File, mode: Mode) => {
    const form = new FormData()
    form.append("file", file)
    form.append("mode", mode)
    return request<{ rows: JobRow[] }>("/api/rows/xlsx", { method: "POST", body: form })
  },
  zipUrl: (id: string, kind?: "video" | "image" | "all") => {
    const params = new URLSearchParams()
    if (kind) params.set("kind", kind)
    if (API_TOKEN) params.set("token", API_TOKEN)
    const qs = params.toString()
    return `${API_URL}/api/jobs/${id}/zip${qs ? `?${qs}` : ""}`
  },
  eventsUrl: () => `${API_URL}/api/events${API_TOKEN ? `?token=${encodeURIComponent(API_TOKEN)}` : ""}`,
}

export const FINISHED: JobState[] = ["done", "stopped", "failed", "cancelled"]
export const isFinished = (state: JobState) => FINISHED.includes(state)

/** A one-prompt generation from the Create page; everything else is a batch. */
export const isSingle = (job: JobStatus) => job.progress.total === 1 && job.mode !== "f2v"

// Prompts

export interface PromptPairSpec {
  number: number
  id: string
  title: string
  intent: string
  frame: string
  people: string
  camera: string
}

export interface PromptTemplateData {
  title: string
  targets: { image: string; video: string }
  sub_periods: { id: string; title: string; when: string }[]
  lore: string
  pairs: PromptPairSpec[]
  color_palette: string
  lighting: string
  textures: string
  image_rules: string
  video_rules: string
  deterministic: { image_suffix: string; video_suffix: string; negatives: string }
}

export interface PromptTemplate {
  id: string
  title: string
  pairs: number
  image_target: string
  video_target: string
  created_at: string
}

export interface PromptTemplateDetail extends PromptTemplate {
  data: PromptTemplateData
}

export type RunState = "queued" | "running" | "done" | "failed"

export interface PromptRun {
  id: string
  project_id: string | null
  template_id: string
  template_title: string
  model: string
  pair_count: number
  scenario_name: string
  state: RunState
  done: number
  total: number
  error: string | null
  created_at: string
  finished_at: string | null
}

export interface GeneratedPair {
  paragraph_number: number
  pair_number: number
  img: string
  vid: string
  stock_queries: string[]
  paragraph_text: string
}

export interface PromptRunDetail extends PromptRun {
  rows: GeneratedPair[]
}

export const prompts = {
  models: () => request<{ id: string; label: string }[]>("/api/prompts/models"),
  templates: () => request<PromptTemplate[]>("/api/prompts/templates"),
  template: (id: string) => request<PromptTemplateDetail>(`/api/prompts/templates/${id}`),
  createTemplate: (file: File) => {
    const form = new FormData()
    form.append("file", file)
    return request<PromptTemplateDetail>("/api/prompts/templates", { method: "POST", body: form })
  },
  renameTemplate: (id: string, title: string) => request<PromptTemplateDetail>(`/api/prompts/templates/${id}`, json("PATCH", { title })),
  removeTemplate: (id: string) => request<void>(`/api/prompts/templates/${id}`, { method: "DELETE" }),
  runs: () => request<PromptRun[]>("/api/prompts/runs"),
  run: (id: string) => request<PromptRunDetail>(`/api/prompts/runs/${id}`),
  createRun: (file: File, templateId: string, model: string, pairCount: number, projectId?: string | null) => {
    const form = new FormData()
    if (projectId) form.append("project_id", projectId)
    form.append("file", file)
    form.append("template_id", templateId)
    form.append("model", model)
    form.append("pair_count", String(pairCount))
    return request<PromptRun>("/api/prompts/runs", { method: "POST", body: form })
  },
  removeRun: (id: string) => request<void>(`/api/prompts/runs/${id}`, { method: "DELETE" }),
  xlsxUrl: (id: string) => `${API_URL}/api/prompts/runs/${id}/xlsx${API_TOKEN ? `?token=${encodeURIComponent(API_TOKEN)}` : ""}`,
}

export const runActive = (run: Pick<PromptRun, "state">) => run.state === "queued" || run.state === "running"

// Infographics

export type InfographicState = "queued" | "searching" | "rendering" | "done" | "failed"

export interface InfographicRun {
  id: string
  project_id: string | null
  scenario_name: string
  categories: string[]
  one_per_person: boolean
  state: InfographicState
  done: number
  total: number
  found: number
  error: string | null
  created_at: string
  finished_at: string | null
}

export interface InfographicCard {
  id: string
  name: string
  years: string
  category: string
  paragraph_number: number
  paragraph: string
  image_url: string | null
  video_url: string | null
  download_url: string | null
}

export interface InfographicRunDetail extends InfographicRun {
  cards: InfographicCard[]
}

export const infographics = {
  categories: () => request<{ id: string; label: string }[]>("/api/infographics/categories"),
  runs: () => request<InfographicRun[]>("/api/infographics/runs"),
  run: (id: string) => request<InfographicRunDetail>(`/api/infographics/runs/${id}`),
  create: (file: File, categories: string[], onePerPerson: boolean, projectId?: string | null) => {
    const form = new FormData()
    if (projectId) form.append("project_id", projectId)
    form.append("file", file)
    form.append("categories", categories.join(","))
    form.append("one_per_person", String(onePerPerson))
    return request<InfographicRun>("/api/infographics/runs", { method: "POST", body: form })
  },
  retry: (id: string) => request<InfographicRun>(`/api/infographics/runs/${id}/retry`, json("POST")),
  remove: (id: string) => request<void>(`/api/infographics/runs/${id}`, { method: "DELETE" }),
  zipUrl: (id: string) => `${API_URL}/api/infographics/runs/${id}/zip${API_TOKEN ? `?token=${encodeURIComponent(API_TOKEN)}` : ""}`,
}

export const infographicActive = (run: Pick<InfographicRun, "state">) => run.state !== "done" && run.state !== "failed"

// Projects and avatars

export interface Project {
  id: string
  title: string
  style: string
  created_at: string
}

export interface Avatar {
  id: string
  name: string
  appearance: string
  image_keys: string[]
  image_urls: string[]
  created_at: string
}

export const projects = {
  list: () => request<Project[]>("/api/projects"),
  create: (title: string) => request<Project>("/api/projects", json("POST", { title })),
  update: (id: string, patch: Partial<Pick<Project, "title" | "style">>) => request<Project>(`/api/projects/${id}`, json("PATCH", patch)),
  remove: (id: string) => request<void>(`/api/projects/${id}`, { method: "DELETE" }),
}

export const avatars = {
  list: () => request<Avatar[]>("/api/avatars"),
  create: (body: { name: string; appearance: string; image_keys: string[] }) => request<Avatar>("/api/avatars", json("POST", body)),
  update: (id: string, patch: Partial<{ name: string; appearance: string; image_keys: string[] }>) => request<Avatar>(`/api/avatars/${id}`, json("PATCH", patch)),
  remove: (id: string) => request<void>(`/api/avatars/${id}`, { method: "DELETE" }),
}

// Voice & Translation API (fl-voice_translator + Fish S2.1 / Drama 3)

export type VoiceJobMode = "all" | "translate" | "voice" | "mix"
export type VoiceModelId = "s2.1" | "drama-3"
export type VoiceJobStatus = "queued" | "running" | "paused_rate_limit" | "stopped" | "done" | "failed"
export type ParagraphFilter = "all" | "off_norm" | "sped_up" | "edited" | "tags"

export interface VoiceEntry {
  id: string
  name: string
  fish_id: string
  langs: string[]
  status: "ok" | "missing" | "unverified"
  checked_at: string | null
  sample_url: string
  used_in: string[]
}

export interface VoiceProfile {
  id: string
  name: string
  channels: string[]
  voices: Record<string, string[]>
  default: Record<string, string>
  norms: Record<string, [number, number]>
}

export interface TranslateStageStatus {
  state: "waiting" | "running" | "done" | "failed" | "skipped" | "voice_missing"
  parts_done: number
  parts_total: number
  length_pct: number | null
  in_norm: number | null
  total: number | null
  tags_issues: number
}

export interface VoiceStageStatus {
  state: "waiting" | "running" | "done" | "failed" | "skipped" | "voice_missing"
  done: number
  total: number
  new: number
  reused: number
  fish_model: "free" | "paid" | "mixed" | "drama"
  voice_id: string | null
  voice_name: string | null
}

export interface MixStageStatus {
  state: "waiting" | "running" | "done" | "failed" | "skipped" | "voice_missing"
  done: number
  total: number
  duration_sec: number | null
  sped_up: number | null
  max_speedup: number | null
}

export interface VoiceJobLanguage {
  lang: string
  stage: "translate" | "voice" | "mix" | "done"
  translate: TranslateStageStatus | null
  voice: VoiceStageStatus
  mix: MixStageStatus | null
}

export interface VoiceJobFile {
  id: string
  kind: "docx" | "raw_zip" | "mixed_zip" | "joined_mp3"
  lang: string
  name: string
  size: number
  url: string
}

export interface VoiceJobSummaryLang {
  length_pct: number | null
  in_norm: number
  total: number
  sped_up: number
  max_speedup: number
  fish_model: string
  voice_model: VoiceModelId
  voice_new: number
  voice_reused: number
  carried: number
}

export interface VoiceJobSummary {
  duration_sec: number | null
  languages: Record<string, VoiceJobSummaryLang>
  norm_suggestions: Record<string, [number, number]>
  skipped: Record<string, { code: string; voice_id: string }>
}

export interface VoiceJob {
  id: number
  title: string
  script: string
  project_id: string | null
  mode: VoiceJobMode
  source_lang: string
  targets: string[]
  profile_id: string
  profile_name: string
  voices: Record<string, string>
  model: string
  voice_model: VoiceModelId
  carry_mood: boolean
  status: VoiceJobStatus
  paragraphs_total: number
  emotion_tags_count: number
  source_duration_sec: number | null
  created_at: string
  started_at: string | null
  finished_at: string | null
  pause_until: string | null
  pause_reason: string | null
  error_code: string | null
  error_message: string | null
  waiting_for_job_id: number | null
  languages: VoiceJobLanguage[]
  summary: VoiceJobSummary | null
  files: VoiceJobFile[]
}

export interface VoiceParagraph {
  n: number
  timecode: string
  source: string
  text: string
  length_pct: number
  norm: [number, number]
  in_norm: boolean
  edited: boolean
  tags_ok: boolean
  tags_problem: "missing" | "translated" | "broken_xml" | null
  carried_mood: string | null
  chars_delta: number
  audio: {
    source_sec: number
    slot_sec: number
    track_sec: number
    speedup: number
  } | null
  audio_url: string | null
  source_audio_url: string | null
  version: number
}

export interface ParagraphLengthResponse {
  length_pct: number
  norm: [number, number]
  in_norm: boolean
  tags_ok: boolean
  tags_problem: "missing" | "translated" | "broken_xml" | null
  chars_delta: number
}

export interface CompareVoiceVariant {
  label: string
  model: string
  audio_url: string | null
  sec: number | null
  error: string | null
}

export interface VoiceScriptInfo {
  script_id: string
  name: string
  title: string
  source_lang: string
  paragraphs_total: number
  words_total: number
  emotion_tags_count: number
  bytes_total: number
  errors: string[]
}

export interface TranslationModelInfo {
  id: string
  label: string
  engine: "agy" | "claude"
  badge: string | null
  description: string
  est_minutes_per_lang: number
}

export interface VoiceModelInfo {
  id: VoiceModelId
  label: string
  description: string
  supports_emotion_tags: boolean
  has_free_tier: boolean
  price_usd_per_million_bytes: number
  regular_price_usd: number | null
  promo_until: string | null
}

export interface VoiceLanguageInfo {
  code: string
  name: string
  native_name: string
  norm: [number, number]
}

export interface VoiceEstimateResponse {
  duration_sec: number
  targets_count: number
  max_fish_cost_usd: number
  voice_model: VoiceModelId
  price_usd_per_million_bytes: number
}

export interface VoiceQueueStatus {
  running: number
  queued: number
  slots: {
    gemini: { used: number; total: number }
    claude: { used: number; total: number }
    voice: { used: number; total: number }
    mix: { used: number; total: number }
  }
}

export function voiceMediaUrl(path: string | null | undefined): string {
  if (!path) return ""
  if (path.startsWith("http://") || path.startsWith("https://")) return path
  const sep = path.includes("?") ? "&" : "?"
  return `${API_URL}${path}${API_TOKEN ? `${sep}token=${encodeURIComponent(API_TOKEN)}` : ""}`
}

export const voice = {
  models: () => request<{ translation_models: TranslationModelInfo[]; voice_models: VoiceModelInfo[] }>("/api/voice/models"),
  languages: (profileId?: string) =>
    request<VoiceLanguageInfo[]>(`/api/voice/languages${profileId ? `?profile_id=${encodeURIComponent(profileId)}` : ""}`),
  scripts: () => request<VoiceScriptInfo[]>("/api/voice/scripts"),
  uploadScript: (file: File, title?: string) => {
    const form = new FormData()
    form.append("file", file)
    if (title) form.append("title", title)
    return request<VoiceScriptInfo>("/api/voice/scripts", { method: "POST", body: form })
  },
  estimate: (body: {
    script_id: string
    mode: VoiceJobMode
    source_lang: string
    targets: string[]
    model: string
    voice_model: VoiceModelId
    split_by_language?: boolean
  }) => request<VoiceEstimateResponse>("/api/voice/estimate", json("POST", body)),
  queue: () => request<VoiceQueueStatus>("/api/voice/queue"),
  jobs: (status?: string, projectId?: string | null) => {
    const q = new URLSearchParams()
    if (status) q.set("status", status)
    if (projectId) q.set("project_id", projectId)
    const qs = q.toString()
    return request<VoiceJob[]>(`/api/voice/jobs${qs ? `?${qs}` : ""}`)
  },
  job: (id: number) => request<VoiceJob>(`/api/voice/jobs/${id}`),
  createJobs: async (body: {
    script_id: string
    title?: string
    project_id?: string | null
    mode: VoiceJobMode
    source_lang: string
    targets: string[]
    profile_id: string
    voices?: Record<string, string>
    model: string
    voice_model: VoiceModelId
    carry_mood: boolean
    split_by_language?: boolean
  }): Promise<VoiceJob[]> => {
    const res = await request<{ jobs: VoiceJob[] } | VoiceJob>("/api/voice/jobs", json("POST", body))
    return "jobs" in res ? res.jobs : [res]
  },
  stopJob: (id: number) => request<VoiceJob>(`/api/voice/jobs/${id}/stop`, json("POST")),
  resumeJob: (id: number) => request<VoiceJob>(`/api/voice/jobs/${id}/resume`, json("POST")),
  /** withFiles: also delete the script with its translations and tracks on the server. */
  deleteJob: (id: number, withFiles = false) =>
    request<void>(`/api/voice/jobs/${id}${withFiles ? "?with_files=true" : ""}`, { method: "DELETE" }),
  revoiceSkipped: (id: number, voices: Record<string, string>) =>
    request<VoiceJob>(`/api/voice/jobs/${id}/revoice-skipped`, json("POST", { voices })),
  paragraphs: (jobId: number, lang: string, filter: ParagraphFilter = "all") =>
    request<VoiceParagraph[]>(`/api/voice/jobs/${jobId}/languages/${lang}/paragraphs?filter=${filter}`),
  peaks: (jobId: number, lang: string) =>
    request<Record<string, number[]>>(`/api/voice/jobs/${jobId}/languages/${lang}/peaks`),
  measureLength: (jobId: number, lang: string, n: number, text: string) =>
    request<ParagraphLengthResponse>(`/api/voice/jobs/${jobId}/languages/${lang}/paragraphs/${n}/length`, json("POST", { text })),
  patchParagraph: (jobId: number, lang: string, n: number, text: string, version: number) =>
    request<VoiceParagraph>(`/api/voice/jobs/${jobId}/languages/${lang}/paragraphs/${n}`, json("PATCH", { text, version })),
  revertParagraph: (jobId: number, lang: string, n: number) =>
    request<VoiceParagraph>(`/api/voice/jobs/${jobId}/languages/${lang}/paragraphs/${n}/revert`, json("POST")),
  retranslateParagraph: (jobId: number, lang: string, n: number) =>
    request<VoiceParagraph>(`/api/voice/jobs/${jobId}/languages/${lang}/paragraphs/${n}/retranslate`, json("POST")),
  revoiceParagraph: (jobId: number, lang: string, n: number) =>
    request<VoiceParagraph>(`/api/voice/jobs/${jobId}/languages/${lang}/paragraphs/${n}/revoice`, json("POST")),
  compareParagraphVoices: (jobId: number, lang: string, n: number) =>
    request<CompareVoiceVariant[]>(`/api/voice/jobs/${jobId}/languages/${lang}/paragraphs/${n}/compare-voices`, json("POST")),
  profiles: () => request<VoiceProfile[]>("/api/voice/profiles"),
  createProfile: (body: { name: string; channels?: string[]; copy_from?: string | null }) =>
    request<VoiceProfile>("/api/voice/profiles", json("POST", body)),
  updateProfile: (
    id: string,
    patch: {
      name?: string
      channels?: string[]
      voices?: Record<string, string[]>
      default?: Record<string, string>
      norms?: Record<string, [number, number]>
    }
  ) => request<VoiceProfile>(`/api/voice/profiles/${id}`, json("PATCH", patch)),
  deleteProfile: (id: string) => request<void>(`/api/voice/profiles/${id}`, { method: "DELETE" }),
  voices: () => request<VoiceEntry[]>("/api/voice/voices"),
  addVoice: (body: { fish_url: string; name: string; langs?: string[] }) =>
    request<VoiceEntry>("/api/voice/voices", json("POST", body)),
  checkVoices: (body?: { profile_id?: string; voice_ids?: string[] }) =>
    request<VoiceEntry[]>("/api/voice/voices/check", json("POST", body ?? {})),
  eventsUrl: (jobId?: number) => {
    const q = new URLSearchParams()
    if (jobId !== undefined) q.set("job_id", String(jobId))
    if (API_TOKEN) q.set("token", API_TOKEN)
    const qs = q.toString()
    return `${API_URL}/api/voice/events${qs ? `?${qs}` : ""}`
  },
  zipAllUrl: (jobId: number) => voiceMediaUrl(`/api/voice/jobs/${jobId}/zip`),
}

/* ------------------------------------------------------------------ scenario (fl-scenario, /api/scenario/*) */

export interface Sourced<T> {
  value: T
  source: string
  source_label: string
}

export interface ScenarioOptions {
  languages: { code: string; name: string }[]
  models: { value: string; word: string; label: string; backend: string; backend_label: string }[]
  tones: { value: string; label: string }[]
  niches: ScenarioNiche[]
  chars_per_minute: Record<string, number>
}

export interface NicheDefaults {
  language?: string
  model?: string
  inputs?: { duration_minutes?: number; target_chars?: number; tone?: string; audience?: string; chars_per_minute?: number }
  [key: string]: unknown
}

export interface ScenarioNiche {
  slug: string
  name: string
  description: string
  notes: number
  videos: number
  has_profile: boolean
  profile_updated: string | null
  defaults: NicheDefaults
  updated: string | null
}

export interface ScenarioVideo {
  id: string
  url: string
  title: string
  channel: string
  duration_sec: number | null
  pace: string
  highlights: string
  analysis: string
}

export interface ScenarioTask {
  id: number
  task: "brief" | "niche_videos" | "niche_passport" | "analytics"
  label: string
  status: string
  params: Record<string, unknown>
  error: string | null
  result: Record<string, unknown> | null
  created: string
  step: string
}

export interface ScenarioNicheDetail extends ScenarioNiche {
  feedback: string
  summary: [string, string][]
  questions: string[]
  profile: string
  note_items: { n: number; time: string; kind: string; text: string }[]
  video_items: ScenarioVideo[]
  manual_defaults: NicheDefaults
  tasks: ScenarioTask[]
  task?: ScenarioTask | null
}

export type StageKey = "brief" | "plan" | "chapters" | "done"
export type StageState = "todo" | "active" | "done" | "error" | "skipped"
export interface ScenarioStage {
  key: StageKey
  state: StageState
  done?: number
  total?: number
}

export type ScenarioStatus =
  | "draft"
  | "ready"
  | "brief_queued"
  | "brief_running"
  | "brief_error"
  | "queued"
  | "running"
  | "waiting_limit"
  | "done"
  | "error"
  | "stopped"
  | "paused"

export interface ScenarioMaterial {
  id: string
  time: string
  kind: string
  name: string
  text: string
}

export interface ScenarioProject {
  id: string
  title: string
  niche: string
  niche_name: string
  created: string
  updated: string
  materials: ScenarioMaterial[]
  ref_urls: string[]
  references: ScenarioVideo[]
  manual: Record<string, unknown>
  model: string
  model_label: string
  params: {
    topic: string
    language: Sourced<string | null>
    language_name: string
    length: Sourced<{ chars: number; minutes: number }>
    tone: Sourced<string | null>
    pace: Sourced<number>
    missing: string[]
  }
  brief: {
    short: string
    full: string
    questions: string[]
    assumptions: string[]
    chapters: { title: string; summary: string; chars: number }[]
    version: number
    time: string | null
  } | null
  answers: Record<string, string>
  task: { id: number; status: string; error: string | null; step: string } | null
  job: {
    id: number
    status: string
    error: string | null
    waiting_until: string | null
    progress: { current: string; done: number; total: number; status: string }
    usage: string | null
    run_sec: number | null
    model: string
    files: { name: string; size: number }[]
  } | null
  stages: ScenarioStage[]
  status: ScenarioStatus
}

export interface ScenarioScript {
  title: string
  language: string
  logline: string
  chapters: { number: number; title: string; paragraphs: { n: number; text: string }[] }[]
}

export interface ScenarioLogEvent {
  ts: string
  kind: string
  message: string
  source: "task" | "job"
}

export interface AnalyticsTopic {
  title: string
  title_translation?: string
  why?: string
  angle?: string
  based_on?: string[]
  fit?: "high" | "medium" | "low" | string
}

export interface AnalyticsItem {
  file: string
  created: string
  niche: string
  insights: string[]
  topics: AnalyticsTopic[]
  videos: number
}

export interface AnalyticsDetail {
  file: string
  created: string
  niche: string
  urls: string[]
  notes: string[]
  insights: string[]
  topics: AnalyticsTopic[]
  videos: { id: string; title: string; views?: number; channel?: string }[]
  channels: unknown[]
  errors: string[]
}

export interface ProjectCreate {
  title?: string
  niche?: string
  materials?: string
  files?: { name: string; text: string }[]
  model?: string
  language?: string
  length?: string
  tone?: string
  topic?: string
  brief?: boolean
  launch_now?: boolean
}

export interface ProjectPatch {
  title?: string
  niche?: string
  model?: string
  manual?: Record<string, string | null>
  answers?: Record<string, string>
  material?: string
  files?: { name: string; text: string }[]
  remove_material?: string
  remove_url?: string
}

const withToken = (path: string) => `${API_URL}${path}${API_TOKEN ? `${path.includes("?") ? "&" : "?"}token=${encodeURIComponent(API_TOKEN)}` : ""}`
const pid = (id: string) => `/api/scenario/projects/${encodeURIComponent(id)}`
const nid = (slug: string) => `/api/scenario/niches/${encodeURIComponent(slug)}`

export const scenario = {
  health: () => request<{ status: string; worker_online: boolean }>("/api/scenario/health"),
  options: () => request<ScenarioOptions>("/api/scenario/options"),
  fileText: (file: File) => {
    const form = new FormData()
    form.append("file", file)
    return request<{ name: string; text: string }>("/api/scenario/files/text", { method: "POST", body: form })
  },

  niches: () => request<ScenarioNiche[]>("/api/scenario/niches"),
  niche: (slug: string) => request<ScenarioNicheDetail>(nid(slug)),
  createNiche: (name: string) => request<ScenarioNicheDetail>("/api/scenario/niches", json("POST", { name })),
  patchNiche: (slug: string, body: { description?: string; defaults?: NicheDefaults; rename?: string }) =>
    request<ScenarioNicheDetail>(nid(slug), json("PATCH", body)),
  addNicheNote: (slug: string, body: { text: string; kind?: string; passport?: boolean }) =>
    request<ScenarioNicheDetail>(`${nid(slug)}/notes`, json("POST", body)),
  deleteNicheNote: (slug: string, n: number) => request<ScenarioNicheDetail>(`${nid(slug)}/notes/${n}`, { method: "DELETE" }),
  removeNicheVideo: (slug: string, videoId: string) =>
    request<ScenarioNicheDetail>(`${nid(slug)}/videos/${encodeURIComponent(videoId)}`, { method: "DELETE" }),
  buildPassport: (slug: string) => request<ScenarioTask>(`${nid(slug)}/passport`, json("POST")),

  projects: () => request<ScenarioProject[]>("/api/scenario/projects"),
  project: (id: string) => request<ScenarioProject>(pid(id)),
  createProject: (body: ProjectCreate) => request<ScenarioProject>("/api/scenario/projects", json("POST", body)),
  patchProject: (id: string, body: ProjectPatch) => request<ScenarioProject>(pid(id), json("PATCH", body)),
  deleteProject: (id: string) => request<void>(pid(id), { method: "DELETE" }),
  brief: (id: string) => request<ScenarioProject>(`${pid(id)}/brief`, json("POST")),
  launch: (id: string) => request<ScenarioProject>(`${pid(id)}/launch`, json("POST")),
  stop: (id: string) => request<ScenarioProject>(`${pid(id)}/stop`, json("POST")),
  resume: (id: string) => request<ScenarioProject>(`${pid(id)}/resume`, json("POST")),
  script: (id: string) => request<ScenarioScript>(`${pid(id)}/script`),
  log: (id: string) => request<ScenarioLogEvent[]>(`${pid(id)}/log`),
  fileUrl: (id: string, name: string) => withToken(`${pid(id)}/files/${encodeURIComponent(name)}`),
  /** The result file itself (for handing the script to «Промпты» / «Озвучка»). */
  file: async (id: string, name: string): Promise<File> => {
    let res: Response
    try {
      res = await fetch(`${API_URL}${pid(id)}/files/${encodeURIComponent(name)}`, { headers: headers() })
    } catch {
      throw new ApiError(0, "Сервер недоступен")
    }
    if (!res.ok) throw new ApiError(res.status, "Файл не найден")
    return new File([await res.blob()], name, { type: res.headers.get("content-type") ?? "" })
  },

  analytics: (niche?: string) => request<{ running: ScenarioTask[]; items: AnalyticsItem[] }>(`/api/scenario/analytics${niche ? `?niche=${encodeURIComponent(niche)}` : ""}`),
  analyticsItem: (file: string) => request<AnalyticsDetail>(`/api/scenario/analytics/${encodeURIComponent(file)}`),
  startAnalytics: (body: { niche?: string; urls?: string[]; notes?: string; previous?: string }) =>
    request<ScenarioTask>("/api/scenario/analytics", json("POST", body)),
  topicToProject: (file: string, index: number) =>
    request<ScenarioProject>(`/api/scenario/analytics/${encodeURIComponent(file)}/topics/${index}/project`, json("POST", {})),
  stopTask: (id: number) => request<{ result: string }>(`/api/scenario/tasks/${id}/stop`, json("POST")),

  eventsUrl: () => withToken("/api/scenario/events"),
}
