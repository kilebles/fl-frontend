"use client"

import { useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { AlertTriangle, FileSpreadsheet, Layers, Loader2, PenLine, Rocket, Rows3 } from "lucide-react"
import { AnimatePresence, motion } from "motion/react"
import { toast } from "sonner"

import { Dropzone } from "@/components/create/dropzone"
import { ModeCard } from "@/components/create/mode-card"
import { api, type JobRow, type Strategy } from "@/lib/api"
import { plural } from "@/lib/format"
import { MODES, type ModeMeta } from "@/lib/modes"
import { keys } from "@/lib/queries"
import { cn } from "@/lib/utils"

interface Picture {
  key: string | null
  name: string
  preview: string
  busy: boolean
}

const lines = (text: string) =>
  text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)

function usePicture() {
  const [picture, setPicture] = useState<Picture | null>(null)
  const upload = async (file: File) => {
    const preview = URL.createObjectURL(file)
    setPicture({ key: null, name: file.name, preview, busy: true })
    try {
      const { key } = await api.upload(file)
      setPicture({ key, name: file.name, preview, busy: false })
    } catch (e) {
      setPicture(null)
      toast.error((e as Error).message)
    }
  }
  return { picture, upload, clear: () => setPicture(null) }
}

function Section({ icon: Icon, title, children, aside }: { icon: React.ElementType; title: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-surface p-5">
      <div className="mb-4 flex items-center gap-2.5">
        <Icon className="size-4 text-electric" />
        <h3 className="text-[15px] font-semibold">{title}</h3>
        <div className="ml-auto">{aside}</div>
      </div>
      {children}
    </section>
  )
}

function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string; icon?: React.ElementType }[]; onChange: (v: T) => void }) {
  return (
    <div className="inline-flex rounded-xl border border-line bg-background/50 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn("relative flex h-8 items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium transition-colors", value === o.value ? "text-foreground" : "text-muted-foreground hover:text-foreground")}
        >
          {value === o.value && <motion.span layoutId={`seg-${options.map((x) => x.value).join()}`} className="absolute inset-0 rounded-lg bg-elev ring-1 ring-line-strong" transition={{ type: "spring", stiffness: 500, damping: 38 }} />}
          {o.icon && <o.icon className="relative size-3.5" />}
          <span className="relative">{o.label}</span>
        </button>
      ))}
    </div>
  )
}

function PromptArea({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder: string }) {
  const count = lines(value).length
  return (
    <label className="flex min-w-0 flex-1 flex-col gap-2">
      <span className="flex items-center justify-between text-[13px] text-muted-foreground">
        {label}
        <span className="font-mono text-xs text-faint tabular-nums">{count}</span>
      </span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        spellCheck={false}
        className="min-h-64 w-full resize-y rounded-xl border border-line-strong bg-background/60 p-3.5 font-mono text-[13px] leading-relaxed outline-none placeholder:text-faint focus:border-electric/60 focus:ring-3 focus:ring-electric/15"
      />
    </label>
  )
}

export function CreateView() {
  const router = useRouter()
  const qc = useQueryClient()
  const formRef = useRef<HTMLDivElement>(null)

  const [mode, setMode] = useState<ModeMeta | null>(null)
  const [title, setTitle] = useState("")
  const [strategy, setStrategy] = useState<Strategy>("parallel")
  const [source, setSource] = useState<"manual" | "excel">("manual")
  const [videoText, setVideoText] = useState("")
  const [imageText, setImageText] = useState("")
  const [excel, setExcel] = useState<{ name: string; rows: JobRow[] } | null>(null)
  const [excelBusy, setExcelBusy] = useState(false)
  const avatar = usePicture()
  const still = usePicture()

  const select = (m: ModeMeta) => {
    if (mode?.id !== m.id) setExcel(null)
    setMode(m)
    requestAnimationFrame(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }))
  }

  const useStill = !!mode?.staticImage && !!still.picture
  const askImage = !!mode?.needsImagePrompt && !useStill
  const askVideo = !!mode?.needsVideoPrompt

  const { rows, problem } = useMemo((): { rows: JobRow[]; problem: string | null } => {
    if (!mode) return { rows: [], problem: null }
    if (source === "excel") {
      if (!excel) return { rows: [], problem: "Загрузите .xlsx" }
      return { rows: excel.rows, problem: null }
    }
    const v = lines(videoText)
    const im = lines(imageText)
    if (askVideo && askImage) {
      if (v.length !== im.length && v.length && im.length)
        return { rows: [], problem: `Промптов картинок ${im.length}, а видео ${v.length} — строки должны совпадать` }
      const n = Math.max(v.length, im.length)
      const rows = Array.from({ length: n }, (_, i) => ({ name: String(i + 1), prompt: v[i] ?? null, image_prompt: im[i] ?? null }))
      if (n && (!v.length || !im.length)) return { rows: [], problem: !v.length ? "Добавьте промпты видео" : "Добавьте промпты картинок" }
      return { rows, problem: n ? null : "Добавьте промпты" }
    }
    const list = askVideo ? v : im
    return {
      rows: list.map((p, i) => (askVideo ? { name: String(i + 1), prompt: p } : { name: String(i + 1), image_prompt: p })),
      problem: list.length ? null : "Добавьте промпты",
    }
  }, [mode, source, excel, videoText, imageText, askVideo, askImage])

  const blocker =
    problem ??
    (mode?.avatar && !avatar.picture?.key ? "Загрузите аватар" : null) ??
    (avatar.picture?.busy || still.picture?.busy ? "Картинка ещё загружается" : null)

  const submit = useMutation({
    mutationFn: () =>
      api.createJob({
        mode: mode!.id,
        rows,
        title: title.trim() || null,
        strategy: mode!.chain ? "sequential" : strategy,
        avatar: mode!.avatar ? avatar.picture?.key : null,
        static_image: useStill ? still.picture?.key : null,
      }),
    onSuccess: (job) => {
      qc.invalidateQueries({ queryKey: keys.jobs })
      toast.success("Задача запущена")
      router.push(`/jobs/${job.id}`)
    },
    onError: (e) => toast.error(e.message),
  })

  const loadExcel = async (file: File) => {
    if (!mode) return
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
    <div className="mx-auto max-w-6xl px-4 pt-8 sm:px-6 md:pt-12 pb-32 lg:px-10">
      <motion.header initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mb-10 max-w-2xl">
        <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-electric/25 bg-electric/10 px-3 py-1 text-xs font-medium text-electric">
          <span className="size-1.5 rounded-full bg-electric" /> Google Flow · Veo
        </p>
        <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">Что генерируем?</h1>
        <p className="mt-3 text-lg text-muted-foreground">Выберите режим, вставьте промпты — аккаунты сделают остальное.</p>
      </motion.header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {MODES.map((m, i) => (
          <motion.div key={m.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.03 * i, duration: 0.35, ease: [0.2, 0.8, 0.2, 1] }} className="flex">
            <ModeCard mode={m} selected={mode?.id === m.id} onSelect={() => select(m)} />
          </motion.div>
        ))}
      </div>

      <div ref={formRef} className="scroll-mt-6" />
      <AnimatePresence mode="wait">
        {mode && (
          <motion.div
            key={mode.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3, ease: [0.2, 0.8, 0.2, 1] }}
            className="mt-10 grid gap-3 lg:grid-cols-[1fr_340px]"
          >
            <Section
              icon={Rows3}
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
                  {askImage && (
                    <PromptArea label="Картинки — по одному на строку" value={imageText} onChange={setImageText} placeholder={"Закат над Римом, вид с холма, 35mm\nКолизей ночью, туман, мягкий свет"} />
                  )}
                  {askVideo && (
                    <PromptArea
                      label={mode.chain ? "Клипы по порядку — по одному на строку" : "Видео — по одному на строку"}
                      value={videoText}
                      onChange={setVideoText}
                      placeholder={"Камера медленно поднимается над городом\nПроезд вдоль арены, лёгкий дым"}
                    />
                  )}
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
                  title="Перетащите .xlsx или нажмите"
                  hint={mode.makesImages && mode.makesVideos ? "Колонки: number, img_prompt, vid_prompt" : "Колонки: number, prompt"}
                  onFile={loadExcel}
                  className="min-h-64"
                />
              )}
            </Section>

            <div className="flex flex-col gap-3">
              <Section icon={Layers} title="Параметры">
                <div className="flex flex-col gap-4">
                  <label className="flex flex-col gap-2">
                    <span className="text-[13px] text-muted-foreground">Название</span>
                    <input
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Например, Рим — 220 роликов"
                      className="h-10 rounded-xl border border-line-strong bg-background/60 px-3 text-sm outline-none placeholder:text-faint focus:border-electric/60 focus:ring-3 focus:ring-electric/15"
                    />
                  </label>
                  {mode.avatar && (
                    <div className="flex flex-col gap-2">
                      <span className="text-[13px] text-muted-foreground">Аватар — внешность во всех кадрах</span>
                      <Dropzone accept="image/*" title="Загрузить аватар" hint="JPG, PNG, WEBP до 20 МБ" busy={avatar.picture?.busy} preview={avatar.picture?.preview} fileName={avatar.picture?.name} onFile={avatar.upload} onClear={avatar.clear} />
                    </div>
                  )}
                  {mode.staticImage && (
                    <div className="flex flex-col gap-2">
                      <span className="text-[13px] text-muted-foreground">Одна картинка на все видео (необязательно)</span>
                      <Dropzone accept="image/*" title="Загрузить картинку" hint="Тогда промпты картинок не нужны" busy={still.picture?.busy} preview={still.picture?.preview} fileName={still.picture?.name} onFile={still.upload} onClear={still.clear} />
                    </div>
                  )}
                  {!mode.chain && (
                    <div className="flex flex-col gap-2">
                      <span className="text-[13px] text-muted-foreground">Аккаунты</span>
                      <Segmented
                        value={strategy}
                        onChange={setStrategy}
                        options={[
                          { value: "parallel", label: "Все сразу" },
                          { value: "sequential", label: "По очереди" },
                        ]}
                      />
                    </div>
                  )}
                </div>
              </Section>

              <div className="sticky bottom-4 rounded-2xl border border-line-strong bg-surface-2/90 p-4 backdrop-blur-xl">
                <div className="mb-3 flex items-end justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">Будет сгенерировано</p>
                    <p className="text-2xl font-semibold tabular-nums">
                      {rows.length} <span className="text-base font-normal text-muted-foreground">{plural(rows.length, "строка", "строки", "строк")}</span>
                    </p>
                  </div>
                  <p className="pb-1 text-right text-xs text-faint">
                    {[mode.makesImages && !useStill && "картинки", mode.makesVideos && "видео"].filter(Boolean).join(" + ")}
                  </p>
                </div>
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
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
