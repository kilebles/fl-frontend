"use client"

import { Download, Film, FolderArchive } from "lucide-react"

import { CAT_BG, CAT_LABEL, CATEGORIES, clock } from "@/components/reels/parts"
import { BTN_PRIMARY, BTN_SECONDARY, Card } from "@/components/script/ui"
import { reels, type Reel } from "@/lib/api"
import { bytes } from "@/lib/format"
import { cn } from "@/lib/utils"

/** Orders to the modules: how many shots of each category are ready, went to a fallback or failed. */
export function MaterialsCard({ reel: r }: { reel: Reel }) {
  const m = r.materials
  if (!m || !m.total) return null
  const rows = CATEGORIES.filter((c) => m.by_category[c]?.total)
  return (
    <Card title="Материалы" aside={<span className="font-mono text-[11px] text-faint">{m.done} из {m.total} кадров</span>}>
      <div className="space-y-2.5">
        {rows.map((c) => {
          const x = m.by_category[c]!
          return (
            <div key={c} className="grid grid-cols-[150px_1fr_auto] items-center gap-3 text-sm max-sm:grid-cols-[110px_1fr]">
              <span className="truncate text-foreground-2">{CAT_LABEL[c]}</span>
              <div className="h-1.5 overflow-hidden rounded-full bg-elev">
                <div className={cn("h-full", CAT_BG[c])} style={{ width: `${(100 * x.done) / x.total}%` }} />
              </div>
              <span className="font-mono text-[11px] text-faint max-sm:col-span-2">
                {x.done}/{x.total}
                {x.fallback ? ` · в ИИ ${x.fallback}` : ""}
                {x.failed ? ` · не вышло ${x.failed}` : ""}
              </span>
            </div>
          )
        })}
      </div>
    </Card>
  )
}

/** The assembled reel: player, mp4 and the montage project for DaVinci. */
export function ResultCard({ reel: r }: { reel: Reel }) {
  const res = r.result
  if (!res) return null
  return (
    <Card
      title="Готовый ролик"
      aside={<span className="font-mono text-[11px] text-faint">{[clock(res.sec), res.languages.join(" · ")].filter(Boolean).join(" · ")}</span>}
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
        <video
          src={reels.resultUrl(r.id, "mp4")}
          controls
          preload="metadata"
          className={cn("w-full rounded-[3px] bg-black", r.settings.format === "9:16" ? "aspect-[9/16] max-h-[70vh]" : "aspect-video")}
        />
        <div className="flex flex-col gap-2">
          <a href={reels.resultUrl(r.id, "mp4")} download className={BTN_PRIMARY}>
            <Download className="size-3.5" />
            Ролик · {bytes(res.mp4.size)}
          </a>
          <a href={reels.resultUrl(r.id, "montage")} download className={BTN_SECONDARY}>
            <FolderArchive className="size-3.5" />
            Проект для DaVinci · {bytes(res.montage.size)}
          </a>
          <div className="mt-2 space-y-1.5 text-[13px] text-muted-foreground">
            <p className="flex items-start gap-2">
              <Film className="mt-0.5 size-3.5 shrink-0 text-faint" />
              {res.renderer === "remotion" ? "Переходы и обработка стиля монтажа" : "Склейка без переходов: на сервере нет Remotion"}
            </p>
            {res.fallbacks > 0 && <p>Запасной ход у {res.fallbacks} кадр. — подробности в report.json проекта</p>}
            {res.failed > 0 && <p className="text-warn">Не вышло {res.failed} кадр. — их время отдано соседним</p>}
            <p className="text-faint">В проекте: клипы, голос каждого языка, reel.xml для DaVinci (File → Import → Timeline), EDL, атрибуция футажей.</p>
          </div>
        </div>
      </div>
    </Card>
  )
}
