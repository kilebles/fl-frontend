"use client"

import { useState, useSyncExternalStore } from "react"

import { BatchForm } from "@/components/batch/batch-form"
import { BatchesPanel } from "@/components/batch/batches-panel"
import { GenerationsBar } from "@/components/create/generations-bar"

export default function Page() {
  // ?job=<id> opens a just-started batch
  const fromUrl = useSyncExternalStore(
    () => () => {},
    () => new URLSearchParams(window.location.search).get("job"),
    () => null
  )
  const [picked, setSelected] = useState<string | null>(null)
  const selected = picked ?? fromUrl
  return (
    <div className="flex flex-col gap-5 px-4 pt-[18px] pb-16 sm:px-7">
      <GenerationsBar mode="batch" />
      <div className="grid items-start gap-5 lg:grid-cols-[400px_minmax(0,1fr)]">
        <BatchForm />
        <BatchesPanel selected={selected} onSelect={setSelected} />
      </div>
    </div>
  )
}
