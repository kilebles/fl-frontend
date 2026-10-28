"use client"

import { useEffect, useState } from "react"
import { Loader2, Paperclip } from "lucide-react"
import { toast } from "sonner"

import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { scenario, type ScenarioProject } from "@/lib/api"
import { cn } from "@/lib/utils"

export const num = (n: number | null | undefined) => (n ? Math.round(n).toLocaleString("ru") : "0")

/** Minutes → «30 мин», «1 ч 10 мин». */
export function minutes(m: number) {
  const v = Math.round(m)
  return v >= 90 ? `${Math.floor(v / 60)} ч ${v % 60} мин` : `${v} мин`
}

export function lengthText(p: ScenarioProject) {
  const l = p.params.length.value
  return l.chars ? `${minutes(l.minutes)} ≈ ${num(l.chars)} симв.` : "длительность не задана"
}

const JOB_STEP: [RegExp, (m: RegExpMatchArray) => string][] = [
  [/^outline$/, () => "план"],
  [/^script_fix$/, () => "дописывает главы"],
  [/^script_(\d+)$/, (m) => `сценарий · запрос ${Number(m[1])}`],
  [/^chapter_(\d+)$/, (m) => `глава ${Number(m[1])}`],
  [/^polish_(\d+)$/, (m) => `чистка · глава ${Number(m[1])}`],
  [/^factcheck_(\d+)$/, (m) => `фактчек · глава ${Number(m[1])}`],
  [/^revise_(\d+)$/, (m) => `правка · глава ${Number(m[1])}`],
  [/^assemble$/, () => "сборка файлов"],
]

/** What the project is doing right now, in a few words. */
export function stepText(p: ScenarioProject): string {
  const j = p.job
  if (j) {
    if (j.status === "queued") return "в очереди"
    if (j.status === "waiting_limit") {
      const t = j.waiting_until ? new Date(j.waiting_until) : null
      return t && !Number.isNaN(t.getTime()) ? `лимит · до ${t.toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" })}` : "ждёт лимит"
    }
    const cur = j.progress?.current ?? ""
    for (const [re, f] of JOB_STEP) {
      const m = cur.match(re)
      if (m) return f(m)
    }
    return "пишет"
  }
  if (p.task?.status === "queued") return "бриф в очереди"
  return p.task?.step ? p.task.step.toLowerCase() : "бриф"
}

export function useNow(everyMs = 30_000): number | null {
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

/** .txt/.md/.docx → text through the API (docx is read on the server). */
export function AttachButton({ onText, className, label = ".txt .md .docx" }: { onText: (f: { name: string; text: string }) => void; className?: string; label?: string }) {
  const [busy, setBusy] = useState(false)
  const take = async (files: FileList | null) => {
    if (!files?.length) return
    setBusy(true)
    try {
      for (const f of Array.from(files)) onText(await scenario.fileText(f))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Не удалось прочитать файл")
    } finally {
      setBusy(false)
    }
  }
  return (
    <label
      className={cn(
        "flex cursor-pointer items-center gap-1.5 rounded-[2px] px-1.5 py-1 text-xs text-muted-foreground hover:bg-elev hover:text-foreground",
        className
      )}
    >
      {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Paperclip className="size-3.5" />}
      {label}
      <input
        type="file"
        className="hidden"
        multiple
        accept=".txt,.md,.docx"
        onChange={(e) => {
          void take(e.target.files)
          e.target.value = ""
        }}
      />
    </label>
  )
}

/** Long text (full brief, passport, video analysis) in a dialog. */
export function TextDialog({ title, text, onClose }: { title: string; text: string | null; onClose: () => void }) {
  return (
    <Dialog open={text !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] gap-0 overflow-hidden rounded-[4px] border border-line-strong bg-surface p-0 ring-0 sm:max-w-3xl">
        <div className="border-b border-line px-5 py-3.5">
          <DialogTitle className="text-base font-semibold">{title}</DialogTitle>
        </div>
        <DialogDescription render={<div />} className="max-h-[70vh] overflow-y-auto px-5 py-4 text-sm leading-relaxed whitespace-pre-wrap text-foreground-2">
          {text}
        </DialogDescription>
      </DialogContent>
    </Dialog>
  )
}

export function ConfirmDialog({
  open,
  title,
  text,
  action = "Удалить",
  onConfirm,
  onClose,
}: {
  open: boolean
  title: string
  text: string
  action?: string
  onConfirm: () => Promise<void>
  onClose: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  return (
    <Dialog open={open} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent showCloseButton={false} className="gap-0 rounded-[4px] border border-line-strong bg-surface p-0 ring-0 sm:max-w-md">
        <div className="p-5">
          <DialogTitle className="text-base font-semibold">{title}</DialogTitle>
          <DialogDescription className="mt-2 text-sm leading-relaxed">{text}</DialogDescription>
          {error && <p className="mt-3 text-sm text-danger">{error}</p>}
        </div>
        <div className="flex justify-end gap-2 border-t border-line bg-surface-2/60 px-5 py-3">
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="h-8 rounded-[3px] border border-line-strong bg-surface px-3 text-[13px] font-medium hover:bg-elev disabled:opacity-50"
          >
            Отмена
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true)
              setError(null)
              try {
                await onConfirm()
                onClose()
              } catch (e) {
                setError(e instanceof Error ? e.message : "Не получилось")
              } finally {
                setBusy(false)
              }
            }}
            className="flex h-8 items-center gap-1.5 rounded-[3px] bg-danger px-3 text-[13px] font-medium text-white hover:opacity-90 disabled:opacity-60"
          >
            {busy && <Loader2 className="size-3.5 animate-spin" />}
            {action}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
