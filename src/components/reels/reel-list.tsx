"use client"

import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { Loader2, Mic, Paperclip, Trash2 } from "lucide-react"

import { MixBar, StepBars, clock, shotsText, spentText, useSpent } from "@/components/reels/parts"
import { rkeys, useReels } from "@/components/reels/queries"
import { ConfirmDialog, useNow } from "@/components/script/parts"
import { reels, type Reel } from "@/lib/api"
import { timeAgo } from "@/lib/format"
import { useCurrentProject } from "@/lib/project"

const STEP_TEXT: Record<string, string> = { brief: "бриф фильма", shots: "кадры", allocate: "доли" }

/** What the reel does now, one short line. */
export function statusText(r: Reel): string {
  const pr = r.progress
  if (r.status === "queued") return "в очереди"
  if (pr.wait) return pr.wait
  if (pr.stage === "script") return pr.total ? `сценарий пишется · ${pr.done ?? 0} из ${pr.total}` : "сценарий пишется"
  if (pr.stage === "voice")
    return pr.step === "mix" ? "сводится базовая дорожка" : pr.total ? `озвучка базы · ${pr.done ?? 0} из ${pr.total}` : "озвучка базы"
  if (pr.stage === "materials") return pr.total ? `материалы · ${pr.done ?? 0} из ${pr.total} кадров` : "заказы модулям"
  if (pr.stage === "assembly") {
    const what: Record<string, string> = { host: "голос ведущего", clips: "клипы", voice: "дорожки языков", render: "рендер", package: "монтажный проект" }
    const part = what[pr.step ?? ""] ?? "сборка"
    return pr.step === "render" ? `${part} · ${pr.done ?? 0}%` : pr.total && pr.step === "clips" ? `${part} · ${pr.done ?? 0} из ${pr.total}` : part
  }
  const step = pr.step ? STEP_TEXT[pr.step] ?? pr.step : "запуск"
  return pr.step === "shots" && pr.total ? `${step} · пачка ${pr.done ?? 0} из ${pr.total}` : step
}

function StatusCell({ r, updatedAt }: { r: Reel; updatedAt: number }) {
  const s = r.summary
  const t = useSpent(r.timing, updatedAt)
  if (r.status === "done" && r.result)
    return (
      <span className="flex flex-col gap-1.5">
        <span>
          <span className="font-medium text-ok">Готов</span>
          <span className="text-faint">
            {" "}
            · {clock(r.result.sec)}
            {t.total ? ` · за ${spentText(t.total)}` : ""}
          </span>
        </span>
        {s && <MixBar shares={r.materials?.mix && Object.keys(r.materials.mix).length ? r.materials.mix : s.mix.actual} />}
      </span>
    )
  if (r.status === "done" && s)
    return (
      <span className="flex flex-col gap-1.5">
        <span>
          <span className="font-medium text-ok">Раскадровка</span>
          <span className="text-faint">
            {" "}
            · {shotsText(s.shots)} · {clock(s.total_sec)}
          </span>
        </span>
        <MixBar shares={s.mix.actual} />
      </span>
    )
  if (r.status === "error") return <span className="line-clamp-2 text-danger">{r.error || "Ошибка"}</span>
  if (r.status === "stopped") return <span className="text-warn">Остановлен</span>
  return (
    <span className="flex min-w-0 flex-col gap-0.5">
      <span className={r.progress.wait ? "line-clamp-2 text-warn" : r.status === "queued" ? "text-muted-foreground" : "truncate text-pick-text"}>{statusText(r)}</span>
      {t.running && <span className="font-mono text-[11px] text-faint">в работе {clock(t.total)}</span>}
    </span>
  )
}

function Row({ r, now, updatedAt, onOpen, onDelete }: { r: Reel; now: number | null; updatedAt: number; onOpen: () => void; onDelete: () => void }) {
  const meta = [
    `${r.source.paragraphs} абз.`,
    r.source.timed ? "по озвучке" : "по тексту",
    r.settings.niche_name || "",
    now !== null ? timeAgo(r.created, now) : "",
  ].filter(Boolean)
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter") onOpen()
      }}
      className="group grid cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-center gap-x-6 gap-y-2 border-b border-line px-4 py-3.5 transition-colors last:border-b-0 hover:bg-surface-2/60 sm:grid-cols-[minmax(0,1fr)_minmax(0,400px)_minmax(0,200px)_40px]"
    >
      <div className="min-w-0">
        <div className="truncate text-sm font-medium">{r.title}</div>
        <div className="mt-0.5 flex min-w-0 items-center gap-1.5 font-mono text-[11px] text-faint">
          {r.source.kind === "voice" ? <Mic className="size-3 shrink-0" /> : <Paperclip className="size-3 shrink-0" />}
          <span className="truncate">{meta.join(" · ")}</span>
        </div>
      </div>
      <div className="order-last col-span-2 min-w-0 sm:order-none sm:col-span-1">
        <StepBars steps={r.steps} />
      </div>
      <div className="hidden min-w-0 text-xs sm:block">
        <StatusCell r={r} updatedAt={updatedAt} />
      </div>
      <div className="flex items-center justify-end" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
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

export function ReelList({ onOpen }: { onOpen: (id: string) => void }) {
  const qc = useQueryClient()
  const [projectId] = useCurrentProject()
  const { data, isLoading, error, dataUpdatedAt } = useReels()
  const now = useNow()
  const [del, setDel] = useState<Reel | null>(null)
  if (isLoading)
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="size-4 animate-spin text-faint" />
      </div>
    )
  if (error) return <div className="py-10 text-center text-sm text-danger">{error.message}</div>
  const list = (data ?? []).filter((r) => !projectId || r.project_id === projectId)
  if (!list.length) return <div className="py-10 text-center text-sm text-faint">Роликов пока нет</div>
  return (
    <>
      <div className="overflow-hidden rounded-[4px] border border-line bg-surface">
        {list.map((r) => (
          <Row key={r.id} r={r} now={now} updatedAt={dataUpdatedAt} onOpen={() => onOpen(r.id)} onDelete={() => setDel(r)} />
        ))}
      </div>
      <ConfirmDialog
        open={del !== null}
        title={`Удалить «${del?.title || "ролик"}»?`}
        text={del?.status === "running" ? "Ролик в работе — сначала останови его." : "Ролик и его раскадровка будут удалены."}
        onClose={() => setDel(null)}
        onConfirm={async () => {
          await reels.remove(del!.id)
          qc.invalidateQueries({ queryKey: rkeys.list })
        }}
      />
    </>
  )
}
