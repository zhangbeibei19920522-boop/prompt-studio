"use client"

import { useState, useEffect } from "react"
import { ArrowLeft, Download, Loader2, FileText } from "lucide-react"
import { format } from "date-fns"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { TestReportView } from "./test-report"
import { TestRoutingResultDetails } from "./test-routing-result-details"
import { ConversationPanel } from "./conversation-panel"
import {
  parseConversationOutput,
  parseExpectedConversationOutput,
} from "./conversation-output"
import { testRunsApi } from "@/lib/utils/api-client"
import { exportTestRunHTML } from "@/lib/utils/pdf-export"
import type { TestRun, TestCase, TestCaseResult } from "@/types/database"

interface TestRunHistoryProps {
  testSuiteId: string
  testCases: TestCase[]
  suiteName: string
}

function getRunStatusLabel(status: string): string {
  switch (status) {
    case "running": return "运行中"
    case "completed": return "已完成"
    case "failed": return "失败"
    default: return status
  }
}

function getRunStatusVariant(status: string): "default" | "secondary" | "outline" {
  switch (status) {
    case "completed": return "default"
    case "running": return "secondary"
    default: return "outline"
  }
}

interface TestRunCaseResultCardProps {
  index: number
  testCase: TestCase
  result?: TestCaseResult
}

export function TestRunCaseResultCard({
  index,
  testCase,
  result,
}: TestRunCaseResultCardProps) {
  return (
    <Card>
      <CardContent className="pt-4 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">
            {result?.passed === true ? "✅" : result?.passed === false ? "❌" : "—"}{" "}
            #{index + 1} {testCase.title}
          </span>
          {result && (
            <span className="text-sm font-bold" style={{
              color: result.score >= 80 ? "#16a34a" : result.score >= 50 ? "#ca8a04" : "#dc2626"
            }}>{result.score}分</span>
          )}
        </div>
        {result?.actualOutput && (
          <div className="grid gap-3 md:grid-cols-2">
            <ConversationPanel
              title="预期输出"
              turns={parseExpectedConversationOutput(testCase.input, testCase.expectedOutput)}
              showIntentBadges
            />
            <ConversationPanel
              title="对话记录"
              turns={parseConversationOutput(result.actualOutput, testCase.input, result)}
              showIntentBadges
            />
          </div>
        )}
        {result && (
          <TestRoutingResultDetails testCase={testCase} result={result} />
        )}
      </CardContent>
    </Card>
  )
}

export function TestRunHistory({ testSuiteId, testCases, suiteName }: TestRunHistoryProps) {
  const [runs, setRuns] = useState<TestRun[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedRun, setSelectedRun] = useState<TestRun | null>(null)
  const [exporting, setExporting] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    testRunsApi.listBySuite(testSuiteId)
      .then(setRuns)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [testSuiteId])

  async function handleExportHtml(run: TestRun) {
    setExporting(run.id)
    try {
      await exportTestRunHTML({ suiteName, testRun: run, testCases })
    } catch (err) {
      console.error("HTML 导出失败:", err)
    } finally {
      setExporting(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">加载中...</span>
      </div>
    )
  }

  if (runs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <FileText className="size-8 mb-2" />
        <p className="text-sm">暂无历史测试记录</p>
      </div>
    )
  }

  // Detail view for a selected run
  if (selectedRun) {
    const report = selectedRun.report
    const passRate = report && report.totalCases > 0
      ? Math.round((report.passedCases / report.totalCases) * 100)
      : 0

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => setSelectedRun(null)}>
            <ArrowLeft className="size-4 mr-1" /> 返回列表
          </Button>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {selectedRun.completedAt
                ? format(new Date(selectedRun.completedAt), "yyyy-MM-dd HH:mm")
                : format(new Date(selectedRun.startedAt), "yyyy-MM-dd HH:mm")}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={exporting === selectedRun.id}
              onClick={() => handleExportHtml(selectedRun)}
            >
              {exporting === selectedRun.id
                ? <Loader2 className="size-4 animate-spin mr-1" />
                : <Download className="size-4 mr-1" />}
              导出 HTML
            </Button>
          </div>
        </div>

        {report && (
          <div className="grid grid-cols-3 gap-3">
            <Card><CardContent className="pt-4 text-center">
              <div className="text-2xl font-bold" style={{
                color: report.score >= 80 ? "#16a34a" : report.score >= 50 ? "#ca8a04" : "#dc2626"
              }}>{report.score}</div>
              <div className="text-xs text-muted-foreground mt-1">总分</div>
            </CardContent></Card>
            <Card><CardContent className="pt-4 text-center">
              <div className="text-2xl font-bold">{report.passedCases}/{report.totalCases}</div>
              <div className="text-xs text-muted-foreground mt-1">通过</div>
            </CardContent></Card>
            <Card><CardContent className="pt-4 text-center">
              <div className="text-2xl font-bold">{passRate}%</div>
              <div className="text-xs text-muted-foreground mt-1">通过率</div>
            </CardContent></Card>
          </div>
        )}

        {/* Case results */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium">用例结果</h3>
          {testCases.map((tc, i) => {
            const result = selectedRun.results.find(r => r.testCaseId === tc.id)
            return <TestRunCaseResultCard key={tc.id} index={i} testCase={tc} result={result} />
          })}
        </div>

        {selectedRun.report && (
          <TestReportView report={selectedRun.report} />
        )}
      </div>
    )
  }

  // List view
  return (
    <div className="space-y-2">
      {runs.map(run => {
        const report = run.report
        const time = run.completedAt
          ? format(new Date(run.completedAt), "yyyy-MM-dd HH:mm")
          : format(new Date(run.startedAt), "yyyy-MM-dd HH:mm")

        return (
          <button
            key={run.id}
            type="button"
            onClick={() => setSelectedRun(run)}
            className="history-run flex w-full items-center gap-3 rounded-lg border border-zinc-200 bg-white px-3 py-3 text-left transition-colors hover:border-zinc-300 hover:bg-zinc-50"
          >
            <div className="history-run-num w-10 text-sm font-semibold text-zinc-600">
              #{runs.length - runs.indexOf(run)}
            </div>
            <div className="history-run-info min-w-0 flex-1">
              <div className="history-run-score text-sm font-medium text-zinc-900">
                {report
                  ? `${report.score} 分 · ${report.passedCases}/${report.totalCases} 通过`
                  : getRunStatusLabel(run.status)}
              </div>
              <div className="history-run-time mt-1 text-xs text-zinc-500">
                {time}
              </div>
            </div>
            <span className="history-run-badge shrink-0">
              <Badge variant={getRunStatusVariant(run.status)} className="text-[11px]">
                {run === runs[0] ? "最新" : "查看"}
              </Badge>
            </span>
            {run.status === "completed" && (
              <Button
                variant="ghost"
                size="sm"
                disabled={exporting === run.id}
                onClick={(event) => {
                  event.stopPropagation()
                  void handleExportHtml(run)
                }}
              >
                {exporting === run.id
                  ? <Loader2 className="size-4 animate-spin" />
                  : <Download className="size-4" />}
                <span className="sr-only">导出 HTML</span>
              </Button>
            )}
          </button>
        )
      })}
    </div>
  )
}
