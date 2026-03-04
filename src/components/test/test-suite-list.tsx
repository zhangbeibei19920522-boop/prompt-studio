"use client"

import { FlaskConical, Plus, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"

interface TestSuiteListProps {
  suites: Array<{ id: string; name: string; status: string }>
  currentSuiteId: string | null
  onSuiteClick: (id: string) => void
  onNewSuite: () => void
  onDeleteSuite?: (id: string) => void
}

function getStatusLabel(status: string): string {
  switch (status) {
    case "draft": return "草稿"
    case "ready": return "就绪"
    case "running": return "运行中"
    case "completed": return "已完成"
    default: return status
  }
}

function getStatusVariant(status: string): "default" | "secondary" | "outline" {
  switch (status) {
    case "ready": return "default"
    case "completed": return "default"
    case "running": return "secondary"
    default: return "outline"
  }
}

function truncateText(text: string, maxLen: number = 10): string {
  return text.length > maxLen ? text.slice(0, maxLen) + "..." : text
}

export function TestSuiteList({
  suites,
  currentSuiteId,
  onSuiteClick,
  onNewSuite,
  onDeleteSuite,
}: TestSuiteListProps) {
  return (
    <div>
      <div className="flex w-full items-center gap-1.5 px-3 py-1.5">
        <div className="flex flex-1 items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <FlaskConical className="size-3.5 shrink-0" />
          <span className="flex-1 text-left">测试集</span>
          <span className="text-xs tabular-nums">({suites.length})</span>
        </div>
        <button
          onClick={onNewSuite}
          className="p-0.5 text-muted-foreground hover:text-foreground transition-colors"
          title="新建测试集"
        >
          <Plus className="size-3" />
        </button>
      </div>

      <div className="pb-1">
        {suites.length === 0 && (
          <p className="px-6 py-1 text-xs text-muted-foreground">暂无测试集</p>
        )}
        {suites.map((suite) => (
          <div
            key={suite.id}
            className={cn(
              "group flex w-full items-center gap-1 px-6 py-1 text-left hover:bg-accent transition-colors rounded-sm",
              currentSuiteId === suite.id && "bg-accent"
            )}
          >
            <button
              onClick={() => onSuiteClick(suite.id)}
              className="flex flex-1 items-center gap-2 min-w-0"
            >
              <span
                className="flex-1 truncate text-xs text-left"
                title={suite.name}
              >
                {truncateText(suite.name)}
              </span>
              <Badge
                variant={getStatusVariant(suite.status)}
                className="shrink-0 text-[10px] px-1 py-0"
              >
                {getStatusLabel(suite.status)}
              </Badge>
            </button>
            {onDeleteSuite && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onDeleteSuite(suite.id)
                }}
                className="hidden group-hover:block shrink-0 p-0.5 text-muted-foreground hover:text-destructive transition-colors"
                title="删除测试集"
              >
                <X className="size-3" />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
