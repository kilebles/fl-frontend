"use client"

import { createContext, useContext, useState } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { useJobEvents } from "@/lib/queries"

const LiveContext = createContext(false)

export const useLive = () => useContext(LiveContext)

function LiveEvents({ children }: { children: React.ReactNode }) {
  const connected = useJobEvents()
  return <LiveContext.Provider value={connected}>{children}</LiveContext.Provider>
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () => new QueryClient({ defaultOptions: { queries: { staleTime: 5_000, refetchOnWindowFocus: true } } })
  )
  return (
    <QueryClientProvider client={client}>
      <TooltipProvider delay={250}>
        <LiveEvents>{children}</LiveEvents>
      </TooltipProvider>
      <Toaster theme="dark" position="bottom-right" />
    </QueryClientProvider>
  )
}
