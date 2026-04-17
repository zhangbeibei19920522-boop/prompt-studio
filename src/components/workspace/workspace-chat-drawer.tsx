"use client"

import * as React from "react"
import { MessageSquarePlus, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export interface WorkspaceChatSessionItem {
  id: string
  title: string
  updatedLabel: string
  active: boolean
}

interface WorkspaceChatDrawerProps {
  open: boolean
  sessions: WorkspaceChatSessionItem[]
  onClose: () => void
  onSessionSelect: (id: string) => void
  onCreateSession: () => void
  children: React.ReactNode
}

export function WorkspaceChatDrawer({
  open,
  sessions,
  onClose,
  onSessionSelect,
  onCreateSession,
  children,
}: WorkspaceChatDrawerProps) {
  return (
    <>
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/10 transition-opacity",
          open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        )}
        onClick={onClose}
      />

      <aside
        className={cn(
          "fixed right-0 bottom-0 top-[52px] z-50 flex w-[min(860px,100vw)] flex-col border-l border-zinc-200 bg-white shadow-2xl transition-transform duration-200",
          open ? "translate-x-0" : "translate-x-full"
        )}
      >
        <div className="flex h-[46px] items-center border-b border-zinc-200 px-4">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-zinc-950">Agent 对话</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="ml-2 flex size-8 shrink-0 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
            aria-label="关闭 Agent 对话"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-[220px_minmax(0,1fr)] max-sm:grid-cols-1">
          <div className="flex min-h-0 flex-col border-r border-zinc-200 bg-stone-100 max-sm:hidden">
            <div className="flex items-center justify-between px-3 py-3">
              <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-zinc-500">对话</h2>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={onCreateSession}
                className="rounded-md text-zinc-500 hover:bg-zinc-200 hover:text-zinc-900"
                aria-label="新建对话"
              >
                <MessageSquarePlus className="size-4" />
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
                    <span className="text-[11px] text-zinc-400">{session.updatedLabel}</span>
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="min-h-0 overflow-hidden">{children}</div>
        </div>
      </aside>
    </>
  )
}
