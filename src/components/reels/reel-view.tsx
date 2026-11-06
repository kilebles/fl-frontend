"use client"

import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { AlertTriangle, Clock, Loader2, RotateCcw, Square, Trash2, TriangleAlert } from "lucide-react"
import { toast } from "sonner"

import {
  BASE_CATEGORIES,
  CATEGORIES,
  CAT_BG,
  CAT_LABEL,
  ENGINE_LABEL,
  MixBar,
  SharesAside,
  SharesInput,
  StepSteps,
  clock,
  parasText,
  roundShares,
  sameShares,
  sharesSum,
  shotsText,
  spentText,
  useSpent,
} from "@/components/reels/parts"
import { statusText } from "@/components/reels/reel-list"
import { rkeys, useReelOptions, useStoryboard } from "@/components/reels/queries"
import { BriefCard, StoryboardCard } from "@/components/reels/storyboard"
import { MaterialsCard, ResultCard } from "@/components/reels/result"
import { fontLabel, useFontList } from "@/components/reels/fonts"
import { TracksCard } from "@/components/reels/tracks"
import { ConfirmDialog } from "@/components/script/parts"
import { setUrlParams } from "@/components/script/queries"
import { BTN_PRIMARY, BTN_SECONDARY, Card } from "@/components/script/ui"
import { reels, type Reel, type ReelFootageSettings, type ReelShares, type ReelStoryboard } from "@/lib/api"
import { cn } from "@/lib/utils"

/** Search settings of the real categories that differ from the module's own, one short line. */
function footageLine(r: Reel) {
  const f = r.settings.footage
  if (!f) return ""
  const one = (label: string, x: ReelFootageSettings) => {
    const parts = [x.min_score !== null ? `порог ${x.min_score}` : "", x.vision_model, x.groups ? `${x.groups.length} ист.` : ""].filter(Boolean)
    return parts.length ? `${label}: ${parts.join(", ")}` : ""
  }
  return [one("видео", f.video), one("история", f.history)].filter(Boolean).join(" · ")
}

function Tile({ label, value, sub, tone }: { label: string; value: React.ReactNode; sub?: React.ReactNode; tone?: "warn" }) {
  return (
    <div className="flex min-w-0 flex-col justify-between gap-2 rounded-[3px] border border-line bg-background p-3.5">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={cn("font-mono text-2xl leading-none font-medium", tone === "warn" && "text-warn")}>{value}</div>
      {sub && <div className="truncate font-mono text-[11px] text-faint">{sub}</div>}
    </div>
  )
}

/** Plan vs fact per category; new shares re-allocate the finished storyboard at once, without the model. */
function MixCard({ reel, sb }: { reel: Reel; sb: ReelStoryboard }) {
  const qc = useQueryClient()
  const plan = roundShares(reel.settings.storyboard.shares)
  const host = !!reel.settings.avatar?.id
  const cats = host ? CATEGORIES : BASE_CATEGORIES
  const [draft, setDraft] = useState<ReelShares>(plan)
  const changed = !sameShares(draft, plan)
  const mix = sb.mix
  const apply = useMutation({
    mutationFn: () => reels.shares(reel.id, draft),
    onSuccess: (r) => {
      qc.setQueryData(rkeys.reel(reel.id), r)
      qc.invalidateQueries({ queryKey: rkeys.storyboard(reel.id) })
      qc.invalidateQueries({ queryKey: rkeys.list })
    },
    onError: (e) => toast.error(e.message),
  })
  const status = mix.within_tolerance ? (
    <span className="font-mono text-[11px] text-ok">в допуске ±{mix.tolerance}</span>
  ) : (
    <span className="font-mono text-[11px] text-warn">
      не хватает: {mix.short.map((c) => CAT_LABEL[c].toLowerCase()).join(", ") || "—"}
    </span>
  )
  return (
    <Card title="Доли материала" aside={status} bodyClass="p-0">
      <div className="grid grid-cols-1 divide-y divide-line lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:divide-x lg:divide-y-0">
        <div className="p-4">
          <div className="mb-3 space-y-2">
            {(
              [
                ["план", mix.target],
                ["факт", mix.actual],
              ] as const
            ).map(([k, v]) => (
              <div key={k} className="grid grid-cols-[36px_minmax(0,1fr)] items-center gap-3">
                <span className="font-mono text-[11px] text-faint">{k}</span>
                <MixBar shares={v} className="h-2.5 rounded-[2px]" />
              </div>
            ))}
          </div>
          <ul className="divide-y divide-line">
            {cats.map((c) => {
              const d = mix.actual[c] - mix.target[c]
              return (
                <li key={c} className="grid grid-cols-[minmax(0,1fr)_52px_52px_64px] items-center gap-2 py-2 text-xs sm:grid-cols-[minmax(0,1fr)_52px_52px_64px_76px]">
                  <span className="flex min-w-0 items-center gap-1.5 text-foreground-2">
                    <span className={cn("size-2 shrink-0 rounded-full", CAT_BG[c])} />
                    <span className="truncate">{CAT_LABEL[c]}</span>
                  </span>
                  <span className="text-right font-mono text-faint">{mix.target[c]}%</span>
                  <span className={cn("text-right font-mono font-medium", Math.abs(d) > mix.tolerance && "text-warn")}>{mix.actual[c]}%</span>
                  <span className="text-right font-mono text-faint">{clock(mix.seconds[c])}</span>
                  <span className="hidden text-right font-mono text-faint sm:block">{shotsText(mix.shots[c])}</span>
                </li>
              )
            })}
          </ul>
        </div>
        <div className="flex flex-col p-4">
          <div className="mb-2 flex items-center justify-between gap-2 text-[13px] text-muted-foreground">
            <span>Новые доли</span>
            <SharesAside value={draft} onChange={setDraft} host={host} />
          </div>
          <SharesInput value={draft} onChange={setDraft} short cats={cats} />
          <div className="mt-auto flex items-center justify-between gap-3 pt-4">
            <span className="text-xs text-faint">Кадры раскладываются заново по уже готовым оценкам — без модели и лимита.</span>
            <button
              type="button"
              disabled={!changed || sharesSum(draft) !== 100 || apply.isPending || reel.status === "running"}
              onClick={() => apply.mutate()}
              className={cn(BTN_PRIMARY, "shrink-0")}
            >
              {apply.isPending && <Loader2 className="size-3.5 animate-spin" />}
              Пересчитать
            </button>
          </div>
        </div>
      </div>
    </Card>
  )
}

export function ReelView({ reel: r, updatedAt }: { reel: Reel; updatedAt: number }) {
  const qc = useQueryClient()
  const [del, setDel] = useState(false)
  const done = r.steps.find((s) => s.key === "storyboard")?.state === "done"
  const { data: sb, error: sbError } = useStoryboard(r.id, done)
  const act = useMutation({
    mutationFn: (what: "stop" | "resume" | "again") => (what === "stop" ? reels.stop(r.id) : reels.resume(r.id, what === "again")),
    onSuccess: (data) => {
      qc.setQueryData(rkeys.reel(r.id), data)
      qc.invalidateQueries({ queryKey: rkeys.list })
      qc.removeQueries({ queryKey: rkeys.storyboard(r.id) })
    },
    onError: (e) => toast.error(e.message),
  })

  const { data: options } = useReelOptions()
  const montage = options?.montage.find((m) => m.value === r.settings.montage?.style)?.label ?? ""
  const fonts = useFontList()
  const s = r.summary
  const pr = r.progress
  const active = r.status === "running" || r.status === "queued"
  const usage = s?.usage
  const now = (stage: string) => active && (pr.stage ?? "storyboard") === stage
  const captions = {
    script: now("script") ? statusText(r) : r.source.kind === "voice" ? `из «Озвучки»` : r.source.kind === "topic" ? "по теме" : r.source.name,
    voice: now("voice") ? statusText(r) : r.source.timed ? `${r.source.language.toUpperCase()} · ${r.source.timed} дорожек` : "",
    storyboard: done && s ? shotsText(s.shots) : now("storyboard") ? statusText(r) : "",
    materials: now("materials") ? statusText(r) : r.materials?.total ? `${r.materials.done} из ${r.materials.total} кадров` : "",
    assembly: now("assembly") ? statusText(r) : r.result ? clock(r.result.sec) : "",
  }
  const spent = useSpent(r.timing, updatedAt)
  const times = Object.fromEntries(
    r.steps.map((x) => {
      const sec = spent.stage(x.key)
      return [x.key, sec === null || (!sec && x.state !== "active") ? "" : x.state === "active" ? clock(sec) : spentText(sec)]
    }),
  )
  const more = !active && r.steps.some((x) => x.key === "materials" && x.state === "todo") && done
  const total = s?.total_sec ?? 0

  return (
    <div className="space-y-5">
      <div className="rounded-[4px] border border-line bg-surface px-5 py-4">
        <StepSteps steps={r.steps} captions={captions} times={times} />
      </div>

      {r.status === "error" && r.error && (
        <div className="flex items-start gap-2.5 rounded-[4px] border border-danger/40 bg-danger/10 px-4 py-3 text-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger" />
          <span className="whitespace-pre-wrap text-foreground-2">{r.error}</span>
        </div>
      )}
      {active && pr.wait && (
        <div className="flex items-start gap-2.5 rounded-[4px] border border-warn/40 bg-warn-soft px-4 py-3 text-sm">
          <Clock className="mt-0.5 size-4 shrink-0 text-warn" />
          <span className="text-foreground-2">Раскадровка {pr.wait}. Продолжит сама.</span>
        </div>
      )}
      {!!s?.fallback_paragraphs.length && (
        <div className="flex items-start gap-2.5 rounded-[4px] border border-warn/40 bg-warn-soft px-4 py-3 text-sm">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warn" />
          <span className="text-foreground-2">
            Модель не дала кадры абзацев {s.fallback_paragraphs.join(", ")} — они разделены поровну и отданы на ИИ.
            {s.errors.length > 0 && <span className="mt-1 block font-mono text-[11px] text-faint">{s.errors.join(" · ")}</span>}
          </span>
        </div>
      )}

      <section className="rounded-[4px] border border-line bg-surface p-4">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <Tile
            label="Абзацы"
            value={r.source.paragraphs || "—"}
            sub={r.source.timed ? `по озвучке · ${r.source.timed} дорожек` : r.source.paragraphs ? "длительность по тексту" : ""}
          />
          <Tile label="Длительность" value={total ? clock(total) : "—"} sub={total ? "с паузами после абзацев" : ""} />
          <Tile label="Кадров" value={s?.shots ?? "—"} sub={s?.shots ? `в среднем ${(total / s.shots).toFixed(1)} с` : ""} />
          <Tile
            label="Слабые попадания"
            value={s ? s.mix.weak : "—"}
            tone={s?.mix.weak ? "warn" : undefined}
            sub={s ? "оценка категории ниже 4" : ""}
          />
          <Tile
            label="Вызовов модели"
            value={usage?.calls ?? "—"}
            sub={[
              sb?.engine ? `${ENGINE_LABEL[sb.engine] ?? sb.engine} ${sb.model ?? ""}`.trim() : ENGINE_LABEL[r.settings.storyboard.engine] || "из настроек",
              usage?.cache_hits ? `${usage.cache_hits} из кэша` : "",
            ]
              .filter(Boolean)
              .join(" · ")}
          />
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-4 border-t border-line pt-4">
          <span className="min-w-0 flex-1 truncate text-xs text-faint">
            {[
              montage ? `Монтаж: ${montage} · шрифт: ${fontLabel(fonts, r.settings.montage?.font)}` : "",
              r.settings.storyboard.style ? `стиль: ${r.settings.storyboard.style}` : "",
              r.settings.avatar?.id ? `ведущий: ${r.settings.avatar.name || "аватар"}` : "",
              r.settings.voice?.targets?.length ? `переводы: ${r.settings.voice.targets.join(", ")}` : "",
              r.settings.intro?.on
                ? `первые ${Math.round(r.settings.intro.sec / 60)} мин: ${(r.settings.avatar?.id ? CATEGORIES : BASE_CATEGORIES)
                    .map((c) => Math.round(r.settings.intro?.shares[c] ?? 0))
                    .join("·")}${s?.intro ? `, кадр ${s.intro.shot_sec.join("–")} с` : ""}`
                : "",
              footageLine(r),
              r.settings.storyboard.pauses && r.settings.storyboard.pauses.mode !== "off"
                ? `паузы: ${{ chapters: "в конце глав", every: `~раз в ${r.settings.storyboard.pauses.every_sec} с`, auto: "по смыслу" }[r.settings.storyboard.pauses.mode]}${s?.pauses ? ` (${s.pauses.count})` : ""}`
                : "",
              r.settings.storyboard.notes ? `детали: ${r.settings.storyboard.notes}` : "",
            ]
              .filter(Boolean)
              .join(" · ")}
          </span>
          <div className="flex flex-wrap items-center gap-2">
            {active ? (
              <button
                type="button"
                disabled={act.isPending}
                onClick={() => act.mutate("stop")}
                className="flex h-10 items-center gap-2 rounded-[3px] border border-danger/40 bg-danger/10 px-4 text-sm font-medium text-danger hover:bg-danger/20"
              >
                <Square className="size-3" />
                Стоп
              </button>
            ) : more ? (
              <button type="button" disabled={act.isPending} onClick={() => act.mutate("resume")} className={BTN_PRIMARY}>
                {act.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <RotateCcw className="size-3.5" />}
                Дальше: материалы и сборка
              </button>
            ) : done ? (
              <button
                type="button"
                disabled={act.isPending}
                onClick={() => act.mutate("again")}
                className={BTN_SECONDARY}
                title="Модель разложит ролик заново (новые вызовы, лимит подписки)"
              >
                {act.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <RotateCcw className="size-3.5" />}
                Раскадровка заново
              </button>
            ) : (
              <button type="button" disabled={act.isPending} onClick={() => act.mutate("resume")} className={BTN_SECONDARY}>
                {act.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <RotateCcw className="size-3.5" />}
                Продолжить
              </button>
            )}
            <button
              type="button"
              title="Удалить ролик"
              onClick={() => setDel(true)}
              className="grid size-10 place-items-center rounded-[3px] border border-line-strong text-faint hover:border-danger/40 hover:bg-danger/10 hover:text-danger"
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        </div>
      </section>

      <ResultCard reel={r} />
      <MaterialsCard reel={r} />
      <TracksCard reel={r} />

      {done && sbError && <div className="py-6 text-center text-sm text-danger">{sbError.message}</div>}
      {done && sb && (
        <>
          <MixCard key={JSON.stringify(r.settings.storyboard.shares)} reel={r} sb={sb} />
          <BriefCard brief={sb.brief} />
          <StoryboardCard sb={sb} />
        </>
      )}
      {!done && !active && r.status !== "error" && (
        <div className="py-6 text-center text-sm text-faint">
          Раскадровки нет — {r.status === "stopped" ? "ролик остановлен" : "ролик не запускался"}. {parasText(r.source.paragraphs)} ждут.
        </div>
      )}

      <ConfirmDialog
        open={del}
        title={`Удалить «${r.title}»?`}
        text={r.status === "running" ? "Ролик в работе — сначала останови его." : "Ролик и его раскадровка будут удалены."}
        onClose={() => setDel(false)}
        onConfirm={async () => {
          await reels.remove(r.id)
          qc.invalidateQueries({ queryKey: rkeys.list })
          setUrlParams({ p: null })
        }}
      />
    </div>
  )
}
