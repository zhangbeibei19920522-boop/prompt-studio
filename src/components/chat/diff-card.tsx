"use client"

import { useState } from "react"
import { Pencil } from "lucide-react"
import { diffLines } from "diff"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import type { DiffData } from "@/types/database"

interface DiffCardProps {
  data: DiffData
  onApply?: () => void
  onEdit?: () => void
  onReject?: (reason: string) => void
}

export function DiffCard({ data, onApply, onEdit, onReject }: DiffCardProps) {
  const [showReject, setShowReject] = useState(false)
  const [rejectReason, setRejectReason] = useState("")

  const changes = diffLines(data.oldContent, data.newContent)

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Pencil className="size-4 text-orange-500" />
        <span>修改 Prompt：{data.title}</span>
      </div>

      <div className="rounded-md bg-muted overflow-hidden">
        <div className="p-3 space-y-0 font-mono text-xs leading-relaxed">
          {changes.map((change, i) => {
            const lines = change.value.replace(/\n$/, "").split("\n")
            return lines.map((line, j) => (
              <div
                key={`${i}-${j}`}
                className={
                  change.added
                    ? "bg-green-100 text-green-800 px-2 py-0.5 -mx-3"
                    : change.removed
                      ? "bg-red-100 text-red-800 px-2 py-0.5 -mx-3 line-through"
                      : "text-muted-foreground px-2 py-0.5"
                }
              >
                <span className="select-none mr-2 inline-block w-4 text-right">
                  {change.added ? "+" : change.removed ? "-" : " "}
                </span>
                {line || " "}
              </div>
            ))
          })}
        </div>
      </div>

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
            应用修改
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
