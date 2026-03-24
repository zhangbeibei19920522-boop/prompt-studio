"use client"

import * as React from "react"
import { BookOpen, Menu, Plus, Search, Settings } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export interface WorkspaceSessionItem {
  id: string
  title: string
  updatedLabel: string
  active: boolean
}

export interface WorkspaceTabItem {
  id: string
  label: string
  active: boolean
}

interface WorkspaceFrameProps {
  projectName: string
  projectSwitcher?: React.ReactNode
  sessions: WorkspaceSessionItem[]
  onSessionSelect: (id: string) => void
  onCreateSession: () => void
  onOpenCommandPalette: () => void
  onOpenKnowledgeDrawer: () => void
  onOpenSettings?: () => void
  onToggleSidebar?: () => void
  sidebarCollapsed?: boolean
  children: React.ReactNode
  workspace?: string
  workspaceTitle?: string
  workspaceDescription?: string
  workspaceTabs?: WorkspaceTabItem[]
  onWorkspaceChange?: (id: string) => void
  statusLabel?: string
  sideContent?: React.ReactNode
}

export function WorkspaceFrame({
  projectName,
  projectSwitcher,
  sessions,
  onSessionSelect,
  onCreateSession,
  onOpenCommandPalette,
  onOpenKnowledgeDrawer,
  onOpenSettings,
  onToggleSidebar,
  sidebarCollapsed = false,
  children,
}: WorkspaceFrameProps) {
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-stone-50 text-zinc-950">
      <header className="flex h-[52px] items-center gap-3 border-b border-zinc-200 bg-white px-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onToggleSidebar}
            className="flex size-8 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
            aria-label="切换侧栏"
          >
            <Menu className="size-4.5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="grid size-7 place-items-center rounded-md bg-zinc-950 text-xs font-semibold text-white">
              PS
            </div>
            {projectSwitcher ?? (
              <div className="flex items-center gap-1 rounded-md px-2 py-1 text-sm font-medium text-zinc-700">
                <span>{projectName || "Prompt Studio"}</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-1 justify-center">
          <button
            type="button"
            onClick={onOpenCommandPalette}
            className="flex min-w-[280px] items-center gap-2 rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-500 transition-colors hover:bg-zinc-50 hover:text-zinc-700"
          >
            <Search className="size-4" />
            <span>搜索 Prompt、测试、文档...</span>
            <kbd className="ml-auto rounded border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 text-[11px] text-zinc-500">
              K
            </kbd>
          </button>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onOpenKnowledgeDrawer}
            className="flex size-8 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
            aria-label="知识库"
          >
            <BookOpen className="size-4.5" />
          </button>
          {onOpenSettings && (
            <button
              type="button"
              onClick={onOpenSettings}
              className="flex size-8 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
              aria-label="设置"
            >
              <Settings className="size-4.5" />
            </button>
          )}
        </div>
      </header>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <aside
          className={cn(
            "flex flex-col border-r border-zinc-200 bg-stone-100 transition-all duration-200",
            sidebarCollapsed ? "w-0 border-r-0 opacity-0" : "w-[260px] opacity-100"
          )}
        >
          <div className="flex items-center justify-between px-3 py-3">
            <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-zinc-500">对话</h2>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={onCreateSession}
              className="rounded-md text-zinc-500 hover:bg-zinc-200 hover:text-zinc-900"
              aria-label="新建对话"
            >
              <Plus className="size-4" />
            </Button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
            {sessions.length === 0 ? (
              <div className="px-2 py-3 text-sm text-zinc-500">暂无对话</div>
            ) : (
              sessions.map((session) => (
                <button
                  key={session.id}
                  type="button"
                  onClick={() => onSessionSelect(session.id)}
                  className={cn(
                    "group relative mb-1 flex w-full items-center gap-2 rounded-md px-3 py-2 text-left transition-colors",
                    session.active ? "bg-zinc-200" : "hover:bg-zinc-100"
                  )}
                >
                  <span className="min-w-0 flex-1 truncate text-sm">{session.title}</span>
                  <span className="text-[11px] text-zinc-400 group-hover:hidden">{session.updatedLabel}</span>
                  <span className="hidden text-sm text-zinc-400 group-hover:inline">×</span>
                </button>
              ))
            )}
          </div>
        </aside>

        <section className="min-h-0 flex-1 overflow-hidden bg-stone-50">{children}</section>
      </div>
    </div>
  )
}
