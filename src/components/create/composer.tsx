"use client"

import { useRef } from "react"
import Link from "next/link"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { ArrowRight, Check, ChevronDown, LayoutGrid, Loader2, Plus, UserRound, X } from "lucide-react"
import { toast } from "sonner"

import { usePicture } from "@/components/create/form-parts"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { api, type Avatar } from "@/lib/api"
import { setDraft, useDraft } from "@/lib/draft"
import { MODE_BY_ID, MODES, type ModeMeta } from "@/lib/modes"
import { useCurrentProject, withStyle } from "@/lib/project"
import { keys, useAvatars, useProjectStyle } from "@/lib/queries"
import { cn } from "@/lib/utils"

const SINGLE_MODES = MODES.filter((m) => !m.chain)

/** Mode + format chip: "Текст → видео · 16:9", opens the mode list. */
function ParamsChip({ mode, onMode }: { mode: ModeMeta; onMode: (m: ModeMeta) => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex h-10 items-center gap-2 rounded-[3px] border border-line-strong bg-surface-2 px-3 text-sm transition-colors hover:border-faint aria-expanded:border-electric/60">
        <span>{mode.title}</span>
        {mode.flash && <span className="font-mono text-xs text-warn">Flash</span>}
        <span className="text-faint">·</span>
        <span className="font-mono text-[13px]">16:9</span>
        <ChevronDown className="size-3.5 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side="top" sideOffset={8} className="w-72 p-1.5">
        {SINGLE_MODES.map((m) => (
          <DropdownMenuItem key={m.id} onClick={() => onMode(m)} className="gap-3 rounded-[3px] px-2.5 py-2">
            <m.icon className="size-4 text-muted-foreground" />
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5 text-sm">
                {m.title}
                {m.flash && <span className="rounded-[2px] bg-warn-soft px-1 font-mono text-[10px] text-warn">Flash</span>}
              </span>
              <span className="block text-xs text-muted-foreground">{m.description}</span>
            </span>
            {m.id === mode.id && <Check className="size-4 text-electric" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/**
 * One generation from one prompt. The same text drives the frame and the video in
 * image→video modes; an attached picture replaces the generated frame. In avatar mode
 * the avatar's appearance is added to the frame prompt.
 */
export function Composer({ avatarId, onAvatar }: { avatarId: string | null; onAvatar: (id: string | null) => void }) {
  const qc = useQueryClient()
  const file = useRef<HTMLInputElement>(null)
  const draft = useDraft()
  const [projectId] = useCurrentProject()
  const style = useProjectStyle(projectId)
  const { data: avatarList } = useAvatars()
  const picture = usePicture()
  const mode = MODE_BY_ID[draft.mode ?? "t2v"]
  const avatar: Avatar | undefined = avatarList?.find((a) => a.id === avatarId)

  const attachable = !!mode.staticImage || !!mode.avatar
  const prompt = draft.text.trim()
  const avatarKey = mode.avatar ? (avatar?.image_keys[0] ?? picture.picture?.key) : null
  const blocked = !prompt || (mode.avatar && !avatarKey) || !!picture.picture?.busy

  const submit = useMutation({
    mutationFn: () => {
      const still = mode.staticImage ? picture.picture?.key : null
      const imagePrompt = mode.avatar && avatar?.appearance ? `${prompt}. ${avatar.appearance}` : prompt
      return api.createJob({
        mode: mode.id,
        title: prompt.slice(0, 200),
        project_id: projectId,
        rows: [
          {
            name: "1",
            prompt: mode.needsVideoPrompt ? withStyle(prompt, style) : null,
            image_prompt: mode.needsImagePrompt && !still ? withStyle(imagePrompt, style) : null,
          },
        ],
        avatar: avatarKey,
        static_image: still ?? null,
      })
    },
    onSuccess: () => {
      setDraft({ text: "" })
      qc.invalidateQueries({ queryKey: keys.jobs })
    },
    onError: (e) => toast.error(e.message),
  })

  const send = () => {
    if (!blocked && !submit.isPending) submit.mutate()
  }

  return (
    <div className="rounded-[4px] border border-line-strong bg-surface p-3 shadow-[0_12px_40px_-12px_rgb(0_0_0/0.45)] focus-within:border-faint">
      {(picture.picture || (mode.avatar && avatar)) && (
        <div className="mb-2 flex items-center gap-2 px-1">
          <span className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={avatar && mode.avatar ? avatar.image_urls[0] : picture.picture!.preview} alt="" className={cn("size-12 rounded-[3px] object-cover", picture.picture?.busy && "opacity-50")} />
            {picture.picture?.busy && <Loader2 className="absolute inset-0 m-auto size-4 animate-spin text-white" />}
            <button
              type="button"
              onClick={() => (avatar && mode.avatar ? onAvatar(null) : picture.clear())}
              className="absolute -top-1.5 -right-1.5 grid size-5 place-items-center rounded-full bg-elev text-muted-foreground ring-1 ring-line-strong hover:text-foreground"
              aria-label="Убрать"
            >
              <X className="size-3" />
            </button>
          </span>
          <span className="text-xs text-muted-foreground">{mode.avatar ? (avatar?.name ?? "Аватар") : "Свой кадр"}</span>
        </div>
      )}
      <textarea
        value={draft.text}
        onChange={(e) => setDraft({ text: e.target.value })}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault()
            send()
          }
        }}
        rows={2}
        placeholder={mode.makesVideos ? "Что создаём? Опишите сцену, свет и движение камеры" : "Что создаём? Опишите кадр"}
        className="field-sizing-content max-h-60 min-h-14 w-full resize-none bg-transparent px-1.5 py-1 text-[15px] leading-relaxed outline-none placeholder:text-faint"
      />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {mode.avatar ? (
          <DropdownMenu>
            <DropdownMenuTrigger className="flex h-10 items-center gap-2 rounded-[3px] border border-line-strong px-3 text-sm text-foreground-2 hover:text-foreground">
              <UserRound className="size-4" /> {avatar?.name ?? "Аватар"}
              <ChevronDown className="size-3.5 text-muted-foreground" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" side="top" sideOffset={8} className="w-60 p-1.5">
              {avatarList?.map((a) => (
                <DropdownMenuItem key={a.id} onClick={() => onAvatar(a.id)} className="gap-2.5 rounded-[3px] px-2 py-1.5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={a.image_urls[0]} alt="" className="size-8 rounded-[2px] object-cover" />
                  <span className="flex-1 truncate">{a.name}</span>
                  {a.id === avatarId && <Check className="size-4 text-electric" />}
                </DropdownMenuItem>
              ))}
              {!!avatarList?.length && <DropdownMenuSeparator />}
              <DropdownMenuItem onClick={() => file.current?.click()} className="rounded-[3px] px-2.5 py-2">
                <Plus className="size-4" /> Загрузить картинку
              </DropdownMenuItem>
              <DropdownMenuItem render={<Link href="/avatars" />} className="rounded-[3px] px-2.5 py-2">
                <UserRound className="size-4" /> Все аватары
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <button
            type="button"
            disabled={!attachable}
            onClick={() => file.current?.click()}
            title={attachable ? "Свой кадр вместо сгенерированного" : "В этом режиме картинка не нужна"}
            className="grid size-10 place-items-center rounded-[3px] border border-line-strong bg-surface-2 text-foreground-2 transition-colors hover:text-foreground disabled:opacity-35"
            aria-label="Прикрепить картинку"
          >
            <Plus className="size-4" />
          </button>
        )}
        <Link href="/batch" className="flex h-10 items-center gap-2 rounded-[3px] border border-line-strong px-3 text-sm text-foreground-2 transition-colors hover:text-foreground">
          <LayoutGrid className="size-4" /> Пакетом
        </Link>
        <input
          ref={file}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) {
              onAvatar(null)
              picture.upload(f)
            }
            e.target.value = ""
          }}
        />
        <div className="ml-auto flex items-center gap-2">
          <ParamsChip
            mode={mode}
            onMode={(m) => {
              setDraft({ mode: m.id })
              if (!(m.avatar || m.staticImage)) picture.clear()
            }}
          />
          <button
            type="button"
            onClick={send}
            disabled={!!blocked || submit.isPending}
            aria-label="Сгенерировать"
            className="grid size-10 place-items-center rounded-[3px] bg-electric text-white transition hover:brightness-110 active:scale-95 disabled:opacity-35"
          >
            {submit.isPending ? <Loader2 className="size-4 animate-spin" /> : <ArrowRight className="size-4.5" strokeWidth={2.25} />}
          </button>
        </div>
      </div>
    </div>
  )
}
