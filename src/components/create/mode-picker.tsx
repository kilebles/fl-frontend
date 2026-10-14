"use client"

import { Check, ChevronDown, Zap } from "lucide-react"

import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import type { ModeMeta } from "@/lib/modes"
import { cn } from "@/lib/utils"

export function ModePicker({ modes, value, onChange, className }: { modes: ModeMeta[]; value: ModeMeta; onChange: (m: ModeMeta) => void; className?: string }) {
  const Icon = value.icon
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "inline-flex h-9 items-center gap-2 rounded-full border border-line-strong bg-surface-2 pr-2.5 pl-3 text-[13px] font-medium transition-colors hover:border-electric/40 aria-expanded:border-electric/50",
          className
        )}
      >
        <Icon className="size-4 text-electric" />
        {value.title}
        {value.flash && <Zap className="size-3 fill-warn text-warn" />}
        <ChevronDown className="size-3.5 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" sideOffset={8} className="w-72 p-1.5">
        {modes.map((m) => {
          const ItemIcon = m.icon
          const on = m.id === value.id
          return (
            <DropdownMenuItem key={m.id} onClick={() => onChange(m)} className="gap-3 rounded-lg px-2.5 py-2">
              <span className={cn("grid size-8 shrink-0 place-items-center rounded-lg ring-1", on ? "bg-electric/15 text-electric ring-electric/30" : "bg-surface-2 text-muted-foreground ring-line")}>
                <ItemIcon className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5 text-sm font-medium">
                  {m.title}
                  {m.flash && (
                    <span className="inline-flex items-center gap-0.5 rounded-full bg-warn/15 px-1.5 text-[10px] font-semibold text-warn">
                      <Zap className="size-2.5 fill-current" /> Flash
                    </span>
                  )}
                </span>
                <span className="block text-xs text-muted-foreground">{m.description}</span>
              </span>
              {on && <Check className="size-4 text-electric" />}
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
