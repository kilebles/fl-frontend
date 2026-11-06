"use client"

import { ArrowLeft, Clapperboard, Loader2, Shapes } from "lucide-react"

import { JobList } from "@/components/montage/job-list"
import { JobView } from "@/components/montage/job-view"
import { LaunchPanel } from "@/components/montage/launch"
import { useInfoJob, useMontageEvents, useMontageHealth } from "@/components/montage/queries"
import { setUrlParams, useUrlParam } from "@/components/script/queries"
import { ScreenSwitch } from "@/components/script/ui"
import { DevBadge, PageHeader } from "@/components/shell/page-header"

/** Shown only when something is wrong: the API is down, nobody runs the queue or Remotion is missing. */
function WorkerBadge() {
  const { data, error } = useMontageHealth()
  if (!error && (!data || (data.worker_online && data.renderer))) return null
  return (
    <span
      title={data?.renderer_note || undefined}
      className="flex items-center gap-1.5 rounded-[3px] border border-warn/40 bg-warn-soft px-2 py-1 text-xs text-warn"
    >
      <span className="size-1.5 rounded-full bg-warn" />
      {error ? "Монтаж недоступен" : !data?.worker_online ? "Исполнитель не запущен" : "Remotion не установлен"}
    </span>
  )
}

export function MontageView() {
  useMontageEvents()
  const tab = useUrlParam("tab")
  const jid = useUrlParam("j")
  // «Монтаж» по описанию — следующий шаг; пока вкладка открывается на «Инфографике».
  const screen = tab === "montage" ? "montage" : "infographics"
  const open = screen === "infographics" && jid
  const { data: job, isLoading, error } = useInfoJob(open ? jid : null)
  const s = job?.settings

  return (
    <div className="px-4 pt-6 pb-24 sm:px-7">
      {open && (
        <button
          type="button"
          onClick={() => setUrlParams({ j: null })}
          className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          Вся инфографика
        </button>
      )}
      <PageHeader
        title={open ? job?.title || "Инфографика" : "Монтаж"}
        subtitle={
          open && s ? (
            <span className="font-mono text-[13px]">
              {[
                job.source.kind === "orders" ? `из «Роликов» · ${job.source.orders} кадр.` : job.source.name || `текст · ${job.source.chars?.toLocaleString("ru")} симв.`,
                s.kind === "animated" ? "видео" : "картинки",
                s.format,
                s.quality === "2160" ? "4K" : `${s.quality}p`,
              ]
                .filter(Boolean)
                .join(" · ")}
            </span>
          ) : undefined
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <WorkerBadge />
            <ScreenSwitch
              value={screen}
              onChange={(v) => setUrlParams({ tab: v === "montage" ? "montage" : null, j: null })}
              options={[
                ["montage", "Монтаж", Clapperboard],
                ["infographics", "Инфографика", Shapes],
              ]}
            />
          </div>
        }
      />
      {screen === "montage" ? (
        <div className="rounded-[4px] border border-dashed border-line-strong p-10 text-center text-sm text-muted-foreground">
          <div className="mb-3 flex justify-center">
            <DevBadge />
          </div>
          Монтаж по описанию: загрузка видео, картинок, озвучки и музыки, параметры и описание.
        </div>
      ) : open ? (
        isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="size-4 animate-spin text-faint" />
          </div>
        ) : error || !job ? (
          <div className="py-16 text-center text-sm text-faint">{error?.message ?? "Задача не найдена"}</div>
        ) : (
          <JobView key={job.id} job={job} />
        )
      ) : (
        <>
          <LaunchPanel />
          <JobList onOpen={(id) => setUrlParams({ j: id })} />
        </>
      )}
    </div>
  )
}
