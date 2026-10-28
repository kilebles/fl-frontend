"use client"

import { Check, ChevronDown } from "lucide-react"

import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

/** Selected choice: languages green, everything else blue. */
export const ON_BLUE = "bg-pick-soft font-medium text-pick-text"
export const ON_GREEN = "bg-ok/15 font-medium text-ok"

export const INPUT =
  "h-10 w-full rounded-[3px] border border-line-strong bg-background px-3 text-sm outline-none placeholder:text-faint focus:border-electric/60"

export function Label({ children, aside }: { children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="mb-2 flex min-h-5 items-center justify-between gap-2 text-[13px] text-muted-foreground">
      <span>{children}</span>
      {aside}
    </div>
  )
}

/** One-of choice (segment); `tone="green"` for languages. */
export function Seg({
  value,
  onChange,
  options,
  tone = "blue",
  mono,
}: {
  value: string
  onChange: (v: string) => void
  options: (readonly [string, string] | readonly [string, string, string])[]
  tone?: "blue" | "green"
  mono?: boolean
}) {
  return (
    <div className="flex rounded-[3px] bg-surface-2 p-[3px]">
      {options.map(([id, label, hint]) => (
        <button
          key={id}
          type="button"
          title={hint}
          onClick={() => onChange(id)}
          className={cn(
            "flex-1 truncate rounded-[2px] px-2 py-2 text-sm whitespace-nowrap transition-colors",
            mono && "font-mono text-[13px]",
            value === id ? (tone === "green" ? ON_GREEN : ON_BLUE) : "text-foreground-2 hover:text-foreground"
          )}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

/** Dropdown with a hint line per option (like «Голоса» on «Озвучка»). */
export function Pick({
  value,
  options,
  onChange,
  placeholder = "Выбрать",
  footer,
}: {
  value: string
  options: { value: string; label: string; hint?: string }[]
  onChange: (value: string) => void
  placeholder?: string
  footer?: React.ReactNode
}) {
  const current = options.find((o) => o.value === value)
  const chosen = !!current && value !== ""
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "flex h-10 w-full min-w-0 items-center gap-2 rounded-[3px] border bg-background px-3 text-left text-sm transition-colors hover:border-electric/40 aria-expanded:border-electric/60",
          chosen ? "border-pick/40" : "border-line-strong"
        )}
      >
        <span className={cn("min-w-0 flex-1 truncate", chosen ? "text-pick-text" : current ? "text-foreground" : "text-faint")}>{current?.label ?? placeholder}</span>
        {current?.hint && <span className="hidden shrink-0 font-mono text-[11px] text-faint sm:inline">{current.hint}</span>}
        <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" sideOffset={4} className="max-h-80 w-(--anchor-width) min-w-56 overflow-y-auto rounded-[4px] p-1">
        {options.map((o) => (
          <DropdownMenuItem key={o.value} onClick={() => onChange(o.value)} className="gap-2 rounded-[3px] px-2.5 py-2">
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm">{o.label}</span>
              {o.hint && <span className="block truncate font-mono text-[11px] text-muted-foreground">{o.hint}</span>}
            </span>
            {o.value === value && <Check className="size-4 shrink-0 text-pick" />}
          </DropdownMenuItem>
        ))}
        {footer}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** Screen switch in the page header (like «Проекты · Профили и голоса»). */
export function ScreenSwitch<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T
  onChange: (v: T) => void
  options: readonly (readonly [T, string, React.ComponentType<{ className?: string }>])[]
}) {
  return (
    <div className="flex rounded-[4px] border border-line bg-surface p-0.5 text-[13px]">
      {options.map(([id, label, Icon]) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          className={cn(
            "flex items-center gap-1.5 rounded-[3px] px-3 py-1.5 font-medium transition-colors",
            value === id ? "bg-inverse text-inverse-foreground" : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Icon className="size-3.5" />
          {label}
        </button>
      ))}
    </div>
  )
}

export function Card({ title, aside, children, className, bodyClass }: {
  title?: React.ReactNode
  aside?: React.ReactNode
  children: React.ReactNode
  className?: string
  bodyClass?: string
}) {
  return (
    <section className={cn("rounded-[4px] border border-line bg-surface", className)}>
      {title && (
        <div className="flex min-h-11 items-center justify-between gap-3 border-b border-line px-4 py-2.5">
          <h2 className="text-sm font-semibold">{title}</h2>
          {aside}
        </div>
      )}
      <div className={cn("p-4", bodyClass)}>{children}</div>
    </section>
  )
}

export const BTN_PRIMARY =
  "flex h-10 items-center gap-2 rounded-[3px] bg-electric px-5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
export const BTN_SECONDARY =
  "flex h-10 items-center gap-2 rounded-[3px] border border-line-strong bg-surface-2 px-4 text-sm font-medium text-foreground transition-colors hover:bg-elev"
export const BTN_SMALL =
  "flex h-8 items-center gap-1.5 rounded-[3px] border border-line-strong bg-surface-2 px-2.5 text-xs font-medium text-foreground hover:bg-elev"
