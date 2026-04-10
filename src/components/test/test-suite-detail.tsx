"use client"

import { useState, useRef } from "react"
import {
  Play,
  Plus,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Loader2,
  Settings2,
  Download,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { TestCaseEditor } from "./test-case-editor"
import { TestRunConfig } from "./test-run-config"
import { TestReportView } from "./test-report"
import { TestRunHistory } from "./test-run-history"
import { RoutingStepDiagnosticsDetails, TestRoutingResultDetails } from "./test-routing-result-details"
import { TestRoutingConfigDialog } from "./test-routing-config-dialog"
import { ConversationPanel } from "./conversation-panel"
import {
  parseConversationOutput,
  parseExpectedConversationOutput,
} from "./conversation-output"
import { testSuitesApi, testCasesApi } from "@/lib/utils/api-client"
import { streamTestRun } from "@/lib/utils/sse-client"
import { exportTestRunHTML, exportTestRunPDF } from "@/lib/utils/pdf-export"
import type {
  TestSuite,
  TestCase,
  TestRun,
  TestCaseResult,
  TestReport,
  TestSuiteConfig,
  TestSuiteRoutingConfig,
} from "@/types/database"

interface TestSuiteDetailProps {
  suite: TestSuite
  cases: TestCase[]
  latestRun: TestRun | null
  prompts: Array<{ id: string; title: string }>
  onSuiteUpdate: () => void
  onCaseUpdate: () => void
}

interface RunProgress {
  phase: "running" | "evaluating" | "done"
  current: number
  total: number
  results: TestCaseResult[]
  report: TestReport | null
}

function getStatusLabel(status: string): string {
  switch (status) {
    case "draft": return "草稿"
    case "ready": return "就绪"
    case "running": return "运行中"
    case "completed": return "已完成"
    default: return status
  }
}

function getStatusVariant(status: string): "default" | "secondary" | "outline" {
  switch (status) {
    case "ready": return "default"
    case "completed": return "default"
    case "running": return "secondary"
    default: return "outline"
  }
}

function getIntentMatchLabel(results: TestCaseResult[]): string {
  const comparableResults = results.filter(
    (result) => result.intentPassed !== null && result.intentPassed !== undefined
  )

  if (comparableResults.length === 0) {
    return "暂无"
  }

  const passedCount = comparableResults.filter((result) => result.intentPassed).length
  return `${Math.round((passedCount / comparableResults.length) * 100)}%`
}

export function TestSuiteDetail({
  suite,
  cases,
  latestRun,
  prompts,
  onSuiteUpdate,
  onCaseUpdate,
}: TestSuiteDetailProps) {
  const [expandedCaseId, setExpandedCaseId] = useState<string | null>(null)
  const [editingCaseId, setEditingCaseId] = useState<string | null>(null)
  const [addingCase, setAddingCase] = useState(false)
  const [configOpen, setConfigOpen] = useState(false)
  const [routingConfigOpen, setRoutingConfigOpen] = useState(false)
  const [isRunning, setIsRunning] = useState(false)
  const [runProgress, setRunProgress] = useState<RunProgress | null>(null)
  const [exporting, setExporting] = useState(false)
  const [regeneratingExpectedOutputs, setRegeneratingExpectedOutputs] = useState(false)
  const actualOutputsRef = useRef<Record<string, string>>({})
  const routingMetadataRef = useRef<
    Record<
      string,
      {
        actualIntent?: string | null
        matchedPromptId?: string | null
        matchedPromptTitle?: string | null
        routingSteps?: TestCaseResult["routingSteps"]
      }
    >
  >({})

  const latestResults = runProgress?.results ?? latestRun?.results ?? []
  const latestReport = runProgress?.report ?? latestRun?.report ?? null

  function getResultForCase(caseId: string): TestCaseResult | undefined {
    return latestResults.find((r) => r.testCaseId === caseId)
  }

  // --- Handlers ---

  async function handleRun(promptId: string) {
    setConfigOpen(false)
    setIsRunning(true)
    setRunProgress({ phase: "running", current: 0, total: cases.length, results: [], report: null })
    actualOutputsRef.current = {}
    routingMetadataRef.current = {}

    try {
      for await (const event of streamTestRun(suite.id, promptId)) {
        switch (event.type) {
          case "test-start":
            setRunProgress((prev) =>
              prev ? { ...prev, total: event.data.totalCases } : prev
            )
            break
          case "test-case-start":
            setRunProgress((prev) =>
              prev ? { ...prev, current: event.data.index + 1 } : prev
            )
            break
          case "test-case-done":
            // Store actual output for use in eval-case-done
            actualOutputsRef.current[event.data.caseId] = event.data.actualOutput
            routingMetadataRef.current[event.data.caseId] = {
              actualIntent: event.data.actualIntent,
              matchedPromptId: event.data.matchedPromptId,
              matchedPromptTitle: event.data.matchedPromptTitle,
              routingSteps: event.data.routingSteps,
            }
            break
          case "eval-start":
            setRunProgress((prev) =>
              prev ? { ...prev, phase: "evaluating", current: 0 } : prev
            )
            break
          case "eval-case-done":
            setRunProgress((prev) => {
              if (!prev) return prev
              const newResult: TestCaseResult = {
                testCaseId: event.data.caseId,
                actualOutput: actualOutputsRef.current[event.data.caseId] ?? "",
                actualIntent: routingMetadataRef.current[event.data.caseId]?.actualIntent,
                matchedPromptId: routingMetadataRef.current[event.data.caseId]?.matchedPromptId,
                matchedPromptTitle: routingMetadataRef.current[event.data.caseId]?.matchedPromptTitle,
                routingSteps: routingMetadataRef.current[event.data.caseId]?.routingSteps,
                passed: event.data.passed,
                score: event.data.score,
                reason: event.data.reason,
                intentPassed: event.data.intentPassed,
                intentScore: event.data.intentScore,
                intentReason: event.data.intentReason,
                replyPassed: event.data.replyPassed,
                replyScore: event.data.replyScore,
                replyReason: event.data.replyReason,
              }
              return {
                ...prev,
                current: prev.current + 1,
                results: [...prev.results, newResult],
              }
            })
            break
          case "eval-report":
            setRunProgress((prev) =>
              prev ? { ...prev, report: event.data } : prev
            )
            break
          case "test-complete":
            setRunProgress((prev) =>
              prev ? { ...prev, phase: "done" } : prev
            )
            break
          case "test-error":
            console.error("测试运行错误:", event.data.error)
            break
        }
      }
    } catch (err) {
      console.error("测试运行失败:", err)
    } finally {
      setIsRunning(false)
      onSuiteUpdate()
    }
  }

  async function handleAddCase(data: {
    title: string
    context: string
    input: string
    expectedIntent?: string | null
    expectedOutput: string
  }) {
    await testCasesApi.create(suite.id, {
      title: data.title,
      context: data.context,
      input: data.input,
      expectedIntent: data.expectedIntent,
      expectedOutput: data.expectedOutput,
      sortOrder: cases.length,
    })
    setAddingCase(false)
    onCaseUpdate()
  }

  async function handleUpdateCase(
    caseId: string,
    data: {
      title: string
      context: string
      input: string
      expectedIntent?: string | null
      expectedOutput: string
    }
  ) {
    await testCasesApi.update(caseId, {
      title: data.title,
      context: data.context,
      input: data.input,
      expectedIntent: data.expectedIntent,
      expectedOutput: data.expectedOutput,
    })
    setEditingCaseId(null)
    onCaseUpdate()
  }

  async function handleDeleteCase(caseId: string) {
    await testCasesApi.delete(caseId)
    if (expandedCaseId === caseId) setExpandedCaseId(null)
    if (editingCaseId === caseId) setEditingCaseId(null)
    onCaseUpdate()
  }

  async function handleConfirmSuite() {
    await testSuitesApi.update(suite.id, { status: "ready" })
    onSuiteUpdate()
  }

  async function handleConfigSave(config: TestSuiteConfig): Promise<void> {
    await testSuitesApi.update(suite.id, { config })
    onSuiteUpdate()
  }

  async function handleRoutingConfigSave(routingConfig: TestSuiteRoutingConfig): Promise<void> {
    await testSuitesApi.update(suite.id, {
      workflowMode: "routing",
      routingConfig,
    })
    setRoutingConfigOpen(false)
    onSuiteUpdate()
  }

  async function handleExportPDF() {
    const run = latestRun
    if (!run) return
    setExporting(true)
    try {
      await exportTestRunPDF({ suiteName: suite.name, testRun: run, testCases: cases })
    } catch (err) {
      console.error("PDF 导出失败:", err)
    } finally {
      setExporting(false)
    }
  }

  async function handleExportHTML() {
    const run = latestRun
    if (!run) return
    setExporting(true)
    try {
      await exportTestRunHTML({ suiteName: suite.name, testRun: run, testCases: cases })
    } catch (err) {
      console.error("HTML 导出失败:", err)
    } finally {
      setExporting(false)
    }
  }

  async function handleRegenerateExpectedOutputs() {
    setRegeneratingExpectedOutputs(true)
    try {
      const result = await testSuitesApi.regenerateExpectedOutputs(suite.id)
      alert(`已更新 ${result.updatedCount}/${result.totalCount} 条预期结果`)
      onCaseUpdate()
      onSuiteUpdate()
    } catch (err) {
      alert(`重生成失败: ${err instanceof Error ? err.message : "未知错误"}`)
    } finally {
      setRegeneratingExpectedOutputs(false)
    }
  }

  const canConfirm = suite.status === "draft" && cases.length > 0
  const canRun = (suite.status === "ready" || suite.status === "completed") && cases.length > 0 && !isRunning
  const canRegenerateExpectedOutputs = cases.length > 0 && !isRunning && !regeneratingExpectedOutputs
  const activePromptId =
    suite.workflowMode === "routing"
      ? suite.routingConfig?.entryPromptId ?? null
      : suite.promptId
  const historyCount = latestRun ? 1 : 0
  const latestScore = latestReport?.score ?? latestRun?.score
  const latestPassRate =
    latestReport && latestReport.totalCases > 0
      ? `${latestReport.passedCases}/${latestReport.totalCases}`
      : `${latestResults.filter((result) => result.passed).length}/${cases.length}`
  const intentMatchRate = getIntentMatchLabel(latestResults)

  return (
    <div className="flex flex-col h-full overflow-auto p-6 gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <h2 className="text-xl font-semibold truncate">{suite.name}</h2>
          <Badge variant={getStatusVariant(suite.status)}>
            {getStatusLabel(suite.status)}
          </Badge>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={() => setConfigOpen(true)}>
            <Settings2 className="size-4 mr-1" />
            配置
          </Button>
          {suite.workflowMode === "routing" && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRoutingConfigOpen(true)}
            >
              路由配置
            </Button>
          )}
          {canConfirm && (
            <Button size="sm" onClick={handleConfirmSuite}>
              确认测试集
            </Button>
          )}
          {canRegenerateExpectedOutputs && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleRegenerateExpectedOutputs}
            >
              {regeneratingExpectedOutputs ? (
                <Loader2 className="size-4 animate-spin mr-1" />
              ) : null}
              重生成预期结果
            </Button>
          )}
          {canRun && (
            <Button
              size="sm"
              onClick={() => {
                if (activePromptId) {
                  handleRun(activePromptId)
                } else if (suite.workflowMode === "routing") {
                  setRoutingConfigOpen(true)
                } else {
                  setConfigOpen(true)
                }
              }}
            >
              <Play className="size-4 mr-1" />
              运行测试
            </Button>
          )}
        </div>
      </div>

      {suite.description && (
        <p className="text-sm text-muted-foreground">{suite.description}</p>
      )}

      {/* Run progress */}
      {isRunning && runProgress && (
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <Loader2 className="size-4 animate-spin text-blue-500" />
              <span className="text-sm">
                {runProgress.phase === "running"
                  ? `执行中 ${runProgress.current}/${runProgress.total}`
                  : `评估中 ${runProgress.current}/${runProgress.total}`}
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Score summary */}
      {latestReport && !isRunning && (
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-lg border border-zinc-200 bg-white px-4 py-3 text-center">
            <p className="text-2xl font-semibold text-emerald-600">{latestScore ?? "-"}</p>
            <p className="mt-1 text-xs text-zinc-500">总评分</p>
          </div>
          <div className="rounded-lg border border-zinc-200 bg-white px-4 py-3 text-center">
            <p className="text-2xl font-semibold text-zinc-950">{latestPassRate}</p>
            <p className="mt-1 text-xs text-zinc-500">通过率</p>
          </div>
          <div className="rounded-lg border border-zinc-200 bg-white px-4 py-3 text-center">
            <p className="text-2xl font-semibold text-blue-600">{intentMatchRate}</p>
            <p className="mt-1 text-xs text-zinc-500">意图匹配</p>
          </div>
        </div>
      )}

      {/* Tabs: current results + history */}
      <Tabs defaultValue="current" className="flex-1">
        <TabsList className="h-auto gap-0 rounded-none border-b border-zinc-200 bg-transparent p-0">
          <TabsTrigger
            value="current"
            className="rounded-none border-b-2 border-transparent px-4 py-2 text-sm font-medium text-zinc-500 data-[state=active]:border-zinc-950 data-[state=active]:bg-transparent data-[state=active]:text-zinc-950 data-[state=active]:shadow-none"
          >
            测试结果
          </TabsTrigger>
          <TabsTrigger
            value="history"
            className="rounded-none border-b-2 border-transparent px-4 py-2 text-sm font-medium text-zinc-500 data-[state=active]:border-zinc-950 data-[state=active]:bg-transparent data-[state=active]:text-zinc-950 data-[state=active]:shadow-none"
          >
            {`历史记录 (${historyCount})`}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="current" className="space-y-3 mt-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">测试用例 ({cases.length})</h3>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={() => setAddingCase(true)}
          >
            <Plus className="size-3" />
            添加用例
          </Button>
        </div>

        {cases.map((tc, index) => {
          const result = getResultForCase(tc.id)
          const isExpanded = expandedCaseId === tc.id
          const isEditing = editingCaseId === tc.id

          if (isEditing) {
            return (
              <TestCaseEditor
                key={tc.id}
                initialData={{
                  title: tc.title,
                  context: tc.context,
                  input: tc.input,
                  expectedIntent: tc.expectedIntent,
                  expectedOutput: tc.expectedOutput,
                }}
                showExpectedIntent={suite.workflowMode === "routing"}
                onSave={(data) => handleUpdateCase(tc.id, data)}
                onCancel={() => setEditingCaseId(null)}
              />
            )
          }

          const hasRoutingDiagnostics =
            Boolean(result?.routingSteps?.length) &&
            suite.workflowMode === "routing"
          const hasConversationOutput = Boolean(result?.actualOutput)

          return (
            <Card key={tc.id}>
              <button
                onClick={() => setExpandedCaseId(isExpanded ? null : tc.id)}
                className="flex w-full items-center gap-2 p-3 text-left hover:bg-muted/50 transition-colors rounded-t-lg"
              >
                {isExpanded ? (
                  <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
                ) : (
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                )}
                {result ? (
                  result.passed ? (
                    <CheckCircle2 className="size-4 shrink-0 text-green-500" />
                  ) : (
                    <XCircle className="size-4 shrink-0 text-red-500" />
                  )
                ) : null}
                <span className="flex-1 text-sm font-medium truncate">
                  #{index + 1} {tc.title}
                </span>
                {result && (
                  <Badge
                    variant={result.score >= 80 ? "default" : result.score >= 50 ? "secondary" : "outline"}
                    className="shrink-0 text-xs"
                  >
                    {result.score}分
                  </Badge>
                )}
              </button>

              {isExpanded && (
                <CardContent className="pt-0 pb-3 space-y-3">
                  {tc.context && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">上下文</p>
                      <p className="text-sm whitespace-pre-wrap bg-muted/50 rounded p-2">{tc.context}</p>
                    </div>
                  )}

                  {result && (hasConversationOutput || hasRoutingDiagnostics) ? (
                    <>
                      {hasConversationOutput && (
                        <div className="grid gap-3 md:grid-cols-2">
                          <ConversationPanel
                            title="预期输出"
                            turns={parseExpectedConversationOutput(tc.input, tc.expectedOutput)}
                            showIntentBadges
                          />
                          <ConversationPanel
                            title="对话记录"
                            turns={parseConversationOutput(result.actualOutput, tc.input, result)}
                            showIntentBadges
                          />
                        </div>
                      )}
                      {suite.workflowMode === "routing" && (
                        <>
                          <TestRoutingResultDetails testCase={tc} result={result} />
                          {tc.expectedOutputDiagnostics?.length ? (
                            <RoutingStepDiagnosticsDetails
                              title="预期结果生成诊断"
                              routingSteps={tc.expectedOutputDiagnostics}
                            />
                          ) : null}
                        </>
                      )}
                    </>
                  ) : (
                    <>
                      {/* No results yet: show input and expected output separately */}
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">输入</p>
                        <p className="text-sm whitespace-pre-wrap bg-muted/50 rounded p-2">{tc.input}</p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">期望输出</p>
                        <p className="text-sm whitespace-pre-wrap bg-muted/50 rounded p-2">{tc.expectedOutput}</p>
                      </div>
                      {suite.workflowMode === "routing" && tc.expectedOutputDiagnostics?.length ? (
                        <RoutingStepDiagnosticsDetails
                          title="预期结果生成诊断"
                          routingSteps={tc.expectedOutputDiagnostics}
                        />
                      ) : null}
                      {suite.workflowMode === "routing" && tc.expectedIntent && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-1">期望 intent</p>
                          <p className="text-sm whitespace-pre-wrap bg-muted/50 rounded p-2">{tc.expectedIntent}</p>
                        </div>
                      )}
                    </>
                  )}
                  <div className="flex gap-2 pt-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={(e) => { e.stopPropagation(); setEditingCaseId(tc.id) }}
                    >
                      编辑
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs text-destructive hover:text-destructive"
                      onClick={(e) => { e.stopPropagation(); handleDeleteCase(tc.id) }}
                    >
                      删除
                    </Button>
                  </div>
                </CardContent>
              )}
            </Card>
          )
        })}

        {addingCase && (
          <TestCaseEditor
            showExpectedIntent={suite.workflowMode === "routing"}
            onSave={handleAddCase}
            onCancel={() => setAddingCase(false)}
          />
        )}

      {/* Test report */}
      {latestReport && !isRunning && (
        <TestReportView report={latestReport} />
      )}
        </TabsContent>


         <TabsContent value="history" className="mt-3">
           <div className="space-y-4">
             <div className="flex items-center justify-between">
               <div className="flex items-center gap-2">
                 <Button
                   variant="outline"
                   size="sm"
                   className="shrink-0"
                   disabled={exporting || !latestRun}
                   onClick={handleExportHTML}
                 >
                   {exporting
                     ? <Loader2 className="size-4 animate-spin mr-1" />
                     : <Download className="size-4 mr-1" />}
                   导出 HTML
                 </Button>
                 <Button
                   variant="outline"
                   size="sm"
                   className="shrink-0"
                   disabled={exporting || !latestRun}
                   onClick={handleExportPDF}
                 >
                   {exporting
                     ? <Loader2 className="size-4 animate-spin mr-1" />
                     : <Download className="size-4 mr-1" />}
                   导出 PDF
                 </Button>
               </div>
             </div>
            <TestRunHistory
              testSuiteId={suite.id}
              testCases={cases}
              suiteName={suite.name}
            />
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
              <div className="mb-3 text-xs font-semibold text-zinc-600">趋势</div>
              <div className="flex h-16 items-end gap-2">
                <div className="flex flex-1 flex-col items-center gap-1">
                  <div className="w-full rounded bg-rose-100" style={{ height: latestScore ? `${Math.max(20, Math.round(latestScore * 0.35))}px` : "22px" }} />
                  <span className="text-[10px] text-zinc-400">#1</span>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Config dialog */}
      <TestRunConfig
        open={configOpen}
        onOpenChange={setConfigOpen}
        config={suite.config}
        promptId={activePromptId}
        prompts={prompts}
        promptSelectionLocked={suite.workflowMode === "routing"}
        onSave={handleConfigSave}
        onRunWithPrompt={handleRun}
      />

      {suite.workflowMode === "routing" && (
        <TestRoutingConfigDialog
          open={routingConfigOpen}
          onOpenChange={setRoutingConfigOpen}
          prompts={prompts}
          value={
            suite.routingConfig ?? {
              entryPromptId: "",
              routes: [],
            }
          }
          onSave={handleRoutingConfigSave}
        />
      )}
    </div>
  )
}
