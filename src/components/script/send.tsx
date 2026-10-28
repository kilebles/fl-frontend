"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

import { scenario, voice, type ScenarioProject } from "@/lib/api"
import { handOff } from "@/lib/handoff"
import { cn } from "@/lib/utils"

type Target = "prompts" | "voice"

/** The finished .docx → «Промпты» (file pre-filled) or «Озвучка» (uploaded and selected). */
export function useSendScript() {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  const send = async (p: ScenarioProject, to: Target) => {
    const docx = p.job?.files.find((f) => f.name.endsWith(".docx"))
    if (!docx) {
      toast.error("У сценария нет .docx")
      return
    }
    setBusy(`${p.id}:${to}`)
    try {
      const file = await scenario.file(p.id, docx.name)
      if (to === "prompts") {
        handOff({ to: "prompts", file })
        router.push("/prompts")
      } else {
        const info = await voice.uploadScript(file, p.title || undefined)
        handOff({ to: "voice", scriptId: info.script_id })
        router.push("/voice")
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Не удалось передать сценарий")
    } finally {
      setBusy(null)
    }
  }
  return { send, busy }
}

export function SendButtons({ project, className }: { project: ScenarioProject; className?: string }) {
  const { send, busy } = useSendScript()
  return (
    <div className={cn("flex items-center gap-1", className)}>
      {(
        [
          ["prompts", "В промпты"],
          ["voice", "В озвучку"],
        ] as const
      ).map(([to, label]) => (
        <button
          key={to}
          type="button"
          disabled={!!busy}
          onClick={() => void send(project, to)}
          className="flex h-7 items-center gap-1 rounded-[3px] border border-pick/40 bg-pick-soft px-2 text-[11px] font-medium whitespace-nowrap text-pick-text transition-colors hover:bg-pick hover:text-white disabled:opacity-50"
        >
          {busy === `${project.id}:${to}` && <Loader2 className="size-3 animate-spin" />}
          {label}
        </button>
      ))}
    </div>
  )
}
