"use client"

import * as React from "react"
import { X } from "lucide-react"

import { cn } from "@/lib/utils"

export const DEFAULT_WORKSPACE_CANVAS_WIDTH = 640

export interface WorkspaceCanvasTab {
  id: string
  label: string
  icon?: React.ReactNode
}

interface WorkspaceCanvasProps {
  open: boolean
  activeTab: string
  tabs: WorkspaceCanvasTab[]
  onTabChange: (tabId: string) => void
  onClose: () => void
  expanded?: boolean
  hideOverlay?: boolean
  children: React.ReactNode
}

export function WorkspaceCanvas({
  open,
  activeTab,
  tabs,
  onTabChange,
  onClose,
  expanded = false,
  hideOverlay = false,
  children,
}: WorkspaceCanvasProps) {
  return (
    <>
      <div
        className={cn(
          "fixed inset-0 z-40 bg-transparent transition-opacity",
          open && !hideOverlay ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        )}
        onClick={onClose}
      />

      <aside
        className={cn(
          "fixed right-0 bottom-0 top-[52px] z-50 flex flex-col border-l border-zinc-200 bg-white shadow-2xl transition-transform duration-200",
          expanded ? "w-[calc(100vw-260px)] shadow-none" : "shadow-2xl",
          open ? "translate-x-0" : "translate-x-full"
        )}
        style={expanded ? undefined : { width: DEFAULT_WORKSPACE_CANVAS_WIDTH }}
      >
        <div className="flex h-[46px] items-center border-b border-zinc-200 px-4">
          <div className="min-w-0 flex-1 overflow-x-auto">
            <div className="flex h-full min-w-max items-center">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => onTabChange(tab.id)}
                  className={cn(
                    "flex h-full shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-3 text-sm font-medium transition-colors",
                    activeTab === tab.id
                      ? "border-zinc-950 text-zinc-950"
                      : "border-transparent text-zinc-500 hover:text-zinc-800"
                  )}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="ml-2 flex size-8 shrink-0 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
            aria-label="关闭工作台"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">{children}</div>
      </aside>
    </>
  )
}
