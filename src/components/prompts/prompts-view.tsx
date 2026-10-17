"use client"

import { useState } from "react"

import { Segmented } from "@/components/create/form-parts"
import { ProjectStyle } from "@/components/prompts/project-style"
import { PageHeader } from "@/components/shell/page-header"
import { ProjectPicker } from "@/components/shell/project-picker"
import { GeneratePanel } from "@/components/prompts/generate-panel"
import { TemplatesPanel } from "@/components/prompts/templates-panel"

export function PromptsView() {
  const [tab, setTab] = useState<"generate" | "templates">("generate")
  return (
    <div className="px-4 pt-8 pb-20 sm:px-7">
      <PageHeader
        title="Промпты"
        subtitle="Шаблон стиля из брифа, промпты по сценарию — и сразу в генерацию"
        actions={<ProjectPicker />}
      />
      <ProjectStyle />
      <div className="mb-5 flex">
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
