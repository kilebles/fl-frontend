"use client"

import { useEffect } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"

import { montage } from "@/lib/api"
import { useHydrated } from "@/lib/queries"

export const mkeys = {
  all: ["montage"] as const,
  health: ["montage", "health"] as const,
  options: ["montage", "options"] as const,
  jobs: ["montage", "jobs"] as const,
  job: (id: string) => ["montage", "job", id] as const,
}

function ready<T>(q: T & { data?: unknown; isLoading: boolean }, ok: boolean): T {
  return ok ? q : ({ ...q, data: undefined, isLoading: true } as T)
}

export function useMontageHealth() {
  return ready(useQuery({ queryKey: mkeys.health, queryFn: montage.health, refetchInterval: 60_000, retry: false }), useHydrated())
}

export function useMontageOptions() {
  return ready(useQuery({ queryKey: mkeys.options, queryFn: montage.options, staleTime: 5 * 60_000 }), useHydrated())
}

export function useInfoJobs() {
  return ready(useQuery({ queryKey: mkeys.jobs, queryFn: montage.list, refetchInterval: 60_000 }), useHydrated())
}

export function useInfoJob(id: string | null) {
  return ready(
    useQuery({
      queryKey: mkeys.job(id ?? ""),
      queryFn: () => montage.get(id!),
      enabled: !!id,
      retry: (n, e) => n < 2 && !("status" in e && e.status === 404),
    }),
    useHydrated(),
  )
}

/** /api/montage/events (SSE): refetch exactly what changed. */
export function useMontageEvents() {
  const qc = useQueryClient()
  useEffect(() => {
    const es = new EventSource(montage.eventsUrl(), { withCredentials: true })
    es.addEventListener("job.changed", (ev) => {
      qc.invalidateQueries({ queryKey: mkeys.jobs })
      try {
        const d = JSON.parse((ev as MessageEvent).data || "{}")
        if (typeof d.id === "string") qc.invalidateQueries({ queryKey: mkeys.job(d.id) })
      } catch {}
    })
    es.addEventListener("worker.changed", () => qc.invalidateQueries({ queryKey: mkeys.health }))
    return () => es.close()
  }, [qc])
}
