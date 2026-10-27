"use client"

import { useEffect, useState } from "react"
import { Download, Loader2, Trash2 } from "lucide-react"

import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { type VoiceJob, type VoiceJobLanguage, voice } from "@/lib/api"
import { timeAgo } from "@/lib/format"
import { cn } from "@/lib/utils"

const MODE_LABEL: Record<string, string> = {
  translate: "только перевод",
  voice: "только озвучка",
  mix: "только сведение",
}

function formatDuration(sec: number | null | undefined): string {
  if (!sec || sec <= 0) return ""
  const total = Math.round(sec)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = (total % 60).toString().padStart(2, "0")
  return h ? `${h}:${m.toString().padStart(2, "0")}:${s}` : `${m}:${s}`
}

function stageFraction(stage: { state: string; done?: number; total?: number } | null): number | null {
  if (!stage || stage.state === "skipped") return null
  if (stage.state === "done") return 1
  if (stage.total) return Math.min(1, (stage.done ?? 0) / stage.total)
  return 0
}

/** Share of the whole job that is done: every stage of every language weighs the same. */
export function jobProgress(job: VoiceJob): number {
  const parts: number[] = []
  for (const l of job.languages) {
    const t = l.translate
    const tr = t ? stageFraction({ state: t.state, done: t.parts_done, total: t.parts_total }) : null
    for (const f of [tr, stageFraction(l.voice), stageFraction(l.mix)]) if (f !== null) parts.push(f)
  }
  if (!parts.length) return job.status === "done" ? 1 : 0
  return parts.reduce((a, b) => a + b, 0) / parts.length
}

function langsIn(job: VoiceJob, pick: (l: VoiceJobLanguage) => boolean): string[] {
  return job.languages.filter(pick).map((l) => l.lang)
}

/** What the job is doing right now, in a few words. */
function currentStep(job: VoiceJob): string {
  if (job.status === "queued") return job.waiting_for_job_id ? `ждёт #${job.waiting_for_job_id}` : "в очереди"
  if (job.status === "paused_rate_limit") {
    const until = job.pause_until ? new Date(job.pause_until) : null
    return until ? `пауза до ${until.toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" })}` : "пауза"
  }
  const translating = langsIn(job, (l) => l.translate?.state === "running")
  if (translating.length) return `перевод · ${translating.join(", ")}`
  const voicing = job.languages.find((l) => l.voice.state === "running")
  if (voicing) return `озвучка ${voicing.lang} · ${voicing.voice.done}/${voicing.voice.total}`
  const mixing = job.languages.find((l) => l.mix?.state === "running")
  if (mixing) return "сведение"
  return "в работе"
}

function doneFacts(job: VoiceJob): { facts: string[]; warning: string | null } {
  const langs = Object.values(job.summary?.languages ?? {})
  const total = langs.reduce((a, l) => a + (l.total || 0), 0)
  const inNorm = langs.reduce((a, l) => a + (l.in_norm || 0), 0)
  const facts = [
    formatDuration(job.summary?.duration_sec ?? job.source_duration_sec),
    `${job.targets.length} яз.`,
    total ? `в норме ${Math.round((inNorm / total) * 100)}%` : "",
  ].filter(Boolean)
  const skipped = Object.keys(job.summary?.skipped ?? {})
  return { facts, warning: skipped.length ? `без озвучки: ${skipped.join(", ")}` : null }
}

function useNow(everyMs = 30_000): number | null {
  const [now, setNow] = useState<number | null>(null)
  useEffect(() => {
    const first = setTimeout(() => setNow(Date.now()), 0)
    const t = setInterval(() => setNow(Date.now()), everyMs)
    return () => {
      clearTimeout(first)
      clearInterval(t)
    }
  }, [everyMs])
  return now
}

function ProjectRow({
  job,
  now,
  onOpen,
  onDelete,
}: {
  job: VoiceJob
  now: number | null
  onOpen: () => void
  onDelete: () => void
}) {
  const active = job.status === "running" || job.status === "queued" || job.status === "paused_rate_limit"
  const pct = Math.round(jobProgress(job) * 100)
  const { facts, warning } = job.status === "done" ? doneFacts(job) : { facts: [], warning: null }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter") onOpen()
      }}
      className="group grid cursor-pointer grid-cols-[minmax(0,1fr)_64px] items-center gap-x-6 gap-y-2 border-b border-line px-4 py-3.5 transition-colors last:border-b-0 hover:bg-surface-2/60 sm:grid-cols-[minmax(0,1fr)_minmax(0,340px)_64px]"
    >
      <div className="min-w-0">
        <div className="truncate text-sm font-medium text-foreground">{job.title}</div>
        <div className="mt-0.5 truncate font-mono text-[11px] text-faint">
          {job.source_lang} → {job.targets.join(" ") || "—"}
          {MODE_LABEL[job.mode] ? ` · ${MODE_LABEL[job.mode]}` : ""}
          {now !== null ? ` · ${timeAgo(job.created_at, now)}` : ""}
        </div>
      </div>

      <div className="order-last col-span-2 min-w-0 sm:order-none sm:col-span-1">
        {active ? (
          <div>
            <div className="mb-1.5 flex items-baseline justify-between gap-3 text-xs">
              <span className="truncate text-muted-foreground">{currentStep(job)}</span>
              <span className="font-mono text-[11px] text-foreground-2">{pct}%</span>
            </div>
            <div className="h-1 overflow-hidden rounded-full bg-elev">
              <div
                className={cn("h-full rounded-full transition-[width] duration-700", job.status === "running" ? "bar-running" : "bg-faint")}
                style={{ width: `${Math.max(pct, job.status === "running" ? 3 : 0)}%` }}
              />
            </div>
          </div>
        ) : job.status === "done" ? (
          <div className="flex min-w-0 items-baseline gap-2 text-xs">
            <span className="font-medium text-ok">Готов</span>
            <span className="truncate font-mono text-[11px] text-muted-foreground">{facts.join(" · ")}</span>
            {warning && <span className="truncate text-[11px] text-warn">{warning}</span>}
          </div>
        ) : (
          <div className="flex min-w-0 items-baseline gap-2 text-xs">
            <span className={cn("font-medium", job.status === "failed" ? "text-danger" : "text-warn")}>
              {job.status === "failed" ? "Ошибка" : "Остановлен"}
            </span>
            {job.error_message && <span className="truncate text-muted-foreground">{job.error_message}</span>}
          </div>
        )}
      </div>

      <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
        {job.status === "done" && (
          <a
            href={voice.zipAllUrl(job.id)}
            download
            title="Скачать всё"
            className="grid size-7 place-items-center rounded-[3px] text-muted-foreground transition-colors hover:bg-elev hover:text-foreground"
          >
            <Download className="size-3.5" />
          </a>
        )}
        <button
          type="button"
          title="Удалить"
          onClick={onDelete}
          className="grid size-7 place-items-center rounded-[3px] text-faint transition hover:bg-danger/15 hover:text-danger focus-visible:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>
    </div>
  )
}

export function ProjectList({
  jobs,
  onOpen,
  onDelete,
}: {
  jobs: VoiceJob[]
  onOpen: (id: number) => void
  onDelete: (job: VoiceJob) => void
}) {
  const now = useNow()
  if (!jobs.length) {
    return <div className="py-10 text-center text-sm text-faint">Проектов пока нет</div>
  }
  return (
    <div className="overflow-hidden rounded-[4px] border border-line bg-surface">
      {jobs.map((j) => (
        <ProjectRow key={j.id} job={j} now={now} onOpen={() => onOpen(j.id)} onDelete={() => onDelete(j)} />
      ))}
    </div>
  )
}

export function DeleteProjectDialog({
  job,
  onClose,
  onDeleted,
}: {
  job: VoiceJob | null
  onClose: () => void
  onDeleted: (job: VoiceJob) => void
}) {
  const [busy, setBusy] = useState(false)
  return (
    <Dialog open={job !== null} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent showCloseButton={false} className="gap-0 rounded-[4px] border border-line-strong bg-surface p-0 ring-0 sm:max-w-md">
        {job && <DeleteBody key={job.id} job={job} onBusy={setBusy} onClose={onClose} onDeleted={onDeleted} />}
      </DialogContent>
    </Dialog>
  )
}

function DeleteBody({
  job,
  onBusy,
  onClose,
  onDeleted,
}: {
  job: VoiceJob
  onBusy: (busy: boolean) => void
  onClose: () => void
  onDeleted: (job: VoiceJob) => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const confirm = async () => {
    setBusy(true)
    onBusy(true)
    setError(null)
    try {
      await voice.deleteJob(job.id, true)
      onBusy(false)
      onDeleted(job)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось удалить")
      setBusy(false)
      onBusy(false)
    }
  }

  return (
    <>
      <div className="p-5">
        <DialogTitle className="text-base font-semibold">Удалить «{job.title}»?</DialogTitle>
        <DialogDescription className="mt-2 text-sm leading-relaxed">
          Сценарий, переводы и все дорожки удалятся с сервера. Вернуть их будет нельзя.
          {job.status === "running" ? " Задача сейчас в работе — она остановится." : ""}
        </DialogDescription>
        {error && <p className="mt-3 text-sm text-danger">{error}</p>}
      </div>
      <div className="flex justify-end gap-2 border-t border-line bg-surface-2/60 px-5 py-3">
        <button
          type="button"
          disabled={busy}
          onClick={onClose}
          className="h-8 rounded-[3px] border border-line-strong bg-surface px-3 text-[13px] font-medium text-foreground hover:bg-elev disabled:opacity-50"
        >
          Отмена
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={confirm}
          className="flex h-8 items-center gap-1.5 rounded-[3px] bg-danger px-3 text-[13px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {busy && <Loader2 className="size-3.5 animate-spin" />}
          Удалить
        </button>
      </div>
    </>
  )
}
