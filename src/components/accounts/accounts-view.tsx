"use client"

import { useEffect, useState } from "react"
import { Film, Globe, Image as ImageIcon, Snowflake, UserRound } from "lucide-react"
import { motion } from "motion/react"

import type { Account } from "@/lib/api"
import { duration, plural } from "@/lib/format"
import { useAccounts } from "@/lib/queries"
import { cn } from "@/lib/utils"

/** Seconds since the data was fetched, ticking every second, to count pauses down locally. */
function useElapsed(since: number) {
  const [now, setNow] = useState(0)
  useEffect(() => {
    const tick = () => setNow(Date.now())
    const t = setInterval(tick, 1000)
    tick()
    return () => clearInterval(t)
  }, [])
  return now && since ? Math.max(0, (now - since) / 1000) : 0
}

function Pause({ icon: Icon, label, seconds }: { icon: React.ElementType; label: string; seconds: number }) {
  if (seconds <= 0) return null
  return (
    <div className="flex items-center gap-2 rounded-lg bg-warn/10 px-2.5 py-1.5 text-xs text-warn">
      <Icon className="size-3.5" /> {label}
      <span className="ml-auto font-mono tabular-nums">{duration(seconds)}</span>
    </div>
  )
}

function AccountCard({ account, elapsed, index }: { account: Account; elapsed: number; index: number }) {
  const cooldown = account.cooldown - elapsed
  const image = account.image_pause - elapsed
  const video = account.video_pause - elapsed
  const ready = !!account.dolphin_id
  const free = ready && cooldown <= 0 && image <= 0 && video <= 0
  const alive = account.proxies - account.dead_proxies

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03 }}
      className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-5"
    >
      <div className="flex items-center gap-3">
        <span className={cn("grid size-11 place-items-center rounded-xl ring-1", free ? "bg-ok/12 text-ok ring-ok/25" : ready ? "bg-warn/12 text-warn ring-warn/25" : "bg-surface-2 text-faint ring-line")}>
          <UserRound className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{account.name.replace("account_", "Аккаунт ")}</p>
          <p className="truncate font-mono text-xs text-faint">{account.dolphin_id ?? "нет dolphin_id"}</p>
        </div>
        <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-semibold", free ? "bg-ok/12 text-ok" : ready ? "bg-warn/12 text-warn" : "bg-surface-2 text-faint")}>
          {free ? "Свободен" : ready ? "На паузе" : "Не настроен"}
        </span>
      </div>

      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Globe className="size-4 text-faint" />
        {alive} {plural(alive, "прокси", "прокси", "прокси")}
        {account.dead_proxies > 0 && <span className="text-xs text-danger">· {account.dead_proxies} мёртвых</span>}
      </div>

      {(cooldown > 0 || image > 0 || video > 0) && (
        <div className="flex flex-col gap-1.5">
          <Pause icon={Snowflake} label="Кулдаун" seconds={cooldown} />
          <Pause icon={ImageIcon} label="Квота картинок" seconds={image} />
          <Pause icon={Film} label="Нет доступа к видео" seconds={video} />
        </div>
      )}
    </motion.div>
  )
}

export function AccountsView() {
  const { data: accounts, dataUpdatedAt, isLoading, error } = useAccounts()
  const elapsed = useElapsed(dataUpdatedAt)
  const free = accounts?.filter((a) => a.dolphin_id && Math.max(a.cooldown, a.image_pause, a.video_pause) - elapsed <= 0).length ?? 0

  return (
    <div className="mx-auto max-w-6xl px-4 pt-8 sm:px-6 md:pt-12 pb-20 lg:px-10">
      <header className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Аккаунты</h1>
        <p className="mt-2 text-muted-foreground">
          {accounts ? `${free} из ${accounts.length} свободны` : "Профили Dolphin Anty с аккаунтами Google"}
        </p>
      </header>
      {error && <p className="rounded-2xl border border-danger/25 bg-danger/10 p-4 text-sm text-danger">{error.message}</p>}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {isLoading && [0, 1, 2].map((i) => <div key={i} className="shimmer h-36 rounded-2xl" />)}
        {accounts?.map((a, i) => <AccountCard key={a.name} account={a} elapsed={elapsed} index={i} />)}
      </div>
      {accounts?.length === 0 && (
        <p className="rounded-2xl border border-dashed border-line-strong p-10 text-center text-sm text-muted-foreground">
          Нет аккаунтов — добавьте папки accounts/account_N с dolphin_id.txt
        </p>
      )}
    </div>
  )
}
