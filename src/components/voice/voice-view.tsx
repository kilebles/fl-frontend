"use client"

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  AlertTriangle,
  AudioLines,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  Download,
  Edit3,
  FileAudio,
  FileText,
  Filter,
  FolderArchive,
  Layers,
  Loader2,
  Mic,
  Pause,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Settings2,
  Sparkles,
  Square,
  Trash2,
  Upload,
  Volume2,
  Wand2,
  XCircle,
} from "lucide-react"
import { toast } from "sonner"

import { PageHeader } from "@/components/shell/page-header"
import {
  type CompareVoiceVariant,
  type ParagraphFilter,
  type TranslationModelInfo,
  type VoiceEntry,
  type VoiceEstimateResponse,
  type VoiceJob,
  type VoiceJobLanguage,
  type VoiceJobMode,
  type VoiceLanguageInfo,
  type VoiceModelId,
  type VoiceModelInfo,
  type VoiceParagraph,
  type VoiceProfile,
  type VoiceQueueStatus,
  type VoiceScriptInfo,
  voice,
  voiceMediaUrl,
} from "@/lib/api"
import { cn } from "@/lib/utils"

type ScreenTab = "workspace" | "launch" | "profiles"

const LANG_NAMES: Record<string, string> = {
  EN: "Английский",
  RU: "Русский",
  ES: "Испанский",
  PT: "Португальский",
  DE: "Немецкий",
  IT: "Итальянский",
  PL: "Польский",
  FR: "Французский",
}

const ALL_LANGS = ["EN", "RU", "ES", "PT", "DE", "IT", "PL", "FR"]

function formatDuration(sec: number | null | undefined): string {
  if (!sec || sec <= 0) return "—"
  const total = Math.round(sec)
  const mins = Math.floor(total / 60)
  const secs = total % 60
  return `${mins}:${secs.toString().padStart(2, "0")}`
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} КБ`
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`
}

/** Render paragraph text with highlighted Drama 3 emotion tags: [calm, ...] and <emphasis>...</emphasis>. */
function RichTaggedText({ text }: { text: string }) {
  if (!text) return <span className="text-muted-foreground italic">Нет текста</span>
  const tokenRe = /(\[[^\[\]\n]{1,120}\]|<\/?[a-zA-Z][a-zA-Z0-9_-]*>)/g
  const parts = text.split(tokenRe)
  return (
    <>
      {parts.map((part, idx) => {
        if (!part) return null
        if (part.startsWith("[") && part.endsWith("]")) {
          const isPause = /^\[(pause|short pause|long pause|beat|silence)\]$/i.test(part)
          return (
            <span
              key={idx}
              className={cn(
                "mx-0.5 inline-flex items-center rounded-[3px] px-1.5 py-0.5 font-mono text-[11px] leading-tight font-medium",
                isPause
                  ? "border border-line-strong bg-elev text-muted-foreground"
                  : "border border-electric/35 bg-electric-soft text-electric-text"
              )}
            >
              {part}
            </span>
          )
        }
        if (part.startsWith("<") && part.endsWith(">")) {
          return (
            <span
              key={idx}
              className="mx-0.5 inline-flex items-center rounded-[3px] border border-warn/35 bg-warn-soft px-1 py-0.2 font-mono text-[11px] leading-tight text-warn"
            >
              {part}
            </span>
          )
        }
        return <React.Fragment key={idx}>{part}</React.Fragment>
      })}
    </>
  )
}

export function VoiceView() {
  const [screen, setScreen] = useState<ScreenTab>("workspace")
  const [loading, setLoading] = useState(true)

  // Shared data
  const [jobs, setJobs] = useState<VoiceJob[]>([])
  const [profiles, setProfiles] = useState<VoiceProfile[]>([])
  const [voices, setVoices] = useState<VoiceEntry[]>([])
  const [scripts, setScripts] = useState<VoiceScriptInfo[]>([])
  const [translationModels, setTranslationModels] = useState<TranslationModelInfo[]>([])
  const [voiceModels, setVoiceModels] = useState<VoiceModelInfo[]>([])
  const [languagesInfo, setLanguagesInfo] = useState<VoiceLanguageInfo[]>([])
  const [queueStatus, setQueueStatus] = useState<VoiceQueueStatus | null>(null)

  // Active workspace state
  const [selectedJobId, setSelectedJobId] = useState<number | null>(null)
  const [selectedLang, setSelectedLang] = useState<string>("RU")
  const [paraFilter, setParaFilter] = useState<ParagraphFilter>("all")
  const [paraSearch, setParaSearch] = useState<string>("")
  const [paragraphs, setParagraphs] = useState<VoiceParagraph[]>([])
  const [allParagraphsCount, setAllParagraphsCount] = useState<{
    all: number
    off_norm: number
    sped_up: number
    edited: number
    tags: number
  }>({ all: 0, off_norm: 0, sped_up: 0, edited: 0, tags: 0 })
  const [peaks, setPeaks] = useState<Record<string, number[]>>({})
  const [loadingParas, setLoadingParas] = useState(false)
  const [activeParaN, setActiveParaN] = useState<number>(1)

  // Editing paragraph state
  const [editingParaN, setEditingParaN] = useState<number | null>(null)
  const [editDraft, setEditDraft] = useState<string>("")
  const [liveMeasure, setLiveMeasure] = useState<{
    length_pct: number
    norm: [number, number]
    in_norm: boolean
    tags_ok: boolean
    tags_problem: string | null
    chars_delta: number
  } | null>(null)
  const [busyParaAction, setBusyParaAction] = useState<string | null>(null)
  const [compareResults, setCompareResults] = useState<Record<number, CompareVoiceVariant[]>>({})

  // Audio player state
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [playingUrl, setPlayingUrl] = useState<string | null>(null)
  const [playingLabel, setPlayingLabel] = useState<string | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [playbackRate, setPlaybackRate] = useState<number>(1)
  const [trackMode, setTrackMode] = useState<"mixed" | "source">("mixed")

  // Revoice skipped modal / state
  const [replacementVoices, setReplacementVoices] = useState<Record<string, string>>({})
  const [revoicingSkipped, setRevoicingSkipped] = useState(false)

  // Launch screen state
  const [launchScriptId, setLaunchScriptId] = useState<string>("")
  const [uploadingScript, setUploadingScript] = useState(false)
  const [launchMode, setLaunchMode] = useState<VoiceJobMode>("all")
  const [launchProfileId, setLaunchProfileId] = useState<string>("p2")
  const [launchSourceLang, setLaunchSourceLang] = useState<string>("EN")
  const [launchTargets, setLaunchTargets] = useState<string[]>(["RU", "ES", "PT", "DE", "IT", "PL", "FR"])
  const [launchVoices, setLaunchVoices] = useState<Record<string, string>>({})
  const [launchModel, setLaunchModel] = useState<string>("gemini-4-argon-medium")
  const [launchVoiceModel, setLaunchVoiceModel] = useState<VoiceModelId>("drama-3")
  const [launchCarryMood, setLaunchCarryMood] = useState<boolean>(true)
  const [launchSplitByLang, setLaunchSplitByLang] = useState<boolean>(false)
  const [estimate, setEstimate] = useState<VoiceEstimateResponse | null>(null)
  const [submittingJob, setSubmittingJob] = useState(false)

  // Profiles screen state
  const [editingProfileId, setEditingProfileId] = useState<string>("p2")
  const [profileNameDraft, setProfileNameDraft] = useState<string>("")
  const [profileChannelsDraft, setProfileChannelsDraft] = useState<string>("")
  const [profileDefaultDraft, setProfileDefaultDraft] = useState<Record<string, string>>({})
  const [profileVoicesDraft, setProfileVoicesDraft] = useState<Record<string, string[]>>({})
  const [profileNormsDraft, setProfileNormsDraft] = useState<Record<string, [number, number]>>({})
  const [savingProfile, setSavingProfile] = useState(false)
  const [newProfileName, setNewProfileName] = useState("")
  const [creatingProfile, setCreatingProfile] = useState(false)

  // Voices library state
  const [newVoiceUrl, setNewVoiceUrl] = useState("")
  const [newVoiceName, setNewVoiceName] = useState("")
  const [newVoiceLangs, setNewVoiceLangs] = useState<string[]>(["EN"])
  const [addingVoice, setAddingVoice] = useState(false)
  const [checkingVoices, setCheckingVoices] = useState(false)

  const selectedJob = useMemo(
    () => jobs.find((j) => j.id === selectedJobId) ?? jobs[0] ?? null,
    [jobs, selectedJobId]
  )

  const voicesById = useMemo(() => {
    const map: Record<string, VoiceEntry> = {}
    for (const v of voices) map[v.id] = v
    return map
  }, [voices])

  // Initial load
  const loadInitialData = useCallback(async () => {
    try {
      const [jobsRes, profsRes, voicesRes, scriptsRes, modelsRes, langsRes, queueRes] = await Promise.all([
        voice.jobs(),
        voice.profiles(),
        voice.voices(),
        voice.scripts(),
        voice.models(),
        voice.languages(),
        voice.queue(),
      ])
      setJobs(jobsRes)
      setProfiles(profsRes)
      setVoices(voicesRes)
      setScripts(scriptsRes)
      setTranslationModels(modelsRes.translation_models)
      setVoiceModels(modelsRes.voice_models)
      setLanguagesInfo(langsRes)
      setQueueStatus(queueRes)

      if (jobsRes.length > 0 && selectedJobId === null) {
        setSelectedJobId(jobsRes[0].id)
      }
      if (scriptsRes.length > 0 && !launchScriptId) {
        const first = scriptsRes[0]
        setLaunchScriptId(first.script_id)
        setLaunchSourceLang(first.source_lang)
        setLaunchVoiceModel(first.emotion_tags_count > 0 ? "drama-3" : "s2.1")
      }
      if (profsRes.length > 0) {
        const defProf = profsRes.find((p) => p.id === "p2") ?? profsRes[0]
        setLaunchProfileId(defProf.id)
        setLaunchVoices({ ...defProf.default })
        setEditingProfileId(defProf.id)
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Не удалось загрузить данные озвучки")
    } finally {
      setLoading(false)
    }
  }, [selectedJobId, launchScriptId])

  useEffect(() => {
    void loadInitialData()
  }, [loadInitialData])

  // Sync profile editor state when editingProfileId changes
  useEffect(() => {
    const p = profiles.find((x) => x.id === editingProfileId)
    if (!p) return
    setProfileNameDraft(p.name)
    setProfileChannelsDraft(p.channels.join(", "))
    setProfileDefaultDraft({ ...p.default })
    setProfileVoicesDraft(
      Object.fromEntries(Object.entries(p.voices).map(([k, v]) => [k, [...v]]))
    )
    setProfileNormsDraft(
      Object.fromEntries(Object.entries(p.norms).map(([k, v]) => [k, [v[0], v[1]] as [number, number]]))
    )
  }, [editingProfileId, profiles])

  // Load paragraphs and peaks when selectedJob or selectedLang changes
  const loadParagraphs = useCallback(async () => {
    if (!selectedJob) return
    setLoadingParas(true)
    try {
      const [all, peaksRes] = await Promise.all([
        voice.paragraphs(selectedJob.id, selectedLang, "all"),
        voice.peaks(selectedJob.id, selectedLang),
      ])
      setAllParagraphsCount({
        all: all.length,
        off_norm: all.filter((p) => !p.in_norm).length,
        sped_up: all.filter((p) => (p.audio?.speedup ?? 1) > 1.0).length,
        edited: all.filter((p) => p.edited).length,
        tags: all.filter((p) => !p.tags_ok).length,
      })
      setPeaks(peaksRes)

      if (paraFilter === "all") {
        setParagraphs(all)
      } else {
        const filtered = await voice.paragraphs(selectedJob.id, selectedLang, paraFilter)
        setParagraphs(filtered)
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Не удалось загрузить абзацы")
    } finally {
      setLoadingParas(false)
    }
  }, [selectedJob, selectedLang, paraFilter])

  useEffect(() => {
    void loadParagraphs()
  }, [loadParagraphs])

  // Subscribe to SSE events for live progress
  useEffect(() => {
    const es = new EventSource(voice.eventsUrl())
    const refreshJobs = async () => {
      try {
        const [jobsRes, queueRes] = await Promise.all([voice.jobs(), voice.queue()])
        setJobs(jobsRes)
        setQueueStatus(queueRes)
      } catch {
        // ignore transient errors
      }
    }
    es.addEventListener("job.status", () => void refreshJobs())
    es.addEventListener("job.done", () => {
      void refreshJobs()
      void loadParagraphs()
      toast.success("Задача озвучки и перевода завершена")
    })
    es.addEventListener("job.failed", (ev) => {
      void refreshJobs()
      try {
        const data = JSON.parse((ev as MessageEvent).data)
        toast.error(data.message || "Ошибка выполнения задачи")
      } catch {
        toast.error("Ошибка выполнения задачи")
      }
    })
    es.addEventListener("voice.missing", (ev) => {
      void refreshJobs()
      try {
        const data = JSON.parse((ev as MessageEvent).data)
        toast.warning(`Пропал голос «${data.voice_name}» для ${data.lang} — язык пропущен`)
      } catch {
        // ignore
      }
    })
    es.addEventListener("paragraph.updated", () => void loadParagraphs())
    es.addEventListener("queue.changed", () => void refreshJobs())
    return () => es.close()
  }, [loadParagraphs])

  // Estimate calculation on Launch screen
  useEffect(() => {
    if (!launchScriptId) return
    let cancelled = false
    voice
      .estimate({
        script_id: launchScriptId,
        mode: launchMode,
        source_lang: launchSourceLang,
        targets: launchTargets,
        model: launchModel,
        voice_model: launchVoiceModel,
        split_by_language: launchSplitByLang,
      })
      .then((res) => {
        if (!cancelled) setEstimate(res)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [launchScriptId, launchMode, launchSourceLang, launchTargets, launchModel, launchVoiceModel, launchSplitByLang])

  // Audio playback helper
  const playAudioUrl = useCallback(
    (rawUrl: string | null | undefined, label: string) => {
      if (!rawUrl) return
      const fullUrl = voiceMediaUrl(rawUrl)
      if (!audioRef.current) {
        audioRef.current = new Audio()
        audioRef.current.onended = () => setIsPlaying(false)
        audioRef.current.onpause = () => setIsPlaying(false)
        audioRef.current.onplay = () => setIsPlaying(true)
      }
      const el = audioRef.current
      if (playingUrl === fullUrl && isPlaying) {
        el.pause()
        return
      }
      el.src = fullUrl
      el.playbackRate = playbackRate
      setPlayingUrl(fullUrl)
      setPlayingLabel(label)
      el.play().catch((err) => {
        toast.error(`Не удалось воспроизвести аудио: ${err.message}`)
      })
    },
    [playingUrl, isPlaying, playbackRate]
  )

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate
    }
  }, [playbackRate])

  // Start editing a paragraph
  const startEditingPara = (p: VoiceParagraph) => {
    setEditingParaN(p.n)
    setEditDraft(p.text)
    setLiveMeasure({
      length_pct: p.length_pct,
      norm: p.norm,
      in_norm: p.in_norm,
      tags_ok: p.tags_ok,
      tags_problem: p.tags_problem,
      chars_delta: p.chars_delta,
    })
  }

  // Live measure paragraph length while typing
  const handleDraftChange = async (p: VoiceParagraph, nextText: string) => {
    setEditDraft(nextText)
    if (!selectedJob) return
    try {
      const m = await voice.measureLength(selectedJob.id, selectedLang, p.n, nextText)
      setLiveMeasure(m)
    } catch {
      // ignore transient error
    }
  }

  const handleSaveParagraph = async (p: VoiceParagraph) => {
    if (!selectedJob) return
    setBusyParaAction(`save-${p.n}`)
    try {
      const updated = await voice.patchParagraph(selectedJob.id, selectedLang, p.n, editDraft, p.version)
      setParagraphs((prev) => prev.map((x) => (x.n === p.n ? updated : x)))
      setEditingParaN(null)
      toast.success(`Абзац #${p.n} сохранён`)
      void loadParagraphs()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка сохранения абзаца")
    } finally {
      setBusyParaAction(null)
    }
  }

  const handleRetranslateParagraph = async (p: VoiceParagraph) => {
    if (!selectedJob) return
    setBusyParaAction(`retranslate-${p.n}`)
    try {
      const updated = await voice.retranslateParagraph(selectedJob.id, selectedLang, p.n)
      setParagraphs((prev) => prev.map((x) => (x.n === p.n ? updated : x)))
      toast.success(`Абзац #${p.n} переведён заново`)
      void loadParagraphs()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Не удалось переперевести абзац")
    } finally {
      setBusyParaAction(null)
    }
  }

  const handleRevoiceParagraph = async (p: VoiceParagraph) => {
    if (!selectedJob) return
    setBusyParaAction(`revoice-${p.n}`)
    try {
      const updated = await voice.revoiceParagraph(selectedJob.id, selectedLang, p.n)
      setParagraphs((prev) => prev.map((x) => (x.n === p.n ? updated : x)))
      toast.success(`Абзац #${p.n} переозвучен и сведён`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Не удалось переозвучить абзац")
    } finally {
      setBusyParaAction(null)
    }
  }

  const handleRevertParagraph = async (p: VoiceParagraph) => {
    if (!selectedJob) return
    setBusyParaAction(`revert-${p.n}`)
    try {
      const updated = await voice.revertParagraph(selectedJob.id, selectedLang, p.n)
      setParagraphs((prev) => prev.map((x) => (x.n === p.n ? updated : x)))
      setEditingParaN(null)
      toast.success(`Возвращён исходный перевод модели для #${p.n}`)
      void loadParagraphs()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Не удалось вернуть вариант модели")
    } finally {
      setBusyParaAction(null)
    }
  }

  const handleCompareVoices = async (p: VoiceParagraph) => {
    if (!selectedJob) return
    setBusyParaAction(`compare-${p.n}`)
    try {
      const variants = await voice.compareParagraphVoices(selectedJob.id, selectedLang, p.n)
      setCompareResults((prev) => ({ ...prev, [p.n]: variants }))
      toast.success(`Готово сравнение моделей на абзаце #${p.n}`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка сравнения моделей")
    } finally {
      setBusyParaAction(null)
    }
  }

  // Handle Revoice Skipped (22.10 feature)
  const skippedLangsOnSelectedJob = useMemo(() => {
    if (!selectedJob) return []
    const fromLangs = selectedJob.languages
      .filter((l) => l.voice.state === "voice_missing")
      .map((l) => l.lang)
    const fromSummary = Object.keys(selectedJob.summary?.skipped ?? {})
    return Array.from(new Set([...fromLangs, ...fromSummary]))
  }, [selectedJob])

  const handleRevoiceSkipped = async () => {
    if (!selectedJob) return
    setRevoicingSkipped(true)
    try {
      const updated = await voice.revoiceSkipped(selectedJob.id, replacementVoices)
      setJobs((prev) => prev.map((j) => (j.id === updated.id ? updated : j)))
      toast.success("Доозвучка пропущенных языков запущена")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Не удалось запустить доозвучку")
    } finally {
      setRevoicingSkipped(false)
    }
  }

  // Apply norm suggestion (1-click)
  const handleApplyNormSuggestion = async (lang: string, suggested: [number, number]) => {
    if (!selectedJob) return
    try {
      const updatedProf = await voice.updateProfile(selectedJob.profile_id, {
        norms: { [lang]: suggested },
      })
      setProfiles((prev) => prev.map((p) => (p.id === updatedProf.id ? updatedProf : p)))
      toast.success(`Норма для ${lang} в профиле «${updatedProf.name}» обновлена до ${suggested[0]}–${suggested[1]}%`)
      void loadParagraphs()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Не удалось обновить норму")
    }
  }

  // Upload .docx script
  const handleScriptUpload = async (file: File) => {
    setUploadingScript(true)
    try {
      const info = await voice.uploadScript(file)
      setScripts((prev) => [info, ...prev.filter((s) => s.script_id !== info.script_id)])
      setLaunchScriptId(info.script_id)
      setLaunchSourceLang(info.source_lang)
      if (info.emotion_tags_count > 0) {
        setLaunchVoiceModel("drama-3")
        setLaunchCarryMood(true)
      }
      toast.success(`Сценарий «${info.title}» загружен (${info.paragraphs_total} абзацев)`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка чтения .docx")
    } finally {
      setUploadingScript(false)
    }
  }

  // Create new job
  const handleCreateJob = async () => {
    if (!launchScriptId) {
      toast.error("Выберите или загрузите сценарий (.docx)")
      return
    }
    if (launchMode !== "voice" && launchTargets.length === 0) {
      toast.error("Выберите хотя бы один целевой язык")
      return
    }
    setSubmittingJob(true)
    try {
      const createdJobs = await voice.createJobs({
        script_id: launchScriptId,
        mode: launchMode,
        source_lang: launchSourceLang,
        targets: launchTargets,
        profile_id: launchProfileId,
        voices: launchVoices,
        model: launchModel,
        voice_model: launchVoiceModel,
        carry_mood: launchVoiceModel === "drama-3" ? launchCarryMood : false,
        split_by_language: launchSplitByLang,
      })
      const jobsRes = await voice.jobs()
      setJobs(jobsRes)
      if (createdJobs.length > 0) {
        setSelectedJobId(createdJobs[0].id)
        setScreen("workspace")
      }
      toast.success(
        createdJobs.length > 1
          ? `Создано задач в очереди: ${createdJobs.length}`
          : `Задача #${createdJobs[0]?.id} поставлена в очередь`
      )
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Не удалось создать задачу")
    } finally {
      setSubmittingJob(false)
    }
  }

  // Save profile edits
  const handleSaveProfile = async () => {
    setSavingProfile(true)
    try {
      const channels = profileChannelsDraft
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean)
      const updated = await voice.updateProfile(editingProfileId, {
        name: profileNameDraft.trim(),
        channels,
        default: profileDefaultDraft,
        voices: profileVoicesDraft,
        norms: profileNormsDraft,
      })
      setProfiles((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
      toast.success(`Профиль «${updated.name}» сохранён`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка сохранения профиля")
    } finally {
      setSavingProfile(false)
    }
  }

  // Create new profile
  const handleCreateProfile = async () => {
    if (!newProfileName.trim()) {
      toast.error("Введите название нового профиля")
      return
    }
    setCreatingProfile(true)
    try {
      const created = await voice.createProfile({
        name: newProfileName.trim(),
        copy_from: editingProfileId,
      })
      setProfiles((prev) => [...prev, created])
      setEditingProfileId(created.id)
      setNewProfileName("")
      toast.success(`Профиль «${created.name}» создан`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Не удалось создать профиль")
    } finally {
      setCreatingProfile(false)
    }
  }

  // Add new Fish Audio voice (22.10: mandatory name)
  const handleAddVoice = async () => {
    if (!newVoiceName.trim()) {
      toast.error("Поле «Название» обязательно")
      return
    }
    if (!newVoiceUrl.trim()) {
      toast.error("Укажите ссылку на голос Fish Audio или 32-символьный код")
      return
    }
    setAddingVoice(true)
    try {
      const added = await voice.addVoice({
        fish_url: newVoiceUrl.trim(),
        name: newVoiceName.trim(),
        langs: newVoiceLangs,
      })
      const voicesRes = await voice.voices()
      setVoices(voicesRes)
      setNewVoiceUrl("")
      setNewVoiceName("")
      toast.success(`Голос «${added.name}» (${added.id}) проверен и добавлен`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Голоса нет в библиотеке Fish, проверьте ссылку")
    } finally {
      setAddingVoice(false)
    }
  }

  // Check voices availability in Fish Audio (22.10)
  const handleCheckVoices = async (profileId?: string) => {
    setCheckingVoices(true)
    try {
      const checked = await voice.checkVoices(profileId ? { profile_id: profileId } : {})
      const allRes = await voice.voices()
      setVoices(allRes)
      const missing = checked.filter((v) => v.status === "missing")
      if (missing.length > 0) {
        toast.warning(`Проверено голосов: ${checked.length}. Недоступны в Fish: ${missing.map((m) => m.name).join(", ")}`)
      } else {
        toast.success(`Все голоса (${checked.length}) доступны в библиотеке Fish Audio`)
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка проверки голосов")
    } finally {
      setCheckingVoices(false)
    }
  }

  // Filtered paragraphs by search query
  const visibleParagraphs = useMemo(() => {
    const q = paraSearch.trim().toLowerCase()
    if (!q) return paragraphs
    return paragraphs.filter(
      (p) =>
        String(p.n) === q.replace(/^#/, "") ||
        p.source.toLowerCase().includes(q) ||
        p.text.toLowerCase().includes(q)
    )
  }, [paragraphs, paraSearch])

  const selectedScriptObj = useMemo(
    () => scripts.find((s) => s.script_id === launchScriptId) ?? scripts[0] ?? null,
    [scripts, launchScriptId]
  )

  const selectedLangObj: VoiceJobLanguage | undefined = useMemo(
    () => selectedJob?.languages.find((l) => l.lang === selectedLang),
    [selectedJob, selectedLang]
  )

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-7 py-12">
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin text-electric" />
          Загрузка рабочего места озвучки и перевода…
        </div>
      </div>
    )
  }

  return (
    <div className="px-4 pt-6 pb-24 sm:px-7">
      {/* Top breadcrumb + Screen Switcher */}
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <span>Озвучка и перевод</span>
          {selectedJob && (
            <>
              <ChevronRight className="size-3.5 text-faint" />
              <span className="font-medium text-foreground-2">
                #{selectedJob.id} · {selectedJob.title}
              </span>
              <span className="rounded-[2px] border border-line-strong bg-surface-2 px-1.5 py-0.5 font-mono text-[11px]">
                {selectedJob.voice_model === "drama-3" ? "Fish Drama 3" : "Fish S2.1"}
              </span>
            </>
          )}
        </div>
        {queueStatus && (
          <div className="flex flex-wrap items-center gap-3 font-mono text-[11px]">
            <span>
              Очередь: <strong className="text-foreground">{queueStatus.running}</strong> в работе ·{" "}
              <strong className="text-foreground">{queueStatus.queued}</strong> ждёт
            </span>
            <span className="text-faint">|</span>
            <span>Gemini {queueStatus.slots.gemini.used}/{queueStatus.slots.gemini.total}</span>
            <span>Claude {queueStatus.slots.claude.used}/{queueStatus.slots.claude.total}</span>
            <span>Fish {queueStatus.slots.voice.used}/{queueStatus.slots.voice.total}</span>
          </div>
        )}
      </div>

      <PageHeader
        title="Озвучка и перевод"
        subtitle={
          selectedJob
            ? `${selectedJob.targets.length} целевых языков · ${selectedJob.paragraphs_total} абзацев · основа ${selectedJob.source_lang} · ~${formatDuration(selectedJob.source_duration_sec)} · профиль «${selectedJob.profile_name}»`
            : "Перевод сценария, синтез речи в Fish Audio (S2.1 и Drama 3) и автоматическое сведение по таймингу"
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-[4px] border border-line bg-surface p-0.5 text-[13px]">
              {(
                [
                  ["workspace", "Рабочий экран", AudioLines],
                  ["launch", "Запуск и очередь", Sparkles],
                  ["profiles", "Профили и голоса", Settings2],
                ] as const
              ).map(([id, label, Icon]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setScreen(id)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-[3px] px-3 py-1.5 font-medium transition-colors",
                    screen === id
                      ? "bg-inverse text-inverse-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Icon className="size-3.5" />
                  {label}
                </button>
              ))}
            </div>

            {screen !== "launch" && (
              <button
                type="button"
                onClick={() => setScreen("launch")}
                className="flex h-8 items-center gap-1.5 rounded-[4px] bg-electric px-3 text-[13px] font-medium text-white transition-opacity hover:opacity-90"
              >
                <Plus className="size-3.5" />
                Новая задача
              </button>
            )}
          </div>
        }
      />

      {/* =================================================================== */}
      {/* SCREEN 1: РАБОЧИЙ ЭКРАН (WORKSPACE)                                 */}
      {/* =================================================================== */}
      {screen === "workspace" && selectedJob && (
        <div className="space-y-5">
          {/* Job Selector Strip + Global Actions */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-[4px] border border-line bg-surface p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground">Задача:</span>
              <div className="flex flex-wrap gap-1.5">
                {jobs.slice(0, 7).map((j) => {
                  const active = j.id === selectedJob.id
                  return (
                    <button
                      key={j.id}
                      type="button"
                      onClick={() => setSelectedJobId(j.id)}
                      className={cn(
                        "flex items-center gap-1.5 rounded-[3px] border px-2.5 py-1 text-xs transition-colors",
                        active
                          ? "border-electric bg-electric-soft font-medium text-foreground"
                          : "border-line bg-surface-2 text-muted-foreground hover:border-line-strong hover:text-foreground"
                      )}
                    >
                      <span
                        className={cn(
                          "size-1.5 rounded-full",
                          j.status === "done"
                            ? "bg-ok"
                            : j.status === "running"
                              ? "animate-pulse bg-electric"
                              : j.status === "failed"
                                ? "bg-danger"
                                : "bg-warn"
                        )}
                      />
                      <span className="font-mono text-[11px] opacity-75">#{j.id}</span>
                      <span className="max-w-[160px] truncate">{j.title}</span>
                      {j.voice_model === "drama-3" && (
                        <span className="rounded-[2px] bg-electric/20 px-1 py-0.2 font-mono text-[10px] text-electric-text">
                          Drama 3
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {selectedJob.emotion_tags_count > 0 && (
                <span className="flex items-center gap-1 rounded-[3px] border border-electric/30 bg-electric-soft px-2 py-1 text-xs text-electric-text">
                  <Sparkles className="size-3" />
                  Теги эмоций в {selectedJob.emotion_tags_count} абз.
                  {selectedJob.carry_mood ? " · перенос настроения вкл." : ""}
                </span>
              )}

              {selectedJob.status === "running" && (
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const u = await voice.stopJob(selectedJob.id)
                      setJobs((prev) => prev.map((x) => (x.id === u.id ? u : x)))
                      toast.info("Задача остановлена")
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : "Не удалось остановить")
                    }
                  }}
                  className="flex h-8 items-center gap-1.5 rounded-[3px] border border-danger/40 bg-danger/10 px-2.5 text-xs font-medium text-danger hover:bg-danger/20"
                >
                  <Square className="size-3" />
                  Стоп
                </button>
              )}

              {(selectedJob.status === "stopped" || selectedJob.status === "failed") && (
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const u = await voice.resumeJob(selectedJob.id)
                      setJobs((prev) => prev.map((x) => (x.id === u.id ? u : x)))
                      toast.success("Задача перезапущена с места остановки")
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : "Не удалось продолжить")
                    }
                  }}
                  className="flex h-8 items-center gap-1.5 rounded-[3px] border border-line-strong bg-surface-2 px-2.5 text-xs font-medium text-foreground hover:bg-elev"
                >
                  <RotateCcw className="size-3" />
                  Продолжить с места остановки
                </button>
              )}

              <a
                href={voice.zipAllUrl(selectedJob.id)}
                download
                className="flex h-8 items-center gap-1.5 rounded-[3px] bg-inverse px-3 text-xs font-medium text-inverse-foreground transition-opacity hover:opacity-90"
              >
                <Download className="size-3.5" />
                Скачать всё (.zip)
              </a>
            </div>
          </div>

          {/* 22.10 Alert Banner: Skipped languages due to voice_missing */}
          {skippedLangsOnSelectedJob.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-[4px] border border-danger/40 bg-danger/10 p-3.5">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger" />
                <div>
                  <div className="text-sm font-medium text-foreground">
                    Пропущена озвучка для языков: {skippedLangsOnSelectedJob.join(", ")} (голос удалён или скрыт в Fish Audio)
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    Перевод готов и сохранён. Выберите другой доступный голос и нажмите «Дозвучить пропущенные».
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {skippedLangsOnSelectedJob.map((lang) => (
                  <div key={lang} className="flex items-center gap-1.5 text-xs">
                    <span className="font-mono font-semibold">{lang}:</span>
                    <select
                      value={replacementVoices[lang] ?? ""}
                      onChange={(e) =>
                        setReplacementVoices((prev) => ({ ...prev, [lang]: e.target.value }))
                      }
                      className="h-7 rounded-[3px] border border-line-strong bg-surface px-2 text-xs text-foreground"
                    >
                      <option value="">Выбрать голос…</option>
                      {voices
                        .filter((v) => v.status !== "missing")
                        .map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.name} ({v.id})
                          </option>
                        ))}
                    </select>
                  </div>
                ))}
                <button
                  type="button"
                  disabled={revoicingSkipped}
                  onClick={handleRevoiceSkipped}
                  className="flex h-8 items-center gap-1.5 rounded-[3px] bg-electric px-3 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
                >
                  {revoicingSkipped && <Loader2 className="size-3 animate-spin" />}
                  Дозвучить пропущенные
                </button>
              </div>
            </div>
          )}

          {/* Norm Suggestion Banner from Job Summary */}
          {selectedJob.summary &&
            Object.entries(selectedJob.summary.norm_suggestions).length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-[4px] border border-warn/40 bg-warn-soft/50 px-3.5 py-2.5 text-xs">
                <div className="flex items-center gap-2 text-foreground-2">
                  <Wand2 className="size-3.5 text-warn" />
                  <span>
                    Подсказка по длине перевода:{" "}
                    {Object.entries(selectedJob.summary.norm_suggestions).map(([lang, bounds], i) => (
                      <span key={lang}>
                        {i > 0 && " · "}для <strong>{lang}</strong> много ускоренных абзацев — рекомендуем убавить норму до{" "}
                        <strong className="font-mono">
                          {bounds[0]}–{bounds[1]}%
                        </strong>
                      </span>
                    ))}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(selectedJob.summary.norm_suggestions).map(([lang, bounds]) => (
                    <button
                      key={lang}
                      type="button"
                      onClick={() => handleApplyNormSuggestion(lang, bounds as [number, number])}
                      className="rounded-[3px] border border-warn/50 bg-surface px-2 py-1 text-[11px] font-medium text-warn hover:bg-elev"
                    >
                      Применить {lang} ({bounds[0]}–{bounds[1]}%)
                    </button>
                  ))}
                </div>
              </div>
            )}

          {/* 8 Language Matrix Cards */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
                Языки задачи ({selectedJob.languages.length}) · нажмите на карточку для работы со сценами
              </span>
              <span className="font-mono text-[11px] text-muted-foreground">
                Перевод: {selectedJob.model} · Озвучка:{" "}
                {selectedJob.voice_model === "drama-3" ? "Fish Drama 3" : "Fish S2.1"}
              </span>
            </div>

            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
              {selectedJob.languages.map((l) => {
                const isSource = l.lang === selectedJob.source_lang
                const isSelected = l.lang === selectedLang
                const isMissing = l.voice.state === "voice_missing"
                const docxFile = selectedJob.files.find((f) => f.lang === l.lang && f.kind === "docx")
                const mp3File = selectedJob.files.find((f) => f.lang === l.lang && f.kind === "joined_mp3")
                const zipFile = selectedJob.files.find((f) => f.lang === l.lang && f.kind === "mixed_zip")
                const sumLang = selectedJob.summary?.languages[l.lang]

                return (
                  <div
                    key={l.lang}
                    onClick={() => {
                      if (!isSource) setSelectedLang(l.lang)
                    }}
                    className={cn(
                      "group relative flex flex-col justify-between rounded-[4px] border p-3 transition-all",
                      isSource
                        ? "border-line bg-surface/80"
                        : "cursor-pointer hover:border-line-strong",
                      isSelected && !isSource
                        ? "border-electric bg-electric-soft/35 ring-1 ring-electric/30"
                        : "border-line bg-surface",
                      isMissing && "border-danger/50 bg-danger/5"
                    )}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="rounded-[2px] border border-line-strong bg-surface-2 px-1.5 py-0.5 font-mono text-xs font-semibold">
                            {l.lang}
                          </span>
                          <span className="text-sm font-medium">{LANG_NAMES[l.lang] ?? l.lang}</span>
                        </div>
                        {isSource ? (
                          <span className="rounded-[2px] border border-line-strong bg-elev px-1.5 py-0.5 text-[11px] text-muted-foreground">
                            Оригинал · основа
                          </span>
                        ) : isMissing ? (
                          <span className="flex items-center gap-1 rounded-[2px] bg-danger/20 px-1.5 py-0.5 text-[11px] font-medium text-danger">
                            <XCircle className="size-3" />
                            Голос пропал
                          </span>
                        ) : l.stage === "done" ? (
                          <span className="flex items-center gap-1 rounded-[2px] bg-ok/15 px-1.5 py-0.5 text-[11px] font-medium text-ok">
                            <CheckCircle2 className="size-3" />
                            Готово
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 rounded-[2px] bg-electric/20 px-1.5 py-0.5 text-[11px] font-medium text-electric-text">
                            <Loader2 className="size-3 animate-spin" />
                            {l.stage === "translate"
                              ? `Перевод ${l.translate?.parts_done ?? 0}/${l.translate?.parts_total ?? 8}`
                              : l.stage === "voice"
                                ? `Озвучка ${l.voice.done}/${l.voice.total}`
                                : `Сведение ${l.mix?.done ?? 0}/${l.mix?.total ?? 0}`}
                          </span>
                        )}
                      </div>

                      {/* Voice & Model info */}
                      <div className="mt-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                        <span className="truncate">
                          Голос: <strong className="font-normal text-foreground-2">{l.voice.voice_name}</strong>
                        </span>
                        <span className="shrink-0 font-mono text-[11px] whitespace-nowrap">
                          {l.voice.fish_model === "drama" ? "drama-3" : "s2.1"}
                        </span>
                      </div>

                      {/* Metrics for target languages */}
                      {!isSource && l.translate && (
                        <div className="mt-2.5 grid grid-cols-3 gap-1.5 rounded-[3px] border border-line bg-surface-2/70 p-2 font-mono text-[11px]">
                          <div>
                            <div className="text-[10px] text-faint">Длина</div>
                            <div className="font-semibold text-foreground">
                              {l.translate.length_pct ? `${l.translate.length_pct}%` : "—"}
                            </div>
                          </div>
                          <div>
                            <div className="text-[10px] text-faint">В норме</div>
                            <div className="font-semibold text-ok">
                              {l.translate.in_norm ?? 0}/{l.translate.total ?? selectedJob.paragraphs_total}
                            </div>
                          </div>
                          <div>
                            <div className="text-[10px] text-faint">Ускор.</div>
                            <div
                              className={cn(
                                "font-semibold",
                                (l.mix?.max_speedup ?? 1) > 1.08 ? "text-warn" : "text-foreground-2"
                              )}
                            >
                              {l.mix?.sped_up ?? 0} · ×{(l.mix?.max_speedup ?? 1).toFixed(2)}
                            </div>
                          </div>
                        </div>
                      )}

                      {isSource && (
                        <div className="mt-2.5 rounded-[3px] border border-line bg-surface-2/70 p-2 font-mono text-[11px] text-muted-foreground">
                          Дорожек: <strong className="text-foreground">{l.voice.done}/{l.voice.total}</strong> ·
                          Длительность: <strong className="text-foreground">{formatDuration(selectedJob.source_duration_sec)}</strong>
                        </div>
                      )}
                    </div>

                    {/* Footer: reused tracks + download links */}
                    <div className="mt-2.5 flex items-center justify-between border-t border-line pt-2 text-[11px]">
                      <span className="font-mono text-faint">
                        {sumLang && sumLang.carried > 0
                          ? `перенос: ${sumLang.carried} абз.`
                          : l.voice.reused > 0
                            ? `${l.voice.new} нов. · ${l.voice.reused} гот.`
                            : `${l.voice.done} дор.`}
                      </span>
                      {!isSource && (
                        <div
                          className="flex items-center gap-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {docxFile && (
                            <a
                              href={voiceMediaUrl(docxFile.url)}
                              download
                              className="rounded-[2px] border border-line-strong bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] text-foreground-2 hover:bg-elev hover:text-foreground"
                            >
                              .docx
                            </a>
                          )}
                          {mp3File && (
                            <a
                              href={voiceMediaUrl(mp3File.url)}
                              download
                              className="rounded-[2px] border border-line-strong bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] text-foreground-2 hover:bg-elev hover:text-foreground"
                            >
                              .mp3
                            </a>
                          )}
                          {zipFile && (
                            <a
                              href={voiceMediaUrl(zipFile.url)}
                              download
                              className="rounded-[2px] border border-line-strong bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] text-foreground-2 hover:bg-elev hover:text-foreground"
                            >
                              .zip
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Synchronized Audio Player + Waveform Scrubber */}
          <div className="rounded-[4px] border border-line bg-surface p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    const p = paragraphs.find((x) => x.n === activeParaN) ?? paragraphs[0]
                    if (!p) return
                    const url = trackMode === "source" ? p.source_audio_url : p.audio_url
                    playAudioUrl(url, `#${p.n} (${trackMode === "source" ? selectedJob.source_lang : selectedLang})`)
                  }}
                  className="flex size-9 items-center justify-center rounded-full bg-electric text-white transition-opacity hover:opacity-90"
                >
                  {isPlaying ? <Pause className="size-4" /> : <Play className="ml-0.5 size-4" />}
                </button>
                <div>
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <span>
                      Дорожка {selectedLang} ({LANG_NAMES[selectedLang]}) ↔ {selectedJob.source_lang} оригинал
                    </span>
                    {playingLabel && (
                      <span className="rounded-[2px] bg-electric-soft px-1.5 py-0.5 font-mono text-[11px] text-electric-text">
                        {isPlaying ? "▶ Играет" : "Пауза"}: {playingLabel}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Абзац #{activeParaN} из {selectedJob.paragraphs_total} · кликните по столбцу волны для перехода к абзацу
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Track Switcher */}
                <div className="flex rounded-[3px] border border-line bg-surface-2 p-0.5 text-xs">
                  <button
                    type="button"
                    onClick={() => setTrackMode("mixed")}
                    className={cn(
                      "rounded-[2px] px-2.5 py-1 transition-colors",
                      trackMode === "mixed"
                        ? "bg-inverse font-medium text-inverse-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    Перевод ({selectedLang})
                  </button>
                  <button
                    type="button"
                    onClick={() => setTrackMode("source")}
                    className={cn(
                      "rounded-[2px] px-2.5 py-1 transition-colors",
                      trackMode === "source"
                        ? "bg-inverse font-medium text-inverse-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    Оригинал ({selectedJob.source_lang})
                  </button>
                </div>

                {/* Speed Switcher */}
                <div className="flex rounded-[3px] border border-line bg-surface-2 p-0.5 font-mono text-xs">
                  {[1, 1.25, 1.5].map((rate) => (
                    <button
                      key={rate}
                      type="button"
                      onClick={() => setPlaybackRate(rate)}
                      className={cn(
                        "rounded-[2px] px-2 py-1 transition-colors",
                        playbackRate === rate
                          ? "bg-elev font-medium text-foreground"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {rate}×
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Interactive Paragraph Waveform Timeline */}
            <div className="flex h-14 items-end gap-[2px] overflow-x-auto rounded-[3px] border border-line bg-surface-2/80 px-2 py-1.5">
              {paragraphs.slice(0, 90).map((p) => {
                const pPeaks = peaks[String(p.n)] ?? [0.4, 0.65, 0.5]
                const avgPeak = pPeaks.reduce((a, b) => a + b, 0) / pPeaks.length
                const heightPct = Math.max(20, Math.min(100, Math.round(avgPeak * 100)))
                const isCurrent = p.n === activeParaN
                return (
                  <button
                    key={p.n}
                    type="button"
                    title={`Абзац #${p.n} (${p.timecode}) · ${p.length_pct}% · ×${p.audio?.speedup ?? 1}`}
                    onClick={() => {
                      setActiveParaN(p.n)
                      const el = document.getElementById(`voice-para-${p.n}`)
                      el?.scrollIntoView({ behavior: "smooth", block: "center" })
                    }}
                    className="group flex h-full flex-1 min-w-[6px] flex-col items-center justify-end"
                  >
                    <div
                      style={{ height: `${heightPct}%` }}
                      className={cn(
                        "w-full rounded-t-[1px] transition-all",
                        isCurrent
                          ? "bg-electric ring-1 ring-electric"
                          : !p.tags_ok
                            ? "bg-danger/80 group-hover:bg-danger"
                            : !p.in_norm
                              ? "bg-warn/80 group-hover:bg-warn"
                              : (p.audio?.speedup ?? 1) > 1.05
                                ? "bg-electric/60 group-hover:bg-electric"
                                : "bg-faint/50 group-hover:bg-foreground-2"
                      )}
                    />
                  </button>
                )
              })}
            </div>
            <div className="mt-1.5 flex flex-wrap items-center justify-between text-[11px] text-muted-foreground">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5">
                  <span className="size-2 rounded-[1px] bg-faint/60" /> В норме
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="size-2 rounded-[1px] bg-warn" /> Вне нормы длины
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="size-2 rounded-[1px] bg-electric/70" /> Ускорен при сведении
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="size-2 rounded-[1px] bg-danger" /> Проблема с тегом эмоций
                </span>
              </div>
              <span className="font-mono">
                Норма для {selectedLang}:{" "}
                {selectedLangObj?.translate ? `${ paragraphs[0]?.norm[0] ?? 70}–${paragraphs[0]?.norm[1] ?? 73}%` : "—"}
              </span>
            </div>
          </div>

          {/* Paragraph Filter Bar + Search */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5">
              {(
                [
                  ["all", "Все сцены", allParagraphsCount.all],
                  ["off_norm", "Вне нормы длины", allParagraphsCount.off_norm],
                  ["sped_up", "Ускоренные", allParagraphsCount.sped_up],
                  ["edited", "С правками", allParagraphsCount.edited],
                  ["tags", "Проблемы с тегами", allParagraphsCount.tags],
                ] as const
              ).map(([fKey, label, count]) => (
                <button
                  key={fKey}
                  type="button"
                  onClick={() => setParaFilter(fKey)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-[3px] border px-2.5 py-1.5 text-xs font-medium transition-colors",
                    paraFilter === fKey
                      ? "border-electric bg-electric-soft text-foreground"
                      : "border-line bg-surface text-muted-foreground hover:border-line-strong hover:text-foreground"
                  )}
                >
                  <span>{label}</span>
                  <span
                    className={cn(
                      "rounded-[2px] px-1.5 py-0.2 font-mono text-[11px]",
                      paraFilter === fKey ? "bg-electric text-white" : "bg-surface-2 text-muted-foreground"
                    )}
                  >
                    {count}
                  </span>
                </button>
              ))}
            </div>

            <div className="relative min-w-[240px]">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={paraSearch}
                onChange={(e) => setParaSearch(e.target.value)}
                placeholder="Поиск по тексту или #номеру абзаца…"
                className="h-8 w-full rounded-[3px] border border-line bg-surface pr-3 pl-8 text-xs text-foreground placeholder:text-faint focus:border-electric focus:outline-none"
              />
            </div>
          </div>

          {/* Side-by-Side Paragraphs Table */}
          {loadingParas ? (
            <div className="flex items-center justify-center rounded-[4px] border border-line bg-surface p-12 text-xs text-muted-foreground">
              <Loader2 className="mr-2 size-4 animate-spin text-electric" />
              Загрузка абзацев сценария…
            </div>
          ) : visibleParagraphs.length === 0 ? (
            <div className="rounded-[4px] border border-dashed border-line-strong bg-surface p-10 text-center text-sm text-muted-foreground">
              По выбранному фильтру абзацев не найдено.
            </div>
          ) : (
            <div className="space-y-2.5">
              {visibleParagraphs.map((p) => {
                const isEditing = editingParaN === p.n
                const m = isEditing && liveMeasure ? liveMeasure : p
                const variants = compareResults[p.n]

                return (
                  <div
                    key={p.n}
                    id={`voice-para-${p.n}`}
                    onClick={() => setActiveParaN(p.n)}
                    className={cn(
                      "rounded-[4px] border transition-colors",
                      activeParaN === p.n
                        ? "border-line-strong bg-surface"
                        : "border-line bg-surface/75 hover:border-line-strong"
                    )}
                  >
                    {/* Top Row Header of Paragraph */}
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-surface-2/60 px-3.5 py-2 text-xs">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <span className="font-mono text-xs font-semibold text-foreground">#{p.n}</span>
                        <span className="font-mono text-[11px] text-muted-foreground">{p.timecode}</span>

                        {/* Length % badge */}
                        <span
                          className={cn(
                            "rounded-[2px] px-1.5 py-0.5 font-mono text-[11px] font-medium",
                            m.in_norm
                              ? "bg-ok/15 text-ok"
                              : "bg-warn-soft text-warn"
                          )}
                        >
                          {m.length_pct}% (норма {m.norm[0]}–{m.norm[1]}%)
                          {m.chars_delta !== 0 && (
                            <span className="ml-1 opacity-85">
                              {m.chars_delta > 0 ? `· убрать ${m.chars_delta} зн.` : `· добавить ${Math.abs(m.chars_delta)} зн.`}
                            </span>
                          )}
                        </span>

                        {/* Audio timing & speedup */}
                        {p.audio && (
                          <span className="font-mono text-[11px] text-muted-foreground">
                            слот {p.audio.slot_sec}с · дорожка {p.audio.track_sec}с
                            {p.audio.speedup > 1.0 && (
                              <strong className="ml-1 text-electric-text">· ×{p.audio.speedup}</strong>
                            )}
                          </span>
                        )}

                        {/* Edited badge */}
                        {p.edited && (
                          <span className="rounded-[2px] border border-electric/40 bg-electric-soft px-1.5 py-0.5 text-[10px] font-medium text-electric-text">
                            Правлено вручную (v{p.version})
                          </span>
                        )}

                        {/* 22.10 Carry mood badge */}
                        {p.carried_mood && (
                          <span className="rounded-[2px] border border-line-strong bg-elev px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                            ↳ перенос: {p.carried_mood}
                          </span>
                        )}

                        {/* 22.10 Tags problem badge */}
                        {!m.tags_ok && (
                          <span className="flex items-center gap-1 rounded-[2px] bg-danger/20 px-1.5 py-0.5 text-[11px] font-medium text-danger">
                            <AlertTriangle className="size-3" />
                            {m.tags_problem === "missing"
                              ? "Потерян тег эмоций"
                              : m.tags_problem === "translated"
                                ? "Переведён тег эмоций"
                                : "Битый XML-тег"}
                          </span>
                        )}
                      </div>

                      {/* Paragraph Action Buttons */}
                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            playAudioUrl(p.source_audio_url, `#${p.n} ${selectedJob.source_lang}`)
                          }}
                          className="flex h-6 items-center gap-1 rounded-[2px] border border-line-strong bg-surface px-2 text-[11px] text-muted-foreground hover:text-foreground"
                        >
                          <Play className="size-2.5" />
                          {selectedJob.source_lang}
                        </button>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            playAudioUrl(p.audio_url, `#${p.n} ${selectedLang}`)
                          }}
                          className="flex h-6 items-center gap-1 rounded-[2px] border border-electric/40 bg-electric-soft px-2 text-[11px] font-medium text-electric-text hover:opacity-90"
                        >
                          <Play className="size-2.5" />
                          {selectedLang}
                        </button>

                        {!isEditing && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              startEditingPara(p)
                            }}
                            className="flex h-6 items-center gap-1 rounded-[2px] border border-line-strong bg-surface px-2 text-[11px] text-foreground-2 hover:bg-elev"
                          >
                            <Edit3 className="size-2.5" />
                            Править
                          </button>
                        )}

                        <button
                          type="button"
                          disabled={busyParaAction === `retranslate-${p.n}`}
                          onClick={(e) => {
                            e.stopPropagation()
                            void handleRetranslateParagraph(p)
                          }}
                          className="flex h-6 items-center gap-1 rounded-[2px] border border-line-strong bg-surface px-2 text-[11px] text-muted-foreground hover:text-foreground disabled:opacity-50"
                        >
                          <RefreshCw
                            className={cn("size-2.5", busyParaAction === `retranslate-${p.n}` && "animate-spin")}
                          />
                          Переперевести
                        </button>

                        <button
                          type="button"
                          disabled={busyParaAction === `revoice-${p.n}`}
                          onClick={(e) => {
                            e.stopPropagation()
                            void handleRevoiceParagraph(p)
                          }}
                          className="flex h-6 items-center gap-1 rounded-[2px] border border-line-strong bg-surface px-2 text-[11px] text-muted-foreground hover:text-foreground disabled:opacity-50"
                        >
                          <Volume2 className="size-2.5" />
                          Переозвучить
                        </button>

                        <button
                          type="button"
                          disabled={busyParaAction === `compare-${p.n}`}
                          onClick={(e) => {
                            e.stopPropagation()
                            void handleCompareVoices(p)
                          }}
                          className="flex h-6 items-center gap-1 rounded-[2px] border border-line-strong bg-surface px-2 text-[11px] text-muted-foreground hover:text-foreground disabled:opacity-50"
                        >
                          <Sparkles className="size-2.5 text-electric" />
                          Сравнить модели
                        </button>

                        {p.edited && (
                          <button
                            type="button"
                            disabled={busyParaAction === `revert-${p.n}`}
                            onClick={(e) => {
                              e.stopPropagation()
                              void handleRevertParagraph(p)
                            }}
                            className="flex h-6 items-center gap-1 rounded-[2px] border border-line-strong bg-surface px-2 text-[11px] text-warn hover:bg-elev"
                          >
                            <RotateCcw className="size-2.5" />
                            Вариант модели
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Side-by-Side Columns: Source (left) & Target Translation (right) */}
                    <div className="grid grid-cols-1 divide-y divide-line lg:grid-cols-2 lg:divide-x lg:divide-y-0">
                      {/* Source Paragraph */}
                      <div className="p-3.5 text-[13.5px] leading-relaxed text-foreground-2">
                        <div className="mb-1 flex items-center justify-between text-[11px] font-medium text-faint">
                          <span>ОРИГИНАЛ ({selectedJob.source_lang})</span>
                          {p.audio && <span className="font-mono">{p.audio.source_sec}с</span>}
                        </div>
                        <RichTaggedText text={p.source} />
                      </div>

                      {/* Target Translation Paragraph */}
                      <div className="p-3.5 text-[13.5px] leading-relaxed text-foreground">
                        <div className="mb-1 flex items-center justify-between text-[11px] font-medium text-faint">
                          <span>ПЕРЕВОД ({selectedLang})</span>
                          <span className="font-mono">v{p.version}</span>
                        </div>

                        {isEditing ? (
                          <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
                            <textarea
                              rows={4}
                              value={editDraft}
                              onChange={(e) => void handleDraftChange(p, e.target.value)}
                              className="w-full rounded-[3px] border border-electric bg-surface-2 p-2.5 text-[13.5px] leading-relaxed text-foreground focus:outline-none"
                            />
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="text-xs text-muted-foreground">
                                Теги в <code className="font-mono text-electric-text">[скобках]</code> и{" "}
                                <code className="font-mono text-warn">&lt;тегах&gt;</code> не входят в подсчёт длины
                              </span>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => setEditingParaN(null)}
                                  className="h-7 rounded-[3px] border border-line-strong px-2.5 text-xs text-muted-foreground hover:text-foreground"
                                >
                                  Отмена
                                </button>
                                <button
                                  type="button"
                                  disabled={busyParaAction === `save-${p.n}`}
                                  onClick={() => void handleSaveParagraph(p)}
                                  className="flex h-7 items-center gap-1 rounded-[3px] bg-electric px-3 text-xs font-medium text-white hover:opacity-90"
                                >
                                  <Check className="size-3" />
                                  Сохранить текст
                                </button>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div
                            onClick={() => startEditingPara(p)}
                            className="cursor-text rounded-[2px] transition-colors hover:bg-surface-2/60"
                          >
                            <RichTaggedText text={p.text} />
                          </div>
                        )}
                      </div>
                    </div>

                    {/* 22.10 Model Comparison Strip (S2.1 Free vs S2.1 Pro vs Drama 3 vs Drama 3 + carry) */}
                    {variants && variants.length > 0 && (
                      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line bg-electric-soft/25 px-3.5 py-2 text-xs">
                        <span className="font-medium text-electric-text">
                          Сравнение моделей Fish Audio на абзаце #{p.n}:
                        </span>
                        <div className="flex flex-wrap items-center gap-2">
                          {variants.map((v) => (
                            <button
                              key={v.label}
                              type="button"
                              disabled={!v.audio_url}
                              onClick={(e) => {
                                e.stopPropagation()
                                playAudioUrl(v.audio_url, `#${p.n} · ${v.label}`)
                              }}
                              className="flex items-center gap-1.5 rounded-[3px] border border-line-strong bg-surface px-2.5 py-1 text-xs hover:border-electric"
                            >
                              <Play className="size-3 text-electric" />
                              <span className="font-medium">{v.label}</span>
                              {v.sec && <span className="font-mono text-[11px] text-muted-foreground">{v.sec}с</span>}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* =================================================================== */}
      {/* SCREEN 2: ЗАПУСК ПЕРЕВОДА И ОЗВУЧКИ (LAUNCH & QUEUE)                */}
      {/* =================================================================== */}
      {screen === "launch" && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Left Column: Launch Configuration (8 cols) */}
          <div className="space-y-5 lg:col-span-8">
            {/* Step 1: Script (.docx) */}
            <section className="rounded-[4px] border border-line bg-surface p-4">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold">1. Сценарий (.docx)</h2>
                  <p className="text-xs text-muted-foreground">
                    Загрузите новый документ Word с нумерованными абзацами или выберите сценарий из рабочей папки
                  </p>
                </div>
                <label className="flex h-8 cursor-pointer items-center gap-1.5 rounded-[3px] border border-line-strong bg-surface-2 px-3 text-xs font-medium text-foreground hover:bg-elev">
                  {uploadingScript ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
                  <span>Загрузить .docx</span>
                  <input
                    type="file"
                    accept=".docx"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0]
                      if (f) void handleScriptUpload(f)
                    }}
                  />
                </label>
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {scripts.map((s) => {
                  const active = s.script_id === launchScriptId
                  return (
                    <button
                      key={s.script_id}
                      type="button"
                      onClick={() => {
                        setLaunchScriptId(s.script_id)
                        setLaunchSourceLang(s.source_lang)
                        if (s.emotion_tags_count > 0) {
                          setLaunchVoiceModel("drama-3")
                          setLaunchCarryMood(true)
                        }
                      }}
                      className={cn(
                        "flex flex-col items-start rounded-[4px] border p-3 text-left transition-colors",
                        active
                          ? "border-electric bg-electric-soft/40"
                          : "border-line bg-surface-2/60 hover:border-line-strong"
                      )}
                    >
                      <div className="flex w-full items-center justify-between gap-2">
                        <span className="font-medium text-foreground">{s.title}</span>
                        <span className="rounded-[2px] border border-line-strong bg-surface px-1.5 py-0.5 font-mono text-[11px]">
                          {s.source_lang}
                        </span>
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-2 font-mono text-[11px] text-muted-foreground">
                        <span>{s.paragraphs_total} абзацев</span>
                        <span>·</span>
                        <span>{s.words_total} слов</span>
                        <span>·</span>
                        <span>{formatBytes(s.bytes_total)}</span>
                      </div>
                      {s.emotion_tags_count > 0 && (
                        <div className="mt-2 flex items-center gap-1 rounded-[2px] bg-electric/15 px-1.5 py-0.5 text-[11px] text-electric-text">
                          <Sparkles className="size-3" />
                          Размечено тегами эмоций: {s.emotion_tags_count} из {s.paragraphs_total} абз.
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            </section>

            {/* Step 2: Mode */}
            <section className="rounded-[4px] border border-line bg-surface p-4">
              <h2 className="mb-1 text-base font-semibold">2. Режим работы</h2>
              <p className="mb-3 text-xs text-muted-foreground">
                По умолчанию выполняется весь цикл: перевод → озвучка оригинала и переводов → сведение по таймингу
              </p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
                {(
                  [
                    ["all", "Всё целиком", "Перевод, озвучка и сведение под длину оригинала"],
                    ["translate", "Только перевод", "Генерация .md и .docx по нормам длины"],
                    ["voice", "Только озвучка", "Синтез дорожек в Fish Audio по готовому тексту"],
                    ["mix", "Только сведение", "Выравнивание пауз и темпа готовых дорожек"],
                  ] as const
                ).map(([mId, title, desc]) => (
                  <button
                    key={mId}
                    type="button"
                    onClick={() => setLaunchMode(mId)}
                    className={cn(
                      "flex flex-col items-start rounded-[4px] border p-3 text-left transition-colors",
                      launchMode === mId
                        ? "border-electric bg-electric-soft/40"
                        : "border-line bg-surface-2/60 hover:border-line-strong"
                    )}
                  >
                    <span className="text-sm font-medium">{title}</span>
                    <span className="mt-1 text-xs text-muted-foreground">{desc}</span>
                  </button>
                ))}
              </div>
            </section>

            {/* Step 3: Profile, Source Language & Target Languages */}
            <section className="rounded-[4px] border border-line bg-surface p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-base font-semibold">3. Профиль озвучки и языки</h2>
                  <p className="text-xs text-muted-foreground">
                    Голоса фиксируются в задаче при запуске — последующая правка профиля не ломает идущие задачи
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={launchProfileId}
                    onChange={(e) => {
                      const pid = e.target.value
                      setLaunchProfileId(pid)
                      const prof = profiles.find((p) => p.id === pid)
                      if (prof) setLaunchVoices({ ...prof.default })
                    }}
                    className="h-8 rounded-[3px] border border-line-strong bg-surface-2 px-2.5 text-xs font-medium text-foreground"
                  >
                    {profiles.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setScreen("profiles")}
                    className="text-xs text-electric-text hover:underline"
                  >
                    Настроить →
                  </button>
                </div>
              </div>

              <div className="mb-3 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Язык оригинала (основа тайминга):</span>
                  <span className="rounded-[2px] border border-line-strong bg-elev px-2 py-0.5 font-mono font-semibold">
                    {launchSourceLang} ({LANG_NAMES[launchSourceLang]})
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setLaunchTargets(ALL_LANGS.filter((l) => l !== launchSourceLang))
                    }
                    className="text-xs text-electric-text hover:underline"
                  >
                    Выбрать все 7
                  </button>
                  <span className="text-faint">·</span>
                  <button
                    type="button"
                    onClick={() => setLaunchTargets([])}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    Сбросить
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {ALL_LANGS.filter((l) => l !== launchSourceLang).map((lang) => {
                  const checked = launchTargets.includes(lang)
                  const activeProf = profiles.find((p) => p.id === launchProfileId)
                  const norm = activeProf?.norms[lang] ?? [75, 80]
                  const selectedVid = launchVoices[lang] ?? activeProf?.default[lang] ?? "v1"
                  const vEntry = voicesById[selectedVid]
                  const isMissing = vEntry?.status === "missing"

                  return (
                    <div
                      key={lang}
                      className={cn(
                        "flex items-center justify-between gap-2 rounded-[4px] border p-2.5 transition-colors",
                        checked
                          ? "border-line-strong bg-surface-2"
                          : "border-line bg-surface opacity-60",
                        isMissing && checked && "border-danger/50 bg-danger/5"
                      )}
                    >
                      <label className="flex cursor-pointer items-center gap-2.5">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setLaunchTargets((prev) => [...prev, lang])
                            } else {
                              setLaunchTargets((prev) => prev.filter((x) => x !== lang))
                            }
                          }}
                          className="size-4 accent-electric"
                        />
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-xs font-semibold">{lang}</span>
                            <span className="text-xs font-medium">{LANG_NAMES[lang]}</span>
                            <span className="font-mono text-[10px] text-muted-foreground">
                              {norm[0]}–{norm[1]}%
                            </span>
                          </div>
                          {isMissing && (
                            <div className="text-[10px] font-medium text-danger">
                              Голос недоступен в Fish — будет пропущен
                            </div>
                          )}
                        </div>
                      </label>

                      <div className="flex items-center gap-1">
                        <select
                          value={selectedVid}
                          onChange={(e) =>
                            setLaunchVoices((prev) => ({ ...prev, [lang]: e.target.value }))
                          }
                          className="h-7 max-w-[140px] rounded-[3px] border border-line-strong bg-surface px-1.5 text-xs text-foreground"
                        >
                          {voices.map((v) => (
                            <option key={v.id} value={v.id}>
                              {v.name} {v.status === "missing" ? "(пропал)" : ""}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          title="Прослушать образец голоса"
                          onClick={() =>
                            playAudioUrl(
                              vEntry?.sample_url ?? `/api/voice/voices/${selectedVid}/sample`,
                              `Образец ${vEntry?.name ?? selectedVid}`
                            )
                          }
                          className="flex size-7 items-center justify-center rounded-[3px] border border-line-strong bg-surface text-muted-foreground hover:text-foreground"
                        >
                          <Play className="size-3" />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>

            {/* Step 4: Models (Translation + 22.10 Fish S2.1 / Drama 3) */}
            <section className="rounded-[4px] border border-line bg-surface p-4">
              <h2 className="mb-3 text-base font-semibold">4. Модели перевода и озвучки</h2>

              <div className="mb-4">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">Модель перевода</span>
                  <label className="flex cursor-pointer items-center gap-1.5 text-xs text-foreground-2">
                    <input
                      type="checkbox"
                      checked={launchSplitByLang}
                      onChange={(e) => setLaunchSplitByLang(e.target.checked)}
                      className="size-3.5 accent-electric"
                    />
                    Отдельная задача на каждый язык (до 3 параллельно)
                  </label>
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {translationModels.map((tm) => (
                    <button
                      key={tm.id}
                      type="button"
                      onClick={() => setLaunchModel(tm.id)}
                      className={cn(
                        "flex flex-col items-start rounded-[4px] border p-3 text-left transition-colors",
                        launchModel === tm.id
                          ? "border-electric bg-electric-soft/40"
                          : "border-line bg-surface-2/60 hover:border-line-strong"
                      )}
                    >
                      <div className="flex w-full items-center justify-between gap-1">
                        <span className="text-sm font-medium">{tm.label}</span>
                        {tm.badge && (
                          <span className="rounded-[2px] bg-electric/20 px-1.5 py-0.5 text-[10px] font-medium text-electric-text">
                            {tm.badge}
                          </span>
                        )}
                      </div>
                      <span className="mt-1 text-xs text-muted-foreground">{tm.description}</span>
                      <span className="mt-2 font-mono text-[11px] text-faint">
                        ~{tm.est_minutes_per_lang} мин / язык
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* 22.10 Fish Voice Model Selector (S2.1 vs Drama 3) */}
              <div>
                <div className="mb-2 text-xs font-medium text-muted-foreground">
                  Модель озвучки Fish Audio (обновление 22.10)
                </div>
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  {voiceModels.map((vm) => (
                    <button
                      key={vm.id}
                      type="button"
                      onClick={() => setLaunchVoiceModel(vm.id)}
                      className={cn(
                        "flex flex-col items-start rounded-[4px] border p-3.5 text-left transition-colors",
                        launchVoiceModel === vm.id
                          ? "border-electric bg-electric-soft/40"
                          : "border-line bg-surface-2/60 hover:border-line-strong"
                      )}
                    >
                      <div className="flex w-full items-center justify-between">
                        <span className="text-sm font-semibold">{vm.label}</span>
                        <span className="rounded-[2px] border border-line-strong bg-surface px-1.5 py-0.5 font-mono text-[11px]">
                          {vm.has_free_tier
                            ? "Free + $15 / 1M байт"
                            : `$${vm.price_usd_per_million_bytes} / 1M байт (акция до 12.11)`}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{vm.description}</p>
                    </button>
                  ))}
                </div>

                {launchVoiceModel === "drama-3" && (
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-[3px] border border-electric/30 bg-electric-soft/30 px-3 py-2.5 text-xs">
                    <label className="flex cursor-pointer items-center gap-2 font-medium text-foreground">
                      <input
                        type="checkbox"
                        checked={launchCarryMood}
                        onChange={(e) => setLaunchCarryMood(e.target.checked)}
                        className="size-4 accent-electric"
                      />
                      <span>
                        Переносить настроение на соседние абзацы (<code className="font-mono">carry_mood</code>)
                      </span>
                    </label>
                    <span className="text-muted-foreground">
                      Абзацу без своего тега в начале подставится настроение предыдущего
                    </span>
                  </div>
                )}
              </div>
            </section>
          </div>

          {/* Right Column: Launch Summary & Server Queue (4 cols) */}
          <div className="space-y-5 lg:col-span-4">
            {/* Estimate & Submit Card */}
            <div className="rounded-[4px] border border-line bg-surface p-4">
              <h3 className="text-base font-semibold">Сводка запуска</h3>
              <div className="mt-3 space-y-2 border-y border-line py-3 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Сценарий:</span>
                  <span className="font-medium">{selectedScriptObj?.title ?? "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Объём:</span>
                  <span className="font-mono">
                    {selectedScriptObj?.paragraphs_total ?? 0} абз. · {selectedScriptObj?.words_total ?? 0} сл.
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Целевых языков:</span>
                  <span className="font-mono">{launchTargets.length} ({launchTargets.join(", ")})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Модель озвучки:</span>
                  <span className="font-mono font-medium text-electric-text">
                    {launchVoiceModel === "drama-3" ? "Fish Drama 3" : "Fish S2.1"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Расчётное время:</span>
                  <span className="font-mono font-medium">
                    ~{Math.max(1, Math.round((estimate?.duration_sec ?? 900) / 60))} мин
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Расход Fish Audio:</span>
                  <span className="font-mono font-semibold text-ok">
                    до ${estimate?.max_fish_cost_usd.toFixed(2) ?? "1.20"}
                  </span>
                </div>
              </div>

              <button
                type="button"
                disabled={submittingJob}
                onClick={handleCreateJob}
                className="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-[4px] bg-electric text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {submittingJob ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
                Запустить в очередь
              </button>
            </div>

            {/* Active Queue & History */}
            <div className="rounded-[4px] border border-line bg-surface p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold">Очередь и история задач ({jobs.length})</h3>
                {queueStatus && (
                  <span className="font-mono text-[11px] text-muted-foreground">
                    {queueStatus.running} в работе
                  </span>
                )}
              </div>

              <div className="space-y-2">
                {jobs.map((j) => (
                  <div
                    key={j.id}
                    className="flex items-center justify-between gap-2 rounded-[3px] border border-line bg-surface-2/60 p-2.5 text-xs"
                  >
                    <div
                      onClick={() => {
                        setSelectedJobId(j.id)
                        setScreen("workspace")
                      }}
                      className="min-w-0 flex-1 cursor-pointer"
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-[11px] text-muted-foreground">#{j.id}</span>
                        <span className="truncate font-medium text-foreground hover:underline">
                          {j.title}
                        </span>
                      </div>
                      <div className="mt-0.5 flex items-center gap-2 font-mono text-[10px] text-muted-foreground">
                        <span>{j.targets.length} яз.</span>
                        <span>·</span>
                        <span>{j.voice_model}</span>
                        <span>·</span>
                        <span
                          className={cn(
                            j.status === "done"
                              ? "text-ok"
                              : j.status === "running"
                                ? "text-electric-text"
                                : j.status === "failed"
                                  ? "text-danger"
                                  : "text-warn"
                          )}
                        >
                          {j.status === "done"
                            ? "Готово"
                            : j.status === "running"
                              ? "В работе"
                              : j.status === "queued"
                                ? "В очереди"
                                : j.status}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedJobId(j.id)
                          setScreen("workspace")
                        }}
                        className="rounded-[2px] border border-line-strong bg-surface px-2 py-1 text-[11px] hover:bg-elev"
                      >
                        Открыть
                      </button>
                      <button
                        type="button"
                        title="Удалить из очереди"
                        onClick={async () => {
                          try {
                            await voice.deleteJob(j.id)
                            setJobs((prev) => prev.filter((x) => x.id !== j.id))
                            toast.success(`Задача #${j.id} удалена`)
                          } catch (e) {
                            toast.error(e instanceof Error ? e.message : "Ошибка удаления")
                          }
                        }}
                        className="flex size-6 items-center justify-center rounded-[2px] text-muted-foreground hover:bg-danger/15 hover:text-danger"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* SCREEN 3: ПРОФИЛИ ОЗВУЧКИ И БИБЛИОТЕКА ГОЛОСОВ                       */}
      {/* =================================================================== */}
      {screen === "profiles" && (
        <div className="space-y-6">
          {/* Top Grid: Profile List (4 cols) + Active Profile Editor (8 cols) */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* Left Sidebar: Profiles */}
            <div className="space-y-3 lg:col-span-4">
              <div className="rounded-[4px] border border-line bg-surface p-4">
                <h2 className="mb-3 text-base font-semibold">Профили каналов ({profiles.length})</h2>
                <div className="space-y-2">
                  {profiles.map((p) => {
                    const active = p.id === editingProfileId
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setEditingProfileId(p.id)}
                        className={cn(
                          "flex w-full flex-col items-start rounded-[4px] border p-3 text-left transition-colors",
                          active
                            ? "border-electric bg-electric-soft/40"
                            : "border-line bg-surface-2/60 hover:border-line-strong"
                        )}
                      >
                        <div className="flex w-full items-center justify-between">
                          <span className="text-sm font-medium">{p.name}</span>
                          <span className="font-mono text-[11px] text-muted-foreground">{p.id}</span>
                        </div>
                        {p.channels.length > 0 && (
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {p.channels.map((ch) => (
                              <span
                                key={ch}
                                className="rounded-[2px] border border-line-strong bg-surface px-1.5 py-0.2 text-[10px] text-muted-foreground"
                              >
                                {ch}
                              </span>
                            ))}
                          </div>
                        )}
                      </button>
                    )
                  })}
                </div>

                {/* Create Profile */}
                <div className="mt-4 border-t border-line pt-3">
                  <div className="mb-1.5 text-xs font-medium text-muted-foreground">
                    Новый профиль (скопирует настройки текущего)
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newProfileName}
                      onChange={(e) => setNewProfileName(e.target.value)}
                      placeholder="Напр.: Голос 5 (History, Science)"
                      className="h-8 flex-1 rounded-[3px] border border-line-strong bg-surface-2 px-2.5 text-xs text-foreground placeholder:text-faint"
                    />
                    <button
                      type="button"
                      disabled={creatingProfile}
                      onClick={handleCreateProfile}
                      className="flex h-8 items-center gap-1 rounded-[3px] bg-electric px-3 text-xs font-medium text-white hover:opacity-90"
                    >
                      <Plus className="size-3.5" />
                      Создать
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Area: Selected Profile Editor */}
            <div className="rounded-[4px] border border-line bg-surface p-4 lg:col-span-8">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
                <div className="flex flex-wrap items-center gap-3">
                  <div>
                    <label className="block text-[11px] text-muted-foreground">Название профиля</label>
                    <input
                      type="text"
                      value={profileNameDraft}
                      onChange={(e) => setProfileNameDraft(e.target.value)}
                      className="mt-0.5 h-8 w-64 rounded-[3px] border border-line-strong bg-surface-2 px-2.5 text-sm font-medium text-foreground"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-muted-foreground">Каналы (через запятую)</label>
                    <input
                      type="text"
                      value={profileChannelsDraft}
                      onChange={(e) => setProfileChannelsDraft(e.target.value)}
                      className="mt-0.5 h-8 w-56 rounded-[3px] border border-line-strong bg-surface-2 px-2.5 text-xs text-foreground"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={checkingVoices}
                    onClick={() => void handleCheckVoices(editingProfileId)}
                    className="flex h-8 items-center gap-1.5 rounded-[3px] border border-line-strong bg-surface-2 px-2.5 text-xs font-medium text-foreground hover:bg-elev"
                  >
                    <RefreshCw className={cn("size-3.5", checkingVoices && "animate-spin")} />
                    Проверить голоса в Fish
                  </button>
                  <button
                    type="button"
                    disabled={savingProfile}
                    onClick={handleSaveProfile}
                    className="flex h-8 items-center gap-1.5 rounded-[3px] bg-electric px-3 text-xs font-medium text-white hover:opacity-90"
                  >
                    {savingProfile ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
                    Сохранить профиль
                  </button>
                </div>
              </div>

              {/* Table of 8 Languages in Profile */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-line text-[11px] text-muted-foreground">
                      <th className="pb-2 font-medium">Язык</th>
                      <th className="pb-2 font-medium">Голос по умолчанию</th>
                      <th className="pb-2 font-medium">Образец</th>
                      <th className="pb-2 font-medium">Статус в Fish</th>
                      <th className="pb-2 font-medium">Норма длины (мин–макс %)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {ALL_LANGS.map((lang) => {
                      const defVid = profileDefaultDraft[lang] ?? "v1"
                      const vObj = voicesById[defVid]
                      const norm = profileNormsDraft[lang] ?? [75, 80]
                      return (
                        <tr key={lang} className="hover:bg-surface-2/40">
                          <td className="py-2.5 pr-3">
                            <div className="flex items-center gap-2">
                              <span className="rounded-[2px] border border-line-strong bg-surface-2 px-1.5 py-0.5 font-mono font-semibold">
                                {lang}
                              </span>
                              <span className="font-medium">{LANG_NAMES[lang]}</span>
                            </div>
                          </td>
                          <td className="py-2.5 pr-2">
                            <select
                              value={defVid}
                              onChange={(e) => {
                                const nextVid = e.target.value
                                setProfileDefaultDraft((prev) => ({ ...prev, [lang]: nextVid }))
                                setProfileVoicesDraft((prev) => {
                                  const existing = prev[lang] ?? []
                                  return {
                                    ...prev,
                                    [lang]: [nextVid, ...existing.filter((x) => x !== nextVid)],
                                  }
                                })
                              }}
                              className="h-7 w-40 rounded-[3px] border border-line-strong bg-surface-2 px-1.5 text-xs text-foreground"
                            >
                              {voices.map((v) => (
                                <option key={v.id} value={v.id}>
                                  {v.name} ({v.id})
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="py-2.5 pr-3">
                            <button
                              type="button"
                              onClick={() =>
                                playAudioUrl(
                                  vObj?.sample_url ?? `/api/voice/voices/${defVid}/sample`,
                                  `${vObj?.name ?? defVid} (${lang})`
                                )
                              }
                              className="flex h-7 items-center gap-1 rounded-[3px] border border-line-strong bg-surface-2 px-2 text-xs hover:bg-elev"
                            >
                              <Play className="size-3 text-electric" />
                              Слушать
                            </button>
                          </td>
                          <td className="py-2.5 pr-3">
                            {vObj?.status === "missing" ? (
                              <span className="inline-flex items-center gap-1 rounded-[2px] bg-danger/20 px-1.5 py-0.5 text-[11px] font-medium text-danger">
                                <XCircle className="size-3" />
                                Пропал в Fish
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-[2px] bg-ok/15 px-1.5 py-0.5 text-[11px] font-medium text-ok">
                                <CheckCircle2 className="size-3" />
                                Доступен
                              </span>
                            )}
                          </td>
                          <td className="py-2.5">
                            {lang === "EN" ? (
                              <span className="font-mono text-muted-foreground">100% (эталон тайминга)</span>
                            ) : (
                              <div className="flex items-center gap-1.5 font-mono">
                                <input
                                  type="number"
                                  min={40}
                                  max={150}
                                  value={norm[0]}
                                  onChange={(e) => {
                                    const v = Number(e.target.value)
                                    setProfileNormsDraft((prev) => ({
                                      ...prev,
                                      [lang]: [v, prev[lang]?.[1] ?? v + 3],
                                    }))
                                  }}
                                  className="h-7 w-14 rounded-[3px] border border-line-strong bg-surface-2 px-1.5 text-center text-xs"
                                />
                                <span>–</span>
                                <input
                                  type="number"
                                  min={40}
                                  max={150}
                                  value={norm[1]}
                                  onChange={(e) => {
                                    const v = Number(e.target.value)
                                    setProfileNormsDraft((prev) => ({
                                      ...prev,
                                      [lang]: [prev[lang]?.[0] ?? v - 3, v],
                                    }))
                                  }}
                                  className="h-7 w-14 rounded-[3px] border border-line-strong bg-surface-2 px-1.5 text-center text-xs"
                                />
                                <span className="text-muted-foreground">%</span>
                              </div>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* 22.10 Fish Audio Voices Library */}
          <div className="rounded-[4px] border border-line bg-surface p-4">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold">Библиотека голосов Fish Audio ({voices.length})</h2>
                <p className="text-xs text-muted-foreground">
                  Добавляйте голоса по ссылке на Fish Audio. Поле «Название» обязательно — это внутреннее имя голоса в студии.
                </p>
              </div>
              <button
                type="button"
                disabled={checkingVoices}
                onClick={() => void handleCheckVoices()}
                className="flex h-8 items-center gap-1.5 rounded-[3px] border border-line-strong bg-surface-2 px-3 text-xs font-medium text-foreground hover:bg-elev"
              >
                <RefreshCw className={cn("size-3.5", checkingVoices && "animate-spin")} />
                Проверить все голоса в Fish ({voices.length})
              </button>
            </div>

            {/* 22.10 Add Voice Form */}
            <div className="mb-4 flex flex-wrap items-end gap-2.5 rounded-[4px] border border-line bg-surface-2/60 p-3">
              <div className="min-w-[220px] flex-1">
                <label className="block text-[11px] font-medium text-foreground-2">
                  Внутреннее название голоса <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  value={newVoiceName}
                  onChange={(e) => setNewVoiceName(e.target.value)}
                  placeholder="Напр.: Голос 1 (Brian Documentary)"
                  className="mt-1 h-8 w-full rounded-[3px] border border-line-strong bg-surface px-2.5 text-xs text-foreground placeholder:text-faint"
                />
              </div>
              <div className="min-w-[260px] flex-1">
                <label className="block text-[11px] font-medium text-foreground-2">
                  Ссылка Fish Audio или 32-символьный ID <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  value={newVoiceUrl}
                  onChange={(e) => setNewVoiceUrl(e.target.value)}
                  placeholder="https://fish.audio/m/98762dc8579647fc... или код"
                  className="mt-1 h-8 w-full rounded-[3px] border border-line-strong bg-surface px-2.5 font-mono text-xs text-foreground placeholder:text-faint"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-foreground-2">Язык по умолчанию</label>
                <select
                  value={newVoiceLangs[0] ?? "EN"}
                  onChange={(e) => setNewVoiceLangs([e.target.value])}
                  className="mt-1 h-8 rounded-[3px] border border-line-strong bg-surface px-2.5 text-xs text-foreground"
                >
                  {ALL_LANGS.map((l) => (
                    <option key={l} value={l}>
                      {l} ({LANG_NAMES[l]})
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                disabled={addingVoice}
                onClick={handleAddVoice}
                className="flex h-8 items-center gap-1.5 rounded-[3px] bg-electric px-3.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
              >
                {addingVoice ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
                Проверить и добавить
              </button>
            </div>

            {/* Voices Grid */}
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {voices.map((v) => (
                <div
                  key={v.id}
                  className={cn(
                    "flex items-center justify-between gap-2 rounded-[4px] border p-3",
                    v.status === "missing"
                      ? "border-danger/50 bg-danger/5"
                      : "border-line bg-surface-2/40"
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-semibold text-electric-text">{v.id}</span>
                      <span className="truncate text-sm font-medium">{v.name}</span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
                      <span>{v.fish_id.slice(0, 10)}…</span>
                      <span>·</span>
                      <span>{v.langs.join(", ")}</span>
                      {v.status === "missing" ? (
                        <span className="text-danger">· Пропал в Fish</span>
                      ) : (
                        <span className="text-ok">· OK</span>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => playAudioUrl(v.sample_url, `Образец ${v.name}`)}
                    className="flex h-8 items-center gap-1 rounded-[3px] border border-line-strong bg-surface px-2.5 text-xs hover:bg-elev"
                  >
                    <Play className="size-3 text-electric" />
                    Образец
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
