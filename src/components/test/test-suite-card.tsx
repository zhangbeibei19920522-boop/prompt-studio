"use client"

import { FlaskConical } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { TestSuiteGenerationData } from "@/types/ai"

interface TestSuiteCardProps {
  data: TestSuiteGenerationData
  onConfirm: (data: TestSuiteGenerationData) => void
}

export function TestSuiteCard({ data, onConfirm }: TestSuiteCardProps) {
  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-4 space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        <FlaskConical className="size-4 text-blue-500" />
        <span>测试集：{data.name}</span>
      </div>

      {data.description && (
        <p className="text-sm text-muted-foreground">{data.description}</p>
      )}

      <div className="space-y-1">
        {data.cases.map((tc, i) => (
          <p key={i} className="text-xs text-muted-foreground">
            {i + 1}. {tc.title}
          </p>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        共 {data.cases.length} 个测试用例
      </p>

      <Button size="sm" onClick={() => onConfirm(data)}>
        确认创建
      </Button>
    </div>
  )
}
