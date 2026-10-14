"use client"

import { Suspense } from "react"

import { MobileNav } from "@/components/shell/nav"
import { SearchBar } from "@/components/shell/search"

export function Topbar() {
  return (
    <header className="flex h-16 shrink-0 items-center gap-2 px-1 md:gap-4 md:px-2">
      <div className="hidden shrink-0 md:block md:w-60" />
      <div className="flex min-w-0 flex-1 justify-center">
        <SearchBar />
      </div>
      <div className="flex shrink-0 items-center gap-1.5 md:gap-3 md:pr-2">
        <Suspense>
          <MobileNav />
        </Suspense>
      </div>
    </header>
  )
}
