"use client"

import { Check } from "lucide-react"

import { reels, type ReelFont } from "@/lib/api"
import { cn } from "@/lib/utils"

import { useReelFonts } from "./queries"

export const SLOGAN = "Your vision. Our production."

/** The four title fonts — shown while /fonts loads or when the module is older. */
const FALLBACK: ReelFont[] = [
  { value: "constantia", label: "Constantia", family: "Constantia", available: false, format: "" },
  { value: "constantine", label: "Constantine", family: "Constantine", available: false, format: "" },
  { value: "oserif", label: "oSerif", family: "oSerif", available: false, format: "" },
  { value: "satyrsp", label: "SatyrSP", family: "SatyrSP", available: false, format: "" },
]

const FORMATS: Record<string, string> = { ttf: "truetype", otf: "opentype", woff: "woff", woff2: "woff2" }

/** The montage styles' own title fonts (renderer/src/Reel.tsx). */
export const STYLE_FONTS: Record<string, string> = {
  serif: "Georgia, 'Times New Roman', serif",
  mono: "'Courier New', Courier, monospace",
  sans: "Helvetica, Arial, sans-serif",
}

/** Preview family: our own name, so a font installed on the viewer's machine is used only as a fallback. */
const previewFamily = (f: ReelFont) => `reel-${f.value}`

export function useFontList() {
  const { data } = useReelFonts()
  return data?.length ? data : FALLBACK
}

export function fontLabel(fonts: ReelFont[], value: string | undefined) {
  if (!value) return "шрифт стиля"
  return fonts.find((f) => f.value === value)?.label ?? value
}

/** @font-face for every title font: the file from the server, else the font installed on this machine. */
function FontFaces({ fonts }: { fonts: ReelFont[] }) {
  const css = fonts
    .map((f) => {
      const src = [
        ...(f.available ? [`url("${reels.fontUrl(f.value)}")${FORMATS[f.format] ? ` format("${FORMATS[f.format]}")` : ""}`] : []),
        `local("${f.family}")`,
      ]
      return `@font-face{font-family:"${previewFamily(f)}";src:${src.join(",")};font-display:swap}`
    })
    .join("\n")
  return <style>{css}</style>
}

/** «Шрифт титров»: the slogan in each font; the style's own font as the last card. */
export function FontPick({ value, onChange, styleLabel, styleFont }: { value: string; onChange: (v: string) => void; styleLabel: string; styleFont: string }) {
  const fonts = useFontList()
  const cards = [...fonts.map((f) => ({ font: f as ReelFont | null, value: f.value })), { font: null, value: "" }]
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
      <FontFaces fonts={fonts} />
      {cards.map(({ font, value: v }) => {
        const on = value === v
        return (
          <button
            key={v || "style"}
            type="button"
            onClick={() => onChange(v)}
            className={cn(
              "relative flex min-w-0 flex-col items-start gap-3 rounded-[3px] border bg-background p-3.5 text-left transition-colors",
              on ? "border-pick/60 ring-1 ring-pick/30" : "border-line-strong hover:border-faint",
            )}
          >
            {on && (
              <span className="absolute top-2.5 right-2.5 grid size-4 place-items-center rounded-full bg-pick text-white">
                <Check className="size-2.5" />
              </span>
            )}
            <span
              className="flex min-h-[72px] w-full items-center pr-4 text-[22px] leading-tight text-foreground"
              style={{ fontFamily: font ? `"${previewFamily(font)}", Georgia, serif` : (STYLE_FONTS[styleFont] ?? STYLE_FONTS.serif) }}
            >
              {SLOGAN}
            </span>
            <span className="flex w-full items-baseline justify-between gap-2">
              <span className="text-sm font-medium">{font ? font.label : "Как в стиле"}</span>
              {font && v === FALLBACK[0].value && <span className="font-mono text-[11px] text-faint">по умолчанию</span>}
            </span>
            {font ? (
              !font.available && <span className="font-mono text-[11px] text-warn">нет файла на сервере</span>
            ) : (
              <span className="font-mono text-[11px] text-faint">{styleLabel}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}
