"use client"

import { useEffect, useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Check, ChevronDown, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { projects } from "@/lib/api"
import { useCurrentProject } from "@/lib/project"
import { keys, useProjects } from "@/lib/queries"
import { cn } from "@/lib/utils"

/** "Проект" dropdown of the top bar: switch, or create a new one in place. */
export function ProjectPicker({ className }: { className?: string }) {
  const qc = useQueryClient()
  const { data: list } = useProjects()
  const [current, setCurrent] = useCurrentProject()
  const [title, setTitle] = useState("")
  const project = list?.find((p) => p.id === current)

  useEffect(() => {
    if (list && current && !list.some((p) => p.id === current)) {
      setCurrent(null)
    }
  }, [list, current, setCurrent])

  const create = useMutation({
    mutationFn: () => projects.create(title),
    onSuccess: (p) => {
      setTitle("")
      setCurrent(p.id)
      qc.invalidateQueries({ queryKey: keys.projects })
    },
    onError: (e) => toast.error(e.message),
  })

  const remove = useMutation({
    mutationFn: (id: string) => projects.remove(id),
    onSuccess: (_, id) => {
      if (current === id) setCurrent(null)
      qc.invalidateQueries({ queryKey: keys.projects })
      toast("Проект удалён")
    },
    onError: (e) => toast.error(e.message),
  })

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "flex h-[46px] min-w-44 items-center gap-3 rounded-[4px] border border-line-strong bg-surface px-3 text-left transition-colors hover:border-faint",
          className
        )}
      >
        <span className="min-w-0 flex-1">
          <span className="block text-[11px] leading-tight text-muted-foreground">Проект</span>
          <span className="block truncate text-sm font-semibold">{project?.title ?? "Все генерации"}</span>
        </span>
        <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" sideOffset={6} className="w-72 p-1.5">
        <DropdownMenuItem onClick={() => setCurrent(null)} className="rounded-[3px] px-2.5 py-2">
          <span className="flex-1">Все генерации</span>
          {!current && <Check className="size-4 text-electric" />}
        </DropdownMenuItem>
        {list?.map((p) => (
          <DropdownMenuItem key={p.id} onClick={() => setCurrent(p.id)} className="group rounded-[3px] px-2.5 py-2">
            <span className="flex-1 truncate">{p.title}</span>
            {p.id === current && <Check className="size-4 shrink-0 text-electric" />}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                if (confirm(`Удалить проект «${p.title}»? Генерации останутся во «Всех генерациях».`)) {
                  remove.mutate(p.id)
                }
              }}
              className="grid size-6 shrink-0 place-items-center rounded-[2px] text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:bg-danger/10 hover:text-danger"
              aria-label={`Удалить проект ${p.title}`}
              title="Удалить проект"
            >
              <Trash2 className="size-3.5" />
            </button>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <form
          className="flex gap-1.5 p-1"
          onSubmit={(e) => {
            e.preventDefault()
            if (title.trim()) create.mutate()
          }}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Новый проект"
            className="h-8 min-w-0 flex-1 rounded-[3px] border border-line-strong bg-background px-2.5 text-sm outline-none placeholder:text-faint focus:border-electric"
          />
          <button type="submit" disabled={!title.trim() || create.isPending} className="grid size-8 place-items-center rounded-[3px] bg-electric text-white disabled:opacity-40" aria-label="Создать проект">
            <Plus className="size-4" />
          </button>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
