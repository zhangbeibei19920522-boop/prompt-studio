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
  X,
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
  onDeletePrompt?: (id: string) => void
  onDeleteDocument?: (id: string) => void
  memoryBadgeCount?: number
  onMemoryBadgeClick?: () => void
  testSuites?: Array<{ id: string; name: string; status: string }>
  currentTestSuiteId?: string | null
  onTestSuiteClick?: (id: string) => void
  onNewTestSuite?: () => void
  onDeleteTestSuite?: (id: string) => void
  conversationAuditJobs?: Array<{ id: string; name: string; status: string }>
  currentConversationAuditJobId?: string | null
  onConversationAuditJobClick?: (id: string) => void
  onNewConversationAuditJob?: () => void
  onDeleteSession?: (id: string) => void
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

function truncateText(text: string, maxLen: number = 10): string {
  return text.length > maxLen ? text.slice(0, maxLen) + '...' : text
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
  onDeletePrompt,
  onDeleteDocument,
  memoryBadgeCount,
  onMemoryBadgeClick,
  testSuites,
  currentTestSuiteId,
  onTestSuiteClick,
  onNewTestSuite,
  onDeleteTestSuite,
  conversationAuditJobs,
  currentConversationAuditJobId,
  onConversationAuditJobClick,
  onNewConversationAuditJob,
  onDeleteSession,
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
              <div
                key={session.id}
                className={cn(
                  "group flex w-full items-center rounded-md px-2 py-1.5 text-left transition-colors hover:bg-accent",
                  currentSessionId === session.id && "bg-accent"
                )}
              >
                <button
                  onClick={() => onSessionSelect(session.id)}
                  className="flex flex-1 flex-col min-w-0 text-left"
                >
                  <span className="w-full truncate text-sm">{session.title}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(session.updatedAt), {
                      addSuffix: true,
                      locale: zhCN,
                    })}
                  </span>
                </button>
                {onDeleteSession && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onDeleteSession(session.id) }}
                    className="hidden group-hover:block shrink-0 p-0.5 text-muted-foreground hover:text-destructive transition-colors"
                    title="删除对话"
                  >
                    <X className="size-3" />
                  </button>
                )}
              </div>
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
                <div
                  key={prompt.id}
                  className="group flex w-full items-center gap-1 px-6 py-1 text-left hover:bg-accent transition-colors rounded-sm"
                >
                  <button
                    onClick={() => onPromptClick(prompt.id)}
                    className="flex flex-1 items-center gap-2 min-w-0"
                  >
                    <span className="flex-1 truncate text-xs text-left" title={prompt.title}>{truncateText(prompt.title)}</span>
                    <Badge
                      variant={getStatusVariant(prompt.status)}
                      className="shrink-0 text-[10px] px-1 py-0"
                    >
                      {getStatusLabel(prompt.status)}
                    </Badge>
                  </button>
                  {onDeletePrompt && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onDeletePrompt(prompt.id) }}
                      className="hidden group-hover:block shrink-0 p-0.5 text-muted-foreground hover:text-destructive transition-colors"
                      title="删除 Prompt"
                    >
                      <X className="size-3" />
                    </button>
                  )}
                </div>
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
                <div
                  key={doc.id}
                  className="group flex w-full items-center gap-1 px-6 py-1 text-left hover:bg-accent transition-colors rounded-sm"
                >
                  <button
                    onClick={() => onDocumentClick(doc.id)}
                    className="flex flex-1 items-center gap-2 min-w-0"
                  >
                    {getDocumentTypeIcon(doc.type)}
                    <span className="flex-1 truncate text-xs text-left" title={doc.name}>{truncateText(doc.name)}</span>
                  </button>
                  {onDeleteDocument && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onDeleteDocument(doc.id) }}
                      className="hidden group-hover:block shrink-0 p-0.5 text-muted-foreground hover:text-destructive transition-colors"
                      title="删除文档"
                    >
                      <X className="size-3" />
                    </button>
                  )}
                </div>
              ))}
            </CollapsibleGroup>

            {/* Test Suites Group */}
            {testSuites && (
              <CollapsibleGroup
                label={
                  <span className="flex items-center gap-1">
                    <span>🧪</span>
                    <span>测试</span>
                  </span>
                }
                count={testSuites.length}
                actions={onNewTestSuite ? [{ icon: <Plus className="size-3" />, title: "新建测试集", onClick: onNewTestSuite }] : []}
              >
                {testSuites.length === 0 && (
                  <p className="px-6 py-1 text-xs text-muted-foreground">暂无测试集</p>
                )}
                {testSuites.map((suite) => (
                  <div
                    key={suite.id}
                    className={cn(
                      "group flex w-full items-center gap-1 px-6 py-1 text-left hover:bg-accent transition-colors rounded-sm",
                      currentTestSuiteId === suite.id && "bg-accent"
                    )}
                  >
                    <button
                      onClick={() => onTestSuiteClick?.(suite.id)}
                      className="flex flex-1 items-center gap-2 min-w-0"
                    >
                      <span className="flex-1 truncate text-xs text-left" title={suite.name}>
                        {truncateText(suite.name)}
                      </span>
                      <Badge
                        variant={suite.status === 'completed' || suite.status === 'ready' ? 'default' : 'secondary'}
                        className="shrink-0 text-[10px] px-1 py-0"
                      >
                        {suite.status === 'draft' ? '草稿' : suite.status === 'ready' ? '就绪' : suite.status === 'running' ? '运行中' : '已完成'}
                      </Badge>
                    </button>
                    {onDeleteTestSuite && (
                      <button
                        onClick={(e) => { e.stopPropagation(); onDeleteTestSuite(suite.id) }}
                        className="hidden group-hover:block shrink-0 p-0.5 text-muted-foreground hover:text-destructive transition-colors"
                        title="删除测试集"
                      >
                        <X className="size-3" />
                      </button>
                    )}
                  </div>
                ))}
              </CollapsibleGroup>
            )}

            {conversationAuditJobs && (
              <CollapsibleGroup
                label={
                  <span className="flex items-center gap-1">
                    <span>🔎</span>
                    <span>会话质检</span>
                  </span>
                }
                count={conversationAuditJobs.length}
                actions={onNewConversationAuditJob ? [{ icon: <Plus className="size-3" />, title: "新建会话质检", onClick: onNewConversationAuditJob }] : []}
              >
                {conversationAuditJobs.length === 0 && (
                  <p className="px-6 py-1 text-xs text-muted-foreground">暂无质检任务</p>
                )}
                {conversationAuditJobs.map((job) => (
                  <div
                    key={job.id}
                    className={cn(
                      "group flex w-full items-center gap-1 px-6 py-1 text-left hover:bg-accent transition-colors rounded-sm",
                      currentConversationAuditJobId === job.id && "bg-accent"
                    )}
                  >
                    <button
                      onClick={() => onConversationAuditJobClick?.(job.id)}
                      className="flex flex-1 items-center gap-2 min-w-0"
                    >
                      <span className="flex-1 truncate text-xs text-left" title={job.name}>
                        {truncateText(job.name)}
                      </span>
                      <Badge
                        variant={job.status === 'completed' ? 'default' : job.status === 'failed' ? 'destructive' : job.status === 'running' || job.status === 'parsing' ? 'secondary' : 'outline'}
                        className="shrink-0 text-[10px] px-1 py-0"
                      >
                        {job.status === 'parsing' ? '解析中' : job.status === 'draft' ? '草稿' : job.status === 'running' ? '运行中' : job.status === 'completed' ? '已完成' : '失败'}
                      </Badge>
                    </button>
                  </div>
                ))}
              </CollapsibleGroup>
            )}

            {/* Settings Link */}
            <button
              onClick={onSettingsClick}
              className="flex w-full items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors rounded-sm"
            >
              <Settings className="size-3.5 shrink-0" />
              <span>⚙ 项目设置</span>
              {memoryBadgeCount && memoryBadgeCount > 0 ? (
                <Badge
                  variant="default"
                  className="ml-auto text-[10px] px-1 py-0 cursor-pointer"
                  onClick={(e) => { e.stopPropagation(); onMemoryBadgeClick?.() }}
                >
                  +{memoryBadgeCount} 记忆
                </Badge>
              ) : null}
            </button>
          </div>
        </ScrollArea>
      </div>
    </aside>
  )
}
