"use client"

import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Check, Loader2, Plus, Settings2, Sparkles, Trash2, X } from "lucide-react"
import { toast } from "sonner"

import { AttachButton, ConfirmDialog, TextDialog, minutes } from "@/components/script/parts"
import { setUrlParams, skeys, useNiche, useNiches, useScenarioOptions, useUrlParam } from "@/components/script/queries"
import { BTN_SMALL, Card, INPUT, Label, ON_GREEN, Pick, Seg } from "@/components/script/ui"
import { scenario, type NicheDefaults, type ScenarioNicheDetail } from "@/lib/api"
import { cn } from "@/lib/utils"

export function NichesScreen() {
  const qc = useQueryClient()
  const { data: niches, isLoading } = useNiches()
  const fromUrl = useUrlParam("niche")
  const sel = fromUrl ?? niches?.[0]?.slug ?? null
  const [name, setName] = useState("")
  const create = useMutation({
    mutationFn: () => scenario.createNiche(name.trim()),
    onSuccess: (n) => {
      setName("")
      qc.invalidateQueries({ queryKey: skeys.niches })
      qc.invalidateQueries({ queryKey: skeys.options })
      setUrlParams({ niche: n.slug }, true)
    },
    onError: (e) => toast.error(e.message),
  })

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
      <div className="lg:col-span-4">
        <form
          className="mb-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (name.trim()) create.mutate()
          }}
        >
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Новая ниша" className={cn(INPUT, "h-9")} />
          <button type="submit" disabled={!name.trim() || create.isPending} className="grid size-9 shrink-0 place-items-center rounded-[3px] bg-electric text-white disabled:opacity-40">
            {create.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-4" />}
          </button>
        </form>
        <div className="overflow-hidden rounded-[4px] border border-line bg-surface">
          {isLoading && (
            <div className="flex justify-center py-6">
              <Loader2 className="size-4 animate-spin text-faint" />
            </div>
          )}
          {!isLoading && !niches?.length && <p className="px-4 py-6 text-center text-sm text-faint">Ниш пока нет</p>}
          {niches?.map((n) => (
            <button
              key={n.slug}
              type="button"
              onClick={() => setUrlParams({ niche: n.slug }, true)}
              className={cn(
                "block w-full border-b border-l-2 border-b-line px-4 py-3 text-left last:border-b-0",
                sel === n.slug ? "border-l-pick bg-pick-soft/60" : "border-l-transparent hover:bg-surface-2/60"
              )}
            >
              <span className={cn("block truncate text-sm font-medium", sel === n.slug && "text-pick-text")}>{n.name}</span>
              <span className="mt-0.5 block truncate font-mono text-[11px] text-faint">
                {n.notes} зам. · {n.videos} рол. · {n.profile_updated ? `паспорт ${n.profile_updated.slice(8, 10)}.${n.profile_updated.slice(5, 7)}` : "без паспорта"}
              </span>
            </button>
          ))}
        </div>
      </div>
      <div className="lg:col-span-8">{sel && <NicheCard key={sel} slug={sel} />}</div>
    </div>
  )
}

function settingsChips(d: NicheDefaults, modelLabel: (v: string) => string): [string, string][] {
  const i = d.inputs ?? {}
  const out: [string, string][] = []
  if (d.language) out.push(["Язык", d.language.toUpperCase()])
  if (i.duration_minutes) out.push(["Длительность", minutes(i.duration_minutes)])
  else if (i.target_chars) out.push(["Длительность", `${Math.round(i.target_chars).toLocaleString("ru")} симв.`])
  if (i.tone) out.push(["Тон", i.tone])
  out.push(["Модель", d.model ? modelLabel(d.model) : "по этапам"])
  return out
}

function NicheCard({ slug }: { slug: string }) {
  const qc = useQueryClient()
  const { data: n, isLoading } = useNiche(slug)
  const { data: options } = useScenarioOptions()
  const [tab, setTab] = useState("notes")
  const [note, setNote] = useState("")
  const [answers, setAnswers] = useState<Record<number, string>>({})
  const [settings, setSettings] = useState(false)
  const [text, setText] = useState<{ title: string; text: string } | null>(null)
  const [delNote, setDelNote] = useState<number | null>(null)

  const update = (data: ScenarioNicheDetail) => {
    qc.setQueryData(skeys.niche(slug), data)
    qc.invalidateQueries({ queryKey: skeys.niches })
    qc.invalidateQueries({ queryKey: skeys.options })
  }
  const addNote = useMutation({
    mutationFn: (body: { text: string; kind?: string; passport?: boolean }) => scenario.addNicheNote(slug, body),
    onSuccess: (data, body) => {
      update(data)
      if (body.kind === "answer") setAnswers({})
      else setNote("")
      if (data.task) toast.success(data.task.task === "niche_videos" ? "Ролики ушли на разбор" : "Паспорт собирается")
    },
    onError: (e) => toast.error(e.message),
  })
  const passport = useMutation({
    mutationFn: () => scenario.buildPassport(slug),
    onSuccess: () => qc.invalidateQueries({ queryKey: skeys.niche(slug) }),
    onError: (e) => toast.error(e.message),
  })

  if (isLoading || !n)
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="size-4 animate-spin text-faint" />
      </div>
    )

  const modelLabel = (v: string) => options?.models.find((m) => m.value === v || m.word === v)?.label.replace(/ \(Medium\)$/, "") ?? v
  const busy = n.tasks.find((t) => t.status === "queued" || t.status === "running")
  const answered = Object.entries(answers).filter(([, v]) => v.trim())
  const summary = n.summary.length ? n.summary : [["", n.feedback] as [string, string]]

  return (
    <div className="space-y-5">
      <section className="rounded-[4px] border border-line bg-surface">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3.5">
          <h2 className="text-lg font-semibold">{n.name}</h2>
          <div className="flex items-center gap-2">
            {n.profile && (
              <button type="button" className={BTN_SMALL} onClick={() => setText({ title: `Паспорт: ${n.name}`, text: n.profile })}>
                Паспорт полностью
              </button>
            )}
            <button
              type="button"
              disabled={!!busy || passport.isPending || (!n.notes && !n.videos)}
              onClick={() => passport.mutate()}
              className="flex h-8 items-center gap-1.5 rounded-[3px] bg-electric px-3 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {busy || passport.isPending ? <Loader2 className="size-3 animate-spin" /> : <Sparkles className="size-3" />}
              {busy ? (busy.step || "в очереди") : "Собрать паспорт"}
            </button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 border-b border-line px-5 py-3">
          {settingsChips(n.defaults, modelLabel).map(([k, v]) => (
            <button key={k} type="button" onClick={() => setSettings((s) => !s)} className="flex items-center gap-1.5 rounded-[3px] bg-surface-2 px-2.5 py-1 text-xs hover:bg-elev">
              <span className="text-muted-foreground">{k}</span>
              <span className={k === "Язык" ? "font-mono text-ok" : "text-pick-text"}>{v}</span>
            </button>
          ))}
          <button type="button" title="Настройки ниши" onClick={() => setSettings((s) => !s)} className="grid size-7 place-items-center rounded-[3px] text-faint hover:bg-elev hover:text-foreground">
            {settings ? <X className="size-3.5" /> : <Settings2 className="size-3.5" />}
          </button>
        </div>
        {settings && <NicheSettings n={n} onSaved={(d) => (update(d), setSettings(false))} />}
        {n.feedback && (
          <dl className="px-5 py-3">
            {summary.map(([k, v], i) => (
              <div key={i} className={cn("grid gap-3 py-1.5 text-sm", k ? "grid-cols-[120px_minmax(0,1fr)]" : "grid-cols-1")}>
                {k && <dt className="text-[13px] text-muted-foreground">{k}</dt>}
                <dd className="whitespace-pre-line text-foreground-2">{v}</dd>
              </div>
            ))}
          </dl>
        )}
      </section>

      {n.questions.length > 0 && (
        <Card
          title="Вопросы паспорта"
          aside={
            <button
              type="button"
              disabled={!answered.length || addNote.isPending}
              onClick={() =>
                addNote.mutate({
                  kind: "answer",
                  passport: true,
                  text: answered.map(([i, v]) => `Вопрос: ${n.questions[Number(i)]}\nОтвет: ${v}`).join("\n\n"),
                })
              }
              className="flex h-7 items-center gap-1.5 rounded-[3px] bg-electric px-2.5 text-xs font-medium text-white disabled:opacity-40"
            >
              {addNote.isPending ? <Loader2 className="size-3 animate-spin" /> : <Check className="size-3" />}
              Ответить{answered.length ? ` · ${answered.length}` : ""}
            </button>
          }
        >
          <ol className="space-y-3">
            {n.questions.map((q, i) => (
              <li key={i}>
                <p className="mb-1.5 text-sm">
                  <span className="mr-1.5 font-mono text-[12px] text-faint">{i + 1}.</span>
                  {q}
                </p>
                <input
                  value={answers[i] ?? ""}
                  onChange={(e) => setAnswers((a) => ({ ...a, [i]: e.target.value }))}
                  placeholder="Ответ"
                  className={cn(INPUT, "h-9", answers[i]?.trim() && "border-pick/40")}
                />
              </li>
            ))}
          </ol>
        </Card>
      )}

      <section className="rounded-[4px] border border-line bg-surface">
        <div className="border-b border-line p-4">
          <div className="rounded-[3px] border border-line-strong bg-background focus-within:border-electric/60">
            <textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Заметка о нише или ссылки на ролики конкурентов"
              className="block w-full resize-y bg-transparent p-3 text-sm outline-none placeholder:text-faint"
            />
            <div className="flex items-center justify-between gap-2 border-t border-line px-2 py-1.5">
              <AttachButton onText={(f) => addNote.mutate({ text: f.text, kind: "file" })} />
              <button
                type="button"
                disabled={!note.trim() || addNote.isPending}
                onClick={() => addNote.mutate({ text: note })}
                className="flex h-7 items-center gap-1.5 rounded-[3px] bg-electric px-3 text-xs font-medium text-white disabled:opacity-40"
              >
                {addNote.isPending ? <Loader2 className="size-3 animate-spin" /> : <Plus className="size-3" />}
                Добавить
              </button>
            </div>
          </div>
        </div>
        <div className="px-4 pt-3">
          <div className="w-60">
            <Seg value={tab} onChange={setTab} options={[["notes", `Заметки · ${n.notes}`], ["videos", `Ролики · ${n.videos}`]]} />
          </div>
        </div>
        <div className="p-4 pt-2">
          {tab === "notes" ? (
            n.note_items.length ? (
              [...n.note_items].reverse().map((x) => (
                <div key={x.n} className="group grid grid-cols-[96px_minmax(0,1fr)_auto] gap-3 border-b border-line py-2.5 last:border-b-0">
                  <span className="font-mono text-[11px] text-faint">
                    {x.time ? `${x.time.slice(8, 10)}.${x.time.slice(5, 7)} ${x.time.slice(11, 16)}` : ""}
                    <span className="block">{{ note: "заметка", answer: "ответ", file: "файл" }[x.kind] ?? x.kind}</span>
                  </span>
                  <span className="line-clamp-4 text-sm whitespace-pre-line text-foreground-2">{x.text}</span>
                  <button type="button" title="Удалить" onClick={() => setDelNote(x.n)} className="self-start text-faint opacity-0 group-hover:opacity-100 hover:text-danger">
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              ))
            ) : (
              <p className="py-4 text-center text-sm text-faint">Заметок нет</p>
            )
          ) : n.video_items.length ? (
            n.video_items.map((v) => (
              <div key={v.id} className="group grid grid-cols-[minmax(0,1fr)_auto] gap-3 border-b border-line py-2.5 last:border-b-0">
                <span className="min-w-0">
                  <a href={v.url} target="_blank" rel="noreferrer" className="block truncate text-sm hover:text-pick-text">
                    {v.title}
                  </a>
                  <span className="block truncate font-mono text-[11px] text-faint">{[v.channel, v.pace].filter(Boolean).join(" · ")}</span>
                  {v.highlights && <span className="mt-0.5 line-clamp-2 block text-[13px] whitespace-pre-line text-muted-foreground">{v.highlights}</span>}
                </span>
                <span className="flex items-start gap-1">
                  {v.analysis && (
                    <button type="button" onClick={() => setText({ title: v.title, text: v.analysis })} className="text-xs text-faint hover:text-foreground">
                      разбор
                    </button>
                  )}
                  <button
                    type="button"
                    title="Убрать из ниши"
                    onClick={async () => {
                      try {
                        update(await scenario.removeNicheVideo(slug, v.id))
                      } catch (e) {
                        toast.error((e as Error).message)
                      }
                    }}
                    className="text-faint opacity-0 group-hover:opacity-100 hover:text-danger"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </span>
              </div>
            ))
          ) : (
            <p className="py-4 text-center text-sm text-faint">Роликов нет</p>
          )}
        </div>
      </section>

      <TextDialog title={text?.title ?? ""} text={text?.text ?? null} onClose={() => setText(null)} />
      <ConfirmDialog
        open={delNote !== null}
        title="Удалить заметку?"
        text="Паспорт учтёт это при следующей сборке."
        onClose={() => setDelNote(null)}
        onConfirm={async () => update(await scenario.deleteNicheNote(slug, delNote!))}
      />
    </div>
  )
}

/** Manual niche settings: language, length, tone, model. The rest of `defaults` is kept. */
function NicheSettings({ n, onSaved }: { n: ScenarioNicheDetail; onSaved: (d: ScenarioNicheDetail) => void }) {
  const { data: options } = useScenarioOptions()
  const m = n.manual_defaults
  const [lang, setLang] = useState(m.language ?? "")
  const [length, setLength] = useState(m.inputs?.duration_minutes ? String(m.inputs.duration_minutes) : m.inputs?.target_chars ? String(m.inputs.target_chars) : "")
  const [tone, setTone] = useState(m.inputs?.tone ?? "")
  const [model, setModel] = useState(m.model ?? "")
  const save = useMutation({
    mutationFn: () => {
      const inputs = { ...(m.inputs ?? {}) }
      delete inputs.duration_minutes
      delete inputs.target_chars
      const v = Number(length.replace(/[^\d.,]/g, "").replace(",", "."))
      if (v) {
        if (v > 300) inputs.target_chars = v
        else inputs.duration_minutes = v
      }
      if (tone.trim()) inputs.tone = tone.trim()
      else delete inputs.tone
      const defaults: NicheDefaults = { ...m, inputs, language: lang || undefined, model: model || undefined }
      return scenario.patchNiche(n.slug, { defaults })
    },
    onSuccess: onSaved,
    onError: (e) => toast.error(e.message),
  })
  return (
    <div className="grid grid-cols-1 gap-4 border-b border-line px-5 py-4 md:grid-cols-2">
      <div className="md:col-span-2">
        <Label>Язык</Label>
        <div className="grid grid-cols-10 gap-[3px] rounded-[3px] bg-surface-2 p-[3px]">
          {(options?.languages ?? []).map((l) => (
            <button key={l.code} type="button" onClick={() => setLang(lang === l.code ? "" : l.code)} className={cn("rounded-[2px] py-1.5 font-mono text-[12px] uppercase", lang === l.code ? ON_GREEN : "text-faint hover:text-foreground-2")}>
              {l.code}
            </button>
          ))}
        </div>
      </div>
      <div>
        <Label>Длительность, мин или символы</Label>
        <input value={length} onChange={(e) => setLength(e.target.value)} placeholder="30" className={cn(INPUT, "h-9 font-mono")} />
      </div>
      <div>
        <Label>Модель</Label>
        <Pick value={model} onChange={setModel} options={[{ value: "", label: "По этапам" }, ...(options?.models ?? []).map((x) => ({ value: x.value, label: x.label.replace(/ \(Medium\)$/, ""), hint: x.backend_label }))]} />
      </div>
      <div className="md:col-span-2">
        <Label>Тон</Label>
        <input value={tone} onChange={(e) => setTone(e.target.value)} placeholder="спокойный, уважительный, без пафоса" className={cn(INPUT, "h-9")} />
      </div>
      <div className="flex justify-end md:col-span-2">
        <button type="button" disabled={save.isPending} onClick={() => save.mutate()} className="flex h-8 items-center gap-1.5 rounded-[3px] bg-electric px-3 text-xs font-medium text-white disabled:opacity-50">
          {save.isPending ? <Loader2 className="size-3 animate-spin" /> : <Check className="size-3" />}
          Сохранить
        </button>
      </div>
    </div>
  )
}
