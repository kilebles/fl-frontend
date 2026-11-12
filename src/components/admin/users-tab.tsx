"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { admin, type AdminUser } from "@/lib/api"
import { UserAvatar, authKeys, useAuth } from "@/lib/auth"
import { cn } from "@/lib/utils"

const shortDateFmt = new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "short", year: "numeric" })

function formatShortDate(iso: string): string {
  try {
    return shortDateFmt.format(new Date(iso))
  } catch {
    return iso
  }
}

export function UsersTab() {
  const { user: currentUser } = useAuth()
  const qc = useQueryClient()

  const usersQuery = useQuery({
    queryKey: authKeys.adminUsers,
    queryFn: admin.users,
  })

  const patchUser = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: { role?: "user" | "admin"; is_active?: boolean } }) =>
      admin.updateUser(id, patch),
    onSuccess: (updated) => {
      qc.setQueryData<AdminUser[]>(authKeys.adminUsers, (prev) =>
        prev?.map((u) => (u.id === updated.id ? updated : u))
      )
      toast.success("Изменения сохранены")
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const users = usersQuery.data ?? []

  return (
    <section className="max-w-4xl rounded-[4px] border border-line bg-surface p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-semibold">Пользователи</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Всего зарегистрировано: {users.length}
          </p>
        </div>
      </div>

      <div className="mt-4 divide-y divide-line">
        {usersQuery.isLoading ? (
          <div className="h-28 rounded-[3px] shimmer" />
        ) : (
          users.map((u) => {
            const isSelf = u.id === currentUser?.id
            return (
              <div key={u.id} className="flex flex-wrap items-center justify-between gap-3 py-3.5 first:pt-1 last:pb-0">
                <div className="flex min-w-0 items-center gap-3">
                  <UserAvatar user={u} className="size-8" />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate font-mono text-sm font-medium">@{u.username}</span>
                      {u.role === "admin" && (
                        <span className="rounded-[2px] bg-electric-soft px-1.5 py-0.5 font-mono text-[10px] font-medium text-electric-text uppercase">
                          admin
                        </span>
                      )}
                      {!u.email_verified && (
                        <span className="rounded-[2px] bg-surface-2 px-1.5 py-0.5 text-[11px] text-muted-foreground">
                          Почта не подтверждена
                        </span>
                      )}
                      {!u.is_active && (
                        <span className="rounded-[2px] bg-danger/15 px-1.5 py-0.5 text-[11px] font-medium text-danger">
                          Заблокирован
                        </span>
                      )}
                      {isSelf && <span className="text-[11px] text-faint">(вы)</span>}
                    </div>
                    <p className="truncate font-mono text-xs text-muted-foreground">
                      {u.email} · сессий: {u.active_sessions} · с {formatShortDate(u.created_at)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={isSelf || patchUser.isPending}
                    onClick={() =>
                      patchUser.mutate({
                        id: u.id,
                        patch: { role: u.role === "admin" ? "user" : "admin" },
                      })
                    }
                    className="h-8 rounded-[3px] border border-line-strong bg-background px-2.5 text-xs font-medium transition-colors hover:border-faint disabled:opacity-40"
                  >
                    {u.role === "admin" ? "Сделать user" : "Сделать admin"}
                  </button>
                  <button
                    type="button"
                    disabled={isSelf || patchUser.isPending}
                    onClick={() =>
                      patchUser.mutate({
                        id: u.id,
                        patch: { is_active: !u.is_active },
                      })
                    }
                    className={cn(
                      "h-8 rounded-[3px] border px-2.5 text-xs font-medium transition-colors disabled:opacity-40",
                      u.is_active
                        ? "border-line-strong bg-background text-danger hover:border-danger/50 hover:bg-danger/10"
                        : "border-ok/40 bg-ok/10 text-ok hover:bg-ok/20"
                    )}
                  >
                    {u.is_active ? "Блокировать" : "Разблокировать"}
                  </button>
                </div>
              </div>
            )
          })
        )}
      </div>
    </section>
  )
}
