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
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { TestCaseEditor } from "./test-case-editor"
import { TestRunConfig } from "./test-run-config"
import { TestReportView } from "./test-report"
import { testSuitesApi, testCasesApi } from "@/lib/utils/api-client"
import { streamTestRun } from "@/lib/utils/sse-client"
import type {
  TestSuite,
  TestCase,
  TestRun,
  TestCaseResult,
  TestReport,
  TestSuiteConfig,
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

/**
 * Parse actualOutput (and fallback to input) into structured conversation turns.
 * Handles two formats:
 * - Multi-turn: "User: xxx\nAssistant: xxx\nUser: yyy\nAssistant: yyy"
 * - Single-turn: plain text (uses input as user turn, output as assistant turn)
 */
function parseConversationOutput(
  actualOutput: string,
  input: string
): Array<{ role: "user" | "assistant"; content: string }> {
  // Try parsing "User: / Assistant:" markers
  const turns: Array<{ role: "user" | "assistant"; content: string }> = []
  const lines = actualOutput.split("\n")
  let currentRole: "user" | "assistant" | null = null
  let currentContent = ""

  for (const line of lines) {
    const userMatch = line.match(/^User:\s*(.*)/)
    const assistantMatch = line.match(/^Assistant:\s*(.*)/)

    if (userMatch) {
      if (currentRole) {
        turns.push({ role: currentRole, content: currentContent.trim() })
      }
      currentRole = "user"
      currentContent = userMatch[1]
    } else if (assistantMatch) {
      if (currentRole) {
        turns.push({ role: currentRole, content: currentContent.trim() })
      }
      currentRole = "assistant"
      currentContent = assistantMatch[1]
    } else if (currentRole) {
      currentContent += "\n" + line
    }
  }

  if (currentRole) {
    turns.push({ role: currentRole, content: currentContent.trim() })
  }

  // If we got at least 2 turns with content, use parsed result
  const nonEmptyTurns = turns.filter((t) => t.content)
  if (nonEmptyTurns.length >= 2) {
    return nonEmptyTurns
  }

  // Fallback: single-turn — show input as user, actualOutput as assistant
  return [
    { role: "user", content: input },
    { role: "assistant", content: actualOutput },
  ]
}

function getStatusVariant(status: string): "default" | "secondary" | "outline" {
  switch (status) {
    case "ready": return "default"
    case "completed": return "default"
    case "running": return "secondary"
    default: return "outline"
  }
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
  const [isRunning, setIsRunning] = useState(false)
  const [runProgress, setRunProgress] = useState<RunProgress | null>(null)
  const actualOutputsRef = useRef<Record<string, string>>({})

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
                passed: event.data.passed,
                score: event.data.score,
                reason: event.data.reason,
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

  async function handleAddCase(data: { title: string; context: string; input: string; expectedOutput: string }) {
    await testCasesApi.create(suite.id, {
      title: data.title,
      context: data.context,
      input: data.input,
      expectedOutput: data.expectedOutput,
      sortOrder: cases.length,
    })
    setAddingCase(false)
    onCaseUpdate()
  }

  async function handleUpdateCase(
    caseId: string,
    data: { title: string; context: string; input: string; expectedOutput: string }
  ) {
    await testCasesApi.update(caseId, {
      title: data.title,
      context: data.context,
      input: data.input,
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

  const canConfirm = suite.status === "draft" && cases.length > 0
  const canRun = (suite.status === "ready" || suite.status === "completed") && cases.length > 0 && !isRunning

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
          {canConfirm && (
            <Button size="sm" onClick={handleConfirmSuite}>
              确认测试集
            </Button>
          )}
          {canRun && (
            <Button
              size="sm"
              onClick={() => {
                if (suite.promptId) {
                  handleRun(suite.promptId)
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
        <Card>
          <CardContent className="pt-4">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold">{latestReport.score}</p>
                <p className="text-xs text-muted-foreground">总分</p>
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {latestReport.passedCases}/{latestReport.totalCases}
                </p>
                <p className="text-xs text-muted-foreground">通过率</p>
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {latestReport.totalCases > 0
                    ? Math.round((latestReport.passedCases / latestReport.totalCases) * 100)
                    : 0}%
                </p>
                <p className="text-xs text-muted-foreground">通过百分比</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Test cases */}
      <div className="space-y-3">
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
                  expectedOutput: tc.expectedOutput,
                }}
                onSave={(data) => handleUpdateCase(tc.id, data)}
                onCancel={() => setEditingCaseId(null)}
              />
            )
          }

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

                  {result && result.actualOutput ? (
                    <>
                      {/* Structured conversation transcript */}
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">对话记录</p>
                        <div className="rounded border bg-muted/20 divide-y">
                          {parseConversationOutput(result.actualOutput, tc.input).map((turn, idx) => (
                            <div key={idx} className="p-2">
                              <span className={`inline-block text-xs font-medium rounded px-1.5 py-0.5 mb-1 ${
                                turn.role === 'user'
                                  ? 'text-blue-700 bg-blue-100 dark:text-blue-300 dark:bg-blue-900/40'
                                  : 'text-emerald-700 bg-emerald-100 dark:text-emerald-300 dark:bg-emerald-900/40'
                              }`}>
                                {turn.role === 'user' ? '用户' : '助手'}
                              </span>
                              <p className="text-sm whitespace-pre-wrap break-words">{turn.content}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">期望输出</p>
                        <p className="text-sm whitespace-pre-wrap break-words bg-muted/50 rounded p-2">{tc.expectedOutput}</p>
                      </div>
                      {result.reason && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-1">评估原因</p>
                          <p className="text-sm whitespace-pre-wrap">{result.reason}</p>
                        </div>
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
            onSave={handleAddCase}
            onCancel={() => setAddingCase(false)}
          />
        )}
      </div>

      {/* Test report */}
      {latestReport && !isRunning && (
        <TestReportView report={latestReport} />
      )}

      {/* Config dialog */}
      <TestRunConfig
        open={configOpen}
        onOpenChange={setConfigOpen}
        config={suite.config}
        promptId={suite.promptId}
        prompts={prompts}
        onSave={handleConfigSave}
        onRunWithPrompt={handleRun}
      />
    </div>
  )
}
