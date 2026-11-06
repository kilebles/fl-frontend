"use client"

import { AlertTriangle, Check, ChevronDown } from "lucide-react"
import { useState } from "react"

import { GROUPS, GROUP_COLOR, GROUP_HINT, GROUP_LABEL } from "@/components/footage/parts"
import { useFootageOptions } from "@/components/footage/queries"
import { BASE_CATEGORIES, CATEGORIES, CAT_BG, CAT_LABEL, SharesAside, SharesRows, clock, sharesSum } from "@/components/reels/parts"
import { useReelOptions } from "@/components/reels/queries"
import { ALL_GROUPS, EMPTY, EMPTY_FOOTAGE, type Draft, type FootageDraft, type IntroDraft } from "@/components/reels/wizard-draft"
import { INPUT, Label, ON_BLUE, Pick, Seg } from "@/components/script/ui"
import type { FootageGroup, ReelFootageSettings, ReelIntroSettings, ReelSettings } from "@/lib/api"
import { cn } from "@/lib/utils"

type Up = (fn: (d: Draft) => Draft) => void
type Real = "video" | "history"

const ENGINE_LABEL: Record<string, string> = {
  agy: "agy (Gemini)",
  claude: "Claude Code",
  gemini_api: "Gemini API",
}

/* ------------------------------------------------------------------ draft ↔ settings */

const num = (v: string): number | null => {
  const x = Number(v.replace(",", "."))
  return v.trim() !== "" && Number.isFinite(x) ? x : null
}
const str = (v: number | null | undefined) => (v === null || v === undefined ? "" : String(v))

export function footageBody(f: FootageDraft): ReelFootageSettings {
  return {
    min_score: num(f.score),
    groups: f.groups.length === ALL_GROUPS.length ? null : f.groups,
    vision_engine: f.engine,
    vision_model: f.model,
    yt_first: f.ytFirst,
    yt_any: f.ytAny,
    film_risky: f.filmRisky,
  }
}

export function introBody(i: IntroDraft): ReelIntroSettings {
  const lo = num(i.shot[0])
  const hi = num(i.shot[1])
  return {
    on: i.on,
    sec: i.sec,
    shares: i.shares,
    shot: lo !== null && hi !== null ? [lo, hi] : [],
    min_fit: num(i.minFit) ?? 0,
  }
}

/** A niche preset (last reel's settings) → the draft's search and intro parts. */
export function fromPreset(p: Partial<ReelSettings>, x: Draft): Pick<Draft, "footage" | "intro"> {
  const f = (s?: ReelFootageSettings): FootageDraft =>
    s
      ? {
          score: str(s.min_score),
          groups: s.groups?.length ? s.groups : ALL_GROUPS,
          engine: s.vision_engine || "",
          model: s.vision_model || "",
          ytFirst: !!s.yt_first,
          ytAny: !!s.yt_any,
          filmRisky: !!s.film_risky,
        }
      : EMPTY_FOOTAGE
  const i = p.intro
  return {
    footage: { video: f(p.footage?.video), history: f(p.footage?.history) },
    intro: i
      ? {
          on: !!i.on,
          sec: i.sec || 120,
          shares: { ...x.intro.shares, ...i.shares },
          shot: i.shot?.length === 2 ? [String(i.shot[0]), String(i.shot[1])] : ["", ""],
          minFit: i.min_fit ? String(i.min_fit) : "",
        }
      : EMPTY.intro,
  }
}

export function introOk(d: Draft) {
  if (!d.intro.on) return true
  const lo = num(d.intro.shot[0])
  const hi = num(d.intro.shot[1])
  const shot = (d.intro.shot[0] === "" && d.intro.shot[1] === "") || (lo !== null && hi !== null && lo >= 1 && lo <= hi && hi <= 15)
  return sharesSum(d.intro.shares) === 100 && shot
}

/** «Поиск видео» in one line for the summary: threshold, sources, model. */
export function footageText(f: FootageDraft) {
  const parts = [
    f.score ? `порог ${f.score}` : "",
    f.groups.length < ALL_GROUPS.length ? f.groups.map((g) => GROUP_LABEL[g]).join(", ") : "",
    f.model || (f.engine ? ENGINE_LABEL[f.engine] : ""),
    f.ytFirst ? "YouTube первым" : "",
  ].filter(Boolean)
  return parts.join(" · ") || "как в «Поиске видео»"
}

/* ------------------------------------------------------------------ parts */

function Toggle({ on, onClick, children, warn }: { on: boolean; onClick: () => void; children: React.ReactNode; warn?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex h-8 items-center gap-1.5 rounded-[3px] border px-2.5 text-xs transition-colors",
        on
          ? warn
            ? "border-warn/50 bg-warn-soft font-medium text-warn"
            : cn("border-pick/40", ON_BLUE)
          : "border-line-strong text-muted-foreground hover:text-foreground",
      )}
    >
      <span className={cn("grid size-3.5 place-items-center rounded-[2px] border", on ? "border-transparent bg-current/20" : "border-line-strong")}>
        {on && <Check className="size-2.5" />}
      </span>
      {children}
      {warn && <AlertTriangle className="size-3" />}
    </button>
  )
}

/** Score 0–10: «auto» (empty: the default), the usual values, or any number typed in. */
function Score({ value, onChange, presets, auto }: { value: string; onChange: (v: string) => void; presets: string[]; auto: string }) {
  const custom = value !== "" && !presets.includes(value)
  const x = Number(value.replace(",", "."))
  const bad = custom && !(x >= 0 && x <= 10)
  return (
    <div className="grid grid-cols-[1.25fr_repeat(3,1fr)_1.1fr] gap-[3px] rounded-[3px] bg-surface-2 p-[3px]">
      <button
        type="button"
        onClick={() => onChange("")}
        className={cn("truncate rounded-[2px] px-1 py-2 text-xs transition-colors", value === "" ? ON_BLUE : "text-foreground-2 hover:text-foreground")}
      >
        {auto}
      </button>
      {presets.map((v) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          className={cn("rounded-[2px] py-2 font-mono text-[13px] transition-colors", value === v ? ON_BLUE : "text-foreground-2 hover:text-foreground")}
        >
          {v}
        </button>
      ))}
      <input
        value={custom ? value : ""}
        onChange={(e) => onChange(e.target.value.replace(/[^\d.,]/g, "").slice(0, 4))}
        placeholder="своё"
        inputMode="decimal"
        title="Своё значение от 0 до 10, например 7.5"
        className={cn(
          "w-full min-w-0 rounded-[2px] bg-transparent px-1 text-center font-mono text-[13px] outline-none placeholder:font-sans placeholder:text-xs placeholder:text-faint",
          custom && !bad && ON_BLUE,
          bad && "text-danger",
        )}
      />
    </div>
  )
}

/** A section that opens on click; the line under the title tells what is set now. */
function Fold({
  title,
  summary,
  children,
  open: start = false,
  right,
}: {
  title: string
  summary: string
  children: React.ReactNode
  open?: boolean
  right?: React.ReactNode
}) {
  const [open, setOpen] = useState(start)
  return (
    <section className="rounded-[3px] border border-line-strong bg-background">
      <div className="flex items-center gap-3 px-4 py-3">
        <button type="button" onClick={() => setOpen(!open)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
          <ChevronDown className={cn("size-4 shrink-0 text-faint transition-transform", !open && "-rotate-90")} />
          <span className="min-w-0">
            <span className="block text-sm font-medium">{title}</span>
            <span className="block truncate font-mono text-[11px] text-faint">{summary}</span>
          </span>
        </button>
        {right}
      </div>
      {open && <div className="border-t border-line px-4 py-4">{children}</div>}
    </section>
  )
}

/* ------------------------------------------------------------------ «Видео» и «История» */

function FootageCard({ cat, f, set }: { cat: Real; f: FootageDraft; set: (patch: Partial<FootageDraft>) => void }) {
  const { data: fo } = useFootageOptions()
  const defEngine = fo?.defaults?.vision_engine || fo?.defaults?.engine || "agy"
  const engine = f.engine || defEngine
  const models = fo?.vision_models?.[engine] ?? []
  const defModel = !f.engine || f.engine === defEngine ? fo?.defaults?.vision_model : ""
  return (
    <div className="min-w-0 space-y-4 rounded-[3px] border border-line bg-surface/60 p-3.5">
      <div className="flex items-center gap-2 text-sm font-medium">
        <span className={cn("size-2 rounded-full", CAT_BG[cat])} />
        {CAT_LABEL[cat]}
      </div>
      <div>
        <Label aside={<span className="font-mono text-[11px] text-faint">ниже — кадр уходит в ИИ</span>}>Порог оценки найденного</Label>
        <Score
          value={f.score}
          onChange={(v) => set({ score: v })}
          presets={["6", "7", "8"]}
          auto={`как в модуле${fo?.defaults?.min_score != null ? ` · ${fo.defaults.min_score}` : ""}`}
        />
      </div>
      <div>
        <Label>Источники</Label>
        <div className="grid grid-cols-2 gap-[3px] rounded-[3px] bg-surface-2 p-[3px] sm:grid-cols-4">
          {GROUPS.map((g: FootageGroup) => {
            const on = f.groups.includes(g)
            return (
              <button
                key={g}
                type="button"
                title={GROUP_HINT[g]}
                onClick={() => {
                  const next = on ? f.groups.filter((y) => y !== g) : GROUPS.filter((y) => y === g || f.groups.includes(y))
                  if (next.length) set({ groups: next })
                }}
                className={cn(
                  "flex items-center justify-center gap-1.5 rounded-[2px] py-1.5 text-xs transition-colors",
                  on ? ON_BLUE : "text-faint hover:text-foreground-2",
                )}
              >
                <span className={cn("size-1.5 rounded-full", on ? GROUP_COLOR[g] : "bg-line-strong")} />
                {GROUP_LABEL[g]}
              </button>
            )
          })}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="min-w-0">
          <Label>Отбор кадров: движок</Label>
          <Pick
            value={f.engine}
            onChange={(v) => set({ engine: v, model: "" })}
            options={[
              {
                value: "",
                label: "Как в модуле",
                hint: ENGINE_LABEL[defEngine] ?? defEngine,
              },
              ...(fo?.engines ?? []).map((e) => ({
                value: e.value,
                label: e.label,
                hint: e.hint,
              })),
            ]}
          />
        </div>
        <div className="min-w-0">
          <Label>Модель</Label>
          <Pick
            value={f.model}
            onChange={(v) => set({ model: v })}
            options={[{ value: "", label: "Авто", hint: defModel || "" }, ...models.map((m) => ({ value: m, label: m }))]}
          />
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <Toggle on={f.ytFirst} onClick={() => set({ ytFirst: !f.ytFirst })}>
          YouTube первым
        </Toggle>
        <Toggle on={f.ytAny} warn onClick={() => set({ ytAny: !f.ytAny })}>
          YouTube: любые лицензии
        </Toggle>
        <Toggle on={f.filmRisky} warn onClick={() => set({ filmRisky: !f.filmRisky })}>
          Фильмы 1931–1963
        </Toggle>
      </div>
    </div>
  )
}

export function FootageSettings({ d, up }: { d: Draft; up: Up }) {
  const set = (cat: Real) => (patch: Partial<FootageDraft>) =>
    up((x) => ({
      ...x,
      footage: { ...x.footage, [cat]: { ...x.footage[cat], ...patch } },
    }))
  const off = !d.storyboard.shares.video && !d.storyboard.shares.history
  return (
    <Fold
      title="Видео и исторические кадры"
      summary={off ? "в ролике нет реальных кадров" : `видео: ${footageText(d.footage.video)} · история: ${footageText(d.footage.history)}`}
    >
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        <FootageCard cat="video" f={d.footage.video} set={set("video")} />
        <FootageCard cat="history" f={d.footage.history} set={set("history")} />
      </div>
    </Fold>
  )
}

/* ------------------------------------------------------------------ первые минуты */

export function IntroSettings({ d, up }: { d: Draft; up: Up }) {
  const { data: options } = useReelOptions()
  const i = d.intro
  const set = (patch: Partial<IntroDraft>) => up((x) => ({ ...x, intro: { ...x.intro, ...patch } }))
  const defShot = options?.intro?.shot_sec[d.montage.style] ?? [3, 5]
  const mainShot = options?.montage.find((m) => m.value === d.montage.style)?.shot_sec
  const cats = d.host.on ? CATEGORIES : BASE_CATEGORIES
  const min = i.sec / 60
  const summary = i.on
    ? [
        `${clock(i.sec)}`,
        cats.map((c) => Math.round(i.shares[c] ?? 0)).join(" · "),
        `кадр ${i.shot[0] || defShot[0]}–${i.shot[1] || defShot[1]} с`,
        i.minFit ? `оценка ≥ ${i.minFit}` : "",
      ]
        .filter(Boolean)
        .join(" · ")
    : "как весь ролик"
  return (
    <Fold
      title={`Первые ${min === Math.round(min) ? min : clock(i.sec)} ${min === 1 ? "минута" : min < 5 ? "минуты" : "минут"} отдельно`}
      summary={summary}
      open={i.on}
      right={
        <button
          type="button"
          role="switch"
          aria-checked={i.on}
          onClick={() =>
            set({
              on: !i.on,
              shares: i.on ? i.shares : sharesSum(i.shares) === 100 ? i.shares : d.storyboard.shares,
            })
          }
          className={cn("relative h-5 w-9 shrink-0 rounded-full transition-colors", i.on ? "bg-pick" : "bg-line-strong")}
        >
          <span className={cn("absolute top-0.5 size-4 rounded-full bg-white transition-[left]", i.on ? "left-[18px]" : "left-0.5")} />
        </button>
      }
    >
      {!i.on ? (
        <p className="text-[13px] text-muted-foreground">Включите, чтобы задать вступлению свои доли, более частую смену кадров и строже отбирать категории.</p>
      ) : (
        <div className="grid grid-cols-1 gap-x-6 gap-y-5 xl:grid-cols-12">
          <div className="xl:col-span-7">
            <Label aside={<SharesAside value={i.shares} onChange={(s) => set({ shares: s })} host={d.host.on} />}>Доли вступления, %</Label>
            <SharesRows value={i.shares} onChange={(s) => set({ shares: s })} seconds={i.sec} cats={cats} />
            {sharesSum(i.shares) !== 100 && <p className="mt-2 text-xs text-danger">Доли вступления должны давать 100% — сейчас {sharesSum(i.shares)}%.</p>}
          </div>
          <div className="space-y-5 xl:col-span-5">
            <div>
              <Label>Длина вступления</Label>
              <Seg
                value={String(i.sec)}
                onChange={(v) => set({ sec: Number(v) })}
                mono
                options={[
                  ["60", "1 мин"],
                  ["120", "2 мин"],
                  ["180", "3 мин"],
                  ["300", "5 мин"],
                ]}
              />
            </div>
            <div>
              <Label
                aside={
                  mainShot ? (
                    <span className="font-mono text-[11px] text-faint">
                      дальше {mainShot[0]}–{mainShot[1]} с
                    </span>
                  ) : null
                }
              >
                Длина кадра, с
              </Label>
              <div className="flex items-center gap-2">
                <input
                  value={i.shot[0]}
                  onChange={(e) =>
                    set({
                      shot: [e.target.value.replace(/[^\d.,]/g, "").slice(0, 4), i.shot[1]],
                    })
                  }
                  placeholder={String(defShot[0])}
                  inputMode="decimal"
                  aria-label="Длина кадра от"
                  className={cn(INPUT, "text-center font-mono")}
                />
                <span className="text-faint">–</span>
                <input
                  value={i.shot[1]}
                  onChange={(e) =>
                    set({
                      shot: [i.shot[0], e.target.value.replace(/[^\d.,]/g, "").slice(0, 4)],
                    })
                  }
                  placeholder={String(defShot[1])}
                  inputMode="decimal"
                  aria-label="Длина кадра до"
                  className={cn(INPUT, "text-center font-mono")}
                />
              </div>
            </div>
            <div>
              <Label aside={<span className="font-mono text-[11px] text-faint">ниже — категория не берётся</span>}>Оценка категории кадра</Label>
              <Score value={i.minFit} onChange={(v) => set({ minFit: v })} presets={["5", "6", "7"]} auto="любая" />
            </div>
          </div>
        </div>
      )}
    </Fold>
  )
}
