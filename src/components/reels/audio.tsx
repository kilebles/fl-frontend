"use client"

import { useEffect, useRef, useState } from "react"
import { Music2, Pause, Play, Volume2 } from "lucide-react"

import { clock } from "@/components/reels/parts"
import { Card } from "@/components/script/ui"
import type { Reel, ReelEpidemicItem } from "@/lib/api"
import { cn } from "@/lib/utils"

/** One shared player for the short Epidemic previews: a new one stops the previous. */
function usePreview() {
  const ref = useRef<HTMLAudioElement | null>(null)
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => () => ref.current?.pause(), [])
  const toggle = (src: string) => {
    if (!ref.current) {
      ref.current = new Audio()
      ref.current.onended = () => setUrl(null)
    }
    const a = ref.current
    if (url === src) {
      a.pause()
      setUrl(null)
      return
    }
    a.src = src
    a.currentTime = 0
    void a.play().catch(() => setUrl(null))
    setUrl(src)
  }
  return { url, toggle }
}

function PlayBtn({ item, player }: { item: ReelEpidemicItem | null; player: ReturnType<typeof usePreview> }) {
  const src = item?.preview
  if (!src) return <span className="size-7 shrink-0" />
  const on = player.url === src
  return (
    <button
      type="button"
      title={on ? "Пауза" : "Послушать превью Epidemic"}
      onClick={() => player.toggle(src)}
      className={cn(
        "grid size-7 shrink-0 place-items-center rounded-[3px] border transition-colors",
        on ? "border-pick/40 bg-pick/15 text-pick" : "border-line-strong text-foreground-2 hover:text-foreground",
      )}
    >
      {on ? <Pause className="size-3" /> : <Play className="size-3" />}
    </button>
  )
}

const paras = (a: number, b: number) => (a === b ? `абзац ${a}` : `абзацы ${a}–${b}`)

function Off({ note }: { note?: string }) {
  return <p className="text-sm text-muted-foreground">{note || "—"}</p>
}

/** Music and sounds of the reel from Epidemic Sound: what the brain picked, with previews. */
export function AudioCard({ reel: r }: { reel: Reel }) {
  const player = usePreview()
  const m = r.music
  const s = r.sounds
  if (!m && !s) return null
  const layers = r.result?.sounds
  const aside = r.result
    ? [r.result.music ? "музыка" : "", layers && (layers.ambience || layers.spots || layers.veo) ? "звуки" : ""].filter(Boolean).join(" и ")
    : ""
  return (
    <Card
      title="Музыка и звуки"
      aside={aside ? <span className="font-mono text-[11px] text-faint">{aside} — в mp4 и дорожках YouTube</span> : undefined}
    >
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div className="min-w-0 space-y-2.5">
          <h3 className="flex items-center gap-2 text-[13px] text-muted-foreground">
            <Music2 className="size-3.5" />
            Музыка
            {m?.status === "done" && <span className="font-mono text-[11px] text-faint">по главам · под речью тише</span>}
          </h3>
          {!m ? (
            <Off note="подберётся после материалов" />
          ) : m.status !== "done" ? (
            <Off note={m.note} />
          ) : (
            <ul className="space-y-1.5">
              {(m.items ?? []).map((it) => (
                <li key={it.k} className="flex min-w-0 items-center gap-2.5 rounded-[3px] border border-line bg-surface-2 px-2.5 py-2">
                  <PlayBtn item={it.track} player={player} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">
                      {it.track ? (
                        <>
                          {it.track.title}
                          {it.track.artists?.length ? <span className="text-muted-foreground"> — {it.track.artists.join(", ")}</span> : null}
                        </>
                      ) : (
                        <span className="text-warn">без трека</span>
                      )}
                    </span>
                    <span className="block truncate font-mono text-[11px] text-faint">
                      {[
                        it.chapter || `кусок ${it.k}`,
                        `${clock(it.start)}–${clock(it.start + it.sec)}`,
                        paras(it.first, it.last),
                        it.track?.bpm ? `${it.track.bpm} bpm` : "",
                        it.fitted === false ? "обрезан" : "",
                        it.track ? "" : it.note ?? "",
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="min-w-0 space-y-2.5">
          <h3 className="flex items-center gap-2 text-[13px] text-muted-foreground">
            <Volume2 className="size-3.5" />
            Звуки
            {s?.status === "done" && (
              <span className="font-mono text-[11px] text-faint">
                {{ low: "реже", normal: "обычно", high: "чаще" }[s.density ?? "normal"]}
                {s.veo === "keep" ? " · звук Veo" : ""}
                {s.planned ? ` · модель предложила ${s.planned.spots}, взято ${s.spots?.length ?? 0}` : ""}
              </span>
            )}
          </h3>
          {!s ? (
            <Off note="подберутся после музыки" />
          ) : s.status !== "done" ? (
            <Off note={s.note} />
          ) : (
            <div className="space-y-3">
              {(s.ambience ?? []).length > 0 && (
                <ul className="space-y-1.5">
                  {(s.ambience ?? []).map((a) => (
                    <li key={`${a.first}-${a.last}`} className="flex min-w-0 items-center gap-2.5 rounded-[3px] border border-line bg-surface-2 px-2.5 py-2">
                      <PlayBtn item={a.sfx} player={player} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm">
                          <span className="text-muted-foreground">фон · </span>
                          {a.sfx?.title ?? <span className="text-warn">не нашёлся</span>}
                        </span>
                        <span className="block truncate font-mono text-[11px] text-faint">
                          {paras(a.first, a.last)} · «{a.query}»
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {(s.spots ?? []).length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {(s.spots ?? []).map((x) => (
                    <span
                      key={x.shot}
                      title={x.sfx?.title ? `${x.sfx.title} · кадр ${x.shot}` : `не нашёлся · кадр ${x.shot}`}
                      className={cn(
                        "flex h-8 max-w-full items-center gap-1.5 rounded-[3px] border pr-2.5 pl-0.5 text-xs",
                        x.sfx ? "border-line bg-surface-2" : "border-warn/40 text-warn",
                      )}
                    >
                      <PlayBtn item={x.sfx} player={player} />
                      <span className="font-mono text-[11px] text-faint">{x.shot}</span>
                      <span className="truncate">{x.sound}</span>
                    </span>
                  ))}
                </div>
              )}
              {s.transition && (
                <div className="flex min-w-0 items-center gap-2.5 text-sm">
                  <PlayBtn item={s.transition.sfx} player={player} />
                  <span className="min-w-0 truncate">
                    <span className="text-muted-foreground">переход на смене главы · </span>
                    {s.transition.sfx?.title ?? <span className="text-warn">не нашёлся</span>}
                  </span>
                </div>
              )}
              {!(s.ambience ?? []).length && !(s.spots ?? []).length && <Off note="модель не предложила звуков" />}
              {!!s.errors?.length && <p className="font-mono text-[11px] text-faint">{s.errors.join(" · ")}</p>}
            </div>
          )}
        </div>
      </div>
    </Card>
  )
}
