"use client"

import { useEffect, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { api, isFinished, type JobDetail, type JobStatus } from "@/lib/api"

export const keys = {
  jobs: ["jobs"] as const,
  job: (id: string) => ["job", id] as const,
  files: (id: string) => ["files", id] as const,
  accounts: ["accounts"] as const,
}

export function useJobs() {
  return useQuery({ queryKey: keys.jobs, queryFn: api.jobs, refetchInterval: 30_000 })
}

export function useJob(id: string) {
  return useQuery({ queryKey: keys.job(id), queryFn: () => api.job(id), retry: (n, e) => n < 2 && !("status" in e && e.status === 404) })
}

export function useJobFiles(id: string, live: boolean) {
  return useQuery({ queryKey: keys.files(id), queryFn: () => api.files(id), refetchInterval: live ? 15_000 : false })
}

export function useAccounts() {
  return useQuery({ queryKey: keys.accounts, queryFn: api.accounts, refetchInterval: 15_000 })
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
 * query cache, so lists, the top bar and the job page update live. Returns whether
 * the stream is connected.
 */
export function useJobEvents(): boolean {
  const qc = useQueryClient()
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    const source = new EventSource(api.eventsUrl())
    source.onopen = () => setConnected(true)
    source.onerror = () => setConnected(false)
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
  }, [qc])

  return connected
}
