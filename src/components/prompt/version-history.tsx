"use client"

import { useState } from "react"
import { format } from "date-fns"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"

interface Version {
  id: string
  version: number
  content: string
  changeNote: string
  createdAt: string
}

interface VersionHistoryProps {
  versions: Version[]
  currentVersion: number
  onRestore: (versionId: string) => void
}

function formatTimestamp(dateStr: string): string {
  try {
    return format(new Date(dateStr), "yyyy-MM-dd HH:mm")
  } catch {
    return dateStr
  }
}

export function VersionHistory({
  versions,
  currentVersion,
  onRestore,
}: VersionHistoryProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const sorted = [...versions].sort((a, b) => b.version - a.version)

  function toggleExpand(id: string): void {
    setExpandedId((prev) => (prev === id ? null : id))
  }

  return (
    <div className="flex flex-col h-full overflow-auto p-6 gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">版本历史</h2>
        <Badge variant="outline" className="text-xs">
          共 {versions.length} 个版本
        </Badge>
      </div>

      <Separator />

      {/* Version list */}
      {sorted.length === 0 ? (
        <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
          暂无历史版本
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {sorted.map((v, index) => {
            const isCurrent = v.version === currentVersion
            const isExpanded = expandedId === v.id

            return (
              <div
                key={v.id}
                className="rounded-md border bg-background overflow-hidden"
              >
                {/* Version header row */}
                <button
                  className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-muted/50 transition-colors"
                  onClick={() => toggleExpand(v.id)}
                  aria-expanded={isExpanded}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-sm font-mono font-medium shrink-0">
                      v{v.version}
                    </span>
                    {isCurrent && (
                      <Badge variant="default" className="text-xs shrink-0">
                        当前版本
                      </Badge>
                    )}
                    {index === 0 && !isCurrent && (
                      <Badge variant="secondary" className="text-xs shrink-0">
                        最新
                      </Badge>
                    )}
                    <span className="text-sm text-muted-foreground truncate">
                      {v.changeNote || "无变更说明"}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 ml-2">
                    <span className="text-xs text-muted-foreground">
                      {formatTimestamp(v.createdAt)}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      {isExpanded ? "▲" : "▼"}
                    </span>
                  </div>
                </button>

                {/* Expanded content */}
                {isExpanded && (
                  <>
                    <Separator />
                    <div className="px-4 py-3 flex flex-col gap-3">
                      <div className="flex flex-col gap-1">
                        <span className="text-xs font-medium text-muted-foreground">
                          内容
                        </span>
                        <pre className="whitespace-pre-wrap font-mono text-xs bg-muted rounded p-3 max-h-60 overflow-auto leading-relaxed">
                          {v.content}
                        </pre>
                      </div>

                      {v.changeNote && (
                        <div className="flex flex-col gap-1">
                          <span className="text-xs font-medium text-muted-foreground">
                            变更说明
                          </span>
                          <p className="text-sm">{v.changeNote}</p>
                        </div>
                      )}

                      {!isCurrent && (
                        <div className="flex justify-end">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onRestore(v.id)}
                          >
                            恢复此版本
                          </Button>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
