"use client"

import { GitBranchPlus } from "lucide-react"

import { Button } from "@/components/ui/button"
import type { TestFlowConfigRequestData } from "@/types/ai"
import type { TestSuiteRoutingConfig } from "@/types/database"

interface TestFlowConfigCardProps {
  data: TestFlowConfigRequestData
  routingConfig?: TestSuiteRoutingConfig | null
  onOpenConfig: () => void
}

export function TestFlowConfigCard({
  data,
  routingConfig = null,
  onOpenConfig,
}: TestFlowConfigCardProps) {
  const routeCount = routingConfig?.routes.length ?? 0

  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-4 text-foreground shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium text-emerald-900">
            <GitBranchPlus className="size-4" />
            <span>多 Prompt 业务流程</span>
          </div>
          <p className="text-sm leading-6 text-emerald-950">{data.summary}</p>
          <p className="text-xs text-emerald-800/80">
            {routeCount > 0
              ? `已配置 ${routeCount} 条 intent 路由，保存后会继续生成测试集。`
              : "先配置入口 Prompt 和 intent 路由，再继续生成测试集。"}
          </p>
        </div>

        <Button size="sm" className="shrink-0" onClick={onOpenConfig}>
          配置业务流程
        </Button>
      </div>
    </div>
  )
}
