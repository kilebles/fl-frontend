"use client"

import { useState } from "react"
import { Check } from "lucide-react"

import { PaletteSwatch } from "@/components/montage/parts"
import { useMontageOptions } from "@/components/montage/queries"
import { TYPE_LABEL } from "@/components/reels/parts"
import { useReelOptions } from "@/components/reels/queries"
import { Label } from "@/components/script/ui"
import type { InfoPalette, InfoStyle, ReelInfoLook, ReelOptions } from "@/lib/api"
import { cn } from "@/lib/utils"

/** The brain's infographic types (`/options` info.types) flattened; before the options come — the contract's ten. */
const FALLBACK_TYPES = ["timeline", "tree", "table", "chart", "map", "facts", "battle", "journey", "units", "document"]

export const infoTypeList = (options?: ReelOptions): string[] =>
  options?.info?.types.flatMap((g) => g.types.map((t) => t.value)) ?? FALLBACK_TYPES

/** The draft keeps the types switched off: a type the brain adds later is on by itself. */
export const allowedTypes = (all: string[], off: string[]) => all.filter((t) => !off.includes(t))

/** With an infographics share at least one type must stay on (the brain answers 400 otherwise). */
export const infoTypesOk = (share: number, allowed: string[]) => !(share > 0) || allowed.length > 0

/** The infographics share that needs types and a look: the reel's or the intro's, when the intro is on. */
export const infoShareOf = (main: number, intro?: { on: boolean; shares: Partial<Record<string, number>> }) =>
  Math.max(Number(main) || 0, intro?.on ? Number(intro.shares.infographics) || 0 : 0)

/** A preset's allowed list → the types switched off. */
export const infoOffFrom = (list: string[] | undefined, all: string[]) => (list?.length ? all.filter((t) => !list.includes(t)) : [])

const label = (list: { value: string; label: string }[] | undefined, v: string) => list?.find((x) => x.value === v)?.label ?? v

/** «Хроника · Королевская», «авто», «Хроника · цвета авто». */
export function infoLookText(look: ReelInfoLook | undefined, options?: ReelOptions) {
  const st = look?.style || "auto"
  const pa = look?.palette || "auto"
  if (st === "auto" && pa === "auto") return "авто"
  return `${st === "auto" ? "авто" : label(options?.info?.styles, st)} · ${pa === "auto" ? "цвета авто" : label(options?.info?.palettes, pa)}`
}

/** «7 из 10 типов» when not all are allowed; "" — all (or an older reel without the list). */
export function infoTypesText(list: string[] | undefined, options?: ReelOptions) {
  if (!list) return ""
  const all = infoTypeList(options)
  const n = list.filter((t) => all.includes(t)).length
  return n < all.length ? `${n} из ${all.length} типов` : ""
}

/** One line for the summaries: «инфографика: Хроника · Королевская, 7 из 10 типов». */
export function infoLine(look: ReelInfoLook | undefined, types: string[] | undefined, options?: ReelOptions) {
  const t = infoTypesText(types, options)
  if (!look && !t) return ""
  return `инфографика: ${look ? infoLookText(look, options) : "как в стиле"}${t ? `, ${t}` : ""}`
}

/* ------------------------------------------------------------------ шаг 5: типы */

export function InfoTypesPick({ off, onChange, share }: { off: string[]; onChange: (off: string[]) => void; share: number }) {
  const { data: options } = useReelOptions()
  const groups = options?.info?.types
  if (!groups?.length) return null
  const all = infoTypeList(options)
  const allowed = allowedTypes(all, off)
  const idle = !(share > 0)
  const toggle = (t: string) => onChange(off.includes(t) ? off.filter((x) => x !== t) : [...off, t])
  return (
    <div>
      <Label
        aside={
          <span className="font-mono text-[11px] text-faint">
            {idle ? "доля 0" : allowed.length === all.length ? "все" : `${allowed.length} из ${all.length}`}
          </span>
        }
      >
        <span id="info-types-label">Типы инфографики</span>
      </Label>
      <div role="group" aria-labelledby="info-types-label" className={cn("space-y-1.5", idle && "pointer-events-none opacity-40")} inert={idle}>
        {groups.map((g, gi) => (
          <div key={g.label} className="flex flex-wrap items-center gap-1.5">
            {gi > 0 && <span className="mr-1 text-xs text-muted-foreground">{g.label}</span>}
            {g.types.map((t) => {
              const on = !off.includes(t.value)
              return (
                <button
                  key={t.value}
                  type="button"
                  role="checkbox"
                  aria-checked={on}
                  title={t.label}
                  tabIndex={idle ? -1 : undefined}
                  onClick={() => toggle(t.value)}
                  className={cn(
                    "flex h-7 items-center gap-1.5 rounded-[3px] border px-2 text-xs transition-colors",
                    on ? "border-pick/40 bg-pick-soft font-medium text-pick-text" : "border-line-strong text-muted-foreground hover:text-foreground",
                  )}
                >
                  <span className={cn("grid size-3.5 place-items-center rounded-[2px] border", on ? "border-transparent bg-current/20" : "border-line-strong")}>
                    {on && <Check className="size-2.5" />}
                  </span>
                  <span className="first-letter:uppercase">{TYPE_LABEL[t.value] ?? t.label}</span>
                </button>
              )
            })}
          </div>
        ))}
      </div>
      {!infoTypesOk(share, allowed) && <p className="mt-2 text-xs text-danger">Отметьте хотя бы один тип или поставьте инфографике долю 0.</p>}
    </div>
  )
}

/* ------------------------------------------------------------------ шаг 6: шаблон */

/** Images that failed to load (not there yet): the tile draws the swatch instead and does not ask again. */
const BROKEN = new Set<string>()

/** public/infographics/looks/<style>-<palette>.jpg (480×270); missing — the palette's swatch over the style, missing
 *  too — the names. */
function LookPreview({ style, palette, colors, names }: { style: InfoStyle; palette: InfoPalette; colors?: string[]; names: string }) {
  const src = `/infographics/looks/${style}-${palette}.jpg`
  const [, bump] = useState(0)
  if (!BROKEN.has(src))
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        key={src}
        src={src}
        alt=""
        onError={() => {
          BROKEN.add(src)
          bump((x) => x + 1)
        }}
        className="size-full object-cover"
      />
    )
  if (colors?.length || palette === "default") return <PaletteSwatch style={style} colors={colors} large className="size-full" />
  return <span className="grid size-full place-items-center bg-surface-2 px-2 text-center text-xs text-muted-foreground">{names}</span>
}

function Tile({ on, onClick, name, hint, children }: { on: boolean; onClick: () => void; name: string; hint?: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      title={hint}
      role="radio"
      aria-checked={on}
      onClick={onClick}
      className={cn(
        "group relative flex min-w-0 flex-col gap-1.5 rounded-[3px] border bg-background p-1.5 text-left transition-colors",
        on ? "border-pick/60 ring-1 ring-pick/30" : "border-line-strong hover:border-faint",
      )}
    >
      <span className="block aspect-video w-full overflow-hidden rounded-[2px] border border-line">{children}</span>
      <span className={cn("truncate px-0.5 text-[13px] leading-tight", on ? "font-medium text-pick-text" : "text-foreground-2")}>{name}</span>
      {on && (
        <span className="absolute top-2.5 right-2.5 grid size-4 place-items-center rounded-full bg-pick text-white shadow">
          <Check className="size-2.5" />
        </span>
      )}
    </button>
  )
}

/** «Инфографика» on the montage step: style and colours of the reel's infographics, each with «Авто». */
export function InfoLookPick({
  value,
  onChange,
  montageStyle,
  idle,
}: {
  value: ReelInfoLook
  onChange: (v: ReelInfoLook) => void
  montageStyle: string
  idle?: boolean
}) {
  const { data: options } = useReelOptions()
  const { data: mo } = useMontageOptions()
  const info = options?.info
  if (!info) return null
  // «Авто» without a brief → the style of the montage style; the colour previews show it.
  const base: InfoStyle = value.style !== "auto" ? value.style : (info.by_montage[montageStyle] ?? "parchment")
  const shown: InfoPalette = value.palette === "auto" ? "default" : value.palette
  const colors = (style: InfoStyle, palette: InfoPalette) => mo?.palettes?.find((p) => p.value === palette)?.swatches?.[style]
  const styleHint = (s: string) => mo?.styles.find((x) => x.value === s)?.hint
  const palettes = info.palettes.filter((p) => p.value !== "auto") as { value: InfoPalette; label: string }[]
  const dots = palettes.map((p) => colors(base, p.value)).filter((c): c is string[] => !!c?.length)
  const grid = "grid max-w-[940px] grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5"
  return (
    <div className={cn(idle && "opacity-60")}>
      <Label aside={idle ? <span className="font-mono text-[11px] text-faint">доля инфографики 0</span> : undefined}>Инфографика</Label>
      <div className="space-y-3">
        <div>
          <div id="info-look-style" className="mb-1.5 text-xs text-muted-foreground">Стиль</div>
          <div role="radiogroup" aria-labelledby="info-look-style" className={grid}>
            {info.styles.map((s) =>
              s.value === "auto" ? (
                <Tile key="auto" on={value.style === "auto"} onClick={() => onChange({ ...value, style: "auto" })} name={s.label}>
                  <span className="grid size-full place-items-center bg-surface-2 px-3 text-center text-xs leading-snug text-muted-foreground">
                    по эпохе и настроению фильма
                  </span>
                </Tile>
              ) : (
                <Tile key={s.value} on={value.style === s.value} onClick={() => onChange({ ...value, style: s.value })} name={s.label} hint={styleHint(s.value)}>
                  <LookPreview
                    style={s.value as InfoStyle}
                    palette={shown}
                    colors={colors(s.value as InfoStyle, shown)}
                    names={[s.label, value.palette === "auto" ? "" : label(info.palettes, value.palette)].filter(Boolean).join(" · ")}
                  />
                </Tile>
              ),
            )}
          </div>
        </div>
        <div>
          <div id="info-look-palette" className="mb-1.5 text-xs text-muted-foreground">Цвета</div>
          <div role="radiogroup" aria-labelledby="info-look-palette" className={grid}>
            {info.palettes.map((p) =>
              p.value === "auto" ? (
                <Tile key="auto" on={value.palette === "auto"} onClick={() => onChange({ ...value, palette: "auto" })} name={p.label}>
                  <span className="flex size-full items-center justify-center gap-2 bg-surface-2">
                    {dots.length
                      ? dots.map((c, i) => (
                          <span
                            key={i}
                            className="size-5 rounded-full"
                            style={{ background: `linear-gradient(135deg, ${c[0]} 50%, ${c[1]} 50%)`, boxShadow: `0 0 0 2px ${c[2]}` }}
                          />
                        ))
                      : null}
                  </span>
                </Tile>
              ) : (
                <Tile
                  key={p.value}
                  on={value.palette === p.value}
                  onClick={() => onChange({ ...value, palette: p.value })}
                  name={p.label}
                  hint={mo?.palettes?.find((x) => x.value === p.value)?.hint}
                >
                  <LookPreview
                    style={base}
                    palette={p.value as InfoPalette}
                    colors={colors(base, p.value as InfoPalette)}
                    names={`${label(info.styles, base)} · ${p.label}`}
                  />
                </Tile>
              ),
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
