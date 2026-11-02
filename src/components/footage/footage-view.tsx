"use client"

import { ArrowLeft, FolderKanban, Radar } from "lucide-react"

import { LaunchPanel } from "@/components/footage/launch-panel"
import { PROJECTS } from "@/components/footage/mock"
import { clock } from "@/components/footage/parts"
import { ProjectList } from "@/components/footage/project-list"
import { ProjectView } from "@/components/footage/project-view"
import { SourcesScreen } from "@/components/footage/sources"
import { setUrlParams, useUrlParam } from "@/components/script/queries"
import { ScreenSwitch } from "@/components/script/ui"
import { PageHeader } from "@/components/shell/page-header"

export function FootageView() {
  const tab = useUrlParam("tab")
  const pid = useUrlParam("p")
  const screen = tab === "sources" ? "sources" : "projects"
  const project = screen === "projects" && pid ? PROJECTS.find((x) => x.id === pid) : undefined

  return (
    <div className="px-4 pt-6 pb-24 sm:px-7">
      {project && (
        <button
          type="button"
          onClick={() => setUrlParams({ p: null, shot: null })}
          className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          Все проекты
        </button>
      )}
      <PageHeader
        title={project ? project.title : "Поиск видео"}
        subtitle={
          project ? (
            <span className="font-mono text-[13px]">
              {[
                project.source.kind === "voice" ? `озвучка ${project.source.language.toUpperCase()}` : project.source.name,
                `${project.paragraphs} абз.`,
                clock(project.duration_sec),
                project.format,
                project.engine,
                `порог ${project.min_score}`,
              ].join(" · ")}
            </span>
          ) : undefined
        }
        actions={
          <ScreenSwitch
            value={screen}
            onChange={(s) => setUrlParams(s === "sources" ? { tab: "sources", p: null, shot: null } : { tab: null })}
            options={[
              ["projects", "Проекты", FolderKanban],
              ["sources", "Источники", Radar],
            ]}
          />
        }
      />
      {screen === "sources" ? (
        <SourcesScreen />
      ) : project ? (
        <ProjectView key={project.id} project={project} />
      ) : (
        <>
          <LaunchPanel />
          <ProjectList onOpen={(id) => setUrlParams({ p: id })} />
        </>
      )}
    </div>
  )
}
