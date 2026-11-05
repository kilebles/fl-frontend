"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Archive, Check, ChevronLeft, ChevronRight, Download, Loader2, Maximize2, Orbit, Plus, Square, Trash2, X } from "lucide-react"
import { toast } from "sonner"

import { PageHeader } from "@/components/shell/page-header"
import { api, avatars, type Avatar, type AvatarAngleId } from "@/lib/api"
import { useCurrentProject, withStyle } from "@/lib/project"
import { keys, useAvatars, useProjectStyle } from "@/lib/queries"
import { cn } from "@/lib/utils"

interface Reference {
  key: string | null
  url: string
}

const ALL_STUDIO_ANGLES: { id: AvatarAngleId; badge: string; short: string; hint: string; refOnly?: boolean }[] = [
  { id: "front", badge: "0°", short: "Крупно", hint: "Крупный портрет анфас (резкие черты лица)", refOnly: true },
  { id: "three_quarter", badge: "45°", short: "Полуоборот", hint: "Портрет 3/4" },
  { id: "profile", badge: "90°", short: "Профиль", hint: "Строгий профиль сбоку" },
  { id: "back", badge: "180°", short: "Спина", hint: "Вид со спины в полный рост (без дубля анфаса)" },
  { id: "full_body", badge: "0°/180°", short: "В рост", hint: "В полный рост спереди и со спины" },
]

const ANGLE_BADGE: Record<AvatarAngleId, { badge: string; short: string }> = {
  front: { badge: "0°", short: "Анфас" },
  three_quarter: { badge: "45°", short: "3/4" },
  profile: { badge: "90°", short: "Профиль" },
  back: { badge: "180°", short: "Спина" },
  full_body: { badge: "0°/180°", short: "В рост" },
}

function refDownloadHref(ref: Reference, label: string): string {
  return ref.key ? avatars.downloadUrl(ref.key, label) : ref.url
}

function Lightbox({
  refs,
  index,
  baseLabel,
  onIndex,
  onClose,
}: {
  refs: Reference[]
  index: number
  baseLabel: string
  onIndex: (next: number) => void
  onClose: () => void
}) {
  const current = refs[index]

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
      if (e.key === "ArrowLeft" && refs.length > 1) onIndex((index - 1 + refs.length) % refs.length)
      if (e.key === "ArrowRight" && refs.length > 1) onIndex((index + 1) % refs.length)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [index, refs.length, onClose, onIndex])

  if (!current) return null
  const label = refs.length > 1 ? `${baseLabel} - ${index + 1}` : baseLabel

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/82 p-4 backdrop-blur-xs"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div className="relative flex max-h-[90vh] max-w-5xl flex-col gap-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-3 text-white">
          <div className="flex items-center gap-2 text-sm">
            <span className="font-medium">{baseLabel}</span>
            <span className="rounded-[2px] bg-white/12 px-1.5 py-0.5 font-mono text-xs">
              {index === 0 ? "главный · #1" : `референс #${index + 1}`} / {refs.length}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <a
              href={refDownloadHref(current, label)}
              download={!current.key ? `${label}.jpg` : undefined}
              className="inline-flex h-8 items-center gap-1.5 rounded-[3px] bg-white/12 px-2.5 text-xs font-medium text-white transition-colors hover:bg-white/22"
            >
              <Download className="size-3.5" />
              Скачать
            </a>
            <button
              type="button"
              onClick={onClose}
              className="grid size-8 place-items-center rounded-[3px] bg-white/12 text-white transition-colors hover:bg-white/22"
              aria-label="Закрыть"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>
        <div className="relative flex items-center justify-center overflow-hidden rounded-[4px] border border-white/15 bg-black/50">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={current.url} alt="" className="max-h-[78vh] w-auto object-contain" />
          {refs.length > 1 && (
            <>
              <button
                type="button"
                onClick={() => onIndex((index - 1 + refs.length) % refs.length)}
                className="absolute left-3 grid size-9 place-items-center rounded-[3px] bg-black/65 text-white transition-colors hover:bg-black/85"
                aria-label="Предыдущий ракурс"
              >
                <ChevronLeft className="size-4.5" />
              </button>
              <button
                type="button"
                onClick={() => onIndex((index + 1) % refs.length)}
                className="absolute right-3 grid size-9 place-items-center rounded-[3px] bg-black/65 text-white transition-colors hover:bg-black/85"
                aria-label="Следующий ракурс"
              >
                <ChevronRight className="size-4.5" />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

/** Editor of one avatar (or a new one): references, 360° studio angles, name, appearance. */
function Editor({ avatar, onSaved, onDeleted }: { avatar: Avatar | null; onSaved: (a: Avatar) => void; onDeleted: () => void }) {
  const qc = useQueryClient()
  const file = useRef<HTMLInputElement>(null)
  const [projectId] = useCurrentProject()
  const [name, setName] = useState(avatar?.name ?? "")
  const [appearance, setAppearance] = useState(avatar?.appearance ?? "")
  const [refs, setRefs] = useState<Reference[]>(
    avatar ? avatar.image_keys.map((key, i) => ({ key, url: avatar.image_urls[i] })) : []
  )
  const [prevServerSig, setPrevServerSig] = useState(() => (avatar?.image_keys ?? []).join("|"))
  const [selectedAngles, setSelectedAngles] = useState<AvatarAngleId[]>(["three_quarter", "profile", "full_body"])
  const [previewIndex, setPreviewIndex] = useState<number | null>(null)

  // Merge newly generated 360° frames and respect canonical server slot ordering without clobbering local edits
  const serverSig = (avatar?.image_keys ?? []).join("|")
  if (serverSig !== prevServerSig) {
    setPrevServerSig(serverSig)
    if (avatar) {
      const prevSet = new Set(prevServerSig ? prevServerSig.split("|") : [])
      const serverSet = new Set(avatar.image_keys)
      setRefs((curr) => {
        const currByKey = new Map(curr.filter((r) => !!r.key).map((r) => [r.key!, r]))
        const orderedServer: Reference[] = []
        avatar.image_keys.forEach((key, idx) => {
          const local = currByKey.get(key)
          if (local) {
            orderedServer.push({ key, url: avatar.image_urls[idx] })
          } else if (!prevSet.has(key)) {
            orderedServer.push({ key, url: avatar.image_urls[idx] })
          }
        })
        const localUnsaved = curr.filter((r) => !r.key || !serverSet.has(r.key))
        return [...orderedServer, ...localUnsaved].slice(0, 8)
      })
    }
  }

  const uploading = refs.some((r) => !r.key)
  const readyRefs = refs.filter((r) => !!r.key)
  const primaryKey = readyRefs[0]?.key ?? null
  const packActive = !!avatar?.pack_job_id
  const pendingTiles = packActive ? (avatar?.pack_angles ?? []).slice(0, Math.max(0, 8 - refs.length)) : []
  const baseLabel = name.trim() || avatar?.name || "avatar"

  const [prevPrimaryKey, setPrevPrimaryKey] = useState<string | null>(primaryKey)
  const [appliedKey, setAppliedKey] = useState<string | null>(null)
  const [manualKey, setManualKey] = useState<string | null>(null)

  if (primaryKey !== prevPrimaryKey) {
    setPrevPrimaryKey(primaryKey)
    if (!primaryKey) {
      setSelectedAngles((prev) => {
        const withoutFront = prev.filter((a) => a !== "front")
        return withoutFront.length > 0 ? withoutFront : ["three_quarter", "profile", "full_body"]
      })
    }
  }

  const analysisQuery = useQuery({
    queryKey: ["avatar-ref-analysis", primaryKey],
    queryFn: () => avatars.analyzeReference(primaryKey!),
    enabled: !!primaryKey && !packActive && readyRefs.length < 4,
    staleTime: Infinity,
    gcTime: 30 * 60_000,
    retry: false,
  })

  const analysis = primaryKey && analysisQuery.data?.key === primaryKey ? analysisQuery.data : null
  if (analysis && appliedKey !== analysis.key) {
    setAppliedKey(analysis.key)
    if (manualKey !== analysis.key && analysis.recommended_angles.length > 0) {
      setSelectedAngles(analysis.recommended_angles)
    }
  }

  const studioAngles = readyRefs.length > 0 ? ALL_STUDIO_ANGLES : ALL_STUDIO_ANGLES.filter((a) => !a.refOnly)

  const toggleAngle = (id: AvatarAngleId) => {
    if (primaryKey) setManualKey(primaryKey)
    setSelectedAngles((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const resetAutoAngles = () => {
    if (!analysis) return
    setManualKey(null)
    setSelectedAngles(analysis.recommended_angles)
  }

  const [showExtraAngles, setShowExtraAngles] = useState(false)
  const passportComplete = readyRefs.length >= 4 && !packActive
  if (!passportComplete && showExtraAngles) {
    setShowExtraAngles(false)
  }

  const add = async (files: FileList | null) => {
    const incoming = Array.from(files ?? []).slice(0, 8 - refs.length - pendingTiles.length)
    if (!incoming.length) return
    const existingKeys = readyRefs.map((r) => r.key!)
    const uploadedKeys: string[] = []
    for (const f of incoming) {
      const url = URL.createObjectURL(f)
      setRefs((r) => [...r, { key: null, url }])
      try {
        const { key } = await api.upload(f)
        uploadedKeys.push(key)
        setRefs((r) => r.map((x) => (x.url === url ? { ...x, key } : x)))
      } catch (e) {
        setRefs((r) => r.filter((x) => x.url !== url))
        toast.error((e as Error).message)
      }
    }
    const allKeys = [...existingKeys, ...uploadedKeys]
    if (uploadedKeys.length > 0 && allKeys.length >= 2) {
      try {
        const { keys: sorted } = await avatars.orderReferences(allKeys)
        setRefs((curr) => {
          const byKey = new Map(curr.filter((r) => !!r.key).map((r) => [r.key!, r]))
          const ordered = sorted.map((k) => byKey.get(k)).filter((x): x is Reference => !!x)
          const rest = curr.filter((r) => !r.key || !sorted.includes(r.key))
          return [...ordered, ...rest]
        })
      } catch {
        // Server also enforces canonical order on save
      }
    }
  }

  const save = useMutation({
    mutationFn: () => {
      const imageKeys = readyRefs.map((r) => r.key!)
      if (avatar && imageKeys.length === 0) {
        return avatars.update(avatar.id, { name, appearance })
      }
      const body = { name, appearance, image_keys: imageKeys }
      return avatar ? avatars.update(avatar.id, body) : avatars.create(body)
    },
    onSuccess: (a) => {
      setShowExtraAngles(false)
      setPrevServerSig(a.image_keys.join("|"))
      setRefs(a.image_keys.map((key, idx) => ({ key, url: a.image_urls[idx] })))
      qc.invalidateQueries({ queryKey: keys.avatars })
      toast.success("Аватар сохранён")
      onSaved(a)
    },
    onError: (e) => toast.error(e.message),
  })

  const runStudio = useMutation({
    mutationFn: async () => {
      if (readyRefs.length === 0) {
        return avatars.generate({
          name: name.trim() || "Новый аватар",
          appearance: appearance.trim(),
          angles: selectedAngles,
          project_id: projectId,
        })
      }
      const imageKeys = readyRefs.map((r) => r.key!)
      let target = avatar
      if (!target) {
        target = await avatars.create({
          name: name.trim() || "Новый аватар",
          appearance: appearance.trim(),
          image_keys: imageKeys,
        })
      } else {
        target = await avatars.update(target.id, {
          name: name.trim() || target.name,
          appearance: appearance.trim(),
          image_keys: imageKeys,
        })
      }
      return avatars.buildAngles(target.id, {
        angles: selectedAngles,
        project_id: projectId,
      })
    },
    onSuccess: (a) => {
      setShowExtraAngles(false)
      setPrevServerSig(a.image_keys.join("|"))
      qc.invalidateQueries({ queryKey: keys.avatars })
      qc.invalidateQueries({ queryKey: keys.jobs })
      toast.success(
        a.pack_stage === "base"
          ? "Генерируем анфас 0° и студийные ракурсы 360°"
          : "Генерация ракурсов 360° запущена — кадры появятся автоматически"
      )
      onSaved(a)
    },
    onError: (e) => toast.error(e.message),
  })

  const cancelStudio = useMutation({
    mutationFn: () => avatars.cancelAngles(avatar!.id),
    onSuccess: (a) => {
      qc.invalidateQueries({ queryKey: keys.avatars })
      qc.invalidateQueries({ queryKey: keys.jobs })
      toast("Генерация ракурсов остановлена")
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

  const studioDisabled =
    uploading ||
    analysisQuery.isFetching ||
    runStudio.isPending ||
    (readyRefs.length > 0
      ? selectedAngles.length === 0 || readyRefs.length >= 8
      : !name.trim() || !appearance.trim())

  const packDone = avatar?.pack_done ?? 0
  const packTotal = avatar?.pack_total || (selectedAngles.length || 3)
  const packPct = packTotal > 0 ? Math.min(100, Math.round((packDone / packTotal) * 100)) : 0

  return (
    <section className="flex flex-col gap-4 rounded-[4px] border border-line bg-surface p-5">
      <div className="flex gap-4">
        <div className="group relative aspect-[3/4] w-28 shrink-0 overflow-hidden rounded-[3px] bg-surface-2">
          {refs[0] ? (
            <button
              type="button"
              onClick={() => setPreviewIndex(0)}
              className="size-full cursor-pointer"
              title="Открыть в полном размере"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={refs[0].url} alt="" className="size-full object-cover" />
              <span className="absolute right-1.5 bottom-1.5 grid size-6 place-items-center rounded-[2px] bg-black/65 text-white opacity-0 transition-opacity group-hover:opacity-100">
                <Maximize2 className="size-3" />
              </span>
            </button>
          ) : packActive ? (
            <div className="shimmer flex size-full flex-col items-center justify-center gap-1.5 text-muted-foreground">
              <Loader2 className="size-4 animate-spin text-pick-text" />
              <span className="font-mono text-[10px]">0° портрет</span>
            </div>
          ) : null}
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <p className="truncate text-lg font-semibold">{name || "Новый аватар"}</p>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            {refs.length
              ? `${refs.length} референс${refs.length === 1 ? "" : refs.length < 5 ? "а" : "ов"}`
              : "Загрузите портрет или создайте по описанию"}
          </p>
          {packActive ? (
            <span className="mt-2 inline-flex w-fit items-center gap-1.5 rounded-[2px] bg-pick-soft px-2 py-0.5 text-xs text-pick-text">
              <Loader2 className="size-3 animate-spin" />
              {avatar?.pack_stage === "base" ? "Создаём анфас 0°…" : `Достраиваем 360° (${packDone}/${packTotal})`}
            </span>
          ) : (
            avatar &&
            refs.length > 0 && (
              <span className="mt-2 inline-block w-fit rounded-[2px] bg-ok/12 px-2 py-0.5 text-xs text-ok">
                {refs.length >= 4 ? "Готов · паспорт 360°" : "Готов к работе"}
              </span>
            )
          )}
          {refs[0] && (
            <div className="mt-auto flex flex-wrap gap-1.5 pt-3">
              <a
                href={refDownloadHref(refs[0], baseLabel)}
                download={!refs[0].key ? `${baseLabel}.jpg` : undefined}
                className="inline-flex h-8 items-center gap-1.5 rounded-[3px] border border-line-strong bg-surface-2 px-2.5 text-xs font-medium transition-colors hover:border-electric/50 hover:text-electric"
              >
                <Download className="size-3.5" />
                Скачать аватар
              </a>
              {readyRefs.length > 1 && (
                <a
                  href={avatars.zipUrl({ keys: readyRefs.map((r) => r.key!), name: baseLabel })}
                  className="inline-flex h-8 items-center gap-1.5 rounded-[3px] border border-line-strong px-2.5 text-xs text-muted-foreground transition-colors hover:border-faint hover:text-foreground"
                  title="Скачать все референсы аватара одним .zip архивом"
                >
                  <Archive className="size-3.5" />
                  Все ({readyRefs.length}) .zip
                </a>
              )}
            </div>
          )}
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-baseline justify-between gap-2">
          <p className="text-[13px] text-muted-foreground">Референсы</p>
          {refs.length > 0 && (
            <span className="font-mono text-[11px] text-muted-foreground">
              {refs.length > 4 ? `В Flow: 4 из ${refs.length}` : `В Flow: ${refs.length}/4`}
            </span>
          )}
        </div>
        <div className="grid grid-cols-4 gap-2">
          {refs.map((r, i) => (
            <div
              key={r.key ?? r.url}
              draggable={false}
              className={cn(
                "group relative aspect-square select-none overflow-hidden rounded-[3px] bg-surface-2",
                i === 0 && "ring-1 ring-electric/70"
              )}
            >
              <button
                type="button"
                onClick={() => setPreviewIndex(i)}
                className="size-full cursor-pointer"
                title="Открыть в полном размере"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={r.url}
                  alt=""
                  draggable={false}
                  className={cn("size-full object-cover", !r.key && "opacity-40")}
                />
                <span className="pointer-events-none absolute right-1 bottom-1 grid size-5 place-items-center rounded-[2px] bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100">
                  <Maximize2 className="size-3" />
                </span>
              </button>
              {!r.key && <Loader2 className="absolute inset-0 m-auto size-4 animate-spin" />}
              {i === 0 ? (
                <span className="pointer-events-none absolute bottom-1 left-1 rounded-[2px] bg-black/65 px-1 text-[10px] text-white">
                  главный
                </span>
              ) : (
                i < 4 && (
                  <span
                    className="pointer-events-none absolute bottom-1 left-1 rounded-[2px] bg-black/60 px-1 font-mono text-[10px] text-white/90"
                    title="Передаётся в Flow как дополнительный ракурс"
                  >
                    #{i + 1}
                  </span>
                )
              )}
              <a
                href={refDownloadHref(r, `${baseLabel}${refs.length > 1 ? ` - ${i + 1}` : ""}`)}
                download={!r.key ? `${baseLabel} - ${i + 1}.jpg` : undefined}
                draggable={false}
                className="absolute top-1 left-1 grid size-5 place-items-center rounded-[2px] bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100 hover:bg-black/80"
                aria-label="Скачать референс"
                title="Скачать референс"
              >
                <Download className="size-3" />
              </a>
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
          {pendingTiles.map((angleId) => (
            <div
              key={`pending-${angleId}`}
              className="shimmer flex aspect-square flex-col items-center justify-center gap-0.5 rounded-[3px] border border-line-strong px-1 text-center"
              title="Ракурс генерируется в студии"
            >
              <Loader2 className="size-3.5 animate-spin text-pick-text" />
              <span className="font-mono text-[10px] font-medium text-foreground">{ANGLE_BADGE[angleId]?.badge}</span>
              <span className="w-full truncate text-[10px] text-muted-foreground">{ANGLE_BADGE[angleId]?.short}</span>
            </div>
          ))}
          {refs.length + pendingTiles.length < 8 && (
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
        <p className="mt-2 text-[13px] text-muted-foreground">
          {refs.length > 1
            ? `Первые ${Math.min(refs.length, 4)} слота уходят в Flow вместе — персонаж держит лицо и костюм с разных углов.`
            : "Главный референс задаёт лицо в кадрах. Достройте ракурсы 360°, чтобы стабилизировать повороты и общий план."}
        </p>
      </div>

      <label className="flex flex-col gap-2">
        <span className="text-[13px] text-muted-foreground">Имя</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ганнибал"
          className="h-10 rounded-[3px] border border-line-strong bg-background px-3 outline-none placeholder:text-faint focus:border-electric/60"
        />
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

      {passportComplete && !showExtraAngles ? (
        <div className="flex items-center justify-between gap-2 rounded-[3px] border border-line bg-surface-2/60 px-3.5 py-2.5">
          <span className="flex items-center gap-2 text-[13px] text-foreground-2">
            <Check className="size-3.5 text-ok" />
            Паспорт 360° готов
          </span>
          <div className="flex items-center gap-2.5">
            <span className="font-mono text-[11px] text-muted-foreground">4/4 в Flow</span>
            {readyRefs.length < 8 && (
              <button
                type="button"
                onClick={() => {
                  setSelectedAngles([])
                  setShowExtraAngles(true)
                }}
                className="text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                + ракурс
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5 rounded-[3px] border border-line-strong bg-surface-2 p-3.5">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-[13px] font-medium text-foreground">
              <Orbit className="size-3.5 text-electric" />
              Паспорт ракурсов 360°
            </span>
            {passportComplete ? (
              <button
                type="button"
                onClick={() => setShowExtraAngles(false)}
                className="text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                Скрыть
              </button>
            ) : (
              <span className="font-mono text-[11px] text-muted-foreground">
                {readyRefs.length > 0 ? "по главному фото" : "с нуля по описанию"}
              </span>
            )}
          </div>

          {readyRefs.length > 0 && readyRefs.length < 4 && !packActive && (
            <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
              {analysisQuery.isFetching ? (
                <span className="inline-flex items-center gap-1.5">
                  <Loader2 className="size-3 animate-spin text-pick-text" />
                  Определяем план и ракурс фото…
                </span>
              ) : analysis?.detected ? (
                <>
                  <span className="min-w-0 truncate">
                    Исходник: <span className="text-foreground">{analysis.summary_ru}</span> — без дублей
                  </span>
                  {manualKey === primaryKey && (
                    <button
                      type="button"
                      onClick={resetAutoAngles}
                      className="shrink-0 font-mono text-[11px] text-electric hover:underline"
                      title="Вернуть автовыбор ракурсов по главному фото"
                    >
                      Авто
                    </button>
                  )}
                </>
              ) : null}
            </div>
          )}

          <div className="flex flex-wrap gap-1.5">
            {studioAngles.map((angle) => {
              const active = selectedAngles.includes(angle.id)
              return (
                <button
                  key={angle.id}
                  type="button"
                  disabled={packActive}
                  onClick={() => toggleAngle(angle.id)}
                  title={angle.hint}
                  className={cn(
                    "inline-flex h-7 items-center gap-1 rounded-[2px] border px-2 text-xs transition-colors disabled:opacity-60",
                    active
                      ? "border-pick/60 bg-pick-soft text-pick-text"
                      : "border-line-strong bg-surface text-muted-foreground hover:border-faint hover:text-foreground"
                  )}
                >
                  <span className="font-mono text-[10px] opacity-80">{angle.badge}</span>
                  <span>{angle.short}</span>
                </button>
              )
            })}
          </div>

          {packActive ? (
            <div className="flex flex-col gap-2 pt-0.5">
              <div className="h-1.5 w-full overflow-hidden rounded-[2px] bg-elev">
                <div
                  className="bar-running h-full transition-all duration-300"
                  style={{ width: `${Math.max(12, packPct)}%` }}
                />
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">
                  {avatar?.pack_stage === "base"
                    ? "Шаг 1/2: генерируем базовый анфас 0°…"
                    : `Готово ракурсов: ${packDone} из ${packTotal}`}
                </span>
                <button
                  type="button"
                  disabled={cancelStudio.isPending}
                  onClick={() => cancelStudio.mutate()}
                  className="inline-flex h-7 items-center gap-1 rounded-[2px] border border-line-strong bg-surface px-2 text-xs text-muted-foreground transition-colors hover:border-danger/50 hover:text-danger"
                >
                  <Square className="size-2.5 fill-current" />
                  Стоп
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              disabled={studioDisabled}
              onClick={() => runStudio.mutate()}
              className="flex h-9 items-center justify-center gap-2 rounded-[3px] border border-electric/45 bg-electric-soft px-3 text-xs font-medium text-electric-text transition-colors hover:border-electric disabled:opacity-40"
            >
              {runStudio.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Orbit className="size-3.5" />}
              {readyRefs.length > 0
                ? `Достроить ракурсы 360° (+${Math.min(selectedAngles.length, Math.max(0, 8 - readyRefs.length))})`
                : `Создать по описанию (анфас 0° + ${selectedAngles.length} рак.)`}
            </button>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {avatar && readyRefs.length > 0 && (
          <Link href="/batch" className="flex h-9 items-center rounded-[3px] border border-line-strong px-3.5 text-sm hover:border-faint">
            Пакет с этим аватаром
          </Link>
        )}
        <button
          type="button"
          disabled={!name.trim() || (!readyRefs.length && !avatar) || uploading || save.isPending}
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

      {previewIndex !== null && refs[previewIndex] && (
        <Lightbox
          refs={refs}
          index={previewIndex}
          baseLabel={baseLabel}
          onIndex={setPreviewIndex}
          onClose={() => setPreviewIndex(null)}
        />
      )}
    </section>
  )
}

/** A quick scene with the avatar: avatar → image → video, one generation. */
function Scene({ avatar }: { avatar: Avatar }) {
  const qc = useQueryClient()
  const [projectId] = useCurrentProject()
  const style = useProjectStyle(projectId)
  const [text, setText] = useState("")
  const activeRefs = Math.min(avatar.image_keys.length, 4)

  const create = useMutation({
    mutationFn: () =>
      api.createJob({
        mode: "i2i2v",
        title: text.trim().slice(0, 200),
        project_id: projectId,
        avatar: avatar.image_keys[0],
        avatar_keys: avatar.image_keys,
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
        {activeRefs > 1 && <span className="font-mono text-xs text-muted-foreground">{activeRefs} рак. в Flow</span>}
        <span className="font-mono text-xs text-muted-foreground">16:9</span>
        <button
          type="button"
          disabled={!text.trim() || !avatar.image_keys.length || create.isPending}
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
  const current = selected === "new" ? null : (list?.find((a) => a.id === selected) ?? list?.[0] ?? null)
  const editing = selected === "new" || !list?.length ? null : current

  return (
    <div className="px-4 pt-8 pb-16 sm:px-7">
      <PageHeader
        title="Аватар"
        subtitle="Один и тот же персонаж во всех кадрах. Загрузите портрет или соберите паспорт ракурсов 360° для стабильного видео."
        actions={
          <button
            type="button"
            onClick={() => setSelected("new")}
            className="flex h-10 items-center gap-2 rounded-[3px] bg-electric px-4 text-sm font-semibold text-white"
          >
            <Plus className="size-4" /> Новый аватар
          </button>
        }
      />
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {isLoading && [0, 1, 2].map((i) => <div key={i} className="shimmer aspect-[3/4] rounded-[4px]" />)}
            {list?.map((a) => {
              const busy = !!a.pack_job_id
              return (
                <div
                  key={a.id}
                  className={cn(
                    "group relative flex flex-col overflow-hidden rounded-[4px] border bg-surface transition-colors",
                    a.id === editing?.id && selected !== "new" ? "border-electric" : "border-line hover:border-line-strong"
                  )}
                >
                  <button type="button" onClick={() => setSelected(a.id)} className="flex flex-col text-left">
                    {a.image_urls[0] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={a.image_urls[0]} alt="" className="aspect-[3/4] w-full object-cover" />
                    ) : (
                      <span className="shimmer flex aspect-[3/4] w-full flex-col items-center justify-center gap-2 text-muted-foreground">
                        <Loader2 className="size-5 animate-spin text-pick-text" />
                        <span className="font-mono text-[11px]">Портрет 0°…</span>
                      </span>
                    )}
                    <span className="border-t border-line p-3">
                      <span className="block truncate font-medium">{a.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">{a.appearance || "Без описания"}</span>
                    </span>
                  </button>
                  {busy ? (
                    <span className="pointer-events-none absolute top-2 left-2 inline-flex items-center gap-1.5 rounded-[3px] border border-pick/45 bg-pick-soft/95 px-2 py-0.5 font-mono text-[10px] text-pick-text backdrop-blur-xs">
                      <Loader2 className="size-2.5 animate-spin" />
                      360° · {a.pack_done ?? 0}/{a.pack_total || 3}
                    </span>
                  ) : (
                    a.image_keys.length >= 2 && (
                      <span className="pointer-events-none absolute top-2 left-2 rounded-[3px] bg-black/65 px-1.5 py-0.5 font-mono text-[10px] text-white backdrop-blur-xs">
                        {a.image_keys.length >= 4 ? `360° · ${a.image_keys.length}` : `${a.image_keys.length} рак.`}
                      </span>
                    )
                  )}
                  {a.image_keys[0] && (
                    <a
                      href={
                        a.image_keys.length > 1
                          ? avatars.zipUrl({ id: a.id, name: a.name })
                          : avatars.downloadUrl(a.image_keys[0], a.name)
                      }
                      className="absolute top-2 right-2 grid size-8 place-items-center rounded-[3px] bg-black/65 text-white opacity-0 backdrop-blur-xs transition-opacity group-hover:opacity-100 hover:bg-black/85"
                      aria-label={`Скачать аватар ${a.name}`}
                      title={a.image_keys.length > 1 ? "Скачать все ракурсы (.zip)" : "Скачать аватар"}
                    >
                      {a.image_keys.length > 1 ? <Archive className="size-3.5" /> : <Download className="size-3.5" />}
                    </a>
                  )}
                </div>
              )
            })}
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
