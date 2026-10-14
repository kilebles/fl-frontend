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
  jobs: () => request<JobStatus[]>("/api/jobs"),
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
  createRun: (file: File, templateId: string, model: string, pairCount: number) => {
    const form = new FormData()
    form.append("file", file)
    form.append("template_id", templateId)
    form.append("model", model)
    form.append("pair_count", String(pairCount))
    return request<PromptRun>("/api/prompts/runs", { method: "POST", body: form })
  },
  removeRun: (id: string) => request<void>(`/api/prompts/runs/${id}`, { method: "DELETE" }),
  xlsxUrl: (id: string) => `${API_URL}/api/prompts/runs/${id}/xlsx`,
}

export const runActive = (run: Pick<PromptRun, "state">) => run.state === "queued" || run.state === "running"
