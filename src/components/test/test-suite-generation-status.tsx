"use client"

import type { TestSuiteGenerationJob } from "@/types/database"

function getProgressWidth(generatedCount: number, totalCount: number) {
  if (totalCount <= 0) return 0
  if (generatedCount <= 0) return 0
  return Math.max(4, Math.min(100, (generatedCount / totalCount) * 100))
}

export function TestSuiteGenerationStatus({
  job,
}: {
  job: Pick<
    TestSuiteGenerationJob,
    "status" | "generatedCount" | "totalCount" | "errorMessage"
  >
}) {
  if (job.status === "failed") {
    return (
      <div className="w-[180px] text-right">
        <div className="text-xs font-medium text-rose-600">生成失败</div>
        {job.errorMessage ? (
          <div className="mt-1 truncate text-[11px] text-rose-500" title={job.errorMessage}>
            {job.errorMessage}
          </div>
        ) : null}
      </div>
    )
  }

  const totalCount = Math.max(job.totalCount, 1)
  const generatedCount = Math.min(job.generatedCount, totalCount)
  const label = job.status === "queued" ? "排队中" : "生成中"
  const isIndeterminate = generatedCount === 0 && totalCount > 0
  const width = isIndeterminate ? 36 : getProgressWidth(generatedCount, totalCount)

  return (
    <div className="w-[180px] text-right">
      <div className="flex items-center justify-end gap-2 text-[11px] text-zinc-600">
        <span className="font-medium text-zinc-900">{label}</span>
        <span className="tabular-nums">
          {generatedCount}/{totalCount}
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
