"use client"

import { useEffect } from "react"
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query"

import { pgActive, promptgen, type PgMode } from "@/lib/api"
import { useHydrated } from "@/lib/queries"

export { setUrlParams, useUrlParam } from "@/components/script/queries"

export const pkeys = {
  all: ["prompts"] as const,
  health: ["prompts", "health"] as const,
  options: ["prompts", "options"] as const,
  niches: ["prompts", "niches"] as const,
  template: (slug: string, kind: PgMode) => ["prompts", "template", slug, kind] as const,
  builtin: (kind: PgMode) => ["prompts", "builtin", kind] as const,
  scripts: (niche: string) => ["prompts", "scripts", niche] as const,
  projects: (projectId: string) => ["prompts", "projects", projectId] as const,
  projectsAll: ["prompts", "projects"] as const,
  project: (id: string) => ["prompts", "project", id] as const,
  brief: (id: string) => ["prompts", "brief", id] as const,
  result: (id: string) => ["prompts", "result", id] as const,
  log: (id: string) => ["prompts", "log", id] as const,
}

function ready<T>(q: T & { data?: unknown; isLoading: boolean }, ok: boolean): T {
  return ok ? q : ({ ...q, data: undefined, isLoading: true } as T)
}

export function usePgHealth() {
  return ready(useQuery({ queryKey: pkeys.health, queryFn: promptgen.health, refetchInterval: 60_000, retry: false }), useHydrated())
}

export function usePgOptions() {
  return ready(useQuery({ queryKey: pkeys.options, queryFn: promptgen.options, staleTime: 60_000 }), useHydrated())
}

export function usePgNiches() {
  return ready(useQuery({ queryKey: pkeys.niches, queryFn: promptgen.niches, staleTime: 30_000 }), useHydrated())
}

export function usePgTemplate(slug: string | null, kind: PgMode) {
  return ready(useQuery({ queryKey: pkeys.template(slug ?? "", kind), queryFn: () => promptgen.template(slug!, kind), enabled: !!slug }), useHydrated())
}

export function usePgBuiltin(kind: PgMode, enabled: boolean) {
  return ready(useQuery({ queryKey: pkeys.builtin(kind), queryFn: () => promptgen.builtin(kind), enabled, staleTime: Infinity }), useHydrated())
}

export function usePgScripts(niche: string) {
  return ready(useQuery({ queryKey: pkeys.scripts(niche), queryFn: () => promptgen.scripts(niche || undefined), staleTime: 30_000, retry: false }), useHydrated())
}

export function usePgProjects(projectId: string | null) {
  return ready(
    useQuery({
      queryKey: pkeys.projects(projectId ?? ""),
      queryFn: () => promptgen.projects(projectId),
      refetchInterval: (q) => (q.state.data?.some(pgActive) ? 15_000 : 60_000),
    }),
    useHydrated()
  )
}

export function usePgProject(id: string | null) {
  return ready(
    useQuery({
      queryKey: pkeys.project(id ?? ""),
      queryFn: () => promptgen.project(id!),
      enabled: !!id,
      retry: (n, e) => n < 2 && !("status" in e && e.status === 404),
    }),
    useHydrated()
  )
}

export function usePgBrief(id: string | null, has: boolean) {
  return ready(useQuery({ queryKey: pkeys.brief(id ?? ""), queryFn: () => promptgen.brief(id!), enabled: !!id && has }), useHydrated())
}

export function usePgResult(id: string | null, enabled: boolean) {
  return ready(
    useQuery({ queryKey: pkeys.result(id ?? ""), queryFn: () => promptgen.result(id!), enabled: !!id && enabled, placeholderData: keepPreviousData }),
    useHydrated()
  )
}

export function usePgLog(id: string | null) {
  return ready(useQuery({ queryKey: pkeys.log(id ?? ""), queryFn: () => promptgen.log(id!), enabled: !!id }), useHydrated())
}

/** /api/prompts/events (SSE): refetch exactly what changed. */
export function usePgEvents() {
  const qc = useQueryClient()
  useEffect(() => {
    const es = new EventSource(promptgen.eventsUrl(), { withCredentials: true })
    const on = (event: string, fn: (data: Record<string, unknown>) => void) =>
      es.addEventListener(event, (ev) => {
        try {
          fn(JSON.parse((ev as MessageEvent).data || "{}"))
        } catch {
          fn({})
        }
      })
    on("project.changed", (d) => {
      qc.invalidateQueries({ queryKey: pkeys.projectsAll })
      if (typeof d.id === "string") {
        qc.invalidateQueries({ queryKey: pkeys.project(d.id) })
        qc.invalidateQueries({ queryKey: pkeys.log(d.id) })
        qc.invalidateQueries({ queryKey: pkeys.brief(d.id) })
        qc.invalidateQueries({ queryKey: pkeys.result(d.id) })
      }
    })
    on("template.changed", (d) => {
      qc.invalidateQueries({ queryKey: pkeys.niches })
      if (typeof d.niche === "string" && (d.kind === "regular" || d.kind === "avatar"))
        qc.invalidateQueries({ queryKey: pkeys.template(d.niche, d.kind) })
    })
    on("worker.changed", () => qc.invalidateQueries({ queryKey: pkeys.health }))
    return () => es.close()
  }, [qc])
}
