"use client"

import { useMemo, useState } from "react"
import {
  AlertTriangle,
  Clapperboard,
  Download,
  FileText,
  Map as MapIcon,
  PieChart,
  RefreshCw,
  RotateCcw,
  Sparkles,
  Trash2,
  TriangleAlert,
  UserPen,
} from "lucide-react"
import { toast } from "sonner"

import { PARAGRAPHS } from "@/components/footage/mock"
import { GroupBar, KindBadge, PROVIDER_LABEL, RiskMark, StageSteps, TYPE_LABEL, Thumb, clock } from "@/components/footage/parts"
import { ShotDialog } from "@/components/footage/shot-dialog"
import type { FootageParagraph, FootageProject, Shot } from "@/components/footage/types"
import { setUrlParams, useUrlParam } from "@/components/script/queries"
import { BTN_SECONDARY } from "@/components/script/ui"
import { cn } from "@/lib/utils"

type Filter = "all" | "ok" | "ai" | "graphics" | "risky"

const isAi = (s: Shot) => s.status === "not_found" || s.status === "error"
const match = (s: Shot, f: Filter) =>
  f === "all" ||
  (f === "ok" && s.status === "ok") ||
  (f === "ai" && isAi(s)) ||
  (f === "graphics" && s.status === "handoff") ||
  (f === "risky" && !!s.chosen?.risky)

function Tile({
  label,
  value,
  sub,
  tone,
  action,
  active,
  onClick,
}: {
  label: string
  value: React.ReactNode
  sub?: React.ReactNode
  tone?: "ok" | "warn" | "pick"
  action?: React.ReactNode
  active?: boolean
  onClick?: () => void
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => e.key === "Enter" && onClick?.()}
      className={cn(
        "flex min-w-0 cursor-pointer flex-col justify-between gap-2 rounded-[3px] border p-3.5 transition-colors",
        active ? "border-pick/50 bg-pick-soft/50" : "border-line bg-background hover:border-line-strong",
      )}
    >
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        {label}
        {action}
      </div>
      <div
        className={cn(
          "font-mono text-2xl leading-none font-medium",
          tone === "ok" && "text-ok",
          tone === "warn" && "text-warn",
          tone === "pick" && "text-pick-text",
        )}
      >
        {value}
      </div>
      {sub && <div className="truncate font-mono text-[11px] text-faint">{sub}</div>}
    </div>
  )
}

function ShotCard({ s, ratio, onOpen }: { s: Shot; ratio: "16:9" | "9:16"; onOpen: () => void }) {
  const c = s.chosen
  const caption = (
    <div className="mt-2 min-w-0 px-0.5">
      <div className="flex items-center gap-1.5 font-mono text-[11px] text-faint">
        <span className="text-foreground-2">{s.id}</span>
        <span>·</span>
        <span>{TYPE_LABEL[s.type]}</span>
        <span>·</span>
        <span>{s.sec.toFixed(1)} с</span>
        {s.manual && <UserPen className="ml-auto size-3 text-pick-text" aria-label="выбран вручную" />}
      </div>
      <p className="mt-1 line-clamp-2 text-xs leading-snug text-muted-foreground" title={s.show}>
        {s.show}
      </p>
    </div>
  )

  if (s.status === "ok" && c)
    return (
      <button type="button" onClick={onOpen} className="group min-w-0 self-start text-left">
        <Thumb c={c} ratio={ratio} className="ring-pick/60 transition group-hover:ring-2">
          <span
            className={cn(
              "absolute top-1.5 right-1.5 rounded-[2px] bg-black/55 px-1.5 py-0.5 font-mono text-[11px] font-medium backdrop-blur-sm",
              c.score >= 8 ? "text-[#7ee2a0]" : "text-white",
            )}
          >
            {c.score.toFixed(1)}
          </span>
          <span className="absolute bottom-1.5 left-1.5 flex gap-1">
            <KindBadge c={c} sec={s.sec} />
            {c.risky && <RiskMark />}
          </span>
          {!c.risky && (
            <span className="absolute right-1.5 bottom-1.5 max-w-[45%] truncate rounded-[2px] bg-black/55 px-1.5 py-0.5 text-[10px] text-white/90 backdrop-blur-sm">
              {PROVIDER_LABEL[c.provider] ?? c.provider}
            </span>
          )}
          {s.alternatives.length > 0 && (
            <span className="absolute top-1.5 left-1.5 rounded-[2px] bg-black/55 px-1.5 py-0.5 font-mono text-[10px] text-white/80 opacity-0 backdrop-blur-sm transition group-hover:opacity-100">
              ещё {s.alternatives.length}
            </span>
          )}
        </Thumb>
        {caption}
      </button>
    )

  const handoff = s.status === "handoff"
  const error = s.status === "error"
  const Icon = handoff ? (s.type === "map" ? MapIcon : s.type === "infographic" ? PieChart : Clapperboard) : error ? AlertTriangle : Sparkles
  return (
    <button type="button" onClick={onOpen} className="group min-w-0 self-start text-left">
      <div
        className={cn(
          "grid place-items-center rounded-[3px] border border-dashed transition-colors",
          ratio === "16:9" ? "aspect-video" : "aspect-[9/16]",
          error ? "border-danger/40 bg-danger/5" : handoff ? "border-line-strong bg-surface-2/50" : "border-warn/40 bg-warn-soft/40",
          "group-hover:border-solid",
        )}
      >
        <span
          className={cn("flex flex-col items-center gap-1.5 px-3 text-center text-xs", error ? "text-danger" : handoff ? "text-muted-foreground" : "text-warn")}
        >
          <Icon className="size-4" />
          {handoff ? (s.type === "ai_video" ? "в «Генерации»" : "в «Графику»") : error ? "ошибка" : "на ИИ-генерацию"}
          <span className="font-mono text-[10px] opacity-70">
            {error ? s.message : s.alternatives.length ? `лучший ${s.alternatives[0].score.toFixed(1)}` : handoff ? "по шот-листу" : "кандидатов нет"}
          </span>
        </span>
      </div>
      {caption}
    </button>
  )
}

function ParagraphBlock({ p, filter, ratio, onShot }: { p: FootageParagraph; filter: Filter; ratio: "16:9" | "9:16"; onShot: (id: string) => void }) {
  const shots = p.shots.filter((s) => match(s, filter))
  if (!shots.length) return null
  return (
    <div className="grid grid-cols-1 gap-x-6 gap-y-3 border-b border-line px-5 py-5 last:border-b-0 lg:grid-cols-[260px_minmax(0,1fr)]">
      <div className="min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-lg font-medium">{p.number}</span>
          <span className="font-mono text-[11px] text-faint">
            {clock(p.duration)} · {p.duration_source === "audio" ? "озвучка" : "по тексту"} · {p.shots.length} кадров
          </span>
        </div>
        <p className="mt-1.5 line-clamp-5 text-[13px] leading-relaxed text-foreground-2">{p.text}</p>
      </div>
      <div
        className={cn(
          "grid gap-x-3 gap-y-4",
          ratio === "16:9" ? "grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5" : "grid-cols-3 sm:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8",
        )}
      >
        {shots.map((s) => (
          <ShotCard key={s.id} s={s} ratio={ratio} onOpen={() => onShot(s.id)} />
        ))}
      </div>
    </div>
  )
}

export function ProjectView({ project: p }: { project: FootageProject }) {
  const [filter, setFilter] = useState<Filter>("all")
  const shotId = useUrlParam("shot")
  const s = p.stats
  const ai = s.not_found + s.error
  const all = useMemo(() => PARAGRAPHS.flatMap((x) => x.shots), [])
  const shot = all.find((x) => x.id === shotId) ?? null
  const done = p.status === "done"

  const captions = {
    plan: s.total ? `${s.total} кадров` : "",
    search: done ? `найдено ${s.ok - 18}` : "",
    extra: done ? `+18 из ${p.stages[2].total}` : "",
    cut: done ? `${s.video} видео · ${s.image} фото` : "",
    done: done && p.elapsed_sec ? `${clock(p.elapsed_sec)} · ${p.ai_calls} вызовов ИИ` : "",
  }

  const chapters = [...new Set(PARAGRAPHS.map((x) => x.chapter))]

  return (
    <div className="space-y-5">
      <div className="rounded-[4px] border border-line bg-surface px-5 py-4">
        <StageSteps stages={p.stages} captions={captions} />
      </div>

      <section className="rounded-[4px] border border-line bg-surface p-4">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <Tile
            label="Все кадры"
            value={s.total}
            sub={`${p.paragraphs} абзацев · ${clock(p.duration_sec)}`}
            active={filter === "all"}
            onClick={() => setFilter("all")}
          />
          <Tile
            label="Найдено"
            value={s.ok}
            tone="ok"
            sub={`${s.video} видео · ${s.image} фото · ${Math.round((s.ok / s.total) * 100)}%`}
            active={filter === "ok"}
            onClick={() => setFilter("ok")}
          />
          <Tile
            label="На ИИ"
            value={ai}
            tone="pick"
            sub={`${s.not_found} не найдено · ${s.error} ошибки`}
            active={filter === "ai"}
            onClick={() => setFilter("ai")}
            action={
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation()
                  toast("Макет: передача в «Промпты» / «Генерации»")
                }}
                className="rounded-[2px] px-1 text-[11px] text-pick-text hover:bg-pick-soft"
              >
                в «Промпты» →
              </span>
            }
          />
          <Tile label="Карты и инфографика" value={s.handoff} sub="в «Графику»" active={filter === "graphics"} onClick={() => setFilter("graphics")} />
          <Tile
            label="Проверить лицензию"
            value={s.risky}
            tone={s.risky ? "warn" : undefined}
            sub={s.risky ? "YouTube «любые», фильмы 1931–63" : "всё свободное"}
            active={filter === "risky"}
            onClick={() => setFilter("risky")}
            action={s.risky ? <TriangleAlert className="size-3.5 text-warn" /> : undefined}
          />
        </div>
        <div className="mt-4 flex flex-wrap items-end justify-between gap-4 border-t border-line pt-4">
          <GroupBar by={s.by_group} className="min-w-64 flex-1" />
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => toast("Макет")} className={BTN_SECONDARY} title="Ещё один круг поиска для кадров «на ИИ»">
              <RotateCcw className="size-3.5" />
              Искать ненайденные
            </button>
            <button type="button" onClick={() => toast("Макет")} className={BTN_SECONDARY}>
              <FileText className="size-3.5" />
              EDL · атрибуция
            </button>
            <button
              type="button"
              onClick={() => toast("Макет")}
              className="flex h-10 items-center gap-2 rounded-[3px] bg-inverse px-4 text-sm font-medium text-inverse-foreground hover:opacity-90"
            >
              <Download className="size-3.5" />
              Кадры .zip
            </button>
            <button
              type="button"
              title="Удалить проект"
              className="grid size-10 place-items-center rounded-[3px] border border-line-strong text-faint hover:border-danger/40 hover:bg-danger/10 hover:text-danger"
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-[4px] border border-line bg-surface">
        {chapters.map((ch) => (
          <div key={ch}>
            <div className="flex items-center justify-between border-b border-line bg-surface-2/60 px-5 py-2.5">
              <h2 className="text-sm font-semibold">{ch}</h2>
              <button type="button" onClick={() => toast("Макет")} className="flex items-center gap-1 text-xs text-faint hover:text-foreground">
                <RefreshCw className="size-3" />
                искать заново
              </button>
            </div>
            {PARAGRAPHS.filter((x) => x.chapter === ch).map((x) => (
              <ParagraphBlock key={x.number} p={x} filter={filter} ratio={p.format} onShot={(id) => setUrlParams({ shot: id })} />
            ))}
          </div>
        ))}
      </section>

      <ShotDialog shot={shot} ratio={p.format} onClose={() => setUrlParams({ shot: null })} />
    </div>
  )
}
