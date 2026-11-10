"use client"

import { ArrowLeft, Clapperboard, Loader2, Shapes } from "lucide-react"

import { EditLaunch } from "@/components/montage/edit-launch"
import { EditList } from "@/components/montage/edit-list"
import { secs } from "@/components/montage/edit-parts"
import { EditView } from "@/components/montage/edit-view"
import { JobList } from "@/components/montage/job-list"
import { JobView } from "@/components/montage/job-view"
import { LaunchPanel } from "@/components/montage/launch"
import { useEditJob, useInfoJob, useMontageEvents, useMontageHealth, useMontageOptions } from "@/components/montage/queries"
import { setUrlParams, useUrlParam } from "@/components/script/queries"
import { ScreenSwitch } from "@/components/script/ui"
import { PageHeader } from "@/components/shell/page-header"

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
  const eid = useUrlParam("e")
  // «Монтаж» по описанию — по умолчанию; «Инфографика» — ?tab=infographics (старые ссылки ?j= тоже туда).
  const screen = tab === "infographics" || (jid && !eid) ? "infographics" : "montage"
  const open = screen === "infographics" && jid
  const openEdit = screen === "montage" && eid
  const { data: job, isLoading, error } = useInfoJob(open ? jid : null)
  const { data: edit, isLoading: editLoading, error: editError } = useEditJob(openEdit ? eid : null)
  const s = job?.settings
  const es = edit?.settings
  const { data: options } = useMontageOptions()
  /** «Хроника · Королевская»; the palette only when the module sends palettes and the job has one. */
  const look = s
    ? [
        options?.styles.find((x) => x.value === s.style)?.label ?? s.style,
        s.palette && s.palette !== "default" && options?.palettes?.length
          ? (options.palettes.find((p) => p.value === s.palette)?.label ?? s.palette)
          : "",
      ]
        .filter(Boolean)
        .join(" · ")
    : ""

  return (
    <div className="px-4 pt-6 pb-24 sm:px-7">
      {(open || openEdit) && (
        <button
          type="button"
          onClick={() => setUrlParams({ j: null, e: null })}
          className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          {open ? "Вся инфографика" : "Все монтажи"}
        </button>
      )}
      <PageHeader
        title={open ? job?.title || "Инфографика" : openEdit ? edit?.title || "Монтаж" : "Монтаж"}
        subtitle={
          openEdit && es ? (
            <span className="font-mono text-[13px]">
              {[
                es.format,
                es.quality === "2160" ? "4K" : `${es.quality}p`,
                edit.result ? secs(edit.result.sec) : es.duration ? `${es.duration} с` : "",
                `${edit.media.filter((m) => m.kind === "video" || m.kind === "image").length} файл.`,
              ]
                .filter(Boolean)
                .join(" · ")}
            </span>
          ) : open && s ? (
            <span className="font-mono text-[13px]">
              {[
                job.source.kind === "orders" ? `из «Роликов» · ${job.source.orders} кадр.` : job.source.name || `текст · ${job.source.chars?.toLocaleString("ru")} симв.`,
                s.kind === "animated" ? "видео" : "картинки",
                s.format,
                s.quality === "2160" ? "4K" : `${s.quality}p`,
                look,
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
              onChange={(v) => setUrlParams({ tab: v === "infographics" ? "infographics" : null, j: null, e: null })}
              options={[
                ["montage", "Монтаж", Clapperboard],
                ["infographics", "Инфографика", Shapes],
              ]}
            />
          </div>
        }
      />
      {screen === "montage" && <EditLaunch hidden={!!openEdit} />}
      {screen === "montage" ? (
        openEdit ? (
          editLoading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="size-4 animate-spin text-faint" />
            </div>
          ) : editError || !edit ? (
            <div className="py-16 text-center text-sm text-faint">{editError?.message ?? "Монтаж не найден"}</div>
          ) : (
            <EditView key={edit.id} job={edit} />
          )
        ) : (
          <EditList onOpen={(id) => setUrlParams({ e: id })} />
        )
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
