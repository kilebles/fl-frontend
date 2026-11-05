"use client"

import { useEffect, useRef, useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Clapperboard, FileText, Loader2, Mic, Paperclip, X } from "lucide-react"
import { toast } from "sonner"

import { PRESETS, SharesAside, SharesRows, clock, parasText, roundShares, sharesSum, shotsText } from "@/components/reels/parts"
import { rkeys, useReelOptions, useReelVoiceSources } from "@/components/reels/queries"
import { BTN_PRIMARY, INPUT, Label, ON_BLUE, Pick } from "@/components/script/ui"
import { reels, type ReelShares } from "@/lib/api"
import { useCurrentProject } from "@/lib/project"
import { cn } from "@/lib/utils"

const REMEMBER = "reels.launch"

type Remembered = { from?: "voice" | "file"; engine?: string; shares?: ReelShares; notes?: string }

function loadRemembered(): Remembered {
  try {
    return JSON.parse(localStorage.getItem(REMEMBER) || "{}")
  } catch {
    return {}
  }
}

export function LaunchPanel() {
  const qc = useQueryClient()
  const [projectId] = useCurrentProject()
  const { data: options } = useReelOptions()
  const [from, setFrom] = useState<"voice" | "file">("voice")
  const { data: voices, error: voiceError, isLoading: voicesLoading } = useReelVoiceSources(from === "voice")
  const [voice, setVoice] = useState("")
  const [script, setScript] = useState<File | null>(null)
  const [title, setTitle] = useState("")
  const [engine, setEngine] = useState("")
  const [shares, setShares] = useState<ReelShares>(PRESETS[0].shares)
  const [notes, setNotes] = useState("")
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const r = loadRemembered()
    const t = setTimeout(() => {
      if (r.from) setFrom(r.from)
      if (r.engine !== undefined) setEngine(r.engine)
      if (r.shares) setShares(roundShares(r.shares))
      if (r.notes) setNotes(r.notes)
    }, 0)
    return () => clearTimeout(t)
  }, [])
  const remember = (patch: Remembered) => {
    try {
      localStorage.setItem(REMEMBER, JSON.stringify({ ...loadRemembered(), ...patch }))
    } catch {}
  }

  const v = voices?.find((x) => String(x.id) === voice)
  const sumOk = sharesSum(shares) === 100
  const ready = (from === "voice" ? !!v : !!script) && sumOk

  const create = useMutation({
    mutationFn: () =>
      reels.create(
        {
          title: title.trim(),
          project_id: projectId,
          source: from,
          voice_job: from === "voice" && v ? v.id : undefined,
          shares,
          engine,
          notes: notes.trim(),
        },
        from === "file" ? script : null,
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: rkeys.list })
      setTitle("")
      setScript(null)
      setVoice("")
    },
    onError: (e) => toast.error(e.message),
  })

  // что получится: длительность и число кадров; минуты каждой категории — в строках долей
  const sec = from === "voice" && v?.duration_sec ? v.duration_sec + (v.paragraphs || 0) : 0
  const meta =
    from === "voice"
      ? v
        ? [
            parasText(v.paragraphs),
            sec ? `${clock(sec)} по озвучке ${v.language.toUpperCase()}` : "без озвучки — длительность по тексту",
            sec ? `≈ ${shotsText(Math.round(sec / 5.5))}` : "",
          ]
        : []
      : script
        ? [script.name, "длительность по тексту"]
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
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className={cn("flex h-7 min-w-0 items-center gap-1.5 rounded-[2px] px-2 text-xs", script ? ON_BLUE : "text-muted-foreground hover:bg-elev hover:text-foreground")}
              >
                <FileText className="size-3.5 shrink-0" />
                <span className="truncate">{script?.name ?? "Сценарий .docx .txt .md"}</span>
              </button>
              <input
                ref={fileRef}
                type="file"
                accept=".docx,.txt,.md"
                className="hidden"
                onChange={(e) => {
                  setScript(e.target.files?.[0] ?? null)
                  e.target.value = ""
                }}
              />
              {script && (
                <button type="button" onClick={() => setScript(null)} className="ml-auto grid size-7 shrink-0 place-items-center text-faint hover:text-danger">
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
            placeholder={from === "voice" ? v?.title || "как в «Озвучке»" : script?.name.replace(/\.[^.]+$/, "") || "из сценария"}
            className={INPUT}
          />
        </div>
        <div className="xl:col-span-3">
          <Label>Модель раскадровки</Label>
          <Pick
            value={engine}
            onChange={(e) => {
              setEngine(e)
              remember({ engine: e })
            }}
            options={[
              { value: "", label: "Из настроек", hint: options?.defaults.engine ?? "" },
              ...(options?.engines ?? []).map((e) => ({ value: e.value, label: e.label, hint: e.model })),
            ]}
          />
        </div>

        <div className="md:col-span-2 xl:col-span-7">
          <Label
            aside={
              <SharesAside
                value={shares}
                onChange={(s) => {
                  setShares(s)
                  remember({ shares: s })
                }}
              />
            }
          >
            Доли материала, % экранного времени
          </Label>
          <SharesRows
            value={shares}
            seconds={sec}
            onChange={(s) => {
              setShares(s)
              remember({ shares: s })
            }}
          />
        </div>
        <div className="flex flex-col md:col-span-2 xl:col-span-5">
          <Label aside={<span className="font-mono text-[11px] text-faint">для модели</span>}>Правила ниши</Label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={() => remember({ notes: notes.trim() })}
            rows={3}
            placeholder="Например: без детей, без крови, сцены боя только издалека"
            className="min-h-[86px] w-full flex-1 resize-none rounded-[3px] border border-line-strong bg-background px-3 py-2 text-sm outline-none placeholder:text-faint focus:border-electric/60"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-3">
        <span className="min-w-0 truncate font-mono text-[11px] text-muted-foreground">
          {!sumOk ? <span className="text-danger">Доли должны давать 100%</span> : meta.filter(Boolean).join(" · ")}
        </span>
        <button type="button" disabled={!ready || create.isPending} onClick={() => create.mutate()} className={BTN_PRIMARY}>
          {create.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Clapperboard className="size-3.5" />}
          Раскадровка
        </button>
      </div>
    </section>
  )
}
