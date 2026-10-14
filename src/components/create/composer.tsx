"use client"

import { useRef, useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { ArrowUp, ImagePlus, Loader2, UserRound, X } from "lucide-react"
import { toast } from "sonner"

import { usePicture } from "@/components/create/form-parts"
import { ModePicker } from "@/components/create/mode-picker"
import { api } from "@/lib/api"
import { MODES, type ModeMeta } from "@/lib/modes"
import { keys } from "@/lib/queries"
import { cn } from "@/lib/utils"

const SINGLE_MODES = MODES.filter((m) => !m.chain)

/**
 * One generation from one prompt. The same text drives both the frame and the video in
 * image→video modes; an attached picture replaces the generated frame (or is the avatar).
 */
export function Composer() {
  const qc = useQueryClient()
  const file = useRef<HTMLInputElement>(null)
  const [mode, setMode] = useState<ModeMeta>(SINGLE_MODES[0])
  const [text, setText] = useState("")
  const picture = usePicture()

  const attachable = !!(mode.avatar || mode.staticImage)
  const prompt = text.trim()
  const blocked = !prompt || (mode.avatar && !picture.picture?.key) || !!picture.picture?.busy

  const changeMode = (m: ModeMeta) => {
    setMode(m)
    if (!(m.avatar || m.staticImage)) picture.clear()
  }

  const submit = useMutation({
    mutationFn: () => {
      const key = attachable ? picture.picture?.key : null
      const useStill = !!mode.staticImage && !!key
      return api.createJob({
        mode: mode.id,
        title: prompt.slice(0, 200),
        rows: [
          {
            name: "1",
            prompt: mode.needsVideoPrompt ? prompt : null,
            image_prompt: mode.needsImagePrompt && !useStill ? prompt : null,
          },
        ],
        avatar: mode.avatar ? key : null,
        static_image: useStill ? key : null,
      })
    },
    onSuccess: () => {
      setText("")
      qc.invalidateQueries({ queryKey: keys.jobs })
    },
    onError: (e) => toast.error(e.message),
  })

  const send = () => {
    if (!blocked && !submit.isPending) submit.mutate()
  }

  return (
    <div className="rounded-3xl border border-line-strong bg-surface p-3 shadow-2xl shadow-black/40 transition-colors focus-within:border-electric/40">
      {picture.picture && (
        <div className="mb-2 flex items-center gap-2 px-1">
          <span className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={picture.picture.preview} alt="" className={cn("size-14 rounded-xl object-cover ring-1 ring-line", picture.picture.busy && "opacity-50")} />
            {picture.picture.busy && <Loader2 className="absolute inset-0 m-auto size-4 animate-spin text-white" />}
            <button type="button" onClick={picture.clear} className="absolute -top-1.5 -right-1.5 grid size-5 place-items-center rounded-full bg-elev text-muted-foreground ring-1 ring-line-strong hover:text-foreground">
              <X className="size-3" />
            </button>
          </span>
          <span className="text-xs text-muted-foreground">{mode.avatar ? "Аватар" : "Кадр"}</span>
        </div>
      )}
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault()
            send()
          }
        }}
        rows={2}
        placeholder={mode.makesVideos ? "Опишите видео" : "Опишите картинку"}
        className="field-sizing-content max-h-60 min-h-12 w-full resize-none bg-transparent px-2 py-1.5 text-[15px] leading-relaxed outline-none placeholder:text-faint"
      />
      <div className="mt-1 flex items-center gap-2">
        <ModePicker modes={SINGLE_MODES} value={mode} onChange={changeMode} />
        {attachable && (
          <button
            type="button"
            onClick={() => file.current?.click()}
            className={cn(
              "inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-[13px] transition-colors",
              mode.avatar && !picture.picture ? "border-electric/40 text-electric" : "border-line-strong text-muted-foreground hover:text-foreground"
            )}
          >
            {mode.avatar ? <UserRound className="size-4" /> : <ImagePlus className="size-4" />}
            {mode.avatar ? "Аватар" : "Кадр"}
          </button>
        )}
        <input
          ref={file}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) picture.upload(f)
            e.target.value = ""
          }}
        />
        <button
          type="button"
          onClick={send}
          disabled={!!blocked || submit.isPending}
          aria-label="Сгенерировать"
          className="glow-electric ml-auto grid size-10 place-items-center rounded-full bg-electric text-white transition hover:brightness-110 active:scale-95 disabled:pointer-events-none disabled:opacity-35 disabled:shadow-none"
        >
          {submit.isPending ? <Loader2 className="size-4.5 animate-spin" /> : <ArrowUp className="size-5" strokeWidth={2.5} />}
        </button>
      </div>
    </div>
  )
}
