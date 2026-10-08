"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutGrid, ListVideo, Sparkles, Users } from "lucide-react"
import { motion } from "motion/react"

import { isFinished } from "@/lib/api"
import { jobTitle, percent } from "@/lib/format"
import { MODE_BY_ID } from "@/lib/modes"
import { useJobs } from "@/lib/queries"
import { cn } from "@/lib/utils"
import { StateDot } from "@/components/jobs/state"

export const NAV = [
  { href: "/", label: "Создать", icon: Sparkles },
  { href: "/jobs", label: "Задачи", icon: ListVideo },
  { href: "/accounts", label: "Аккаунты", icon: Users },
]

export function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href)
}

export function Sidebar() {
  const pathname = usePathname()
  const { data: jobs } = useJobs()
  const active = (jobs ?? []).filter((j) => !isFinished(j.state)).slice(0, 6)
  const recent = (jobs ?? []).filter((j) => isFinished(j.state)).slice(0, 5)

  return (
    <aside className="hidden w-60 shrink-0 flex-col gap-2 md:flex">
      <nav className="rounded-2xl border border-line bg-surface p-2">
        {NAV.map(({ href, label, icon: Icon }) => {
          const on = isActive(pathname, href)
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "relative flex h-11 items-center gap-3 rounded-xl px-3 text-[15px] font-medium transition-colors",
                on ? "text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {on && (
                <motion.span
                  layoutId="nav-active"
                  className="absolute inset-0 rounded-xl bg-elev"
                  transition={{ type: "spring", stiffness: 500, damping: 40 }}
                />
              )}
              <Icon className={cn("relative size-[18px]", on && "text-electric")} />
              <span className="relative">{label}</span>
            </Link>
          )
        })}
      </nav>

      <div className="flex min-h-0 flex-1 flex-col rounded-2xl border border-line bg-surface p-2">
        <div className="flex items-center gap-2 px-3 pt-2 pb-3 text-xs font-medium tracking-wide text-faint uppercase">
          <LayoutGrid className="size-3.5" /> Библиотека
        </div>
        <div className="flex min-h-0 flex-col gap-0.5 overflow-y-auto">
          {active.length === 0 && recent.length === 0 && (
            <p className="px-3 py-2 text-sm text-faint">Здесь появятся ваши задачи</p>
          )}
          {[...active, ...recent].map((job) => {
            const Icon = MODE_BY_ID[job.mode].icon
            const on = pathname === `/jobs/${job.id}`
            const running = !isFinished(job.state)
            return (
              <Link
                key={job.id}
                href={`/jobs/${job.id}`}
                className={cn(
                  "group flex items-center gap-3 rounded-xl p-2 transition-colors hover:bg-elev/60",
                  on && "bg-elev"
                )}
              >
                <span className="relative grid size-9 shrink-0 place-items-center rounded-lg bg-surface-2 ring-1 ring-line">
                  <Icon className="size-4 text-muted-foreground" />
                  <StateDot state={job.state} className="absolute -right-0.5 -bottom-0.5 ring-2 ring-surface" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{jobTitle(job)}</span>
                  <span className="mt-1 block h-1 overflow-hidden rounded-full bg-elev">
                    <span
                      className={cn("block h-full rounded-full", running ? "bar-running" : "bg-faint/60")}
                      style={{ width: `${percent(job.progress)}%` }}
                    />
                  </span>
                </span>
              </Link>
            )
          })}
        </div>
      </div>
    </aside>
  )
}

export function SidebarFallback() {
  return (
    <aside className="hidden w-60 shrink-0 flex-col gap-2 md:flex">
      <div className="h-[148px] rounded-2xl border border-line bg-surface" />
      <div className="flex-1 rounded-2xl border border-line bg-surface" />
    </aside>
  )
}

export function MobileNav() {
  const pathname = usePathname()
  return (
    <nav className="flex gap-1 md:hidden">
      {NAV.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          aria-label={label}
          className={cn(
            "grid size-9 place-items-center rounded-lg text-muted-foreground",
            isActive(pathname, href) && "bg-elev text-electric"
          )}
        >
          <Icon className="size-4.5" />
        </Link>
      ))}
    </nav>
  )
}
