"use client"

import { useEffect, useRef, useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { AlertTriangle, Check, FileAudio, FileText, Loader2, Mic, Paperclip, ScanSearch, X } from "lucide-react"
import { toast } from "sonner"

import { GROUPS, GROUP_COLOR, GROUP_HINT, GROUP_LABEL, clock, shotsText } from "@/components/footage/parts"
import { fkeys, useFootageOptions, useVoiceSources } from "@/components/footage/queries"
import { BTN_PRIMARY, BTN_SECONDARY, INPUT, Label, ON_BLUE, Pick } from "@/components/script/ui"
import { footage, type FootageGroup } from "@/lib/api"
import { cn } from "@/lib/utils"

const REMEMBER = "footage.launch"
const PRESETS = ["6", "7", "8"]

type Opts = { yt_first: boolean; yt_trusted: boolean; yt_any: boolean; film_risky: boolean }
type Remembered = { from?: "voice" | "file"; engine?: string; groups?: FootageGroup[]; opts?: Opts; score?: string; format?: "16:9" | "9:16" }

function loadRemembered(): Remembered {
  try {
    return JSON.parse(localStorage.getItem(REMEMBER) || "{}")
  } catch {
    return {}
  }
}

function Toggle({ on, onClick, children, warn }: { on: boolean; onClick: () => void; children: React.ReactNode; warn?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex h-8 items-center gap-1.5 rounded-[3px] border px-2.5 text-xs transition-colors",
        on
          ? warn
            ? "border-warn/50 bg-warn-soft font-medium text-warn"
            : cn("border-pick/40", ON_BLUE)
          : "border-line-strong text-muted-foreground hover:text-foreground",
      )}
    >
      <span className={cn("grid size-3.5 place-items-center rounded-[2px] border", on ? "border-transparent bg-current/20" : "border-line-strong")}>
        {on && <Check className="size-2.5" />}
      </span>
      {children}
      {warn && <AlertTriangle className="size-3" />}
    </button>
  )
}

/** Threshold: 6 / 7 / 8 or any number typed in (e.g. 7.5). */
function Threshold({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const custom = !PRESETS.includes(value)
  const bad = custom && value !== "" && !(Number(value.replace(",", ".")) >= 0 && Number(value.replace(",", ".")) <= 10)
  return (
    <div className="grid grid-cols-[1fr_1fr_1fr_1.3fr] gap-[3px] rounded-[3px] bg-surface-2 p-[3px]">
      {PRESETS.map((v) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          className={cn("rounded-[2px] py-2 font-mono text-[13px] transition-colors", value === v ? ON_BLUE : "text-foreground-2 hover:text-foreground")}
        >
          {v}
        </button>
      ))}
      <input
        value={custom ? value : ""}
        onChange={(e) => onChange(e.target.value.replace(/[^\d.,]/g, "").slice(0, 4))}
        placeholder="своё"
        inputMode="decimal"
        title="Своё значение от 0 до 10, например 7.5"
        className={cn(
          "w-full min-w-0 rounded-[2px] bg-transparent px-1 text-center font-mono text-[13px] outline-none placeholder:font-sans placeholder:text-xs placeholder:text-faint",
          custom && value && !bad && ON_BLUE,
          bad && "text-danger",
        )}
      />
    </div>
  )
}

function FilePick({
  file,
  accept,
  icon: Icon,
  label,
  onFile,
}: {
  file: File | null
  accept: string
  icon: typeof FileText
  label: string
  onFile: (f: File | null) => void
}) {
  const ref = useRef<HTMLInputElement>(null)
  return (
    <>
      <button
        type="button"
        onClick={() => ref.current?.click()}
        className={cn(
          "flex h-7 min-w-0 items-center gap-1.5 rounded-[2px] px-2 text-xs",
          file ? ON_BLUE : "text-muted-foreground hover:bg-elev hover:text-foreground",
        )}
      >
        <Icon className="size-3.5 shrink-0" />
        <span className="truncate">{file?.name ?? label}</span>
      </button>
      <input
        ref={ref}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          onFile(e.target.files?.[0] ?? null)
          e.target.value = ""
        }}
      />
    </>
  )
}

export function LaunchPanel() {
  const qc = useQueryClient()
  const { data: options } = useFootageOptions()
  const [from, setFrom] = useState<"voice" | "file">("voice")
  const { data: voices, error: voiceError, isLoading: voicesLoading } = useVoiceSources(from === "voice")
  const [voice, setVoice] = useState("")
  const [script, setScript] = useState<File | null>(null)
  const [audio, setAudio] = useState<File | null>(null)
  const [title, setTitle] = useState("")
  const [engine, setEngine] = useState("")
  const [groups, setGroups] = useState<FootageGroup[]>(GROUPS)
  const [opts, setOpts] = useState<Opts>({ yt_first: false, yt_trusted: true, yt_any: false, film_risky: false })
  const [score, setScore] = useState("")
  const [format, setFormat] = useState<"16:9" | "9:16">("16:9")

  useEffect(() => {
    const r = loadRemembered()
    const t = setTimeout(() => {
      if (r.from) setFrom(r.from)
      if (r.engine !== undefined) setEngine(r.engine)
      if (r.groups?.length) setGroups(r.groups)
      if (r.opts) setOpts(r.opts)
      if (r.score) setScore(r.score)
      if (r.format) setFormat(r.format)
    }, 0)
    return () => clearTimeout(t)
  }, [])
  const remember = (patch: Remembered) => {
    try {
      localStorage.setItem(REMEMBER, JSON.stringify({ ...loadRemembered(), ...patch }))
    } catch {}
  }

  const def = options?.defaults
  const effScore = score || (def?.min_score != null ? String(def.min_score) : "7")
  const scoreNum = Number(effScore.replace(",", "."))
  const scoreOk = effScore !== "" && scoreNum >= 0 && scoreNum <= 10
  const v = voices?.find((x) => String(x.id) === voice)
  const ready = (from === "voice" ? !!v : !!script) && groups.length > 0 && scoreOk

  const create = useMutation({
    mutationFn: (planOnly: boolean) =>
      footage.create(
        {
          title: title.trim(),
          source: from,
          voice_job: from === "voice" && v ? v.id : undefined,
          options: { engine, groups, ...opts, min_score: scoreNum, format, plan_only: planOnly },
        },
        from === "file" ? script : null,
        from === "file" ? audio : null,
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: fkeys.projects })
      setTitle("")
      setScript(null)
      setAudio(null)
      setVoice("")
    },
    onError: (e) => toast.error(e.message),
  })

  const shots = v?.duration_sec ? Math.round(v.duration_sec / 6) : 0
  const meta =
    from === "voice"
      ? v
        ? [
            `${v.paragraphs} абзацев`,
            v.duration_sec ? `длительность по озвучке ${v.language.toUpperCase()} · ${clock(v.duration_sec)}` : "без озвучки — длительность по тексту",
            shots ? `≈ ${shotsText(shots)}` : "",
          ]
        : []
      : script
        ? [script.name, audio ? `озвучка: ${audio.name}` : "без озвучки — длительность по тексту"]
        : []

  return (
    <section className="mb-6 rounded-[4px] border border-line bg-surface">
      <div className="grid grid-cols-1 gap-x-5 gap-y-5 p-5 md:grid-cols-2 xl:grid-cols-12">
        <div className="md:col-span-2 xl:col-span-6">
          <Label
            aside={
              <div className="flex gap-0.5 rounded-[3px] bg-surface-2 p-0.5 text-xs">
                {(
                  [
                    ["voice", "Из озвучки", Mic],
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
            Сценарий
          </Label>
          {from === "voice" ? (
            <Pick
              value={voice}
              onChange={setVoice}
              placeholder={voiceError ? "Озвучка недоступна" : voicesLoading ? "Загрузка…" : voices?.length ? "Проект из «Озвучки»" : "Проектов озвучки нет"}
              options={(voices ?? []).map((s) => ({
                value: String(s.id),
                label: s.title,
                hint: [s.language.toUpperCase(), `${s.paragraphs} абз.`, s.duration_sec ? clock(s.duration_sec) : "без озвучки"].join(" · "),
              }))}
            />
          ) : (
            <div className="flex h-10 items-center gap-1 rounded-[3px] border border-dashed border-line-strong bg-background px-1.5">
              <FilePick file={script} accept=".docx,.txt,.md" icon={FileText} label="Сценарий .docx .txt .md" onFile={setScript} />
              <FilePick file={audio} accept=".zip" icon={FileAudio} label="Озвучка .zip" onFile={setAudio} />
              {(script || audio) && (
                <button
                  type="button"
                  onClick={() => {
                    setScript(null)
                    setAudio(null)
                  }}
                  className="ml-auto grid size-7 shrink-0 place-items-center text-faint hover:text-danger"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>
          )}
        </div>
        <div className="xl:col-span-3">
          <Label>Название</Label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={from === "voice" ? v?.title || "как в «Озвучке»" : script?.name.replace(/\.[^.]+$/, "") || "из имени файла"}
            className={INPUT}
          />
        </div>
        <div className="xl:col-span-3">
          <Label>Движок</Label>
          <Pick
            value={engine}
            onChange={(e) => {
              setEngine(e)
              remember({ engine: e })
            }}
            options={[{ value: "", label: "Из настроек", hint: def?.engine ? def.engine : "" }, ...(options?.engines ?? [])]}
          />
        </div>

        <div className="md:col-span-2 xl:col-span-7">
          <Label>Источники</Label>
          <div className="grid grid-cols-2 gap-[3px] rounded-[3px] bg-surface-2 p-[3px] sm:grid-cols-4">
            {GROUPS.map((g) => {
              const on = groups.includes(g)
              return (
                <button
                  key={g}
                  type="button"
                  title={GROUP_HINT[g]}
                  onClick={() => {
                    const next = on ? groups.filter((y) => y !== g) : GROUPS.filter((y) => y === g || groups.includes(y))
                    setGroups(next)
                    remember({ groups: next })
                  }}
                  className={cn(
                    "flex items-center justify-center gap-2 rounded-[2px] py-2 text-sm transition-colors",
                    on ? ON_BLUE : "text-faint hover:text-foreground-2",
                  )}
                >
                  <span className={cn("size-2 rounded-full", on ? GROUP_COLOR[g] : "bg-line-strong")} />
                  {GROUP_LABEL[g]}
                </button>
              )
            })}
          </div>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {(
              [
                ["yt_first", "YouTube первым", false],
                ["yt_trusted", "YouTube: гос. архивы", false],
                ["yt_any", "YouTube: любые лицензии", true],
                ["film_risky", "Фильмы 1931–1963", true],
              ] as const
            ).map(([k, label, warn]) => (
              <Toggle
                key={k}
                on={opts[k]}
                warn={warn}
                onClick={() => {
                  const next = { ...opts, [k]: !opts[k] }
                  setOpts(next)
                  remember({ opts: next })
                }}
              >
                {label}
              </Toggle>
            ))}
          </div>
        </div>
        <div className="xl:col-span-3">
          <Label aside={<span className="font-mono text-[11px] text-faint">ниже — на ИИ</span>}>Порог</Label>
          <Threshold
            value={effScore}
            onChange={(s) => {
              setScore(s)
              remember({ score: s })
            }}
          />
        </div>
        <div className="xl:col-span-2">
          <Label>Формат</Label>
          <div className="flex rounded-[3px] bg-surface-2 p-[3px]">
            {(["16:9", "9:16"] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => {
                  setFormat(f)
                  remember({ format: f })
                }}
                className={cn(
                  "flex-1 rounded-[2px] py-2 font-mono text-[13px] transition-colors",
                  format === f ? ON_BLUE : "text-foreground-2 hover:text-foreground",
                )}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-3">
        <span className="min-w-0 truncate font-mono text-[11px] text-muted-foreground">{meta.filter(Boolean).join(" · ")}</span>
        <div className="flex items-center gap-2">
          <button type="button" disabled={!ready || create.isPending} onClick={() => create.mutate(true)} className={cn(BTN_SECONDARY, "disabled:opacity-50")}>
            Только шот-лист
          </button>
          <button type="button" disabled={!ready || create.isPending} onClick={() => create.mutate(false)} className={BTN_PRIMARY}>
            {create.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <ScanSearch className="size-3.5" />}
            Найти видео
          </button>
        </div>
      </div>
    </section>
  )
}
