import type { JobProgress, JobState, JobStatus } from "@/lib/api"

export const STATE_LABEL: Record<JobState, string> = {
  queued: "В очереди",
  running: "Генерация",
  waiting: "Ждёт квоту",
  done: "Готово",
  stopped: "Остановлена",
  failed: "Ошибка",
  cancelled: "Отменена",
}

/** Text color class of a state; the dot and badge tint follow currentColor. */
export const STATE_TONE: Record<JobState, string> = {
  queued: "text-muted-foreground",
  running: "text-electric",
  waiting: "text-warn",
  done: "text-ok",
  stopped: "text-warn",
  failed: "text-danger",
  cancelled: "text-faint",
}

export function percent(p: JobProgress): number {
  if (!p.total) return 0
  return Math.round(((p.total - p.remaining) / p.total) * 100)
}

export function jobTitle(job: Pick<JobStatus, "title" | "id">): string {
  return job.title?.trim() || `Задача ${job.id.slice(0, 6)}`
}

const rtf = new Intl.RelativeTimeFormat("ru", { numeric: "auto" })

export function timeAgo(iso: string, now = Date.now()): string {
  const seconds = Math.round((new Date(iso).getTime() - now) / 1000)
  const abs = Math.abs(seconds)
  if (abs < 45) return "только что"
  if (abs < 3600) return rtf.format(Math.round(seconds / 60), "minute")
  if (abs < 86400) return rtf.format(Math.round(seconds / 3600), "hour")
  return rtf.format(Math.round(seconds / 86400), "day")
}

export function bytes(n: number): string {
  if (n < 1024) return `${n} Б`
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(0)} КБ`
  return `${(n / 1024 ** 2).toFixed(1)} МБ`
}

export function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return one
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few
  return many
}
