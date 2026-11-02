"use client"

import { ArrowLeft, FolderKanban, Loader2, Radar } from "lucide-react"

import { LaunchPanel } from "@/components/footage/launch-panel"
import { ENGINE_LABEL } from "@/components/footage/parts"
import { ProjectList } from "@/components/footage/project-list"
import { ProjectView } from "@/components/footage/project-view"
import { useFootageEvents, useFootageHealth, useFootageProject } from "@/components/footage/queries"
import { SourcesScreen } from "@/components/footage/sources"
import { setUrlParams, useUrlParam } from "@/components/script/queries"
import { ScreenSwitch } from "@/components/script/ui"
import { PageHeader } from "@/components/shell/page-header"

/** Shown only when something is wrong: the API is down or nobody runs the queue. */
function WorkerBadge() {
  const { data, error } = useFootageHealth()
  if (!error && (!data || data.worker_online)) return null
  return (
    <span className="flex items-center gap-1.5 rounded-[3px] border border-warn/40 bg-warn-soft px-2 py-1 text-xs text-warn">
      <span className="size-1.5 rounded-full bg-warn" />
      {error ? "Поиск видео недоступен" : "Исполнитель не запущен"}
    </span>
  )
}

export function FootageView() {
  useFootageEvents()
  const tab = useUrlParam("tab")
  const pid = useUrlParam("p")
  const screen = tab === "sources" ? "sources" : "projects"
  const open = screen === "projects" && pid
  const { data: project, isLoading, error } = useFootageProject(open ? pid : null)

  return (
    <div className="px-4 pt-6 pb-24 sm:px-7">
      {open && (
        <button
          type="button"
          onClick={() => setUrlParams({ p: null })}
          className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          Все проекты
        </button>
      )}
      <PageHeader
        title={open ? project?.title || "Проект" : "Поиск видео"}
        subtitle={
          open && project ? (
            <span className="font-mono text-[13px]">
              {[
                project.source.kind === "voice" ? `озвучка ${project.source.language.toUpperCase()}` : project.source.name,
                `${project.source.paragraphs} абз.`,
                project.options.format,
                ENGINE_LABEL[project.options.engine] ?? project.options.engine,
                project.options.min_score != null ? `порог ${project.options.min_score}` : "",
              ]
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
              onChange={(s) => setUrlParams(s === "sources" ? { tab: "sources", p: null } : { tab: null })}
              options={[
                ["projects", "Проекты", FolderKanban],
                ["sources", "Источники", Radar],
              ]}
            />
          </div>
        }
      />
      {screen === "sources" ? (
        <SourcesScreen />
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
