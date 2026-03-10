"use client"

import { useState, useEffect } from "react"
import { ArrowLeft, Download, Loader2, FileText } from "lucide-react"
import { format } from "date-fns"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { TestReportView } from "./test-report"
import { testRunsApi } from "@/lib/utils/api-client"
import { exportTestRunPDF } from "@/lib/utils/pdf-export"
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

function parseConversationOutput(
  actualOutput: string,
  input: string
): Array<{ role: "user" | "assistant"; content: string }> {
  const turns: Array<{ role: "user" | "assistant"; content: string }> = []
  const lines = actualOutput.split("\n")
  let currentRole: "user" | "assistant" | null = null
  let currentContent = ""

  for (const line of lines) {
    const userMatch = line.match(/^User:\s*(.*)/)
    const assistantMatch = line.match(/^Assistant:\s*(.*)/)
    if (userMatch) {
      if (currentRole) turns.push({ role: currentRole, content: currentContent.trim() })
      currentRole = "user"
      currentContent = userMatch[1]
    } else if (assistantMatch) {
      if (currentRole) turns.push({ role: currentRole, content: currentContent.trim() })
      currentRole = "assistant"
      currentContent = assistantMatch[1]
    } else if (currentRole) {
      currentContent += "\n" + line
    }
  }
  if (currentRole) turns.push({ role: currentRole, content: currentContent.trim() })

  const nonEmpty = turns.filter(t => t.content)
  if (nonEmpty.length >= 2) return nonEmpty
  return [
    { role: "user", content: input },
    { role: "assistant", content: actualOutput },
  ]
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

  async function handleExport(run: TestRun) {
    setExporting(run.id)
    try {
      await exportTestRunPDF({ suiteName, testRun: run, testCases })
    } catch (err) {
      console.error("PDF 导出失败:", err)
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
              onClick={() => handleExport(selectedRun)}
            >
              {exporting === selectedRun.id
                ? <Loader2 className="size-4 animate-spin mr-1" />
                : <Download className="size-4 mr-1" />}
              导出 PDF
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
            return (
              <Card key={tc.id}>
                <CardContent className="pt-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">
                      {result?.passed === true ? "✅" : result?.passed === false ? "❌" : "—"}{" "}
                      #{i + 1} {tc.title}
                    </span>
                    {result && (
                      <span className="text-sm font-bold" style={{
                        color: result.score >= 80 ? "#16a34a" : result.score >= 50 ? "#ca8a04" : "#dc2626"
                      }}>{result.score}分</span>
                    )}
                  </div>
                  {result?.actualOutput && (
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">实际输出</div>
                      <pre className="text-xs bg-muted p-2 rounded whitespace-pre-wrap break-all max-h-40 overflow-auto">
                        {result.actualOutput}
                      </pre>
                    </div>
                  )}
                  {result?.reason && (
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">评估理由</div>
                      <p className="text-xs text-muted-foreground">{result.reason}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )
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
        const passRate = report && report.totalCases > 0
          ? Math.round((report.passedCases / report.totalCases) * 100)
          : null
        const time = run.completedAt
          ? format(new Date(run.completedAt), "yyyy-MM-dd HH:mm")
          : format(new Date(run.startedAt), "yyyy-MM-dd HH:mm")

        return (
          <Card key={run.id} className="hover:bg-muted/50 transition-colors">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-sm text-muted-foreground">{time}</span>
                  <Badge variant={getRunStatusVariant(run.status)}>
                    {getRunStatusLabel(run.status)}
                  </Badge>
                  {report && (
                    <>
                      <span className="text-sm font-bold" style={{
                        color: report.score >= 80 ? "#16a34a" : report.score >= 50 ? "#ca8a04" : "#dc2626"
                      }}>{report.score}分</span>
                      <span className="text-xs text-muted-foreground">
                        {report.passedCases}/{report.totalCases} 通过
                        {passRate !== null && ` (${passRate}%)`}
                      </span>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedRun(run)}
                  >
                    查看详情
                  </Button>
                  {run.status === "completed" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={exporting === run.id}
                      onClick={() => handleExport(run)}
                    >
                      {exporting === run.id
                        ? <Loader2 className="size-4 animate-spin" />
                        : <Download className="size-4" />}
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}