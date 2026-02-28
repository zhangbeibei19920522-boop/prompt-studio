"use client"

import { useState } from "react"
import { CheckSquare, Square, ClipboardList } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import type { PlanData } from "@/types/database"

interface PlanCardProps {
  data: PlanData
  onConfirm?: (selectedIndices: number[]) => void
  onModify?: (feedback: string) => void
}

export function PlanCard({ data, onConfirm, onModify }: PlanCardProps) {
  const [selected, setSelected] = useState<Set<number>>(
    new Set(data.keyPoints.map((kp) => kp.index))
  )
  const [showFeedback, setShowFeedback] = useState(false)
  const [feedback, setFeedback] = useState("")

  const isConfirmed = data.status === "confirmed"
  const isRejected = data.status === "rejected"
  const isInteractive = data.status === "pending"

  const toggleSelect = (index: number) => {
    if (!isInteractive) return
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(index)) {
        next.delete(index)
      } else {
        next.add(index)
      }
      return next
    })
  }

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        <ClipboardList className="size-4 text-blue-500" />
        <span>修改规划</span>
        {isConfirmed && (
          <span className="text-xs text-green-600 bg-green-50 px-1.5 py-0.5 rounded">已确认</span>
        )}
        {isRejected && (
          <span className="text-xs text-red-600 bg-red-50 px-1.5 py-0.5 rounded">已修改</span>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        根据您的需求，我拆分为以下关键点：
      </p>

      <div className="space-y-2">
        {data.keyPoints.map((point) => (
          <button
            key={point.index}
            onClick={() => toggleSelect(point.index)}
            disabled={!isInteractive}
            className="flex items-start gap-2 w-full text-left rounded-md p-2 hover:bg-muted/50 transition-colors disabled:opacity-70 disabled:cursor-default"
          >
            {selected.has(point.index) ? (
              <CheckSquare className="size-4 shrink-0 text-blue-500 mt-0.5" />
            ) : (
              <Square className="size-4 shrink-0 text-muted-foreground mt-0.5" />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm">
                {point.index}. {point.action === "create" ? "新建" : "修改"}「{point.targetPromptTitle}」
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                → {point.description}
              </p>
            </div>
          </button>
        ))}
      </div>

      {showFeedback && (
        <div className="space-y-2">
          <Textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="请描述需要修改的内容..."
            className="text-sm"
            rows={2}
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => {
                onModify?.(feedback)
                setShowFeedback(false)
              }}
              disabled={!feedback.trim()}
            >
              提交修改意见
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowFeedback(false)}
            >
              取消
            </Button>
          </div>
        </div>
      )}

      {isInteractive && !showFeedback && (
        <div className="flex gap-2 pt-1">
          <Button
            size="sm"
            onClick={() => onConfirm?.(Array.from(selected))}
            disabled={selected.size === 0}
          >
            确认执行
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowFeedback(true)}
          >
            修改规划
          </Button>
        </div>
      )}
    </div>
  )
}
