"use client"

import { useEffect, useRef, useState } from "react"
import { Download, Film, FolderArchive, Volume2 } from "lucide-react"

import { CAT_BG, CAT_LABEL, CATEGORIES, MixBar, clock } from "@/components/reels/parts"
import { BTN_PRIMARY, BTN_SECONDARY, Card } from "@/components/script/ui"
import { reels, type Reel, type ReelShares } from "@/lib/api"
import { bytes } from "@/lib/format"
import { cn } from "@/lib/utils"

const videoAudioGraph = new WeakMap<HTMLMediaElement, { ctx: AudioContext; gain: GainNode }>()

function setEmbeddedAudioEnabled(video: HTMLVideoElement, enabled: boolean) {
  const existing = videoAudioGraph.get(video)
  if (enabled) {
    if (existing) {
      existing.gain.gain.value = 1
      if (existing.ctx.state === "suspended") void existing.ctx.resume().catch(() => {})
    }
    return
  }
  try {
    let graph = existing
    if (!graph) {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!Ctx) {
        video.muted = true
        return
      }
      const ctx = new Ctx()
      const src = ctx.createMediaElementSource(video)
      const gain = ctx.createGain()
      src.connect(gain)
      gain.connect(ctx.destination)
      graph = { ctx, gain }
      videoAudioGraph.set(video, graph)
    }
    graph.gain.gain.value = 0
    if (graph.ctx.state === "suspended") void graph.ctx.resume().catch(() => {})
  } catch {
    video.muted = !enabled
  }
}

/** Orders to the modules: per planned category — found in it, moved to the second round or AI, failed; then the shares
 *  by the storyboard against the shares in the reel (newer brains send `mix`). */
export function MaterialsCard({ reel: r }: { reel: Reel }) {
  const m = r.materials
  if (!m || !m.total) return null
  const rows = CATEGORIES.filter((c) => m.by_category[c]?.total)
  const plan = r.summary?.mix.actual
  return (
    <Card title="Материалы" aside={<span className="font-mono text-[11px] text-faint">{m.done} из {m.total} кадров</span>}>
      <div className="space-y-2.5">
        {rows.map((c) => {
          const x = m.by_category[c]!
          return (
            <div key={c} className="grid grid-cols-[150px_1fr_auto] items-center gap-3 text-sm max-sm:grid-cols-[110px_1fr]">
              <span className="truncate text-foreground-2">{CAT_LABEL[c]}</span>
              <div className="h-1.5 overflow-hidden rounded-full bg-elev">
                <div className={cn("h-full", CAT_BG[c])} style={{ width: `${(100 * (x.own ?? x.done)) / x.total}%` }} />
              </div>
              <span className="font-mono text-[11px] text-faint max-sm:col-span-2">
                {x.own ?? x.done}/{x.total}
                {x.moved
                  ? Object.entries(x.moved)
                      .map(([k, n]) => ` · ${MOVED_TO[k] ?? k} ${n}`)
                      .join("")
                  : x.fallback
                    ? ` · в ИИ ${x.fallback}`
                    : ""}
                {x.failed ? ` · не вышло ${x.failed}` : ""}
              </span>
            </div>
          )
        })}
      </div>
      {plan && m.mix && Object.keys(m.mix).length > 0 && (
        <div className="mt-4 space-y-1.5 border-t border-line pt-3">
          <MixRow label="по раскадровке" shares={plan} />
          <MixRow label="в ролике" shares={m.mix} />
        </div>
      )}
    </Card>
  )
}

/** Where shots that were not found went: the next category of the second round or AI. */
const MOVED_TO: Record<string, string> = { ai: "в ИИ", video: "в видео", history: "в историю", graphics: "в графику" }

function MixRow({ label, shares }: { label: string; shares: Partial<ReelShares> }) {
  return (
    <div className="grid grid-cols-[150px_1fr_auto] items-center gap-3 max-sm:grid-cols-[110px_1fr]">
      <span className="font-mono text-[11px] text-faint">{label}</span>
      <MixBar shares={shares} />
      <span className="font-mono text-[11px] text-faint max-sm:col-span-2">
        {CATEGORIES.filter((c) => shares[c])
          .map((c) => Math.round(shares[c] ?? 0))
          .join(" · ")}
      </span>
    </div>
  )
}

/** The assembled reel: player, mp4 and the montage project for DaVinci. */
export function ResultCard({ reel: r }: { reel: Reel }) {
  const res = r.result
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const langs = res?.languages?.length ? res.languages.map((l) => l.toUpperCase()) : []
  const baseLang = (r.tracks?.base || r.source.language || langs[0] || "EN").toUpperCase()
  const [selectedLang, setSelectedLang] = useState<string>("")
  const activeLang = selectedLang && langs.includes(selectedLang) ? selectedLang : baseLang
  const useAltAudio = langs.length > 0 && activeLang !== baseLang

  useEffect(() => {
    const video = videoRef.current
    const audio = audioRef.current
    if (!video) return
    setEmbeddedAudioEnabled(video, !useAltAudio)
    if (!audio) return
    if (!useAltAudio) {
      audio.pause()
      return
    }
    audio.volume = video.volume
    audio.muted = video.muted
    audio.playbackRate = video.playbackRate
    const syncAndPlay = () => {
      if (Math.abs(audio.currentTime - video.currentTime) > 0.15) {
        try {
          audio.currentTime = video.currentTime
        } catch {}
      }
      if (!video.paused && !video.ended) {
        void audio.play().catch(() => {})
      }
    }
    if (audio.readyState >= 1) {
      syncAndPlay()
    } else {
      audio.addEventListener("loadedmetadata", syncAndPlay, { once: true })
      return () => audio.removeEventListener("loadedmetadata", syncAndPlay)
    }
  }, [useAltAudio, activeLang])

  useEffect(() => {
    const a = audioRef.current
    return () => {
      a?.pause()
    }
  }, [])

  if (!res) return null

  const syncAudio = (playIfRunning = false) => {
    const video = videoRef.current
    const audio = audioRef.current
    if (!video || !audio || !useAltAudio) return
    audio.volume = video.volume
    audio.muted = video.muted
    audio.playbackRate = video.playbackRate
    if (Math.abs(audio.currentTime - video.currentTime) > 0.2) {
      try {
        audio.currentTime = video.currentTime
      } catch {}
    }
    if (playIfRunning && !video.paused && !video.ended) {
      void audio.play().catch(() => {})
    }
  }

  const trackMeta = r.tracks?.files?.find((f) => f.lang.toUpperCase() === activeLang)

  return (
    <Card
      title="Готовый ролик"
      aside={
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 font-mono text-[11px] text-faint">{clock(res.sec)}</span>
          {langs.length > 1 ? (
            <>
              <Volume2 className="size-3.5 text-faint" />
              {langs.map((l) => {
                const on = l === activeLang
                return (
                  <button
                    key={l}
                    type="button"
                    onClick={() => setSelectedLang(l)}
                    title={l === baseLang ? `${l} (оригинал)` : `Смотреть с озвучкой ${l}`}
                    className={cn(
                      "h-6 rounded-[3px] border px-2 font-mono text-[11px] transition-colors",
                      on
                        ? "border-pick bg-pick text-white font-medium"
                        : "border-line-strong bg-background text-muted-foreground hover:border-pick/40 hover:text-foreground",
                    )}
                  >
                    {l}
                  </button>
                )
              })}
            </>
          ) : (
            langs[0] && <span className="font-mono text-[11px] text-faint">{langs[0]}</span>
          )}
        </div>
      }
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div>
          <video
            ref={videoRef}
            src={reels.resultUrl(r.id, "mp4")}
            controls
            preload="metadata"
            onPlay={() => {
              if (videoRef.current) setEmbeddedAudioEnabled(videoRef.current, !useAltAudio)
              syncAudio(true)
            }}
            onPlaying={() => syncAudio(true)}
            onPause={() => audioRef.current?.pause()}
            onWaiting={() => audioRef.current?.pause()}
            onEnded={() => audioRef.current?.pause()}
            onSeeked={() => syncAudio(true)}
            onRateChange={() => syncAudio(false)}
            onVolumeChange={() => syncAudio(false)}
            onTimeUpdate={() => {
              const video = videoRef.current
              const audio = audioRef.current
              if (!video || !audio || !useAltAudio || video.paused) return
              if (audio.paused && video.readyState >= 3) {
                void audio.play().catch(() => {})
              } else if (Math.abs(audio.currentTime - video.currentTime) > 0.35) {
                try {
                  audio.currentTime = video.currentTime
                } catch {}
              }
            }}
            className={cn("w-full rounded-[3px] bg-black", r.settings.format === "9:16" ? "aspect-[9/16] max-h-[70vh]" : "aspect-video")}
          />
          {useAltAudio && <audio ref={audioRef} src={reels.trackUrl(r.id, activeLang)} preload="auto" className="hidden" />}
        </div>
        <div className="flex flex-col gap-2">
          <a href={reels.resultUrl(r.id, "mp4")} download className={BTN_PRIMARY}>
            <Download className="size-3.5" />
            Ролик ({baseLang}) · {bytes(res.mp4.size)}
          </a>
          {langs.length > 1 && (
            <a href={reels.trackUrl(r.id, activeLang)} download={trackMeta?.name ?? true} className={BTN_SECONDARY}>
              <Volume2 className="size-3.5" />
              Озвучка {activeLang} (.mp3){trackMeta?.size ? ` · ${bytes(trackMeta.size)}` : ""}
            </a>
          )}
          <a href={reels.resultUrl(r.id, "montage")} download className={BTN_SECONDARY}>
            <FolderArchive className="size-3.5" />
            Проект для DaVinci · {bytes(res.montage.size)}
          </a>
          <div className="mt-2 space-y-1.5 text-[13px] text-muted-foreground">
            <p className="flex items-start gap-2">
              <Film className="mt-0.5 size-3.5 shrink-0 text-faint" />
              {res.renderer === "remotion" ? "Переходы и обработка стиля монтажа" : "Склейка без переходов: на сервере нет Remotion"}
            </p>
            {res.fallbacks > 0 && <p>Запасной ход у {res.fallbacks} кадр. — подробности в report.json проекта</p>}
            {res.failed > 0 && <p className="text-warn">Не вышло {res.failed} кадр. — их время отдано соседним</p>}
            <p className="text-faint">В проекте: клипы, голос каждого языка, reel.xml для DaVinci (File → Import → Timeline), EDL, атрибуция футажей.</p>
          </div>
        </div>
      </div>
    </Card>
  )
}
