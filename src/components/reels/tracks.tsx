"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { AlertTriangle, Download, Loader2, RotateCcw, Rows3 } from "lucide-react"
import { toast } from "sonner"

import { clock } from "@/components/reels/parts"
import { rkeys, useReelTracks } from "@/components/reels/queries"
import { BTN_PRIMARY, BTN_SECONDARY, Card } from "@/components/script/ui"
import { reels, type Reel } from "@/lib/api"
import { bytes } from "@/lib/format"
import { cn } from "@/lib/utils"

/** YouTube language tracks: one mp3 per mixed language, as long as the reel, on the reel's common grid. */
export function TracksCard({ reel: r }: { reel: Reel }) {
  const qc = useQueryClient()
  const fromVoice = r.source.kind === "voice"
  const { data: info, error, isLoading } = useReelTracks(r.id, fromVoice)
  const st = r.tracks ?? info?.status ?? { state: "none" as const }
  const build = useMutation({
    mutationFn: () => reels.buildTracks(r.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: rkeys.reel(r.id) })
      qc.invalidateQueries({ queryKey: rkeys.tracks(r.id) })
    },
    onError: (e) => toast.error(e.message),
  })
  if (!fromVoice) return null

  const mixed = info?.mixed ?? []
  const base = info?.base ?? r.source.language.toUpperCase()
  const pending = info?.pending ?? []
  const building = st.state === "building" || build.isPending
  const canBuild = mixed.includes(base) && !building
  const hostSilent = st.state === "done" && !!st.host?.length
  const missing = Object.entries(st.missing ?? {})

  return (
    <Card
      title="Дорожки для YouTube"
      aside={st.state === "done" && st.sec ? <span className="font-mono text-[11px] text-faint">{clock(st.sec)} каждая</span> : undefined}
    >
      {isLoading ? (
        <div className="flex justify-center py-4">
          <Loader2 className="size-4 animate-spin text-faint" />
        </div>
      ) : error ? (
        <div className="text-sm text-danger">{error.message}</div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-1.5">
            {[base, ...mixed.filter((l) => l !== base), ...pending.filter((l) => l !== base)].map((l) => {
              const ok = mixed.includes(l)
              return (
                <span
                  key={l}
                  title={ok ? "сведено в «Озвучке»" : "ещё не сведено в «Озвучке»"}
                  className={cn(
                    "flex h-7 items-center gap-1.5 rounded-[3px] border px-2 font-mono text-xs",
                    ok ? "border-ok/40 bg-ok/15 text-ok" : "border-line-strong text-faint",
                  )}
                >
                  {l}
                  {l === base && <span className="text-[10px] opacity-70">база</span>}
                  {!ok && <span className="text-[10px]">не сведён</span>}
                </span>
              )
            })}
          </div>

          {!mixed.includes(base) && (
            <p className="text-sm text-muted-foreground">В проекте «Озвучки» ещё нет сведения — дорожки соберутся, когда языки сведут.</p>
          )}

          {building && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" />
              {st.stage === "build" ? `Собираю дорожки: ${st.done ?? 0} из ${st.total ?? mixed.length}` : `Беру сведение из «Озвучки»: ${st.done ?? 0} из ${st.total ?? mixed.length}`}
            </div>
          )}

          {st.state === "error" && (
            <div className="flex items-start gap-2 text-sm">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-danger" />
              <span className="text-foreground-2">{st.error}</span>
            </div>
          )}

          {st.state === "done" && (
            <div className="overflow-hidden rounded-[3px] border border-line">
              {(st.files ?? []).map((f) => (
                <div key={f.lang} className="flex items-center gap-3 border-b border-line px-3 py-2 text-sm last:border-b-0">
                  <span className="w-10 font-mono text-xs text-ok">{f.lang}</span>
                  <span className="min-w-0 flex-1 truncate text-foreground-2">{f.name}</span>
                  <span className="font-mono text-[11px] text-faint">{bytes(f.size)}</span>
                </div>
              ))}
            </div>
          )}

          {(hostSilent || missing.length > 0) && (
            <div className="space-y-1 text-[13px] text-muted-foreground">
              {hostSilent && (
                <p>
                  Абзацы ведущего ({st.host!.join(", ")}): в {st.base} диктор молчит — там звучит сам ведущий, его голос добавит сборка из клипов Veo. В
                  остальных языках звучит перевод.
                </p>
              )}
              {missing.map(([lang, ns]) => (
                <p key={lang} className="text-warn">
                  {lang}: нет дорожек абзацев {ns.join(", ")} — на их месте тишина.
                </p>
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 border-t border-line pt-4">
            {st.state === "done" && st.zip && (
              <a href={reels.tracksZipUrl(r.id)} className={BTN_PRIMARY} download>
                <Download className="size-3.5" />
                Скачать{st.size ? ` · ${bytes(st.size)}` : ""}
              </a>
            )}
            <button
              type="button"
              disabled={!canBuild}
              onClick={() => build.mutate()}
              className={cn(st.state === "done" ? BTN_SECONDARY : BTN_PRIMARY, "disabled:opacity-50")}
            >
              {building ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : st.state === "none" ? (
                <Rows3 className="size-3.5" />
              ) : (
                <RotateCcw className="size-3.5" />
              )}
              {st.state === "none" ? "Собрать дорожки" : "Собрать заново"}
            </button>
            <span className="text-xs text-faint">по mp3 на язык, длина каждой — ровно как у ролика</span>
          </div>
        </div>
      )}
    </Card>
  )
}
