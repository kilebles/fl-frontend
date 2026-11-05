"use client"

import { useRef } from "react"
import Link from "next/link"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { ArrowRight, Check, ChevronDown, LayoutGrid, Loader2, Plus, UserRound, X } from "lucide-react"
import { toast } from "sonner"

import { usePicture } from "@/components/create/form-parts"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { api, type AspectRatio, type Avatar, type VideoDuration } from "@/lib/api"
import { setDraft, useDraft } from "@/lib/draft"
import { MODE_BY_ID, MODES, resolveAspectRatio, resolveDuration, type ModeMeta } from "@/lib/modes"
import { useCurrentProject, withStyle } from "@/lib/project"
import { keys, useAvatars, useProjectStyle } from "@/lib/queries"
import { cn } from "@/lib/utils"

const SINGLE_MODES = MODES.filter((m) => !m.chain)

/** Mode + format chip: "Текст → видео · 16:9", opens the mode list + format selector. */
function ParamsChip({
  mode,
  aspectRatio,
  onMode,
  onAspectRatio,
}: {
  mode: ModeMeta
  aspectRatio: AspectRatio
  onMode: (m: ModeMeta) => void
  onAspectRatio: (r: AspectRatio) => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex h-10 items-center gap-2 rounded-[3px] border border-line-strong bg-surface-2 px-3 text-sm transition-colors hover:border-faint aria-expanded:border-electric/60">
        <span>{mode.title}</span>
        {mode.flash && <span className="font-mono text-xs text-warn">Flash</span>}
        <span className="text-faint">·</span>
        <span className="font-mono text-[13px]">{aspectRatio}</span>
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
        <DropdownMenuSeparator />
        <div className="px-2 pt-1.5 pb-1">
          <span className="mb-1.5 block text-[11px] text-muted-foreground">Формат кадра</span>
          <div className="flex rounded-[3px] bg-surface-2 p-[3px]">
            {mode.aspectRatios.map((r) => (
              <button
                key={r}
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onAspectRatio(r)
                }}
                className={cn(
                  "flex-1 rounded-[2px] px-2 py-1 font-mono text-xs transition-colors",
                  aspectRatio === r ? "bg-elev font-medium text-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function DurationSwitch({
  options,
  value,
  onChange,
}: {
  options: readonly VideoDuration[]
  value: VideoDuration
  onChange: (d: VideoDuration) => void
}) {
  return (
    <div
      className="flex h-10 items-center rounded-[3px] border border-line-strong bg-surface-2 p-[3px]"
      role="group"
      aria-label="Длительность видео"
    >
      {options.map((d) => (
        <button
          key={d}
          type="button"
          onClick={() => onChange(d)}
          title={`${d} сек`}
          className={cn(
            "h-full rounded-[2px] px-2.5 font-mono text-xs transition-colors",
            value === d ? "bg-elev font-medium text-foreground shadow-2xs" : "text-muted-foreground hover:text-foreground"
          )}
        >
          {d}с
        </button>
      ))}
    </div>
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
  const endFile = useRef<HTMLInputElement>(null)
  const draft = useDraft()
  const [projectId] = useCurrentProject()
  const style = useProjectStyle(projectId)
  const { data: avatarList } = useAvatars()
  const picture = usePicture()
  const endPicture = usePicture()
  const mode = MODE_BY_ID[draft.mode ?? "t2v"]
  const duration = resolveDuration(mode, draft.duration)
  const aspectRatio = resolveAspectRatio(mode, draft.aspectRatio)
  const avatar: Avatar | undefined = avatarList?.find((a) => a.id === avatarId)

  const attachable = !!mode.staticImage || !!mode.avatar
  const prompt = draft.text.trim()
  const avatarKey = mode.avatar ? (avatar?.image_keys[0] ?? picture.picture?.key) : null
  const avatarKeys = mode.avatar
    ? avatar?.image_keys.length
      ? avatar.image_keys
      : picture.picture?.key
        ? [picture.picture.key]
        : null
    : null
  const missingFrames = !!mode.requiresFrames && (!picture.picture?.key || !endPicture.picture?.key)
  const blocked =
    !prompt || (mode.avatar && !avatarKey) || missingFrames || !!picture.picture?.busy || !!endPicture.picture?.busy

  const submit = useMutation({
    mutationFn: () => {
      const still = mode.staticImage ? picture.picture?.key : null
      const endStill = mode.endImage && still ? endPicture.picture?.key : null
      const imagePrompt = mode.avatar && avatar?.appearance ? `${prompt}. ${avatar.appearance}` : prompt
      return api.createJob({
        mode: mode.id,
        title: prompt.slice(0, 200),
        project_id: projectId,
        duration,
        aspect_ratio: aspectRatio,
        rows: [
          {
            name: "1",
            prompt: mode.needsVideoPrompt ? withStyle(prompt, style) : null,
            image_prompt: mode.needsImagePrompt && !still ? withStyle(imagePrompt, style) : null,
          },
        ],
        avatar: avatarKey,
        avatar_keys: avatarKeys,
        static_image: still ?? null,
        end_image: endStill ?? null,
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

  const showDualFrames = !!mode.requiresFrames || (!!mode.endImage && !!picture.picture)

  return (
    <div className="rounded-[4px] border border-line-strong bg-surface p-3 shadow-[0_12px_40px_-12px_rgb(0_0_0/0.45)] focus-within:border-faint">
      {showDualFrames ? (
        <div className="mb-2 flex flex-wrap items-center gap-2.5 px-1">
          {picture.picture ? (
            <div className="flex items-center gap-2">
              <span className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={picture.picture.preview}
                  alt=""
                  className={cn("size-12 rounded-[3px] object-cover", picture.picture.busy && "opacity-50")}
                />
                {picture.picture.busy && <Loader2 className="absolute inset-0 m-auto size-4 animate-spin text-white" />}
                <button
                  type="button"
                  onClick={() => {
                    picture.clear()
                    if (!mode.requiresFrames) endPicture.clear()
                  }}
                  className="absolute -top-1.5 -right-1.5 grid size-5 place-items-center rounded-full bg-elev text-muted-foreground ring-1 ring-line-strong hover:text-foreground"
                  aria-label="Убрать начальный кадр"
                >
                  <X className="size-3" />
                </button>
              </span>
              <span className="text-xs text-muted-foreground">
                {endPicture.picture || mode.requiresFrames ? "Кадр А (старт)" : "Начальный кадр"}
              </span>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => file.current?.click()}
              className="flex h-12 items-center gap-2 rounded-[3px] border border-dashed border-line-strong bg-surface-2/60 px-3 text-xs text-muted-foreground transition-colors hover:border-faint hover:text-foreground"
            >
              <Plus className="size-3.5" /> Кадр А (старт)
            </button>
          )}

          <ArrowRight className="size-3.5 text-faint" />

          {endPicture.picture ? (
            <div className="flex items-center gap-2">
              <span className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={endPicture.picture.preview}
                  alt=""
                  className={cn("size-12 rounded-[3px] object-cover", endPicture.picture.busy && "opacity-50")}
                />
                {endPicture.picture.busy && <Loader2 className="absolute inset-0 m-auto size-4 animate-spin text-white" />}
                <button
                  type="button"
                  onClick={() => endPicture.clear()}
                  className="absolute -top-1.5 -right-1.5 grid size-5 place-items-center rounded-full bg-elev text-muted-foreground ring-1 ring-line-strong hover:text-foreground"
                  aria-label="Убрать финальный кадр"
                >
                  <X className="size-3" />
                </button>
              </span>
              <span className="text-xs text-muted-foreground">Кадр Б (финал)</span>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => endFile.current?.click()}
              className="flex h-12 items-center gap-2 rounded-[3px] border border-dashed border-line-strong bg-surface-2/60 px-3 text-xs text-muted-foreground transition-colors hover:border-faint hover:text-foreground"
            >
              <Plus className="size-3.5" /> {mode.requiresFrames ? "Кадр Б (финал)" : "Финальный кадр"}
            </button>
          )}
        </div>
      ) : (
        (picture.picture || (mode.avatar && avatar)) && (
          <div className="mb-2 flex items-center gap-2 px-1">
            <span className="relative">
              {avatar && mode.avatar ? (
                avatar.image_urls[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatar.image_urls[0]} alt="" className="size-12 rounded-[3px] object-cover" />
                ) : (
                  <span className="shimmer grid size-12 place-items-center rounded-[3px]">
                    <Loader2 className="size-4 animate-spin text-muted-foreground" />
                  </span>
                )
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={picture.picture!.preview} alt="" className={cn("size-12 rounded-[3px] object-cover", picture.picture?.busy && "opacity-50")} />
              )}
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
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span>{mode.avatar ? (avatar?.name ?? "Аватар") : "Свой кадр"}</span>
              {mode.avatar && avatar && avatar.image_keys.length > 1 && (
                <span className="rounded-[2px] bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] text-foreground-2">
                  {Math.min(avatar.image_keys.length, 4)} рак.
                </span>
              )}
            </span>
          </div>
        )
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
        placeholder={
          mode.requiresFrames
            ? "Опишите движение камеры и действие между кадром А и кадром Б"
            : mode.makesVideos
              ? "Что создаём? Опишите сцену, свет и движение камеры"
              : "Что создаём? Опишите кадр"
        }
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
                <DropdownMenuItem key={a.id} disabled={!a.image_keys.length} onClick={() => onAvatar(a.id)} className="gap-2.5 rounded-[3px] px-2 py-1.5">
                  {a.image_urls[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={a.image_urls[0]} alt="" className="size-8 rounded-[2px] object-cover" />
                  ) : (
                    <span className="shimmer grid size-8 place-items-center rounded-[2px]">
                      <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
                    </span>
                  )}
                  <span className="min-w-0 flex-1 truncate">{a.name}</span>
                  {a.image_keys.length > 1 && <span className="font-mono text-[11px] text-muted-foreground">{Math.min(a.image_keys.length, 4)} рак.</span>}
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
            onClick={() => (picture.picture && mode.endImage && !endPicture.picture ? endFile.current?.click() : file.current?.click())}
            title={
              picture.picture && mode.endImage && !endPicture.picture
                ? "Добавить финальный кадр (Кадр Б)"
                : attachable
                  ? "Свой начальный кадр"
                  : "В этом режиме картинка не нужна"
            }
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
        <input
          ref={endFile}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) {
              endPicture.upload(f)
            }
            e.target.value = ""
          }}
        />
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {mode.durations.length > 0 && duration !== null && (
            <DurationSwitch
              options={mode.durations}
              value={duration}
              onChange={(d) => setDraft({ duration: d })}
            />
          )}
          <ParamsChip
            mode={mode}
            aspectRatio={aspectRatio}
            onMode={(m) => {
              setDraft({ mode: m.id, duration: null })
              if (!(m.avatar || m.staticImage)) picture.clear()
              if (!m.endImage) endPicture.clear()
            }}
            onAspectRatio={(r) => setDraft({ aspectRatio: r })}
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
