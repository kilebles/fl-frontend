"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  ChevronLeft,
  FileText,
  Folder,
  History,
  Layers,
  LayoutGrid,
  type LucideIcon,
  Menu,
  MessageSquareText,
  Mic,
  Music,
  Play,
  Scissors,
  ScanSearch,
  SquarePlay,
  UserRound,
  X,
} from "lucide-react"
import { toast } from "sonner"

import { setTheme, useTheme } from "@/components/shell/theme"
import { cn } from "@/lib/utils"

interface NavItem {
  href: string
  label: string
  icon: LucideIcon
  /** Still in development: marked, opens a stub. */
  dev?: boolean
  /** Other paths that belong to this item. */
  also?: string[]
}

const TOP: NavItem[] = [{ href: "/videos", label: "Ролики", icon: LayoutGrid, dev: true }]
const TOOLS: NavItem[] = [
  { href: "/script", label: "Сценарий", icon: FileText, dev: true },
  { href: "/prompts", label: "Промпты", icon: MessageSquareText },
  { href: "/voice", label: "Озвучка", icon: Mic },
  { href: "/", label: "Генерации", icon: SquarePlay, also: ["/batch", "/jobs"] },
  { href: "/avatars", label: "Аватар", icon: UserRound },
  { href: "/footage", label: "Поиск видео", icon: ScanSearch, dev: true },
  { href: "/graphics", label: "Графика", icon: Layers },
  { href: "/music", label: "Музыка", icon: Music, dev: true },
  { href: "/edit", label: "Монтаж", icon: Scissors, dev: true },
]
const BOTTOM: NavItem[] = [
  { href: "/library", label: "Библиотека", icon: Folder, dev: true },
  { href: "/history", label: "История", icon: History, dev: true },
]
export const NAV = [...TOP, ...TOOLS, ...BOTTOM]

export function isActive(pathname: string, item: Pick<NavItem, "href" | "also">) {
  if (item.href === "/") return pathname === "/" || !!item.also?.some((p) => pathname.startsWith(p))
  return pathname.startsWith(item.href)
}

function Item({ item, pathname, collapsed, onNavigate }: { item: NavItem; pathname: string; collapsed: boolean; onNavigate?: () => void }) {
  const on = isActive(pathname, item)
  const Icon = item.icon
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      title={collapsed ? item.label : undefined}
      className={cn(
        "flex h-[38px] items-center gap-3 rounded-[3px] px-2.5 text-[15px] transition-colors",
        on ? "bg-elev font-medium text-foreground" : "text-foreground-2 hover:bg-elev/60 hover:text-foreground",
        collapsed && "justify-center px-0"
      )}
    >
      <Icon className={cn("size-[18px] shrink-0", on ? "text-electric" : "text-muted-foreground")} strokeWidth={1.75} />
      {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
      {!collapsed && item.dev && <span className="size-1.5 shrink-0 rounded-[1px] bg-dev" aria-label="в разработке" />}
    </Link>
  )
}

function ThemeToggle() {
  const theme = useTheme()
  return (
    <div className="flex gap-0.5 rounded-[4px] border border-line bg-surface p-0.5 text-[13px]">
      {(
        [
          ["dark", "Тёмная"],
          ["claude", "Claude"],
        ] as const
      ).map(([value, label]) => (
        <button
          key={value}
          type="button"
          onClick={() => setTheme(value)}
          className={cn(
            "flex-1 rounded-[3px] px-2 py-1 transition-colors",
            theme === value ? "bg-inverse text-inverse-foreground" : "text-muted-foreground hover:text-foreground"
          )}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

function SidebarBody({ collapsed, onCollapse, onNavigate }: { collapsed: boolean; onCollapse?: () => void; onNavigate?: () => void }) {
  const pathname = usePathname()
  return (
    <div className="flex h-full flex-col gap-1 px-3 py-4">
      <div className={cn("mb-4 flex items-center gap-2.5 px-1", collapsed && "flex-col")}>
        <span className="grid size-[30px] shrink-0 place-items-center rounded-[3px] bg-electric text-white">
          <Play className="size-3.5" strokeWidth={2.5} />
        </span>
        {!collapsed && <span className="flex-1 text-[15px] font-semibold">Motion Pr</span>}
        {onCollapse && (
          <button
            type="button"
            onClick={onCollapse}
            aria-label={collapsed ? "Развернуть меню" : "Свернуть меню"}
            className="grid size-7 place-items-center rounded-[3px] border border-line-strong text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className={cn("size-3.5 transition-transform", collapsed && "rotate-180")} />
          </button>
        )}
      </div>

      {TOP.map((item) => (
        <Item key={item.href} item={item} pathname={pathname} collapsed={collapsed} onNavigate={onNavigate} />
      ))}
      {!collapsed && <p className="mt-4 mb-1 px-2.5 text-[11px] font-medium tracking-[0.08em] text-faint uppercase">Инструменты</p>}
      {TOOLS.map((item) => (
        <Item key={item.href} item={item} pathname={pathname} collapsed={collapsed} onNavigate={onNavigate} />
      ))}
      <div className="my-3 h-px bg-line-strong" />
      {BOTTOM.map((item) => (
        <Item key={item.href} item={item} pathname={pathname} collapsed={collapsed} onNavigate={onNavigate} />
      ))}

      {!collapsed && (
        <>
          <p className="mt-3 flex items-center gap-2 px-2.5 text-xs text-muted-foreground">
            <span className="size-1.5 rounded-[1px] bg-dev" /> в разработке
          </p>
          <div className="mt-auto flex flex-col gap-3 pt-4">
            {/* Billing is not built yet: the balance is a placeholder. */}
            <div className="rounded-[4px] border border-line bg-surface p-3.5">
              <p className="text-[13px] text-muted-foreground">Баланс</p>
              <p className="mt-1 mb-3 font-mono text-xl font-medium">— кр.</p>
              <button
                type="button"
                onClick={() => toast("Оплата появится позже")}
                className="h-9 w-full rounded-[3px] border border-line-strong bg-background text-sm font-medium transition-colors hover:border-faint"
              >
                Пополнить
              </button>
            </div>
            <ThemeToggle />
            <div className="flex items-center gap-2.5 px-1 text-sm text-foreground-2">
              <span className="grid size-7 place-items-center rounded-[3px] bg-elev text-xs font-semibold">Д</span>
              Аккаунт
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)
  return (
    <aside className={cn("hidden shrink-0 border-r border-line bg-sidebar md:block", collapsed ? "w-[68px]" : "w-60")}>
      <div className="sticky top-0 h-dvh overflow-y-auto">
        <SidebarBody collapsed={collapsed} onCollapse={() => setCollapsed((c) => !c)} />
      </div>
    </aside>
  )
}

export function SidebarFallback() {
  return <aside className="hidden w-60 shrink-0 border-r border-line bg-sidebar md:block" />
}

/** Phone: a bar with the menu button; the menu slides over the page. */
export function MobileNav() {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  const current = NAV.find((item) => isActive(pathname, item))
  return (
    <div className="md:hidden">
      <div className="flex h-12 items-center gap-3 border-b border-line bg-sidebar px-3">
        <button type="button" onClick={() => setOpen(true)} aria-label="Меню" className="grid size-8 place-items-center rounded-[3px] border border-line-strong">
          <Menu className="size-4" />
        </button>
        <span className="text-sm font-medium">{current?.label ?? "Motion Pr"}</span>
      </div>
      {open && (
        <div className="fixed inset-0 z-50 flex">
          <div className="w-64 overflow-y-auto border-r border-line bg-sidebar">
            <div className="flex justify-end p-2">
              <button type="button" onClick={() => setOpen(false)} aria-label="Закрыть" className="grid size-8 place-items-center">
                <X className="size-4" />
              </button>
            </div>
            <SidebarBody collapsed={false} onNavigate={() => setOpen(false)} />
          </div>
          <button type="button" aria-label="Закрыть меню" className="flex-1 bg-black/50" onClick={() => setOpen(false)} />
        </div>
      )}
    </div>
  )
}
