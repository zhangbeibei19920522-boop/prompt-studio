"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"

interface Variable {
  name: string
  description: string
  defaultValue?: string
}

interface Prompt {
  id: string
  title: string
  content: string
  description: string
  tags: string[]
  variables: Variable[]
  version: number
  status: string
  updatedAt: string
}

interface PromptPreviewProps {
  prompt: Prompt
  onEdit: () => void
  onViewHistory: () => void
}

function highlightVariables(content: string): React.ReactNode[] {
  const pattern = /(\{\{[^}]+\}\})/g
  const parts = content.split(pattern)

  return parts.map((part, index) => {
    if (/^\{\{[^}]+\}\}$/.test(part)) {
      return (
        <span
          key={index}
          className="text-blue-600 bg-blue-50 px-0.5 rounded"
        >
          {part}
        </span>
      )
    }
    return <span key={index}>{part}</span>
  })
}

function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    draft: "草稿",
    active: "已发布",
    archived: "已归档",
  }
  return labels[status] ?? status
}

function getStatusVariant(
  status: string
): "default" | "secondary" | "destructive" | "outline" {
  const variants: Record<
    string,
    "default" | "secondary" | "destructive" | "outline"
  > = {
    draft: "secondary",
    active: "default",
    archived: "outline",
  }
  return variants[status] ?? "secondary"
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function PromptPreview({
  prompt,
  onEdit,
  onViewHistory,
}: PromptPreviewProps) {
  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(prompt.content)
    } catch {
      // Silently handle clipboard errors in environments without permission
    }
  }

  return (
    <div className="flex flex-col h-full overflow-auto p-6 gap-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-2 min-w-0">
          <h2 className="text-xl font-semibold truncate">{prompt.title}</h2>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant={getStatusVariant(prompt.status)}>
              {getStatusLabel(prompt.status)}
            </Badge>
            {prompt.tags.map((tag) => (
              <Badge key={tag} variant="outline" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="default" size="sm" onClick={onEdit}>
            编辑
          </Button>
          <Button variant="outline" size="sm" onClick={handleCopy}>
            复制内容
          </Button>
          <Button variant="outline" size="sm" onClick={onViewHistory}>
            查看历史
          </Button>
        </div>
      </div>

      <Separator />

      {/* Content */}
      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-medium text-muted-foreground">内容</h3>
        <pre className="whitespace-pre-wrap font-mono text-sm bg-muted rounded-md p-4 leading-relaxed overflow-x-auto">
          {highlightVariables(prompt.content)}
        </pre>
      </div>

      {/* Description */}
      {prompt.description && (
        <>
          <Separator />
          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-medium text-muted-foreground">描述</h3>
            <p className="text-sm text-foreground leading-relaxed">
              {prompt.description}
            </p>
          </div>
        </>
      )}

      {/* Variables */}
      {prompt.variables.length > 0 && (
        <>
          <Separator />
          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-medium text-muted-foreground">
              变量列表
            </h3>
            <div className="flex flex-col gap-2">
              {prompt.variables.map((variable) => (
                <div
                  key={variable.name}
                  className="flex flex-col gap-1 rounded-md border p-3 bg-background"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-mono text-blue-600 bg-blue-50 px-1 rounded">
                      {`{{${variable.name}}}`}
                    </span>
                    {variable.defaultValue !== undefined &&
                      variable.defaultValue !== "" && (
                        <span className="text-xs text-muted-foreground">
                          默认值:{" "}
                          <span className="font-mono">
                            {variable.defaultValue}
                          </span>
                        </span>
                      )}
                  </div>
                  {variable.description && (
                    <p className="text-xs text-muted-foreground">
                      {variable.description}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      <Separator />

      {/* Meta info */}
      <div className="flex items-center gap-6 text-xs text-muted-foreground">
        <span>
          版本：<span className="font-medium text-foreground">v{prompt.version}</span>
        </span>
        <span>
          更新时间：
          <span className="font-medium text-foreground">
            {formatDate(prompt.updatedAt)}
          </span>
        </span>
      </div>
    </div>
  )
}
