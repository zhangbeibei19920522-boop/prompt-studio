"use client"

import type { TestSuiteRunProgress } from "@/types/database"

function getProgressWidth(completedCases: number, totalCases: number) {
  if (totalCases <= 0) return 0
  if (completedCases <= 0) return 0
  return Math.max(4, Math.min(100, (completedCases / totalCases) * 100))
}

export function TestSuiteRunStatus({
  progress,
}: {
  progress: Pick<TestSuiteRunProgress, "status" | "completedCases" | "evaluatedCases" | "totalCases">
}) {
  const totalCases = Math.max(progress.totalCases, 1)
  const isEvaluating = progress.status === "evaluating"
  const currentCases = Math.min(
    isEvaluating ? progress.evaluatedCases : progress.completedCases,
    totalCases
  )
  const isIndeterminate = currentCases === 0 && totalCases > 0
  const width = isIndeterminate ? 36 : getProgressWidth(currentCases, totalCases)

  return (
    <div className="w-[180px] text-right">
      <div className="flex items-center justify-end gap-2 text-[11px] text-zinc-600">
        <span className="font-medium text-zinc-900">{isEvaluating ? "评估中" : "运行中"}</span>
        <span className="tabular-nums">
          {currentCases}/{totalCases}
        </span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-200">
        <div
          className={`h-full rounded-full bg-blue-500 transition-all duration-300 ${
            isIndeterminate ? "animate-pulse" : ""
          }`}
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  )
}
