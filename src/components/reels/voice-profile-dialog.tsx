"use client"

import { useEffect, useRef, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Loader2, Pause, Play, Plus, X } from "lucide-react"
import { toast } from "sonner"

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { BTN_PRIMARY, BTN_SECONDARY, INPUT, Label, Pick } from "@/components/script/ui"
import { voice, voiceMediaUrl, type VoiceProfile } from "@/lib/api"
import { cn } from "@/lib/utils"

/** Language names of «Озвучка» (main ones first). */
const LANGS: [string, string][] = [
  ["EN", "Английский"],
  ["RU", "Русский"],
  ["ES", "Испанский"],
  ["PT", "Португальский"],
  ["DE", "Немецкий"],
  ["IT", "Итальянский"],
  ["PL", "Польский"],
  ["FR", "Французский"],
  ["JA", "Японский"],
  ["AR", "Арабский"],
  ["KO", "Корейский"],
  ["NL", "Нидерландский"],
  ["TR", "Турецкий"],
  ["SV", "Шведский"],
  ["NO", "Норвежский"],
  ["DA", "Датский"],
  ["CS", "Чешский"],
]
const NAME = Object.fromEntries(LANGS)

const api = (c: string) => {
  const u = c.trim().toUpperCase().replace("-", "_")
  return u === "PT_BR" || u === "BR" ? "PT" : u
}

interface Row {
  lang: string
  voice: string
  norm: [number, number]
}

const SMALL = "h-8 rounded-[3px] border border-line-strong bg-background px-2 text-xs outline-none focus:border-electric/60"

/**
 * Create a voice profile (a copy of `base`) or edit `profile` without leaving «Ролики»:
 * name, channels, a voice and a length norm per language, new Fish voices.
 */
export function VoiceProfileDialog(props: {
  open: boolean
  /** The profile to edit; null — a new one. */
  profile: VoiceProfile | null
  /** A new profile starts as a copy of it. */
  base?: VoiceProfile | null
  onClose: () => void
  onSaved: (p: VoiceProfile) => void
}) {
  const [busy, setBusy] = useState(false)
  return (
    <Dialog open={props.open} onOpenChange={(o) => !o && !busy && props.onClose()}>
      <DialogContent
        showCloseButton={false}
        className="max-h-[90vh] gap-0 overflow-y-auto rounded-[4px] border border-line-strong bg-surface p-0 ring-0 sm:max-w-3xl"
      >
        {props.open && <ProfileForm key={`${props.profile?.id ?? "new"}-${props.base?.id ?? ""}`} {...props} busy={busy} setBusy={setBusy} />}
      </DialogContent>
    </Dialog>
  )
}

function ProfileForm({
  profile,
  base,
  onClose,
  onSaved,
  busy,
  setBusy,
}: {
  profile: VoiceProfile | null
  base?: VoiceProfile | null
  onClose: () => void
  onSaved: (p: VoiceProfile) => void
  busy: boolean
  setBusy: (b: boolean) => void
}) {
  const qc = useQueryClient()
  const { data: entries, refetch } = useQuery({ queryKey: ["reels", "voice-entries"], queryFn: voice.voices })
  const { data: langInfo } = useQuery({ queryKey: ["reels", "voice-languages", ""], queryFn: () => voice.languages() })
  const source = profile ?? base ?? null
  const [name, setName] = useState(profile ? profile.name : base ? `${base.name} — копия` : "")
  const [channels, setChannels] = useState((source?.channels ?? []).join(", "))
  const [rows, setRows] = useState<Row[]>(() =>
    Object.keys(source?.default ?? {})
      .map((k) => ({
        lang: k,
        voice: source?.default[k] ?? "",
        norm: (source?.norms[k] ?? source?.norms[api(k)] ?? [75, 80]) as [number, number],
      }))
      .sort((a, b) => LANGS.findIndex(([c]) => c === api(a.lang)) - LANGS.findIndex(([c]) => c === api(b.lang))),
  )
  const [adding, setAdding] = useState("")
  const [fish, setFish] = useState({ name: "", url: "", lang: "EN" })
  const [fishBusy, setFishBusy] = useState(false)
  const [playing, setPlaying] = useState("")
  const audio = useRef<HTMLAudioElement | null>(null)

  useEffect(() => () => audio.current?.pause(), [])

  const voiceName = (id: string) => entries?.find((e) => e.id === id)?.name ?? id
  const defaultNorm = (code: string) => langInfo?.find((l) => api(l.code) === code)?.norm ?? [75, 80]
  const free = LANGS.filter(([c]) => !rows.some((r) => api(r.lang) === c))
  const set = (i: number, patch: Partial<Row>) => setRows((rs) => rs.map((r, k) => (k === i ? { ...r, ...patch } : r)))

  const play = (id: string) => {
    const e = entries?.find((x) => x.id === id)
    const url = voiceMediaUrl(e?.sample_url ?? `/api/voice/voices/${id}/sample`)
    if (!audio.current) {
      audio.current = new Audio()
      audio.current.onended = () => setPlaying("")
    }
    if (playing === id) {
      audio.current.pause()
      setPlaying("")
      return
    }
    audio.current.src = url
    void audio.current.play().then(
      () => setPlaying(id),
      () => toast.error("Образец не проигрывается"),
    )
  }

  const save = async () => {
    if (!name.trim()) {
      toast.error("Название профиля обязательно")
      return
    }
    if (rows.some((r) => !r.voice)) {
      toast.error("У каждого языка должен быть голос")
      return
    }
    setBusy(true)
    try {
      const target = profile ?? (await voice.createProfile({ name: name.trim(), copy_from: base?.id ?? null }))
      const kept = new Set(rows.map((r) => r.lang))
      const voices: Record<string, string[]> = {}
      for (const r of rows) voices[r.lang] = [r.voice, ...(source?.voices[r.lang] ?? []).filter((v) => v !== r.voice)]
      const saved = await voice.updateProfile(target.id, {
        name: name.trim(),
        channels: channels
          .split(",")
          .map((c) => c.trim())
          .filter(Boolean),
        default: Object.fromEntries(rows.map((r) => [r.lang, r.voice])),
        voices,
        norms: Object.fromEntries(rows.filter((r) => api(r.lang) !== "EN" && kept.has(r.lang)).map((r) => [r.lang, r.norm])),
      })
      await Promise.all([qc.invalidateQueries({ queryKey: ["reels", "voice-profiles"] }), qc.invalidateQueries({ queryKey: ["reels", "voice-languages"] })])
      toast.success(profile ? `Профиль «${saved.name}» сохранён` : `Профиль «${saved.name}» создан`)
      onSaved(saved)
      onClose()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Не удалось сохранить профиль")
    } finally {
      setBusy(false)
    }
  }

  const addFish = async () => {
    if (!fish.name.trim() || !fish.url.trim()) {
      toast.error("Нужны название голоса и ссылка Fish Audio")
      return
    }
    setFishBusy(true)
    try {
      const added = await voice.addVoice({ fish_url: fish.url.trim(), name: fish.name.trim(), langs: [fish.lang] })
      await refetch()
      setFish({ name: "", url: "", lang: fish.lang })
      toast.success(`Голос «${added.name}» добавлен`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Голоса нет в библиотеке Fish — проверьте ссылку")
    } finally {
      setFishBusy(false)
    }
  }

  const voiceOptions = (entries ?? []).map((e) => ({ value: e.id, label: e.name, hint: e.status === "missing" ? "пропал в Fish" : e.id }))

  return (
    <>
      <div className="flex items-center justify-between border-b border-line px-5 py-4">
        <DialogTitle className="text-base font-semibold">{profile ? "Профиль озвучки" : "Новый профиль озвучки"}</DialogTitle>
        <button type="button" onClick={onClose} className="text-faint hover:text-foreground" aria-label="Закрыть">
          <X className="size-4" />
        </button>
      </div>

      <div className="space-y-5 p-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label>Название</Label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Голос 5 (History, Science)" className={INPUT} />
          </div>
          <div>
            <Label>Каналы</Label>
            <input value={channels} onChange={(e) => setChannels(e.target.value)} placeholder="через запятую" className={INPUT} />
          </div>
        </div>

        <div>
          <Label
            aside={
              free.length > 0 && (
                <span className="flex items-center gap-2">
                  <select value={adding} onChange={(e) => setAdding(e.target.value)} className={cn(SMALL, "w-40")}>
                    <option value="">Добавить язык…</option>
                    {free.map(([c, n]) => (
                      <option key={c} value={c}>
                        {c} · {n}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={!adding}
                    onClick={() => {
                      setRows((rs) => [...rs, { lang: adding, voice: entries?.[0]?.id ?? "", norm: defaultNorm(adding) }])
                      setAdding("")
                    }}
                    className={cn(SMALL, "flex items-center gap-1 disabled:opacity-40")}
                  >
                    <Plus className="size-3.5" />
                  </button>
                </span>
              )
            }
          >
            Голоса и нормы длины
          </Label>
          <div className="overflow-hidden rounded-[3px] border border-line">
            <div className="grid grid-cols-[52px_minmax(0,1fr)_36px_150px_28px] items-center gap-2 border-b border-line bg-surface-2/60 px-3 py-2 text-[11px] text-faint">
              <span>Язык</span>
              <span>Голос</span>
              <span />
              <span title="Длина перевода в символах, % от английского оригинала">Норма, % от EN</span>
              <span />
            </div>
            {rows.map((r, i) => {
              const code = api(r.lang)
              return (
                <div
                  key={r.lang}
                  className="grid grid-cols-[52px_minmax(0,1fr)_36px_150px_28px] items-center gap-2 border-b border-line px-3 py-2 last:border-b-0"
                >
                  <span className="font-mono text-xs text-ok" title={NAME[code]}>
                    {code}
                  </span>
                  <Pick value={r.voice} onChange={(v) => set(i, { voice: v })} options={voiceOptions} placeholder={voiceName(r.voice) || "Голос"} />
                  <button
                    type="button"
                    onClick={() => play(r.voice)}
                    disabled={!r.voice}
                    title="Образец"
                    className="grid size-8 place-items-center rounded-[3px] border border-line-strong text-electric hover:bg-elev disabled:opacity-40"
                  >
                    {playing === r.voice ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
                  </button>
                  {code === "EN" ? (
                    <span className="font-mono text-[11px] text-faint">100 — эталон</span>
                  ) : (
                    <span className="flex items-center gap-1 font-mono text-xs">
                      <input
                        type="number"
                        min={20}
                        max={150}
                        value={r.norm[0]}
                        onChange={(e) => set(i, { norm: [Number(e.target.value), r.norm[1]] })}
                        className={cn(SMALL, "w-14 text-center")}
                      />
                      –
                      <input
                        type="number"
                        min={20}
                        max={150}
                        value={r.norm[1]}
                        onChange={(e) => set(i, { norm: [r.norm[0], Number(e.target.value)] })}
                        className={cn(SMALL, "w-14 text-center")}
                      />
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => setRows((rs) => rs.filter((_, k) => k !== i))}
                    disabled={code === "EN"}
                    title="Убрать язык"
                    className="grid size-7 place-items-center text-faint hover:text-danger disabled:invisible"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              )
            })}
          </div>
        </div>

        <div>
          <Label>Новый голос Fish Audio</Label>
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={fish.name}
              onChange={(e) => setFish({ ...fish, name: e.target.value })}
              placeholder="Название"
              className={cn(SMALL, "h-9 min-w-40 flex-1 text-sm")}
            />
            <input
              value={fish.url}
              onChange={(e) => setFish({ ...fish, url: e.target.value })}
              placeholder="Ссылка fish.audio или 32-символьный код"
              className={cn(SMALL, "h-9 min-w-56 flex-[2] font-mono")}
            />
            <select value={fish.lang} onChange={(e) => setFish({ ...fish, lang: e.target.value })} className={cn(SMALL, "h-9")}>
              {LANGS.map(([c]) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <button type="button" onClick={addFish} disabled={fishBusy} className={cn(BTN_SECONDARY, "h-9 px-3 text-xs")}>
              {fishBusy ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
              Проверить и добавить
            </button>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-2 border-t border-line bg-surface-2/60 px-5 py-3">
        <button type="button" onClick={onClose} disabled={busy} className={cn(BTN_SECONDARY, "h-9")}>
          Отмена
        </button>
        <button type="button" onClick={save} disabled={busy} className={cn(BTN_PRIMARY, "h-9")}>
          {busy && <Loader2 className="size-4 animate-spin" />}
          {profile ? "Сохранить" : "Создать профиль"}
        </button>
      </div>
    </>
  )
}
