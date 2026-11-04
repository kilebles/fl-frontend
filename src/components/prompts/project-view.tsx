"use client"

import { useMemo, useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { AlertTriangle, Check, ChevronDown, Copy, Download, Loader2, Pause, Pencil, Play, RefreshCw, Sparkles } from "lucide-react"
import { toast } from "sonner"

import { CopyAllButton, MODE_NAME, StageSteps, ToProduction, parasWord, scenesWord } from "@/components/prompts/parts"
import { statusText } from "@/components/prompts/project-list"
import { pkeys, usePgBrief, usePgLog, usePgResult } from "@/components/prompts/queries"
import { BTN_PRIMARY, BTN_SECONDARY, BTN_SMALL, Card, Seg } from "@/components/script/ui"
import { pgActive, promptgen, type PgBrief, type PgProject, type PgRow } from "@/lib/api"
import { cn } from "@/lib/utils"

const PAGE = 15

function Banner({ tone, children, action }: { tone: "danger" | "warn" | "pick"; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div
      className={cn(
        "mb-4 flex flex-wrap items-center gap-3 rounded-[4px] border px-4 py-3 text-sm",
        tone === "danger" && "border-danger/30 bg-danger/10 text-danger",
        tone === "warn" && "border-warn/40 bg-warn-soft text-warn",
        tone === "pick" && "border-pick/40 bg-pick-soft text-pick-text"
      )}
    >
      <span className="min-w-0 flex-1">{children}</span>
      {action}
    </div>
  )
}

function useAction(p: PgProject) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (fn: () => Promise<unknown>) => fn(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: pkeys.project(p.id) })
      qc.invalidateQueries({ queryKey: pkeys.projectsAll })
    },
    onError: (e) => toast.error(e.message),
  })
}

export function ProjectView({ project: p }: { project: PgProject }) {
  const [tab, setTab] = useState<"prompts" | "brief" | "log">(p.status === "brief_ready" ? "brief" : "prompts")
  const act = useAction(p)
  const active = pgActive(p)
  const st = statusText(p)
  const xlsx = p.files.find((f) => f.name.endsWith(".xlsx"))
  const tsv = p.files.find((f) => f.name.endsWith(".tsv"))

  const captions = {
    brief: p.has_brief ? "готов" : p.stage === "brief" ? "один вызов на сценарий" : "",
    prompts: p.progress.total ? `${p.progress.done} из ${p.progress.total} ${parasWord(p.progress.total)}` : "",
    check: p.summary
      ? [p.summary.with_problems ? `${p.summary.with_problems} с замечаниями` : "", p.summary.with_flags ? `${p.summary.with_flags} с пометками` : ""].filter(Boolean).join(" · ") ||
        "без замечаний"
      : p.progress.flagged
        ? `${p.progress.flagged} абз. помечено`
        : "",
    done: p.summary ? `${p.summary.scenes} ${scenesWord(p.summary.scenes)}` : "",
  }

  return (
    <div className="flex flex-col gap-4">
      <Card bodyClass="p-5">
        <StageSteps stages={p.stages} captions={captions} />
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
          <span className="min-w-0 font-mono text-[11px] text-faint">
            {[
              p.template.builtin ? "встроенный шаблон" : `шаблон: ${p.template.name}`,
              p.model || "модели по этапам",
              p.usage.calls ? `${p.usage.calls} вызовов · ${Math.round(p.usage.seconds / 60)} мин` : "",
            ]
              .filter(Boolean)
              .join(" · ")}
          </span>
          <div className="flex flex-wrap items-center gap-2">
            {active && !p.stop_requested && (
              <button type="button" onClick={() => act.mutate(() => promptgen.stop(p.id))} className={BTN_SECONDARY}>
                <Pause className="size-3.5" /> Остановить
              </button>
            )}
            {(p.status === "stopped" || p.status === "error") && (
              <button type="button" onClick={() => act.mutate(() => promptgen.resume(p.id))} className={BTN_SECONDARY}>
                <Play className="size-3.5" /> Продолжить
              </button>
            )}
            {!active && p.has_brief && (
              <button
                type="button"
                onClick={() => confirm("Написать бриф заново? Готовые промпты будут удалены.") && act.mutate(() => promptgen.rebrief(p.id))}
                className={BTN_SECONDARY}
              >
                <RefreshCw className="size-3.5" /> Бриф заново
              </button>
            )}
            {p.status === "done" && (
              <>
                <button
                  type="button"
                  onClick={() => confirm("Пересобрать промпты по текущему брифу?") && act.mutate(() => promptgen.launch(p.id))}
                  className={BTN_SECONDARY}
                >
                  <RefreshCw className="size-3.5" /> Пересобрать
                </button>
                <CopyAllButton project={p} className={BTN_SECONDARY} />
                {xlsx && (
                  <a href={promptgen.fileUrl(p.id, xlsx.name)} download className={BTN_SECONDARY}>
                    <Download className="size-3.5" /> xlsx
                  </a>
                )}
                {tsv && (
                  <a href={promptgen.fileUrl(p.id, tsv.name)} download className={cn(BTN_SECONDARY, "px-3")} title="Для Google Sheets">
                    tsv
                  </a>
                )}
                <ToProduction project={p} />
              </>
            )}
          </div>
        </div>
      </Card>

      {p.status === "error" && <Banner tone="danger">{p.error}</Banner>}
      {p.waiting_until && active && <Banner tone="warn">Лимит подписки исчерпан — продолжу сам после {p.waiting_until.slice(11, 16)}</Banner>}
      {p.status === "brief_ready" && (
        <Banner
          tone="pick"
          action={
            <button type="button" onClick={() => act.mutate(() => promptgen.launch(p.id))} className={BTN_PRIMARY}>
              <Sparkles className="size-3.5" /> Запустить промпты
            </button>
          }
        >
          Бриф готов. Проверьте эпоху, одежду и персонажей — поправить можно прямо здесь.
        </Banner>
      )}
      {(p.status === "queued" || p.stop_requested || (active && p.stage !== "prompts")) && <p className="font-mono text-[11px] text-faint">{st.text}</p>}

      <div className="flex items-center justify-between gap-3">
        <div className="w-full max-w-md">
          <Seg
            value={tab}
            onChange={(v) => setTab(v as typeof tab)}
            options={[
              ["prompts", "Промпты"],
              ["brief", "Бриф"],
              ["log", "Ход работы"],
            ]}
          />
        </div>
      </div>

      {tab === "prompts" && <Prompts project={p} />}
      {tab === "brief" && <BriefPanel project={p} />}
      {tab === "log" && <Log project={p} />}
    </div>
  )
}

/* ------------------------------------------------------------------ промпты */

function CopyIcon({ text, title }: { text: string; title: string }) {
  const [done, setDone] = useState(false)
  return (
    <button
      type="button"
      title={title}
      onClick={async () => {
        await navigator.clipboard.writeText(text)
        setDone(true)
        setTimeout(() => setDone(false), 1200)
      }}
      className="grid size-6 shrink-0 place-items-center rounded-[3px] text-faint hover:bg-elev hover:text-foreground"
    >
      {done ? <Check className="size-3 text-ok" /> : <Copy className="size-3" />}
    </button>
  )
}

function PromptCell({ label, full, scene }: { label: string; full: string; scene: string }) {
  const [open, setOpen] = useState(false)
  const tail = scene && full.startsWith(scene) ? full.slice(scene.length).trim() : ""
  return (
    <div className="min-w-0">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-[11px] text-faint">{label}</span>
        <CopyIcon text={full} title={`Скопировать промпт: ${label.toLowerCase()}`} />
      </div>
      <p className="text-[13px] leading-relaxed">
        {scene || full || <span className="text-danger">—</span>}
        {tail && (
          <>
            {" "}
            {open ? (
              <span className="text-faint">{tail}</span>
            ) : (
              <button type="button" onClick={() => setOpen(true)} className="font-mono text-[11px] text-faint hover:text-foreground">
                + стиль и негативы
              </button>
            )}
          </>
        )}
      </p>
    </div>
  )
}

function Prompts({ project: p }: { project: PgProject }) {
  const { data, isLoading, error } = usePgResult(p.id, p.has_brief && p.status !== "brief_ready")
  const [filter, setFilter] = useState<"all" | "issues">("all")
  const [shown, setShown] = useState(PAGE)
  const groups = useMemo(() => {
    const m = new Map<number, PgRow[]>()
    for (const r of data?.rows ?? []) {
      if (filter === "issues" && !r.problems.length && !r.flags.length) continue
      m.set(r.paragraph_n, [...(m.get(r.paragraph_n) ?? []), r])
    }
    return [...m.entries()]
  }, [data, filter])

  if (!p.has_brief || p.status === "brief_ready" || (data && !data.rows.length))
    return (
      <div className="py-12 text-center text-sm text-faint">
        {pgActive(p) ? (
          <span className="inline-flex items-center gap-2">
            <Loader2 className="size-4 animate-spin" /> Готовые абзацы появятся здесь по ходу генерации
          </span>
        ) : p.status === "brief_ready" ? (
          "Промпты появятся после «Запустить промпты»"
        ) : (
          "Промптов пока нет"
        )}
      </div>
    )
  if (isLoading) return <div className="shimmer h-40 rounded-[4px]" />
  if (error || !data) return <div className="py-10 text-center text-sm text-danger">{error?.message}</div>
  const periods = new Map(data.brief.sub_periods.map((x) => [x.id, x.name]))
  const issues = data.rows.filter((r) => r.problems.length || r.flags.length).length

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="flex items-center gap-2 font-mono text-[11px] text-muted-foreground">
          {data.partial && <Loader2 className="size-3 animate-spin text-pick-text" />}
          {data.partial
            ? `готово ${new Set(data.rows.map((r) => r.paragraph_n)).size} из ${data.summary.paragraphs} ${parasWord(data.summary.paragraphs)} · ${data.summary.scenes} ${scenesWord(data.summary.scenes)}`
            : `${data.summary.paragraphs} ${parasWord(data.summary.paragraphs)} · ${data.summary.scenes} ${scenesWord(data.summary.scenes)} · ${data.summary.stock_queries} запросов для стока`}
        </span>
        {issues > 0 && (
          <div className="w-80">
            <Seg
              value={filter}
              onChange={(v) => {
                setFilter(v as typeof filter)
                setShown(PAGE)
              }}
              options={[
                ["all", "Все"],
                ["issues", `С пометками · ${issues}`],
              ]}
            />
          </div>
        )}
      </div>
      {groups.slice(0, shown).map(([n, rows]) => {
        const b = data.brief.paragraphs[n - 1]
        return (
          <section key={n} className="overflow-hidden rounded-[4px] border border-line bg-surface">
            <div className="flex gap-3 border-b border-line bg-surface-2/60 px-4 py-3">
              <span className="w-8 shrink-0 font-mono text-xs text-faint">{n}</span>
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-[13px] text-muted-foreground" title={rows[0].paragraph}>
                  {rows[0].paragraph}
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {b && periods.get(b.period) && <span className="rounded-[2px] bg-pick-soft px-1.5 py-0.5 font-mono text-[11px] text-pick-text">{periods.get(b.period)}</span>}
                  {rows[0].stock.map((q) => (
                    <span key={q} className="rounded-[2px] bg-elev px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground" title="Запрос для стока">
                      {q}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            {rows.map((r) => (
              <div key={r.number} className="grid gap-3 border-b border-line px-4 py-3 last:border-b-0 md:grid-cols-[2rem_minmax(0,1fr)_minmax(0,1fr)]">
                <div className="font-mono text-xs text-faint">
                  {r.number}
                  {(r.problems.length > 0 || r.flags.length > 0) && <AlertTriangle className={cn("mt-1.5 size-3.5", r.problems.length ? "text-danger" : "text-warn")} />}
                </div>
                <PromptCell label={r.shot ? `Картинка · ${r.shot.toLowerCase()}` : "Картинка"} full={r.img} scene={r.scene_img} />
                <PromptCell label="Видео" full={r.vid} scene={r.scene_vid} />
                {(r.problems.length > 0 || r.flags.length > 0) && (
                  <div className="md:col-start-2 md:col-end-4">
                    {[...r.problems, ...r.flags].map((x) => (
                      <p key={x} className={cn("font-mono text-[11px]", r.problems.includes(x) ? "text-danger" : "text-warn")}>
                        {x}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </section>
        )
      })}
      {groups.length > shown && (
        <button type="button" onClick={() => setShown((s) => s + PAGE * 2)} className={cn(BTN_SMALL, "mx-auto")}>
          <ChevronDown className="size-3.5" /> Ещё абзацы · осталось {groups.length - shown}
        </button>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ бриф */

function Field({ label, value, edit, onChange, rows = 2, mono }: { label: string; value: string; edit: boolean; onChange: (v: string) => void; rows?: number; mono?: boolean }) {
  return (
    <div>
      <p className="mb-1 text-[11px] text-faint">{label}</p>
      {edit ? (
        <textarea
          rows={rows}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={cn("block w-full resize-y rounded-[3px] border border-line-strong bg-background p-2 text-[13px] leading-relaxed outline-none focus:border-electric/60", mono && "font-mono")}
        />
      ) : (
        <p className={cn("text-[13px] leading-relaxed", !value && "text-faint")}>{value || "—"}</p>
      )}
    </div>
  )
}

function BriefPanel({ project: p }: { project: PgProject }) {
  const qc = useQueryClient()
  const { data, isLoading } = usePgBrief(p.id, p.has_brief)
  const [draft, setDraft] = useState<PgBrief | null>(null)
  const [allParas, setAllParas] = useState(false)
  const save = useMutation({
    mutationFn: (b: PgBrief) => promptgen.saveBrief(p.id, b),
    onSuccess: () => {
      setDraft(null)
      qc.invalidateQueries({ queryKey: pkeys.brief(p.id) })
      qc.invalidateQueries({ queryKey: pkeys.project(p.id) })
      toast.success(p.status === "done" ? "Бриф сохранён — нажмите «Пересобрать», чтобы обновить промпты" : "Бриф сохранён")
    },
    onError: (e) => toast.error(e.message),
  })
  if (!p.has_brief)
    return <div className="py-12 text-center text-sm text-faint">{pgActive(p) ? "Бриф пишется…" : "Брифа пока нет"}</div>
  if (isLoading || !data) return <div className="shimmer h-40 rounded-[4px]" />
  const b = draft ?? data
  const edit = draft !== null
  const set = (patch: Partial<PgBrief>) => setDraft({ ...b, ...patch })
  const canEdit = !pgActive(p)
  const paras = allParas ? b.paragraphs : b.paragraphs.slice(0, 12)
  const periods = new Map(b.sub_periods.map((x) => [x.id, x.name]))

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end gap-2">
        {edit ? (
          <>
            <button type="button" onClick={() => setDraft(null)} className={BTN_SECONDARY}>
              Отмена
            </button>
            <button type="button" disabled={save.isPending} onClick={() => save.mutate(b)} className={BTN_PRIMARY}>
              {save.isPending && <Loader2 className="size-3.5 animate-spin" />} Сохранить бриф
            </button>
          </>
        ) : (
          canEdit && (
            <button type="button" onClick={() => setDraft(structuredClone(data))} className={BTN_SECONDARY}>
              <Pencil className="size-3.5" /> Править
            </button>
          )
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Эпоха">
          <div className="flex flex-col gap-3">
            <Field label="Эпоха" value={b.era} edit={edit} onChange={(v) => set({ era: v })} rows={1} />
            <Field label="О чём фильм" value={b.synopsis} edit={edit} onChange={(v) => set({ synopsis: v })} rows={4} />
          </div>
        </Card>
        {p.mode === "avatar" && b.host ? (
          <Card title="Ведущий">
            <div className="flex flex-col gap-3">
              <Field label="Одежда — вставляется в каждый промпт картинки слово в слово" value={b.host.clothing} edit={edit} onChange={(v) => set({ host: { ...b.host!, clothing: v } })} rows={3} />
              <Field label="Голос" value={b.host.voice} edit={edit} onChange={(v) => set({ host: { ...b.host!, voice: v } })} rows={1} />
              {b.host.changes.map((c, i) => (
                <Field
                  key={i}
                  label={`Одежда в абзацах ${c.from}–${c.to}`}
                  value={c.clothing}
                  edit={edit}
                  onChange={(v) => set({ host: { ...b.host!, changes: b.host!.changes.map((x, k) => (k === i ? { ...x, clothing: v } : x)) } })}
                />
              ))}
            </div>
          </Card>
        ) : (
          <Card title="Ограничения">
            {b.restrictions.length ? (
              <div className="flex flex-col gap-3">
                {b.restrictions.map((r, i) => (
                  <Field key={i} label={`Абзац ${r.paragraph}`} value={r.rule} edit={edit} onChange={(v) => set({ restrictions: b.restrictions.map((x, k) => (k === i ? { ...x, rule: v } : x)) })} />
                ))}
              </div>
            ) : (
              <p className="text-[13px] text-faint">Нет</p>
            )}
          </Card>
        )}
      </div>

      <Card title={`Под-периоды · ${b.sub_periods.length}`}>
        <div className="grid gap-4 md:grid-cols-2">
          {b.sub_periods.map((sp, i) => {
            const up = (patch: Partial<typeof sp>) => set({ sub_periods: b.sub_periods.map((x, k) => (k === i ? { ...x, ...patch } : x)) })
            return (
              <div key={sp.id} className="flex flex-col gap-2 rounded-[3px] border border-line p-3">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-medium">{sp.name}</span>
                  <span className="font-mono text-[11px] text-faint">{sp.when}</span>
                </div>
                <Field label="Материальная культура" value={sp.material} edit={edit} onChange={(v) => up({ material: v })} />
                <Field label="Палитра" value={sp.palette} edit={edit} onChange={(v) => up({ palette: v })} rows={1} />
                <Field label="Свет" value={sp.lighting} edit={edit} onChange={(v) => up({ lighting: v })} rows={1} />
                <Field label="Фактуры" value={sp.textures} edit={edit} onChange={(v) => up({ textures: v })} rows={1} />
              </div>
            )
          })}
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title={`Персонажи · ${b.characters.length}`}>
          <div className="flex flex-col gap-3">
            {b.characters.length ? (
              b.characters.map((c, i) => (
                <Field key={c.name} label={c.name} value={c.cue} edit={edit} onChange={(v) => set({ characters: b.characters.map((x, k) => (k === i ? { ...x, cue: v } : x)) })} />
              ))
            ) : (
              <p className="text-[13px] text-faint">Нет</p>
            )}
          </div>
        </Card>
        <Card title={`Места · ${b.locations.length}`}>
          <div className="flex flex-col gap-3">
            {b.locations.length ? (
              b.locations.map((l, i) => (
                <Field key={l.id} label={l.id} value={l.cue} edit={edit} onChange={(v) => set({ locations: b.locations.map((x, k) => (k === i ? { ...x, cue: v } : x)) })} mono={false} />
              ))
            ) : (
              <p className="text-[13px] text-faint">Нет</p>
            )}
          </div>
        </Card>
      </div>

      {p.mode === "avatar" && b.restrictions.length > 0 && (
        <Card title="Ограничения">
          <div className="flex flex-col gap-3">
            {b.restrictions.map((r, i) => (
              <Field key={i} label={`Абзац ${r.paragraph}`} value={r.rule} edit={edit} onChange={(v) => set({ restrictions: b.restrictions.map((x, k) => (k === i ? { ...x, rule: v } : x)) })} />
            ))}
          </div>
        </Card>
      )}

      <Card title={`По абзацам · ${b.paragraphs.length}`} bodyClass="p-0">
        <div className="divide-y divide-line">
          {paras.map((x, i) => (
            <div key={x.n} className="grid gap-x-4 gap-y-1 px-4 py-2.5 md:grid-cols-[2rem_9rem_minmax(0,1fr)_minmax(0,16rem)]">
              <span className="font-mono text-xs text-faint">{x.n}</span>
              <span className="truncate font-mono text-[11px] text-pick-text">{periods.get(x.period) ?? x.period}</span>
              {edit ? (
                <textarea
                  rows={2}
                  value={x.beat}
                  onChange={(e) => set({ paragraphs: b.paragraphs.map((y, k) => (k === i ? { ...y, beat: e.target.value } : y)) })}
                  className="block w-full resize-y rounded-[3px] border border-line-strong bg-background p-2 text-[13px] outline-none focus:border-electric/60"
                />
              ) : (
                <span className="text-[13px] leading-relaxed">{x.beat}</span>
              )}
              <span className="truncate font-mono text-[11px] text-muted-foreground" title={x.stock.join(" · ")}>
                {x.stock.join(" · ") || "—"}
              </span>
            </div>
          ))}
        </div>
        {b.paragraphs.length > paras.length && (
          <div className="border-t border-line p-3 text-center">
            <button type="button" onClick={() => setAllParas(true)} className={cn(BTN_SMALL, "mx-auto")}>
              Все {b.paragraphs.length} {parasWord(b.paragraphs.length)}
            </button>
          </div>
        )}
      </Card>
    </div>
  )
}

/* ------------------------------------------------------------------ ход работы */

const KIND = { info: "text-muted-foreground", done: "text-ok", warn: "text-warn", limit: "text-warn", error: "text-danger" }

function Log({ project: p }: { project: PgProject }) {
  const { data } = usePgLog(p.id)
  return (
    <Card bodyClass="p-0">
      <div className="divide-y divide-line">
        {(data?.items ?? []).map((x, i) => (
          <div key={i} className="flex gap-4 px-4 py-2 text-[13px]">
            <span className="shrink-0 font-mono text-[11px] text-faint">{x.time.slice(11, 19)}</span>
            <span className={KIND[x.kind] ?? "text-muted-foreground"}>{x.text}</span>
          </div>
        ))}
        {!data?.items.length && <div className="px-4 py-6 text-center text-sm text-faint">Пусто</div>}
      </div>
      <div className="border-t border-line px-4 py-2 font-mono text-[11px] text-faint">
        {MODE_NAME[p.mode]} · {p.script.count} {parasWord(p.script.count)} · {p.script.source === "project" ? `сценарий «${p.script.title ?? ""}»` : `файл ${p.script.name ?? ""}`}
        {p.notes ? ` · дополнительно: ${p.notes}` : ""}
      </div>
    </Card>
  )
}
