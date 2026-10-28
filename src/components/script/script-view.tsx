"use client"

import { ArrowLeft, FolderKanban, Loader2, Target } from "lucide-react"

import { LaunchPanel } from "@/components/script/launch-panel"
import { NichesScreen } from "@/components/script/niches"
import { lengthText } from "@/components/script/parts"
import { ProjectList } from "@/components/script/project-list"
import { ProjectView } from "@/components/script/project-view"
import { setUrlParams, useScenarioEvents, useScenarioHealth, useScenarioProject, useUrlParam } from "@/components/script/queries"
import { ScreenSwitch } from "@/components/script/ui"
import { PageHeader } from "@/components/shell/page-header"

/** Shown only when something is wrong: the API is down or nobody runs the queue. */
export function WorkerBadge() {
  const { data, error } = useScenarioHealth()
  if (!error && (!data || data.worker_online)) return null
  return (
    <span className="flex items-center gap-1.5 rounded-[3px] border border-warn/40 bg-warn-soft px-2 py-1 text-xs text-warn">
      <span className="size-1.5 rounded-full bg-warn" />
      {error ? "Генератор недоступен" : "Исполнитель не запущен"}
    </span>
  )
}

export function ScriptView() {
  useScenarioEvents()
  const tab = useUrlParam("tab")
  const pid = useUrlParam("p")
  const screen = tab === "niches" ? "niches" : "projects"
  const { data: project, isLoading, error } = useScenarioProject(screen === "projects" ? pid : null)
  const open = screen === "projects" && pid

  return (
    <div className="px-4 pt-6 pb-24 sm:px-7">
      {open && (
        <button type="button" onClick={() => setUrlParams({ p: null })} className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-3.5" />
          Все проекты
        </button>
      )}
      <PageHeader
        title={open ? project?.title || project?.params.topic || "Проект" : "Сценарий"}
        subtitle={
          open && project ? (
            <span className="font-mono text-[13px]">
              {[project.niche_name || "без ниши", project.params.language.value?.toUpperCase(), project.params.length.value.chars ? lengthText(project) : "", project.model_label || "по этапам"]
                .filter(Boolean)
                .join(" · ")}
            </span>
          ) : undefined
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <WorkerBadge />
            <ScreenSwitch
              value={screen}
              onChange={(s) => setUrlParams(s === "niches" ? { tab: "niches", p: null } : { tab: null, niche: null })}
              options={[
                ["projects", "Проекты", FolderKanban],
                ["niches", "Ниши", Target],
              ]}
            />
          </div>
        }
      />
      {screen === "niches" ? (
        <NichesScreen />
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
        </>
      )}
    </div>
  )
}
