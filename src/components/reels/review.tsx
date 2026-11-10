"use client"

import { ArrowRight, ScanEye } from "lucide-react"

import { CAT_BG, CAT_LABEL, clock, shotsText } from "@/components/reels/parts"
import { Card } from "@/components/script/ui"
import type { Reel, ReelCategory, ReelReview, ReelReviewKind, ReelReviewShot } from "@/lib/api"
import { cn } from "@/lib/utils"

export const REVIEW_KIND: Record<ReelReviewKind, string> = {
  offensive: "недопустимый жест или символ",
  anachronism: "анахронизм",
  mismatch: "не про текст",
  artifact: "дефект ИИ",
  watermark: "водяной знак или надпись",
  broken: "битый кадр",
}

const ACTION: Record<ReelReviewShot["action"], string> = { replaced: "заменён", kept: "оставлен", left: "осталась проблема" }

/** The stage caption under «проверка» in the steps line. */
export function reviewCaption(v: ReelReview | null | undefined) {
  if (!v) return ""
  if (v.status === "off") return "выключена"
  if (v.status === "failed") return "не вышла"
  if (!v.flagged) return v.checked ? "без замечаний" : ""
  return `замечаний ${v.flagged}${v.replaced ? ` · заменено ${v.replaced}` : ""}`
}

function Dot({ c }: { c: ReelCategory | "" }) {
  return c ? <span title={CAT_LABEL[c]} className={cn("size-2 shrink-0 rounded-full", CAT_BG[c])} /> : <span className="size-2 shrink-0 rounded-full bg-line-strong" />
}

function Row({ s }: { s: ReelReviewShot }) {
  const red = s.problems.some((p) => p.severity === "red")
  const moved = s.planned && s.category && s.planned !== s.category
  return (
    <li className="grid grid-cols-[44px_44px_minmax(0,1fr)_auto] items-start gap-x-3 py-2 text-xs max-sm:grid-cols-[40px_minmax(0,1fr)_auto]">
      <span className="pt-px font-mono text-[11px] text-muted-foreground">{clock(s.start)}</span>
      <span className="flex items-center gap-1 pt-px font-mono text-[11px] text-faint max-sm:hidden">{s.id}</span>
      <span className="flex min-w-0 items-start gap-2">
        <span className="flex shrink-0 items-center gap-1 pt-[3px]" title={moved ? `${CAT_LABEL[s.planned as ReelCategory]} → ${CAT_LABEL[s.category as ReelCategory]}` : undefined}>
          {moved && (
            <>
              <Dot c={s.planned} />
              <ArrowRight className="size-2.5 text-faint" />
            </>
          )}
          <Dot c={s.category || s.planned} />
        </span>
        <span className="min-w-0 space-y-0.5">
          {s.problems.map((p, i) => (
            <span key={i} className={cn("block break-words", p.severity === "red" ? "text-foreground-2" : "text-muted-foreground")}>
              <span className={cn("font-medium", p.severity === "red" ? "text-danger" : "text-foreground-2")}>{REVIEW_KIND[p.kind] ?? p.kind}</span>
              {p.note && <span>: {p.note}</span>}
              {p.after && <span className="font-mono text-[11px] text-faint"> · после замены</span>}
            </span>
          ))}
        </span>
      </span>
      <span
        className={cn(
          "rounded-[2px] px-1.5 py-0.5 font-mono text-[11px] whitespace-nowrap",
          s.action === "replaced" && "bg-ok/15 text-ok",
          s.action === "left" && "bg-danger/15 text-danger",
          s.action === "kept" && (red ? "bg-warn-soft text-warn" : "bg-surface-2 text-muted-foreground"),
        )}
      >
        {ACTION[s.action] ?? s.action}
      </span>
    </li>
  )
}

/** «Проверка кадров» (fl-reel stage review): what the model found on the finished shots and what was done with it.
 *  Older reels have no review — nothing is shown. */
export function ReviewCard({ reel: r }: { reel: Reel }) {
  const v = r.review
  if (!v) return null
  const shots = v.shots ?? []
  if (v.status !== "done" || !shots.length)
    return (
      <section className="flex min-w-0 items-center gap-2 rounded-[4px] border border-line bg-surface px-4 py-3 text-[13px] text-faint">
        <ScanEye className="size-3.5 shrink-0" />
        <span className="font-medium text-muted-foreground">Проверка кадров</span>
        <span className="min-w-0 truncate">
          ·{" "}
          {v.status === "done"
            ? `${v.checked ? `${shotsText(v.checked)} · ` : ""}замечаний нет`
            : v.note || (v.status === "off" ? "выключена" : "не вышла")}
        </span>
      </section>
    )
  return (
    <Card
      title="Проверка кадров"
      aside={
        <span className="font-mono text-[11px] text-faint">
          проверено {v.checked ?? 0} · замечаний {v.flagged ?? shots.length} · заменено {v.replaced ?? 0}
          {v.left ? <span className="text-danger"> · осталось {v.left}</span> : null}
        </span>
      }
      bodyClass="px-4 py-1.5"
    >
      <ul className="divide-y divide-line">
        {shots.map((s) => (
          <Row key={s.id} s={s} />
        ))}
      </ul>
    </Card>
  )
}
