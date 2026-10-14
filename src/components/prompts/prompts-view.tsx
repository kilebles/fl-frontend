"use client"

import { useState } from "react"

import { Segmented } from "@/components/create/form-parts"
import { GeneratePanel } from "@/components/prompts/generate-panel"
import { TemplatesPanel } from "@/components/prompts/templates-panel"

export function PromptsView() {
  const [tab, setTab] = useState<"generate" | "templates">("generate")
  return (
    <div className="mx-auto max-w-6xl px-4 pt-8 pb-20 sm:px-6 md:pt-12 lg:px-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Промпты</h1>
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: "generate", label: "Генерация" },
            { value: "templates", label: "Шаблоны" },
          ]}
        />
      </div>
      {tab === "generate" ? <GeneratePanel /> : <TemplatesPanel />}
    </div>
  )
}
