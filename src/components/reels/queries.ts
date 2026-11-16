"use client"

import { useEffect } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"

import { reels } from "@/lib/api"
import { useHydrated } from "@/lib/queries"
import { REFETCH_MS, throttler } from "@/lib/throttle"

export const rkeys = {
  all: ["reels"] as const,
  health: ["reels", "health"] as const,
  queue: ["reels", "queue"] as const,
  options: ["reels", "options"] as const,
  voice: ["reels", "voice"] as const,
  fonts: ["reels", "fonts"] as const,
  list: ["reels", "list"] as const,
  reel: (id: string) => ["reels", "reel", id] as const,
  storyboard: (id: string) => ["reels", "storyboard", id] as const,
  tracks: (id: string) => ["reels", "tracks", id] as const,
  youtube: (id: string) => ["reels", "youtube", id] as const,
}

function ready<T>(q: T & { data?: unknown; isLoading: boolean }, ok: boolean): T {
  return ok ? q : ({ ...q, data: undefined, isLoading: true } as T)
}

export function useReelsHealth() {
  return ready(useQuery({ queryKey: rkeys.health, queryFn: reels.health, refetchInterval: 60_000, retry: false }), useHydrated())
}

export function useReelQueue() {
  return ready(useQuery({ queryKey: rkeys.queue, queryFn: reels.queue, refetchInterval: 15_000, retry: false }), useHydrated())
}

export function useReelOptions() {
  return ready(useQuery({ queryKey: rkeys.options, queryFn: reels.options, staleTime: 5 * 60_000 }), useHydrated())
}

export function useReelFonts() {
  return ready(useQuery({ queryKey: rkeys.fonts, queryFn: reels.fonts, staleTime: 5 * 60_000, retry: false }), useHydrated())
}

export function useReelVoiceSources(enabled: boolean) {
  return ready(useQuery({ queryKey: rkeys.voice, queryFn: reels.voiceSources, enabled, staleTime: 30_000, retry: false }), useHydrated())
}

export function useReels() {
  return ready(useQuery({ queryKey: rkeys.list, queryFn: reels.list, refetchInterval: 60_000 }), useHydrated())
}

export function useReel(id: string | null) {
  return ready(
    useQuery({
      queryKey: rkeys.reel(id ?? ""),
      queryFn: () => reels.get(id!),
      enabled: !!id,
      retry: (n, e) => n < 2 && !("status" in e && e.status === 404),
    }),
    useHydrated(),
  )
}

/** The storyboard exists once its stage is done; before that the API answers 422. */
export function useStoryboard(id: string | null, done: boolean) {
  return ready(
    useQuery({ queryKey: rkeys.storyboard(id ?? ""), queryFn: () => reels.storyboard(id!), enabled: !!id && done, retry: false }),
    useHydrated(),
  )
}

/** YouTube titles and descriptions of the reel; `generated` refetches them when the brain makes new ones. */
export function useReelYoutube(id: string, enabled: boolean, generated?: string | null) {
  return ready(
    useQuery({ queryKey: [...rkeys.youtube(id), generated ?? ""], queryFn: () => reels.youtube(id), enabled, retry: false }),
    useHydrated(),
  )
}

/** Languages mixed in «Озвучка» for the reel and the last build of its YouTube tracks. */
export function useReelTracks(id: string, enabled: boolean) {
  return ready(
    useQuery({ queryKey: rkeys.tracks(id), queryFn: () => reels.tracks(id), enabled, retry: false, staleTime: 15_000 }),
    useHydrated(),
  )
}

/** /api/reels/events (SSE): refetch exactly what changed — lists not more often than REFETCH_MS (lib/throttle). */
export function useReelEvents() {
  const qc = useQueryClient()
  useEffect(() => {
    const es = new EventSource(reels.eventsUrl(), { withCredentials: true })
    const { soon, clear } = throttler()
    es.addEventListener("reel.changed", (ev) => {
      soon("queue", REFETCH_MS.small, () => qc.invalidateQueries({ queryKey: rkeys.queue }))
      soon("list", REFETCH_MS.list, () => qc.invalidateQueries({ queryKey: rkeys.list }))
      try {
        const d = JSON.parse((ev as MessageEvent).data || "{}")
        if (typeof d.id === "string") {
          soon(`reel:${d.id}`, REFETCH_MS.item, () => {
            qc.invalidateQueries({ queryKey: rkeys.reel(d.id) })
            qc.invalidateQueries({ queryKey: rkeys.storyboard(d.id) })
            qc.invalidateQueries({ queryKey: rkeys.tracks(d.id) })
          })
        }
      } catch {}
    })
    es.addEventListener("worker.changed", () => qc.invalidateQueries({ queryKey: rkeys.health }))
    es.addEventListener("queue.changed", () => soon("queue", REFETCH_MS.small, () => qc.invalidateQueries({ queryKey: rkeys.queue })))
    return () => {
      es.close()
      clear()
    }
  }, [qc])
}
