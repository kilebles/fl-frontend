"use client"

import { useState } from "react"
import { AlertTriangle, Check, FileAudio, FileText, Mic, Paperclip, ScanSearch, X } from "lucide-react"
import { toast } from "sonner"

import { VOICE_SOURCES } from "@/components/footage/mock"
import { GROUP_COLOR, GROUP_HINT, GROUP_LABEL, clock } from "@/components/footage/parts"
import type { FootageGroup } from "@/components/footage/types"
import { BTN_PRIMARY, BTN_SECONDARY, INPUT, Label, ON_BLUE, Pick, Seg } from "@/components/script/ui"
import { cn } from "@/lib/utils"

const GROUPS: FootageGroup[] = ["archive", "youtube", "films", "stock"]
const ENGINES = [
  { value: "agy", label: "agy (Gemini)", hint: "подписка" },
  { value: "claude", label: "Claude Code", hint: "подписка" },
  { value: "gemini_api", label: "Gemini API", hint: "по ключу" },
]

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

export function LaunchPanel() {
  const [from, setFrom] = useState<"voice" | "file">("voice")
  const [voice, setVoice] = useState("v1")
  const [file, setFile] = useState<string | null>(null)
  const [audio, setAudio] = useState<string | null>(null)
  const [title, setTitle] = useState("")
  const [engine, setEngine] = useState("agy")
  const [groups, setGroups] = useState<FootageGroup[]>(GROUPS)
  const [opts, setOpts] = useState({
    yt_first: false,
    yt_trusted: true,
    yt_any: false,
    film_risky: false,
  })
  const [score, setScore] = useState("7")
  const [format, setFormat] = useState("16:9")

  const v = VOICE_SOURCES.find((x) => x.id === voice)
  const flip = (k: keyof typeof opts) => setOpts((o) => ({ ...o, [k]: !o[k] }))
  const ready = from === "voice" ? !!v : !!file
  const shots = v ? Math.round((v.duration_sec || v.chars / 16) / 6.1) : 0

  const meta =
    from === "voice" && v
      ? [
          `${v.paragraphs} абзацев`,
          v.tracks ? `длительность по озвучке ${v.language.toUpperCase()} · ${clock(v.duration_sec)}` : "озвучки нет — длительность по тексту",
          `≈ ${shots} кадров`,
        ]
      : file
        ? [file, audio ? `озвучка: ${audio}` : "без озвучки — длительность по тексту"]
        : []

  return (
    <section className="mb-6 rounded-[4px] border border-line bg-surface">
      <div className="grid grid-cols-1 gap-x-5 gap-y-5 p-5 md:grid-cols-2 xl:grid-cols-12">
        <div className="md:col-span-2 xl:col-span-6">
          <Label
            aside={
              <div className="flex gap-0.5 rounded-[3px] bg-surface-2 p-0.5 text-xs">
                {(
                  [
                    ["voice", "Из озвучки", Mic],
                    ["file", "Файл", Paperclip],
                  ] as const
                ).map(([id, label, Icon]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setFrom(id)}
                    className={cn("flex items-center gap-1 rounded-[2px] px-2 py-1", from === id ? ON_BLUE : "text-muted-foreground hover:text-foreground")}
                  >
                    <Icon className="size-3" />
                    {label}
                  </button>
                ))}
              </div>
            }
          >
            Сценарий
          </Label>
          {from === "voice" ? (
            <Pick
              value={voice}
              onChange={setVoice}
              placeholder="Проект из «Озвучки»"
              options={VOICE_SOURCES.map((s) => ({
                value: s.id,
                label: s.title,
                hint: [s.language.toUpperCase(), s.tracks ? `${s.tracks} дорожек · ${clock(s.duration_sec)}` : "без озвучки"].join(" · "),
              }))}
            />
          ) : (
            <div className="flex h-10 items-center gap-2 rounded-[3px] border border-dashed border-line-strong bg-background px-1.5">
              <button
                type="button"
                onClick={() => setFile("rome_322.docx")}
                className={cn(
                  "flex h-7 items-center gap-1.5 rounded-[2px] px-2 text-xs",
                  file ? ON_BLUE : "text-muted-foreground hover:bg-elev hover:text-foreground",
                )}
              >
                <FileText className="size-3.5" />
                {file ?? "Сценарий .docx .txt .md"}
              </button>
              <button
                type="button"
                onClick={() => setAudio("rome_322_audio.zip")}
                className={cn(
                  "flex h-7 items-center gap-1.5 rounded-[2px] px-2 text-xs",
                  audio ? ON_BLUE : "text-muted-foreground hover:bg-elev hover:text-foreground",
                )}
              >
                <FileAudio className="size-3.5" />
                {audio ?? "Озвучка .zip"}
              </button>
              {(file || audio) && (
                <button
                  type="button"
                  onClick={() => (setFile(null), setAudio(null))}
                  className="ml-auto grid size-7 place-items-center text-faint hover:text-danger"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>
          )}
        </div>
        <div className="xl:col-span-3">
          <Label>Название</Label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={from === "voice" ? v?.title : "из файла"} className={INPUT} />
        </div>
        <div className="xl:col-span-3">
          <Label>Движок</Label>
          <Pick value={engine} onChange={setEngine} options={ENGINES} />
        </div>

        <div className="md:col-span-2 xl:col-span-8">
          <Label>Источники</Label>
          <div className="grid grid-cols-2 gap-[3px] rounded-[3px] bg-surface-2 p-[3px] sm:grid-cols-4">
            {GROUPS.map((g) => {
              const on = groups.includes(g)
              return (
                <button
                  key={g}
                  type="button"
                  title={GROUP_HINT[g]}
                  onClick={() => setGroups((x) => (on ? x.filter((y) => y !== g) : GROUPS.filter((y) => y === g || x.includes(y))))}
                  className={cn(
                    "flex items-center justify-center gap-2 rounded-[2px] py-2 text-sm transition-colors",
                    on ? ON_BLUE : "text-faint hover:text-foreground-2",
                  )}
                >
                  <span className={cn("size-2 rounded-full", on ? GROUP_COLOR[g] : "bg-line-strong")} />
                  {GROUP_LABEL[g]}
                </button>
              )
            })}
          </div>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            <Toggle on={opts.yt_first} onClick={() => flip("yt_first")}>
              YouTube первым
            </Toggle>
            <Toggle on={opts.yt_trusted} onClick={() => flip("yt_trusted")}>
              YouTube: гос. архивы
            </Toggle>
            <Toggle on={opts.yt_any} onClick={() => flip("yt_any")} warn>
              YouTube: любые лицензии
            </Toggle>
            <Toggle on={opts.film_risky} onClick={() => flip("film_risky")} warn>
              Фильмы 1931–1963
            </Toggle>
          </div>
        </div>
        <div className="xl:col-span-2">
          <Label>Порог</Label>
          <Seg
            value={score}
            onChange={setScore}
            mono
            options={[
              ["6", "6"],
              ["7", "7"],
              ["8", "8"],
            ]}
          />
        </div>
        <div className="xl:col-span-2">
          <Label>Формат</Label>
          <Seg
            value={format}
            onChange={setFormat}
            mono
            options={[
              ["16:9", "16:9"],
              ["9:16", "9:16"],
            ]}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-3">
        <span className="min-w-0 truncate font-mono text-[11px] text-muted-foreground">{meta.join(" · ")}</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={!ready}
            onClick={() => toast("Макет: запуск появится вместе с API")}
            className={cn(BTN_SECONDARY, "disabled:opacity-50")}
          >
            Только шот-лист
          </button>
          <button type="button" disabled={!ready || !groups.length} onClick={() => toast("Макет: запуск появится вместе с API")} className={BTN_PRIMARY}>
            <ScanSearch className="size-3.5" />
            Найти видео
          </button>
        </div>
      </div>
    </section>
  )
}
