"use client"

import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { AlertTriangle, Send } from "lucide-react"

import { useNow } from "@/components/script/parts"
import {
  ApiError,
  limits,
  type LimitAccount,
  type LimitActive,
  type LimitAlert,
  type LimitBucket,
  type LimitHistory,
  type LimitShare,
  type LimitsStatus,
} from "@/lib/api"
import { parseUtcMs, timeAgo } from "@/lib/format"
import { cn } from "@/lib/utils"

/** Module colours: the same in every bar and legend (close to the reel categories they feed). */
const MODULE_COLOR: Record<string, string> = {
  footage: "#4fb3a9",
  prompts: "#8b7cf0",
  montage: "#4a9be8",
  reel: "#e8804a",
  voice: "#d9658f",
  scenario: "#c9a04f",
  flapi: "#7c8aa0",
  manual: "#a3a9b4",
  other: "#6e7581",
}
const UNSEEN = "repeating-linear-gradient(135deg, var(--line-strong) 0 3px, transparent 3px 6px)"

function swatch(id: string): React.CSSProperties {
  return id === "unknown" ? { backgroundImage: UNSEEN } : { backgroundColor: MODULE_COLOR[id] ?? MODULE_COLOR.other }
}

const dtFmt = new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
const dayFmt = new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit" })

function when(iso: string | null | undefined): string {
  if (!iso) return "—"
  const ms = parseUtcMs(iso)
  return Number.isNaN(ms) ? "—" : dtFmt.format(new Date(ms)).replace(",", "")
}

/** «через 1 д 20 ч», «через 3 ч 12 мин», «через 25 мин». */
function until(iso: string | null | undefined, now: number | null): string {
  if (!iso || now === null) return ""
  const min = Math.round((parseUtcMs(iso) - now) / 60_000)
  if (min <= 0) return ""
  const d = Math.floor(min / 1440)
  const h = Math.floor((min % 1440) / 60)
  const m = min % 60
  if (d) return `через ${d} д ${h} ч`
  if (h) return `через ${h} ч ${String(m).padStart(2, "0")} мин`
  return `через ${m} мин`
}

function hours(min: number | undefined): string {
  if (!min) return ""
  return min >= 90 ? `${(min / 60).toFixed(min >= 600 ? 0 : 1)} ч` : `${Math.round(min)} мин`
}

const LEVEL_TEXT: Record<LimitBucket["level"], string> = {
  ok: "text-foreground",
  warn: "text-warn",
  crit: "text-danger",
  unknown: "text-muted-foreground",
}
const LEVEL_BAR: Record<LimitBucket["level"], string> = { ok: "bg-ok", warn: "bg-warn", crit: "bg-danger", unknown: "bg-faint" }

type Pick = { account: string; bucket: string }

/** The most urgent week bucket opens first: the least left. */
function firstPick(s: LimitsStatus): Pick | null {
  const all = s.accounts.flatMap((a) => a.buckets.filter((b) => b.left !== null).map((b) => ({ a, b })))
  const weeks = all.filter((x) => x.b.kind === "week")
  const best = (weeks.length ? weeks : all).sort((x, y) => (x.b.left ?? 100) - (y.b.left ?? 100))[0]
  return best ? { account: best.a.id, bucket: best.b.key } : null
}

export function LimitsTab() {
  const q = useQuery({ queryKey: ["limits", "status"], queryFn: limits.status, refetchInterval: 60_000 })
  const now = useNow(30_000)
  const [picked, setPicked] = useState<Pick | null>(null)
  const s = q.data
  const pick = picked ?? (s ? firstPick(s) : null)

  if (q.isLoading) return <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map((i) => <div key={i} className="h-72 rounded-[4px] shimmer" />)}</div>
  if (!s) {
    const e = q.error
    const text =
      e instanceof ApiError && (e.status === 401 || e.status === 403)
        ? "Нет доступа к лимитам."
        : `Модуль лимитов не отвечает${e instanceof Error && e.message ? `: ${e.message}` : ""}`
    return <Notice>{text}</Notice>
  }

  const account = s.accounts.find((a) => a.id === pick?.account)
  const bucket = account?.buckets.find((b) => b.key === pick?.bucket)
  const empty = s.accounts.every((a) => !a.polled_at)

  return (
    <div className="flex flex-col gap-6">
      <Collectors s={s} now={now} />
      {empty ? (
        <Notice>Замеров ещё нет: сборщики не запускались.</Notice>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {s.accounts.map((a) => (
            <AccountCard key={a.id} a={a} now={now} pick={pick} onPick={setPicked} samplerOnline={s.sampler.online} />
          ))}
        </div>
      )}
      {account && bucket && <Details key={`${account.id}:${bucket.key}`} account={account} bucket={bucket} />}
      {s.alerts.length > 0 && <Alerts items={s.alerts} />}
    </div>
  )
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex max-w-2xl items-start gap-2 rounded-[4px] border border-line bg-surface px-3.5 py-3 text-sm text-muted-foreground">
      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warn" />
      <span>{children}</span>
    </div>
  )
}

function Dot({ on }: { on: boolean }) {
  return <span className={cn("inline-block size-1.5 rounded-[1px]", on ? "bg-ok" : "bg-danger")} />
}

function Collectors({ s, now }: { s: LimitsStatus; now: number | null }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-xs text-muted-foreground">
      {s.collectors.map((c) => (
        <span key={c.login} className="inline-flex items-center gap-1.5" title={c.at ? when(c.at) : "ещё не запускался"}>
          <Dot on={c.online} />
          сборщик {c.login}
          {c.at && now !== null && <span className="text-faint">· {timeAgo(c.at, now)}</span>}
          {!c.at && <span className="text-faint">· не запускался</span>}
        </span>
      ))}
      <span className="inline-flex items-center gap-1.5">
        <Dot on={s.sampler.online} />
        процессы
        {s.sampler.at && now !== null && <span className="text-faint">· {timeAgo(s.sampler.at, now)}</span>}
      </span>
    </div>
  )
}

function AccountCard({
  a,
  now,
  pick,
  onPick,
  samplerOnline,
}: {
  a: LimitAccount
  now: number | null
  pick: Pick | null
  onPick: (p: Pick) => void
  samplerOnline: boolean
}) {
  return (
    <section className="flex flex-col rounded-[4px] border border-line bg-surface">
      <header className="flex items-start gap-3 border-b border-line px-4 py-3">
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-mono text-[15px] font-semibold">{a.title}</h2>
          <p className="text-xs text-muted-foreground">{a.note}</p>
        </div>
        <span className="mt-0.5 inline-flex shrink-0 items-center gap-1.5 font-mono text-[11px] text-faint" title={when(a.polled_at)}>
          <Dot on={a.ok && !a.stale} />
          {a.polled_at && now !== null ? timeAgo(a.polled_at, now) : "нет замеров"}
        </span>
      </header>
      {(!a.ok || a.stale) && a.polled_at && (
        <p className="flex items-start gap-1.5 border-b border-line bg-warn-soft/40 px-4 py-2 text-xs text-warn">
          <AlertTriangle className="mt-px size-3.5 shrink-0" />
          <span>
            {a.ok ? "Данные устарели" : `Квота не читается: ${a.error ?? "ошибка"}`}
            {a.last_ok_at && ` · последний замер ${when(a.last_ok_at)}`}
          </span>
        </p>
      )}
      <div className="flex flex-col divide-y divide-line">
        {a.buckets.map((b) => (
          <BucketRow
            key={b.key}
            b={b}
            now={now}
            on={pick?.account === a.id && pick.bucket === b.key}
            onClick={() => onPick({ account: a.id, bucket: b.key })}
          />
        ))}
      </div>
      <Active items={a.active} samplerOnline={samplerOnline} />
    </section>
  )
}

function BucketRow({ b, now, on, onClick }: { b: LimitBucket; now: number | null; on: boolean; onClick: () => void }) {
  const left = b.left ?? 0
  const fc = b.forecast
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn("flex flex-col gap-1.5 px-4 py-3 text-left transition-colors", on ? "bg-elev" : "hover:bg-elev/50")}
    >
      <div className="flex items-baseline gap-2">
        <span className={cn("flex-1 truncate text-[13px]", on ? "font-medium text-foreground" : "text-foreground-2")}>{b.label}</span>
        <span className={cn("font-mono text-lg leading-none font-semibold", LEVEL_TEXT[b.level])}>{b.left === null ? "—" : `${Math.round(left)}%`}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-[1px] bg-line-strong">
        <div className={cn("h-full rounded-[1px]", LEVEL_BAR[b.level])} style={{ width: `${Math.max(0, Math.min(100, left))}%` }} />
      </div>
      <div className="flex flex-wrap gap-x-2 font-mono text-[11px] text-muted-foreground">
        <span>сброс {when(b.resets_at)}</span>
        {until(b.resets_at, now) && <span className="text-faint">{until(b.resets_at, now)}</span>}
      </div>
      {fc && fc.rate_per_hour > 0.05 && (
        <p className={cn("font-mono text-[11px]", fc.before_reset ? "text-warn" : "text-faint")}>
          ≈{fc.rate_per_hour.toFixed(1)}%/ч · {fc.before_reset ? `кончится ${when(fc.exhaust_at)}` : "хватит до сброса"}
        </p>
      )}
    </button>
  )
}

function Active({ items, samplerOnline }: { items: LimitActive[]; samplerOnline: boolean }) {
  const groups = useMemo(() => {
    const m = new Map<string, { a: LimitActive; n: number }>()
    for (const a of items) {
      const k = `${a.module}|${a.reel || a.job}`
      const g = m.get(k)
      if (g) g.n += 1
      else m.set(k, { a, n: 1 })
    }
    return [...m.values()]
  }, [items])
  return (
    <div className="mt-auto border-t border-line px-4 py-2.5">
      {!samplerOnline ? (
        <p className="text-xs text-faint">Процессы не видны</p>
      ) : groups.length === 0 ? (
        <p className="text-xs text-faint">Сейчас не работает</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {groups.map(({ a, n }) => (
            <span
              key={`${a.module}|${a.reel || a.job}`}
              title={[a.job, a.model, a.login].filter(Boolean).join(" · ")}
              className="inline-flex items-center gap-1.5 rounded-[2px] border border-line-strong px-1.5 py-0.5 text-[11px]"
            >
              <span className="size-1.5 rounded-[1px]" style={swatch(a.module)} />
              {a.title}
              {(a.reel || a.job) && <span className="text-muted-foreground">· {a.reel || a.job}</span>}
              {n > 1 && <span className="font-mono text-faint">×{n}</span>}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

function Details({ account, bucket }: { account: LimitAccount; bucket: LimitBucket }) {
  const range = bucket.kind === "week" ? 24 * 7 : 24
  const h = useQuery({
    queryKey: ["limits", "history", account.id, bucket.key, range],
    queryFn: () => limits.history(account.id, bucket.key, range),
    refetchInterval: 5 * 60_000,
  })
  const u = bucket.usage
  const before = Math.max(0, (bucket.used ?? 0) - u.total)
  return (
    <section className="rounded-[4px] border border-line bg-surface p-4 sm:p-5">
      <h2 className="text-[15px] font-semibold">
        {account.title} <span className="text-muted-foreground">· {bucket.label}</span>
      </h2>
      <div className="mt-4">
        {h.data ? <HistoryChart data={h.data} /> : <div className="h-40 rounded-[3px] shimmer" />}
      </div>

      <div className="mt-6">
        <h3
          className="mb-2 text-[13px] font-medium"
          title="Оценка: прирост квоты между замерами делится между модулями по времени работы их процессов модели"
        >
          Кто потратил{u.from ? ` с ${when(u.from)}` : ""}
        </h3>
        <ShareBar shares={u.modules} before={before} />
        <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1.5">
          {u.modules.map((m) => (
            <span key={m.id} className="inline-flex items-center gap-1.5 text-xs">
              <span className="size-2 rounded-[1px]" style={swatch(m.id)} />
              {m.title}
              <span className="font-mono text-muted-foreground">{m.pct.toFixed(m.pct < 10 ? 1 : 0)}%</span>
              {m.minutes ? <span className="font-mono text-faint">· {hours(m.minutes)}</span> : null}
            </span>
          ))}
          {before >= 0.5 && (
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="size-2 rounded-[1px] bg-faint/50" />
              до начала замеров <span className="font-mono">{before.toFixed(0)}%</span>
            </span>
          )}
          {u.modules.length === 0 && before < 0.5 && <span className="text-xs text-faint">Расхода в этом окне нет</span>}
        </div>
      </div>

      {u.reels.filter((r) => r.reel !== "—" || u.reels.length === 1).length > 0 && (
        <div className="mt-6">
          <h3 className="mb-2 text-[13px] font-medium">По роликам</h3>
          <div className="divide-y divide-line">
            {u.reels.slice(0, 12).map((r) => (
              <div key={r.reel} className="grid grid-cols-[minmax(0,1fr)_3.5rem] items-center gap-x-3 gap-y-1 py-2 sm:grid-cols-[12rem_minmax(0,1fr)_3.5rem]">
                <span className="truncate text-sm">{r.reel === "—" ? <span className="text-muted-foreground">без ролика</span> : r.reel}</span>
                <div className="order-3 col-span-2 flex h-1.5 overflow-hidden rounded-[1px] bg-line-strong sm:order-none sm:col-span-1">
                  {r.modules.map((m) => (
                    <div key={m.id} title={`${m.title} ${m.pct.toFixed(1)}%`} style={{ ...swatch(m.id), width: `${(m.pct / Math.max(r.pct, 0.01)) * 100}%` }} />
                  ))}
                </div>
                <span className="text-right font-mono text-sm">{r.pct.toFixed(r.pct < 10 ? 1 : 0)}%</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}

/** The quota as a bar: what each module used (of 100%), what was used before the first measurement, what is left. */
function ShareBar({ shares, before }: { shares: LimitShare[]; before: number }) {
  return (
    <div className="flex h-3 w-full overflow-hidden rounded-[2px] bg-line-strong/60">
      {before >= 0.5 && <div className="h-full bg-faint/50" style={{ width: `${before}%` }} title={`до начала замеров ${before.toFixed(0)}%`} />}
      {shares.map((m) => (
        <div key={m.id} className="h-full" style={{ ...swatch(m.id), width: `${m.pct}%` }} title={`${m.title} ${m.pct.toFixed(1)}%`} />
      ))}
    </div>
  )
}

/** Left % over time; resets are dashed lines. Plain SVG: the site has no chart library. */
function HistoryChart({ data }: { data: LimitHistory }) {
  const W = 720
  const H = 160
  const pts = data.points.map((p) => ({ t: parseUtcMs(p.t), left: Math.max(0, Math.min(100, 100 - p.used)) }))
  if (pts.length < 2) return <p className="flex h-40 items-center text-xs text-faint">Мало замеров для графика</p>
  const t0 = pts[0].t
  const t1 = pts[pts.length - 1].t
  const span = Math.max(1, t1 - t0)
  const x = (t: number) => ((t - t0) / span) * W
  const y = (v: number) => H - (v / 100) * H
  const line = pts.map((p, i) => `${i ? "L" : "M"}${x(p.t).toFixed(1)},${y(p.left).toFixed(1)}`).join(" ")
  const area = `${line} L${x(t1).toFixed(1)},${H} L0,${H} Z`
  const days: number[] = []
  const d = new Date(t0)
  d.setHours(24, 0, 0, 0)
  for (let t = d.getTime(); t < t1; t += 86_400_000) days.push(t)
  const resets = data.resets.map(parseUtcMs).filter((t) => t > t0 && t < t1)
  return (
    <div>
      <div className="flex gap-2">
        <div className="flex h-40 flex-col justify-between py-px text-right font-mono text-[10px] text-faint">
          <span>100%</span>
          <span>50%</span>
          <span>0%</span>
        </div>
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-40 min-w-0 flex-1">
          {[25, 50, 75].map((v) => (
            <line key={v} x1={0} x2={W} y1={y(v)} y2={y(v)} stroke="var(--line)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
          ))}
          {days.map((t) => (
            <line key={t} x1={x(t)} x2={x(t)} y1={0} y2={H} stroke="var(--line)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
          ))}
          {resets.map((t) => (
            <line key={t} x1={x(t)} x2={x(t)} y1={0} y2={H} stroke="var(--ok)" strokeDasharray="4 4" strokeWidth={1} vectorEffect="non-scaling-stroke" />
          ))}
          <path d={area} fill="var(--electric)" opacity={0.12} />
          <path d={line} fill="none" stroke="var(--electric)" strokeWidth={1.75} vectorEffect="non-scaling-stroke" />
        </svg>
      </div>
      <div className="relative mt-1 ml-9 h-4 font-mono text-[10px] text-faint">
        {days.map((t) => (
          <span key={t} className="absolute -translate-x-1/2" style={{ left: `${((t - t0) / span) * 100}%` }}>
            {dayFmt.format(new Date(t))}
          </span>
        ))}
      </div>
    </div>
  )
}

const ALERT_DOT: Record<LimitAlert["level"], string> = { ok: "bg-ok", warn: "bg-warn", crit: "bg-danger" }

function Alerts({ items }: { items: LimitAlert[] }) {
  return (
    <section className="rounded-[4px] border border-line bg-surface p-4 sm:p-5">
      <h2 className="mb-2 text-[15px] font-semibold">Предупреждения</h2>
      <div className="divide-y divide-line">
        {items.map((a, i) => (
          <div key={`${a.at}-${i}`} className="flex flex-wrap items-start gap-x-3 gap-y-1 py-2 text-sm">
            <span className={cn("mt-1.5 size-1.5 shrink-0 rounded-[1px]", ALERT_DOT[a.level])} />
            <span className="inline-flex shrink-0 items-center gap-1.5 font-mono text-xs leading-5 text-muted-foreground sm:w-28">
              {when(a.at)}
              {a.telegram === "sent" && <Send className="size-3 text-faint" aria-label="отправлено в Telegram" />}
            </span>
            <span className="min-w-0 basis-full text-foreground-2 sm:flex-1 sm:basis-0">{a.text}</span>
          </div>
        ))}
      </div>
    </section>
  )
}
