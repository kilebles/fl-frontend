"use client"

import { Check, ExternalLink, Search, Sparkles } from "lucide-react"
import { toast } from "sonner"

import { KindBadge, PROVIDER_LABEL, RiskMark, TYPE_LABEL, Thumb, clock, GROUP_COLOR, GROUP_LABEL, scoreColor } from "@/components/footage/parts"
import type { Candidate, Shot } from "@/components/footage/types"
import { BTN_SECONDARY } from "@/components/script/ui"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

/** Where the cut sits inside a long source (YouTube, films, archive video). */
function SegmentLine({ c }: { c: Candidate }) {
  if (!c.segment || !c.duration) return null
  const [a, b] = c.segment
  return (
    <div className="mt-3">
      <div className="relative h-1.5 rounded-full bg-elev">
        <div
          className="absolute inset-y-0 rounded-full bg-pick"
          style={{
            left: `${(a / c.duration) * 100}%`,
            width: `${Math.max(0.8, ((b - a) / c.duration) * 100)}%`,
          }}
        />
      </div>
      <div className="mt-1.5 flex justify-between font-mono text-[11px] text-faint">
        <span>
          отрезок {clock(a)}–{clock(b)}
        </span>
        <span>ролик {clock(c.duration)}</span>
      </div>
    </div>
  )
}

function Source({ c }: { c: Candidate }) {
  return (
    <dl className="mt-4 grid grid-cols-[96px_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-xs">
      <dt className="text-faint">Источник</dt>
      <dd className="flex items-center gap-1.5">
        <span className={cn("size-2 rounded-full", GROUP_COLOR[c.group])} />
        {GROUP_LABEL[c.group]}
        {c.provider !== c.group && ` · ${PROVIDER_LABEL[c.provider] ?? c.provider}`}
      </dd>
      <dt className="text-faint">Название</dt>
      <dd className="truncate" title={c.title}>
        {c.title}
      </dd>
      {c.author && (
        <>
          <dt className="text-faint">Автор</dt>
          <dd>{c.author}</dd>
        </>
      )}
      <dt className="text-faint">Лицензия</dt>
      <dd className={cn(c.risky && "text-warn")}>{c.license}</dd>
      <dt className="text-faint">Оценка ИИ</dt>
      <dd className={cn("font-mono", scoreColor(c.score))}>{c.score.toFixed(1)}</dd>
    </dl>
  )
}

export function ShotDialog({ shot: s, ratio, onClose }: { shot: Shot | null; ratio: "16:9" | "9:16"; onClose: () => void }) {
  const c = s?.chosen
  return (
    <Dialog open={!!s} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] gap-0 overflow-hidden rounded-[4px] border border-line-strong bg-surface p-0 ring-0 sm:max-w-5xl">
        {s && (
          <>
            <div className="border-b border-line px-5 py-3.5 pr-12">
              <DialogTitle className="flex items-baseline gap-2 text-base font-semibold">
                <span className="font-mono">{s.id}</span>
                <span className="font-mono text-xs font-normal text-faint">
                  {TYPE_LABEL[s.type]} · {s.sec.toFixed(1)} с
                </span>
              </DialogTitle>
              <DialogDescription className="mt-1 text-[13px] text-muted-foreground">{s.show}</DialogDescription>
            </div>
            <div className="grid max-h-[calc(90vh-140px)] grid-cols-1 overflow-y-auto md:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
              <div className="border-b border-line p-5 md:border-r md:border-b-0">
                {c ? (
                  <>
                    <Thumb c={c} ratio={ratio} className={ratio === "9:16" ? "mx-auto max-h-[52vh]" : ""}>
                      <span className="absolute bottom-2 left-2 flex gap-1">
                        <KindBadge c={c} sec={s.sec} />
                        {c.risky && <RiskMark />}
                      </span>
                    </Thumb>
                    <SegmentLine c={c} />
                    <Source c={c} />
                    {c.notes && <p className="mt-3 text-xs text-muted-foreground italic">{c.notes}</p>}
                  </>
                ) : (
                  <div
                    className={cn(
                      "grid place-items-center rounded-[3px] border border-dashed border-warn/40 bg-warn-soft/40 text-sm text-warn",
                      ratio === "16:9" ? "aspect-video" : "aspect-[9/16]",
                    )}
                  >
                    <span className="flex flex-col items-center gap-2">
                      <Sparkles className="size-5" />
                      {s.status === "handoff" ? s.message : "Кадр уйдёт на ИИ-генерацию"}
                      {s.message && s.status !== "handoff" && <span className="font-mono text-[11px] opacity-70">{s.message}</span>}
                    </span>
                  </div>
                )}
                <div className="mt-5 flex flex-wrap gap-2">
                  {c && (
                    <a href={c.page_url} target="_blank" rel="noreferrer" className={BTN_SECONDARY}>
                      <ExternalLink className="size-3.5" />
                      Открыть источник
                    </a>
                  )}
                  <button type="button" onClick={() => toast("Макет")} className={BTN_SECONDARY}>
                    <Search className="size-3.5" />
                    Искать ещё
                  </button>
                  {c && (
                    <button type="button" onClick={() => toast("Макет")} className={cn(BTN_SECONDARY, "text-muted-foreground")}>
                      <Sparkles className="size-3.5" />
                      Отдать на ИИ
                    </button>
                  )}
                </div>
              </div>
              <div className="p-5">
                <div className="mb-3 flex items-center justify-between text-[13px] text-muted-foreground">
                  <span>Другие варианты</span>
                  <span className="font-mono text-[11px] text-faint">{s.alternatives.length}</span>
                </div>
                {s.alternatives.length ? (
                  <div className="space-y-2.5">
                    {s.alternatives.map((a) => (
                      <div
                        key={a.key}
                        className="group grid grid-cols-[132px_minmax(0,1fr)] gap-3 rounded-[3px] border border-line p-2 hover:border-line-strong"
                      >
                        <Thumb c={a} ratio="16:9">
                          <span className="absolute bottom-1 left-1">
                            <KindBadge c={a} sec={a.segment ? a.segment[1] - a.segment[0] : s.sec} />
                          </span>
                        </Thumb>
                        <div className="flex min-w-0 flex-col justify-between">
                          <div>
                            <div className="flex items-center gap-1.5 text-xs">
                              <span className={cn("size-1.5 rounded-full", GROUP_COLOR[a.group])} />
                              <span className="truncate text-foreground-2">{PROVIDER_LABEL[a.provider] ?? a.provider}</span>
                              <span className={cn("ml-auto font-mono font-medium", scoreColor(a.score))}>{a.score.toFixed(1)}</span>
                            </div>
                            <p className="mt-1 line-clamp-2 text-xs leading-snug text-muted-foreground">{a.title}</p>
                          </div>
                          <div className="mt-1.5 flex items-center justify-between gap-2">
                            <span className={cn("truncate font-mono text-[10px]", a.risky ? "text-warn" : "text-faint")}>{a.license}</span>
                            <button
                              type="button"
                              onClick={() => toast("Макет: кадр заменится и перережется")}
                              className="flex h-7 shrink-0 items-center gap-1 rounded-[3px] border border-line-strong px-2 text-[11px] font-medium hover:border-pick/50 hover:bg-pick-soft hover:text-pick-text"
                            >
                              <Check className="size-3" />
                              Взять
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="py-6 text-center text-xs text-faint">Других кандидатов выше порога нет</p>
                )}
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
