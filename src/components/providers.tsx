"use client"

import { useState } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { useJobEvents } from "@/lib/queries"

function LiveEvents() {
  useJobEvents()
  return null
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () => new QueryClient({ defaultOptions: { queries: { staleTime: 5_000, refetchOnWindowFocus: true } } })
  )
  return (
    <QueryClientProvider client={client}>
      <TooltipProvider delay={250}>
        <LiveEvents />
        {children}
      </TooltipProvider>
      <Toaster theme="dark" position="bottom-right" />
    </QueryClientProvider>
  )
}
