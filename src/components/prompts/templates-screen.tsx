"use client"

import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { AlertTriangle, Eye, Loader2, RefreshCw, Trash2, Upload } from "lucide-react"
import { toast } from "sonner"

import { pkeys, usePgBuiltin, usePgNiches, usePgTemplate } from "@/components/prompts/queries"
import { Seg } from "@/components/script/ui"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { promptgen, type PgAnalysis, type PgMode, type PgNiche, type PgTemplateInfo } from "@/lib/api"
import { cn } from "@/lib/utils"

const KIND_LABEL: Record<PgMode, string> = { regular: "Обычный", avatar: "Аватар" }

function StatusChip({ t }: { t: PgTemplateInfo | null }) {
  if (!t) return <span className="font-mono text-[11px] text-faint">нет</span>
  if (t.status === "ready") return <span className="font-mono text-[11px] text-ok">готов</span>
  if (t.status === "error") return <span className="font-mono text-[11px] text-danger">ошибка</span>
  return (
    <span className="flex items-center gap-1 font-mono text-[11px] text-pick-text">
      <Loader2 className="size-3 animate-spin" /> разбирается
    </span>
  )
}

function Slot({ niche, kind, t, onOpen }: { niche: string; kind: PgMode; t: PgTemplateInfo | null; onOpen: () => void }) {
  const qc = useQueryClient()
  const done = () => qc.invalidateQueries({ queryKey: pkeys.niches })
  const upload = useMutation({ mutationFn: (f: File) => promptgen.uploadTemplate(niche, kind, f), onSuccess: done, onError: (e) => toast.error(e.message) })
  const again = useMutation({ mutationFn: () => promptgen.reanalyze(niche, kind), onSuccess: done, onError: (e) => toast.error(e.message) })
  const remove = useMutation({ mutationFn: () => promptgen.removeTemplate(niche, kind), onSuccess: done, onError: (e) => toast.error(e.message) })
  return (
    <div className="group flex min-w-0 flex-col gap-1.5 rounded-[3px] border border-line bg-background/40 px-3 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13px] font-medium">{KIND_LABEL[kind]}</span>
        <StatusChip t={t} />
      </div>
      {t ? (
        <>
          <button type="button" onClick={onOpen} className="min-w-0 truncate text-left text-[13px] text-pick-text hover:underline" title={t.name}>
            {t.name}
          </button>
          <div className="flex min-h-4 items-center gap-2 font-mono text-[11px] text-faint">
            {t.status === "ready" && <span>{t.shots.length} {kind === "avatar" ? "сцены" : "кадров"}</span>}
            {t.scene_limits.image ? <span>≤{t.scene_limits.image} симв.</span> : null}
            {t.warnings.length > 0 && (
              <span className="flex items-center gap-1 text-warn" title={t.warnings.join("\n")}>
                <AlertTriangle className="size-3" /> {t.warnings.length}
              </span>
            )}
            {t.status === "error" && <span className="truncate text-danger" title={t.error}>{t.error}</span>}
          </div>
        </>
      ) : (
        <span className="text-[13px] text-faint">шаблона нет — работает паспорт ниши</span>
      )}
      <div className="mt-1 flex items-center gap-1">
        <label className="flex h-7 cursor-pointer items-center gap-1 rounded-[3px] border border-line-strong bg-surface-2 px-2 text-[11px] font-medium hover:bg-elev">
          {upload.isPending ? <Loader2 className="size-3 animate-spin" /> : <Upload className="size-3" />}
          {t ? "Заменить" : "Загрузить"}
          <input
            type="file"
            accept=".txt,.md,.docx"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) upload.mutate(f)
              e.target.value = ""
            }}
          />
        </label>
        {t && (
          <>
            <button type="button" onClick={onOpen} title="Открыть" className="grid size-7 place-items-center rounded-[3px] text-muted-foreground hover:bg-elev hover:text-foreground">
              <Eye className="size-3.5" />
            </button>
            <button type="button" onClick={() => again.mutate()} title="Разобрать заново" className="grid size-7 place-items-center rounded-[3px] text-muted-foreground hover:bg-elev hover:text-foreground">
              <RefreshCw className={cn("size-3.5", again.isPending && "animate-spin")} />
            </button>
            <button
              type="button"
              onClick={() => confirm(`Удалить шаблон «${KIND_LABEL[kind]}»?`) && remove.mutate()}
              title="Удалить"
              className="ml-auto grid size-7 place-items-center rounded-[3px] text-faint opacity-0 transition group-hover:opacity-100 hover:bg-danger/15 hover:text-danger"
            >
              <Trash2 className="size-3.5" />
            </button>
          </>
        )}
      </div>
    </div>
  )
}

function Blocks({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null
  return (
    <div>
      <p className="mb-1.5 text-[11px] text-faint">{title}</p>
      <div className="flex flex-col gap-1.5">
        {items.map((x, i) => (
          <p key={i} className="rounded-[3px] bg-surface-2 px-3 py-2 font-mono text-[12px] leading-relaxed text-foreground-2">
            {x}
          </p>
        ))}
      </div>
    </div>
  )
}

function Analysis({ a, warnings }: { a: PgAnalysis; warnings: string[] }) {
  return (
    <div className="flex flex-col gap-5">
      {warnings.length > 0 && (
        <div className="rounded-[3px] border border-warn/40 bg-warn-soft px-3 py-2.5">
          {warnings.map((w, i) => (
            <p key={i} className="text-[12px] leading-relaxed text-warn">
              {w}
            </p>
          ))}
        </div>
      )}
      <div className="grid grid-cols-2 gap-3 font-mono text-[12px] sm:grid-cols-4">
        {[
          ["сцен на абзац", String(a.shots.length) + (a.count_selectable ? " (можно меньше)" : "")],
          ["сцена картинки", a.scene_limits.image ? `≤ ${a.scene_limits.image}` : "без лимита"],
          ["сцена видео", a.scene_limits.video ? `≤ ${a.scene_limits.video}` : "без лимита"],
          ["реплики", a.spoken ? `≤ ${a.spoken.max_chars}, ${a.spoken.language}` : "нет"],
        ].map(([k, v]) => (
          <div key={k} className="rounded-[3px] border border-line px-3 py-2">
            <p className="text-[11px] text-faint">{k}</p>
            <p className="mt-0.5">{v}</p>
          </div>
        ))}
      </div>
      <div>
        <p className="mb-1.5 text-[11px] text-faint">Кадры</p>
        <div className="flex flex-col gap-1">
          {a.shots.map((s, i) => (
            <div key={i} className="flex gap-3 rounded-[3px] bg-surface-2 px-3 py-1.5 text-[13px]">
              <span className="w-5 shrink-0 font-mono text-[11px] text-faint">{i + 1}</span>
              <span className="min-w-0">
                <span className="font-medium">{s.title}</span>
                {s.description && <span className="text-muted-foreground"> — {s.description}</span>}
              </span>
            </div>
          ))}
        </div>
      </div>
      <Blocks title="Дописывается к каждой картинке дословно" items={a.image_fixed} />
      <Blocks title="Дописывается к каждому видео дословно" items={a.video_fixed} />
      <Blocks title={`Негативы (${a.negatives_target === "both" ? "картинка и видео" : a.negatives_target === "image" ? "картинка" : "видео"})`} items={a.negatives} />
    </div>
  )
}

function TemplateDialog({ open, onClose }: { open: { niche: string | null; kind: PgMode } | null; onClose: () => void }) {
  const [tab, setTab] = useState<"analysis" | "text">("analysis")
  const { data: own } = usePgTemplate(open?.niche ?? null, open?.kind ?? "regular")
  const { data: builtin } = usePgBuiltin(open?.kind ?? "regular", !!open && !open.niche)
  const data = open?.niche ? own : builtin
  const analysis = data?.analysis ?? null
  const warnings = open?.niche ? (own?.warnings ?? []) : []
  return (
    <Dialog open={open !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[88vh] gap-0 overflow-hidden rounded-[4px] border-line-strong bg-surface p-0 sm:max-w-4xl">
        <div className="flex items-center gap-3 border-b border-line p-4 pr-12">
          <DialogTitle className="min-w-0 flex-1 truncate text-base font-semibold">
            {data?.name ?? "…"} <span className="font-mono text-[12px] font-normal text-faint">· {open ? KIND_LABEL[open.kind].toLowerCase() : ""}</span>
          </DialogTitle>
          <div className="w-56">
            <Seg
              value={tab}
              onChange={(v) => setTab(v as typeof tab)}
              options={[
                ["analysis", "Разбор"],
                ["text", "Текст"],
              ]}
            />
          </div>
        </div>
        <div className="max-h-[calc(88vh-70px)] overflow-y-auto p-5">
          {!data ? (
            <div className="shimmer h-40 rounded-[4px]" />
          ) : tab === "text" ? (
            <pre className="font-mono text-[12px] leading-relaxed whitespace-pre-wrap text-foreground-2">{data.text}</pre>
          ) : analysis ? (
            <Analysis a={analysis} warnings={warnings} />
          ) : (
            <p className="text-sm text-faint">Шаблон ещё не разобран</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function NicheRow({ n, onOpen }: { n: PgNiche; onOpen: (kind: PgMode) => void }) {
  return (
    <div className="grid gap-3 border-b border-line px-4 py-3.5 last:border-b-0 md:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_minmax(0,1.3fr)]">
      <div className="min-w-0">
        <div className="truncate text-sm font-medium">{n.name}</div>
        <div className="mt-0.5 truncate font-mono text-[11px] text-faint">{n.has_passport ? "паспорт ниши есть" : "паспорта нет"}</div>
      </div>
      <Slot niche={n.slug} kind="regular" t={n.templates.regular} onOpen={() => onOpen("regular")} />
      <Slot niche={n.slug} kind="avatar" t={n.templates.avatar} onOpen={() => onOpen("avatar")} />
    </div>
  )
}

export function TemplatesScreen() {
  const { data, isLoading, error } = usePgNiches()
  const [open, setOpen] = useState<{ niche: string | null; kind: PgMode } | null>(null)
  return (
    <div className="flex flex-col gap-4">
      {data && !data.scenario_online && (
        <p className="rounded-[4px] border border-warn/40 bg-warn-soft px-4 py-2.5 text-[13px] text-warn">
          Вкладка «Сценарий» недоступна — показаны только ниши, у которых уже есть шаблоны. {data.error}
        </p>
      )}
      <div className="overflow-hidden rounded-[4px] border border-line bg-surface">
        {isLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="size-4 animate-spin text-faint" />
          </div>
        ) : error ? (
          <div className="py-10 text-center text-sm text-danger">{error.message}</div>
        ) : data?.niches.length ? (
          data.niches.map((n) => <NicheRow key={n.slug} n={n} onOpen={(kind) => setOpen({ niche: n.slug, kind })} />)
        ) : (
          <div className="py-10 text-center text-sm text-faint">Ниш нет — они создаются во вкладке «Сценарий»</div>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-3 font-mono text-[11px] text-faint">
        <span>Встроенные шаблоны для варианта «паспорт ниши»:</span>
        {(["regular", "avatar"] as const).map((k) => (
          <button key={k} type="button" onClick={() => setOpen({ niche: null, kind: k })} className="text-pick-text hover:underline">
            {KIND_LABEL[k].toLowerCase()}
          </button>
        ))}
      </div>
      <TemplateDialog open={open} onClose={() => setOpen(null)} />
    </div>
  )
}
