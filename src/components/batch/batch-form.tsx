"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { AlertTriangle, Check, Loader2 } from "lucide-react"
import { toast } from "sonner"

import { Dropzone } from "@/components/create/dropzone"
import { lines, usePicture } from "@/components/create/form-parts"
import { Select } from "@/components/prompts/select"
import { usePgProjects } from "@/components/prompts/queries"
import { api, promptgen, type AspectRatio, type JobRow, type VideoDuration } from "@/lib/api"
import { plural } from "@/lib/format"
import { MODES, resolveAspectRatio, resolveDuration, type ModeMeta } from "@/lib/modes"
import { useCurrentProject, withStyle } from "@/lib/project"
import { keys, useAvatars, useProjectStyle } from "@/lib/queries"
import { cn } from "@/lib/utils"

type Source = "list" | "excel" | "template"
type Kind = "video" | "image"

function Tabs<T extends string>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="flex rounded-[3px] bg-surface-2 p-[3px]">
      {options.map(([key, label]) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          className={cn("flex-1 rounded-[2px] px-3 py-2 text-sm transition-colors", value === key ? "bg-elev font-medium text-foreground" : "text-foreground-2 hover:text-foreground")}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return <p className="mb-2 text-[13px] text-muted-foreground">{children}</p>
}

export function BatchForm() {
  const router = useRouter()
  const qc = useQueryClient()
  const [projectId] = useCurrentProject()
  const style = useProjectStyle(projectId)
  const { data: promptProjects } = usePgProjects(projectId)
  const { data: avatarList } = useAvatars()
  const [title, setTitle] = useState("")
  const [source, setSource] = useState<Source>("list")
  const [text, setText] = useState("")
  const [excel, setExcel] = useState<{ name: string; rows: JobRow[] } | null>(null)
  const [runId, setRunId] = useState<string | null>(null)
  const [kind, setKind] = useState<Kind>("video")
  const [modeId, setModeId] = useState<ModeMeta["id"]>("t2v")
  const [duration, setDuration] = useState<VideoDuration | null>(null)
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("16:9")
  const [avatarId, setAvatarId] = useState<string | null>(null)
  const still = usePicture()

  const modes = MODES.filter((m) => (kind === "video" ? m.makesVideos : !m.makesVideos))
  const mode = modes.find((m) => m.id === modeId) ?? modes[0]
  const effectiveDuration = resolveDuration(mode, duration)
  const effectiveAspect = resolveAspectRatio(mode, aspectRatio)
  const avatar = avatarList?.find((a) => a.id === avatarId)
  const doneRuns = (promptProjects ?? []).filter((r) => r.status === "done")

  // «В производство» из «Промптов»: /batch?prompts=<id>&mode=i2i2v — сразу выбрать промпты и режим
  useEffect(() => {
    const q = new URLSearchParams(window.location.search)
    const from = q.get("prompts")
    const m = q.get("mode")
    const durParam = Number(q.get("duration") || 0)
    const aspectParam = q.get("aspect")
    if (!from) return
    const t = setTimeout(() => {
      setSource("template")
      setRunId(from)
      const meta = MODES.find((x) => x.id === m)
      if (meta) {
        setKind(meta.makesVideos ? "video" : "image")
        setModeId(meta.id)
      }
      if (durParam === 4 || durParam === 6 || durParam === 8 || durParam === 10) {
        setDuration(durParam)
      }
      if (aspectParam === "16:9" || aspectParam === "9:16" || aspectParam === "1:1") {
        setAspectRatio(aspectParam)
      }
    }, 0)
    return () => clearTimeout(t)
  }, [])

  const rows: JobRow[] =
    source === "excel"
      ? (excel?.rows ?? [])
      : source === "template"
        ? [] // fetched on submit
        : lines(text).map((p, i) => ({
            name: String(i + 1),
            prompt: mode.needsVideoPrompt ? p : null,
            image_prompt: mode.needsImagePrompt ? p : null,
          }))

  const run = doneRuns.find((r) => r.id === runId)
  const count = source === "template" ? (run ? run.summary?.scenes ?? run.script.count * run.pairs : 0) : rows.length
  const problem =
    (count === 0 && (source === "list" ? "Добавьте промпты" : source === "excel" ? "Загрузите .xlsx" : "Выберите промпты")) ||
    (mode.avatar && !avatar ? "Выберите аватар" : null) ||
    (mode.avatar && avatar && !avatar.image_keys.length ? "Портрет аватара ещё генерируется" : null) ||
    (still.picture?.busy ? "Картинка ещё загружается" : null)

  const submit = useMutation({
    mutationFn: async () => {
      let jobRows = rows
      if (source === "template" && run) {
        const detail = await promptgen.result(run.id)
        jobRows = detail.rows
          .filter((r) => r.img || r.vid)
          .map((r) => ({ name: r.number, prompt: mode.needsVideoPrompt ? r.vid : null, image_prompt: mode.needsImagePrompt ? r.img : null }))
      }
      if (mode.avatar && avatar?.appearance) {
        jobRows = jobRows.map((r) => ({ ...r, image_prompt: r.image_prompt ? `${r.image_prompt}. ${avatar.appearance}` : r.image_prompt }))
      }
      jobRows = jobRows.map((r) => ({ ...r, prompt: r.prompt && withStyle(r.prompt, style), image_prompt: r.image_prompt && withStyle(r.image_prompt, style) }))
      const useStill = mode.staticImage && still.picture?.key
      return api.createJob({
        mode: mode.id,
        rows: useStill ? jobRows.map((r) => ({ ...r, image_prompt: null })) : jobRows,
        title: title.trim() || run?.title || mode.title,
        project_id: projectId,
        strategy: mode.chain ? "sequential" : "parallel",
        duration: effectiveDuration,
        aspect_ratio: effectiveAspect,
        avatar: mode.avatar ? avatar?.image_keys[0] : null,
        avatar_keys: mode.avatar && avatar?.image_keys.length ? avatar.image_keys : null,
        static_image: useStill ? still.picture!.key : null,
      })
    },
    onSuccess: (job) => {
      qc.invalidateQueries({ queryKey: keys.jobs })
      setText("")
      setTitle("")
      router.push(`/batch?job=${job.id}`)
    },
    onError: (e) => toast.error(e.message),
  })

  const loadExcel = async (file: File) => {
    try {
      const { rows } = await api.rowsFromXlsx(file, mode.id)
      setExcel({ name: file.name, rows })
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  return (
    <section className="flex flex-col gap-5 rounded-[4px] border border-line bg-surface p-5">
      <h2 className="text-lg font-semibold">Новый пакет</h2>

      <div>
        <Label>Название</Label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Глава 5: Финал"
          className="h-10 w-full rounded-[3px] border border-line-strong bg-background px-3 text-[15px] outline-none placeholder:text-faint focus:border-electric/60"
        />
      </div>

      <div>
        <Label>Откуда промпты</Label>
        <Tabs
          value={source}
          onChange={setSource}
          options={[
            ["list", "Списком"],
            ["excel", "Excel"],
            ["template", "Из промптов"],
          ]}
        />
        <div className="mt-3">
          {source === "list" && (
            <>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={7}
                spellCheck={false}
                placeholder={"Сенат Рима получает весть о поражении, факелы, ночь\nПустые улицы Рима, траур, утренний туман"}
                className="w-full resize-y rounded-[3px] border border-line-strong bg-background p-3 font-mono text-[13px] leading-relaxed outline-none placeholder:text-faint focus:border-electric/60"
              />
              <p className="mt-1.5 text-[13px] text-muted-foreground">Одна строка, одна генерация. Пустые строки пропускаются.</p>
            </>
          )}
          {source === "excel" && (
            <Dropzone
              accept=".xlsx"
              title="Загрузить .xlsx"
              hint={mode.makesImages && mode.makesVideos ? "number, img_prompt, vid_prompt" : "number, prompt"}
              fileName={excel?.name}
              onFile={loadExcel}
              onClear={() => setExcel(null)}
            />
          )}
          {source === "template" && (
            <Select
              label="Готовые промпты"
              value={runId}
              onChange={setRunId}
              placeholder={doneRuns.length ? "Выберите" : "Нет готовых — создайте во вкладке «Промпты»"}
              options={doneRuns.map((r) => ({
                value: r.id,
                label: r.title,
                hint: `${r.mode === "avatar" ? "аватар" : "обычный"} · ${r.summary?.scenes ?? r.script.count * r.pairs} строк`,
              }))}
            />
          )}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <Label>Для всех строк</Label>
        <Tabs
          value={kind}
          onChange={(k) => {
            setKind(k)
            setModeId(k === "video" ? "t2v" : "img")
          }}
          options={[
            ["video", "Видео"],
            ["image", "Картинка"],
          ]}
        />
        <div className="flex flex-col gap-0.5 rounded-[3px] bg-surface-2 p-[3px]">
          {modes.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setModeId(m.id)}
              className={cn("flex items-center gap-3 rounded-[2px] px-3 py-2.5 text-left transition-colors", m.id === mode.id ? "bg-elev" : "hover:bg-elev/50")}
            >
              <span className={cn("grid size-7 place-items-center rounded-[3px]", m.id === mode.id ? "bg-electric text-white" : "bg-surface text-muted-foreground")}>
                <m.icon className="size-3.5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5 text-sm font-medium">
                  {m.title}
                  {m.flash && <span className="rounded-[2px] bg-warn-soft px-1 font-mono text-[10px] text-warn">Flash</span>}
                </span>
                <span className="block text-xs text-muted-foreground">{m.description}</span>
              </span>
              {m.id === mode.id && <Check className="size-4 text-electric" />}
            </button>
          ))}
        </div>
        {mode.durations.length > 0 && effectiveDuration !== null && (
          <div>
            <Label>Длительность ролика</Label>
            <Tabs
              value={String(effectiveDuration)}
              onChange={(v) => setDuration(Number(v) as VideoDuration)}
              options={mode.durations.map((d) => [String(d), `${d} с`] as [string, string])}
            />
          </div>
        )}
        <div>
          <Label>Формат кадра</Label>
          <Tabs
            value={effectiveAspect}
            onChange={setAspectRatio}
            options={mode.aspectRatios.map(
              (r) =>
                [r, r === "16:9" ? "16:9 Горизонт." : r === "9:16" ? "9:16 Вертик." : "1:1 Квадрат"] as [AspectRatio, string]
            )}
          />
        </div>
        {mode.avatar && (
          <Select
            label="Аватар"
            value={avatarId}
            onChange={setAvatarId}
            placeholder={avatarList?.length ? "Выберите аватар" : "Нет аватаров — создайте в разделе «Аватар»"}
            options={(avatarList ?? []).map((a) => ({
              value: a.id,
              label: a.name,
              hint: [
                a.image_keys.length > 1 ? `${Math.min(a.image_keys.length, 4)} рак. в Flow` : "",
                a.appearance,
              ]
                .filter(Boolean)
                .join(" · "),
            }))}
          />
        )}
        {mode.staticImage && (
          <Dropzone
            accept="image/*"
            title="Одна картинка на все видео"
            hint="Необязательно"
            busy={still.picture?.busy}
            preview={still.picture?.preview}
            fileName={still.picture?.name}
            onFile={still.upload}
            onClear={still.clear}
          />
        )}
      </div>

      <div className="flex flex-col gap-2 rounded-[3px] bg-surface-2 p-4 text-sm">
        <div className="flex justify-between">
          <span className="text-foreground-2">Строк</span>
          <span className="font-mono">{count}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-foreground-2">Генераций</span>
          <span className="font-mono">{count * (mode.makesImages && mode.makesVideos ? 2 : 1)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-foreground-2">Максимум к списанию</span>
          <span className="font-mono">— кр.</span>
        </div>
        <p className="mt-1 text-[13px] text-muted-foreground">Ошибки не оплачиваются.</p>
      </div>

      {problem && count > 0 && (
        <p className="flex items-center gap-2 text-[13px] text-warn">
          <AlertTriangle className="size-3.5" /> {problem}
        </p>
      )}
      <button
        type="button"
        disabled={!!problem || submit.isPending}
        onClick={() => submit.mutate()}
        className="flex h-11 items-center justify-center gap-2 rounded-[3px] bg-electric font-semibold text-white transition hover:brightness-110 disabled:opacity-40"
      >
        {submit.isPending && <Loader2 className="size-4 animate-spin" />}
        Запустить пакет{count ? `: ${count}` : ""}
      </button>
      {count > 0 && (
        <p className="-mt-3 text-center text-xs text-faint">
          {plural(count, "строка", "строки", "строк")} · {effectiveDuration ? `${effectiveDuration} с · ` : ""}
          {effectiveAspect}
        </p>
      )}
    </section>
  )
}
