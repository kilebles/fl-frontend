"use client"

import { useEffect, useRef, useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Check, FileText, Loader2, Paperclip, Type, Wand2, X } from "lucide-react"
import { toast } from "sonner"

import { StyleSwatch, TYPE_ICON } from "@/components/montage/parts"
import { mkeys, useMontageOptions } from "@/components/montage/queries"
import { BTN_PRIMARY, INPUT, Label, ON_BLUE, Pick, Seg } from "@/components/script/ui"
import { montage, type InfoKind, type InfoSettings, type InfoStyle, type InfoType } from "@/lib/api"
import { useCurrentProject } from "@/lib/project"
import { cn } from "@/lib/utils"

const REMEMBER = "montage.infographics"

type Remembered = Partial<Pick<InfoSettings, "type" | "kind" | "format" | "quality" | "style" | "alpha" | "language" | "model">> & {
  from?: "text" | "file"
  duration?: string
}

function loadRemembered(): Remembered {
  try {
    return JSON.parse(localStorage.getItem(REMEMBER) || "{}")
  } catch {
    return {}
  }
}

function Toggle({ on, onClick, children, hint }: { on: boolean; onClick: () => void; children: React.ReactNode; hint?: string }) {
  return (
    <button
      type="button"
      title={hint}
      onClick={onClick}
      className={cn(
        "flex h-10 items-center gap-2 rounded-[3px] border px-3 text-sm transition-colors",
        on ? cn("border-pick/40", ON_BLUE) : "border-line-strong text-muted-foreground hover:text-foreground",
      )}
    >
      <span className={cn("grid size-4 place-items-center rounded-[2px] border", on ? "border-transparent bg-current/20" : "border-line-strong")}>
        {on && <Check className="size-3" />}
      </span>
      {children}
    </button>
  )
}

export function LaunchPanel() {
  const qc = useQueryClient()
  const { data: options } = useMontageOptions()
  const [projectId] = useCurrentProject()
  const [from, setFrom] = useState<"text" | "file">("text")
  const [text, setText] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState("")
  const [type, setType] = useState<InfoType | "auto">("auto")
  const [kind, setKind] = useState<InfoKind>("animated")
  const [format, setFormat] = useState<InfoSettings["format"]>("16:9")
  const [quality, setQuality] = useState<InfoSettings["quality"]>("1080")
  const [style, setStyle] = useState<InfoStyle>("parchment")
  const [duration, setDuration] = useState("")
  const [count, setCount] = useState("")
  const [alpha, setAlpha] = useState(false)
  const [language, setLanguage] = useState("")
  const [model, setModel] = useState("")
  const [notes, setNotes] = useState("")
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const r = loadRemembered()
    const t = setTimeout(() => {
      if (r.from) setFrom(r.from)
      if (r.type) setType(r.type)
      if (r.kind) setKind(r.kind)
      if (r.format) setFormat(r.format)
      if (r.quality) setQuality(r.quality)
      if (r.style) setStyle(r.style)
      if (r.alpha !== undefined) setAlpha(r.alpha)
      if (r.language !== undefined) setLanguage(r.language)
      if (r.model !== undefined) setModel(r.model)
      if (r.duration !== undefined) setDuration(r.duration)
    }, 0)
    return () => clearTimeout(t)
  }, [])
  const remember = (patch: Remembered) => {
    try {
      localStorage.setItem(REMEMBER, JSON.stringify({ ...loadRemembered(), ...patch }))
    } catch {}
  }

  const limits = options?.limits
  const maxAuto = options?.defaults.max_auto ?? 6
  const sec = Number(duration.replace(",", "."))
  const durOk = duration === "" || (sec >= (limits?.min_sec ?? 3) && sec <= (limits?.max_sec ?? 60))
  const n = Number(count)
  const countOk = count === "" || (Number.isInteger(n) && n >= 1 && n <= (limits?.max_items ?? 12))
  const ready = (from === "text" ? text.trim().length > 0 : !!file) && durOk && countOk

  const create = useMutation({
    mutationFn: () =>
      montage.create(
        {
          title: title.trim() || undefined,
          project_id: projectId,
          text: from === "text" ? text : undefined,
          type,
          kind,
          format,
          quality,
          style,
          alpha,
          language,
          model,
          duration: kind === "animated" && duration ? sec : null,
          max_items: count ? n : undefined,
          notes: notes.trim(),
        },
        from === "file" ? file : null,
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: mkeys.jobs })
      setTitle("")
      setText("")
      setFile(null)
      setNotes("")
    },
    onError: (e) => toast.error(e.message),
  })

  const types = options?.types ?? []
  const meta =
    from === "text"
      ? text.trim()
        ? `${text.trim().length.toLocaleString("ru")} символов`
        : ""
      : file
        ? file.name
        : ""

  return (
    <section className="mb-6 rounded-[4px] border border-line bg-surface">
      <div className="grid grid-cols-1 gap-x-5 gap-y-5 p-5 md:grid-cols-2 xl:grid-cols-12">
        <div className="md:col-span-2 xl:col-span-7">
          <Label
            aside={
              <div className="flex gap-0.5 rounded-[3px] bg-surface-2 p-0.5 text-xs">
                {(
                  [
                    ["text", "Текст", Type],
                    ["file", "Файл", Paperclip],
                  ] as const
                ).map(([id, label, Icon]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => {
                      setFrom(id)
                      remember({ from: id })
                    }}
                    className={cn("flex items-center gap-1 rounded-[2px] px-2 py-1", from === id ? ON_BLUE : "text-muted-foreground hover:text-foreground")}
                  >
                    <Icon className="size-3" />
                    {label}
                  </button>
                ))}
              </div>
            }
          >
            Текст
          </Label>
          {from === "text" ? (
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Сценарий целиком или абзац: даты, имена, числа, места — всё, что нужно показать"
              className={cn(INPUT, "h-[188px] resize-y py-2.5 leading-relaxed")}
            />
          ) : (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault()
                const f = e.dataTransfer.files?.[0]
                if (f) setFile(f)
              }}
              className={cn(
                "flex h-[188px] w-full flex-col items-center justify-center gap-2 rounded-[3px] border border-dashed bg-background text-sm transition-colors",
                file ? "border-pick/50 text-pick-text" : "border-line-strong text-muted-foreground hover:border-faint hover:text-foreground",
              )}
            >
              <FileText className="size-5" />
              {file ? file.name : "Сценарий .docx .txt .md"}
              {file && (
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation()
                    setFile(null)
                  }}
                  className="flex items-center gap-1 text-xs text-faint hover:text-danger"
                >
                  <X className="size-3" /> убрать
                </span>
              )}
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept=".docx,.txt,.md"
            className="hidden"
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null)
              e.target.value = ""
            }}
          />
        </div>

        <div className="flex flex-col gap-4 md:col-span-2 xl:col-span-5">
          <div>
            <Label>Название</Label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={from === "file" ? file?.name.replace(/\.[^.]+$/, "") || "из имени файла" : "по первой строке текста"}
              className={INPUT}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Язык надписей</Label>
              <Pick
                value={language}
                onChange={(v) => {
                  setLanguage(v)
                  remember({ language: v })
                }}
                options={(options?.languages ?? [{ value: "", label: "Как в тексте" }]).map((l) => ({ value: l.value, label: l.label }))}
              />
            </div>
            <div>
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
          </div>
          <div>
            <Label>Пожелания</Label>
            <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Например: только события 1066 года, без карты" className={INPUT} />
          </div>
        </div>

        <div className="md:col-span-2 xl:col-span-12">
          <Label>Тип инфографики</Label>
          <div className="grid grid-cols-2 gap-[3px] rounded-[3px] bg-surface-2 p-[3px] sm:grid-cols-4 xl:grid-cols-8">
            {types.map((t) => {
              const Icon = TYPE_ICON[t.value]
              const on = type === t.value
              return (
                <button
                  key={t.value}
                  type="button"
                  title={t.hint}
                  onClick={() => {
                    setType(t.value)
                    remember({ type: t.value })
                  }}
                  className={cn(
                    "flex min-w-0 flex-col items-center gap-1.5 rounded-[2px] px-2 py-3 text-center text-[13px] leading-tight transition-colors",
                    on ? ON_BLUE : "text-foreground-2 hover:bg-elev/60 hover:text-foreground",
                  )}
                >
                  <Icon className={cn("size-[18px]", on ? "" : "text-muted-foreground")} strokeWidth={1.75} />
                  {t.label}
                </button>
              )
            })}
          </div>
        </div>

        <div className="xl:col-span-3">
          <Label>Вид</Label>
          <Seg
            value={kind}
            onChange={(v) => {
              setKind(v as InfoKind)
              remember({ kind: v as InfoKind })
            }}
            options={[
              ["animated", "Анимированная", "mp4: элементы появляются по очереди"],
              ["static", "Статичная", "png; у схемы боя — по картинке на фазу"],
            ]}
          />
        </div>
        <div className="xl:col-span-2">
          <Label>Формат</Label>
          <Seg
            mono
            value={format}
            onChange={(v) => {
              setFormat(v as InfoSettings["format"])
              remember({ format: v as InfoSettings["format"] })
            }}
            options={[
              ["16:9", "16:9"],
              ["9:16", "9:16"],
            ]}
          />
        </div>
        <div className="xl:col-span-3">
          <Label>Качество</Label>
          <Seg
            mono
            value={quality}
            onChange={(v) => {
              setQuality(v as InfoSettings["quality"])
              remember({ quality: v as InfoSettings["quality"] })
            }}
            options={(options?.qualities ?? []).map((q) => [q.value, q.label, q.value === "2160" ? "рендер заметно дольше" : ""] as const)}
          />
        </div>
        <div className="xl:col-span-2">
          <Label aside={kind === "animated" ? <span className="font-mono text-[11px] text-faint">сек</span> : undefined}>Длительность</Label>
          <input
            value={kind === "animated" ? duration : ""}
            disabled={kind !== "animated"}
            onChange={(e) => {
              const v = e.target.value.replace(/[^\d.,]/g, "").slice(0, 4)
              setDuration(v)
              remember({ duration: v })
            }}
            placeholder={kind === "animated" ? "авто" : "—"}
            inputMode="decimal"
            title={`Авто — по количеству данных; или от ${limits?.min_sec ?? 3} до ${limits?.max_sec ?? 60} с на каждую`}
            className={cn(INPUT, "font-mono disabled:opacity-50", !durOk && "border-danger text-danger")}
          />
        </div>
        <div className="xl:col-span-2">
          <Label>Сколько, до</Label>
          <input
            value={count}
            onChange={(e) => setCount(e.target.value.replace(/\D/g, "").slice(0, 2))}
            placeholder={type === "auto" ? String(maxAuto) : "1"}
            inputMode="numeric"
            title="Сколько инфографик сделать из текста, не больше"
            className={cn(INPUT, "font-mono", !countOk && "border-danger text-danger")}
          />
        </div>

        <div className="md:col-span-2 xl:col-span-8">
          <Label>Стиль</Label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {(options?.styles ?? []).map((s) => {
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
                    "flex min-w-0 items-center gap-2.5 rounded-[3px] border p-1.5 pr-2.5 text-left transition-colors",
                    on ? "border-pick/60 bg-pick-soft" : "border-line-strong hover:border-faint",
                  )}
                >
                  <StyleSwatch style={s.value} className="h-10 w-16 shrink-0" />
                  <span className={cn("min-w-0 text-[13px] leading-tight", on ? "font-medium text-pick-text" : "text-foreground-2")}>{s.label}</span>
                </button>
              )
            })}
          </div>
        </div>
        <div className="md:col-span-2 xl:col-span-4">
          <Label>Слой для монтажа</Label>
          <Toggle
            on={alpha}
            hint={kind === "animated" ? "Второй файл ProRes 4444 с прозрачным фоном: класть поверх видео. Большой файл, рендер в 2–3 раза дольше." : "Второй PNG без фона"}
            onClick={() => {
              setAlpha(!alpha)
              remember({ alpha: !alpha })
            }}
          >
            Прозрачный фон {kind === "animated" ? "(.mov)" : "(.png)"}
          </Toggle>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-3">
        <span className="min-w-0 truncate font-mono text-[11px] text-muted-foreground">
          {meta}
        </span>
        <button type="button" disabled={!ready || create.isPending} onClick={() => create.mutate()} className={BTN_PRIMARY}>
          {create.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Wand2 className="size-3.5" />}
          Сделать инфографику
        </button>
      </div>
    </section>
  )
}
