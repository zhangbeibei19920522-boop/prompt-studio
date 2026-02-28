"use client"

import { ChevronDown, Plus, Settings } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface Project {
  id: string
  name: string
}

interface TopBarProps {
  projects: Project[]
  currentProjectId: string | null
  onProjectChange: (projectId: string) => void
  onNewProject: () => void
  onSettingsClick: () => void
}

export function TopBar({
  projects,
  currentProjectId,
  onProjectChange,
  onNewProject,
  onSettingsClick,
}: TopBarProps) {
  const currentProject = projects.find((p) => p.id === currentProjectId)

  return (
    <header className="flex h-14 items-center justify-between border-b bg-white px-4">
      {/* Left side: project selector + new project button */}
      <div className="flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="min-w-[140px] justify-between">
              <span className="truncate">
                {currentProject ? currentProject.name : "选择项目"}
              </span>
              <ChevronDown className="ml-1 shrink-0 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-[200px]">
            {projects.length === 0 ? (
              <DropdownMenuItem disabled>暂无项目</DropdownMenuItem>
            ) : (
              projects.map((project) => (
                <DropdownMenuItem
                  key={project.id}
                  onSelect={() => onProjectChange(project.id)}
                  data-active={project.id === currentProjectId}
                  className="data-[active=true]:bg-accent data-[active=true]:text-accent-foreground"
                >
                  {project.name}
                </DropdownMenuItem>
              ))
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={onNewProject}>
              <Plus className="text-muted-foreground" />
              新建项目
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button variant="ghost" size="sm" onClick={onNewProject}>
          <Plus />
          新建项目
        </Button>
      </div>

      {/* Right side: global settings button */}
      <Button variant="ghost" size="sm" onClick={onSettingsClick}>
        <Settings />
        全局设置
      </Button>
    </header>
  )
}
