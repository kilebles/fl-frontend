"use client"

import { useRef, useState } from "react"
import Link from "next/link"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { AlertTriangle, Check, FileText, Loader2, Mic, Paperclip, Plus, UserRound, UserRoundX, X } from "lucide-react"
import { toast } from "sonner"

import {
  BASE_CATEGORIES,
  CATEGORIES,
  MixBar,
  STYLES,
  STYLE_LABEL,
  SharesAside,
  SharesRows,
  clock,
  isRealistic,
  sharesSum,
  shotsText,
} from "@/components/reels/parts"
import { useReelOptions, useReelVoiceSources } from "@/components/reels/queries"
import { FootageSettings, IntroSettings, footageText, fromPreset } from "@/components/reels/wizard-advanced"
import { LEVEL_LABEL, familyOf, levelOf, withLevel } from "@/lib/voice-models"
import type { Draft } from "@/components/reels/wizard-draft"
import { skeys, useNiches, useScenarioOptions } from "@/components/script/queries"
import { BTN_PRIMARY, BTN_SECONDARY, INPUT, Label, ON_BLUE, Pick, Seg } from "@/components/script/ui"
import { reels, scenario, voice, type ReelSettings, type ReelShares, type ScenarioNiche } from "@/lib/api"
import { useAvatars } from "@/lib/queries"
import { cn } from "@/lib/utils"

export type Up = (fn: (d: Draft) => Draft) => void
export type StepProps = { d: Draft; up: Up; file: File | null; setFile: (f: File | null) => void }

const TEXTAREA =
  "w-full resize-none rounded-[3px] border border-line-strong bg-background px-3 py-2 text-sm outline-none placeholder:text-faint focus:border-electric/60"

function Note({ children, tone }: { children: React.ReactNode; tone?: "warn" }) {
  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-[3px] border px-3 py-2.5 text-[13px] leading-relaxed",
        tone === "warn" ? "border-warn/40 bg-warn-soft text-foreground-2" : "border-line bg-surface-2/60 text-muted-foreground",
      )}
    >
      {tone === "warn" && <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-warn" />}
      <span>{children}</span>
    </div>
  )
}

/** Card choice: blue border and tick when chosen. */
function Choice({ on, onClick, children, className }: { on: boolean; onClick: () => void; children: React.ReactNode; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative flex min-w-0 flex-col items-start gap-1 rounded-[3px] border bg-background p-3.5 text-left transition-colors",
        on ? "border-pick/60 ring-1 ring-pick/30" : "border-line-strong hover:border-faint",
        className,
      )}
    >
      {on && (
        <span className="absolute top-2.5 right-2.5 grid size-4 place-items-center rounded-full bg-pick text-white">
          <Check className="size-2.5" />
        </span>
      )}
      {children}
    </button>
  )
}

/** The reel's length in seconds when it is already known (voice project or topic minutes). */
export function useReelSeconds(d: Draft): number {
  const { data: voices } = useReelVoiceSources(d.script.mode === "ready" && d.script.from === "voice")
  if (d.script.mode === "topic") return (Number(d.script.minutes) || 0) * 60
  if (d.script.from !== "voice") return 0
  const v = voices?.find((x) => String(x.id) === d.script.voiceJob)
  return v?.duration_sec ? v.duration_sec + (v.paragraphs || 0) : 0
}

/* ------------------------------------------------------------------ 1. Ниша */

export function NicheStep({ d, up }: StepProps) {
  const qc = useQueryClient()
  const { data: niches, isLoading, error } = useNiches()
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ name: "", description: "", notes: "" })
  const [busy, setBusy] = useState(false)

  const choose = async (n: Pick<ScenarioNiche, "slug" | "name" | "defaults">) => {
    let preset: Partial<ReelSettings> = {}
    try {
      preset = await qc.fetchQuery({ queryKey: ["reels", "preset", n.slug], queryFn: () => reels.preset(n.slug), staleTime: 0 })
    } catch {}
    up((x) => {
      const def = n.defaults ?? {}
      const next: Draft = { ...x, niche: n.slug, nicheName: n.name, presetFrom: "" }
      next.script = {
        ...x.script,
        language: preset.script?.language || def.language || x.script.language,
        model: preset.script?.model || def.model || "",
        tone: preset.script?.tone || def.inputs?.tone || "",
        minutes: String(preset.script?.minutes || def.inputs?.duration_minutes || x.script.minutes),
      }
      if (preset.storyboard) {
        next.presetFrom = n.name
        next.voice = {
          profile: preset.voice?.profile ?? "",
          name: preset.voice?.name ?? "",
          targets: preset.voice?.targets ?? [],
          voices: preset.voice?.voices ?? {},
          model: preset.voice?.model ?? "",
        }
        next.host = { on: !!preset.avatar?.id, id: preset.avatar?.id ?? "", name: preset.avatar?.name ?? "", voice: preset.avatar?.voice ?? "" }
        next.storyboard = {
          shares: { ...x.storyboard.shares, ...preset.storyboard.shares },
          style: preset.storyboard.style ?? x.storyboard.style,
          notes: preset.storyboard.notes ?? "",
          engine: preset.storyboard.engine ?? "",
        }
        next.montage = { style: preset.montage?.style || "classic", music: preset.montage?.music || "chapters" }
        Object.assign(next, fromPreset(preset, x))
        next.format = preset.format === "9:16" ? "9:16" : "16:9"
      }
      return next
    })
  }

  const create = async () => {
    setBusy(true)
    try {
      const n = await scenario.createNiche(form.name.trim())
      if (form.description.trim()) await scenario.patchNiche(n.slug, { description: form.description.trim() })
      if (form.notes.trim()) await scenario.addNicheNote(n.slug, { text: form.notes.trim(), passport: true })
      qc.invalidateQueries({ queryKey: skeys.niches })
      await choose({ slug: n.slug, name: n.name, defaults: n.defaults ?? {} })
      setCreating(false)
      setForm({ name: "", description: "", notes: "" })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Не получилось создать нишу")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="size-4 animate-spin text-faint" />
        </div>
      ) : error ? (
        <Note tone="warn">«Сценарий» недоступен — список ниш не загрузился: {error.message}</Note>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {(niches ?? []).map((n) => (
            <Choice key={n.slug} on={d.niche === n.slug} onClick={() => choose(n)}>
              <span className="pr-6 text-sm font-medium">{n.name}</span>
              {n.description && <span className="line-clamp-2 text-xs text-muted-foreground">{n.description}</span>}
              <span className="mt-1 font-mono text-[11px] text-faint">
                {[n.has_profile ? "паспорт есть" : "паспорта нет", `${n.notes} замет.`, `${n.videos} роликов`].join(" · ")}
              </span>
            </Choice>
          ))}
          <button
            type="button"
            onClick={() => setCreating(true)}
            className={cn(
              "flex min-h-24 items-center justify-center gap-2 rounded-[3px] border border-dashed p-3.5 text-sm transition-colors",
              creating ? "border-pick/60 text-pick-text" : "border-line-strong text-muted-foreground hover:border-faint hover:text-foreground",
            )}
          >
            <Plus className="size-4" />
            Новая ниша
          </button>
        </div>
      )}
      {creating && (
        <div className="grid grid-cols-1 gap-4 rounded-[3px] border border-line bg-surface-2/40 p-4 lg:grid-cols-2">
          <div className="space-y-4">
            <div>
              <Label>Название ниши</Label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Например: Битвы XVIII века" className={INPUT} />
            </div>
            <div>
              <Label>Описание</Label>
              <input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="О чём канал и для кого"
                className={INPUT}
              />
            </div>
          </div>
          <div className="flex flex-col">
            <Label aside={<span className="font-mono text-[11px] text-faint">по ним соберётся паспорт</span>}>Заметки и ролики конкурентов</Label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Голос, подача, что нравится и что нет, ссылки на ролики YouTube"
              className={cn(TEXTAREA, "min-h-24 flex-1")}
            />
          </div>
          <div className="flex justify-end gap-2 lg:col-span-2">
            <button type="button" onClick={() => setCreating(false)} className={BTN_SECONDARY}>
              Отмена
            </button>
            <button type="button" disabled={!form.name.trim() || busy} onClick={create} className={BTN_PRIMARY}>
              {busy && <Loader2 className="size-3.5 animate-spin" />}
              Создать нишу
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ 2. Сценарий */

export function ScriptStep({ d, up, file, setFile }: StepProps) {
  const { data: options } = useScenarioOptions()
  const { data: voices, error: voiceError, isLoading: voicesLoading } = useReelVoiceSources(d.script.mode === "ready" && d.script.from === "voice")
  const fileRef = useRef<HTMLInputElement>(null)
  const s = d.script
  const set = (patch: Partial<Draft["script"]>) => up((x) => ({ ...x, script: { ...x.script, ...patch } }))
  return (
    <div className="space-y-5">
      <div className="max-w-md">
        <Seg
          value={s.mode}
          onChange={(v) => set({ mode: v as "topic" | "ready" })}
          options={[
            ["topic", "Написать по теме"],
            ["ready", "Готовый сценарий"],
          ]}
        />
      </div>
      {s.mode === "topic" ? (
        <div className="grid grid-cols-1 gap-x-5 gap-y-5 md:grid-cols-2 xl:grid-cols-12">
          <div className="md:col-span-2 xl:col-span-12">
            <Label>Тема</Label>
            <input value={s.topic} onChange={(e) => set({ topic: e.target.value })} placeholder="Например: Битва при Каудпенсе, 1781" className={INPUT} />
          </div>
          <div className="xl:col-span-2">
            <Label>Длительность, мин</Label>
            <input
              value={s.minutes}
              inputMode="decimal"
              onChange={(e) => set({ minutes: e.target.value.replace(/[^\d.,]/g, "").replace(",", ".").slice(0, 5) })}
              className={cn(INPUT, "font-mono")}
            />
          </div>
          <div className="xl:col-span-3">
            <Label>Язык</Label>
            <Pick value={s.language} onChange={(v) => set({ language: v })} options={(options?.languages ?? []).map((l) => ({ value: l.code, label: l.name, hint: l.code.toUpperCase() }))} />
          </div>
          <div className="xl:col-span-3">
            <Label>Тон</Label>
            <Pick value={s.tone} onChange={(v) => set({ tone: v })} options={[{ value: "", label: "Из ниши" }, ...(options?.tones ?? [])]} />
          </div>
          <div className="md:col-span-2 xl:col-span-4">
            <Label>Модель сценария</Label>
            <Pick
              value={s.model}
              onChange={(v) => set({ model: v })}
              options={[{ value: "", label: "Из ниши", hint: "по этапам" }, ...(options?.models ?? []).map((m) => ({ value: m.value, label: m.label, hint: m.backend_label }))]}
            />
          </div>
          <div className="md:col-span-2 xl:col-span-12">
            <Label aside={<span className="font-mono text-[11px] text-faint">необязательно</span>}>Дополнительно</Label>
            <textarea
              value={s.notes}
              onChange={(e) => set({ notes: e.target.value })}
              rows={4}
              placeholder="Факты, которые обязательно нужны; источники; через чью судьбу рассказать; чего избегать"
              className={TEXTAREA}
            />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-x-5 gap-y-5 md:grid-cols-2">
          <div>
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
                      onClick={() => set({ from: id })}
                      className={cn("flex items-center gap-1 rounded-[2px] px-2 py-1", s.from === id ? ON_BLUE : "text-muted-foreground hover:text-foreground")}
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
            {s.from === "voice" ? (
              <Pick
                value={s.voiceJob}
                onChange={(v) => set({ voiceJob: v })}
                placeholder={voiceError ? "Озвучка недоступна" : voicesLoading ? "Загрузка…" : voices?.length ? "Проект из «Озвучки»" : "Проектов озвучки нет"}
                options={(voices ?? []).map((v) => ({
                  value: String(v.id),
                  label: v.title,
                  hint: [
                    v.language.toUpperCase(),
                    `${v.paragraphs} абз.`,
                    v.duration_sec ? clock(v.duration_sec) : "без озвучки",
                    v.translating ? "переводы идут" : v.base_ready === false ? "база не сведена" : "",
                  ]
                    .filter(Boolean)
                    .join(" · "),
                }))}
              />
            ) : (
              <div className="flex h-10 items-center gap-1 rounded-[3px] border border-dashed border-line-strong bg-background px-1.5">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className={cn("flex h-7 min-w-0 items-center gap-1.5 rounded-[2px] px-2 text-xs", file ? ON_BLUE : "text-muted-foreground hover:bg-elev hover:text-foreground")}
                >
                  <FileText className="size-3.5 shrink-0" />
                  <span className="truncate">{file?.name ?? "Сценарий .docx .txt .md"}</span>
                </button>
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
                {file && (
                  <button type="button" onClick={() => setFile(null)} className="ml-auto grid size-7 shrink-0 place-items-center text-faint hover:text-danger">
                    <X className="size-3.5" />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ 3. Озвучка */

/** Language code as «Озвучка» names it in its API (PT_BR → PT). */
const apiLang = (c: string) => {
  const u = c.trim().toUpperCase().replace("-", "_")
  return u === "PT_BR" || u === "BR" ? "PT" : u
}

export function VoiceStep({ d, up }: StepProps) {
  const fromVoice = d.script.mode === "ready" && d.script.from === "voice"
  const jobId = Number(d.script.voiceJob) || 0
  const { data: job } = useQuery({ queryKey: ["reels", "voice-job", jobId], queryFn: () => voice.job(jobId), enabled: fromVoice && jobId > 0 })
  const { data: profiles, isLoading, error } = useQuery({ queryKey: ["reels", "voice-profiles"], queryFn: voice.profiles })
  const { data: entries } = useQuery({ queryKey: ["reels", "voice-entries"], queryFn: voice.voices })
  const profileId = fromVoice ? (job?.profile_id ?? "") : d.voice.profile
  const { data: langInfo } = useQuery({
    queryKey: ["reels", "voice-languages", profileId],
    queryFn: () => voice.languages(profileId || undefined),
  })
  const base = apiLang(fromVoice ? (job?.source_lang ?? "EN") : d.script.language || "en")
  const name = (id: string) => entries?.find((e) => e.id === id)?.name ?? id
  const profile = profiles?.find((p) => p.id === profileId)
  const voicesOf = (lang: string) => {
    if (!profile) return { list: [] as string[], main: "" }
    const key = Object.keys(profile.voices).find((k) => apiLang(k) === lang)
    const main = Object.entries(profile.default).find(([k]) => apiLang(k) === lang)?.[1] ?? ""
    return { list: key ? profile.voices[key] : [], main }
  }
  const langs = (langInfo ?? [])
    .map((l) => ({ ...l, code: apiLang(l.code) }))
    .filter((l) => l.code !== base && voicesOf(l.code).list.length > 0)
  const inProject = new Set((job?.languages ?? []).map((l) => apiLang(l.lang)))
  const targets = d.voice.targets.filter((t) => t !== base)

  const setVoice = (patch: Partial<Draft["voice"]>) =>
    up((x) => ({
      ...x,
      voice: {
        ...x.voice,
        ...(fromVoice && job ? { profile: job.profile_id, name: job.profile_name } : {}),
        ...patch,
      },
    }))
  const toggle = (code: string) =>
    setVoice({ targets: targets.includes(code) ? targets.filter((t) => t !== code) : [...targets, code] })
  const pickProfile = (id: string, title: string) =>
    up((x) => {
      const p = profiles?.find((q) => q.id === id)
      const has = (c: string) => !!p && Object.keys(p.voices).some((k) => apiLang(k) === c)
      return { ...x, voice: { profile: id, name: title, targets: x.voice.targets.filter(has), voices: {}, model: x.voice.model } }
    })
  const { data: models } = useQuery({ queryKey: ["reels", "voice-models"], queryFn: voice.models, staleTime: 5 * 60_000 })
  const tms = models?.translation_models ?? []
  const model = d.voice.model || tms.find((m) => m.id === "gemini-4-argon-medium")?.id || tms[0]?.id || ""
  const tm = familyOf(model, tms)
  const level = levelOf(model, tms)

  return (
    <div className="space-y-5">
      {fromVoice ? (
        <Note>
          Базовый язык уже озвучен: проект «{job?.title ?? "из «Озвучки»"}»
          {job ? `, ${base}, профиль «${job.profile_name}»` : ""}.
        </Note>
      ) : isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="size-4 animate-spin text-faint" />
        </div>
      ) : error ? (
        <Note tone="warn">«Озвучка» недоступна — профили не загрузились: {error.message}</Note>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {(profiles ?? []).map((p) => {
            const main = Object.entries(p.default).find(([k]) => apiLang(k) === base)?.[1]
            const n = Object.keys(p.voices).length
            return (
              <Choice key={p.id} on={d.voice.profile === p.id} onClick={() => pickProfile(p.id, p.name)}>
                <span className="pr-6 text-sm font-medium">{p.name}</span>
                <span className="text-xs text-muted-foreground">{main ? `${base}: ${name(main)}` : `для ${base} голоса нет`}</span>
                <span className="mt-1 font-mono text-[11px] text-faint">{[`${n} яз.`, ...p.channels].join(" · ")}</span>
              </Choice>
            )
          })}
        </div>
      )}

      {profile && (
        <div>
          <Label
            aside={
              langs.length > 0 && (
                <span className="flex gap-3 text-xs">
                  {fromVoice && inProject.size > 1 && (
                    <button
                      type="button"
                      onClick={() => setVoice({ targets: langs.map((l) => l.code).filter((c) => inProject.has(c)) })}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      как в проекте
                    </button>
                  )}
                  <button type="button" onClick={() => setVoice({ targets: langs.map((l) => l.code) })} className="text-muted-foreground hover:text-foreground">
                    все
                  </button>
                  <button type="button" onClick={() => setVoice({ targets: [] })} className="text-muted-foreground hover:text-foreground">
                    ни одного
                  </button>
                </span>
              )
            }
          >
            Языки перевода
          </Label>
          {langs.length === 0 ? (
            <Note>В профиле «{profile.name}» нет голосов других языков — их добавляют во вкладке «Озвучка».</Note>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {langs.map((l) => {
                const on = targets.includes(l.code)
                return (
                  <button
                    key={l.code}
                    type="button"
                    onClick={() => toggle(l.code)}
                    title={l.name}
                    className={cn(
                      "flex h-8 items-center gap-1.5 rounded-[3px] border px-2.5 text-sm transition-colors",
                      on ? "border-ok/40 bg-ok/15 font-medium text-ok" : "border-line-strong text-muted-foreground hover:border-faint hover:text-foreground",
                    )}
                  >
                    <span className="font-mono text-xs">{l.code}</span>
                    <span className="hidden sm:inline">{l.native_name || l.name}</span>
                    {fromVoice && inProject.has(l.code) && <span className="font-mono text-[10px] text-faint">есть</span>}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}

      {profile && targets.length > 0 && (
        <div className="overflow-hidden rounded-[3px] border border-line">
          {targets.map((code) => {
            const { list, main } = voicesOf(code)
            const chosen = d.voice.voices[code] ?? ""
            return (
              <div key={code} className="flex items-center gap-3 border-b border-line px-3 py-2 last:border-b-0">
                <span className="w-10 font-mono text-xs text-ok">{code}</span>
                <div className="min-w-0 flex-1">
                  {list.length > 1 ? (
                    <Pick
                      value={chosen || main}
                      onChange={(v) => setVoice({ voices: { ...d.voice.voices, [code]: v === main ? "" : v } })}
                      options={list.map((v) => ({ value: v, label: name(v), hint: v === main ? "по умолчанию" : undefined }))}
                    />
                  ) : (
                    <span className="block truncate text-sm text-foreground-2">{name(list[0] ?? main)}</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {profile && targets.length > 0 && tms.length > 0 && (
        <div className="max-w-xl">
          <Label aside={tm ? <span className="font-mono text-[11px] text-faint">~{tm.est_minutes_per_lang} мин / язык</span> : null}>Модель перевода</Label>
          <Seg
            value={tm?.id ?? model}
            onChange={(v) => setVoice({ model: withLevel(v, level, tms) })}
            options={tms.map((m) => [m.id, m.label.replace(/^Gemini [\d.]+ /, ""), `${m.label}: ${m.description}`] as const)}
          />
          {!!tm?.levels?.length && (
            <div className="mt-1.5">
              <Seg
                value={level}
                onChange={(l) => setVoice({ model: withLevel(tm.id, l, tms) })}
                mono
                options={tm.levels.map((l) => [l, LEVEL_LABEL[l] ?? l] as const)}
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ 4. Ведущий */

export function HostStep({ d, up }: StepProps) {
  const { data: avatars, isLoading } = useAvatars()
  const toggle = (on: boolean) =>
    up((x) => {
      const sh = { ...x.storyboard.shares }
      if (on && !sh.avatar) {
        sh.avatar = 10
        sh.ai = Math.max(0, sh.ai - 10)
      }
      if (!on && sh.avatar) {
        sh.ai += sh.avatar
        sh.avatar = 0
      }
      return { ...x, host: { ...x.host, on }, storyboard: { ...x.storyboard, shares: sh } }
    })
  return (
    <div className="space-y-4">
      <div className="grid max-w-xl grid-cols-2 gap-3">
        <Choice on={!d.host.on} onClick={() => toggle(false)}>
          <UserRoundX className="size-4 text-muted-foreground" />
          <span className="text-sm font-medium">Без ведущего</span>
          <span className="text-xs text-muted-foreground">только закадровый голос</span>
        </Choice>
        <Choice on={d.host.on} onClick={() => toggle(true)}>
          <UserRound className="size-4 text-muted-foreground" />
          <span className="text-sm font-medium">С ведущим</span>
          <span className="text-xs text-muted-foreground">аватар говорит в кадре сам</span>
        </Choice>
      </div>
      {d.host.on && (
        <>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="size-4 animate-spin text-faint" />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
              {(avatars ?? []).map((a) => (
                <Choice key={a.id} on={d.host.id === a.id} onClick={() => up((x) => ({ ...x, host: { ...x.host, id: a.id, name: a.name } }))} className="p-2">
                  <span className="mb-1 block aspect-[3/4] w-full overflow-hidden rounded-[2px] bg-elev">
                    {a.image_urls[0] && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={a.image_urls[0]} alt="" className="size-full object-cover" />
                    )}
                  </span>
                  <span className="truncate px-1 text-sm font-medium">{a.name}</span>
                  {a.appearance && <span className="line-clamp-2 px-1 text-[11px] text-muted-foreground">{a.appearance}</span>}
                </Choice>
              ))}
              <Link
                href="/avatars"
                className="flex aspect-[3/4] flex-col items-center justify-center gap-2 rounded-[3px] border border-dashed border-line-strong p-3 text-center text-sm text-muted-foreground hover:border-faint hover:text-foreground"
              >
                <Plus className="size-4" />
                Новый аватар
                <span className="text-[11px] text-faint">во вкладке «Аватар»; меню запомнит шаг</span>
              </Link>
            </div>
          )}
          <div>
            <Label aside={<span className="font-mono text-[11px] text-faint">для Veo</span>}>Голос ведущего</Label>
            <input
              value={d.host.voice}
              onChange={(e) => up((x) => ({ ...x, host: { ...x.host, voice: e.target.value } }))}
              placeholder="Например: женский, тёплый, спокойный темп, лёгкий британский акцент"
              className={INPUT}
            />
          </div>
        </>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ 5. Раскадровка */

export function StoryboardStep({ d, up }: StepProps) {
  const { data: options } = useReelOptions()
  const sec = useReelSeconds(d)
  const sb = d.storyboard
  const set = (patch: Partial<Draft["storyboard"]>) => up((x) => ({ ...x, storyboard: { ...x.storyboard, ...patch } }))
  const realistic = isRealistic(sb.style)
  const clash = !realistic && (sb.shares.video > 0 || sb.shares.history > 0)
  const preset = STYLES.findIndex((s) => s.value === sb.style.trim())
  const cats = d.host.on ? CATEGORIES : BASE_CATEGORIES
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-x-6 gap-y-5 xl:grid-cols-12">
        <div className="xl:col-span-7">
          <Label aside={<SharesAside value={sb.shares} onChange={(s) => set({ shares: s })} host={d.host.on} />}>Доли материала, % экранного времени</Label>
          <SharesRows value={sb.shares} onChange={(s) => set({ shares: s })} seconds={sec} cats={cats} />
          {sharesSum(sb.shares) !== 100 && <p className="mt-2 text-xs text-danger">Доли должны давать 100% — сейчас {sharesSum(sb.shares)}%.</p>}
        </div>
        <div className="space-y-5 xl:col-span-5">
          <div>
            <Label>Стиль картинки</Label>
            <div className="mb-2 flex flex-wrap gap-1.5">
              {STYLES.map((s, i) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => set({ style: s.value })}
                  className={cn(
                    "h-7 rounded-[3px] border px-2.5 text-xs transition-colors",
                    preset === i ? "border-pick/40 bg-pick-soft font-medium text-pick-text" : "border-line-strong text-muted-foreground hover:text-foreground",
                  )}
                >
                  {STYLE_LABEL[i]}
                </button>
              ))}
            </div>
            <input value={sb.style} onChange={(e) => set({ style: e.target.value })} placeholder="Или свой стиль" className={INPUT} />
          </div>
          {clash && (
            <Note tone="warn">
              Реальные футажи и исторические кадры будут выбиваться из стиля «{sb.style}».{" "}
              <button
                type="button"
                className="font-medium text-pick-text hover:underline"
                onClick={() =>
                  set({ shares: d.host.on ? { ai: 70, video: 0, history: 0, graphics: 15, avatar: 15 } : { ai: 85, video: 0, history: 0, graphics: 15, avatar: 0 } })
                }
              >
                Оставить {d.host.on ? "ИИ, ведущего и графику" : "ИИ и графику"}
              </button>
            </Note>
          )}
          <div>
            <Label aside={<span className="font-mono text-[11px] text-faint">для модели раскадровки</span>}>Важные детали</Label>
            <textarea
              value={sb.notes}
              onChange={(e) => set({ notes: e.target.value })}
              rows={3}
              placeholder="Например: без детей и крови, бои только издалека, больше карт в главе о походе"
              className={TEXTAREA}
            />
          </div>
          <div>
            <Label>Модель раскадровки</Label>
            <Pick
              value={sb.engine}
              onChange={(v) => set({ engine: v })}
              options={[
                { value: "", label: "Из настроек", hint: options?.defaults.engine ?? "" },
                ...(options?.engines ?? []).map((e) => ({ value: e.value, label: e.label, hint: e.model })),
              ]}
            />
          </div>
        </div>
      </div>
      <div className="space-y-3">
        <IntroSettings d={d} up={up} />
        <FootageSettings d={d} up={up} />
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ 6. Монтаж */

export function MontageStep({ d, up }: StepProps) {
  const { data: options } = useReelOptions()
  const sec = useReelSeconds(d)
  return (
    <div className="space-y-5">
      <div>
        <Label>Стиль монтажа</Label>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {(options?.montage ?? []).map((m) => {
            const avg = (m.shot_sec[0] + m.shot_sec[1]) / 2
            return (
              <Choice key={m.value} on={d.montage.style === m.value} onClick={() => up((x) => ({ ...x, montage: { ...x.montage, style: m.value } }))}>
                <span className="pr-6 text-sm font-medium">{m.label}</span>
                <span className="text-xs text-muted-foreground">{m.use}</span>
                <span className="mt-1.5 font-mono text-[11px] text-foreground-2">
                  кадр {String(m.shot_sec[0]).replace(".", ",")}–{String(m.shot_sec[1]).replace(".", ",")} с{sec ? ` · ≈ ${shotsText(Math.round(sec / avg))}` : ""}
                </span>
                <span className="text-[11px] leading-snug text-faint">{m.cuts}</span>
                <span className="text-[11px] leading-snug text-faint">{m.look}</span>
              </Choice>
            )
          })}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-12">
        <div className="xl:col-span-5">
          <Label aside={<span className="font-mono text-[11px] text-faint">заработает с музыкой</span>}>Стиль музыки</Label>
          <Pick
            value={d.montage.music}
            onChange={(v) => up((x) => ({ ...x, montage: { ...x.montage, music: v } }))}
            options={(options?.music ?? []).map((m) => ({ value: m.value, label: m.label }))}
          />
        </div>
        <div className="xl:col-span-3">
          <Label>Формат</Label>
          <div className="flex rounded-[3px] bg-surface-2 p-[3px]">
            <button type="button" className={cn("flex-1 rounded-[2px] py-2 font-mono text-[13px]", ON_BLUE)}>
              16:9
            </button>
            <button type="button" disabled title="Вертикальное видео — позже" className="flex-1 rounded-[2px] py-2 font-mono text-[13px] text-faint">
              9:16 · позже
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ сводка */

export function shareText(s: ReelShares, host: boolean) {
  return (host ? CATEGORIES : BASE_CATEGORIES).map((c) => Math.round(s[c] ?? 0)).join(" · ")
}

export function SummaryStep({ d, up, file, onJump, montageLabel }: StepProps & { onJump: (i: number) => void; montageLabel: string }) {
  const { data: voices } = useReelVoiceSources(d.script.mode === "ready" && d.script.from === "voice")
  const v = voices?.find((x) => String(x.id) === d.script.voiceJob)
  const s = d.script
  const rows: [string, React.ReactNode][] = [
    ["Ниша", d.nicheName],
    [
      "Сценарий",
      s.mode === "topic"
        ? `${s.topic} · ${s.minutes} мин · ${s.language.toUpperCase()}${s.notes ? " · есть дополнения" : ""}`
        : s.from === "voice"
          ? `из «Озвучки»: ${v?.title ?? "проект"}`
          : `файл ${file?.name ?? "—"}`,
    ],
    [
      "Озвучка",
      `${s.mode === "ready" && s.from === "voice" ? "уже озвучено" : d.voice.name || "профиль не выбран"}${d.voice.targets.length ? ` · переводы: ${d.voice.targets.join(", ")}` : ""}${d.voice.targets.length && d.voice.model ? ` · ${d.voice.model}` : ""}`,
    ],
    ["Ведущий", d.host.on ? `${d.host.name || "аватар не выбран"}${d.host.voice ? ` · ${d.host.voice}` : ""}` : "без ведущего"],
    [
      "Раскадровка",
      <span key="sb" className="flex min-w-0 flex-col gap-1.5">
        <span>
          {shareText(d.storyboard.shares, d.host.on)} · {d.storyboard.style}
          {d.storyboard.notes ? ` · детали: ${d.storyboard.notes}` : ""}
        </span>
        <MixBar shares={d.storyboard.shares} className="max-w-xs" />
        {d.intro.on && (
          <span className="text-foreground-2">
            первые {Math.round(d.intro.sec / 60)} мин: {shareText(d.intro.shares, d.host.on)}
            {d.intro.shot[0] && d.intro.shot[1] ? ` · кадр ${d.intro.shot[0]}–${d.intro.shot[1]} с` : " · кадры чаще"}
            {d.intro.minFit ? ` · оценка ≥ ${d.intro.minFit}` : ""}
          </span>
        )}
        {(d.storyboard.shares.video > 0 || d.storyboard.shares.history > 0) && (
          <span className="text-muted-foreground">
            видео: {footageText(d.footage.video)} · история: {footageText(d.footage.history)}
          </span>
        )}
      </span>,
    ],
    ["Монтаж", `${montageLabel} · 16:9`],
  ]
  return (
    <div className="space-y-5">
      <ol className="divide-y divide-line rounded-[3px] border border-line-strong bg-background">
        {rows.map(([k, val], i) => (
          <li key={k} className="grid grid-cols-[110px_minmax(0,1fr)_auto] items-start gap-4 px-4 py-3 text-sm">
            <span className="text-muted-foreground">
              <span className="mr-2 font-mono text-[11px] text-faint">{i + 1}</span>
              {k}
            </span>
            <span className="min-w-0 break-words text-foreground-2">{val}</span>
            <button type="button" onClick={() => onJump(i)} className="text-xs text-faint hover:text-pick-text">
              изменить
            </button>
          </li>
        ))}
      </ol>
      <div className="max-w-xl">
        <Label>Название ролика</Label>
        <input
          value={d.title}
          onChange={(e) => up((x) => ({ ...x, title: e.target.value }))}
          placeholder={s.mode === "topic" ? s.topic || "по теме" : (v?.title ?? file?.name.replace(/\.[^.]+$/, "")) || "из сценария"}
          className={INPUT}
        />
      </div>
    </div>
  )
}
