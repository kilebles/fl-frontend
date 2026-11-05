"use client"

import { ArrowLeft, Loader2, Plus, RotateCcw } from "lucide-react"

import { clock } from "@/components/reels/parts"
import { useReel, useReelEvents, useReelsHealth } from "@/components/reels/queries"
import { ReelList } from "@/components/reels/reel-list"
import { ReelView } from "@/components/reels/reel-view"
import { ReelWizard } from "@/components/reels/wizard"
import { clearDraft } from "@/components/reels/wizard-draft"
import { setUrlParams, useUrlParam } from "@/components/script/queries"
import { BTN_PRIMARY, BTN_SMALL } from "@/components/script/ui"
import { PageHeader } from "@/components/shell/page-header"

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

export function ReelsView() {
  useReelEvents()
  const id = useUrlParam("p")
  const wizard = useUrlParam("new") === "1" && !id
  const { data: reel, isLoading, error } = useReel(id)

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
                reel.source.kind === "voice" ? `озвучка ${reel.source.language.toUpperCase()}` : reel.source.name,
                `${reel.source.paragraphs} абз.`,
                reel.summary ? clock(reel.summary.total_sec) : "",
              ]
                .filter(Boolean)
                .join(" · ")}
            </span>
          ) : undefined
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <WorkerBadge />
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
          <ReelView key={reel.id} reel={reel} />
        )
      ) : (
        <ReelList onOpen={(rid) => setUrlParams({ p: rid })} />
      )}
    </div>
  )
}
