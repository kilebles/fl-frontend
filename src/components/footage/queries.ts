"use client"

import { useEffect } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"

import { footage } from "@/lib/api"
import { useHydrated } from "@/lib/queries"

export const fkeys = {
  all: ["footage"] as const,
  health: ["footage", "health"] as const,
  options: ["footage", "options"] as const,
  sources: ["footage", "sources"] as const,
  voice: ["footage", "voice"] as const,
  projects: ["footage", "projects"] as const,
  project: (id: string) => ["footage", "project", id] as const,
  log: (id: string) => ["footage", "log", id] as const,
}

function ready<T>(q: T & { data?: unknown; isLoading: boolean }, ok: boolean): T {
  return ok ? q : ({ ...q, data: undefined, isLoading: true } as T)
}

export function useFootageHealth() {
  return ready(useQuery({ queryKey: fkeys.health, queryFn: footage.health, refetchInterval: 60_000, retry: false }), useHydrated())
}

export function useFootageOptions() {
  return ready(useQuery({ queryKey: fkeys.options, queryFn: footage.options, staleTime: 5 * 60_000 }), useHydrated())
}

export function useFootageSources() {
  return ready(useQuery({ queryKey: fkeys.sources, queryFn: () => footage.sources(), staleTime: 5 * 60_000, retry: false }), useHydrated())
}

export function useVoiceSources(enabled: boolean) {
  return ready(useQuery({ queryKey: fkeys.voice, queryFn: footage.voiceSources, enabled, staleTime: 30_000, retry: false }), useHydrated())
}

export function useFootageProjects() {
  return ready(useQuery({ queryKey: fkeys.projects, queryFn: footage.projects, refetchInterval: 60_000 }), useHydrated())
}

export function useFootageProject(id: string | null) {
  return ready(
    useQuery({
      queryKey: fkeys.project(id ?? ""),
      queryFn: () => footage.project(id!),
      enabled: !!id,
      retry: (n, e) => n < 2 && !("status" in e && e.status === 404),
    }),
    useHydrated(),
  )
}

export function useFootageLog(id: string | null) {
  return ready(useQuery({ queryKey: fkeys.log(id ?? ""), queryFn: () => footage.log(id!), enabled: !!id }), useHydrated())
}

/** /api/footage/events (SSE): refetch exactly what changed. */
export function useFootageEvents() {
  const qc = useQueryClient()
  useEffect(() => {
    const es = new EventSource(footage.eventsUrl(), { withCredentials: true })
    es.addEventListener("project.changed", (ev) => {
      qc.invalidateQueries({ queryKey: fkeys.projects })
      try {
        const d = JSON.parse((ev as MessageEvent).data || "{}")
        if (typeof d.id === "string") {
          qc.invalidateQueries({ queryKey: fkeys.project(d.id) })
          qc.invalidateQueries({ queryKey: fkeys.log(d.id) })
        }
      } catch {}
    })
    es.addEventListener("worker.changed", () => qc.invalidateQueries({ queryKey: fkeys.health }))
    return () => es.close()
  }, [qc])
}
