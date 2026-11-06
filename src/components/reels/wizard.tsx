"use client"

import { useEffect, useRef, useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { ArrowLeft, ArrowRight, Check, Clapperboard, Loader2 } from "lucide-react"
import { toast } from "sonner"

import { sharesSum } from "@/components/reels/parts"
import { rkeys, useReelOptions, useReelVoiceSources } from "@/components/reels/queries"
import { EMPTY, clearDraft, loadDraft, saveDraft, type Draft } from "@/components/reels/wizard-draft"
import { footageBody, introBody, introOk } from "@/components/reels/wizard-advanced"
import {
  HostStep,
  MontageStep,
  NicheStep,
  ScriptStep,
  StoryboardStep,
  SummaryStep,
  VoiceStep,
  shareText,
  type StepProps,
} from "@/components/reels/wizard-steps"
import { BTN_PRIMARY, BTN_SECONDARY } from "@/components/script/ui"
import { reels } from "@/lib/api"
import { useCurrentProject } from "@/lib/project"
import { cn } from "@/lib/utils"

const STEPS = [
  { key: "niche", label: "Ниша", body: NicheStep },
  { key: "script", label: "Сценарий", body: ScriptStep },
  { key: "voice", label: "Озвучка", body: VoiceStep },
  { key: "host", label: "Ведущий", body: HostStep },
  { key: "storyboard", label: "Раскадровка", body: StoryboardStep },
  { key: "montage", label: "Монтаж", body: MontageStep },
] as const

const HEADINGS = [
  "Выберите нишу или создайте новую — она подставит остальные настройки",
  "Сценарий: написать по теме или взять готовый",
  "Голоса и языки перевода",
  "Ведущий в кадре",
  "Из чего собрать картинку",
  "Стиль монтажа и музыки",
  "Проверьте и запустите",
]

export function ReelWizard({ onCreated }: { onCreated: (id: string) => void }) {
  const qc = useQueryClient()
  const [projectId] = useCurrentProject()
  const { data: options } = useReelOptions()
  const [d, setD] = useState<Draft>(EMPTY)
  const [file, setFile] = useState<File | null>(null)
  const loaded = useRef(false)
  const { data: voices } = useReelVoiceSources(d.script.mode === "ready" && d.script.from === "voice")

  useEffect(() => {
    const t = setTimeout(() => {
      setD(loadDraft())
      loaded.current = true
    }, 0)
    return () => clearTimeout(t)
  }, [])
  useEffect(() => {
    if (loaded.current) saveDraft(d)
  }, [d])

  const up: StepProps["up"] = (fn) => setD((x) => fn(x))
  const s = d.script
  const fromVoice = s.mode === "ready" && s.from === "voice"
  const ok = [
    !!d.niche,
    s.mode === "topic" ? !!s.topic.trim() && Number(s.minutes) > 0 : s.from === "voice" ? !!s.voiceJob : !!file,
    s.mode === "topic" ? !!d.voice.profile : true,
    !d.host.on || !!d.host.id,
    sharesSum(d.storyboard.shares) === 100 && introOk(d),
    !!d.montage.style,
  ]
  const reachable = (i: number) => ok.slice(0, i).every(Boolean)
  const montageLabel = options?.montage.find((m) => m.value === d.montage.style)?.label ?? d.montage.style
  const v = voices?.find((x) => String(x.id) === s.voiceJob)
  const summary = [
    d.nicheName || "не выбрана",
    s.mode === "topic" ? (s.topic ? `${s.minutes} мин · ${s.language.toUpperCase()}` : "по теме") : fromVoice ? (v?.title ?? "из «Озвучки»") : (file?.name ?? "файл"),
    `${fromVoice ? "уже озвучено" : d.voice.name || "не выбран"}${d.voice.targets.length ? ` + ${d.voice.targets.length} яз.` : ""}`,
    d.host.on ? d.host.name || "не выбран" : "без ведущего",
    shareText(d.storyboard.shares, d.host.on) + (d.intro.on ? ` · вступление ${Math.round(d.intro.sec / 60)} мин` : ""),
    montageLabel,
  ]

  const go = (i: number) => up((x) => ({ ...x, step: i }))
  const launch = useMutation({
    mutationFn: () =>
      reels.create(
        {
          title: d.title.trim(),
          project_id: projectId,
          source: s.mode === "topic" ? "topic" : s.from,
          voice_job: fromVoice && s.voiceJob ? Number(s.voiceJob) : undefined,
          niche: d.niche,
          niche_name: d.nicheName,
          script: { mode: s.mode, topic: s.topic, minutes: Number(s.minutes) || null, language: s.language, tone: s.tone, model: s.model, notes: s.notes },
          voice: d.voice,
          avatar: d.host.on ? { id: d.host.id, name: d.host.name, voice: d.host.voice } : { id: "" },
          storyboard: {
            ...d.storyboard,
            model: d.storyboard.engine ? d.storyboard.model : "",
            pauses: { modes: d.storyboard.pauses.modes, sec: d.storyboard.pauses.sec, every_sec: d.storyboard.pauses.everySec },
          },
          montage: d.montage,
          footage: { video: footageBody(d.footage.video), history: footageBody(d.footage.history) },
          intro: introBody(d.intro),
          format: d.format,
        },
        s.mode === "ready" && s.from === "file" ? file : null,
      ),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: rkeys.list })
      clearDraft()
      onCreated(r.id)
    },
    onError: (e) => toast.error(e.message),
  })

  const step = Math.min(d.step, STEPS.length)
  const Body = step < STEPS.length ? STEPS[step].body : null

  return (
    <div className="space-y-5">
      <ol className="grid grid-cols-2 gap-px overflow-hidden rounded-[4px] border border-line bg-line sm:grid-cols-3 xl:grid-cols-6">
        {STEPS.map((st, i) => {
          const can = reachable(i)
          const active = i === step
          const done = ok[i] && i !== step && (i < step || d.step >= STEPS.length)
          return (
            <li key={st.key} className="min-w-0 bg-surface">
              <button
                type="button"
                disabled={!can}
                onClick={() => go(i)}
                className={cn("flex w-full min-w-0 items-start gap-2.5 px-3.5 py-3 text-left transition-colors", can && !active && "hover:bg-surface-2", active && "bg-pick-soft/60")}
              >
                <span
                  className={cn(
                    "grid size-6 shrink-0 place-items-center rounded-[3px] font-mono text-[11px]",
                    active ? "bg-pick text-white" : done ? "bg-ok/15 text-ok" : "border border-line-strong text-faint",
                  )}
                >
                  {done ? <Check className="size-3.5" /> : i + 1}
                </span>
                <span className="min-w-0">
                  <span className={cn("block text-sm", active ? "font-medium text-pick-text" : can ? "text-foreground" : "text-faint")}>{st.label}</span>
                  <span className="block truncate font-mono text-[11px] text-faint">{can || active ? summary[i] : ""}</span>
                </span>
              </button>
            </li>
          )
        })}
      </ol>

      <section className="rounded-[4px] border border-line bg-surface">
        <div className="flex min-h-12 items-center justify-between gap-3 border-b border-line px-5 py-3">
          <h2 className="text-[15px] font-semibold">
            {step < STEPS.length && <span className="mr-2 font-mono text-[13px] text-faint">{step + 1}/6</span>}
            {HEADINGS[step]}
          </h2>
        </div>
        <div className="p-5">
          {Body ? (
            <Body d={d} up={up} file={file} setFile={setFile} />
          ) : (
            <SummaryStep d={d} up={up} file={file} setFile={setFile} onJump={go} montageLabel={montageLabel} />
          )}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-3">
          <button type="button" disabled={step === 0} onClick={() => go(step - 1)} className={cn(BTN_SECONDARY, "disabled:opacity-40")}>
            <ArrowLeft className="size-3.5" />
            Назад
          </button>
          {step < STEPS.length ? (
            <button type="button" disabled={!ok[step]} onClick={() => go(step + 1)} className={BTN_PRIMARY}>
              {step === STEPS.length - 1 ? "К проверке" : "Далее"}
              <ArrowRight className="size-3.5" />
            </button>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" disabled={!ok.every(Boolean) || launch.isPending} onClick={() => launch.mutate()} className={BTN_PRIMARY}>
                {launch.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Clapperboard className="size-3.5" />}
                Запустить
              </button>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
