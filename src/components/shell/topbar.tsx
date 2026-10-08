"use client"

import { Suspense } from "react"
import Link from "next/link"
import { Plus } from "lucide-react"
import { AnimatePresence, motion } from "motion/react"

import { Logo } from "@/components/shell/logo"
import { MobileNav } from "@/components/shell/nav"
import { useLive } from "@/components/providers"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { jobTitle, percent, plural } from "@/lib/format"
import { useJobs } from "@/lib/queries"
import { cn } from "@/lib/utils"

function QueuePill() {
  const { data: jobs, isError } = useJobs()
  const running = jobs?.find((j) => j.state === "running" || j.state === "waiting")
  const queued = jobs?.filter((j) => j.state === "queued").length ?? 0

  let content: React.ReactNode
  let key: string
  if (isError) {
    key = "offline"
    content = <span className="text-danger">Сервер недоступен</span>
  } else if (running) {
    key = `run-${running.id}`
    const value = percent(running.progress)
    content = (
      <Link href={`/jobs/${running.id}`} className="flex min-w-0 items-center gap-3">
        <span className={cn("size-2 shrink-0 animate-pulse-dot rounded-full", running.state === "waiting" ? "bg-warn text-warn" : "bg-electric text-electric")} />
        <span className="truncate font-medium">{jobTitle(running)}</span>
        <span className="h-1 w-24 shrink-0 overflow-hidden rounded-full bg-elev">
          <span className="bar-running block h-full rounded-full" style={{ width: `${value}%` }} />
        </span>
        <span className="font-mono text-xs text-muted-foreground tabular-nums">{value}%</span>
        {queued > 0 && <span className="text-xs text-faint">+{queued} в очереди</span>}
      </Link>
    )
  } else {
    key = `idle-${queued}`
    content = (
      <span className="text-muted-foreground">
        {queued ? `${queued} ${plural(queued, "задача", "задачи", "задач")} в очереди` : "Очередь пуста — всё готово"}
      </span>
    )
  }

  return (
    <div className="hidden h-11 w-full max-w-lg items-center overflow-hidden rounded-full border border-line-strong bg-surface px-5 text-sm lg:flex">
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={key}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.18 }}
          className="flex w-full min-w-0 items-center justify-center"
        >
          {content}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

export function Topbar() {
  const live = useLive()
  return (
    <header className="flex h-16 shrink-0 items-center gap-2 px-1 md:gap-4 md:px-2">
      <div className="flex shrink-0 items-center gap-3 pl-1 md:w-60 md:pl-2">
        <Logo />
      </div>
      <div className="flex flex-1 justify-center">
        <QueuePill />
      </div>
      <div className="flex shrink-0 items-center gap-1.5 md:gap-3 md:pr-2">
        <Suspense>
          <MobileNav />
        </Suspense>
        <Tooltip>
          <TooltipTrigger
            render={
              <span className="hidden items-center gap-2 rounded-full px-2 py-1 text-xs text-muted-foreground sm:flex">
                <span className={cn("size-1.5 rounded-full", live ? "bg-ok" : "bg-faint")} />
                <span className="hidden sm:inline">{live ? "Live" : "Offline"}</span>
              </span>
            }
          />
          <TooltipContent>{live ? "Прогресс обновляется в реальном времени" : "Нет связи с сервером"}</TooltipContent>
        </Tooltip>
        <Link
          href="/"
          className="glow-electric inline-flex h-10 items-center gap-2 rounded-full bg-electric px-3 text-sm sm:px-4 font-semibold text-white transition hover:brightness-110 active:translate-y-px"
        >
          <Plus className="size-4" /> <span className="hidden sm:inline">Новая задача</span>
        </Link>
      </div>
    </header>
  )
}
