"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { AlertTriangle, ArrowLeft, FileSpreadsheet, Loader2, PenLine, Rocket } from "lucide-react"
import { toast } from "sonner"

import { Dropzone } from "@/components/create/dropzone"
import { lines, PromptArea, Section, Segmented, usePicture } from "@/components/create/form-parts"
import { ModePicker } from "@/components/create/mode-picker"
import { api, type JobRow } from "@/lib/api"
import { plural } from "@/lib/format"
import { MODES, type ModeMeta } from "@/lib/modes"
import { keys } from "@/lib/queries"

export function BatchForm() {
  const router = useRouter()
  const qc = useQueryClient()
  const [mode, setMode] = useState<ModeMeta>(MODES[0])
  const [title, setTitle] = useState("")
  const [source, setSource] = useState<"manual" | "excel">("manual")
  const [videoText, setVideoText] = useState("")
  const [imageText, setImageText] = useState("")
  const [excel, setExcel] = useState<{ name: string; rows: JobRow[] } | null>(null)
  const [excelBusy, setExcelBusy] = useState(false)
  const avatar = usePicture()
  const still = usePicture()

  const useStill = !!mode.staticImage && !!still.picture
  const askImage = mode.needsImagePrompt && !useStill
  const askVideo = mode.needsVideoPrompt

  const changeMode = (m: ModeMeta) => {
    if (m.id !== mode.id) setExcel(null)
    setMode(m)
  }

  const { rows, problem } = useMemo((): { rows: JobRow[]; problem: string | null } => {
    if (source === "excel") return excel ? { rows: excel.rows, problem: null } : { rows: [], problem: "Загрузите .xlsx" }
    const v = lines(videoText)
    const im = lines(imageText)
    if (askVideo && askImage) {
      if (v.length !== im.length && v.length && im.length) return { rows: [], problem: `Картинок ${im.length}, видео ${v.length} — должно совпадать` }
      const n = Math.max(v.length, im.length)
      if (n && (!v.length || !im.length)) return { rows: [], problem: !v.length ? "Добавьте промпты видео" : "Добавьте промпты картинок" }
      return { rows: Array.from({ length: n }, (_, i) => ({ name: String(i + 1), prompt: v[i], image_prompt: im[i] })), problem: n ? null : "Добавьте промпты" }
    }
    const list = askVideo ? v : im
    return {
      rows: list.map((p, i) => (askVideo ? { name: String(i + 1), prompt: p } : { name: String(i + 1), image_prompt: p })),
      problem: list.length ? null : "Добавьте промпты",
    }
  }, [source, excel, videoText, imageText, askVideo, askImage])

  const blocker =
    problem ??
    (mode.avatar && !avatar.picture?.key ? "Загрузите аватар" : null) ??
    (avatar.picture?.busy || still.picture?.busy ? "Картинка ещё загружается" : null)

  const submit = useMutation({
    mutationFn: () =>
      api.createJob({
        mode: mode.id,
        rows,
        title: title.trim() || null,
        strategy: mode.chain ? "sequential" : "parallel",
        avatar: mode.avatar ? avatar.picture?.key : null,
        static_image: useStill ? still.picture?.key : null,
      }),
    onSuccess: (job) => {
      qc.invalidateQueries({ queryKey: keys.jobs })
      router.push(`/jobs/${job.id}`)
    },
    onError: (e) => toast.error(e.message),
  })

  const loadExcel = async (file: File) => {
    setExcelBusy(true)
    try {
      const { rows } = await api.rowsFromXlsx(file, mode.id)
      setExcel({ name: file.name, rows })
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setExcelBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 pt-6 pb-20 sm:px-6 md:pt-8 lg:px-10">
      <Link href="/batch" className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
        <ArrowLeft className="size-4" /> Производство
      </Link>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Новая задача</h1>
        <ModePicker modes={MODES} value={mode} onChange={changeMode} className="ml-auto" />
      </div>

      <div className="grid gap-3 lg:grid-cols-[1fr_320px]">
        <Section
          title="Промпты"
          aside={
            <Segmented
              value={source}
              onChange={setSource}
              options={[
                { value: "manual", label: "Вручную", icon: PenLine },
                { value: "excel", label: "Excel", icon: FileSpreadsheet },
              ]}
            />
          }
        >
          {source === "manual" ? (
            <div className="flex flex-col gap-3 md:flex-row">
              {askImage && <PromptArea label="Картинки" value={imageText} onChange={setImageText} placeholder="Промпт на строку" />}
              {askVideo && <PromptArea label={mode.chain ? "Клипы по порядку" : "Видео"} value={videoText} onChange={setVideoText} placeholder="Промпт на строку" />}
            </div>
          ) : excel ? (
            <div className="flex flex-col gap-3">
              <Dropzone accept=".xlsx" title="" hint="" fileName={excel.name} onFile={loadExcel} onClear={() => setExcel(null)} />
              <div className="overflow-hidden rounded-xl border border-line">
                <table className="w-full text-left text-[13px]">
                  <thead className="bg-surface-2 text-xs text-muted-foreground">
                    <tr>
                      <th className="w-14 px-3 py-2 font-medium">№</th>
                      {askImage && <th className="px-3 py-2 font-medium">Картинка</th>}
                      {askVideo && <th className="px-3 py-2 font-medium">Видео</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {excel.rows.slice(0, 6).map((r) => (
                      <tr key={r.name} className="border-t border-line">
                        <td className="px-3 py-2 font-mono text-faint">{r.name}</td>
                        {askImage && <td className="max-w-0 truncate px-3 py-2">{r.image_prompt}</td>}
                        {askVideo && <td className="max-w-0 truncate px-3 py-2">{r.prompt}</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {excel.rows.length > 6 && <p className="border-t border-line px-3 py-2 text-xs text-faint">и ещё {excel.rows.length - 6}</p>}
              </div>
            </div>
          ) : (
            <Dropzone
              accept=".xlsx"
              busy={excelBusy}
              title="Загрузить .xlsx"
              hint={mode.makesImages && mode.makesVideos ? "number, img_prompt, vid_prompt" : "number, prompt"}
              onFile={loadExcel}
              className="min-h-72"
            />
          )}
        </Section>

        <div className="flex flex-col gap-3">
          <Section title="Параметры">
            <div className="flex flex-col gap-4">
              <label className="flex flex-col gap-2">
                <span className="text-[13px] text-muted-foreground">Название</span>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Без названия"
                  className="h-10 rounded-xl border border-line-strong bg-background/60 px-3 text-sm outline-none placeholder:text-faint focus:border-electric/60 focus:ring-3 focus:ring-electric/15"
                />
              </label>
              {mode.avatar && (
                <div className="flex flex-col gap-2">
                  <span className="text-[13px] text-muted-foreground">Аватар</span>
                  <Dropzone accept="image/*" title="Загрузить аватар" hint="JPG, PNG, WEBP" busy={avatar.picture?.busy} preview={avatar.picture?.preview} fileName={avatar.picture?.name} onFile={avatar.upload} onClear={avatar.clear} />
                </div>
              )}
              {mode.staticImage && (
                <div className="flex flex-col gap-2">
                  <span className="text-[13px] text-muted-foreground">Картинка для всех видео</span>
                  <Dropzone accept="image/*" title="Загрузить картинку" hint="Необязательно" busy={still.picture?.busy} preview={still.picture?.preview} fileName={still.picture?.name} onFile={still.upload} onClear={still.clear} />
                </div>
              )}
            </div>
          </Section>

          <div className="sticky bottom-4 rounded-2xl border border-line-strong bg-surface-2/90 p-4 backdrop-blur-xl">
            <p className="mb-3 text-2xl font-semibold tabular-nums">
              {rows.length} <span className="text-base font-normal text-muted-foreground">{plural(rows.length, "строка", "строки", "строк")}</span>
            </p>
            {blocker && rows.length > 0 && (
              <p className="mb-3 flex items-start gap-2 text-xs text-warn">
                <AlertTriangle className="mt-px size-3.5 shrink-0" /> {blocker}
              </p>
            )}
            <button
              type="button"
              disabled={!!blocker || submit.isPending}
              onClick={() => submit.mutate()}
              className="glow-electric flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-electric font-semibold text-white transition hover:brightness-110 active:translate-y-px disabled:pointer-events-none disabled:opacity-40 disabled:shadow-none"
            >
              {submit.isPending ? <Loader2 className="size-4.5 animate-spin" /> : <Rocket className="size-4.5" />}
              Запустить
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
