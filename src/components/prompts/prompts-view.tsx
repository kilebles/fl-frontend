"use client"

import { ArrowLeft, FileStack, FolderKanban, Loader2 } from "lucide-react"

import { LaunchPanel } from "@/components/prompts/launch-panel"
import { projectMeta, ProjectList } from "@/components/prompts/project-list"
import { ProjectStyle } from "@/components/prompts/project-style"
import { ProjectView } from "@/components/prompts/project-view"
import { setUrlParams, usePgEvents, usePgHealth, usePgProject, useUrlParam } from "@/components/prompts/queries"
import { TemplatesScreen } from "@/components/prompts/templates-screen"
import { useNow } from "@/components/script/parts"
import { ScreenSwitch } from "@/components/script/ui"
import { PageHeader } from "@/components/shell/page-header"
import { ProjectPicker } from "@/components/shell/project-picker"

/** Shown only when something is wrong: the API is down or nobody runs the queue. */
function WorkerBadge() {
  const { data, error } = usePgHealth()
  if (!error && (!data || data.worker_online)) return null
  return (
    <span className="flex items-center gap-1.5 rounded-[3px] border border-warn/40 bg-warn-soft px-2 py-1 text-xs text-warn">
      <span className="size-1.5 rounded-full bg-warn" />
      {error ? "Промпты недоступны" : "Исполнитель не запущен"}
    </span>
  )
}

export function PromptsView() {
  usePgEvents()
  const tab = useUrlParam("tab")
  const pid = useUrlParam("p")
  const screen = tab === "templates" ? "templates" : "projects"
  const { data: project, isLoading, error } = usePgProject(screen === "projects" ? pid : null)
  const open = screen === "projects" && pid
  const now = useNow()

  return (
    <div className="px-4 pt-6 pb-24 sm:px-7">
      {open && (
        <button type="button" onClick={() => setUrlParams({ p: null })} className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-3.5" />
          Все проекты
        </button>
      )}
      <PageHeader
        title={open ? project?.title || "Проект" : "Промпты"}
        subtitle={open && project ? <span className="font-mono text-[13px]">{projectMeta(project, now).join(" · ")}</span> : undefined}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <WorkerBadge />
            <ScreenSwitch
              value={screen}
              onChange={(s) => setUrlParams(s === "templates" ? { tab: "templates", p: null } : { tab: null })}
              options={[
                ["projects", "Проекты", FolderKanban],
                ["templates", "Шаблоны ниш", FileStack],
              ]}
            />
            <ProjectPicker />
          </div>
        }
      />
      {screen === "templates" ? (
        <TemplatesScreen />
      ) : open ? (
        isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="size-4 animate-spin text-faint" />
          </div>
        ) : error || !project ? (
          <div className="py-16 text-center text-sm text-faint">{error?.message ?? "Проект не найден"}</div>
        ) : (
          <ProjectView key={project.id} project={project} />
        )
      ) : (
        <>
          <LaunchPanel />
          <ProjectList onOpen={(id) => setUrlParams({ p: id })} />
          <div className="mt-6">
            <ProjectStyle />
          </div>
        </>
      )}
    </div>
  )
}
