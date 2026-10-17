"use client"

import { useState } from "react"

import { Composer } from "@/components/create/composer"
import { Feed } from "@/components/create/feed"
import { GenerationsBar } from "@/components/create/generations-bar"

export default function Page() {
  const [search, setSearch] = useState("")
  const [avatarId, setAvatarId] = useState<string | null>(null)
  return (
    <div className="flex min-h-dvh flex-col">
      <div className="flex flex-1 flex-col gap-4 px-4 pt-[18px] pb-6 sm:px-7">
        <GenerationsBar mode="manual" search={search} onSearch={setSearch} />
        <Feed search={search} />
      </div>
      <div className="sticky bottom-0 z-10 bg-linear-to-t from-background via-background/95 to-transparent px-4 pt-6 pb-5 sm:px-7">
        <div className="mx-auto w-full max-w-[800px]">
          <Composer avatarId={avatarId} onAvatar={setAvatarId} />
        </div>
      </div>
    </div>
  )
}
