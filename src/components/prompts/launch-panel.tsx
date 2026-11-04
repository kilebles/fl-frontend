"use client"

import { useEffect, useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { FileText, Loader2, Paperclip, Sparkles, X } from "lucide-react"
import { toast } from "sonner"

import { MODE_NAME, parasWord, scenesWord } from "@/components/prompts/parts"
import { pkeys, setUrlParams, usePgNiches, usePgOptions, usePgScripts } from "@/components/prompts/queries"
import { BTN_PRIMARY, INPUT, Label, Pick, Seg } from "@/components/script/ui"
import { promptgen, type PgBase, type PgMode, type PgNiche, type PgTemplateInfo } from "@/lib/api"
import { plural } from "@/lib/format"
import { clearHandoff, peekHandoff } from "@/lib/handoff"
import { useCurrentProject } from "@/lib/project"
import { cn } from "@/lib/utils"

const REMEMBER = "prompts.launch"
type Remembered = { niche?: string; model?: string; avatar?: boolean; pairs?: number }

function loadRemembered(): Remembered {
  try {
    return JSON.parse(localStorage.getItem(REMEMBER) || "{}")
  } catch {
    return {}
  }
}

function templateState(t: PgTemplateInfo | null | undefined): "ready" | "busy" | "error" | "none" {
  if (!t) return "none"
  if (t.status === "ready") return "ready"
  if (t.status === "error") return "error"
  return "busy"
}

export function nicheHint(n: PgNiche) {
  const mark = (t: PgTemplateInfo | null) => (templateState(t) === "ready" ? "✓" : templateState(t) === "busy" ? "…" : "—")
  return `обычный ${mark(n.templates.regular)} · аватар ${mark(n.templates.avatar)}`
}

type Script = { source: "project"; id: string; title: string } | { source: "file"; name: string; paragraphs: string[] }

/** Toggle that reads as a checkbox (the avatar switch). */
function Check({ on, onChange, children, title }: { on: boolean; onChange: (v: boolean) => void; children: React.ReactNode; title?: string }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={on}
      title={title}
      onClick={() => onChange(!on)}
      className={cn(
        "flex h-10 w-full items-center gap-2.5 rounded-[3px] border px-3 text-sm transition-colors",
        on ? "border-pick/40 bg-pick-soft font-medium text-pick-text" : "border-line-strong bg-background text-foreground-2 hover:border-electric/40"
      )}
    >
      <span className={cn("grid size-4 shrink-0 place-items-center rounded-[2px] border", on ? "border-pick bg-pick text-white" : "border-line-strong")}>
        {on && <svg viewBox="0 0 12 12" className="size-3"><path d="M2.5 6.2l2.3 2.3 4.7-5" fill="none" stroke="currentColor" strokeWidth="1.8" /></svg>}
      </span>
      {children}
    </button>
  )
}

export function LaunchPanel() {
  const qc = useQueryClient()
  const [projectId] = useCurrentProject()
  const { data: options } = usePgOptions()
  const { data: nicheData } = usePgNiches()
  const [title, setTitle] = useState("")
  const [niche, setNiche] = useState("")
  const [model, setModel] = useState("")
  const [avatar, setAvatar] = useState(false)
  const [pairs, setPairs] = useState(8)
  const [base, setBase] = useState<PgBase | null>(null)
  const [source, setSource] = useState<"project" | "file">("project")
  const [script, setScript] = useState<Script | null>(null)
  const [uploading, setUploading] = useState(false)
  const [notes, setNotes] = useState("")
  const [review, setReview] = useState(false)
  const { data: scripts, error: scriptsError } = usePgScripts(niche)

  // remembered choices, or the script handed over from «Сценарий»
  useEffect(() => {
    const r = loadRemembered()
    const h = peekHandoff("prompts")
    const t = setTimeout(() => {
      if (r.model) setModel(r.model)
      if (r.avatar) setAvatar(true)
      if (r.pairs) setPairs(r.pairs)
      if (h) {
        setNiche(h.niche ?? "")
        setSource("project")
        setScript({ source: "project", id: h.scriptId, title: h.title ?? "" })
        if (h.title) setTitle(h.title)
      } else if (r.niche) setNiche(r.niche)
    }, 0)
    return () => clearTimeout(t)
  }, [])
  const remember = (patch: Remembered) => {
    try {
      localStorage.setItem(REMEMBER, JSON.stringify({ ...loadRemembered(), ...patch }))
    } catch {}
  }

  const mode: PgMode = avatar ? "avatar" : "regular"
  const n = nicheData?.niches.find((x) => x.slug === niche)
  const tpl = n?.templates[mode]
  const tstate = templateState(tpl)
  const effBase: PgBase = base ?? (tstate === "ready" ? "template" : "passport")
  const shots = effBase === "template" && tstate === "ready" ? (tpl?.shots.length ?? 16) : avatar ? 2 : 16
  const counts = (options?.pair_counts ?? [2, 4, 6, 8, 12, 16]).filter((c) => c <= shots)
  if (shots && !counts.includes(shots)) counts.push(shots)
  counts.sort((a, b) => a - b)
  const effPairs = avatar ? shots : counts.includes(pairs) ? pairs : (counts.filter((c) => c <= pairs).pop() ?? counts[0])
  const count = script?.source === "file" ? script.paragraphs.length : null

  const models = (options?.backends ?? []).filter((b) => b.enabled && b.id !== "fake").flatMap((b) =>
    b.models.map((m) => ({ value: `${b.id}:${m.id}`, label: m.label.replace(/ \(Medium\)$/, ""), hint: b.id === "antigravity" ? "agy" : "Claude Code" }))
  )

  const problem =
    !script ? "Выберите сценарий" : effBase === "template" && tstate !== "ready" ? `У ниши нет готового шаблона «${MODE_NAME[mode]}»` : null

  const create = useMutation({
    mutationFn: () =>
      promptgen.create({
        title: title.trim() || undefined,
        niche,
        mode,
        base: effBase,
        pairs: effPairs,
        notes: notes.trim(),
        model,
        review_brief: review,
        project_id: projectId,
        script: script!.source === "project" ? { source: "project", id: script!.id } : { source: "file", name: script!.name, paragraphs: script!.paragraphs },
      }),
    onSuccess: () => {
      clearHandoff()
      qc.invalidateQueries({ queryKey: pkeys.projectsAll })
      setTitle("")
      setNotes("")
      setScript(null)
    },
    onError: (e) => toast.error(e.message),
  })

  const upload = async (file: File) => {
    setUploading(true)
    try {
      const r = await promptgen.scriptFile(file)
      setScript({ source: "file", name: r.name, paragraphs: r.paragraphs })
      if (!title.trim()) setTitle(r.name.replace(/\.(docx|txt|md)$/i, ""))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Не удалось прочитать файл")
    } finally {
      setUploading(false)
    }
  }

  const scriptOptions = (scripts ?? []).map((s) => ({ value: s.id, label: s.title || "Без названия", hint: [s.niche_name, s.language?.toUpperCase()].filter(Boolean).join(" · ") }))
  if (script?.source === "project" && !scriptOptions.some((o) => o.value === script.id))
    scriptOptions.unshift({ value: script.id, label: script.title || "Сценарий из «Сценария»", hint: "передан" })

  const meta = [
    count !== null ? `${count} ${parasWord(count)}` : "",
    `${effPairs} ${avatar ? scenesWord(effPairs) : plural(effPairs, "пара", "пары", "пар")} на абзац`,
    count !== null ? `≈ ${count * effPairs} ${scenesWord(count * effPairs)}` : "",
    effBase === "template" ? `шаблон: ${tpl?.name ?? "—"}` : "паспорт ниши + встроенный шаблон",
  ].filter(Boolean)

  return (
    <section className="mb-6 rounded-[4px] border border-line bg-surface">
      <div className="grid grid-cols-1 gap-x-5 gap-y-5 p-5 md:grid-cols-2 xl:grid-cols-12">
        <div className="xl:col-span-4">
          <Label>Название</Label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Victorian 283" className={INPUT} />
        </div>
        <div className="xl:col-span-3">
          <Label
            aside={
              <button type="button" onClick={() => setUrlParams({ tab: "templates", p: null })} className="text-xs text-faint hover:text-foreground">
                шаблоны →
              </button>
            }
          >
            Ниша
          </Label>
          <Pick
            value={niche}
            onChange={(v) => {
              setNiche(v)
              setBase(null)
              if (script?.source === "project") setScript(null)
              remember({ niche: v })
            }}
            placeholder="Без ниши"
            options={[...(nicheData?.niches ?? []).map((x) => ({ value: x.slug, label: x.name, hint: nicheHint(x) })), { value: "", label: "Без ниши" }]}
          />
        </div>
        <div className="xl:col-span-3">
          <Label>Модель</Label>
          <Pick
            value={model}
            onChange={(v) => {
              setModel(v)
              remember({ model: v })
            }}
            placeholder="По этапам"
            options={[{ value: "", label: "По этапам", hint: "настройки" }, ...models]}
          />
        </div>
        <div className="md:col-span-2 xl:col-span-2">
          <Label>Режим</Label>
          <Check
            on={avatar}
            onChange={(v) => {
              setAvatar(v)
              setBase(null)
              remember({ avatar: v })
            }}
            title="Ведущий с референсов: 2 сцены на абзац, Аватар → видео"
          >
            Аватар
          </Check>
        </div>

        <div className="md:col-span-2 xl:col-span-6">
          <Label
            aside={
              <div className="flex text-xs">
                {(
                  [
                    ["project", "из «Сценария»"],
                    ["file", "файл"],
                  ] as const
                ).map(([k, label]) => (
                  <button key={k} type="button" onClick={() => setSource(k)} className={cn("px-1.5", source === k ? "text-pick-text" : "text-faint hover:text-foreground")}>
                    {label}
                  </button>
                ))}
              </div>
            }
          >
            Сценарий
          </Label>
          {source === "project" ? (
            <Pick
              value={script?.source === "project" ? script.id : ""}
              onChange={(v) => {
                const s = scripts?.find((x) => x.id === v)
                setScript({ source: "project", id: v, title: s?.title ?? "" })
                if (!title.trim() && s?.title) setTitle(s.title)
              }}
              placeholder={scriptsError ? "«Сценарий» недоступен — загрузите файл" : scripts && !scripts.length ? "Готовых сценариев нет" : "Готовый сценарий"}
              options={scriptOptions}
            />
          ) : script?.source === "file" ? (
            <div className="flex h-10 items-center gap-2 rounded-[3px] border border-pick/40 bg-background px-3 text-sm">
              <FileText className="size-4 shrink-0 text-pick-text" />
              <span className="min-w-0 flex-1 truncate text-pick-text">{script.name}</span>
              <span className="shrink-0 font-mono text-[11px] text-faint">
                {script.paragraphs.length} {parasWord(script.paragraphs.length)}
              </span>
              <button type="button" onClick={() => setScript(null)} className="text-faint hover:text-danger">
                <X className="size-3.5" />
              </button>
            </div>
          ) : (
            <label className="flex h-10 cursor-pointer items-center gap-2 rounded-[3px] border border-dashed border-line-strong bg-background px-3 text-sm text-muted-foreground hover:border-electric/50 hover:text-foreground">
              {uploading ? <Loader2 className="size-4 animate-spin" /> : <Paperclip className="size-4" />}
              .docx · .txt · .md
              <input
                type="file"
                accept=".docx,.txt,.md"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) void upload(f)
                  e.target.value = ""
                }}
              />
            </label>
          )}
        </div>
        <div className="xl:col-span-3">
          <Label>База брифа</Label>
          <Seg
            value={effBase}
            onChange={(v) => setBase(v as PgBase)}
            options={[
              ["template", "Шаблон ниши", tpl ? tpl.name : "у ниши нет шаблона"],
              ["passport", "Паспорт ниши", "паспорт + встроенный шаблон"],
            ]}
          />
        </div>
        <div className="xl:col-span-3">
          <Label>{avatar ? "Сцен на абзац" : "Пар на абзац"}</Label>
          {avatar ? (
            <div className="flex h-10 items-center rounded-[3px] bg-surface-2 px-3 font-mono text-[13px] text-faint">{shots} · по шаблону</div>
          ) : (
            <Seg
              mono
              value={String(effPairs)}
              onChange={(v) => {
                setPairs(Number(v))
                remember({ pairs: Number(v) })
              }}
              options={counts.map((c) => [String(c), String(c)] as const)}
            />
          )}
        </div>

        <div className="md:col-span-2 xl:col-span-12">
          <Label>Дополнительно</Label>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Что важно именно в этом ролике: обязательно показать, чего избегать, уточнения по эпохе, одежде, персонажам"
            className="block w-full resize-y rounded-[3px] border border-line-strong bg-background p-3 text-sm leading-relaxed outline-none placeholder:text-faint focus:border-electric/60"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-3">
        <span className={cn("min-w-0 truncate font-mono text-[11px]", problem && script ? "text-warn" : "text-muted-foreground")}>
          {problem && script ? problem : meta.join(" · ")}
        </span>
        <div className="flex items-center gap-4">
          <label className="flex cursor-pointer items-center gap-2 text-[13px] text-muted-foreground select-none hover:text-foreground">
            <input type="checkbox" checked={review} onChange={(e) => setReview(e.target.checked)} className="size-3.5 accent-[var(--pick)]" />
            Сначала проверить бриф
          </label>
          <button type="button" disabled={!!problem || create.isPending} onClick={() => create.mutate()} className={BTN_PRIMARY} title={problem ?? undefined}>
            {create.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
            {review ? "Бриф" : "Сгенерировать"}
          </button>
        </div>
      </div>
    </section>
  )
}
