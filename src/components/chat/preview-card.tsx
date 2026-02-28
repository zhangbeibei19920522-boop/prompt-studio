"use client"

import { useState } from "react"
import { Sparkles, ChevronDown, ChevronUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import type { PreviewData } from "@/types/database"

interface PreviewCardProps {
  data: PreviewData
  onApply?: () => void
  onEdit?: () => void
  onReject?: (reason: string) => void
}

export function PreviewCard({ data, onApply, onEdit, onReject }: PreviewCardProps) {
  const [expanded, setExpanded] = useState(true)
  const [showReject, setShowReject] = useState(false)
  const [rejectReason, setRejectReason] = useState("")

  const lines = data.content.split("\n")
  const isLong = lines.length > 20
  const displayContent = expanded ? data.content : lines.slice(0, 20).join("\n") + "\n..."

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Sparkles className="size-4 text-yellow-500" />
        <span>新建 Prompt：{data.title}</span>
      </div>

      <div className="rounded-md bg-muted p-3">
        <pre className="text-sm whitespace-pre-wrap break-words font-mono leading-relaxed">
          {displayContent}
        </pre>
        {isLong && (
          <button
            onClick={() => setExpanded((prev) => !prev)}
            className="flex items-center gap-1 mt-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {expanded ? (
              <>
                <ChevronUp className="size-3" /> 收起
              </>
            ) : (
              <>
                <ChevronDown className="size-3" /> 展开全部 ({lines.length} 行)
              </>
            )}
          </button>
        )}
      </div>

      {data.tags.length > 0 && (
        <div className="flex gap-1 flex-wrap">
          {data.tags.map((tag) => (
            <span
              key={tag}
              className="text-xs bg-secondary px-1.5 py-0.5 rounded"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {showReject && (
        <div className="space-y-2">
          <Textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="请说明拒绝原因或修改建议..."
            className="text-sm"
            rows={2}
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="destructive"
              onClick={() => {
                onReject?.(rejectReason)
                setShowReject(false)
              }}
              disabled={!rejectReason.trim()}
            >
              提交
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowReject(false)}
            >
              取消
            </Button>
          </div>
        </div>
      )}

      {!showReject && (
        <div className="flex gap-2 pt-1">
          <Button size="sm" onClick={onApply}>
            应用保存
          </Button>
          <Button size="sm" variant="outline" onClick={onEdit}>
            在右侧编辑
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-muted-foreground"
            onClick={() => setShowReject(true)}
          >
            拒绝
          </Button>
        </div>
      )}
    </div>
  )
}
