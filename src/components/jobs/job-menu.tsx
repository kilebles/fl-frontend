"use client"

import { useRouter } from "next/navigation"
import { Ban, MoreHorizontal, RotateCcw, Trash2 } from "lucide-react"

import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { isFinished, type JobStatus } from "@/lib/api"
import { useJobActions } from "@/lib/queries"

const RETRYABLE = ["stopped", "failed", "cancelled"]

export function JobMenu({ job, redirect }: { job: JobStatus; redirect?: boolean }) {
  const router = useRouter()
  const actions = useJobActions()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        onClick={(e) => e.preventDefault()}
        className="grid size-9 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-elev hover:text-foreground aria-expanded:bg-elev"
      >
        <MoreHorizontal className="size-4.5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-44">
        {!isFinished(job.state) && (
          <DropdownMenuItem onClick={() => actions.cancel.mutate(job.id)}>
            <Ban /> Отменить
          </DropdownMenuItem>
        )}
        {RETRYABLE.includes(job.state) && (
          <DropdownMenuItem onClick={() => actions.retry.mutate(job.id)}>
            <RotateCcw /> Догенерировать
          </DropdownMenuItem>
        )}
        {(!isFinished(job.state) || RETRYABLE.includes(job.state)) && <DropdownMenuSeparator />}
        <DropdownMenuItem
          variant="destructive"
          onClick={() => {
            if (!confirm("Удалить задачу вместе со всеми результатами?")) return
            actions.remove.mutate(job.id, { onSuccess: () => redirect && router.push("/jobs") })
          }}
        >
          <Trash2 /> Удалить
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
