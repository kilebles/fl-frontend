"use client"

import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Check, Loader2, Pencil, Trash2 } from "lucide-react"
import { motion } from "motion/react"
import { toast } from "sonner"

import { Dropzone } from "@/components/create/dropzone"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { prompts, type PromptTemplate } from "@/lib/api"
import { plural } from "@/lib/format"
import { keys, useTemplate, useTemplates } from "@/lib/queries"

function Field({ label, value }: { label: string; value: string }) {
  if (!value) return null
  return (
    <div>
      <p className="mb-1 text-xs text-faint">{label}</p>
      <p className="text-sm leading-relaxed whitespace-pre-wrap">{value}</p>
    </div>
  )
}

function TemplateDialog({ id, onClose }: { id: string | null; onClose: () => void }) {
  const qc = useQueryClient()
  const { data } = useTemplate(id)
  const [editing, setEditing] = useState<string | null>(null)

  const rename = useMutation({
    mutationFn: (title: string) => prompts.renameTemplate(id!, title),
    onSuccess: (t) => {
      setEditing(null)
      qc.setQueryData(keys.template(t.id), t)
      qc.invalidateQueries({ queryKey: keys.templates })
    },
    onError: (e) => toast.error(e.message),
  })
  const remove = useMutation({
    mutationFn: () => prompts.removeTemplate(id!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.templates })
      onClose()
    },
    onError: (e) => toast.error(e.message),
  })

  const t = data?.data
  return (
    <Dialog open={id !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85vh] gap-0 overflow-hidden border-line-strong bg-surface p-0 sm:max-w-3xl">
        <div className="flex items-center gap-2 border-b border-line p-5 pr-12">
          {editing !== null ? (
            <form
              className="flex flex-1 gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                if (editing.trim()) rename.mutate(editing.trim())
              }}
            >
              <input autoFocus value={editing} onChange={(e) => setEditing(e.target.value)} className="h-9 flex-1 rounded-lg border border-line-strong bg-background/60 px-3 text-sm outline-none focus:border-electric/60" />
              <button type="submit" className="grid size-9 place-items-center rounded-lg bg-electric text-white">
                <Check className="size-4" />
              </button>
            </form>
          ) : (
            <>
              <DialogTitle className="truncate text-lg font-semibold">{data?.title ?? "…"}</DialogTitle>
              <button type="button" onClick={() => setEditing(data?.title ?? "")} className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-elev hover:text-foreground">
                <Pencil className="size-3.5" />
              </button>
            </>
          )}
        </div>
        <div className="flex max-h-[calc(85vh-140px)] flex-col gap-5 overflow-y-auto p-5">
          {!t ? (
            <div className="shimmer h-40 rounded-xl" />
          ) : (
            <>
              <Field label="Контекст" value={t.lore} />
              {t.sub_periods.length > 0 && (
                <Field label="Периоды" value={t.sub_periods.map((p) => `${p.title} — ${p.when}`).join("\n")} />
              )}
              <div>
                <p className="mb-2 text-xs text-faint">Кадры ({t.pairs.length})</p>
                <div className="flex flex-col gap-1.5">
                  {t.pairs.map((p) => (
                    <div key={p.number} className="flex gap-3 rounded-lg bg-surface-2 px-3 py-2 text-sm">
                      <span className="font-mono text-xs text-faint">{p.number}</span>
                      <span className="min-w-0">
                        <span className="font-medium">{p.title}</span>
                        {p.intent && <span className="text-muted-foreground"> — {p.intent}</span>}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <Field label="Палитра" value={t.color_palette} />
              <Field label="Свет" value={t.lighting} />
              <Field label="Фактуры" value={t.textures} />
              <Field label="Правила картинок" value={t.image_rules} />
              <Field label="Правила видео" value={t.video_rules} />
              <Field label="Суффикс картинок" value={t.deterministic.image_suffix} />
              <Field label="Суффикс видео" value={t.deterministic.video_suffix} />
              <Field label="Запрещено" value={t.deterministic.negatives} />
            </>
          )}
        </div>
        <div className="flex justify-end border-t border-line p-3">
          <button
            type="button"
            onClick={() => confirm("Удалить шаблон?") && remove.mutate()}
            className="inline-flex h-9 items-center gap-2 rounded-lg px-3 text-sm text-danger hover:bg-danger/10"
          >
            <Trash2 className="size-4" /> Удалить
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function TemplateCard({ template, onOpen }: { template: PromptTemplate; onOpen: () => void }) {
  return (
    <motion.button
      layout
      type="button"
      onClick={onOpen}
      className="flex flex-col gap-2 rounded-2xl border border-line bg-surface p-4 text-left transition-colors hover:border-line-strong hover:bg-surface-2"
    >
      <p className="line-clamp-2 font-semibold">{template.title}</p>
      <p className="text-[13px] text-muted-foreground">
        {template.pairs} {plural(template.pairs, "кадр", "кадра", "кадров")}
        {template.video_target && ` · ${template.video_target}`}
      </p>
    </motion.button>
  )
}

export function TemplatesPanel() {
  const qc = useQueryClient()
  const { data: templates, isLoading } = useTemplates()
  const [open, setOpen] = useState<string | null>(null)
  const [pending, setPending] = useState<string[]>([])

  const upload = async (files: File[]) => {
    setPending((p) => [...p, ...files.map((f) => f.name)])
    for (const file of files) {
      try {
        await prompts.createTemplate(file)
        qc.invalidateQueries({ queryKey: keys.templates })
      } catch (e) {
        toast.error(`${file.name}: ${(e as Error).message}`)
      } finally {
        setPending((p) => p.filter((name) => name !== file.name))
      }
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Dropzone accept=".txt,.docx" multiple title="Загрузить бриф" hint=".txt или .docx — шаблон извлекается за минуту" onFiles={upload} />
      {pending.map((name) => (
        <div key={name} className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-4 text-sm">
          <Loader2 className="size-4 animate-spin text-electric" /> {name}
        </div>
      ))}
      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="shimmer h-24 rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {templates?.map((t) => <TemplateCard key={t.id} template={t} onOpen={() => setOpen(t.id)} />)}
        </div>
      )}
      <TemplateDialog id={open} onClose={() => setOpen(null)} />
    </div>
  )
}
