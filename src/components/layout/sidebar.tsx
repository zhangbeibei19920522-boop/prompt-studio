"use client"

import * as React from "react"
import { formatDistanceToNow } from "date-fns"
import { zhCN } from "date-fns/locale"
import {
  Plus,
  Upload,
  MessageSquare,
  FileText,
  Settings,
  File,
  ChevronDown,
  ChevronRight,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"

interface SidebarProps {
  sessions: Array<{ id: string; title: string; updatedAt: string }>
  currentSessionId: string | null
  onSessionSelect: (id: string) => void
  onNewSession: () => void
  prompts: Array<{ id: string; title: string; status: string }>
  onPromptClick: (id: string) => void
  onCreatePrompt?: () => void
  onBatchUploadPrompt?: () => void
  documents: Array<{ id: string; name: string; type: string }>
  onDocumentClick: (id: string) => void
  onUploadDocument?: () => void
  onSettingsClick: () => void
}

function getStatusVariant(status: string): "default" | "secondary" | "outline" {
  switch (status) {
    case "active":
    case "published":
      return "default"
    case "draft":
      return "secondary"
    default:
      return "outline"
  }
}

function getStatusLabel(status: string): string {
  switch (status) {
    case "active":
      return "启用"
    case "published":
      return "已发布"
    case "draft":
      return "草稿"
    case "archived":
      return "归档"
    default:
      return status
  }
}

function getDocumentTypeIcon(type: string): React.ReactNode {
  switch (type) {
    case "pdf":
      return <FileText className="size-3.5 shrink-0 text-red-500" />
    case "docx":
    case "doc":
      return <FileText className="size-3.5 shrink-0 text-blue-500" />
    case "txt":
    case "md":
      return <FileText className="size-3.5 shrink-0 text-muted-foreground" />
    default:
      return <File className="size-3.5 shrink-0 text-muted-foreground" />
  }
}

function CollapsibleGroup({
  label,
  count,
  children,
  actions,
}: {
  label: React.ReactNode
  count: number
  children: React.ReactNode
  actions?: Array<{ icon: React.ReactNode; title: string; onClick: () => void }>
}) {
  const [open, setOpen] = React.useState(true)

  return (
    <div>
      <div className="flex w-full items-center gap-1.5 px-3 py-1.5">
        <button
          onClick={() => setOpen((prev) => !prev)}
          className="flex flex-1 items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          {open ? (
            <ChevronDown className="size-3.5 shrink-0" />
          ) : (
            <ChevronRight className="size-3.5 shrink-0" />
          )}
          <span className="flex-1 text-left">{label}</span>
          <span className="text-xs tabular-nums">({count})</span>
        </button>
        {actions?.map((action, i) => (
          <button
            key={i}
            onClick={(e) => { e.stopPropagation(); action.onClick() }}
            className="p-0.5 text-muted-foreground hover:text-foreground transition-colors"
            title={action.title}
          >
            {action.icon}
          </button>
        ))}
      </div>
      {open && <div className="pb-1">{children}</div>}
    </div>
  )
}

export function Sidebar({
  sessions,
  currentSessionId,
  onSessionSelect,
  onNewSession,
  prompts,
  onPromptClick,
  onCreatePrompt,
  onBatchUploadPrompt,
  documents,
  onDocumentClick,
  onUploadDocument,
  onSettingsClick,
}: SidebarProps) {
  return (
    <aside className="flex h-full w-60 shrink-0 flex-col border-r bg-white">
      {/* Session Section */}
      <div className="flex flex-col">
        <div className="flex items-center justify-between px-3 py-2">
          <div className="flex items-center gap-1.5 text-sm font-medium">
            <MessageSquare className="size-4" />
            <span>对话</span>
          </div>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={onNewSession}
            title="新建对话"
          >
            <Plus className="size-3.5" />
          </Button>
        </div>

        <ScrollArea className="h-48">
          <div className="flex flex-col gap-px px-2 pb-2">
            {sessions.length === 0 && (
              <p className="px-2 py-3 text-xs text-muted-foreground">暂无对话</p>
            )}
            {sessions.map((session) => (
              <button
                key={session.id}
                onClick={() => onSessionSelect(session.id)}
                className={cn(
                  "flex w-full flex-col items-start rounded-md px-2 py-1.5 text-left transition-colors hover:bg-accent",
                  currentSessionId === session.id && "bg-accent"
                )}
              >
                <span className="w-full truncate text-sm">{session.title}</span>
                <span className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(session.updatedAt), {
                    addSuffix: true,
                    locale: zhCN,
                  })}
                </span>
              </button>
            ))}
          </div>
        </ScrollArea>
      </div>

      <Separator />

      {/* Project Resources Section */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <p className="px-3 py-2 text-xs font-medium text-muted-foreground">
          项目资源
        </p>

        <ScrollArea className="flex-1">
          <div className="flex flex-col gap-1 pb-2">
            {/* Prompts Group */}
            <CollapsibleGroup
              label={
                <span className="flex items-center gap-1">
                  <span>📋</span>
                  <span>Prompt</span>
                </span>
              }
              count={prompts.length}
              actions={[
                ...(onCreatePrompt ? [{ icon: <Plus className="size-3" />, title: "新建 Prompt", onClick: onCreatePrompt }] : []),
                ...(onBatchUploadPrompt ? [{ icon: <Upload className="size-3" />, title: "批量导入 Prompt", onClick: onBatchUploadPrompt }] : []),
              ]}
            >
              {prompts.length === 0 && (
                <p className="px-6 py-1 text-xs text-muted-foreground">暂无 Prompt</p>
              )}
              {prompts.map((prompt) => (
                <button
                  key={prompt.id}
                  onClick={() => onPromptClick(prompt.id)}
                  className="flex w-full items-center gap-2 px-6 py-1 text-left hover:bg-accent transition-colors rounded-sm"
                >
                  <span className="flex-1 truncate text-xs">{prompt.title}</span>
                  <Badge
                    variant={getStatusVariant(prompt.status)}
                    className="shrink-0 text-[10px] px-1 py-0"
                  >
                    {getStatusLabel(prompt.status)}
                  </Badge>
                </button>
              ))}
            </CollapsibleGroup>

            {/* Documents Group */}
            <CollapsibleGroup
              label={
                <span className="flex items-center gap-1">
                  <span>📁</span>
                  <span>知识库</span>
                </span>
              }
              count={documents.length}
              actions={onUploadDocument ? [{ icon: <Plus className="size-3" />, title: "上传文档", onClick: onUploadDocument }] : []}
            >
              {documents.length === 0 && (
                <p className="px-6 py-1 text-xs text-muted-foreground">暂无文档</p>
              )}
              {documents.map((doc) => (
                <button
                  key={doc.id}
                  onClick={() => onDocumentClick(doc.id)}
                  className="flex w-full items-center gap-2 px-6 py-1 text-left hover:bg-accent transition-colors rounded-sm"
                >
                  {getDocumentTypeIcon(doc.type)}
                  <span className="flex-1 truncate text-xs">{doc.name}</span>
                </button>
              ))}
            </CollapsibleGroup>

            {/* Settings Link */}
            <button
              onClick={onSettingsClick}
              className="flex w-full items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors rounded-sm"
            >
              <Settings className="size-3.5 shrink-0" />
              <span>⚙ 项目设置</span>
            </button>
          </div>
        </ScrollArea>
      </div>
    </aside>
  )
}
