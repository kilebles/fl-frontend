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
