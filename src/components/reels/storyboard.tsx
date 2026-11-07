"use client"

import { Fragment, useMemo, useState } from "react"
import { ChevronDown, Copy, Download, TriangleAlert } from "lucide-react"
import { toast } from "sonner"

import { BASE_CATEGORIES, CATEGORIES, CAT_BG, CAT_LABEL, CAT_SHORT, CAT_TEXT, TYPE_LABEL, clock, shotsText } from "@/components/reels/parts"
import { Card } from "@/components/script/ui"
import type { ReelBrief, ReelCategory, ReelParagraph, ReelShot, ReelStoryboard } from "@/lib/api"
import { cn } from "@/lib/utils"

type Filter = ReelCategory | "weak" | "all"
const WEAK = 4

const clean = (s: string) => s.replace(/[\t\r\n]+/g, " ").trim()

/** Tab-separated table for Google Sheets: one row per shot. */
function tsv(sb: ReelStoryboard): string {
  const head = ["Кадр", "Начало", "Секунд", "Категория", "Тип", "Что в кадре", "Задание ИИ", "Стоки", "Архивы", "YouTube", "Карточка"]
  const rows = sb.shots.map((s) => [
    s.id,
    clock(s.start),
    s.sec.toFixed(1).replace(".", ","),
    CAT_LABEL[s.category],
    TYPE_LABEL[s.type] ?? s.type,
    clean(s.show),
    clean(s.ai),
    (s.queries.stock ?? []).join("; "),
    (s.queries.archive ?? []).join("; "),
    (s.queries.youtube ?? []).join("; "),
    s.card?.subject ? clean([s.card.subject, s.card.caption].filter(Boolean).join(" — ")) : "",
  ])
  return [head, ...rows].map((r) => r.join("\t")).join("\n")
}

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "application/json" }))
  const a = document.createElement("a")
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function FitBars({ shot, host }: { shot: ReelShot; host: boolean }) {
  const cats = host ? CATEGORIES : BASE_CATEGORIES
  return (
    <div className={cn("grid gap-2", cats.length > 5 ? "grid-cols-3 sm:grid-cols-6" : "grid-cols-5")}>
      {cats.map((c) => (
        <div key={c} className="min-w-0">
          <div className="mb-1 flex justify-between font-mono text-[11px]">
            <span className={c === shot.category ? "font-medium text-foreground" : "text-faint"}>{CAT_SHORT[c]}</span>
            <span className={c === shot.category ? "text-foreground" : "text-faint"}>{shot.fit[c] ?? 0}</span>
          </div>
          <div className="h-1 overflow-hidden rounded-full bg-elev">
            <div className={cn("h-full rounded-full", CAT_BG[c], c !== shot.category && "opacity-40")} style={{ width: `${(shot.fit[c] ?? 0) * 10}%` }} />
          </div>
        </div>
      ))}
    </div>
  )
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[96px_minmax(0,1fr)] gap-3 text-xs">
      <span className="text-faint">{label}</span>
      <span className="min-w-0 break-words text-foreground-2">{children}</span>
    </div>
  )
}

function ShotRow({ shot, open, onToggle, host }: { shot: ReelShot; open: boolean; onToggle: () => void; host: boolean }) {
  const weak = (shot.fit[shot.category] ?? 0) < WEAK
  const q = [
    ["стоки", shot.queries.stock],
    ["архивы", shot.queries.archive],
    ["YouTube", shot.queries.youtube],
  ].filter(([, v]) => v?.length) as [string, string[]][]
  return (
    <li id={`shot-${shot.id}`} className="scroll-mt-24">
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          "grid w-full grid-cols-[44px_44px_minmax(0,1fr)_16px] items-center gap-x-3 rounded-[3px] px-2 py-1.5 text-left transition-colors hover:bg-surface-2 sm:grid-cols-[44px_44px_136px_minmax(0,1fr)_16px]",
          open && "bg-surface-2",
        )}
      >
        <span className="font-mono text-[11px] text-faint">{shot.id}</span>
        <span className="font-mono text-[11px] text-muted-foreground">{shot.sec.toFixed(1)} с</span>
        <span className="hidden min-w-0 items-center gap-1.5 text-xs sm:flex">
          <span className={cn("size-2 shrink-0 rounded-full", CAT_BG[shot.category])} />
          <span className={cn("truncate", CAT_TEXT[shot.category])}>{TYPE_LABEL[shot.type] ?? shot.type}</span>
          {weak && <TriangleAlert className="size-3 shrink-0 text-warn" aria-label="слабое попадание" />}
        </span>
        <span className="flex min-w-0 items-center gap-1.5 text-[13px] text-foreground-2">
          <span className={cn("size-2 shrink-0 rounded-full sm:hidden", CAT_BG[shot.category])} />
          <span className={cn("min-w-0", open ? "whitespace-normal" : "truncate")}>{shot.show}</span>
        </span>
        <ChevronDown className={cn("size-3.5 text-faint transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="mx-2 mt-1 mb-2 space-y-2.5 rounded-[3px] border border-line bg-background p-3">
          <FitBars shot={shot} host={host} />
          {shot.category === "avatar" && <Detail label="Ведущий">произносит этот абзац в кадре сам; диктор на нём молчит</Detail>}
          {shot.category === "ai" && shot.ai && <Detail label="Задание ИИ">{shot.ai}</Detail>}
          {(shot.category === "video" || shot.category === "history") &&
            q.map(([k, v]) => (
              <Detail key={k} label={`Запросы: ${k}`}>
                <span className="font-mono text-[11px]">{v.join(" · ")}</span>
              </Detail>
            ))}
          {shot.category === "graphics" && shot.card?.subject && (
            <Detail label="Карточка">{[shot.card.subject, shot.card.caption].filter(Boolean).join(" — ")}</Detail>
          )}
          {shot.category === "infographics" && (
            <Detail label="Инфографика">
              {[TYPE_LABEL[shot.info?.type || "auto"] ?? shot.info?.type, shot.info?.brief].filter(Boolean).join(" — ")}
            </Detail>
          )}
          {shot.category !== "ai" && shot.ai && <Detail label="Если на ИИ">{shot.ai}</Detail>}
          {shot.avoid.length > 0 && <Detail label="Избегать">{shot.avoid.join(", ")}</Detail>}
          {shot.fallback && <Detail label="Внимание">модель не дала кадры этого абзаца — собраны кодом поровну</Detail>}
        </div>
      )}
    </li>
  )
}

/** The whole film as one strip: a segment per shot, coloured by category; click jumps to the shot. */
function FilmStrip({ shots, filter, onPick }: { shots: ReelShot[]; filter: Filter; onPick: (id: string) => void }) {
  return (
    <div className="flex h-5 overflow-hidden rounded-[2px] bg-elev">
      {shots.map((s) => {
        const on = filter === "all" || s.category === filter || (filter === "weak" && (s.fit[s.category] ?? 0) < WEAK)
        return (
          <button
            key={s.id}
            type="button"
            title={`${s.id} · ${clock(s.start)} · ${CAT_LABEL[s.category]} · ${s.show}`}
            onClick={() => onPick(s.id)}
            className={cn("h-full border-r border-background/60 last:border-r-0", CAT_BG[s.category], !on && "opacity-15")}
            style={{ flexGrow: s.sec, flexBasis: 0 }}
          />
        )
      })}
    </div>
  )
}

/** Mood of a chapter from the brief: by its title, else by the paragraph it starts at. */
function chapterMood(brief: ReelBrief, title: string, n: number) {
  const norm = (t: string) => t.toLowerCase().replace(/^(глава|chapter)\s*\d*[.:]?\s*/, "").trim()
  const list = brief.chapters ?? []
  return list.find((c) => c.title && norm(c.title) === norm(title)) ?? list.find((c) => c.first_paragraph === n)
}

export function StoryboardCard({ sb }: { sb: ReelStoryboard }) {
  const [filter, setFilter] = useState<Filter>("all")
  const [open, setOpen] = useState<string | null>(null)
  const byPara = useMemo(() => {
    const m = new Map<number, ReelShot[]>()
    for (const s of sb.shots) m.set(s.paragraph, [...(m.get(s.paragraph) ?? []), s])
    return m
  }, [sb.shots])
  const match = (s: ReelShot) =>
    filter === "all" || s.category === filter || (filter === "weak" && (s.fit[s.category] ?? 0) < WEAK)
  const weak = sb.shots.filter((s) => (s.fit[s.category] ?? 0) < WEAK).length
  const starts = useMemo(() => {
    const m = new Map<number, number>()
    for (const s of sb.shots) if (!m.has(s.paragraph)) m.set(s.paragraph, s.start)
    return m
  }, [sb.shots])

  const pick = (id: string) => {
    setFilter("all")
    setOpen(id)
    setTimeout(() => document.getElementById(`shot-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 50)
  }

  const chips: [Filter, string, number][] = [
    ["all", "Все", sb.shots.length],
    ...CATEGORIES.filter((c) => c !== "avatar" || (sb.mix.shots.avatar ?? 0) > 0).map((c) => [c, CAT_LABEL[c], sb.mix.shots[c] ?? 0] as [Filter, string, number]),
    ...(weak ? [["weak", "Слабые", weak] as [Filter, string, number]] : []),
  ]

  // видимые абзацы по фильтру; заголовок главы — у первого видимого абзаца главы
  const visible: { p: ReelParagraph; shots: ReelShot[]; heading: string }[] = []
  let lastChapter = ""
  for (const p of sb.paragraphs) {
    const shots = (byPara.get(p.number) ?? []).filter(match)
    if (!shots.length) continue
    const heading = p.chapter && p.chapter !== lastChapter ? p.chapter : ""
    if (heading) lastChapter = p.chapter
    visible.push({ p, shots, heading })
  }

  return (
    <Card
      title="Раскадровка"
      aside={
        <div className="flex items-center gap-1">
          <button
            type="button"
            title="Скопировать таблицу кадров для Google Sheets"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(tsv(sb))
                toast.success(`Скопировано: ${shotsText(sb.shots.length)}`)
              } catch {
                toast.error("Не получилось скопировать")
              }
            }}
            className="flex h-7 items-center gap-1.5 rounded-[3px] px-2 text-xs text-muted-foreground hover:bg-elev hover:text-foreground"
          >
            <Copy className="size-3.5" />
            Таблица
          </button>
          <button
            type="button"
            title="Раскадровка целиком, .json"
            onClick={() => download("storyboard.json", JSON.stringify(sb, null, 1))}
            className="flex h-7 items-center gap-1.5 rounded-[3px] px-2 text-xs text-muted-foreground hover:bg-elev hover:text-foreground"
          >
            <Download className="size-3.5" />
            .json
          </button>
        </div>
      }
      bodyClass="p-0"
    >
      <div className="space-y-3 border-b border-line p-4">
        <div className="flex flex-wrap gap-1.5">
          {chips.map(([id, label, n]) => (
            <button
              key={id}
              type="button"
              onClick={() => setFilter(id)}
              className={cn(
                "flex h-7 items-center gap-1.5 rounded-[3px] border px-2.5 text-xs transition-colors",
                filter === id ? "border-pick/40 bg-pick-soft font-medium text-pick-text" : "border-line-strong text-muted-foreground hover:text-foreground",
              )}
            >
              {id !== "all" && id !== "weak" && <span className={cn("size-2 rounded-full", CAT_BG[id as ReelCategory])} />}
              {id === "weak" && <TriangleAlert className="size-3 text-warn" />}
              {label}
              <span className="font-mono text-[11px] text-faint">{n}</span>
            </button>
          ))}
        </div>
        <FilmStrip shots={sb.shots} filter={filter} onPick={pick} />
        <div className="flex justify-between font-mono text-[11px] text-faint">
          <span>0:00</span>
          <span>{clock(sb.mix.total_sec / 2)}</span>
          <span>{clock(sb.mix.total_sec)}</span>
        </div>
      </div>
      <ol className="divide-y divide-line">
        {visible.map(({ p, shots, heading }) => {
          const mood = heading ? chapterMood(sb.brief, heading, p.number) : undefined
          return (
            <Fragment key={p.number}>
              {heading && (
                <li className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 bg-surface-2/60 px-4 py-2">
                  <span className="text-[13px] font-semibold">{heading}</span>
                  {mood?.mood && <span className="font-mono text-[11px] text-faint">музыка: {[mood.mood, mood.tempo].filter(Boolean).join(" · ")}</span>}
                </li>
              )}
              <li className="grid grid-cols-1 gap-x-5 gap-y-2 px-4 py-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
                <div className="min-w-0">
                  <div className="mb-1 flex items-center gap-2 font-mono text-[11px] text-faint">
                    <span className="font-medium text-foreground-2">{p.number}</span>
                    <span>{clock(starts.get(p.number) ?? 0)}</span>
                    <span>
                      {p.duration.toFixed(1)} с{p.duration_source === "chars" ? " по тексту" : ""}
                    </span>
                    {sb.fallback_paragraphs.includes(p.number) && <span className="text-warn">без ответа модели</span>}
                  </div>
                  <p className="text-[13px] leading-relaxed text-muted-foreground">{p.text}</p>
                </div>
                <ul className="min-w-0">
                  {shots.map((s) => (
                    <ShotRow key={s.id} shot={s} host={!!sb.direction?.host} open={open === s.id} onToggle={() => setOpen(open === s.id ? null : s.id)} />
                  ))}
                </ul>
              </li>
            </Fragment>
          )
        })}
      </ol>
    </Card>
  )
}

export function BriefCard({ brief }: { brief: ReelBrief }) {
  const rows = [
    ["Эпоха", brief.era],
    ["Место", brief.setting],
    ["Вид фильма", brief.look],
    ["Реальный материал", brief.real_material],
  ].filter(([, v]) => v) as [string, string][]
  const names = [...(brief.people ?? []).map((x) => x.name), ...(brief.places ?? []).map((x) => x.name)].filter(Boolean)
  if (!rows.length && !brief.chapters?.length) return null
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <Card title="Бриф фильма">
        <div className="space-y-2.5">
          {rows.map(([k, v]) => (
            <Detail key={k} label={k}>
              {v}
            </Detail>
          ))}
          {names.length > 0 && <Detail label="Люди и места">{names.join(", ")}</Detail>}
          {!!brief.rules?.length && <Detail label="Не показывать">{brief.rules.join("; ")}</Detail>}
        </div>
      </Card>
      {!!brief.chapters?.length && (
        <Card title="Главы и музыка" bodyClass="p-0">
          <ol className="py-1.5">
            {brief.chapters.map((c, i) => (
              <li key={i} className="grid grid-cols-[28px_minmax(0,1fr)] gap-2 px-4 py-1.5 text-xs">
                <span className="font-mono text-faint">{c.first_paragraph ?? ""}</span>
                <span className="min-w-0">
                  <span className="block truncate text-foreground-2">{c.title}</span>
                  {c.mood && <span className="block truncate font-mono text-[11px] text-faint">{[c.mood, c.tempo].filter(Boolean).join(" · ")}</span>}
                </span>
              </li>
            ))}
          </ol>
        </Card>
      )}
    </div>
  )
}
