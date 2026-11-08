"use client"

import { useEffect, useRef, useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Clapperboard, Loader2, Mic, Music, Paintbrush, Plus, Undo2, Upload, X } from "lucide-react"
import { toast } from "sonner"

import { EDIT_ACCENT, MEDIA_ICON, sec1 } from "@/components/montage/edit-parts"
import { size } from "@/components/montage/parts"
import { mkeys, useMontageOptions } from "@/components/montage/queries"
import { BTN_PRIMARY, INPUT, Label, ON_BLUE, Pick, Seg } from "@/components/script/ui"
import { edits, type EditMusic, type EditSettings, type EditStyle } from "@/lib/api"
import { plural } from "@/lib/format"
import { useCurrentProject } from "@/lib/project"
import { cn } from "@/lib/utils"

const REMEMBER = "montage.edit"
/** What the module accepts (options.edit.extensions overrides): by extension, as the server checks. */
const EXT = {
  video: [".mp4", ".mov", ".m4v", ".webm", ".mkv", ".avi"],
  image: [".jpg", ".jpeg", ".png", ".webp"],
  audio: [".mp3", ".wav", ".m4a", ".aac", ".ogg", ".flac"],
}
const ext = (name: string) => (name.match(/\.[^.]+$/)?.[0] ?? "").toLowerCase()

type Remembered = Partial<Pick<EditSettings, "format" | "quality" | "style" | "music" | "model">> & { duration?: string }

type Local = { key: string; file: File; url: string; kind: "video" | "image"; sec?: number }

function loadRemembered(): Remembered {
  try {
    return JSON.parse(localStorage.getItem(REMEMBER) || "{}")
  } catch {
    return {}
  }
}

const kindOf = (f: File, exts: typeof EXT): "video" | "image" | null =>
  exts.video.includes(ext(f.name)) ? "video" : exts.image.includes(ext(f.name)) ? "image" : null

/** One uploaded video or image: a live preview (the video's first frame), its length, remove. */
function Tile({ item, onRemove, onSec }: { item: Local; onRemove: () => void; onSec: (s: number) => void }) {
  return (
    <div className="group relative aspect-video overflow-hidden rounded-[3px] border border-line bg-background">
      {item.kind === "video" ? (
        <video
          src={`${item.url}#t=0.5`}
          muted
          preload="metadata"
          playsInline
          onLoadedMetadata={(e) => Number.isFinite(e.currentTarget.duration) && onSec(e.currentTarget.duration)}
          className="size-full object-cover"
        />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.url} alt={item.file.name} className="size-full object-cover" />
      )}
      <div className="absolute inset-x-0 bottom-0 flex items-center gap-1 bg-gradient-to-t from-black/80 to-transparent px-1.5 pt-4 pb-1 text-[10px] text-white">
        {item.kind === "video" ? <MEDIA_ICON.video className="size-3 shrink-0" /> : <MEDIA_ICON.image className="size-3 shrink-0" />}
        <span className="min-w-0 flex-1 truncate">{item.file.name}</span>
        {item.sec ? <span className="shrink-0 font-mono">{sec1(item.sec)}</span> : null}
      </div>
      <button
        type="button"
        title="Убрать"
        onClick={onRemove}
        className="absolute top-1 right-1 grid size-6 place-items-center rounded-[3px] bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100 hover:bg-danger focus-visible:opacity-100"
      >
        <X className="size-3.5" />
      </button>
    </div>
  )
}

/** A single audio file slot (voiceover, own music). */
function AudioSlot({ file, onFile, icon: Icon, empty, disabled, exts, maxMb }: { file: File | null; onFile: (f: File | null) => void; icon: typeof Mic; empty: string; disabled?: boolean; exts: string[]; maxMb: number }) {
  const ref = useRef<HTMLInputElement>(null)
  const take = (f: File | null | undefined) => {
    if (!f || disabled) return
    if (!exts.includes(ext(f.name))) toast.error(`«${f.name}» — не звук (${exts.join(" ")})`)
    else if (f.size > maxMb * 1024 * 1024) toast.error(`«${f.name}» больше ${maxMb} МБ`)
    else onFile(f)
  }
  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={() => ref.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault()
          take(e.dataTransfer.files?.[0])
        }}
        className={cn(
          "flex h-10 w-full min-w-0 items-center gap-2 rounded-[3px] border border-dashed px-3 text-left text-sm transition-colors disabled:opacity-40",
          file ? "border-pick/50 text-pick-text" : "border-line-strong text-muted-foreground hover:border-faint hover:text-foreground",
        )}
      >
        <Icon className="size-4 shrink-0" />
        <span className="min-w-0 flex-1 truncate">{file ? file.name : empty}</span>
        {file && (
          <span
            role="button"
            tabIndex={0}
            title="Убрать"
            onClick={(e) => {
              e.stopPropagation()
              if (!disabled) onFile(null)
            }}
            className="shrink-0 text-faint hover:text-danger"
          >
            <X className="size-3.5" />
          </span>
        )}
      </button>
      <input
        ref={ref}
        type="file"
        accept={exts.join(",")}
        className="hidden"
        onChange={(e) => {
          take(e.target.files?.[0])
          e.target.value = ""
        }}
      />
    </>
  )
}

/** hidden — панель скрыта (открыт монтаж), но остаётся на месте: идущая загрузка и выбранные файлы не теряются. */
export function EditLaunch({ hidden = false }: { hidden?: boolean }) {
  const qc = useQueryClient()
  const { data: options } = useMontageOptions()
  const opts = options?.edit
  const [projectId] = useCurrentProject()
  const [items, setItems] = useState<Local[]>([])
  const [voice, setVoice] = useState<File | null>(null)
  const [musicFile, setMusicFile] = useState<File | null>(null)
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [before, setBefore] = useState<string | null>(null)
  const [format, setFormat] = useState<EditSettings["format"]>("9:16")
  const [quality, setQuality] = useState<EditSettings["quality"]>("1080")
  const [style, setStyle] = useState<EditStyle>("vlog")
  const [music, setMusic] = useState<EditMusic>("none")
  const [model, setModel] = useState("")
  const [duration, setDuration] = useState("")
  const [voiceSec, setVoiceSec] = useState<number | null>(null)
  const [sent, setSent] = useState<number | null>(null)
  const pickRef = useRef<HTMLInputElement>(null)
  const urls = useRef<string[]>([])

  useEffect(() => {
    const r = loadRemembered()
    const t = setTimeout(() => {
      if (r.format) setFormat(r.format)
      if (r.quality) setQuality(r.quality)
      if (r.style) setStyle(r.style)
      if (r.music) setMusic(r.music)
      if (r.model !== undefined) setModel(r.model)
      if (r.duration !== undefined) setDuration(r.duration)
    }, 0)
    return () => clearTimeout(t)
  }, [])
  useEffect(() => () => urls.current.forEach((u) => URL.revokeObjectURL(u)), [])
  // Ничего не запомнено — значения модуля по умолчанию (например, музыка Epidemic, если на сервере есть ключ).
  const defaults = opts?.defaults
  useEffect(() => {
    if (!defaults) return
    const r = loadRemembered()
    const t = setTimeout(() => {
      if (!r.format) setFormat(defaults.format)
      if (!r.quality) setQuality(defaults.quality)
      if (!r.style) setStyle(defaults.style)
      if (!r.music) setMusic(defaults.music)
    }, 0)
    return () => clearTimeout(t)
  }, [defaults])
  // Длина озвучки — чтобы сразу сказать, если она длиннее предела.
  useEffect(() => {
    if (!voice) return
    const url = URL.createObjectURL(voice)
    let live = true
    const a = new Audio()
    a.preload = "metadata"
    a.onloadedmetadata = () => live && setVoiceSec(Number.isFinite(a.duration) ? a.duration : null)
    a.src = url
    return () => {
      live = false
      a.onloadedmetadata = null
      a.removeAttribute("src")
      URL.revokeObjectURL(url)
      setVoiceSec(null)
    }
  }, [voice])
  // На сервере нет ключа Epidemic: подбора нет — запомненный выбор сбрасывается на «Без музыки».
  const epidemicOff = opts?.epidemic === false
  useEffect(() => {
    if (!epidemicOff) return
    const t = setTimeout(() => setMusic((m) => (m === "epidemic" ? "none" : m)), 0)
    return () => clearTimeout(t)
  }, [epidemicOff])
  const remember = (patch: Remembered) => {
    try {
      localStorage.setItem(REMEMBER, JSON.stringify({ ...loadRemembered(), ...patch }))
    } catch {}
  }

  const limits = opts?.limits
  const exts = opts?.extensions ?? EXT
  const maxSec = limits?.max_sec ?? 60
  const voiceMax = limits?.voice_max_sec ?? maxSec - 0.3
  const maxMb = limits?.max_file_mb ?? 2048
  const totalMb = limits?.max_total_mb ?? 6144
  const add = (files: FileList | File[]) => {
    const next: Local[] = []
    const skipped: string[] = []
    for (const f of Array.from(files)) {
      const kind = kindOf(f, exts)
      if (!kind) {
        skipped.push(f.name)
        continue
      }
      if (f.size > maxMb * 1024 * 1024) {
        toast.error(`«${f.name}» больше ${maxMb} МБ`)
        continue
      }
      const url = URL.createObjectURL(f)
      urls.current.push(url)
      next.push({ key: `${f.name}-${f.size}-${f.lastModified}-${Math.random().toString(36).slice(2, 7)}`, file: f, url, kind })
    }
    if (skipped.length) toast.error(`Не подходит (${[...exts.video, ...exts.image].join(" ")}): ${skipped.join(", ")}`)
    const most = limits?.max_files ?? 30
    if (items.length + next.length > most) {
      toast.error(`Не больше ${most} файлов в одном монтаже — лишние не добавлены`)
      next.slice(Math.max(0, most - items.length)).forEach((x) => URL.revokeObjectURL(x.url))
    }
    setItems((cur) => [...cur, ...next].slice(0, most))
  }

  const sec = Number(duration.replace(",", "."))
  // с озвучкой длину задаёт она: поле длительности не участвует
  const durOk = !!voice || duration === "" || (sec >= (limits?.min_sec ?? 5) && sec <= maxSec)
  const voiceTooLong = voiceSec !== null && voiceSec > voiceMax + 0.05
  const total = items.reduce((a, i) => a + i.file.size, 0) + (voice?.size ?? 0) + (music === "own" ? (musicFile?.size ?? 0) : 0)
  const tooBig = total > totalMb * 1024 * 1024
  const ready = items.length > 0 && durOk && !voiceTooLong && !tooBig && (music !== "own" || !!musicFile)
  // почему «Смонтировать» недоступна — пишется под панелью, а не только красной рамкой
  const why = !items.length
    ? ""
    : music === "own" && !musicFile
      ? "добавь файл музыки или выбери другую"
      : !durOk
        ? `длительность — от ${limits?.min_sec ?? 5} до ${maxSec} с или пусто (авто)`
        : voiceTooLong
          ? `озвучка длиннее ${String(voiceMax).replace(".", ",")} с`
          : tooBig
            ? `больше ${Math.round(totalMb / 1024)} ГБ за раз — убери часть файлов`
            : ""
  const abort = useRef<AbortController | null>(null)

  const settings = (): Partial<EditSettings> => ({ format, quality, style, music, model, duration: !voice && duration ? sec : null })

  const brush = useMutation({
    mutationFn: () =>
      edits.brush({
        ...settings(),
        text: description,
        files: [
          ...items.map((i) => ({ name: i.file.name, kind: i.kind, sec: i.sec ?? null })),
          ...(voice ? [{ name: voice.name, kind: "voiceover", sec: voiceSec }] : []),
        ],
      }),
    onSuccess: (r) => {
      setBefore((b) => b ?? description)
      setDescription(r.text)
    },
    onError: (e) => toast.error(e.message),
  })

  const create = useMutation({
    mutationFn: () => {
      abort.current = new AbortController()
      return edits.create(
        { ...settings(), title: title.trim() || undefined, project_id: projectId, description },
        { media: items.map((i) => i.file), voice, music: music === "own" ? musicFile : null },
        (share) => setSent(share),
        abort.current.signal,
      )
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: mkeys.edits })
      items.forEach((i) => URL.revokeObjectURL(i.url))
      setItems([])
      setVoice(null)
      setMusicFile(null)
      setTitle("")
      setDescription("")
      setBefore(null)
      toast.success("Монтаж в очереди")
    },
    onError: (e) => toast.error(e.message),
    onSettled: () => {
      setSent(null)
      abort.current = null
    },
  })
  const busy = create.isPending
  // загрузка идёт — закрытие вкладки её оборвёт: браузер спросит
  useEffect(() => {
    if (!busy) return
    const stop = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener("beforeunload", stop)
    return () => window.removeEventListener("beforeunload", stop)
  }, [busy])

  const musicModes = (opts?.music ?? [
    { value: "none", label: "Без музыки" },
    { value: "own", label: "Своя" },
    { value: "epidemic", label: "Epidemic (подбор)" },
  ]).filter((m) => !(epidemicOff && m.value === "epidemic")) as { value: EditMusic; label: string }[]

  const progress =
    sent === null ? "" : sent < 1 ? `загрузка ${Math.round(sent * 100)}% из ${size(total)}` : "сервер принимает файлы…"
  if (hidden) {
    // открыт монтаж, а новый ещё грузится: полоска сверху, чтобы загрузку было видно и её можно было отменить
    return busy ? (
      <div className="mb-4 flex items-center gap-3 rounded-[4px] border border-line bg-surface px-4 py-2.5 text-xs">
        <Loader2 className="size-3.5 animate-spin text-pick" />
        <span className="font-mono text-muted-foreground">Новый монтаж: {progress}</span>
        <button type="button" onClick={() => abort.current?.abort()} className="ml-auto text-muted-foreground hover:text-danger">
          Отменить
        </button>
      </div>
    ) : null
  }

  return (
    <section className="mb-6 rounded-[4px] border border-line bg-surface">
      {/* пока файлы уходят на сервер, менять нечего: иначе изменения не попали бы в монтаж и стёрлись бы после */}
      <fieldset disabled={busy} className="m-0 min-w-0 border-0 p-0 disabled:opacity-70">
      <div className="grid grid-cols-1 gap-x-5 gap-y-5 p-5 md:grid-cols-2 xl:grid-cols-12">
        <div className="md:col-span-2 xl:col-span-7">
          <Label
            aside={
              <span className="font-mono text-[11px] text-faint">
                {items.length ? `${items.length} / ${limits?.max_files ?? 30} · ${size(total)}` : "mp4 mov webm · jpg png webp"}
              </span>
            }
          >
            Видео и картинки
          </Label>
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault()
              if (!busy && e.dataTransfer.files?.length) add(e.dataTransfer.files)
            }}
            className={cn("rounded-[3px] border border-dashed bg-background", items.length ? "border-line-strong p-2" : "border-line-strong")}
          >
            {items.length === 0 ? (
              <button
                type="button"
                onClick={() => pickRef.current?.click()}
                className="flex h-[188px] w-full flex-col items-center justify-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                <Upload className="size-5" />
                Перетащи видео и картинки или нажми
                <span className="font-mono text-[11px] text-faint">порядок файлов — подсказка модели</span>
              </button>
            ) : (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-5">
                {items.map((it) => (
                  <Tile
                    key={it.key}
                    item={it}
                    onRemove={() => {
                      URL.revokeObjectURL(it.url)
                      setItems((cur) => cur.filter((x) => x.key !== it.key))
                    }}
                    onSec={(s) => setItems((cur) => cur.map((x) => (x.key === it.key ? { ...x, sec: s } : x)))}
                  />
                ))}
                {items.length < (limits?.max_files ?? 30) && (
                  <button
                    type="button"
                    onClick={() => pickRef.current?.click()}
                    className="grid aspect-video place-items-center rounded-[3px] border border-dashed border-line-strong text-muted-foreground transition-colors hover:border-faint hover:text-foreground"
                  >
                    <Plus className="size-5" />
                  </button>
                )}
              </div>
            )}
          </div>
          <input
            ref={pickRef}
            type="file"
            multiple
            accept={[...exts.video, ...exts.image].join(",")}
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.length) add(e.target.files)
              e.target.value = ""
            }}
          />
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Label aside={voiceSec ? <span className={cn("font-mono text-[11px]", voiceTooLong ? "text-danger" : "text-faint")}>{sec1(voiceSec)}</span> : undefined}>
                Озвучка
              </Label>
              <AudioSlot file={voice} onFile={setVoice} icon={Mic} empty="mp3 wav m4a — задаёт длину" exts={exts.audio} maxMb={maxMb} disabled={busy} />
              {voiceTooLong && <div className="mt-1 text-xs text-danger">Длиннее {String(voiceMax).replace(".", ",")} с — сократи озвучку</div>}
            </div>
            <div>
              <Label>Музыка</Label>
              <Seg
                value={music}
                onChange={(v) => {
                  setMusic(v as EditMusic)
                  remember({ music: v as EditMusic })
                }}
                options={musicModes.map((m) => [m.value, m.value === "epidemic" ? "Epidemic" : m.label, m.value === "epidemic" ? (opts?.epidemic === false ? "На сервере нет ключа Epidemic — будет без музыки" : "Модель описывает музыку, трек подбирается и подгоняется по длине") : ""] as const)}
              />
              {music === "own" && (
                <div className="mt-2">
                  <AudioSlot file={musicFile} onFile={setMusicFile} icon={Music} empty="файл музыки" exts={exts.audio} maxMb={maxMb} disabled={busy} />
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4 md:col-span-2 xl:col-span-5">
          <div>
            <Label>Название</Label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="придумает модель" className={INPUT} />
          </div>
          <div className="flex min-h-0 flex-1 flex-col">
            <Label
              aside={
                <div className="flex items-center gap-1">
                  {before !== null && !brush.isPending && (
                    <button
                      type="button"
                      title="Вернуть мой текст"
                      onClick={() => {
                        setDescription(before)
                        setBefore(null)
                      }}
                      className="flex h-7 items-center gap-1 rounded-[3px] px-2 text-xs text-muted-foreground hover:bg-elev hover:text-foreground"
                    >
                      <Undo2 className="size-3.5" />
                      Вернуть
                    </button>
                  )}
                  <button
                    type="button"
                    title="Кисть: модель распишет описание подробнее — ритм, порядок, акценты, титры, музыка, финал"
                    disabled={!description.trim() || brush.isPending || busy}
                    onClick={() => brush.mutate()}
                    className={cn("flex h-7 items-center gap-1.5 rounded-[3px] px-2.5 text-xs font-medium transition-colors disabled:opacity-40", ON_BLUE)}
                  >
                    {brush.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Paintbrush className="size-3.5" />}
                    Кисть
                  </button>
                </div>
              }
            >
              Описание
            </Label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={brush.isPending}
              placeholder="Что смонтировать: идея, настроение, порядок, что показать крупно, какие титры, чем закончить. Чем подробнее, тем лучше — или напиши пару слов и нажми «Кисть»"
              className={cn(INPUT, "h-auto min-h-[220px] flex-1 resize-y py-2.5 leading-relaxed disabled:opacity-60")}
            />
          </div>
        </div>

        <div className="xl:col-span-3">
          <Label>Формат</Label>
          <Seg
            mono
            value={format}
            onChange={(v) => {
              setFormat(v as EditSettings["format"])
              remember({ format: v as EditSettings["format"] })
            }}
            options={[
              ["9:16", "9:16", "Shorts, Reels, TikTok"],
              ["16:9", "16:9"],
            ]}
          />
        </div>
        <div className="xl:col-span-4">
          <Label>Качество</Label>
          <Seg
            mono
            value={quality}
            onChange={(v) => {
              setQuality(v as EditSettings["quality"])
              remember({ quality: v as EditSettings["quality"] })
            }}
            options={(options?.qualities ?? [{ value: "1080", label: "1080p" }]).map((q) => [q.value, q.label, q.value === "2160" ? "рендер заметно дольше" : ""] as const)}
          />
        </div>
        <div className="xl:col-span-2">
          <Label aside={<span className="font-mono text-[11px] text-faint">до {maxSec} с</span>}>Длительность</Label>
          <input
            value={voice ? "" : duration}
            disabled={!!voice}
            onChange={(e) => {
              const v = e.target.value.replace(/[^\d.,]/g, "").slice(0, 4)
              setDuration(v)
              const n = Number(v.replace(",", "."))
              // запоминается только годная длина — иначе следующий раз панель открылась бы уже с ошибкой
              if (v === "" || (n >= (limits?.min_sec ?? 5) && n <= maxSec)) remember({ duration: v })
            }}
            placeholder={voice ? "по озвучке" : "авто"}
            inputMode="decimal"
            title={voice ? "С озвучкой длина — её длина" : `Авто — по материалу и описанию; или от ${limits?.min_sec ?? 5} до ${maxSec} с`}
            className={cn(INPUT, "font-mono disabled:opacity-60", !durOk && "border-danger text-danger")}
          />
        </div>
        <div className="xl:col-span-3">
          <Label>Модель</Label>
          <Pick
            value={model}
            onChange={(v) => {
              setModel(v)
              remember({ model: v })
            }}
            options={[{ value: "", label: "По умолчанию", hint: "из настроек" }, ...(options?.models ?? []).map((m) => ({ value: m.value, label: m.label, hint: m.group }))]}
          />
        </div>

        <div className="md:col-span-2 xl:col-span-12">
          <Label>Стиль монтажа</Label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
            {(opts?.styles ?? []).map((s) => {
              const on = style === s.value
              return (
                <button
                  key={s.value}
                  type="button"
                  title={s.hint}
                  onClick={() => {
                    setStyle(s.value)
                    remember({ style: s.value })
                  }}
                  className={cn(
                    "flex min-w-0 flex-col gap-1 rounded-[3px] border px-3 py-2.5 text-left transition-colors",
                    on ? "border-pick/60 bg-pick-soft" : "border-line-strong hover:border-faint",
                  )}
                >
                  <span className="flex items-center gap-2">
                    <span className="size-2 shrink-0 rounded-full" style={{ background: EDIT_ACCENT[s.value] }} />
                    <span className={cn("truncate text-[13px] leading-tight", on ? "font-medium text-pick-text" : "text-foreground")}>{s.label}</span>
                  </span>
                  <span className="line-clamp-2 text-[11px] leading-snug text-muted-foreground">{s.hint}</span>
                  <span className="font-mono text-[10px] text-faint">
                    кадр {s.shot[0]}–{s.shot[1]} с
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      </div>
      </fieldset>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          {sent !== null ? (
            <>
              <div className="h-1 w-40 overflow-hidden rounded-full bg-elev">
                <div className="h-full rounded-full bg-pick transition-[width]" style={{ width: `${Math.round(sent * 100)}%` }} />
              </div>
              <span className="font-mono text-[11px] text-muted-foreground">{progress}</span>
              <button type="button" onClick={() => abort.current?.abort()} className="font-mono text-[11px] text-muted-foreground hover:text-danger">
                отменить
              </button>
            </>
          ) : (
            <span className={cn("min-w-0 truncate font-mono text-[11px]", why ? "text-danger" : "text-muted-foreground")}>
              {why
                ? `Не запустить: ${why}`
                : items.length
                ? [
                    `${items.filter((i) => i.kind === "video").length} видео`,
                    ((n) => (n ? `${n} ${plural(n, "картинка", "картинки", "картинок")}` : ""))(items.filter((i) => i.kind === "image").length),
                    voice ? "озвучка" : "",
                    music === "own" && musicFile ? "своя музыка" : music === "epidemic" ? "музыка Epidemic" : "",
                    !voice && duration ? `${duration.replace(".", ",")} с` : "",
                  ]
                    .filter(Boolean)
                    .join(" · ")
                : ""}
            </span>
          )}
        </div>
        <button type="button" disabled={!ready || create.isPending || brush.isPending} onClick={() => create.mutate()} className={BTN_PRIMARY}>
          {create.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Clapperboard className="size-3.5" />}
          Смонтировать
        </button>
      </div>
    </section>
  )
}
