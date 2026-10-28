"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { AlertTriangle, ArrowRight, Loader2, RefreshCw, Sparkles } from "lucide-react"
import { toast } from "sonner"

import { AttachButton } from "@/components/script/parts"
import { setUrlParams, skeys, useAnalytics, useAnalyticsItem, useScenarioEvents, useScenarioOptions, useUrlParam } from "@/components/script/queries"
import { WorkerBadge } from "@/components/script/script-view"
import { BTN_PRIMARY, BTN_SMALL, Card, Label, Pick } from "@/components/script/ui"
import { PageHeader } from "@/components/shell/page-header"
import { scenario, type AnalyticsDetail } from "@/lib/api"
import { cn } from "@/lib/utils"

const FIT: Record<string, [string, string]> = {
  high: ["bg-ok", "уверенно"],
  medium: ["bg-warn", "средне"],
  low: ["bg-faint", "слабо"],
}

const urlCount = (text: string) => {
  const items = text.split(/[\s,;]+/).filter((x) => /youtu/i.test(x))
  const channels = items.filter((x) => /youtube\.com\/(@|c\/|channel\/|user\/)/i.test(x)).length
  return { channels, videos: items.length - channels }
}

export function AnalyticsView() {
  useScenarioEvents()
  const qc = useQueryClient()
  const { data: options } = useScenarioOptions()
  const { data, isLoading } = useAnalytics()
  const [niche, setNiche] = useState("")
  const [urls, setUrls] = useState("")
  const [notes, setNotes] = useState("")
  const picked = useUrlParam("a")
  const selected = picked ?? data?.items[0]?.file ?? null
  const nicheName = (slug: string) => options?.niches.find((n) => n.slug === slug)?.name ?? (slug || "без ниши")
  const { channels, videos } = urlCount(urls)

  const start = useMutation({
    mutationFn: (previous?: string) =>
      scenario.startAnalytics(previous ? { previous } : { niche, urls: urls.split(/[\s,;]+/).filter(Boolean), notes }),
    onSuccess: (_, previous) => {
      qc.invalidateQueries({ queryKey: skeys.analytics, exact: true })
      if (!previous) {
        setUrls("")
        setNotes("")
      }
    },
    onError: (e) => toast.error(e.message),
  })

  return (
    <div className="px-4 pt-6 pb-24 sm:px-7">
      <PageHeader title="Аналитика" actions={<WorkerBadge />} />

      <section className="mb-6 rounded-[4px] border border-line bg-surface">
        <div className="grid grid-cols-1 gap-x-5 gap-y-5 p-5 md:grid-cols-2 xl:grid-cols-12">
          <div className="xl:col-span-3">
            <Label>Ниша</Label>
            <Pick
              value={niche}
              onChange={setNiche}
              placeholder="Без ниши"
              options={[...(options?.niches ?? []).map((n) => ({ value: n.slug, label: n.name, hint: `${n.videos} рол.` })), { value: "", label: "Без ниши" }]}
            />
          </div>
          <div className="xl:col-span-5">
            <Label>Ролики и каналы конкурентов</Label>
            <textarea
              rows={3}
              spellCheck={false}
              value={urls}
              onChange={(e) => setUrls(e.target.value)}
              placeholder={"https://www.youtube.com/@канал\nhttps://youtu.be/…"}
              className="block w-full resize-y rounded-[3px] border border-line-strong bg-background p-3 font-mono text-[12px] leading-relaxed outline-none placeholder:text-faint focus:border-electric/60"
            />
          </div>
          <div className="md:col-span-2 xl:col-span-4">
            <Label>Пожелания</Label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Какие темы ищем, что уже снято"
              className="block w-full resize-y rounded-[3px] border border-line-strong bg-background p-3 text-sm leading-relaxed outline-none placeholder:text-faint focus:border-electric/60"
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-3">
          <span className="flex items-center gap-3 font-mono text-[11px] text-muted-foreground">
            {channels || videos ? [channels && `каналов ${channels}`, videos && `роликов ${videos}`].filter(Boolean).join(" · ") : ""}
            <AttachButton label="файл" className="font-sans" onText={(f) => setNotes((x) => (x ? `${x}\n\n` : "") + f.text)} />
          </span>
          <button type="button" disabled={(!urls.trim() && !notes.trim()) || start.isPending} onClick={() => start.mutate(undefined)} className={BTN_PRIMARY}>
            {start.isPending && !start.variables ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
            Предложить темы
          </button>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <div className="lg:col-span-3">
          <div className="overflow-hidden rounded-[4px] border border-line bg-surface">
            {data?.running.map((t) => (
              <div key={t.id} className="flex items-start gap-2 border-b border-line px-4 py-3 text-xs">
                {t.status === "error" ? (
                  <AlertTriangle className="mt-px size-3.5 shrink-0 text-danger" />
                ) : (
                  <span className="mt-1 size-1.5 shrink-0 animate-pulse-dot rounded-full bg-pick text-pick" />
                )}
                <span className="min-w-0">
                  <span className="block truncate text-foreground-2">{nicheName(String(t.params.niche ?? ""))}</span>
                  <span className={cn("block", t.status === "error" ? "text-danger" : "text-muted-foreground")}>
                    {t.status === "error" ? t.error : t.status === "queued" ? "в очереди" : (t.step || "подбор тем").toLowerCase()}
                  </span>
                </span>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-center py-6">
                <Loader2 className="size-4 animate-spin text-faint" />
              </div>
            )}
            {!isLoading && !data?.items.length && !data?.running.length && <p className="px-4 py-6 text-center text-sm text-faint">Подборок пока нет</p>}
            {data?.items.map((p) => (
              <button
                key={p.file}
                type="button"
                onClick={() => setUrlParams({ a: p.file }, true)}
                className={cn(
                  "block w-full border-b border-l-2 border-b-line px-4 py-3 text-left last:border-b-0",
                  selected === p.file ? "border-l-pick bg-pick-soft/60" : "border-l-transparent hover:bg-surface-2/60"
                )}
              >
                <span className={cn("block truncate text-sm font-medium", selected === p.file && "text-pick-text")}>{nicheName(p.niche)}</span>
                <span className="mt-0.5 block font-mono text-[11px] text-faint">
                  {p.created ? `${p.created.slice(8, 10)}.${p.created.slice(5, 7)} ${p.created.slice(11, 16)}` : ""} · {p.topics.length} тем · {p.videos} рол.
                </span>
              </button>
            ))}
          </div>
        </div>
        <div className="lg:col-span-9">
          {selected && <AnalyticsPick file={selected} more={() => start.mutate(selected)} moreBusy={start.isPending && start.variables === selected} />}
        </div>
      </div>
    </div>
  )
}

function AnalyticsPick({ file, more, moreBusy }: { file: string; more: () => void; moreBusy: boolean }) {
  const { data, isLoading } = useAnalyticsItem(file)
  if (isLoading || !data)
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="size-4 animate-spin text-faint" />
      </div>
    )
  return (
    <div className="space-y-5">
      <Card
        title="Что заходит"
        aside={
          <button type="button" disabled={moreBusy} onClick={more} className={BTN_SMALL}>
            {moreBusy ? <Loader2 className="size-3 animate-spin" /> : <RefreshCw className="size-3" />}
            Ещё темы
          </button>
        }
      >
        {data.insights.length ? (
          <ul className="space-y-1.5 text-sm text-foreground-2">
            {data.insights.map((t, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-faint">·</span>
                {t}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-faint">—</p>
        )}
        {data.errors.length > 0 && <p className="mt-3 text-[13px] text-warn">Не получилось: {data.errors.join("; ")}</p>}
      </Card>
      <Topics data={data} />
    </div>
  )
}

function Topics({ data }: { data: AnalyticsDetail }) {
  const router = useRouter()
  const qc = useQueryClient()
  const titles = Object.fromEntries(data.videos.map((v) => [v.id, v.title]))
  const toScript = useMutation({
    mutationFn: (i: number) => scenario.topicToProject(data.file, i),
    onSuccess: (p) => {
      qc.invalidateQueries({ queryKey: skeys.projects })
      router.push(`/script?p=${p.id}`)
    },
    onError: (e) => toast.error(e.message),
  })
  return (
    <div className="overflow-hidden rounded-[4px] border border-line bg-surface">
      {data.topics.map((t, i) => {
        const fit = FIT[String(t.fit ?? "").toLowerCase()]
        return (
          <div key={i} className="group grid grid-cols-[24px_minmax(0,1fr)] gap-x-3 border-b border-line px-4 py-3.5 last:border-b-0 sm:grid-cols-[24px_minmax(0,1fr)_auto]">
            <span className="pt-0.5 font-mono text-[12px] text-faint">{i + 1}</span>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                {fit && <span className={cn("size-2 shrink-0 rounded-[1px]", fit[0])} title={fit[1]} />}
                <span className="text-sm font-medium">{t.title}</span>
              </div>
              {t.title_translation && <div className="mt-0.5 text-[13px] text-faint">{t.title_translation}</div>}
              {(t.why || t.angle) && (
                <div className="mt-2 grid gap-1 text-[13px] sm:grid-cols-[70px_minmax(0,1fr)]">
                  {t.why && (
                    <>
                      <span className="text-muted-foreground">почему</span>
                      <span className="text-foreground-2">{t.why}</span>
                    </>
                  )}
                  {t.angle && (
                    <>
                      <span className="text-muted-foreground">угол</span>
                      <span className="text-foreground-2">{t.angle}</span>
                    </>
                  )}
                </div>
              )}
              {!!t.based_on?.length && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {t.based_on.map((b) => (
                    <span key={b} className="max-w-full truncate rounded-[2px] bg-surface-2 px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
                      {titles[b] ?? b}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="col-start-2 mt-2 sm:col-start-3 sm:mt-0">
              <button
                type="button"
                disabled={toScript.isPending}
                onClick={() => toScript.mutate(i)}
                className="flex h-7 items-center gap-1 rounded-[3px] border border-pick/40 bg-pick-soft px-2 text-[11px] font-medium whitespace-nowrap text-pick-text transition hover:bg-pick hover:text-white disabled:opacity-50 sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100"
              >
                {toScript.isPending && toScript.variables === i ? <Loader2 className="size-3 animate-spin" /> : null}
                В сценарий
                <ArrowRight className="size-3" />
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
