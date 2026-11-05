const RAW_API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(/\/$/, "")
const API_TOKEN = process.env.NEXT_PUBLIC_API_TOKEN ?? ""

/** Align localhost <-> 127.0.0.1 in the browser so HttpOnly SameSite=Lax cookies work on either loopback host. */
export function apiBase(): string {
  if (!RAW_API_URL || typeof window === "undefined") return RAW_API_URL
  const browserHost = window.location.hostname
  if (browserHost === "localhost" && RAW_API_URL.includes("://127.0.0.1")) {
    return RAW_API_URL.replace("://127.0.0.1", "://localhost")
  }
  if (browserHost === "127.0.0.1" && RAW_API_URL.includes("://localhost")) {
    return RAW_API_URL.replace("://localhost", "://127.0.0.1")
  }
  return RAW_API_URL
}

export const API_URL = RAW_API_URL

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
  constructor(
    public status: number,
    message: string,
    public code?: string,
    public email?: string
  ) {
    super(message)
  }
}

const unauthorizedListeners = new Set<() => void>()

export function onUnauthorized(listener: () => void): () => void {
  unauthorizedListeners.add(listener)
  return () => unauthorizedListeners.delete(listener)
}

function headers(extra?: HeadersInit): HeadersInit {
  return {
    "X-Requested-With": "fl-web",
    ...(API_TOKEN ? { Authorization: `Bearer ${API_TOKEN}` } : {}),
    ...extra,
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${apiBase()}${path}`, {
      ...init,
      credentials: "include",
      headers: headers(init?.headers),
    })
  } catch {
    throw new ApiError(0, "Сервер временно недоступен — пробуем переподключиться")
  }
  if (!res.ok) {
    let message =
      res.status === 502 || res.status === 503 || res.status === 504
        ? "Сервер генерации временно не отвечает — повторите через несколько секунд"
        : res.statusText
    let errCode: string | undefined
    let errEmail: string | undefined
    try {
      const body = await res.json()
      message = typeof body.detail === "string" ? body.detail : (body.detail?.[0]?.msg ?? message)
      if (typeof body.code === "string") errCode = body.code
      if (typeof body.email === "string") errEmail = body.email
    } catch {}
    if (res.status === 401 && !path.startsWith("/api/auth/")) {
      unauthorizedListeners.forEach((fn) => fn())
    }
    throw new ApiError(res.status, message, errCode, errEmail)
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
    return `${apiBase()}/api/jobs/${id}/zip${qs ? `?${qs}` : ""}`
  },
  eventsUrl: () => `${apiBase()}/api/events${API_TOKEN ? `?token=${encodeURIComponent(API_TOKEN)}` : ""}`,
}

// Auth & Account

export interface AuthProviders {
  email: boolean
  google: boolean
  password_reset?: boolean
}

export interface User {
  id: string
  username: string
  email: string
  name: string
  avatar_url: string | null
  avatar_key?: string | null
  role: "user" | "admin"
  email_verified?: boolean
  has_password: boolean
  has_google: boolean
  created_at: string
  current_session_id?: string | null
}

export interface RegisterPending {
  verification_required: true
  email: string
  username: string
}

export interface UserSession {
  id: string
  device: string
  ip_address: string | null
  user_agent: string | null
  created_at: string
  last_seen_at: string
  expires_at: string
  is_current: boolean
}

export interface ApiToken {
  id: string
  name: string
  token_prefix: string
  created_at: string
  last_used_at: string | null
  expires_at: string | null
}

export interface CreatedApiToken extends ApiToken {
  token: string
}

export interface AdminUser {
  id: string
  username: string
  email: string
  name: string
  avatar_url: string | null
  role: "user" | "admin"
  is_active: boolean
  email_verified?: boolean
  has_password: boolean
  has_google: boolean
  active_sessions: number
  created_at: string
}

export const auth = {
  providers: () => request<AuthProviders>("/api/auth/providers"),
  session: () => request<{ user: User | null }>("/api/auth/session"),
  me: () => request<User>("/api/auth/me"),
  register: (body: { username: string; email: string; password: string }) =>
    request<RegisterPending>("/api/auth/register", json("POST", body)),
  login: (body: { login: string; password: string }) =>
    request<User>("/api/auth/login", json("POST", body)),
  logout: () => request<void>("/api/auth/logout", { method: "POST" }),
  updateProfile: (body: {
    username?: string
    avatar_key?: string | null
    clear_avatar?: boolean
  }) => request<User>("/api/auth/me", json("PATCH", body)),
  requestEmailChange: (body: { new_email: string; current_password?: string }) =>
    request<{ ok: boolean; email: string }>("/api/auth/email/change/request", json("POST", body)),
  confirmEmailChange: (code: string) =>
    request<User>("/api/auth/email/change/confirm", json("POST", { code })),
  changePassword: (body: {
    current_password?: string | null
    new_password: string
    revoke_other_sessions?: boolean
  }) => request<{ ok: boolean; revoked_sessions: number }>("/api/auth/password", json("POST", body)),
  sessions: () => request<UserSession[]>("/api/auth/sessions"),
  revokeSession: (id: string) => request<void>(`/api/auth/sessions/${encodeURIComponent(id)}`, { method: "DELETE" }),
  revokeOtherSessions: () => request<{ revoked: number }>("/api/auth/sessions/revoke-others", json("POST")),
  tokens: () => request<ApiToken[]>("/api/auth/tokens"),
  createToken: (body: { name: string; expires_in_days?: number | null }) =>
    request<CreatedApiToken>("/api/auth/tokens", json("POST", body)),
  revokeToken: (id: string) => request<void>(`/api/auth/tokens/${encodeURIComponent(id)}`, { method: "DELETE" }),
  googleStartUrl: (next = "/", intent: "login" | "link" = "login") => {
    const params = new URLSearchParams({ next, intent })
    return `${apiBase()}/api/auth/google/start?${params.toString()}`
  },
  unlinkGoogle: () => request<User>("/api/auth/google", { method: "DELETE" }),
  forgotPassword: (email: string) => request<{ ok: boolean }>("/api/auth/password/forgot", json("POST", { email })),
  resetPassword: (token: string, new_password: string) =>
    request<User>("/api/auth/password/reset", json("POST", { token, new_password })),
  resendVerifyEmail: (email: string) =>
    request<{ ok: boolean }>("/api/auth/email/verify/resend", json("POST", { email })),
  confirmVerifyEmail: (body: { token?: string; email?: string; code?: string }) =>
    request<User>("/api/auth/email/verify/confirm", json("POST", body)),
}

export const admin = {
  users: () => request<AdminUser[]>("/api/admin/users"),
  updateUser: (id: string, body: { role?: "user" | "admin"; is_active?: boolean }) =>
    request<AdminUser>(`/api/admin/users/${encodeURIComponent(id)}`, json("PATCH", body)),
}

export const FINISHED: JobState[] = ["done", "stopped", "failed", "cancelled"]
export const isFinished = (state: JobState) => FINISHED.includes(state)

/** A one-prompt generation from the Create page; everything else is a batch. */
export const isSingle = (job: JobStatus) => job.progress.total === 1 && job.mode !== "f2v"

// Prompts (fl-prompts: /api/prompts/*, Caddy → Windows :8040)

export type PgMode = "regular" | "avatar"
export type PgBase = "template" | "passport"
export type PgStageKey = "brief" | "prompts" | "check" | "done"
export type PgStageState = "todo" | "active" | "done" | "error"
export type PgStatus = "queued" | "running" | "brief_ready" | "done" | "error" | "stopped"

export interface PgStage {
  key: PgStageKey
  state: PgStageState
  done?: number
  total?: number
  flagged?: number
}

export interface PgTemplateInfo {
  kind: PgMode
  name: string
  uploaded: string
  status: "queued" | "running" | "ready" | "error"
  error: string
  warnings: string[]
  shots: string[]
  count_selectable: boolean | null
  targets: { image?: string; video?: string }
  scene_limits: { image?: number; video?: number }
  spoken: { max_chars: number; language: string } | null
}

export interface PgAnalysis {
  kind: PgMode
  shots: { title: string; description: string }[]
  count_selectable: boolean
  image_fixed: string[]
  video_fixed: string[]
  negatives: string[]
  negatives_target: "both" | "image" | "video"
  scene_limits: { image: number; video: number }
  spoken: { max_chars: number; language: string } | null
  rules: { no_dashes: boolean; english_only: boolean }
  image_scene_format: string
  video_scene_format: string
}

export interface PgTemplateFull extends PgTemplateInfo {
  text: string
  analysis: PgAnalysis | null
}

export interface PgNiche {
  slug: string
  name: string
  description: string
  has_passport: boolean
  templates: { regular: PgTemplateInfo | null; avatar: PgTemplateInfo | null }
}

export interface PgModel {
  id: string
  label: string
  word?: string
}

export interface PgOptions {
  backends: { id: string; label: string; enabled: boolean; installed: boolean; info: string; models: PgModel[]; stage_models: Record<string, string> }[]
  default_backend: string
  pair_counts: number[]
  worker_online: boolean
}

export interface PgScript {
  id: string
  title: string
  niche: string
  niche_name: string
  updated: string | null
  language: string
}

export interface PgSummary {
  paragraphs: number
  scenes: number
  with_problems: number
  with_flags: number
  stock_queries: number
}

export interface PgProject {
  id: string
  title: string
  created: string
  updated: string
  project_id: string | null
  niche: string
  niche_name: string
  mode: PgMode
  base: PgBase
  pairs: number
  shots: string[]
  notes: string
  model: string
  review_brief: boolean
  launched: boolean
  script: { source: "project" | "file" | "text"; id?: string; name?: string; title?: string; language?: string; count: number }
  template: { name: string; builtin: boolean }
  status: PgStatus
  stage: "" | "brief" | "prompts" | "export"
  progress: { done: number; total: number; flagged: number }
  error: string
  waiting_until: string | null
  usage: { calls: number; seconds: number; tokens: Record<string, number> }
  summary: PgSummary | null
  stop_requested: boolean
  has_brief: boolean
  stages: PgStage[]
  files: { name: string; size: number }[]
}

export interface PgSubPeriod {
  id: string
  name: string
  when: string
  description: string
  material: string
  palette: string
  lighting: string
  textures: string
}

export interface PgBrief {
  title: string
  era: string
  synopsis: string
  sub_periods: PgSubPeriod[]
  host: { gender: string; clothing: string; voice: string; changes: { from: number; to: number; clothing: string }[] } | null
  characters: { name: string; cue: string; likeness: string }[]
  locations: { id: string; cue: string }[]
  restrictions: { paragraph: number; rule: string }[]
  paragraphs: { n: number; period: string; location: string; beat: string; characters: string[]; stock: string[] }[]
  filled_by_program?: number[]
}

export interface PgRow {
  number: string
  paragraph_n: number
  scene_n: number
  shot: string
  img: string
  vid: string
  scene_img: string
  scene_vid: string
  stock: string[]
  paragraph: string
  problems: string[]
  flags: string[]
}

export interface PgResult {
  rows: PgRow[]
  summary: PgSummary
  brief: PgBrief
  /** true while the project runs: only finished paragraphs so far */
  partial: boolean
}

export interface PgLogItem {
  time: string
  kind: "info" | "warn" | "error" | "done" | "limit"
  text: string
}

export interface PgCreate {
  title?: string
  niche?: string
  mode: PgMode
  base: PgBase
  pairs?: number
  notes?: string
  model?: string
  review_brief?: boolean
  project_id?: string | null
  script: { source: "project"; id: string } | { source: "file"; name: string; paragraphs: string[] }
}

const pgp = (id: string) => `/api/prompts/projects/${encodeURIComponent(id)}`
const pgt = (slug: string, kind: PgMode) => `/api/prompts/niches/${encodeURIComponent(slug)}/templates/${kind}`
const pgToken = (path: string) => `${apiBase()}${path}${API_TOKEN ? `${path.includes("?") ? "&" : "?"}token=${encodeURIComponent(API_TOKEN)}` : ""}`

export const promptgen = {
  health: () => request<{ status: string; worker_online: boolean }>("/api/prompts/health"),
  options: () => request<PgOptions>("/api/prompts/options"),
  niches: () => request<{ niches: PgNiche[]; scenario_online: boolean; error: string }>("/api/prompts/niches"),
  template: (slug: string, kind: PgMode) => request<PgTemplateFull>(pgt(slug, kind)),
  uploadTemplate: (slug: string, kind: PgMode, file: File) => {
    const form = new FormData()
    form.append("file", file)
    return request<PgTemplateInfo>(`${pgt(slug, kind)}/file`, { method: "POST", body: form })
  },
  reanalyze: (slug: string, kind: PgMode) => request<PgTemplateInfo>(`${pgt(slug, kind)}/analyze`, json("POST")),
  removeTemplate: (slug: string, kind: PgMode) => request<void>(pgt(slug, kind), { method: "DELETE" }),
  builtin: (kind: PgMode) => request<{ kind: PgMode; name: string; text: string; analysis: PgAnalysis }>(`/api/prompts/templates/builtin/${kind}`),
  scripts: (niche?: string) => request<PgScript[]>(`/api/prompts/scripts${niche ? `?niche=${encodeURIComponent(niche)}` : ""}`),
  scriptFile: (file: File) => {
    const form = new FormData()
    form.append("file", file)
    return request<{ name: string; count: number; paragraphs: string[]; preview: string[] }>("/api/prompts/files/script", { method: "POST", body: form })
  },
  projects: (projectId?: string | null) =>
    request<PgProject[]>(`/api/prompts/projects${projectId ? `?project_id=${encodeURIComponent(projectId)}` : ""}`),
  project: (id: string) => request<PgProject>(pgp(id)),
  create: (body: PgCreate) => request<PgProject>("/api/prompts/projects", json("POST", body)),
  remove: (id: string) => request<void>(pgp(id), { method: "DELETE" }),
  stop: (id: string) => request<PgProject>(`${pgp(id)}/stop`, json("POST")),
  resume: (id: string) => request<PgProject>(`${pgp(id)}/resume`, json("POST")),
  launch: (id: string) => request<PgProject>(`${pgp(id)}/launch`, json("POST")),
  rebrief: (id: string, notes?: string) => request<PgProject>(`${pgp(id)}/rebrief`, json("POST", notes === undefined ? {} : { notes })),
  brief: (id: string) => request<PgBrief>(`${pgp(id)}/brief`),
  saveBrief: (id: string, brief: PgBrief) => request<PgProject>(`${pgp(id)}/brief`, json("PUT", brief)),
  result: (id: string) => request<PgResult>(`${pgp(id)}/result`),
  log: (id: string) => request<{ items: PgLogItem[]; next: number }>(`${pgp(id)}/log`),
  fileUrl: (id: string, name: string) => pgToken(`${pgp(id)}/files/${encodeURIComponent(name)}`),
  eventsUrl: () => pgToken("/api/prompts/events"),
}

export const pgActive = (p: Pick<PgProject, "status">) => p.status === "queued" || p.status === "running"

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
  zipUrl: (id: string) => `${apiBase()}/api/infographics/runs/${id}/zip${API_TOKEN ? `?token=${encodeURIComponent(API_TOKEN)}` : ""}`,
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
  turbo?: boolean
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
  chars_total?: number
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
  return `${apiBase()}${path}${API_TOKEN ? `${sep}token=${encodeURIComponent(API_TOKEN)}` : ""}`
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
    turbo?: boolean
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
    turbo?: boolean
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
    return `${apiBase()}/api/voice/events${qs ? `?${qs}` : ""}`
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

const withToken = (path: string) => `${apiBase()}${path}${API_TOKEN ? `${path.includes("?") ? "&" : "?"}token=${encodeURIComponent(API_TOKEN)}` : ""}`
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
      res = await fetch(`${apiBase()}${pid(id)}/files/${encodeURIComponent(name)}`, {
        credentials: "include",
        headers: headers(),
      })
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

/* ------------------------------------------------------------------ footage (fl-footage, /api/footage/*) */

export type FootageGroup = "archive" | "youtube" | "films" | "stock"
export type FootageStageKey = "plan" | "search" | "extra" | "cut" | "done"
export type FootageStatus = "queued" | "running" | "done" | "error" | "stopped"

export interface FootageStage {
  key: FootageStageKey
  state: "todo" | "active" | "done" | "error" | "skipped"
  done?: number
  total?: number
}

export interface FootageOptionsSet {
  engine: string
  groups: FootageGroup[]
  yt_first: boolean
  yt_trusted: boolean
  yt_any: boolean
  film_risky: boolean
  min_score: number | null
  format: "16:9" | "9:16"
  plan_only: boolean
}

/** Shots taken from one source group: video/photo split and which sites they came from. */
export interface FootageGroupStat {
  total: number
  video: number
  image: number
  providers: Record<string, number>
}

export interface FootageStats {
  total: number
  ok?: number
  video?: number
  image?: number
  not_found?: number
  handoff?: number
  error?: number
  risky?: number
  by_group?: Partial<Record<FootageGroup, number>>
  groups?: Partial<Record<FootageGroup, FootageGroupStat>>
  ai_usage?: Record<string, { calls?: number; seconds?: number }> | null
  elapsed_sec?: number | null
  timing?: { total_sec: number; phases_sec: Record<string, number>; inside_sec: Record<string, { sec: number; count: number }> } | null
  plan_only?: boolean
}

export interface FootageProject {
  id: string
  title: string
  project: string
  status: FootageStatus
  created: string
  started?: string | null
  finished?: string | null
  source: { kind: "voice" | "file"; name: string; voice_job?: number; language: string; paragraphs: number; tracks: number }
  options: FootageOptionsSet
  step: string | null
  progress: { paragraphs?: number; with_audio?: number; shots?: number; searchable?: number; done?: number; total?: number; counts?: Record<string, number>; plan_failed?: number[]; groups?: Partial<Record<FootageGroup, FootageGroupStat>> }
  stages: FootageStage[]
  stats: FootageStats | null
  error: string | null
  has_result: boolean
  out: string | null
}

export interface FootageOptions {
  engines: { value: string; label: string; hint: string }[]
  groups: { value: FootageGroup; enabled: boolean }[]
  defaults: { engine: string; min_score: number | null; accept_score: number | null; format: "16:9" | "9:16"; batch: number | null }
  routing: Record<string, FootageGroup[]>
  voice_api: boolean
}

export interface FootageSources {
  engines: Record<string, string>
  groups: { group: FootageGroup; enabled: boolean; providers: string[]; skipped: Record<string, string> }[]
  routing: Record<string, FootageGroup[]>
  checked: string
}

export interface VoiceSource {
  id: number
  title: string
  language: string
  paragraphs: number
  duration_sec: number | null
  status: string
  created: string
  mode: string
}

export interface FootageLogEvent {
  ts: string
  event: string
  text?: string
  [k: string]: unknown
}

export interface FootageCreate {
  title: string
  source: "voice" | "file"
  voice_job?: number
  options: Partial<FootageOptionsSet>
}

const fid = (id: string) => `/api/footage/projects/${encodeURIComponent(id)}`

export const footage = {
  health: () => request<{ status: string; worker_online: boolean }>("/api/footage/health"),
  options: () => request<FootageOptions>("/api/footage/options"),
  sources: (fresh = false) => request<FootageSources>(`/api/footage/sources${fresh ? "?fresh=true" : ""}`),
  voiceSources: () => request<VoiceSource[]>("/api/footage/voice-sources"),
  projects: () => request<FootageProject[]>("/api/footage/projects"),
  project: (id: string) => request<FootageProject>(fid(id)),
  create: (body: FootageCreate, script?: File | null, audio?: File | null) => {
    const form = new FormData()
    form.append("data", JSON.stringify(body))
    if (script) form.append("script", script)
    if (audio) form.append("audio", audio)
    return request<FootageProject>("/api/footage/projects", { method: "POST", body: form })
  },
  stop: (id: string) => request<FootageProject>(`${fid(id)}/stop`, json("POST")),
  resume: (id: string) => request<FootageProject>(`${fid(id)}/resume`, json("POST")),
  remove: (id: string) => request<void>(fid(id), { method: "DELETE" }),
  log: (id: string) => request<FootageLogEvent[]>(`${fid(id)}/log`),
  zipUrl: (id: string, kind: "clips" | "files") => withToken(`${fid(id)}/zip/${kind}`),
  eventsUrl: () => withToken("/api/footage/events"),
}

/* ------------------------------------------------------------------ reels (fl-reel, /api/reels/*) */

export type ReelCategory = "ai" | "video" | "history" | "graphics" | "avatar"
export type ReelStatus = "queued" | "running" | "done" | "error" | "stopped"
export type ReelStepKey = "script" | "voice" | "storyboard" | "materials" | "assembly"
export type ReelStepState = "done" | "active" | "queued" | "todo" | "skipped" | "error" | "stopped"
export type ReelShares = Record<ReelCategory, number>

export interface ReelStep {
  key: ReelStepKey
  label: string
  state: ReelStepState
  done?: number
  total?: number
  /** The step exists in the plan but is not built yet. */
  soon?: boolean
}

export interface ReelMix {
  target: ReelShares
  actual: ReelShares
  seconds: ReelShares
  shots: Record<ReelCategory, number>
  total_sec: number
  tolerance: number
  within_tolerance: boolean
  short: ReelCategory[]
  weak: number
}

export interface ReelUsage {
  calls?: number
  cache_hits?: number
  input_tokens?: number
  output_tokens?: number
  seconds?: number
}

export interface Reel {
  id: string
  title: string
  project_id: string | null
  status: ReelStatus
  created: string
  updated: string
  started: string | null
  finished: string | null
  source: { kind: "voice" | "file"; name: string; voice_job?: number; language: string; paragraphs: number; timed: number }
  settings: ReelSettings
  stage: string
  steps: ReelStep[]
  progress: { stage?: string; step?: "brief" | "shots" | "allocate"; done?: number; total?: number; wait?: string }
  summary: { shots: number; total_sec: number; mix: ReelMix; fallback_paragraphs: number[]; errors: string[]; usage: ReelUsage } | null
  error: string | null
  /** Only on GET /api/reels/{id}: the last build of the language tracks. */
  tracks?: ReelTracksStatus
}

export interface ReelTracksStatus {
  state: "none" | "building" | "done" | "error"
  stage?: "download" | "build" | "done"
  langs?: string[]
  base?: string
  done?: number
  total?: number
  files?: { lang: string; name: string; size: number }[]
  missing?: Record<string, number[]>
  host?: number[]
  sec?: number
  zip?: string
  size?: number
  error?: string | null
  finished?: string | null
}

export interface ReelTracksInfo {
  base: string
  /** Languages mixed in «Озвучка» — the tracks are built from them. */
  mixed: string[]
  /** Languages of the reel not mixed yet. */
  pending: string[]
  reason?: string
  status: ReelTracksStatus
}

export interface ReelShot {
  id: string
  paragraph: number
  sec: number
  start: number
  show: string
  fit: Record<ReelCategory, number>
  category: ReelCategory
  type: string
  queries: { stock?: string[]; archive?: string[]; youtube?: string[] }
  ai: string
  card: { subject?: string; kind?: string; caption?: string }
  avoid: string[]
  fallback: boolean
  executor: string
}

export interface ReelParagraph {
  number: number
  text: string
  chapter: string
  duration: number
  duration_source: "audio" | "chars"
  gap: number
  slot: number
}

export interface ReelBrief {
  era?: string
  setting?: string
  look?: string
  people?: { name: string; note?: string }[]
  places?: { name: string; note?: string }[]
  real_material?: string
  rules?: string[]
  chapters?: { title: string; first_paragraph?: number; mood?: string; tempo?: string }[]
  error?: string
}

export interface ReelStoryboard {
  direction?: { style: string; host: boolean; shot_sec: [number, number] }
  brief: ReelBrief
  shots: ReelShot[]
  mix: ReelMix
  paragraphs: ReelParagraph[]
  fallback_paragraphs: number[]
  errors: string[]
  engine?: string
  model?: string
}

/** Settings of a reel — the six steps of the menu. */
export interface ReelSettings {
  niche: string
  niche_name?: string
  script: { mode: "topic" | "ready"; topic?: string; minutes?: number | null; language?: string; tone?: string; model?: string; notes?: string }
  /** targets — languages of translation; voices — a voice per language (empty: the profile's default). */
  voice: { profile?: string; name?: string; targets?: string[]; voices?: Record<string, string> }
  avatar: { id: string; name?: string; voice?: string }
  storyboard: { shares: ReelShares; engine: string; model: string; style: string; notes: string }
  montage: { style: string; music: string }
  format: "16:9" | "9:16"
}

export interface ReelMontageStyle {
  value: string
  label: string
  use: string
  cuts: string
  look: string
  text: string
  shot_sec: [number, number]
}

export interface ReelOptions {
  categories: { value: ReelCategory; label: string; executor: string }[]
  shares: ReelShares
  tolerance: number
  engines: { value: string; label: string; model: string }[]
  defaults: { engine: string }
  shot_sec: [number, number]
  montage: ReelMontageStyle[]
  montage_default: string
  music: { value: string; label: string }[]
}

export interface ReelVoiceSource {
  id: number
  title: string
  language: string
  paragraphs: number
  duration_sec: number | null
  status: string
  created: string
  project_id?: string | null
  /** The base track is mixed: paragraph lengths are final; translations may still be running («сначала база»). */
  base_ready?: boolean
  translating?: boolean
}

export interface ReelCreate extends Omit<ReelSettings, "format"> {
  title?: string
  project_id?: string | null
  source: "voice" | "file"
  voice_job?: number
  format?: "16:9" | "9:16"
}

const rid = (id: string) => `/api/reels/${encodeURIComponent(id)}`

export const reels = {
  health: () => request<{ status: string; worker_online: boolean }>("/api/reels/health"),
  options: () => request<ReelOptions>("/api/reels/options"),
  voiceSources: () => request<ReelVoiceSource[]>("/api/reels/voice-sources"),
  list: () => request<Reel[]>("/api/reels"),
  get: (id: string) => request<Reel>(rid(id)),
  storyboard: (id: string) => request<ReelStoryboard>(`${rid(id)}/storyboard`),
  create: (body: ReelCreate, script?: File | null) => {
    const form = new FormData()
    form.append("data", JSON.stringify(body))
    if (script) form.append("script", script)
    return request<Reel>("/api/reels", { method: "POST", body: form })
  },
  preset: (niche: string) => request<Partial<ReelSettings>>(`/api/reels/presets/${encodeURIComponent(niche)}`),
  shares: (id: string, shares: ReelShares) => request<Reel>(`${rid(id)}/shares`, json("PUT", { shares })),
  rename: (id: string, title: string) => request<Reel>(rid(id), json("PATCH", { title })),
  stop: (id: string) => request<Reel>(`${rid(id)}/stop`, json("POST")),
  resume: (id: string, again = false) => request<Reel>(`${rid(id)}/resume`, json("POST", { again })),
  remove: (id: string) => request<void>(rid(id), { method: "DELETE" }),
  tracks: (id: string) => request<ReelTracksInfo>(`${rid(id)}/tracks`),
  buildTracks: (id: string) => request<ReelTracksStatus>(`${rid(id)}/tracks`, json("POST")),
  tracksZipUrl: (id: string) => withToken(`${rid(id)}/tracks/zip`),
  eventsUrl: () => withToken("/api/reels/events"),
}
