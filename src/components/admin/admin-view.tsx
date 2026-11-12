"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { Gauge, Users } from "lucide-react"

import { LimitsTab } from "@/components/admin/limits-tab"
import { UsersTab } from "@/components/admin/users-tab"
import { PageHeader } from "@/components/shell/page-header"
import { useAuth } from "@/lib/auth"
import { cn } from "@/lib/utils"

type TabId = "limits" | "users"

const TABS: { id: TabId; label: string; icon: typeof Gauge }[] = [
  { id: "limits", label: "Лимиты", icon: Gauge },
  { id: "users", label: "Пользователи", icon: Users },
]

/** Admin section: subscription limits of the models (fl-limits) and users. Admins only. */
export function AdminView() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, isLoading } = useAuth()
  const tab: TabId = searchParams.get("tab") === "users" ? "users" : "limits"

  if (isLoading && !user) {
    return (
      <div className="px-4 pt-8 pb-20 sm:px-7">
        <div className="h-9 w-40 rounded-[3px] shimmer" />
      </div>
    )
  }
  if (user?.role !== "admin") {
    return (
      <div className="px-4 pt-8 pb-20 sm:px-7">
        <PageHeader title="Админ" />
        <p className="text-sm text-muted-foreground">Раздел только для администраторов.</p>
      </div>
    )
  }

  return (
    <div className="px-4 pt-8 pb-20 sm:px-7">
      <PageHeader title="Админ" />
      <div className="mb-6 flex flex-wrap gap-1 border-b border-line pb-3">
        {TABS.map((t) => {
          const Icon = t.icon
          const on = tab === t.id
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => router.replace(t.id === "limits" ? "/admin" : `/admin?tab=${t.id}`, { scroll: false })}
              className={cn(
                "inline-flex h-9 items-center gap-2 rounded-[3px] px-3 text-sm transition-colors",
                on ? "bg-elev font-medium text-foreground" : "text-muted-foreground hover:bg-elev/60 hover:text-foreground"
              )}
            >
              <Icon className={cn("size-4", on ? "text-electric" : "text-muted-foreground")} />
              {t.label}
            </button>
          )
        })}
      </div>
      {tab === "limits" ? <LimitsTab /> : <UsersTab />}
    </div>
  )
}
