"use client"

import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { Check, Pencil, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { useReels } from "@/components/reels/queries"
import { VoiceProfileDialog } from "@/components/reels/voice-profile-dialog"
import { SampleButton } from "@/components/reels/voice-sample"
import { ConfirmDialog } from "@/components/script/parts"
import { voice, type Reel, type VoiceProfile } from "@/lib/api"
import { langCode } from "@/lib/langs"
import { cn } from "@/lib/utils"

const apiLang = (c: string) => {
  const u = c.trim().toUpperCase().replace("-", "_")
  return u === "PT_BR" || u === "BR" ? "PT" : u
}

/** Reels that have not voiced yet with this profile: after deletion «Озвучка» would take its default profile. */
const waitingWith = (reels: Reel[] | undefined, id: string) =>
  (reels ?? []).filter(
    (r) => r.status !== "done" && r.settings?.voice?.profile === id && r.steps?.find((s) => s.key === "voice")?.state !== "done",
  ).length

/**
 * Voice profiles of «Озвучка» as cards (step «Голос» of «Ролики»): pick, hear the base voice, edit, delete;
 * the dashed tile creates a new profile (a copy of the chosen one).
 */
export function VoiceProfileCards({
  profiles,
  selected,
  base,
  voiceName,
  onPick,
  onDeleted,
}: {
  profiles: VoiceProfile[]
  selected: string
  /** The reel's base language (API code). */
  base: string
  voiceName: (id: string) => string
  onPick: (p: VoiceProfile) => void
  onDeleted: (id: string) => void
}) {
  const qc = useQueryClient()
  const { data: reels } = useReels()
  const [dialog, setDialog] = useState<{ edit: VoiceProfile | null } | null>(null)
  const [del, setDel] = useState<VoiceProfile | null>(null)
  const chosen = profiles.find((p) => p.id === selected) ?? null
  const busy = del ? waitingWith(reels, del.id) : 0

  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {profiles.map((p) => {
          const main = Object.entries(p.default).find(([k]) => apiLang(k) === base)?.[1] ?? ""
          const on = p.id === selected
          return (
            <div
              key={p.id}
              className={cn(
                "relative flex min-w-0 flex-col rounded-[3px] border bg-background transition-colors",
                on ? "border-pick/60 ring-1 ring-pick/30" : "border-line-strong hover:border-faint",
              )}
            >
              <button type="button" onClick={() => onPick(p)} className="flex min-w-0 flex-1 flex-col items-start gap-1 p-3.5 pb-2.5 text-left">
                {on && (
                  <span className="absolute top-2.5 right-2.5 grid size-4 place-items-center rounded-full bg-pick text-white">
                    <Check className="size-2.5" />
                  </span>
                )}
                <span className="pr-6 text-sm font-medium">{p.name}</span>
                <span className="font-mono text-[11px] text-faint">{[`${Object.keys(p.voices).length} яз.`, ...p.channels].join(" · ")}</span>
              </button>
              <div className="flex items-center gap-2 border-t border-line py-1.5 pr-1.5 pl-2.5">
                <SampleButton id={main} title={main ? `Образец: ${voiceName(main)}` : "Образец"} />
                <span className={cn("min-w-0 flex-1 truncate text-xs", main ? "text-foreground-2" : "text-faint")}>
                  <span className="font-mono text-ok">{langCode(base)}</span> {main ? voiceName(main) : "голоса нет"}
                </span>
                <button
                  type="button"
                  title="Изменить профиль"
                  onClick={() => setDialog({ edit: p })}
                  className="grid size-7 place-items-center rounded-[3px] text-faint hover:bg-elev hover:text-foreground"
                >
                  <Pencil className="size-3.5" />
                </button>
                <button
                  type="button"
                  title="Удалить профиль"
                  onClick={() => setDel(p)}
                  className="grid size-7 place-items-center rounded-[3px] text-faint hover:bg-elev hover:text-danger"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            </div>
          )
        })}
        <button
          type="button"
          onClick={() => setDialog({ edit: null })}
          className="flex min-h-24 items-center justify-center gap-2 rounded-[3px] border border-dashed border-line-strong p-3.5 text-sm text-muted-foreground transition-colors hover:border-faint hover:text-foreground"
        >
          <Plus className="size-4" />
          Новый профиль
        </button>
      </div>

      <VoiceProfileDialog
        open={dialog !== null}
        profile={dialog?.edit ?? null}
        base={chosen ?? profiles[0] ?? null}
        onClose={() => setDialog(null)}
        onSaved={(p) => {
          if (!dialog?.edit) onPick(p)
        }}
      />
      <ConfirmDialog
        open={del !== null}
        title={`Удалить профиль «${del?.name ?? ""}»?`}
        text={
          busy
            ? `Он выбран у ${busy} ${busy % 10 === 1 && busy % 100 !== 11 ? "ролика" : "роликов"}, которые ещё не озвучены, — их озвучит профиль по умолчанию. Голоса останутся в «Озвучке».`
            : "Голоса останутся в «Озвучке»."
        }
        onClose={() => setDel(null)}
        onConfirm={async () => {
          const p = del!
          await voice.deleteProfile(p.id)
          await qc.invalidateQueries({ queryKey: ["reels", "voice-profiles"] })
          toast.success(`Профиль «${p.name}» удалён`)
          onDeleted(p.id)
        }}
      />
    </>
  )
}
