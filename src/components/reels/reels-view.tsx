"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { ArrowLeft, Loader2, Plus, RotateCcw } from "lucide-react"
import { toast } from "sonner"

import { clock, spentText, useSpent } from "@/components/reels/parts"
import { rkeys, useReel, useReelEvents, useReelQueue, useReelsHealth } from "@/components/reels/queries"
import { ReelList } from "@/components/reels/reel-list"
import { ReelView } from "@/components/reels/reel-view"
import { ReelWizard } from "@/components/reels/wizard"
import { clearDraft } from "@/components/reels/wizard-draft"
import { setUrlParams, useUrlParam } from "@/components/script/queries"
import { BTN_PRIMARY, BTN_SMALL } from "@/components/script/ui"
import { PageHeader } from "@/components/shell/page-header"
import { reels, type Reel } from "@/lib/api"
import { cn } from "@/lib/utils"

/** Shown only when something is wrong: the API is down or nobody runs the queue. */
function WorkerBadge() {
  const { data, error } = useReelsHealth()
  if (!error && (!data || data.worker_online)) return null
  return (
    <span className="flex items-center gap-1.5 rounded-[3px] border border-warn/40 bg-warn-soft px-2 py-1 text-xs text-warn">
      <span className="size-1.5 rounded-full bg-warn" />
      {error ? "Ролики недоступны" : "Исполнитель не запущен"}
    </span>
  )
}

/** How many reels the brain runs at once (1 / 2 / 3 / 5) and how many are running and waiting. */
function QueueControl() {
  const qc = useQueryClient()
  const { data } = useReelQueue()
  const set = useMutation({
    mutationFn: (n: number) => reels.setParallel(n),
    onSuccess: (q) => qc.setQueryData(rkeys.queue, q),
    onError: (e) => toast.error(e.message),
  })
  if (!data?.limits) return null
  const running = data.counts.running ?? 0
  const queued = data.counts.queued ?? 0
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      {(running > 0 || queued > 0) && (
        <span className="font-mono text-[11px] text-faint">
          {[running ? `в работе ${running}` : "", queued ? `в очереди ${queued}` : ""].filter(Boolean).join(" · ")}
        </span>
      )}
      <span title="Сколько роликов идёт одновременно. Раскадровка и сборка всё равно идут по своим местам: сборка — по одному ролику">
        одновременно
      </span>
      <div className="flex rounded-[3px] bg-surface-2 p-[2px]">
        {(data.parallel_choices ?? [1, 2, 3, 5]).map((n) => (
          <button
            key={n}
            type="button"
            disabled={set.isPending}
            onClick={() => n !== data.limits!.parallel && set.mutate(n)}
            className={cn(
              "h-7 min-w-7 rounded-[2px] px-2 font-mono text-[12px] transition-colors",
              n === data.limits!.parallel ? "bg-pick-soft font-medium text-pick-text" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  )
}

/** «в работе 12:05» while the reel runs, «готов за 2 ч 08 мин» when it is done. */
function SpentBadge({ reel, updatedAt }: { reel: Reel; updatedAt: number }) {
  const t = useSpent(reel.timing, updatedAt)
  if (!t.total) return null
  const text = t.running ? `в работе ${clock(t.total)}` : reel.status === "done" ? `готов за ${spentText(t.total)}` : `в работе было ${spentText(t.total)}`
  return <span className={cn("ml-2 rounded-[3px] px-1.5 py-0.5 text-[12px]", t.running ? "bg-pick-soft text-pick-text" : reel.status === "done" ? "bg-ok/15 text-ok" : "bg-elev text-muted-foreground")}>{text}</span>
}

export function ReelsView() {
  useReelEvents()
  const id = useUrlParam("p")
  const wizard = useUrlParam("new") === "1" && !id
  const { data: reel, isLoading, error, dataUpdatedAt } = useReel(id)

  return (
    <div className="px-4 pt-6 pb-24 sm:px-7">
      {(id || wizard) && (
        <button
          type="button"
          onClick={() => setUrlParams({ p: null, new: null })}
          className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          Все ролики
        </button>
      )}
      <PageHeader
        title={wizard ? "Новый ролик" : id ? reel?.title || "Ролик" : "Ролики"}
        subtitle={
          id && reel ? (
            <span className="font-mono text-[13px]">
              {[
                reel.settings.niche_name || "",
                reel.source.kind === "voice"
                  ? `озвучка ${reel.source.language.toUpperCase()}`
                  : reel.source.kind === "topic"
                    ? "по теме"
                    : reel.source.name,
                reel.source.paragraphs ? `${reel.source.paragraphs} абз.` : "",
                reel.result ? clock(reel.result.sec) : reel.summary ? clock(reel.summary.total_sec) : "",
              ]
                .filter(Boolean)
                .join(" · ")}
              <SpentBadge reel={reel} updatedAt={dataUpdatedAt} />
            </span>
          ) : undefined
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <WorkerBadge />
            {!wizard && !id && <QueueControl />}
            {wizard ? (
              <button
                type="button"
                title="Очистить все шаги"
                onClick={() => {
                  clearDraft()
                  window.location.reload()
                }}
                className={BTN_SMALL}
              >
                <RotateCcw className="size-3.5" />
                Сначала
              </button>
            ) : (
              !id && (
                <button type="button" onClick={() => setUrlParams({ new: "1" })} className={BTN_PRIMARY}>
                  <Plus className="size-3.5" />
                  Новый ролик
                </button>
              )
            )}
          </div>
        }
      />
      {wizard ? (
        <ReelWizard onCreated={(rid) => setUrlParams({ new: null, p: rid })} />
      ) : id ? (
        isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="size-4 animate-spin text-faint" />
          </div>
        ) : error || !reel ? (
          <div className="py-16 text-center text-sm text-faint">{error?.message ?? "Ролик не найден"}</div>
        ) : (
          <ReelView key={reel.id} reel={reel} updatedAt={dataUpdatedAt} />
        )
      ) : (
        <ReelList onOpen={(rid) => setUrlParams({ p: rid })} />
      )}
    </div>
  )
}
