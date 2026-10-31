"use client"

import { useEffect, useSyncExternalStore } from "react"
import { useMutation, useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query"
import { toast } from "sonner"

import { api, avatars, infographicActive, infographics, isFinished, projects, prompts, runActive, type JobDetail, type JobStatus } from "@/lib/api"

export const keys = {
  jobs: ["jobs"] as const,
  job: (id: string) => ["job", id] as const,
  files: (id: string) => ["files", id] as const,
  templates: ["prompt-templates"] as const,
  template: (id: string) => ["prompt-template", id] as const,
  runs: ["prompt-runs"] as const,
  run: (id: string) => ["prompt-run", id] as const,
  models: ["prompt-models"] as const,
  categories: ["infographic-categories"] as const,
  infographicRuns: ["infographic-runs"] as const,
  infographicRun: (id: string) => ["infographic-run", id] as const,
  projects: ["projects"] as const,
  avatars: ["avatars"] as const,
}

const subscribeNothing = () => () => {}

/** False during SSR and hydration, true after: parts of the tree hydrate late (Suspense),
 *  by then the cache may hold data the server HTML did not have. */
export function useHydrated() {
  return useSyncExternalStore(subscribeNothing, () => true, () => false)
}

function hydrated<T>(query: UseQueryResult<T>, ready: boolean): UseQueryResult<T> {
  return ready ? query : ({ ...query, data: undefined, isLoading: true } as UseQueryResult<T>)
}

export function useJobs() {
  const ready = useHydrated()
  return hydrated(useQuery({ queryKey: keys.jobs, queryFn: () => api.jobs(), refetchInterval: 30_000 }), ready)
}

export function useJob(id: string) {
  const ready = useHydrated()
  return hydrated(useQuery({ queryKey: keys.job(id), queryFn: () => api.job(id), retry: (n, e) => n < 2 && !("status" in e && e.status === 404) }), ready)
}

export function useJobFiles(id: string, live: boolean) {
  const ready = useHydrated()
  return hydrated(useQuery({ queryKey: keys.files(id), queryFn: () => api.files(id), refetchInterval: live ? 15_000 : false }), ready)
}

export function usePromptModels() {
  return hydrated(useQuery({ queryKey: keys.models, queryFn: prompts.models, staleTime: Infinity }), useHydrated())
}

export function useTemplates() {
  return hydrated(useQuery({ queryKey: keys.templates, queryFn: prompts.templates }), useHydrated())
}

export function useTemplate(id: string | null) {
  return hydrated(useQuery({ queryKey: keys.template(id ?? ""), queryFn: () => prompts.template(id!), enabled: !!id }), useHydrated())
}

export function useRuns() {
  return hydrated(
    useQuery({ queryKey: keys.runs, queryFn: prompts.runs, refetchInterval: (q) => (q.state.data?.some(runActive) ? 2_000 : 30_000) }),
    useHydrated()
  )
}

export function useRun(id: string) {
  return hydrated(
    useQuery({ queryKey: keys.run(id), queryFn: () => prompts.run(id), refetchInterval: (q) => (q.state.data && runActive(q.state.data) ? 2_000 : false) }),
    useHydrated()
  )
}

export function useInfographicCategories() {
  return hydrated(useQuery({ queryKey: keys.categories, queryFn: infographics.categories, staleTime: Infinity }), useHydrated())
}

export function useInfographicRuns() {
  return hydrated(
    useQuery({
      queryKey: keys.infographicRuns,
      queryFn: infographics.runs,
      refetchInterval: (q) => (q.state.data?.some(infographicActive) ? 3_000 : 30_000),
    }),
    useHydrated()
  )
}

export function useInfographicRun(id: string) {
  return hydrated(
    useQuery({
      queryKey: keys.infographicRun(id),
      queryFn: () => infographics.run(id),
      refetchInterval: (q) => (q.state.data && infographicActive(q.state.data) ? 3_000 : false),
    }),
    useHydrated()
  )
}

export function useProjects() {
  return hydrated(useQuery({ queryKey: keys.projects, queryFn: projects.list }), useHydrated())
}

export function useAvatars() {
  return hydrated(useQuery({ queryKey: keys.avatars, queryFn: avatars.list }), useHydrated())
}

export function useJobActions() {
  const qc = useQueryClient()
  const onError = (e: Error) => toast.error(e.message)
  const refresh = (job?: JobStatus) => {
    qc.invalidateQueries({ queryKey: keys.jobs })
    if (job) qc.invalidateQueries({ queryKey: keys.job(job.id) })
  }
  return {
    cancel: useMutation({ mutationFn: api.cancel, onSuccess: (j) => { refresh(j); toast("Задача отменена") }, onError }),
    retry: useMutation({ mutationFn: api.retry, onSuccess: (j) => { refresh(j); toast.success("Задача снова в очереди") }, onError }),
    remove: useMutation({
      mutationFn: api.remove,
      onSuccess: (_, id) => {
        qc.setQueryData<JobStatus[]>(keys.jobs, (jobs) => jobs?.filter((j) => j.id !== id))
        qc.removeQueries({ queryKey: keys.job(id) })
        toast("Задача удалена")
      },
      onError,
    }),
  }
}

/**
 * Subscribes to the API's server-sent events and merges every job update into the
 * query cache, so lists, the top bar and the job page update live.
 */
export function useJobEvents(enabled = true) {
  const qc = useQueryClient()

  useEffect(() => {
    if (!enabled) return
    const source = new EventSource(api.eventsUrl(), { withCredentials: true })
    source.addEventListener("job", (event) => {
      const status: JobStatus = JSON.parse((event as MessageEvent).data)
      qc.setQueryData<JobStatus[]>(keys.jobs, (jobs) => {
        if (!jobs) return jobs
        const index = jobs.findIndex((j) => j.id === status.id)
        if (index === -1) return [status, ...jobs]
        const next = jobs.slice()
        next[index] = status
        return next
      })
      const previous = qc.getQueryData<JobDetail>(keys.job(status.id))
      if (previous) {
        qc.setQueryData<JobDetail>(keys.job(status.id), { ...previous, ...status })
        const p = previous.progress
        const changed = p.images_done !== status.progress.images_done || p.videos_done !== status.progress.videos_done || p.skipped !== status.progress.skipped
        if (changed || (isFinished(status.state) && !isFinished(previous.state))) {
          qc.invalidateQueries({ queryKey: keys.files(status.id) })
        }
        if (status.state !== previous.state) qc.invalidateQueries({ queryKey: keys.job(status.id) })
      }
    })
    return () => source.close()
  }, [qc, enabled])
}

/** Style suffix of the current project ("" without a project). */
export function useProjectStyle(projectId: string | null): string {
  const { data } = useProjects()
  return data?.find((p) => p.id === projectId)?.style ?? ""
}
