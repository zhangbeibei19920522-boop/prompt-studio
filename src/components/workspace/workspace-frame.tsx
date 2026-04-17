"use client"

import * as React from "react"
import { Menu, MessageSquareText, Search } from "lucide-react"

import { cn } from "@/lib/utils"

export interface WorkspaceModuleItem {
  id: string
  label: string
  description?: string
  icon?: React.ReactNode
  active: boolean
}

interface WorkspaceFrameProps {
  projectName: string
  projectSwitcher?: React.ReactNode
  modules: WorkspaceModuleItem[]
  onModuleSelect: (id: string) => void
  onOpenCommandPalette: () => void
  onOpenChatDrawer: () => void
  onToggleSidebar?: () => void
  sidebarCollapsed?: boolean
  children: React.ReactNode
}

export function WorkspaceFrame({
  projectName,
  projectSwitcher,
  modules,
  onModuleSelect,
  onOpenCommandPalette,
  onOpenChatDrawer,
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
            onClick={onOpenChatDrawer}
            className="flex h-8 items-center gap-2 rounded-md border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 hover:text-zinc-950"
          >
            <MessageSquareText className="size-4" />
            <span>Agent 对话</span>
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <aside
          className={cn(
            "flex flex-col border-r border-zinc-200 bg-stone-100 transition-all duration-200",
            sidebarCollapsed ? "w-0 border-r-0 opacity-0" : "w-[260px] opacity-100"
          )}
        >
          <div className="px-3 py-3">
            <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-zinc-500">功能</h2>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
            {modules.length === 0 ? (
              <div className="px-2 py-3 text-sm text-zinc-500">暂无功能模块</div>
            ) : (
              modules.map((module) => (
                <button
                  key={module.id}
                  type="button"
                  onClick={() => onModuleSelect(module.id)}
                  className={cn(
                    "group relative mb-1 flex w-full items-start gap-3 rounded-md px-3 py-3 text-left transition-colors",
                    module.active ? "bg-zinc-200 text-zinc-950" : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950"
                  )}
                >
                  {module.icon && <span className="mt-0.5 shrink-0 text-zinc-500">{module.icon}</span>}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{module.label}</span>
                    {module.description && (
                      <span className="mt-1 block truncate text-xs text-zinc-500">{module.description}</span>
                    )}
                  </span>
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
