"use client"

import { ArrowLeft, Loader2 } from "lucide-react"

import { LaunchPanel } from "@/components/reels/launch-panel"
import { ENGINE_LABEL, clock } from "@/components/reels/parts"
import { useReel, useReelEvents, useReelsHealth } from "@/components/reels/queries"
import { ReelList } from "@/components/reels/reel-list"
import { ReelView } from "@/components/reels/reel-view"
import { setUrlParams, useUrlParam } from "@/components/script/queries"
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
  const { data: reel, isLoading, error } = useReel(id)

  return (
    <div className="px-4 pt-6 pb-24 sm:px-7">
      {id && (
        <button
          type="button"
          onClick={() => setUrlParams({ p: null })}
          className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          Все ролики
        </button>
      )}
      <PageHeader
        title={id ? reel?.title || "Ролик" : "Ролики"}
        subtitle={
          id && reel ? (
            <span className="font-mono text-[13px]">
              {[
                reel.source.kind === "voice" ? `озвучка ${reel.source.language.toUpperCase()}` : reel.source.name,
                `${reel.source.paragraphs} абз.`,
                reel.summary ? clock(reel.summary.total_sec) : "",
                ENGINE_LABEL[reel.settings.engine] || "",
              ]
                .filter(Boolean)
                .join(" · ")}
            </span>
          ) : undefined
        }
        actions={<WorkerBadge />}
      />
      {id ? (
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
        <>
          <LaunchPanel />
          <ReelList onOpen={(rid) => setUrlParams({ p: rid })} />
        </>
      )}
    </div>
  )
}
