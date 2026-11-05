"use client"

import { useRef, useState } from "react"
import Link from "next/link"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Download, Loader2, Plus, Trash2, X } from "lucide-react"
import { toast } from "sonner"

import { PageHeader } from "@/components/shell/page-header"
import { api, avatars, type Avatar } from "@/lib/api"
import { useCurrentProject, withStyle } from "@/lib/project"
import { keys, useAvatars, useProjectStyle } from "@/lib/queries"
import { cn } from "@/lib/utils"

interface Reference {
  key: string | null
  url: string
}

function extFromMimeOrUrl(mime: string, url: string): string {
  if (mime === "image/png") return ".png"
  if (mime === "image/webp") return ".webp"
  if (mime === "image/jpeg") return ".jpg"
  const pathname = url.split("?")[0] ?? ""
  const match = pathname.match(/\.(jpg|jpeg|png|webp)$/i)
  return match ? `.${match[1].toLowerCase()}` : ".jpg"
}

async function downloadAvatarImage(url: string, rawName: string) {
  const safeName = (rawName.trim() || "avatar").replace(/[\\/:*?"<>|]+/g, "-").trim()
  const res = await fetch(url)
  if (!res.ok) throw new Error("Не удалось скачать изображение")
  const blob = await res.blob()
  const ext = extFromMimeOrUrl(blob.type, url)
  const objectUrl = URL.createObjectURL(blob)
  try {
    const a = document.createElement("a")
    a.href = objectUrl
    a.download = `${safeName}${ext}`
    document.body.appendChild(a)
    a.click()
    a.remove()
  } finally {
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000)
  }
}

/** Editor of one avatar (or a new one): references, name, appearance. */
function Editor({ avatar, onSaved, onDeleted }: { avatar: Avatar | null; onSaved: (a: Avatar) => void; onDeleted: () => void }) {
  const qc = useQueryClient()
  const file = useRef<HTMLInputElement>(null)
  const [name, setName] = useState(avatar?.name ?? "")
  const [appearance, setAppearance] = useState(avatar?.appearance ?? "")
  const [refs, setRefs] = useState<Reference[]>(avatar ? avatar.image_keys.map((key, i) => ({ key, url: avatar.image_urls[i] })) : [])
  const [downloading, setDownloading] = useState<string | null>(null)
  const uploading = refs.some((r) => !r.key)

  const handleDownload = async (url: string, label: string) => {
    try {
      setDownloading(url)
      await downloadAvatarImage(url, label)
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setDownloading(null)
    }
  }

  const handleDownloadAll = async () => {
    if (!refs.length) return
    const base = name.trim() || avatar?.name || "avatar"
    try {
      setDownloading("all")
      for (let i = 0; i < refs.length; i++) {
        const suffix = refs.length > 1 ? ` - ${i + 1}` : ""
        await downloadAvatarImage(refs[i].url, `${base}${suffix}`)
        if (i < refs.length - 1) await new Promise((r) => setTimeout(r, 150))
      }
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setDownloading(null)
    }
  }

  const add = async (files: FileList | null) => {
    for (const f of Array.from(files ?? []).slice(0, 8 - refs.length)) {
      const url = URL.createObjectURL(f)
      setRefs((r) => [...r, { key: null, url }])
      try {
        const { key } = await api.upload(f)
        setRefs((r) => r.map((x) => (x.url === url ? { ...x, key } : x)))
      } catch (e) {
        setRefs((r) => r.filter((x) => x.url !== url))
        toast.error((e as Error).message)
      }
    }
  }

  const save = useMutation({
    mutationFn: () => {
      const body = { name, appearance, image_keys: refs.map((r) => r.key!) }
      return avatar ? avatars.update(avatar.id, body) : avatars.create(body)
    },
    onSuccess: (a) => {
      qc.invalidateQueries({ queryKey: keys.avatars })
      toast.success("Аватар сохранён")
      onSaved(a)
    },
    onError: (e) => toast.error(e.message),
  })
  const remove = useMutation({
    mutationFn: () => avatars.remove(avatar!.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.avatars })
      onDeleted()
    },
    onError: (e) => toast.error(e.message),
  })

  return (
    <section className="flex flex-col gap-4 rounded-[4px] border border-line bg-surface p-5">
      <div className="flex gap-4">
        <div className="aspect-[3/4] w-28 shrink-0 overflow-hidden rounded-[3px] bg-surface-2">
          {refs[0] && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={refs[0].url} alt="" className="size-full object-cover" />
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <p className="truncate text-lg font-semibold">{name || "Новый аватар"}</p>
          <p className="mt-0.5 text-[13px] text-muted-foreground">{refs.length ? `${refs.length} референс${refs.length === 1 ? "" : refs.length < 5 ? "а" : "ов"}` : "Добавьте референсы"}</p>
          {avatar && <span className="mt-2 inline-block w-fit rounded-[2px] bg-ok/12 px-2 py-0.5 text-xs text-ok">Готов к работе</span>}
          {refs[0] && (
            <div className="mt-auto flex flex-wrap gap-1.5 pt-3">
              <button
                type="button"
                disabled={downloading !== null}
                onClick={() => handleDownload(refs[0].url, name.trim() || avatar?.name || "avatar")}
                className="inline-flex h-8 items-center gap-1.5 rounded-[3px] border border-line-strong bg-surface-2 px-2.5 text-xs font-medium transition-colors hover:border-electric/50 hover:text-electric disabled:opacity-50"
              >
                {downloading === refs[0].url ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
                Скачать аватар
              </button>
              {refs.length > 1 && (
                <button
                  type="button"
                  disabled={downloading !== null}
                  onClick={handleDownloadAll}
                  className="inline-flex h-8 items-center gap-1.5 rounded-[3px] border border-line-strong px-2.5 text-xs text-muted-foreground transition-colors hover:border-faint hover:text-foreground disabled:opacity-50"
                  title="Скачать все референсы аватара"
                >
                  {downloading === "all" && <Loader2 className="size-3 animate-spin" />}
                  Все ({refs.length})
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <div>
        <p className="mb-2 text-[13px] text-muted-foreground">Референсы</p>
        <div className="grid grid-cols-4 gap-2">
          {refs.map((r, i) => (
            <div key={r.url} className="group relative aspect-square overflow-hidden rounded-[3px] bg-surface-2">
              <button
                type="button"
                disabled={i === 0}
                onClick={() => setRefs((prev) => [prev[i], ...prev.filter((_, idx) => idx !== i)])}
                className={cn("size-full", i > 0 && "cursor-pointer")}
                title={i > 0 ? "Сделать главным референсом" : "Главный референс"}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={r.url} alt="" className={cn("size-full object-cover", !r.key && "opacity-40")} />
              </button>
              {!r.key && <Loader2 className="absolute inset-0 m-auto size-4 animate-spin" />}
              {i === 0 && <span className="pointer-events-none absolute bottom-1 left-1 rounded-[2px] bg-black/60 px-1 text-[10px] text-white">главный</span>}
              <button
                type="button"
                onClick={() => handleDownload(r.url, `${name.trim() || avatar?.name || "avatar"}${refs.length > 1 ? ` - ${i + 1}` : ""}`)}
                className="absolute top-1 left-1 grid size-5 place-items-center rounded-[2px] bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100 hover:bg-black/80"
                aria-label="Скачать референс"
                title="Скачать референс"
              >
                <Download className="size-3" />
              </button>
              <button
                type="button"
                onClick={() => setRefs((x) => x.filter((y) => y.url !== r.url))}
                className="absolute top-1 right-1 grid size-5 place-items-center rounded-[2px] bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100 hover:bg-black/80"
                aria-label="Убрать"
                title="Убрать"
              >
                <X className="size-3" />
              </button>
            </div>
          ))}
          {refs.length < 8 && (
            <button
              type="button"
              onClick={() => file.current?.click()}
              className="grid aspect-square place-items-center rounded-[3px] border border-dashed border-line-strong text-muted-foreground hover:border-faint hover:text-foreground"
              aria-label="Добавить референс"
            >
              <Plus className="size-4" />
            </button>
          )}
        </div>
        <input
          ref={file}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            add(e.target.files)
            e.target.value = ""
          }}
        />
        <p className="mt-2 text-[13px] text-muted-foreground">Главный референс задаёт лицо в кадрах. Чем чётче он, тем стабильнее персонаж.</p>
      </div>

      <label className="flex flex-col gap-2">
        <span className="text-[13px] text-muted-foreground">Имя</span>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ганнибал" className="h-10 rounded-[3px] border border-line-strong bg-background px-3 outline-none placeholder:text-faint focus:border-electric/60" />
      </label>
      <label className="flex flex-col gap-2">
        <span className="text-[13px] text-muted-foreground">Внешность, добавляется к каждому промпту</span>
        <textarea
          value={appearance}
          onChange={(e) => setAppearance(e.target.value)}
          rows={3}
          placeholder="Мужчина около 30 лет, смуглая кожа, короткая тёмная борода, бронзовый нагрудник, красный плащ"
          className="resize-y rounded-[3px] border border-line-strong bg-background p-3 text-sm leading-relaxed outline-none placeholder:text-faint focus:border-electric/60"
        />
      </label>
      <div className="flex flex-wrap gap-2">
        {avatar && (
          <Link href="/batch" className="flex h-9 items-center rounded-[3px] border border-line-strong px-3.5 text-sm hover:border-faint">
            Пакет с этим аватаром
          </Link>
        )}
        <button
          type="button"
          disabled={!name.trim() || !refs.length || uploading || save.isPending}
          onClick={() => save.mutate()}
          className="flex h-9 items-center gap-2 rounded-[3px] bg-electric px-4 text-sm font-medium text-white disabled:opacity-40"
        >
          {save.isPending && <Loader2 className="size-3.5 animate-spin" />}
          {avatar ? "Сохранить" : "Создать аватар"}
        </button>
        {avatar && (
          <button
            type="button"
            onClick={() => confirm("Удалить аватар?") && remove.mutate()}
            className="ml-auto grid size-9 place-items-center rounded-[3px] text-muted-foreground hover:bg-danger/10 hover:text-danger"
            aria-label="Удалить"
          >
            <Trash2 className="size-4" />
          </button>
        )}
      </div>
    </section>
  )
}

/** A quick scene with the avatar: avatar → image → video, one generation. */
function Scene({ avatar }: { avatar: Avatar }) {
  const qc = useQueryClient()
  const [projectId] = useCurrentProject()
  const style = useProjectStyle(projectId)
  const [text, setText] = useState("")
  const create = useMutation({
    mutationFn: () =>
      api.createJob({
        mode: "i2i2v",
        title: text.trim().slice(0, 200),
        project_id: projectId,
        avatar: avatar.image_keys[0],
        rows: [
          {
            name: "1",
            prompt: withStyle(text.trim(), style),
            image_prompt: withStyle(avatar.appearance ? `${text.trim()}. ${avatar.appearance}` : text.trim(), style),
          },
        ],
      }),
    onSuccess: () => {
      setText("")
      qc.invalidateQueries({ queryKey: keys.jobs })
      toast.success("Сцена запущена — смотрите в Генерациях")
    },
    onError: (e) => toast.error(e.message),
  })
  return (
    <section className="flex flex-col gap-3 rounded-[4px] border border-line bg-surface p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="font-semibold">Сцена с аватаром «{avatar.name}»</h3>
        <span className="text-xs text-muted-foreground">Режим «Аватар → видео»</span>
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        placeholder={`${avatar.name} стоит на холме и смотрит на лагерь, ветер треплет плащ, закат, камера медленно облетает`}
        className="resize-y rounded-[3px] border border-line-strong bg-background p-3 text-[15px] leading-relaxed outline-none placeholder:text-faint focus:border-electric/60"
      />
      <div className="flex items-center justify-end gap-3">
        <span className="font-mono text-xs text-muted-foreground">16:9</span>
        <button
          type="button"
          disabled={!text.trim() || create.isPending}
          onClick={() => create.mutate()}
          className="flex h-10 items-center gap-2 rounded-[3px] bg-electric px-4 text-sm font-semibold text-white disabled:opacity-40"
        >
          {create.isPending && <Loader2 className="size-3.5 animate-spin" />}
          Создать
        </button>
      </div>
    </section>
  )
}

export function AvatarsView() {
  const { data: list, isLoading } = useAvatars()
  const [selected, setSelected] = useState<string | "new" | null>(null)
  const [cardDownloading, setCardDownloading] = useState<string | null>(null)
  const current = selected === "new" ? null : (list?.find((a) => a.id === selected) ?? list?.[0] ?? null)
  const editing = selected === "new" || !list?.length ? null : current

  const downloadCard = async (a: Avatar) => {
    if (!a.image_urls[0]) return
    try {
      setCardDownloading(a.id)
      await downloadAvatarImage(a.image_urls[0], a.name)
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setCardDownloading(null)
    }
  }

  return (
    <div className="px-4 pt-8 pb-16 sm:px-7">
      <PageHeader
        title="Аватар"
        subtitle="Один и тот же персонаж во всех кадрах. Создайте его один раз и используйте в любых сценах и пакетах."
        actions={
          <button type="button" onClick={() => setSelected("new")} className="flex h-10 items-center gap-2 rounded-[3px] bg-electric px-4 text-sm font-semibold text-white">
            <Plus className="size-4" /> Новый аватар
          </button>
        }
      />
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {isLoading && [0, 1, 2].map((i) => <div key={i} className="shimmer aspect-[3/4] rounded-[4px]" />)}
            {list?.map((a) => (
              <div
                key={a.id}
                className={cn(
                  "group relative flex flex-col overflow-hidden rounded-[4px] border bg-surface transition-colors",
                  a.id === editing?.id && selected !== "new" ? "border-electric" : "border-line hover:border-line-strong"
                )}
              >
                <button type="button" onClick={() => setSelected(a.id)} className="flex flex-col text-left">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={a.image_urls[0]} alt="" className="aspect-[3/4] w-full object-cover" />
                  <span className="border-t border-line p-3">
                    <span className="block truncate font-medium">{a.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">{a.appearance || "Без описания"}</span>
                  </span>
                </button>
                {a.image_urls[0] && (
                  <button
                    type="button"
                    disabled={cardDownloading === a.id}
                    onClick={() => downloadCard(a)}
                    className="absolute top-2 right-2 grid size-8 place-items-center rounded-[3px] bg-black/65 text-white opacity-0 backdrop-blur-xs transition-opacity group-hover:opacity-100 hover:bg-black/85 disabled:opacity-100"
                    aria-label={`Скачать аватар ${a.name}`}
                    title="Скачать аватар"
                  >
                    {cardDownloading === a.id ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={() => setSelected("new")}
              className="flex aspect-[3/4] flex-col items-center justify-center gap-2 rounded-[4px] border border-dashed border-line-strong text-sm text-foreground-2 hover:border-faint"
            >
              <Plus className="size-5" /> Новый аватар
            </button>
          </div>
          {editing && <Scene key={editing.id} avatar={editing} />}
        </div>
        <Editor
          key={editing?.id ?? "new"}
          avatar={editing}
          onSaved={(a) => setSelected(a.id)}
          onDeleted={() => setSelected(null)}
        />
      </div>
    </div>
  )
}
