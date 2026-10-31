"use client"

import { useState } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { AuthProvider, useAuth } from "@/lib/auth"
import { useJobEvents } from "@/lib/queries"

function LiveEvents() {
  const { user } = useAuth()
  useJobEvents(Boolean(user))
  return null
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () => new QueryClient({ defaultOptions: { queries: { staleTime: 5_000, refetchOnWindowFocus: true } } })
  )
  return (
    <QueryClientProvider client={client}>
      <AuthProvider>
        <TooltipProvider delay={250}>
          <LiveEvents />
          {children}
        </TooltipProvider>
        <Toaster theme="dark" position="bottom-right" />
      </AuthProvider>
    </QueryClientProvider>
  )
}
