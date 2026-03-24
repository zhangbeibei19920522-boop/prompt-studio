"use client"

import * as React from "react"
import {
  CirclePlus,
  FileText,
  FolderOpen,
  FlaskConical,
  MessageSquare,
  Search,
  ShieldCheck,
} from "lucide-react"

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command"

export interface WorkspaceCommandItem {
  id: string
  title: string
  description: string
  shortcut?: string
}

interface WorkspaceCommandPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  actions: WorkspaceCommandItem[]
  prompts: WorkspaceCommandItem[]
  testSuites: WorkspaceCommandItem[]
  audits: WorkspaceCommandItem[]
  documents: WorkspaceCommandItem[]
  onActionSelect: (id: string) => void
  onPromptSelect: (id: string) => void
  onTestSuiteSelect: (id: string) => void
  onAuditSelect: (id: string) => void
  onDocumentSelect: (id: string) => void
}

function ItemMeta({
  title,
  description,
}: Pick<WorkspaceCommandItem, "title" | "description">) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="truncate text-sm font-medium">{title}</span>
      <span className="truncate text-xs text-muted-foreground">{description}</span>
    </div>
  )
}

export function WorkspaceCommandPalette({
  open,
  onOpenChange,
  actions,
  prompts,
  testSuites,
  audits,
  documents,
  onActionSelect,
  onPromptSelect,
  onTestSuiteSelect,
  onAuditSelect,
  onDocumentSelect,
}: WorkspaceCommandPaletteProps) {
  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="工作区命令面板"
      description="搜索资产或直接执行动作"
      className="max-w-3xl rounded-[28px] border-[rgba(94,60,28,0.12)] bg-[rgba(255,250,244,0.96)] p-0 shadow-[0_28px_90px_rgba(72,46,18,0.24)]"
    >
      <CommandInput placeholder="搜索 Prompt、测试集、质检任务、知识文档，或输入动作名称..." />
      <CommandList className="max-h-[560px]">
        <CommandEmpty className="py-10 text-sm text-[rgba(54,39,25,0.72)]">
          没找到匹配项，试试“新建测试集”或某个 Prompt 标题。
        </CommandEmpty>

        <CommandGroup heading="Actions">
          {actions.map((action) => (
            <CommandItem
              key={action.id}
              value={`${action.title} ${action.description}`}
              onSelect={() => onActionSelect(action.id)}
              className="rounded-2xl px-3 py-3"
            >
              <CirclePlus className="size-4 text-[rgb(188,92,41)]" />
              <ItemMeta title={action.title} description={action.description} />
              {action.shortcut && <CommandShortcut>{action.shortcut}</CommandShortcut>}
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Prompt">
          {prompts.map((item) => (
            <CommandItem
              key={item.id}
              value={`${item.title} ${item.description}`}
              onSelect={() => onPromptSelect(item.id)}
              className="rounded-2xl px-3 py-3"
            >
              <FileText className="size-4 text-[rgb(14,116,144)]" />
              <ItemMeta title={item.title} description={item.description} />
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Tests">
          {testSuites.map((item) => (
            <CommandItem
              key={item.id}
              value={`${item.title} ${item.description}`}
              onSelect={() => onTestSuiteSelect(item.id)}
              className="rounded-2xl px-3 py-3"
            >
              <FlaskConical className="size-4 text-[rgb(188,92,41)]" />
              <ItemMeta title={item.title} description={item.description} />
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Audit">
          {audits.map((item) => (
            <CommandItem
              key={item.id}
              value={`${item.title} ${item.description}`}
              onSelect={() => onAuditSelect(item.id)}
              className="rounded-2xl px-3 py-3"
            >
              <ShieldCheck className="size-4 text-[rgb(39,111,74)]" />
              <ItemMeta title={item.title} description={item.description} />
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Knowledge">
          {documents.map((item) => (
            <CommandItem
              key={item.id}
              value={`${item.title} ${item.description}`}
              onSelect={() => onDocumentSelect(item.id)}
              className="rounded-2xl px-3 py-3"
            >
              <FolderOpen className="size-4 text-[rgba(54,39,25,0.7)]" />
              <ItemMeta title={item.title} description={item.description} />
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Conversation">
          <CommandItem className="rounded-2xl px-3 py-3" value="回到对话主线程">
            <MessageSquare className="size-4 text-[rgba(54,39,25,0.7)]" />
            <ItemMeta title="回到对话主线程" description="保持当前上下文，继续由 Agent 路由下一步" />
          </CommandItem>
          <CommandItem className="rounded-2xl px-3 py-3" value="搜索当前对话">
            <Search className="size-4 text-[rgba(54,39,25,0.7)]" />
            <ItemMeta title="搜索当前对话" description="快速定位当前线程里的消息与决策" />
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
