"use client"

import { useEffect, useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  AlertTriangle,
  Camera,
  Check,
  Copy,
  ExternalLink,
  Film,
  Loader2,
  Plus,
  RefreshCw,
  RotateCcw,
  Settings2,
  Square,
  Trash2,
  Upload,
} from "lucide-react"
import { toast } from "sonner"

import { BTN_PRIMARY, BTN_SMALL, Card, INPUT, Label, Pick, Seg } from "@/components/script/ui"
import { rkeys, useReelTracks } from "@/components/reels/queries"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import {
  ytUpload,
  type Reel,
  type YtChannel,
  type YtChannelPatch,
  type YtMonetization,
  type YtOctoProfile,
  type YtUploadJob,
} from "@/lib/api"
import { langCode } from "@/lib/langs"
import { useHydrated } from "@/lib/queries"
import { REFETCH_MS, throttler } from "@/lib/throttle"
import { cn } from "@/lib/utils"

const ytkeys = {
  all: ["yt-upload"] as const,
  health: ["yt-upload", "health"] as const,
  channels: ["yt-upload", "channels"] as const,
  uploads: (reelId: string) => ["yt-upload", "uploads", reelId] as const,
}

const copy = (text: string) =>
  navigator.clipboard.writeText(text).then(
    () => toast.success("Скопировано"),
    () => toast.error("Не удалось скопировать"),
  )

function formatDateRu(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  return m ? `${m[3]}.${m[2]}` : iso
}

function uploadStatusLabel(u: YtUploadJob): string {
  if (u.status === "queued") return "в очереди"
  if (u.status === "done") return "запланировано"
  if (u.status === "stopped") return "остановлено"
  if (u.status === "error") return "ошибка"

  const submitted = u.languages.filter((l) => l.state === "processing" || l.state === "published").length
  switch (u.stage) {
    case "prepare":
      return "подготовка файлов"
    case "upload_mp4":
      return "открытие YouTube Studio"
    case "wizard":
      return "настройка и монетизация"
    case "wait_processing":
      return `загрузка видео · ${u.upload_pct}%`
    case "languages":
      return `загрузка языков · ${submitted} из ${u.counts.total}`
    case "hold_languages":
      return `догрузка аудиодорожек · ${u.counts.published} из ${u.counts.total}`
    default:
      return "выполняется"
  }
}

function uploadProgressPct(u: YtUploadJob): number {
  if (u.status === "done") return 100
  if (u.stage === "prepare" || u.stage === "upload_mp4") return 5
  if (u.stage === "wizard") return 15
  if (u.stage === "wait_processing") return 15 + Math.round((u.upload_pct / 100) * 45)
  if (u.stage === "languages") {
    const total = Math.max(1, u.counts.total)
    const done = u.languages.filter((l) => l.state === "processing" || l.state === "published" || l.state === "error").length
    return 60 + Math.round((done / total) * 30)
  }
  if (u.stage === "hold_languages") {
    const total = Math.max(1, u.counts.total)
    return 90 + Math.round((u.counts.published / total) * 10)
  }
  return u.upload_pct || 10
}

function langChipClass(state: string): string {
  switch (state) {
    case "published":
      return "border-ok/40 bg-ok/15 text-ok"
    case "uploading":
    case "processing":
      return "border-pick/40 bg-pick-soft text-pick-text"
    case "error":
      return "border-danger/40 bg-danger/15 text-danger"
    default:
      return "border-line bg-surface text-faint"
  }
}

function langStateHint(state: string, error: string | null): string {
  if (error) return `${state}: ${error}`
  switch (state) {
    case "published":
      return "Опубликовано"
    case "processing":
      return "Загружено в YouTube Studio, идёт обработка"
    case "uploading":
      return "Загружается сейчас"
    case "error":
      return "Ошибка загрузки"
    default:
      return "Ожидает очереди"
  }
}

function useYoutubeEvents(reelId: string, enabled: boolean) {
  const qc = useQueryClient()
  useEffect(() => {
    if (!enabled) return
    const es = new EventSource(ytUpload.eventsUrl(), { withCredentials: true })
    const { soon, clear } = throttler()
    es.addEventListener("upload.changed", (ev) => {
      try {
        const d = JSON.parse((ev as MessageEvent).data || "{}")
        if (!d.reel_id || d.reel_id === reelId) {
          soon(`yt-uploads:${reelId}`, REFETCH_MS.item, () => {
            void qc.invalidateQueries({ queryKey: ytkeys.uploads(reelId) })
          })
        }
      } catch {
        soon(`yt-uploads:${reelId}`, REFETCH_MS.item, () => {
          void qc.invalidateQueries({ queryKey: ytkeys.uploads(reelId) })
        })
      }
    })
    es.addEventListener("channels.changed", () => {
      soon("yt-channels", REFETCH_MS.small, () => {
        void qc.invalidateQueries({ queryKey: ytkeys.channels })
      })
    })
    es.addEventListener("worker.changed", () => {
      soon("yt-health", REFETCH_MS.small, () => {
        void qc.invalidateQueries({ queryKey: ytkeys.health })
      })
    })
    return () => {
      es.close()
      clear()
    }
  }, [qc, reelId, enabled])
}

/** YouTube Studio automated upload & 17-language audio dubbing via Octo Browser. */
export function YoutubeUploadCard({ reel: r }: { reel: Reel }) {
  const qc = useQueryClient()
  const hydrated = useHydrated()
  const isShort = r.settings.format === "9:16"
  const canShow = r.status === "done" || !!r.result?.mp4

  const healthQ = useQuery({
    queryKey: ytkeys.health,
    queryFn: ytUpload.health,
    enabled: hydrated && canShow,
    retry: false,
    refetchInterval: 30_000,
  })
  const online = !!healthQ.data
  useYoutubeEvents(r.id, hydrated && canShow && online)

  const channelsQ = useQuery({
    queryKey: ytkeys.channels,
    queryFn: ytUpload.channels,
    enabled: hydrated && canShow && online,
    staleTime: 30_000,
  })
  const uploadsQ = useQuery({
    queryKey: ytkeys.uploads(r.id),
    queryFn: () => ytUpload.listForReel(r.id),
    enabled: hydrated && canShow && online,
    refetchInterval: 20_000,
  })
  const tracksQ = useReelTracks(r.id, hydrated && canShow)

  const [channelsOpen, setChannelsOpen] = useState(false)
  const [channelIdDraft, setChannelIdDraft] = useState<string>("")
  const [scheduleDate, setScheduleDate] = useState<string>("")
  const [timeDraft, setTimeDraft] = useState<string | null>(null)
  const [playlistDraft, setPlaylistDraft] = useState<string | null>(null)
  const [monetizationDraft, setMonetizationDraft] = useState<YtMonetization | null>(null)
  const [endScreenDraft, setEndScreenDraft] = useState<boolean | null>(null)

  useEffect(() => {
    const timer = setTimeout(() => {
      setScheduleDate((prev) => {
        if (prev) return prev
        const tomorrow = new Date(Date.now() + 86_400_000)
        const yyyy = tomorrow.getFullYear()
        const mm = String(tomorrow.getMonth() + 1).padStart(2, "0")
        const dd = String(tomorrow.getDate()).padStart(2, "0")
        return `${yyyy}-${mm}-${dd}`
      })
    }, 0)
    return () => clearTimeout(timer)
  }, [])

  const channels = useMemo(
    () => (channelsQ.data ?? []).filter((ch) => ch.enabled),
    [channelsQ.data],
  )
  const effectiveChannelId =
    channelIdDraft && channels.some((c) => c.id === channelIdDraft)
      ? channelIdDraft
      : (channels[0]?.id ?? "")
  const selectedChannel = channels.find((c) => c.id === effectiveChannelId) ?? null

  const effectiveTime = timeDraft ?? selectedChannel?.publish_time ?? "19:00"
  const effectivePlaylist = playlistDraft ?? selectedChannel?.playlist ?? ""
  const effectiveMonetization = monetizationDraft ?? selectedChannel?.monetization ?? "auto"
  const effectiveEndScreen = isShort ? false : (endScreenDraft ?? selectedChannel?.end_screen ?? true)

  const startUpload = useMutation({
    mutationFn: () =>
      ytUpload.create({
        reel_id: r.id,
        channel_id: effectiveChannelId,
        schedule_date: scheduleDate,
        schedule_time: effectiveTime,
        playlist: effectivePlaylist,
        monetization: effectiveMonetization,
        end_screen: effectiveEndScreen,
      }),
    onSuccess: () => {
      toast.success("Выкладка добавлена в очередь")
      void qc.invalidateQueries({ queryKey: ytkeys.uploads(r.id) })
      void qc.invalidateQueries({ queryKey: ytkeys.health })
    },
    onError: (e) => toast.error(e.message),
  })

  const actUpload = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: "stop" | "retry" | "remove" }) => {
      if (action === "stop") return ytUpload.stop(id)
      if (action === "retry") return ytUpload.retry(id)
      return ytUpload.remove(id)
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ytkeys.uploads(r.id) })
      void qc.invalidateQueries({ queryKey: rkeys.reel(r.id) })
    },
    onError: (e) => toast.error(e.message),
  })

  if (!canShow) return null

  const mp4Ready = !!r.result?.mp4
  const tracksState = r.tracks?.state ?? tracksQ.data?.status.state ?? "none"
  const tracksReady = tracksState === "done"
  const metaReady = r.youtube?.state === "done"
  const bundleReady = mp4Ready && tracksReady && metaReady
  const canLaunch = online && !!selectedChannel && !!scheduleDate && bundleReady && !startUpload.isPending

  const health = healthQ.data
  const warnNote =
    health && !health.octo_online
      ? "Octo не запущен"
      : health && !health.worker_online
        ? "Исполнитель не запущен"
        : null

  return (
    <>
      <Card
        title="Выкладка на YouTube"
        aside={
          <div className="flex flex-wrap items-center gap-2">
            {warnNote && (
              <span className="flex items-center gap-1.5 rounded-[3px] border border-warn/40 bg-warn-soft px-2 py-0.5 text-xs text-warn">
                <span className="size-1.5 rounded-full bg-warn" />
                {warnNote}
              </span>
            )}
            {online && (
              <button type="button" onClick={() => setChannelsOpen(true)} className={BTN_SMALL}>
                <Settings2 className="size-3.5" />
                Каналы
                {channels.length > 0 && <span className="font-mono text-[11px] text-faint">({channels.length})</span>}
              </button>
            )}
          </div>
        }
      >
        {!hydrated || healthQ.isLoading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="size-4 animate-spin text-faint" />
          </div>
        ) : healthQ.error ? (
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
            <span>Модуль выкладки (/api/youtube) недоступен</span>
            <button type="button" onClick={() => void healthQ.refetch()} className={BTN_SMALL}>
              <RefreshCw className="size-3.5" />
              Повторить
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <ReadyPill label="MP4" ok={mp4Ready} />
              <ReadyPill label="Озвучки" ok={tracksReady} />
              <ReadyPill label="Описания" ok={metaReady} />
              {!bundleReady && (
                <span className="text-muted-foreground">
                  Для запуска должны быть готовы ролик, дорожки и переводы.
                </span>
              )}
            </div>

            {channels.length === 0 ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-[3px] border border-line bg-background px-3.5 py-3 text-sm">
                <span className="text-muted-foreground">Нет привязанных каналов из Octo Browser.</span>
                <button type="button" onClick={() => setChannelsOpen(true)} className={BTN_PRIMARY}>
                  <Plus className="size-3.5" />
                  Добавить канал из Octo
                </button>
              </div>
            ) : (
              <div className="space-y-3 rounded-[3px] border border-line bg-background p-3.5">
                <div className="grid gap-3 md:grid-cols-[minmax(0,1.4fr)_150px_115px]">
                  <div>
                    <Label aside={selectedChannel?.proxy_label && <span className="font-mono text-[11px] text-faint">{selectedChannel.proxy_label}</span>}>
                      Канал
                    </Label>
                    <Pick
                      value={effectiveChannelId}
                      onChange={(id) => {
                        setChannelIdDraft(id)
                        setTimeDraft(null)
                        setPlaylistDraft(null)
                        setMonetizationDraft(null)
                        setEndScreenDraft(null)
                      }}
                      options={channels.map((c) => ({
                        value: c.id,
                        label: c.title,
                        hint: c.metered_proxy ? `${c.proxy_label} · трафик` : c.proxy_label || c.octo_title,
                      }))}
                    />
                  </div>
                  <div>
                    <Label>Дата</Label>
                    <input
                      type="date"
                      value={scheduleDate}
                      onChange={(e) => setScheduleDate(e.target.value)}
                      className={cn(INPUT, "font-mono")}
                    />
                  </div>
                  <div>
                    <Label>Время</Label>
                    <input
                      type="time"
                      value={effectiveTime}
                      onChange={(e) => setTimeDraft(e.target.value)}
                      className={cn(INPUT, "font-mono")}
                    />
                  </div>
                </div>

                {selectedChannel?.metered_proxy && (
                  <div className="flex items-start gap-2 rounded-[3px] border border-warn/40 bg-warn-soft px-3 py-2 text-xs text-warn">
                    <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                    <span>
                      На профиле стоит резидентный прокси с оплатой за ГБ ({selectedChannel.proxy_label}) — одна выкладка расходует ~3 ГБ трафика.
                    </span>
                  </div>
                )}

                <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_270px_auto] md:items-end">
                  <div>
                    <Label>Плейлист (опционально)</Label>
                    <input
                      value={effectivePlaylist}
                      onChange={(e) => setPlaylistDraft(e.target.value)}
                      placeholder="Название плейлиста в Studio"
                      className={INPUT}
                    />
                  </div>
                  <div>
                    <Label>Монетизация</Label>
                    <Seg
                      value={effectiveMonetization}
                      onChange={(v) => setMonetizationDraft(v as YtMonetization)}
                      options={[
                        ["auto", "Авто", "Включит монетизацию, если у канала она подключена"],
                        ["on", "Монетный"],
                        ["off", "Немонетный"],
                      ]}
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {!isShort && (
                      <button
                        type="button"
                        onClick={() => setEndScreenDraft(!effectiveEndScreen)}
                        title="Добавить стандартную конечную заставку на шаге Video elements"
                        className={cn(
                          "flex h-10 items-center gap-2 rounded-[3px] border px-3 text-sm transition-colors",
                          effectiveEndScreen
                            ? "border-pick/40 bg-pick-soft text-pick-text"
                            : "border-line-strong bg-surface text-muted-foreground hover:text-foreground",
                        )}
                      >
                        <Film className="size-3.5" />
                        Заставка
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={!canLaunch}
                      onClick={() => startUpload.mutate()}
                      className={cn(BTN_PRIMARY, "whitespace-nowrap")}
                      title={!bundleReady ? "Дождитесь готовности MP4, озвучек и описаний" : undefined}
                    >
                      {startUpload.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
                      Выложить на YouTube
                    </button>
                  </div>
                </div>
              </div>
            )}

            {(uploadsQ.data ?? []).length > 0 && (
              <div className="space-y-2.5">
                {(uploadsQ.data ?? []).map((u) => {
                  const isRunning = u.status === "running"
                  const isActive = isRunning || u.status === "queued"
                  const pct = uploadProgressPct(u)
                  return (
                    <div key={u.id} className="space-y-3 rounded-[3px] border border-line bg-background p-3.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                          <span className="text-sm font-medium text-foreground">{u.channel_title}</span>
                          <span
                            className={cn(
                              "rounded-[3px] px-2 py-0.5 text-xs font-medium",
                              u.status === "done"
                                ? "bg-ok/15 text-ok"
                                : u.status === "error"
                                  ? "bg-danger/15 text-danger"
                                  : isRunning
                                    ? "bg-pick-soft text-pick-text"
                                    : "bg-elev text-muted-foreground",
                            )}
                          >
                            {uploadStatusLabel(u)}
                          </span>
                          <span className="font-mono text-xs text-faint">
                            {formatDateRu(u.schedule_date)} · {u.schedule_time}
                          </span>
                          {u.eta_text && isRunning && (
                            <span className="font-mono text-[11px] text-faint">({u.eta_text})</span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5">
                          {u.video_url && (
                            <div className="flex items-center gap-1 rounded-[3px] border border-line bg-surface px-2 py-1 font-mono text-xs">
                              <a
                                href={u.video_url}
                                target="_blank"
                                rel="noreferrer"
                                className="flex items-center gap-1 text-pick-text hover:underline"
                              >
                                {u.video_id ?? u.video_url}
                                <ExternalLink className="size-3" />
                              </a>
                              <button
                                type="button"
                                onClick={() => void copy(u.video_url!)}
                                title="Скопировать ссылку"
                                className="ml-1 text-faint hover:text-foreground"
                              >
                                <Copy className="size-3" />
                              </button>
                            </div>
                          )}

                          {u.screenshot && (
                            <a
                              href={ytUpload.screenshotUrl(u.id)}
                              target="_blank"
                              rel="noreferrer"
                              title="Открыть финальный скриншот YouTube Studio"
                              className={BTN_SMALL}
                            >
                              <Camera className="size-3.5" />
                            </a>
                          )}

                          {isActive ? (
                            <button
                              type="button"
                              disabled={actUpload.isPending}
                              onClick={() => actUpload.mutate({ id: u.id, action: "stop" })}
                              className="flex h-8 items-center gap-1.5 rounded-[3px] border border-danger/40 bg-danger/10 px-2.5 text-xs font-medium text-danger hover:bg-danger/20"
                            >
                              <Square className="size-3" />
                              Стоп
                            </button>
                          ) : (u.status === "error" || u.status === "stopped") && (
                            <button
                              type="button"
                              disabled={actUpload.isPending}
                              onClick={() => actUpload.mutate({ id: u.id, action: "retry" })}
                              className={BTN_SMALL}
                              title={u.video_id ? "Продолжит с этапа языков, не перезаливая MP4" : "Запустить заново"}
                            >
                              <RotateCcw className="size-3.5" />
                              Повторить
                            </button>
                          )}

                          {!isRunning && (
                            <button
                              type="button"
                              disabled={actUpload.isPending}
                              onClick={() => actUpload.mutate({ id: u.id, action: "remove" })}
                              title="Удалить запись выкладки"
                              className="grid size-8 place-items-center rounded-[3px] border border-line-strong text-faint hover:border-danger/40 hover:bg-danger/10 hover:text-danger"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      {isRunning && (
                        <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
                          <div
                            className="bar-running h-full rounded-full transition-[width] duration-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      )}

                      {u.error && (
                        <div className="flex items-start gap-2 text-xs text-danger">
                          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                          <span>{u.error}</span>
                        </div>
                      )}

                      {u.languages.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {u.languages.map((item) => (
                            <span
                              key={item.lang}
                              title={`${item.studio_name}: ${langStateHint(item.state, item.error)}`}
                              className={cn(
                                "flex h-6 items-center gap-1 rounded-[3px] border px-2 font-mono text-[11px]",
                                langChipClass(item.state),
                              )}
                            >
                              {item.state === "uploading" && <Loader2 className="size-2.5 animate-spin" />}
                              {item.state === "published" && <Check className="size-2.5" />}
                              {langCode(item.lang)}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </Card>

      <ChannelsDialog open={channelsOpen} onClose={() => setChannelsOpen(false)} />
    </>
  )
}

function ReadyPill({ label, ok }: { label: string; ok: boolean }) {
  return (
    <span
      className={cn(
        "flex h-6 items-center gap-1.5 rounded-[3px] border px-2 font-mono text-[11px]",
        ok ? "border-ok/40 bg-ok/15 text-ok" : "border-line-strong text-faint",
      )}
    >
      <span className={cn("size-1.5 rounded-full", ok ? "bg-ok" : "bg-faint")} />
      {label}
    </span>
  )
}

function ChannelsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient()
  const [search, setSearch] = useState("")
  const [octoQueried, setOctoQueried] = useState(false)

  const channelsQ = useQuery({
    queryKey: ytkeys.channels,
    queryFn: ytUpload.channels,
    enabled: open,
  })
  const octoQ = useQuery({
    queryKey: [...ytkeys.all, "octo", search],
    queryFn: () => ytUpload.octoProfiles(search),
    enabled: open && octoQueried,
    retry: false,
  })

  const addMut = useMutation({
    mutationFn: (p: YtOctoProfile) =>
      ytUpload.addChannel({
        title: p.title,
        octo_uuid: p.uuid,
        octo_title: p.title,
        proxy_label: p.proxy_label,
        metered_proxy: p.metered_proxy,
      }),
    onSuccess: (ch) => {
      toast.success(`Канал «${ch.title}» добавлен`)
      void qc.invalidateQueries({ queryKey: ytkeys.channels })
      void octoQ.refetch()
    },
    onError: (e) => toast.error(e.message),
  })

  const patchMut = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: YtChannelPatch }) => ytUpload.updateChannel(id, patch),
    onSuccess: () => {
      toast.success("Настройки канала сохранены")
      void qc.invalidateQueries({ queryKey: ytkeys.channels })
    },
    onError: (e) => toast.error(e.message),
  })

  const delMut = useMutation({
    mutationFn: (id: string) => ytUpload.removeChannel(id),
    onSuccess: () => {
      toast.success("Канал удалён")
      void qc.invalidateQueries({ queryKey: ytkeys.channels })
      if (octoQueried) void octoQ.refetch()
    },
    onError: (e) => toast.error(e.message),
  })

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] gap-0 overflow-hidden rounded-[4px] border border-line-strong bg-surface p-0 ring-0 sm:max-w-2xl">
        <div className="border-b border-line px-5 py-3.5">
          <DialogTitle className="text-base font-semibold">Каналы YouTube и профили Octo Browser</DialogTitle>
        </div>

        <div className="max-h-[72vh] space-y-5 overflow-y-auto p-5">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Фильтр по названию профиля в Octo"
                className={cn(INPUT, "min-w-0 flex-1")}
              />
              <button
                type="button"
                disabled={octoQ.isFetching}
                onClick={() => {
                  if (octoQueried) void octoQ.refetch()
                  else setOctoQueried(true)
                }}
                className={BTN_PRIMARY}
              >
                {octoQ.isFetching ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
                Загрузить профили из Octo
              </button>
            </div>

            {octoQ.error && (
              <p className="text-xs text-danger">{octoQ.error.message}</p>
            )}

            {octoQ.data && (
              <div className="max-h-56 overflow-y-auto rounded-[3px] border border-line bg-background">
                {octoQ.data.length === 0 ? (
                  <p className="p-3 text-xs text-faint">Подходящих профилей не найдено.</p>
                ) : (
                  octoQ.data.map((p) => (
                    <div
                      key={p.uuid}
                      className="flex items-center justify-between gap-3 border-b border-line px-3 py-2 text-sm last:border-b-0"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium text-foreground">{p.title}</div>
                        <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] text-faint">
                          <span>{p.uuid.slice(0, 8)}</span>
                          {p.proxy_label && <span>{p.proxy_label}</span>}
                          {p.metered_proxy && <span className="text-warn">трафик за ГБ</span>}
                        </div>
                      </div>
                      {p.already_added ? (
                        <span className="rounded-[3px] bg-elev px-2 py-1 text-xs text-faint">Добавлен</span>
                      ) : (
                        <button
                          type="button"
                          disabled={addMut.isPending}
                          onClick={() => addMut.mutate(p)}
                          className={BTN_SMALL}
                        >
                          <Plus className="size-3.5" />
                          Добавить
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Настроенные каналы ({channelsQ.data?.length ?? 0})</Label>
            {channelsQ.isLoading ? (
              <div className="flex justify-center py-4">
                <Loader2 className="size-4 animate-spin text-faint" />
              </div>
            ) : (channelsQ.data ?? []).length === 0 ? (
              <p className="text-xs text-faint">Пока ни одного канала не добавлено.</p>
            ) : (
              <div className="space-y-2">
                {(channelsQ.data ?? []).map((ch) => (
                  <ChannelEditRow
                    key={ch.id}
                    channel={ch}
                    busy={patchMut.isPending || delMut.isPending}
                    onSave={(patch) => patchMut.mutate({ id: ch.id, patch })}
                    onDelete={() => delMut.mutate(ch.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function ChannelEditRow({
  channel,
  busy,
  onSave,
  onDelete,
}: {
  channel: YtChannel
  busy: boolean
  onSave: (patch: YtChannelPatch) => void
  onDelete: () => void
}) {
  const [title, setTitle] = useState(channel.title)
  const [playlist, setPlaylist] = useState(channel.playlist)
  const [publishTime, setPublishTime] = useState(channel.publish_time)
  const [monetization, setMonetization] = useState<YtMonetization>(channel.monetization)

  const dirty =
    title.trim() !== channel.title ||
    playlist.trim() !== channel.playlist ||
    publishTime !== channel.publish_time ||
    monetization !== channel.monetization

  return (
    <div className="space-y-2 rounded-[3px] border border-line bg-background p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-mono text-[11px] text-faint">
          Octo: {channel.octo_title || channel.octo_uuid}
          {channel.proxy_label ? ` · ${channel.proxy_label}` : ""}
        </span>
        <div className="flex items-center gap-1.5">
          {dirty && (
            <button
              type="button"
              disabled={busy || !title.trim()}
              onClick={() => onSave({ title: title.trim(), playlist: playlist.trim(), publish_time: publishTime, monetization })}
              className={BTN_SMALL}
            >
              Сохранить
            </button>
          )}
          <button
            type="button"
            disabled={busy}
            onClick={onDelete}
            title="Удалить канал"
            className="grid size-7 place-items-center rounded-[3px] border border-line-strong text-faint hover:border-danger/40 hover:bg-danger/10 hover:text-danger"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_96px_170px]">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Название канала" className={INPUT} />
        <input value={playlist} onChange={(e) => setPlaylist(e.target.value)} placeholder="Плейлист по умолч." className={INPUT} />
        <input type="time" value={publishTime} onChange={(e) => setPublishTime(e.target.value)} className={cn(INPUT, "font-mono")} />
        <Seg
          value={monetization}
          onChange={(v) => setMonetization(v as YtMonetization)}
          options={[
            ["auto", "Авто"],
            ["on", "Монет."],
            ["off", "Нет"],
          ]}
        />
      </div>
    </div>
  )
}
