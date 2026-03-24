"use client"

import { useState } from "react"
import { format } from "date-fns"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

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
    <div className="flex h-full flex-col gap-4 overflow-auto p-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">版本历史</h2>
        <Badge variant="outline" className="text-xs">
          共 {versions.length} 个版本
        </Badge>
      </div>

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
                className="overflow-hidden rounded-md border border-zinc-200 bg-white"
              >
                {/* Version header row */}
                <button
                  className="prompt-version-item flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-zinc-50"
                  onClick={() => toggleExpand(v.id)}
                  aria-expanded={isExpanded}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`prompt-version-dot inline-block size-2 shrink-0 rounded-full ${isCurrent ? "bg-blue-500" : "bg-zinc-300"}`} />
                    <div className="prompt-version-info min-w-0 flex-1">
                      <div className="prompt-version-label truncate text-sm font-medium text-zinc-900">
                        {`v${v.version} — ${v.changeNote || "无变更说明"}`}
                      </div>
                      <div className="prompt-version-time mt-1 text-xs text-zinc-500">
                        {formatTimestamp(v.createdAt)}
                      </div>
                    </div>
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
                  </div>
                  <div className="ml-2 flex items-center gap-3 shrink-0">
                    <span className="text-muted-foreground text-xs">
                      {isExpanded ? "▲" : "▼"}
                    </span>
                  </div>
                </button>

                {/* Expanded content */}
                {isExpanded && (
                  <>
                    <div className="flex flex-col gap-3 border-t border-zinc-200 px-4 py-3">
                      <div className="flex flex-col gap-1">
                        <span className="text-xs font-medium text-muted-foreground">
                          内容
                        </span>
                        <pre className="max-h-60 overflow-auto whitespace-pre-wrap rounded bg-zinc-50 p-3 font-mono text-xs leading-relaxed">
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
