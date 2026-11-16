"use client"

import { useSyncExternalStore } from "react"
import { useQuery } from "@tanstack/react-query"
import { Loader2, Pause, Play } from "lucide-react"
import { toast } from "sonner"

import { voice, voiceMediaUrl } from "@/lib/api"
import { cn } from "@/lib/utils"

/** One player for every voice sample on the page: a new sample stops the previous one. */
let audio: HTMLAudioElement | null = null
let state = { id: "", loading: false }
const listeners = new Set<() => void>()
const set = (next: typeof state) => {
  state = next
  listeners.forEach((l) => l())
}
const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => listeners.delete(l)
}
const IDLE = { id: "", loading: false }

/**
 * Plays the sample of a voice of «Озвучка» (`/api/voice/voices/{id}/sample`: the sample from the voice's page in Fish,
 * else a short phrase in its language); the second press stops it.
 */
export function useVoiceSample() {
  const { data: entries } = useQuery({ queryKey: ["reels", "voice-entries"], queryFn: voice.voices })
  const now = useSyncExternalStore(subscribe, () => state, () => IDLE)
  const play = (id: string) => {
    if (!id) return
    if (!audio) {
      audio = new Audio()
      audio.onended = () => set(IDLE)
    }
    if (now.id === id) {
      audio.pause()
      set(IDLE)
      return
    }
    const e = entries?.find((x) => x.id === id || x.fish_id === id)
    audio.pause()
    audio.src = voiceMediaUrl(e?.sample_url ?? `/api/voice/voices/${id}/sample`)
    set({ id, loading: true })
    void audio.play().then(
      () => state.id === id && set({ id, loading: false }),
      () => {
        if (state.id !== id) return
        set(IDLE)
        toast.error("Образец не проигрывается")
      },
    )
  }
  return { playing: now.id, loading: now.loading, play }
}

/** Round play / pause button of a voice sample. */
export function SampleButton({ id, className, title = "Образец" }: { id: string; className?: string; title?: string }) {
  const { playing, loading, play } = useVoiceSample()
  const on = playing === id && !!id
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        play(id)
      }}
      disabled={!id}
      title={on ? "Остановить" : title}
      className={cn(
        "grid size-7 shrink-0 place-items-center rounded-full border border-line-strong text-electric transition-colors hover:bg-elev disabled:opacity-40",
        on && "border-electric/50 bg-electric/10",
        className,
      )}
    >
      {on && loading ? <Loader2 className="size-3 animate-spin" /> : on ? <Pause className="size-3" /> : <Play className="size-3 translate-x-px" />}
    </button>
  )
}
