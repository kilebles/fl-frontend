"use client"

import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { AlertTriangle, Copy, Download, Loader2, RotateCcw, Sparkles } from "lucide-react"
import { toast } from "sonner"

import { rkeys, useReelYoutube } from "@/components/reels/queries"
import { BTN_PRIMARY, BTN_SECONDARY, Card, INPUT } from "@/components/script/ui"
import { reels, type Reel, type ReelYoutube } from "@/lib/api"
import { langCode } from "@/lib/langs"
import { cn } from "@/lib/utils"

const copy = (text: string) =>
  navigator.clipboard.writeText(text).then(
    () => toast.success("Скопировано"),
    () => toast.error("Не удалось скопировать"),
  )

function saveJson(data: ReelYoutube, name: string) {
  const blob = new Blob([JSON.stringify(data, null, 1)], { type: "application/json" })
  const a = document.createElement("a")
  a.href = URL.createObjectURL(blob)
  a.download = `${name.replace(/[^\p{L}\p{N}_-]+/gu, "_").replace(/^_+|_+$/g, "") || "reel"}_youtube.json`
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

/** YouTube titles and descriptions in every voiced language (fl-reel reel/youtube.py) — for uploading to the channels. */
export function YoutubeCard({ reel: r }: { reel: Reel }) {
  const qc = useQueryClient()
  const yt = r.youtube
  const saved = r.settings.youtube?.title ?? ""
  const [title, setTitle] = useState(saved)
  const state = yt?.state ?? "none"
  const has = !!yt && (yt.langs.length > 0 || state === "done")
  const { data, isLoading } = useReelYoutube(r.id, has, yt?.generated)
  const make = useMutation({
    mutationFn: () => reels.makeYoutube(r.id, title.trim()),
    onSuccess: (res) => {
      if (res.state === "none") toast.success("Название сохранено — описания сделает ролик")
      qc.invalidateQueries({ queryKey: rkeys.reel(r.id) })
    },
    onError: (e) => toast.error(e.message),
  })
  // older brains send no `youtube`; a new reel gets it after the storyboard
  if (yt === undefined || (yt === null && r.status === "running")) return null

  const running = r.status === "running"
  const building = state === "building" || make.isPending
  const langs = data ? Object.entries(data.languages) : []
  const missing = yt?.missing ?? []

  return (
    <Card
      title="Названия и описания"
      aside={state === "done" && yt ? <span className="font-mono text-[11px] text-faint">{yt.langs.length} яз.</span> : undefined}
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={title}
            maxLength={100}
            disabled={running || building}
            onChange={(e) => setTitle(e.target.value.replace(/[<>]/g, ""))}
            placeholder="Название для YouTube — пусто: по сценарию"
            className={cn(INPUT, "min-w-0 flex-1 basis-72")}
          />
          <button
            type="button"
            disabled={running || building}
            onClick={() => make.mutate()}
            className={cn(state === "done" ? BTN_SECONDARY : BTN_PRIMARY, "disabled:opacity-50")}
            title={running ? "Ролик в работе — описания он сделает сам" : undefined}
          >
            {building ? <Loader2 className="size-3.5 animate-spin" /> : state === "none" ? <Sparkles className="size-3.5" /> : <RotateCcw className="size-3.5" />}
            {r.status === "queued" ? "Сохранить" : state === "none" ? "Сделать" : "Сделать заново"}
          </button>
        </div>

        {building && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" />
            Делаю названия и описания
          </div>
        )}

        {state === "error" && yt?.error && (
          <div className="flex items-start gap-2 text-sm">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-danger" />
            <span className="text-foreground-2">{yt.error}</span>
          </div>
        )}

        {has && isLoading && (
          <div className="flex justify-center py-3">
            <Loader2 className="size-4 animate-spin text-faint" />
          </div>
        )}

        {langs.length > 0 && (
          <div className="overflow-hidden rounded-[3px] border border-line">
            {langs.map(([code, t]) => (
              <div key={code} className="grid grid-cols-[44px_minmax(0,1fr)] gap-3 border-b border-line px-3 py-2.5 last:border-b-0">
                <span className="pt-0.5 font-mono text-xs text-ok" title={t.name}>
                  {langCode(code)}
                  {code === data?.base && <span className="block text-[10px] text-faint">база</span>}
                </span>
                <div className="min-w-0 space-y-1">
                  <div className="group flex items-start gap-2">
                    <span className="min-w-0 flex-1 text-sm font-medium text-foreground">{t.title}</span>
                    <CopyButton text={t.title} label="название" />
                  </div>
                  <div className="group flex items-start gap-2">
                    <p className="min-w-0 flex-1 whitespace-pre-line text-[13px] leading-relaxed text-muted-foreground">{t.description}</p>
                    <CopyButton text={t.description} label="описание" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {state === "done" && missing.length > 0 && <p className="text-[13px] text-warn">Нет перевода: {missing.map(langCode).join(", ")}</p>}

        {data && langs.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-t border-line pt-4">
            <button type="button" onClick={() => saveJson(data, r.title || r.id)} className={BTN_PRIMARY}>
              <Download className="size-3.5" />
              Скачать JSON
            </button>
            {yt?.title_source === "generated" && <span className="text-xs text-faint">название придумано по сценарию</span>}
          </div>
        )}
      </div>
    </Card>
  )
}

function CopyButton({ text, label }: { text: string; label: string }) {
  return (
    <button
      type="button"
      onClick={() => copy(text)}
      title={`Скопировать ${label}`}
      className="grid size-6 shrink-0 place-items-center rounded-[3px] text-faint opacity-60 hover:bg-elev hover:text-foreground group-hover:opacity-100"
    >
      <Copy className="size-3.5" />
    </button>
  )
}
