"use client"

import { createContext, useCallback, useContext, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { auth, onUnauthorized, type User } from "@/lib/api"
import { useCurrentProject } from "@/lib/project"
import { useHydrated } from "@/lib/queries"
import { cn } from "@/lib/utils"

const LAST_USER_KEY = "fl_last_uid"

export const authKeys = {
  me: ["auth", "me"] as const,
  providers: ["auth", "providers"] as const,
  sessions: ["auth", "sessions"] as const,
  adminUsers: ["admin", "users"] as const,
}

export function isAuthPath(pathname: string | null): boolean {
  return (
    pathname === "/login" ||
    pathname === "/register" ||
    pathname === "/forgot-password" ||
    pathname === "/reset-password" ||
    pathname === "/verify-email" ||
    pathname === "/privacy" ||
    pathname === "/terms"
  )
}

export function safeNextPath(raw: string | null | undefined, fallback = "/"): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) return fallback
  return raw
}

interface AuthContextValue {
  user: User | null
  isLoading: boolean
  setUser: (user: User | null) => void
  refresh: () => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const qc = useQueryClient()
  const router = useRouter()
  const hydrated = useHydrated()
  const [, setCurrentProject] = useCurrentProject()

  const meQuery = useQuery({
    queryKey: authKeys.me,
    queryFn: async () => (await auth.session()).user,
    enabled: hydrated,
    retry: false,
    staleTime: 60_000,
  })

  const user = hydrated ? (meQuery.data ?? null) : null
  const isLoading = !hydrated || meQuery.isLoading

  // Clear local project selection & cached user data when switching between accounts
  useEffect(() => {
    if (!user) return
    try {
      const prev = localStorage.getItem(LAST_USER_KEY)
      if (prev && prev !== user.id) {
        setCurrentProject(null)
        qc.removeQueries({ predicate: (q) => q.queryKey[0] !== "auth" })
      }
      localStorage.setItem(LAST_USER_KEY, user.id)
    } catch {}
  }, [user, qc, setCurrentProject])

  useEffect(() => {
    return onUnauthorized(() => {
      qc.setQueryData(authKeys.me, null)
      if (typeof window !== "undefined" && !isAuthPath(window.location.pathname)) {
        const dest = window.location.pathname + window.location.search
        const qs = new URLSearchParams({ expired: "1" })
        if (dest && dest !== "/") qs.set("next", dest)
        router.replace(`/login?${qs.toString()}`)
      }
    })
  }, [qc, router])

  const setUser = useCallback(
    (next: User | null) => {
      qc.setQueryData(authKeys.me, next)
    },
    [qc]
  )

  const refresh = useCallback(async () => {
    await qc.invalidateQueries({ queryKey: authKeys.me })
  }, [qc])

  const logout = useCallback(async () => {
    try {
      await auth.logout()
    } catch {}
    try {
      localStorage.removeItem(LAST_USER_KEY)
    } catch {}
    setCurrentProject(null)
    qc.clear()
    qc.setQueryData(authKeys.me, null)
    toast("Вы вышли из аккаунта")
    router.replace("/login?expired=1")
  }, [qc, router, setCurrentProject])

  const value = useMemo<AuthContextValue>(
    () => ({ user, isLoading, setUser, refresh, logout }),
    [user, isLoading, setUser, refresh, logout]
  )

  return <AuthContext value={value}>{children}</AuthContext>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider")
  return ctx
}

export function userInitials(user: Pick<User, "name" | "email"> | null | undefined): string {
  const raw = (user?.name || user?.email || "").trim()
  if (!raw) return "?"
  const parts = raw.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase()
  }
  return raw.slice(0, 1).toUpperCase()
}

export function UserAvatar({
  user,
  className,
}: {
  user: Pick<User, "name" | "email" | "avatar_url"> | null | undefined
  className?: string
}) {
  if (user?.avatar_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={user.avatar_url}
        alt={user.name || user.email}
        referrerPolicy="no-referrer"
        className={cn("size-7 shrink-0 rounded-[3px] object-cover ring-1 ring-line-strong", className)}
      />
    )
  }
  return (
    <span
      className={cn(
        "grid size-7 shrink-0 place-items-center rounded-[3px] bg-electric-soft font-mono text-xs font-semibold text-electric-text ring-1 ring-line-strong",
        className
      )}
    >
      {userInitials(user)}
    </span>
  )
}
