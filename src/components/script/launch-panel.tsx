"use client"

import { useEffect, useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Film, Loader2, Sparkles, X } from "lucide-react"
import { toast } from "sonner"

import { AttachButton, minutes, num } from "@/components/script/parts"
import { setUrlParams, skeys, useScenarioOptions } from "@/components/script/queries"
import { BTN_PRIMARY, BTN_SECONDARY, INPUT, Label, ON_GREEN, Pick } from "@/components/script/ui"
import { scenario, type ScenarioNiche, type ScenarioOptions } from "@/lib/api"
import { cn } from "@/lib/utils"

const REMEMBER = "scenario.launch"
const YT_RE = /(?:youtube\.com\/(?:watch|shorts|live)|youtu\.be\/)\S+/gi

function loadRemembered(): { niche?: string; model?: string } {
  try {
    return JSON.parse(localStorage.getItem(REMEMBER) || "{}")
  } catch {
    return {}
  }
}

export function nicheLength(n: ScenarioNiche | undefined, options: ScenarioOptions | undefined) {
  const i = n?.defaults.inputs ?? {}
  const lang = (n?.defaults.language ?? "").toLowerCase()
  const cpm = i.chars_per_minute || options?.chars_per_minute[lang] || options?.chars_per_minute.default || 1000
  if (i.target_chars) return { chars: i.target_chars, minutes: i.target_chars / cpm }
  if (i.duration_minutes) return { chars: i.duration_minutes * cpm, minutes: i.duration_minutes }
  return null
}

export function LaunchPanel() {
  const qc = useQueryClient()
  const { data: options } = useScenarioOptions()
  const [title, setTitle] = useState("")
  const [niche, setNiche] = useState("")
  const [length, setLength] = useState("")
  const [model, setModel] = useState("")
  const [lang, setLang] = useState<string | null>(null)
  const [text, setText] = useState("")
  const [files, setFiles] = useState<{ name: string; text: string }[]>([])

  useEffect(() => {
    const r = loadRemembered()
    const t = setTimeout(() => {
      if (r.niche) setNiche(r.niche)
      if (r.model) setModel(r.model)
    }, 0)
    return () => clearTimeout(t)
  }, [])
  const remember = (patch: { niche?: string; model?: string }) => {
    try {
      localStorage.setItem(REMEMBER, JSON.stringify({ ...loadRemembered(), ...patch }))
    } catch {}
  }

  const n = options?.niches.find((x) => x.slug === niche)
  const nicheLang = (n?.defaults.language ?? "").toLowerCase()
  const effLang = lang ?? (nicheLang || null)
  const nl = nicheLength(n, options)
  const tone = n?.defaults.inputs?.tone
  const videos = (text.match(YT_RE) ?? []).length
  const empty = !title.trim() && !text.trim() && !files.length

  const create = useMutation({
    mutationFn: (now: boolean) =>
      scenario.createProject({
        title: title.trim(),
        topic: title.trim(),
        niche,
        materials: text,
        files,
        model,
        language: lang ?? "",
        length: length.trim(),
        brief: !now,
        launch_now: now,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: skeys.projects })
      setTitle("")
      setText("")
      setFiles([])
      setLength("")
      setLang(null)
    },
    onError: (e) => toast.error(e.message),
  })

  const meta = [
    length.trim() ? length.trim() : nl ? `${minutes(nl.minutes)} ≈ ${num(nl.chars)} симв. · из ниши` : "",
    tone ? `тон: ${tone}` : "",
  ].filter(Boolean)

  return (
    <section className="mb-6 rounded-[4px] border border-line bg-surface">
      <div className="grid grid-cols-1 gap-x-5 gap-y-5 p-5 md:grid-cols-2 xl:grid-cols-12">
        <div className="xl:col-span-4">
          <Label>Название</Label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Битва при Гастингсе, 1066" className={INPUT} />
        </div>
        <div className="xl:col-span-3">
          <Label
            aside={
              <button type="button" onClick={() => setUrlParams({ tab: "niches", p: null })} className="text-xs text-faint hover:text-foreground">
                ниши →
              </button>
            }
          >
            Ниша
          </Label>
          <Pick
            value={niche}
            onChange={(v) => {
              setNiche(v)
              remember({ niche: v })
            }}
            placeholder="Без ниши"
            options={[
              ...(options?.niches ?? []).map((x) => {
                const l = nicheLength(x, options)
                return { value: x.slug, label: x.name, hint: [x.defaults.language?.toUpperCase(), l ? minutes(l.minutes) : ""].filter(Boolean).join(" · ") }
              }),
              { value: "", label: "Без ниши" },
            ]}
          />
        </div>
        <div className="xl:col-span-2">
          <Label>Длительность</Label>
          <input
            value={length}
            onChange={(e) => setLength(e.target.value)}
            placeholder={nl ? minutes(nl.minutes) : "20 мин или 18000"}
            className={cn(INPUT, "font-mono", length.trim() && "border-pick/40 text-pick-text")}
          />
        </div>
        <div className="md:col-span-2 xl:col-span-3">
          <Label>Модель</Label>
          <Pick
            value={model}
            onChange={(v) => {
              setModel(v)
              remember({ model: v })
            }}
            placeholder="По этапам"
            options={[
              { value: "", label: "По этапам", hint: "настройки" },
              ...(options?.models ?? []).map((m) => ({ value: m.value, label: m.label.replace(/ \(Medium\)$/, ""), hint: m.backend_label })),
            ]}
          />
        </div>

        <div className="md:col-span-2 xl:col-span-8">
          <Label>Тема и материалы</Label>
          <div className="rounded-[3px] border border-line-strong bg-background focus-within:border-electric/60">
            <textarea
              rows={3}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="О чём фильм, главная мысль, факты, источники, пожелания, ссылки на ролики по теме"
              className="block w-full resize-y bg-transparent p-3 text-sm leading-relaxed outline-none placeholder:text-faint"
            />
            <div className="flex flex-wrap items-center gap-2 border-t border-line px-2 py-1.5">
              <AttachButton onText={(f) => setFiles((x) => [...x, f])} />
              {files.map((f, i) => (
                <span key={i} className="flex items-center gap-1 rounded-[2px] bg-surface-2 px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
                  {f.name}
                  <button type="button" onClick={() => setFiles((x) => x.filter((_, k) => k !== i))} className="hover:text-danger">
                    <X className="size-3" />
                  </button>
                </span>
              ))}
              {videos > 0 && (
                <span className="flex items-center gap-1 rounded-[2px] bg-pick-soft px-1.5 py-0.5 font-mono text-[11px] text-pick-text">
                  <Film className="size-3" /> {videos} {videos === 1 ? "ролик" : videos < 5 ? "ролика" : "роликов"}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="md:col-span-2 xl:col-span-4">
          <Label>Язык</Label>
          <div className="grid grid-cols-5 gap-[3px] rounded-[3px] bg-surface-2 p-[3px]">
            {(options?.languages ?? []).map((l) => (
              <button
                key={l.code}
                type="button"
                title={l.name}
                onClick={() => setLang(l.code === lang ? null : l.code)}
                className={cn(
                  "rounded-[2px] py-2 font-mono text-[13px] uppercase transition-colors",
                  effLang === l.code ? ON_GREEN : "text-faint hover:text-foreground-2"
                )}
              >
                {l.code}
              </button>
            ))}
            {nicheLang && (
              <span className="grid place-items-center font-mono text-[11px] text-faint">{lang && lang !== nicheLang ? "" : "из ниши"}</span>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-3">
        <span className="min-w-0 truncate font-mono text-[11px] text-muted-foreground">{meta.join(" · ")}</span>
        <div className="flex items-center gap-2">
          <button type="button" disabled={empty || create.isPending} onClick={() => create.mutate(true)} className={cn(BTN_SECONDARY, "disabled:opacity-50")}>
            Сразу сценарий
          </button>
          <button type="button" disabled={empty || create.isPending} onClick={() => create.mutate(false)} className={BTN_PRIMARY}>
            {create.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
            Бриф и план
          </button>
        </div>
      </div>
    </section>
  )
}
