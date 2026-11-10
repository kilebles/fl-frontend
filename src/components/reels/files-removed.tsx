import { Archive } from "lucide-react"

import { Card } from "@/components/script/ui"
import type { Reel } from "@/lib/api"

/** When fl-reel removed the reel's heavy files (`files_removed`, reel/cleanup.py: N days after it was done), else null. */
export function filesRemoved(r: Reel): string | null {
  return (r as Reel & { files_removed?: string | null }).files_removed ?? null
}

/** When fl-reel removed the working files of a done reel (`work_removed`, reel/cleanup.py: a day after it was done):
 *  mp4, the DaVinci project and the tracks still download, but the tracks can't be built again. Older brains: never. */
export function workRemoved(r: Reel): string | null {
  return (r as Reel & { work_removed?: string | null }).work_removed ?? null
}

/** In place of «Готовый ролик» and the YouTube tracks once the files are gone: the storyboard and materials stay. */
export function FilesRemovedCard({ at }: { at: string }) {
  const day = new Date(at).toLocaleDateString("ru-RU", { day: "numeric", month: "long" })
  return (
    <Card title="Готовый ролик">
      <p className="flex items-start gap-2 text-sm text-muted-foreground">
        <Archive className="mt-0.5 size-3.5 shrink-0 text-faint" />
        Файлы ролика удалены по сроку хранения ({day}): mp4, проект для DaVinci и дорожки скачать уже нельзя.
      </p>
    </Card>
  )
}
