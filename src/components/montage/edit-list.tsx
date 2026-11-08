"use client"

import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { Clapperboard, Download, Loader2, Trash2 } from "lucide-react"

import { EditProgress, editStep, secs } from "@/components/montage/edit-parts"
import { mkeys, useEditJobs } from "@/components/montage/queries"
import { ConfirmDialog, useNow } from "@/components/script/parts"
import { edits, type EditJob } from "@/lib/api"
import { timeAgo } from "@/lib/format"
import { useCurrentProject } from "@/lib/project"

function Thumb({ j }: { j: EditJob }) {
  const portrait = j.settings.format === "9:16"
  const pic = j.result?.poster ?? j.media.find((m) => m.thumb)?.thumb
  return (
    <div className="grid h-12 w-[72px] shrink-0 place-items-center overflow-hidden rounded-[3px] border border-line bg-background">
      {pic ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={edits.fileUrl(j.id, pic)} alt="" className={portrait ? "h-full w-auto object-cover" : "size-full object-cover"} />
      ) : (
        <Clapperboard className="size-4 text-faint" />
      )}
    </div>
  )
}

function StatusCell({ j }: { j: EditJob }) {
  if (j.status === "done") return <span className="font-medium text-ok">Готово · {secs(j.result?.sec)}</span>
  if (j.status === "error") return <span className="line-clamp-2 text-danger">{j.error || "Ошибка"}</span>
  if (j.status === "stopped") return <span className="text-warn">Остановлен</span>
  if (j.status === "queued") return <span className="text-muted-foreground">в очереди</span>
  return <span className="truncate text-pick-text">{editStep(j)}</span>
}

export function EditList({ onOpen }: { onOpen: (id: string) => void }) {
  const qc = useQueryClient()
  const { data, isLoading, error } = useEditJobs()
  const [projectId] = useCurrentProject()
  const now = useNow()
  const [del, setDel] = useState<EditJob | null>(null)
  if (isLoading)
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="size-4 animate-spin text-faint" />
      </div>
    )
  if (error) return <div className="py-10 text-center text-sm text-danger">{error.message}</div>
  const list = (data ?? []).filter((j) => !projectId || j.project_id === projectId)
  if (!list.length) return <div className="py-10 text-center text-sm text-faint">Монтажей пока нет</div>
  return (
    <>
      <div className="overflow-hidden rounded-[4px] border border-line bg-surface">
        {list.map((j) => {
          const s = j.settings
          const files = j.media.filter((m) => m.kind === "video" || m.kind === "image").length
          const meta = [
            s.format,
            s.quality === "2160" ? "4K" : `${s.quality}p`,
            `${files} ${files === 1 ? "файл" : files < 5 ? "файла" : "файлов"}`,
            j.media.some((m) => m.kind === "voice") ? "озвучка" : "",
            now !== null ? timeAgo(j.created, now) : "",
          ].filter(Boolean)
          return (
            <div
              key={j.id}
              role="button"
              tabIndex={0}
              onClick={() => onOpen(j.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onOpen(j.id)
              }}
              className="group grid cursor-pointer grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 border-b border-line px-4 py-3 transition-colors last:border-b-0 hover:bg-surface-2/60 sm:grid-cols-[auto_minmax(0,1fr)_minmax(0,260px)_76px]"
            >
              <Thumb j={j} />
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{j.title}</div>
                <div className="mt-0.5 truncate font-mono text-[11px] text-faint">{meta.join(" · ")}</div>
              </div>
              <div className="order-last col-span-3 flex min-w-0 flex-col gap-1.5 text-xs sm:order-none sm:col-span-1">
                <StatusCell j={j} />
                {j.status !== "done" && <EditProgress job={j} />}
              </div>
              <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                {j.result?.video && (
                  <a
                    href={edits.fileUrl(j.id, j.result.video, true)}
                    title="Скачать mp4"
                    className="grid size-7 place-items-center rounded-[3px] text-muted-foreground hover:bg-elev hover:text-foreground"
                  >
                    <Download className="size-3.5" />
                  </a>
                )}
                <button
                  type="button"
                  title="Удалить"
                  onClick={() => setDel(j)}
                  className="grid size-7 place-items-center rounded-[3px] text-faint transition hover:bg-danger/15 hover:text-danger focus-visible:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            </div>
          )
        })}
      </div>
      <ConfirmDialog
        open={del !== null}
        title={`Удалить «${del?.title || "монтаж"}»?`}
        text={del?.status === "running" ? "Монтаж в работе — сначала останови его." : "Монтаж, загруженные файлы и результат удалятся с сервера."}
        onClose={() => setDel(null)}
        onConfirm={async () => {
          await edits.remove(del!.id)
          qc.invalidateQueries({ queryKey: mkeys.edits })
        }}
      />
    </>
  )
}
