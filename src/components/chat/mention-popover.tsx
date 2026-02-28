"use client"

import { useState, useMemo } from "react"
import { FileText, Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import type { MessageReference } from "@/types/database"

interface MentionItem {
  type: "prompt" | "document"
  id: string
  title: string
  group: string
}

interface MentionPopoverProps {
  prompts: Array<{ id: string; title: string }>
  documents: Array<{ id: string; name: string }>
  otherProjectPrompts?: Array<{ id: string; title: string; projectName: string }>
  onSelect: (ref: MessageReference) => void
  onClose: () => void
}

export function MentionPopover({
  prompts,
  documents,
  otherProjectPrompts = [],
  onSelect,
  onClose,
}: MentionPopoverProps) {
  const [query, setQuery] = useState("")

  const items = useMemo<MentionItem[]>(() => {
    const all: MentionItem[] = [
      ...prompts.map((p) => ({
        type: "prompt" as const,
        id: p.id,
        title: p.title,
        group: "📋 Prompt",
      })),
      ...documents.map((d) => ({
        type: "document" as const,
        id: d.id,
        title: d.name,
        group: "📁 知识库",
      })),
      ...otherProjectPrompts.map((p) => ({
        type: "prompt" as const,
        id: p.id,
        title: `[${p.projectName}] ${p.title}`,
        group: "📂 其他项目（只读）",
      })),
    ]

    if (!query.trim()) return all
    const q = query.toLowerCase()
    return all.filter((item) => item.title.toLowerCase().includes(q))
  }, [prompts, documents, otherProjectPrompts, query])

  const groups = useMemo(() => {
    const map = new Map<string, MentionItem[]>()
    for (const item of items) {
      const list = map.get(item.group) ?? []
      list.push(item)
      map.set(item.group, list)
    }
    return Array.from(map.entries())
  }, [items])

  return (
    <div className="absolute bottom-full mb-1 left-0 w-72 rounded-lg border bg-popover shadow-lg z-50">
      <div className="p-2 border-b">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索..."
            className="h-7 pl-7 text-xs"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Escape") onClose()
            }}
          />
        </div>
      </div>
      <ScrollArea className="max-h-60">
        <div className="p-1">
          {groups.length === 0 && (
            <p className="text-xs text-muted-foreground p-2 text-center">
              无匹配结果
            </p>
          )}
          {groups.map(([group, groupItems]) => (
            <div key={group}>
              <p className="px-2 py-1 text-xs font-medium text-muted-foreground">
                {group}
              </p>
              {groupItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    onSelect({
                      type: item.type,
                      id: item.id,
                      title: item.title,
                    })
                  }}
                  className="flex items-center gap-2 w-full px-2 py-1.5 rounded-sm text-left text-xs hover:bg-accent transition-colors"
                >
                  <FileText className="size-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate">{item.title}</span>
                </button>
              ))}
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  )
}
