"use client"

import { Check, ChevronDown } from "lucide-react"

import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

export interface Option<T extends string | number> {
  value: T
  label: string
  hint?: string
}

/** A labelled dropdown in the style of the mode picker. */
export function Select<T extends string | number>({
  label,
  value,
  options,
  onChange,
  placeholder = "Выбрать",
  className,
}: {
  label: string
  value: T | null
  options: Option<T>[]
  onChange: (v: T) => void
  placeholder?: string
  className?: string
}) {
  const current = options.find((o) => o.value === value)
  return (
    <div className={cn("flex min-w-0 flex-col gap-2", className)}>
      <span className="text-[13px] text-muted-foreground">{label}</span>
      <DropdownMenu>
        <DropdownMenuTrigger
          disabled={!options.length}
          className="flex h-10 min-w-0 items-center gap-2 rounded-xl border border-line-strong bg-background/60 px-3 text-left text-sm transition-colors hover:border-electric/40 disabled:opacity-50 aria-expanded:border-electric/50"
        >
          <span className={cn("min-w-0 flex-1 truncate", !current && "text-faint")}>{current?.label ?? placeholder}</span>
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" sideOffset={6} className="max-h-80 w-(--anchor-width) min-w-56 overflow-y-auto p-1.5">
          {options.map((o) => (
            <DropdownMenuItem key={o.value} onClick={() => onChange(o.value)} className="gap-2 rounded-lg px-2.5 py-2">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm">{o.label}</span>
                {o.hint && <span className="block truncate text-xs text-muted-foreground">{o.hint}</span>}
              </span>
              {o.value === value && <Check className="size-4 shrink-0 text-electric" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
