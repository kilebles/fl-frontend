"use client"

import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { projects, type Project } from "@/lib/api"
import { useCurrentProject } from "@/lib/project"
import { keys, useProjects } from "@/lib/queries"

function StyleEditor({ project }: { project: Project }) {
  const qc = useQueryClient()
  const [style, setStyle] = useState(project.style)
  const save = useMutation({
    mutationFn: () => projects.update(project.id, { style }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.projects }),
    onError: (e) => toast.error(e.message),
  })
  return (
    <input
      value={style}
      onChange={(e) => setStyle(e.target.value)}
      onBlur={() => style !== project.style && save.mutate()}
      onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
      placeholder="кинематографичный свет, тёплые приглушённые тона, лёгкое зерно плёнки, объектив 35 мм"
      className="h-11 w-full rounded-[3px] border border-line-strong bg-background px-3.5 font-mono text-[13px] text-electric-text outline-none placeholder:text-faint focus:border-electric/60"
    />
  )
}

/** "Стиль проекта": one style line added to every prompt generated in the project. */
export function ProjectStyle() {
  const [projectId] = useCurrentProject()
  const { data: list } = useProjects()
  const project = list?.find((p) => p.id === projectId)

  return (
    <section className="mb-6 rounded-[4px] border border-line bg-surface p-5">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-semibold">{project ? `Стиль проекта «${project.title}»` : "Стиль проекта"}</h2>
        <span className="text-[13px] text-muted-foreground">Добавляется к каждому промпту проекта</span>
      </div>
      {project ? (
        <StyleEditor key={project.id} project={project} />
      ) : (
        <p className="text-sm text-muted-foreground">Выберите проект справа вверху, чтобы задать общий стиль.</p>
      )}
    </section>
  )
}
