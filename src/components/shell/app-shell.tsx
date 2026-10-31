"use client"

import { useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"

import { MobileNav, Sidebar } from "@/components/shell/nav"
import { isAuthPath, useAuth } from "@/lib/auth"

const HAS_STATIC_TOKEN = Boolean(process.env.NEXT_PUBLIC_API_TOKEN)

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { user, isLoading } = useAuth()
  const authRoute = isAuthPath(pathname)

  useEffect(() => {
    if (authRoute || HAS_STATIC_TOKEN || isLoading || user) return
    const dest = typeof window !== "undefined" ? window.location.pathname + window.location.search : pathname
    const qs = new URLSearchParams({ expired: "1" })
    if (dest && dest !== "/") qs.set("next", dest)
    router.replace(`/login?${qs.toString()}`)
  }, [authRoute, isLoading, pathname, router, user])

  if (authRoute) {
    return <main className="min-h-dvh">{children}</main>
  }

  if (!HAS_STATIC_TOKEN && !isLoading && !user) {
    return <div className="min-h-dvh bg-background" />
  }

  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      <Sidebar />
      <MobileNav />
      <main className="relative min-w-0 flex-1">{children}</main>
    </div>
  )
}
