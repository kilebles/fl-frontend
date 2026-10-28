"use client"

import { useEffect, useSyncExternalStore } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"

import { scenario } from "@/lib/api"
import { useHydrated } from "@/lib/queries"

export const skeys = {
  all: ["scenario"] as const,
  health: ["scenario", "health"] as const,
  options: ["scenario", "options"] as const,
  niches: ["scenario", "niches"] as const,
  niche: (slug: string) => ["scenario", "niche", slug] as const,
  projects: ["scenario", "projects"] as const,
  project: (id: string) => ["scenario", "project", id] as const,
  script: (id: string) => ["scenario", "script", id] as const,
  log: (id: string) => ["scenario", "log", id] as const,
  analytics: ["scenario", "analytics"] as const,
  analyticsItem: (file: string) => ["scenario", "analytics", file] as const,
}

function ready<T>(q: T & { data?: unknown; isLoading: boolean }, ok: boolean): T {
  return ok ? q : ({ ...q, data: undefined, isLoading: true } as T)
}

export function useScenarioHealth() {
  return ready(useQuery({ queryKey: skeys.health, queryFn: scenario.health, refetchInterval: 60_000, retry: false }), useHydrated())
}

export function useScenarioOptions() {
  return ready(useQuery({ queryKey: skeys.options, queryFn: scenario.options, staleTime: 60_000 }), useHydrated())
}

export function useNiches() {
  return ready(useQuery({ queryKey: skeys.niches, queryFn: scenario.niches }), useHydrated())
}

export function useNiche(slug: string | null) {
  return ready(useQuery({ queryKey: skeys.niche(slug ?? ""), queryFn: () => scenario.niche(slug!), enabled: !!slug }), useHydrated())
}

export function useScenarioProjects() {
  return ready(useQuery({ queryKey: skeys.projects, queryFn: scenario.projects, refetchInterval: 60_000 }), useHydrated())
}

export function useScenarioProject(id: string | null) {
  return ready(
    useQuery({
      queryKey: skeys.project(id ?? ""),
      queryFn: () => scenario.project(id!),
      enabled: !!id,
      retry: (n, e) => n < 2 && !("status" in e && e.status === 404),
    }),
    useHydrated()
  )
}

export function useScenarioScript(id: string | null, done: boolean) {
  return ready(useQuery({ queryKey: skeys.script(id ?? ""), queryFn: () => scenario.script(id!), enabled: !!id && done }), useHydrated())
}

export function useScenarioLog(id: string | null) {
  return ready(useQuery({ queryKey: skeys.log(id ?? ""), queryFn: () => scenario.log(id!), enabled: !!id }), useHydrated())
}

export function useAnalytics() {
  return ready(useQuery({ queryKey: skeys.analytics, queryFn: () => scenario.analytics() }), useHydrated())
}

export function useAnalyticsItem(file: string | null) {
  return ready(useQuery({ queryKey: skeys.analyticsItem(file ?? ""), queryFn: () => scenario.analyticsItem(file!), enabled: !!file, staleTime: Infinity }), useHydrated())
}

/** /api/scenario/events (SSE): refetch exactly what changed. */
export function useScenarioEvents() {
  const qc = useQueryClient()
  useEffect(() => {
    const es = new EventSource(scenario.eventsUrl())
    const on = (event: string, fn: (data: Record<string, unknown>) => void) =>
      es.addEventListener(event, (ev) => {
        try {
          fn(JSON.parse((ev as MessageEvent).data || "{}"))
        } catch {
          fn({})
        }
      })
    on("project.changed", (d) => {
      qc.invalidateQueries({ queryKey: skeys.projects })
      if (typeof d.id === "string") {
        qc.invalidateQueries({ queryKey: skeys.project(d.id) })
        qc.invalidateQueries({ queryKey: skeys.log(d.id) })
        qc.invalidateQueries({ queryKey: skeys.script(d.id) })
      }
    })
    on("niche.changed", (d) => {
      qc.invalidateQueries({ queryKey: skeys.niches })
      qc.invalidateQueries({ queryKey: skeys.options })
      if (typeof d.slug === "string") qc.invalidateQueries({ queryKey: skeys.niche(d.slug) })
    })
    on("task.changed", (d) => {
      if (d.task === "analytics" || d.status === "deleted") qc.invalidateQueries({ queryKey: skeys.analytics, exact: true })
      if (typeof d.niche === "string") qc.invalidateQueries({ queryKey: skeys.niche(d.niche) })
    })
    on("analytics.changed", () => qc.invalidateQueries({ queryKey: skeys.analytics, exact: true }))
    on("worker.changed", () => qc.invalidateQueries({ queryKey: skeys.health }))
    return () => es.close()
  }, [qc])
}

/* ------------------------------------------------------------------ URL state (?p=, ?tab=, ?niche=) */

const URL_EVENT = "scenario-url"

function subscribeUrl(cb: () => void) {
  window.addEventListener("popstate", cb)
  window.addEventListener(URL_EVENT, cb)
  return () => {
    window.removeEventListener("popstate", cb)
    window.removeEventListener(URL_EVENT, cb)
  }
}

export function useUrlParam(name: string): string | null {
  return useSyncExternalStore(
    subscribeUrl,
    () => new URLSearchParams(window.location.search).get(name),
    () => null
  )
}

/** Change query params without a navigation (back/forward still work). */
export function setUrlParams(params: Record<string, string | null>, replace = false) {
  const url = new URL(window.location.href)
  for (const [k, v] of Object.entries(params)) {
    if (v) url.searchParams.set(k, v)
    else url.searchParams.delete(k)
  }
  if (replace) window.history.replaceState(window.history.state, "", url)
  else window.history.pushState(window.history.state, "", url)
  window.dispatchEvent(new Event(URL_EVENT))
}
