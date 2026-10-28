"use client"

import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { AlertTriangle, Check, Download, FileText, Film, Link2, Loader2, Paperclip, Pencil, Play, Plus, RefreshCw, RotateCcw, Square, Trash2, Undo2, X } from "lucide-react"
import { toast } from "sonner"

import { AttachButton, ConfirmDialog, TextDialog, lengthText, minutes, num, stepText } from "@/components/script/parts"
import { setUrlParams, skeys, useScenarioLog, useScenarioOptions, useScenarioScript } from "@/components/script/queries"
import { SendButtons } from "@/components/script/send"
import { StageSteps } from "@/components/script/stage-line"
import { BTN_PRIMARY, BTN_SECONDARY, Card, INPUT, ON_GREEN, Pick } from "@/components/script/ui"
import { scenario, type ProjectPatch, type ScenarioProject } from "@/lib/api"
import { plural } from "@/lib/format"
import { cn } from "@/lib/utils"

const RUNNING = new Set(["queued", "running", "waiting_limit"])
const BRIEFING = new Set(["brief_queued", "brief_running"])

function usePatch(p: ScenarioProject) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: ProjectPatch) => scenario.patchProject(p.id, body),
    onSuccess: (data) => {
      qc.setQueryData(skeys.project(p.id), data)
      qc.invalidateQueries({ queryKey: skeys.projects })
    },
    onError: (e) => toast.error(e.message),
  })
}

export function ProjectView({ project: p }: { project: ScenarioProject }) {
  const qc = useQueryClient()
  const [answers, setAnswers] = useState<Record<string, string>>(p.answers)
  const [fullBrief, setFullBrief] = useState<string | null>(null)
  const [del, setDel] = useState(false)
  const patch = usePatch(p)

  const refresh = (data: ScenarioProject) => {
    qc.setQueryData(skeys.project(p.id), data)
    qc.invalidateQueries({ queryKey: skeys.projects })
  }
  const act = useMutation({
    mutationFn: async (what: "brief" | "launch" | "stop" | "resume") => {
      if (what === "brief") {
        const changed = JSON.stringify(answers) !== JSON.stringify(p.answers)
        if (changed) await scenario.patchProject(p.id, { answers })
        return scenario.brief(p.id)
      }
      return scenario[what](p.id)
    },
    onSuccess: (data, what) => {
      refresh(data)
      if (what === "brief") setAnswers({})
    },
    onError: (e) => toast.error(e.message),
  })

  const answered = Object.values(answers).filter((x) => x.trim()).length
  const briefing = BRIEFING.has(p.status)
  const running = RUNNING.has(p.status)
  const done = p.status === "done"
  const canResume = p.status === "stopped" || p.status === "error" || p.status === "paused"
  const docx = p.job?.files.find((f) => f.name.endsWith(".docx"))
  const txt = p.job?.files.find((f) => f.name.endsWith(".txt"))

  const captions = {
    brief: p.brief ? `версия ${p.brief.version}` : briefing ? (p.task?.step || "в очереди").toLowerCase() : p.stages[0].state === "skipped" ? "без брифа" : "",
    plan: p.brief?.chapters.length ? `${p.brief.chapters.length} ${plural(p.brief.chapters.length, "глава", "главы", "глав")}` : "",
    chapters: running ? stepText(p) : "",
    done: done ? [docx && ".docx", txt && ".txt"].filter(Boolean).join(" · ") : "",
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-[4px] border border-line bg-surface px-5 py-4">
        <div className="min-w-0 flex-1">
          <StageSteps stages={p.stages} captions={captions} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {done ? (
            <>
              <SendButtons project={p} className="mr-1" />
              {txt && (
                <a href={scenario.fileUrl(p.id, txt.name)} download className={BTN_SECONDARY}>
                  <Download className="size-3.5" />
                  .txt
                </a>
              )}
              {docx && (
                <a href={scenario.fileUrl(p.id, docx.name)} download className="flex h-10 items-center gap-2 rounded-[3px] bg-inverse px-4 text-sm font-medium text-inverse-foreground hover:opacity-90">
                  <Download className="size-3.5" />
                  Скачать .docx
                </a>
              )}
            </>
          ) : briefing || running ? (
            <button type="button" disabled={act.isPending} onClick={() => act.mutate("stop")} className="flex h-10 items-center gap-2 rounded-[3px] border border-danger/40 bg-danger/10 px-4 text-sm font-medium text-danger hover:bg-danger/20">
              <Square className="size-3" />
              Стоп
            </button>
          ) : canResume && p.job ? (
            <button type="button" disabled={act.isPending} onClick={() => act.mutate("resume")} className={BTN_SECONDARY}>
              <RotateCcw className="size-3.5" />
              Продолжить
            </button>
          ) : (
            <>
              <button type="button" disabled={act.isPending} onClick={() => act.mutate("brief")} className={cn(BTN_SECONDARY, "disabled:opacity-50")}>
                {act.isPending && act.variables === "brief" ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
                {p.brief ? "Обновить бриф" : "Бриф и план"}
                {answered ? ` · ${answered}` : ""}
              </button>
              <button
                type="button"
                disabled={act.isPending || p.params.missing.length > 0}
                title={p.params.missing.length ? "Заполни показатели" : undefined}
                onClick={() => act.mutate("launch")}
                className={BTN_PRIMARY}
              >
                {act.isPending && act.variables === "launch" ? <Loader2 className="size-3.5 animate-spin" /> : <Play className="size-3.5" />}
                Писать сценарий
              </button>
            </>
          )}
          <button type="button" title="Удалить проект" onClick={() => setDel(true)} className="grid size-10 place-items-center rounded-[3px] border border-line-strong text-faint hover:border-danger/40 hover:bg-danger/10 hover:text-danger">
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </div>

      {(p.status === "error" || p.status === "brief_error") && (
        <div className="flex items-start gap-2.5 rounded-[4px] border border-danger/40 bg-danger/10 px-4 py-3 text-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger" />
          <span className="text-foreground-2">{p.job?.error || p.task?.error}</span>
        </div>
      )}

      {done ? (
        <DoneLayout p={p} />
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          <div className="space-y-5 lg:col-span-7">
            {p.brief ? (
              <>
                <Card
                  title="Бриф"
                  aside={
                    p.brief.full && (
                      <button type="button" onClick={() => setFullBrief(p.brief!.full)} className="text-xs text-faint hover:text-foreground">
                        полностью
                      </button>
                    )
                  }
                >
                  <p className="text-sm leading-relaxed whitespace-pre-line text-foreground-2">{p.brief.short || p.brief.full}</p>
                </Card>
                <Plan p={p} />
                {p.brief.questions.length > 0 && !running && (
                  <Card title="Вопросы" aside={<span className="font-mono text-[11px] text-faint">{answered} из {p.brief.questions.length}</span>}>
                    <ol className="space-y-4">
                      {p.brief.questions.map((q, i) => (
                        <li key={i}>
                          <p className="mb-1.5 text-sm">
                            <span className="mr-1.5 font-mono text-[12px] text-faint">{i + 1}.</span>
                            {q}
                          </p>
                          <textarea
                            rows={1}
                            value={answers[String(i)] ?? ""}
                            onChange={(e) => setAnswers((a) => ({ ...a, [String(i)]: e.target.value }))}
                            onBlur={() => {
                              if (JSON.stringify(answers) !== JSON.stringify(p.answers)) patch.mutate({ answers })
                            }}
                            placeholder="Ответ"
                            className={cn(
                              "block w-full resize-y rounded-[3px] border bg-background px-3 py-2 text-sm outline-none placeholder:text-faint focus:border-electric/60",
                              answers[String(i)]?.trim() ? "border-pick/40" : "border-line-strong"
                            )}
                          />
                        </li>
                      ))}
                    </ol>
                  </Card>
                )}
                {p.brief.assumptions.length > 0 && (
                  <div className="rounded-[4px] border border-warn/30 bg-warn-soft/40 px-4 py-3">
                    <p className="mb-1.5 flex items-center gap-1.5 text-[13px] font-medium text-warn">
                      <AlertTriangle className="size-3.5" /> Додумано
                    </p>
                    <ul className="space-y-1 text-[13px] text-foreground-2">
                      {p.brief.assumptions.map((a) => (
                        <li key={a}>· {a}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            ) : briefing ? (
              <Card title="Бриф">
                <div className="space-y-2">
                  <div className="shimmer h-3 w-11/12 rounded-[2px]" />
                  <div className="shimmer h-3 w-10/12 rounded-[2px]" />
                  <div className="shimmer h-3 w-7/12 rounded-[2px]" />
                </div>
              </Card>
            ) : (
              <div className="rounded-[4px] border border-dashed border-line-strong p-8 text-center text-sm text-faint">
                {p.stages[0].state === "skipped" ? "Без брифа — план составит модель" : "Брифа нет"}
              </div>
            )}
          </div>
          <div className="space-y-5 lg:col-span-5">
            <Params p={p} locked={running || briefing} />
            <Materials p={p} locked={running || briefing} />
            {(running || briefing || p.status === "error" || p.status === "brief_error" || p.status === "stopped") && <Log id={p.id} />}
          </div>
        </div>
      )}

      <TextDialog title="Бриф" text={fullBrief} onClose={() => setFullBrief(null)} />
      <ConfirmDialog
        open={del}
        title={`Удалить «${p.title || "проект"}»?`}
        text={running ? "Сценарий в работе — сначала останови его." : "Проект пропадёт из списка. Готовые файлы останутся на сервере в папке запуска."}
        onClose={() => setDel(false)}
        onConfirm={async () => {
          await scenario.deleteProject(p.id)
          qc.invalidateQueries({ queryKey: skeys.projects })
          setUrlParams({ p: null })
        }}
      />
    </div>
  )
}

function Plan({ p }: { p: ScenarioProject }) {
  const ch = p.brief?.chapters ?? []
  if (!ch.length) return null
  const total = ch.reduce((a, c) => a + c.chars, 0)
  return (
    <Card title={`План · ${ch.length} ${plural(ch.length, "глава", "главы", "глав")}`} aside={<span className="font-mono text-[11px] text-faint">{num(total)} симв.</span>} bodyClass="p-0">
      <ol>
        {ch.map((c, i) => (
          <li key={i} className="grid grid-cols-[28px_minmax(0,1fr)_auto] gap-x-3 border-b border-line px-4 py-2.5 last:border-b-0">
            <span className="pt-px font-mono text-[12px] text-faint">{i + 1}.</span>
            <span className="min-w-0">
              <span className="block text-sm font-medium">{c.title}</span>
              {c.summary && <span className="block text-[13px] text-muted-foreground">{c.summary}</span>}
            </span>
            <span className="pt-px font-mono text-[11px] text-faint">~{num(c.chars)}</span>
          </li>
        ))}
      </ol>
    </Card>
  )
}

/* ------------------------------------------------------------------ key settings with their source */

type ParamKey = "length" | "tone" | "language" | "niche" | "model"

function Params({ p, locked }: { p: ScenarioProject; locked: boolean }) {
  const { data: options } = useScenarioOptions()
  const patch = usePatch(p)
  const [edit, setEdit] = useState<ParamKey | null>(null)
  const [draft, setDraft] = useState("")
  const r = p.params
  const manual = p.manual as Record<string, unknown>
  const isManual: Record<ParamKey, boolean> = {
    length: manual.target_chars != null || manual.duration_minutes != null,
    tone: manual.tone != null,
    language: manual.language != null,
    niche: false,
    model: false,
  }
  const rows: { key: ParamKey; label: string; value: string; source: string; missing?: boolean }[] = [
    { key: "length", label: "Длительность", value: r.length.value.chars ? lengthText(p) : "", source: [r.length.source_label, r.length.value.chars ? `темп ${num(r.pace.value)} симв/мин` : ""].filter(Boolean).join(" · "), missing: r.missing.includes("length") },
    { key: "tone", label: "Тон", value: r.tone.value ?? "", source: r.tone.source_label, missing: r.missing.includes("tone") },
    { key: "language", label: "Язык", value: r.language_name || (r.language.value ?? "").toUpperCase(), source: r.language.source_label, missing: r.missing.includes("language") },
    { key: "niche", label: "Ниша", value: p.niche_name || "без ниши", source: "" },
    { key: "model", label: "Модель", value: p.model_label || "по этапам", source: p.model ? "на все этапы" : "" },
  ]
  const save = (body: ProjectPatch) => patch.mutate(body, { onSuccess: () => setEdit(null) })
  const open = (k: ParamKey) => {
    setEdit(k)
    setDraft(k === "tone" ? (r.tone.value ?? "") : k === "length" && r.length.value.chars ? `${Math.round(r.length.value.minutes)} мин` : "")
  }

  return (
    <Card title="Показатели" bodyClass="p-0">
      {rows.map((row) => (
        <div key={row.key} className="group border-b border-line px-4 py-2.5 last:border-b-0">
          <div className="grid grid-cols-[110px_minmax(0,1fr)_auto] items-center gap-3">
            <span className="text-[13px] text-muted-foreground">{row.label}</span>
            <span className="min-w-0">
              {row.missing ? (
                <span className="block text-sm text-warn">не задано</span>
              ) : (
                <span className={cn("block truncate text-sm", isManual[row.key] && "text-pick-text")}>{row.value}</span>
              )}
              {row.source && <span className="block truncate font-mono text-[11px] text-faint">{row.source}</span>}
            </span>
            {!locked && (
              <span className="flex items-center">
                {isManual[row.key] && (
                  <button type="button" title="Вернуть автоматическое" onClick={() => save({ manual: { [row.key]: null } })} className="grid size-7 place-items-center rounded-[3px] text-faint hover:bg-elev hover:text-foreground">
                    <Undo2 className="size-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  title="Изменить"
                  onClick={() => (edit === row.key ? setEdit(null) : open(row.key))}
                  className={cn("grid size-7 place-items-center rounded-[3px] text-faint hover:bg-elev hover:text-foreground", edit !== row.key && !row.missing && "opacity-0 group-hover:opacity-100")}
                >
                  {edit === row.key ? <X className="size-3.5" /> : <Pencil className="size-3.5" />}
                </button>
              </span>
            )}
          </div>
          {edit === row.key && (
            <div className="mt-2.5">
              {row.key === "language" ? (
                <div className="grid grid-cols-5 gap-[3px] rounded-[3px] bg-surface-2 p-[3px]">
                  {(options?.languages ?? []).map((l) => (
                    <button
                      key={l.code}
                      type="button"
                      onClick={() => save({ manual: { language: l.code } })}
                      className={cn("rounded-[2px] py-1.5 font-mono text-[12px] uppercase", r.language.value === l.code ? ON_GREEN : "text-faint hover:text-foreground-2")}
                    >
                      {l.code}
                    </button>
                  ))}
                </div>
              ) : row.key === "niche" ? (
                <Pick
                  value={p.niche}
                  onChange={(v) => save({ niche: v })}
                  options={(options?.niches ?? []).map((n) => ({ value: n.slug, label: n.name }))}
                />
              ) : row.key === "model" ? (
                <Pick
                  value={p.model}
                  onChange={(v) => save({ model: v })}
                  options={[{ value: "", label: "По этапам" }, ...(options?.models ?? []).map((m) => ({ value: m.value, label: m.label.replace(/ \(Medium\)$/, ""), hint: m.backend_label }))]}
                />
              ) : (
                <form
                  className="flex gap-2"
                  onSubmit={(e) => {
                    e.preventDefault()
                    if (draft.trim()) save({ manual: { [row.key]: draft.trim() } })
                  }}
                >
                  <input
                    autoFocus
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    list={row.key === "tone" ? "scenario-tones" : undefined}
                    placeholder={row.key === "length" ? "25 мин или 20000" : "спокойный, уважительный"}
                    className={cn(INPUT, "h-9", row.key === "length" && "font-mono")}
                  />
                  <button type="submit" disabled={patch.isPending} className="grid size-9 shrink-0 place-items-center rounded-[3px] bg-electric text-white disabled:opacity-50">
                    {patch.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-4" />}
                  </button>
                  <datalist id="scenario-tones">
                    {(options?.tones ?? []).map((t) => (
                      <option key={t.value} value={t.label} />
                    ))}
                  </datalist>
                </form>
              )}
            </div>
          )}
        </div>
      ))}
    </Card>
  )
}

/* ------------------------------------------------------------------ materials */

function Materials({ p, locked }: { p: ScenarioProject; locked: boolean }) {
  const patch = usePatch(p)
  const [text, setText] = useState("")
  const [analysis, setAnalysis] = useState<{ title: string; text: string } | null>(null)
  const done = new Set(p.references.map((v) => v.id))
  const pending = p.ref_urls.filter((u) => ![...done].some((id) => u.includes(id)))
  return (
    <Card title="Материалы" aside={<span className="font-mono text-[11px] text-faint">{p.materials.length} · ролики {p.ref_urls.length}</span>}>
      <div className="space-y-2">
        {p.materials.map((m) => (
          <div key={m.id} className="group flex gap-2.5 rounded-[3px] bg-surface-2 px-3 py-2">
            {m.kind === "file" ? <Paperclip className="mt-0.5 size-3.5 shrink-0 text-faint" /> : <FileText className="mt-0.5 size-3.5 shrink-0 text-faint" />}
            <span className="min-w-0 flex-1 text-[13px] text-foreground-2">
              {(m.name || m.kind === "answers") && <span className="block font-mono text-[11px] text-muted-foreground">{m.name || "ответы на вопросы"}</span>}
              <span className="line-clamp-3 whitespace-pre-line">{m.text}</span>
            </span>
            {!locked && (
              <button type="button" title="Убрать" onClick={() => patch.mutate({ remove_material: m.id })} className="self-start text-faint opacity-0 group-hover:opacity-100 hover:text-danger">
                <X className="size-3.5" />
              </button>
            )}
          </div>
        ))}
        {p.references.map((v) => (
          <button key={v.id} type="button" onClick={() => setAnalysis({ title: v.title, text: v.analysis })} className="flex w-full gap-2.5 rounded-[3px] bg-surface-2 px-3 py-2 text-left hover:bg-elev">
            <Film className="mt-0.5 size-3.5 shrink-0 text-faint" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px]">{v.title}</span>
              <span className="block truncate font-mono text-[11px] text-faint">{[v.channel, v.pace].filter(Boolean).join(" · ")}</span>
            </span>
          </button>
        ))}
        {pending.map((u) => (
          <div key={u} className="group flex items-center gap-2.5 rounded-[3px] border border-dashed border-line-strong px-3 py-2">
            <Link2 className="size-3.5 shrink-0 text-faint" />
            <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-muted-foreground">{u}</span>
            {!locked && (
              <button type="button" title="Убрать" onClick={() => patch.mutate({ remove_url: u })} className="text-faint opacity-0 group-hover:opacity-100 hover:text-danger">
                <X className="size-3.5" />
              </button>
            )}
          </div>
        ))}
      </div>
      {!locked && (
        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (text.trim()) patch.mutate({ material: text }, { onSuccess: () => setText("") })
          }}
        >
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Текст или ссылка на ролик" className={cn(INPUT, "h-9")} />
          <AttachButton label="" className="grid size-9 shrink-0 place-items-center rounded-[3px] border border-line-strong px-0" onText={(f) => patch.mutate({ files: [f] })} />
          <button type="submit" disabled={!text.trim() || patch.isPending} className="grid size-9 shrink-0 place-items-center rounded-[3px] bg-electric text-white disabled:opacity-40">
            {patch.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-4" />}
          </button>
        </form>
      )}
      <TextDialog title={analysis?.title ?? ""} text={analysis?.text ?? null} onClose={() => setAnalysis(null)} />
    </Card>
  )
}

function Log({ id }: { id: string }) {
  const { data } = useScenarioLog(id)
  const items = (data ?? []).filter((e) => e.message).slice(-12)
  if (!items.length) return null
  return (
    <Card title="Журнал" bodyClass="p-0">
      <ol className="max-h-72 overflow-y-auto py-1">
        {items.map((e, i) => (
          <li key={i} className={cn("grid grid-cols-[44px_minmax(0,1fr)] gap-2 px-4 py-1 text-[12px]", (e.kind === "failed" || e.kind === "error") && "text-danger")}>
            <span className="font-mono text-[11px] text-faint">{e.ts.slice(11, 16)}</span>
            <span className="text-foreground-2">{e.message.split("\n")[0]}</span>
          </li>
        ))}
      </ol>
    </Card>
  )
}

/* ------------------------------------------------------------------ finished script */

function DoneLayout({ p }: { p: ScenarioProject }) {
  const { data: script, isLoading } = useScenarioScript(p.id, true)
  const chars = script?.chapters.reduce((a, c) => a + c.paragraphs.reduce((b, x) => b + x.text.length, 0), 0) ?? 0
  const paras = script?.chapters.reduce((a, c) => a + c.paragraphs.length, 0) ?? 0
  const target = p.params.length.value.chars
  const sec = p.job?.run_sec ?? 0
  const facts: [string, string][] = [
    ["Объём", chars ? `${num(chars)} симв. · ${minutes(chars / (p.params.pace.value || 1000))}` : "—"],
    ["Цель", target ? `${num(target)} симв.${chars ? ` · ${Math.round((chars / target) * 100)}%` : ""}` : "—"],
    ["Модель", p.job?.model || p.model_label || "по этапам"],
    ["Расход", p.job?.usage || "—"],
    ["Время", sec ? (sec >= 60 ? `${Math.round(sec / 60)} мин` : `${sec} с`) : "—"],
  ]
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
      <Card
        title="Сценарий"
        aside={script && <span className="font-mono text-[11px] text-faint">{script.chapters.length} {plural(script.chapters.length, "глава", "главы", "глав")} · {paras} абз.</span>}
        className="lg:col-span-8"
        bodyClass="p-0"
      >
        {isLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="size-4 animate-spin text-faint" />
          </div>
        ) : (
          script?.chapters.map((ch) => (
            <div key={ch.number} className="border-b border-line px-5 py-4 last:border-b-0">
              <h3 className="mb-2.5 text-sm font-semibold">
                <span className="mr-2 font-mono text-[12px] font-normal text-faint">{ch.number}</span>
                {ch.title}
              </h3>
              <ol className="space-y-2">
                {ch.paragraphs.map((x) => (
                  <li key={x.n} className="grid grid-cols-[32px_minmax(0,1fr)] text-sm leading-relaxed text-foreground-2">
                    <span className="font-mono text-[11px] leading-6 text-faint">{x.n}</span>
                    {x.text}
                  </li>
                ))}
              </ol>
            </div>
          ))
        )}
      </Card>
      <div className="space-y-5 lg:col-span-4">
        <Card title="Итог" bodyClass="p-0">
          {facts.map(([k, v]) => (
            <div key={k} className="grid grid-cols-[80px_minmax(0,1fr)] gap-3 border-b border-line px-4 py-2.5 last:border-b-0">
              <span className="text-[13px] text-muted-foreground">{k}</span>
              <span className="font-mono text-[12px] break-words">{v}</span>
            </div>
          ))}
        </Card>
        {p.brief && <Plan p={p} />}
      </div>
    </div>
  )
}
