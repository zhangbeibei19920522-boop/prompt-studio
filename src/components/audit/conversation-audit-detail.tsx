"use client"

import type { ChangeEvent, DragEvent } from "react"
import { useEffect, useMemo, useRef, useState } from "react"
import { ChevronDown, ChevronRight, Download, FileText, Loader2, Play, RefreshCw, Trash2, Upload } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { ConversationPanel } from "@/components/test/conversation-panel"
import type { ConversationTurn } from "@/components/test/conversation-output"
import { conversationAuditJobsApi } from "@/lib/utils/api-client"
import { streamConversationAuditRun } from "@/lib/utils/sse-client"
import { cn } from "@/lib/utils"
import type {
  ConversationAuditConversation,
  ConversationAuditJob,
  ConversationAuditKnowledgeStatus,
  ConversationAuditOverallStatus,
  ConversationAuditProcessStatus,
  ConversationAuditTurn,
} from "@/types/database"

interface ConversationAuditDetailData {
  job: ConversationAuditJob
  parseSummary: ConversationAuditJob["parseSummary"]
  conversations: ConversationAuditConversation[]
  turns: ConversationAuditTurn[]
}

interface ConversationAuditDetailProps {
  projectId: string
  data: ConversationAuditDetailData | null
  createMode: boolean
  onCreated: (jobId: string) => void
  onRefresh: (jobId: string) => Promise<ConversationAuditDetailData>
  onDeleted: (jobId: string) => Promise<void> | void
}

const HISTORY_FILE_ACCEPT = [".xls", ".xlsx"]
const KNOWLEDGE_FILE_ACCEPT = [".doc", ".docx", ".html", ".htm", ".xls", ".xlsx"]

type ConversationAuditJobViewStateInput = Pick<ConversationAuditJob, "id" | "status" | "errorMessage">

function getFileExtension(fileName: string): string {
  const extension = fileName.split(".").pop()?.toLowerCase()
  return extension ? `.${extension}` : ""
}

function filterAcceptedFiles(incoming: FileList | File[], acceptedExtensions: string[]): {
  accepted: File[]
  rejected: string[]
} {
  const accepted: File[] = []
  const rejected: string[] = []

  for (const file of Array.from(incoming)) {
    if (acceptedExtensions.includes(getFileExtension(file.name))) {
      accepted.push(file)
    } else {
      rejected.push(file.name)
    }
  }

  return { accepted, rejected }
}

export function mergeKnowledgeFiles(existing: File[], incoming: File[]): File[] {
  const merged = new Map(existing.map((file) => [file.name, file]))

  for (const file of incoming) {
    merged.set(file.name, file)
  }

  return Array.from(merged.values())
}

interface ConversationAuditUploadCardProps {
  title: string
  description: string
  accept: string[]
  inputLabel: string
  files: File[]
  multiple?: boolean
  onFilesChange: (files: File[]) => void
}

function ConversationAuditUploadCard({
  title,
  description,
  accept,
  inputLabel,
  files,
  multiple = false,
  onFilesChange,
}: ConversationAuditUploadCardProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [error, setError] = useState("")

  function applyFiles(incoming: FileList | File[]) {
    const { accepted, rejected } = filterAcceptedFiles(incoming, accept)
    setError(rejected.length > 0 ? `已忽略不支持的文件：${rejected.join("、")}` : "")
    onFilesChange(multiple ? mergeKnowledgeFiles(files, accepted) : accepted.slice(0, 1))
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    if (event.target.files) {
      applyFiles(event.target.files)
    }
    event.target.value = ""
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setIsDragging(true)
  }

  function handleDragLeave(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setIsDragging(false)
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setIsDragging(false)
    if (event.dataTransfer.files) {
      applyFiles(event.dataTransfer.files)
    }
  }

  return (
    <div className="space-y-3">
      <div
        className={cn(
          "flex h-[18rem] flex-col overflow-hidden rounded-xl border bg-background",
          isDragging ? "border-primary bg-primary/5" : "border-border"
        )}
      >
        <div
          role="button"
          tabIndex={0}
          aria-label={title}
          className={cn(
            "flex min-h-0 flex-1 cursor-pointer flex-col items-center justify-center gap-2 border-b-2 border-dashed px-5 py-5 text-center transition-colors outline-none",
            isDragging
              ? "border-primary bg-primary/5 text-primary"
              : "border-muted-foreground/30 hover:border-primary/50 hover:bg-muted/20"
          )}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault()
              inputRef.current?.click()
            }
          }}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <Upload className="size-8 shrink-0" />
          <div className="space-y-1">
            <p className="text-sm font-semibold text-foreground">{title}</p>
            <p className="text-sm font-medium text-foreground">点击上传或拖拽文件到此处</p>
            <p className="text-xs text-muted-foreground">{description}</p>
          </div>
          <input
            ref={inputRef}
            type="file"
            aria-label={inputLabel}
            accept={accept.join(",")}
            multiple={multiple}
            className="sr-only"
            onChange={handleFileChange}
          />
        </div>

        <div className="flex h-24 flex-col p-2.5">
          <p className="text-xs font-medium text-muted-foreground">
            {files.length > 0 ? (multiple ? `已选择 ${files.length} 个文件` : "已选择文件") : "文件列表"}
          </p>
          <div className="mt-1.5 min-h-0 flex-1 overflow-y-auto">
            {files.length > 0 ? (
              <div className="space-y-1.5">
                {files.map((file) => (
                  <div key={file.name} className="flex items-center gap-2 text-sm">
                    <FileText className="size-4 shrink-0 text-muted-foreground" />
                    <span className="truncate">{file.name}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">尚未选择文件</p>
            )}
          </div>
        </div>
      </div>

      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  )
}

function getStatusLabel(status: string): string {
  switch (status) {
    case "parsing":
      return "解析中"
    case "draft":
      return "草稿"
    case "running":
      return "运行中"
    case "completed":
      return "已完成"
    case "failed":
      return "失败"
    default:
      return status
  }
}

function getStatusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "parsing":
      return "secondary"
    case "completed":
      return "default"
    case "running":
      return "secondary"
    case "failed":
      return "destructive"
    default:
      return "outline"
  }
}

function getResultBadgeVariant(status: "passed" | "failed" | "unknown"): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "passed":
      return "default"
    case "failed":
      return "destructive"
    default:
      return "outline"
  }
}

function getProcessStepBadgeVariant(status: "passed" | "failed" | "out_of_order"): "default" | "destructive" | "outline" {
  switch (status) {
    case "passed":
      return "default"
    case "failed":
      return "destructive"
    case "out_of_order":
      return "outline"
  }
}

function getProcessStepStatusLabel(status: "passed" | "failed" | "out_of_order"): string {
  switch (status) {
    case "passed":
      return "已完成"
    case "failed":
      return "缺失"
    case "out_of_order":
      return "顺序异常"
  }
}

function getOverallStatusLabel(status: ConversationAuditOverallStatus): string {
  switch (status) {
    case "passed":
      return "整体通过"
    case "failed":
      return "整体未通过"
    default:
      return "整体待确认"
  }
}

function getProcessStatusLabel(status: ConversationAuditProcessStatus): string {
  switch (status) {
    case "passed":
      return "流程通过"
    case "failed":
      return "流程异常"
    default:
      return "流程待确认"
  }
}

function getKnowledgeStatusLabel(status: ConversationAuditKnowledgeStatus): string {
  switch (status) {
    case "passed":
      return "知识通过"
    case "failed":
      return "知识错误"
    default:
      return "知识待确认"
  }
}

function getRiskLabel(riskLevel: ConversationAuditConversation["riskLevel"]): string {
  switch (riskLevel) {
    case "high":
      return "高风险"
    case "medium":
      return "中风险"
    case "low":
    default:
      return "低风险"
  }
}

function getRiskDotClass(riskLevel: ConversationAuditConversation["riskLevel"]): string {
  switch (riskLevel) {
    case "high":
      return "bg-rose-500"
    case "medium":
      return "bg-orange-500"
    case "low":
    default:
      return "bg-emerald-500"
  }
}

function getConversationScore(conversation: ConversationAuditConversation): number {
  switch (conversation.riskLevel) {
    case "high":
      return 45
    case "medium":
      return 71
    case "low":
    default:
      return 94
  }
}

export function getConversationAuditJobViewState(
  job: ConversationAuditJobViewStateInput,
  runProgressByJobId: Record<string, string> = {}
): {
  isParsing: boolean
  isRunning: boolean
  progressMessage: string
} {
  const isParsing = job.status === "parsing"
  const isRunning = job.status === "running"
  const progressMessage = runProgressByJobId[job.id]
    ?? (job.status === "parsing"
      ? "正在解析上传文件"
      : job.status === "running"
        ? "正在执行会话质检"
        : job.status === "failed"
          ? `解析失败：${job.errorMessage ?? "请重新创建任务"}`
          : "上传完成后可直接运行会话质检")

  return {
    isParsing,
    isRunning,
    progressMessage,
  }
}

function buildAuditConversationPanelTurns(turns: ConversationAuditTurn[]): ConversationTurn[] {
  return turns.flatMap((turn) => {
    const assistantReply = turn.botReply?.trim() ? turn.botReply : "无回复"

    return [
      {
        role: "user" as const,
        content: turn.userMessage,
      },
      {
        role: "assistant" as const,
        content: assistantReply,
      },
    ]
  })
}

export function ConversationAuditDetail({
  projectId,
  data,
  createMode,
  onCreated,
  onRefresh,
  onDeleted,
}: ConversationAuditDetailProps) {
  const [name, setName] = useState("历史会话质检")
  const [historyFile, setHistoryFile] = useState<File | null>(null)
  const [knowledgeFiles, setKnowledgeFiles] = useState<File[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [showIssuesOnly, setShowIssuesOnly] = useState(false)
  const [localData, setLocalData] = useState<ConversationAuditDetailData | null>(data)
  const [runProgressByJobId, setRunProgressByJobId] = useState<Record<string, string>>({})
  const [expandedConversationId, setExpandedConversationId] = useState<string | null>(data?.conversations[0]?.id ?? null)
  const selectedJobIdRef = useRef<string | null>(data?.job.id ?? null)

  useEffect(() => {
    setLocalData(data)
  }, [data])

  useEffect(() => {
    selectedJobIdRef.current = data?.job.id ?? null
  }, [data])

  useEffect(() => {
    const firstConversationId = data?.conversations[0]?.id ?? null
    setExpandedConversationId((current) => current ?? firstConversationId)
  }, [data])

  useEffect(() => {
    if (!localData || localData.job.status !== "parsing") {
      return
    }

    const parsingJobId = localData.job.id
    let cancelled = false

    async function poll() {
      try {
        const refreshed = await onRefresh(parsingJobId)
        if (!cancelled) {
          setLocalData(refreshed)
        }
      } catch (error) {
        console.error("Refresh parsing conversation audit failed:", error)
      }
    }

    const timer = window.setInterval(() => {
      void poll()
    }, 1500)

    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [localData, onRefresh])

  const groupedConversations = useMemo(() => {
    const turnsByConversation = new Map<string, ConversationAuditTurn[]>()

    for (const turn of localData?.turns ?? []) {
      const existing = turnsByConversation.get(turn.conversationId) ?? []
      existing.push(turn)
      turnsByConversation.set(turn.conversationId, existing)
    }

    const conversations = (localData?.conversations ?? []).map((conversation) => ({
      conversation,
      turns: (turnsByConversation.get(conversation.id) ?? []).sort((a, b) => a.turnIndex - b.turnIndex),
    }))

    if (!showIssuesOnly) {
      return conversations
    }

    return conversations.filter(({ conversation }) => (
      conversation.overallStatus === "failed"
      || conversation.processStatus === "failed"
      || conversation.knowledgeStatus === "failed"
    ))
  }, [localData, showIssuesOnly])

  async function handleCreate() {
    if (!historyFile || !name.trim()) {
      return
    }

    setSubmitting(true)
    try {
      const created = await conversationAuditJobsApi.create(projectId, {
        name: name.trim(),
        historyFile,
        knowledgeFiles,
      })
      setLocalData(created)
      setHistoryFile(null)
      setKnowledgeFiles([])
      onCreated(created.job.id)
    } catch (error) {
      console.error("Create conversation audit job failed:", error)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleRun() {
    if (!localData) {
      return
    }

    const jobId = localData.job.id
    if (localData.job.status === "parsing" || localData.job.status === "running") {
      return
    }

    setLocalData((current) => (
      current && current.job.id === jobId
        ? {
          ...current,
          job: {
            ...current.job,
            status: "running",
            errorMessage: null,
            completedAt: null,
          },
        }
        : current
    ))
    setRunProgressByJobId((current) => ({
      ...current,
      [jobId]: "准备开始...",
    }))

    try {
      for await (const event of streamConversationAuditRun(jobId)) {
        switch (event.type) {
          case "audit-start":
            setLocalData((current) => (
              current && current.job.id === jobId
                ? {
                  ...current,
                  job: {
                    ...current.job,
                    status: "running",
                    issueCount: 0,
                    totalTurns: event.data.totalTurns,
                    errorMessage: null,
                    completedAt: null,
                  },
                }
                : current
            ))
            setRunProgressByJobId((current) => ({
              ...current,
              [jobId]: `开始检查，共 ${event.data.totalTurns} 轮`,
            }))
            break
          case "audit-turn-start":
            setRunProgressByJobId((current) => ({
              ...current,
              [jobId]: `正在检查第 ${event.data.index + 1} 轮`,
            }))
            break
          case "audit-turn-done":
            setRunProgressByJobId((current) => ({
              ...current,
              [jobId]: event.data.hasIssue ? "发现问题轮次" : "本轮检查完成",
            }))
            break
          case "audit-complete":
            setLocalData((current) => (
              current && current.job.id === jobId
                ? {
                  ...current,
                  job: {
                    ...current.job,
                    status: "completed",
                    issueCount: event.data.issueCount,
                    totalTurns: event.data.totalTurns,
                    errorMessage: null,
                  },
                }
                : current
            ))
            setRunProgressByJobId((current) => ({
              ...current,
              [jobId]: `检查完成，共发现 ${event.data.issueCount} 个问题轮次`,
            }))
            if (selectedJobIdRef.current === jobId) {
              setLocalData(await onRefresh(jobId))
            }
            break
          case "audit-error":
            setLocalData((current) => (
              current && current.job.id === jobId
                ? {
                  ...current,
                  job: {
                    ...current.job,
                    status: "failed",
                    errorMessage: event.data.error,
                  },
                }
                : current
            ))
            setRunProgressByJobId((current) => ({
              ...current,
              [jobId]: `运行失败：${event.data.error}`,
            }))
            if (selectedJobIdRef.current === jobId) {
              setLocalData(await onRefresh(jobId))
            }
            break
        }
      }
    } catch (error) {
      console.error("Run conversation audit failed:", error)
      setLocalData((current) => (
        current && current.job.id === jobId
          ? {
            ...current,
            job: {
              ...current.job,
              status: "failed",
            },
          }
          : current
      ))
      setRunProgressByJobId((current) => ({
        ...current,
        [jobId]: `运行失败：${error instanceof Error ? error.message : "未知错误"}`,
      }))
    }
  }

  async function handleRefresh() {
    if (!localData) {
      return
    }
    setLocalData(await onRefresh(localData.job.id))
  }

  function handleExport() {
    if (!localData) {
      return
    }
    window.location.href = `/api/conversation-audit-jobs/${localData.job.id}/export`
  }

  async function handleDelete() {
    if (!localData) {
      return
    }

    if (typeof window !== "undefined" && !window.confirm(`确定要删除任务「${localData.job.name}」吗？此操作无法撤销。`)) {
      return
    }

    try {
      await conversationAuditJobsApi.delete(localData.job.id)
      await onDeleted(localData.job.id)
    } catch (error) {
      console.error("Delete conversation audit job failed:", error)
    }
  }

  if (createMode || !localData) {
    return (
      <div className="flex h-full flex-1 overflow-hidden bg-muted/20">
        <div className="mx-auto flex min-h-0 w-full max-w-4xl flex-1 flex-col gap-6 overflow-y-auto p-6">
          <Card>
            <CardHeader>
              <CardTitle>新建会话质检任务</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <p className="text-sm font-medium">任务名称</p>
                <Input value={name} onChange={(event) => setName(event.target.value)} />
              </div>

              <div className="space-y-2">
                <ConversationAuditUploadCard
                  title="历史对话 Excel"
                  description="仅支持 Excel，对话按 Conversation ID 解析"
                  accept={HISTORY_FILE_ACCEPT}
                  inputLabel="历史对话文件上传"
                  files={historyFile ? [historyFile] : []}
                  onFilesChange={(files) => setHistoryFile(files[0] ?? null)}
                />
              </div>

              <div className="space-y-2">
                <ConversationAuditUploadCard
                  title="知识库文件"
                  description="支持混合上传 Word、HTML、Excel"
                  accept={KNOWLEDGE_FILE_ACCEPT}
                  inputLabel="知识库文件上传"
                  files={knowledgeFiles}
                  multiple
                  onFilesChange={setKnowledgeFiles}
                />
              </div>

              <div className="flex items-center gap-3">
                <Button onClick={handleCreate} disabled={submitting || !historyFile || !name.trim()}>
                  {submitting ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Upload className="mr-2 size-4" />}
                  创建任务
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  const { isParsing, isRunning, progressMessage } = getConversationAuditJobViewState(
    localData.job,
    runProgressByJobId
  )

  return (
    <div className="flex h-full flex-1 overflow-hidden bg-muted/20">
      <div className="flex w-full flex-col gap-4 p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-semibold">{localData.job.name}</h2>
              <Badge variant={getStatusVariant(localData.job.status)}>
                {getStatusLabel(localData.job.status)}
              </Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{progressMessage}</p>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setShowIssuesOnly((value) => !value)} disabled={isParsing}>
              {showIssuesOnly ? "显示全部" : "只看异常"}
            </Button>
            <Button variant="outline" onClick={handleRefresh}>
              <RefreshCw className="mr-2 size-4" />
              刷新
            </Button>
            <Button variant="outline" onClick={handleExport} disabled={isParsing}>
              <Download className="mr-2 size-4" />
              导出 Excel
            </Button>
            <Button onClick={handleRun} disabled={isRunning || isParsing}>
              {isRunning ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Play className="mr-2 size-4" />}
              开始检查
            </Button>
            <Button variant="outline" onClick={handleDelete}>
              <Trash2 className="mr-2 size-4" />
              删除任务
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-3">
          <Card className="py-4">
            <CardContent className="px-5 py-4 sm:px-6">
              <p className="text-sm text-muted-foreground">对话总数</p>
              <p className="mt-1.5 text-2xl font-semibold">{localData.conversations.length}</p>
            </CardContent>
          </Card>
          <Card className="py-4">
            <CardContent className="px-5 py-4 sm:px-6">
              <p className="text-sm text-muted-foreground">整体通过率</p>
              <p className="mt-1.5 text-2xl font-semibold">
                {localData.conversations.length > 0
                  ? `${Math.round((localData.conversations.filter((conversation) => conversation.overallStatus === "passed").length / localData.conversations.length) * 100)}%`
                  : "0%"}
              </p>
            </CardContent>
          </Card>
          <Card className="py-4">
            <CardContent className="px-5 py-4 sm:px-6">
              <p className="text-sm text-muted-foreground">流程通过率</p>
              <p className="mt-1.5 text-2xl font-semibold">
                {localData.conversations.length > 0
                  ? `${Math.round((localData.conversations.filter((conversation) => conversation.processStatus === "passed").length / localData.conversations.length) * 100)}%`
                  : "0%"}
              </p>
            </CardContent>
          </Card>
          <Card className="py-4">
            <CardContent className="px-5 py-4 sm:px-6">
              <p className="text-sm text-muted-foreground">知识通过率</p>
              <p className="mt-1.5 text-2xl font-semibold">
                {localData.conversations.length > 0
                  ? `${Math.round((localData.conversations.filter((conversation) => conversation.knowledgeStatus === "passed").length / localData.conversations.length) * 100)}%`
                  : "0%"}
              </p>
            </CardContent>
          </Card>
        </div>

        <Card className="flex min-h-0 flex-1 flex-col">
          <CardHeader>
            <CardTitle>对话详情</CardTitle>
          </CardHeader>
          <CardContent className="min-h-0 flex-1">
            <ScrollArea className="h-full pr-4">
              <div className="space-y-4">
                {groupedConversations.length === 0 ? (
                  <p className="text-sm text-muted-foreground">当前没有可展示的对话结果。</p>
                ) : null}

                {groupedConversations.map(({ conversation, turns }) => {
                  const isExpanded = expandedConversationId === conversation.id
                  const conversationScore = getConversationScore(conversation)

                  return (
                    <Card key={conversation.id} className="border border-border/60 py-4">
                      <CardContent className="space-y-3 px-5 py-4 sm:px-6">
                        <button
                          type="button"
                          className="flex w-full items-start justify-between gap-2 text-left"
                          onClick={() => setExpandedConversationId(isExpanded ? null : conversation.id)}
                        >
                          <div className="min-w-0 max-w-[42rem] flex-1 space-y-1">
                            <div className="flex items-center gap-2">
                              {isExpanded ? <ChevronDown className="size-4 text-muted-foreground" /> : <ChevronRight className="size-4 text-muted-foreground" />}
                              <span className={`inline-block size-2 rounded-full ${getRiskDotClass(conversation.riskLevel)}`} />
                              <p className="text-sm font-medium">
                                对话 #{conversation.externalConversationId}
                              </p>
                            </div>
                            {conversation.summary ? (
                              <p className="pl-6 text-sm text-muted-foreground">{conversation.summary}</p>
                            ) : null}
                          </div>
                          <div className="flex shrink-0 flex-nowrap justify-end gap-2">
                            <span className="text-sm font-semibold text-zinc-700">{`${conversationScore}分`}</span>
                          </div>
                        </button>

                        {isExpanded ? (
                          <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
                            <div className="space-y-3">
                              <ConversationPanel
                                title="对话记录"
                                turns={buildAuditConversationPanelTurns(turns)}
                              />
                            </div>

                            <div className="space-y-4">
                              <div className="space-y-3 rounded-lg border bg-background p-4">
                                <div className="flex items-center justify-between gap-2">
                                  <p className="text-sm font-medium">流程规范检查</p>
                                  <Badge variant={getResultBadgeVariant(conversation.processStatus)}>
                                    {getProcessStatusLabel(conversation.processStatus)}
                                  </Badge>
                                </div>

                                {conversation.processSteps.length > 0 ? (
                                  <div className="space-y-3">
                                    {conversation.processSteps.map((step) => (
                                      <div key={step.name} className="rounded-md border bg-muted/20 p-3">
                                        <div className="flex items-center justify-between gap-2">
                                          <p className="text-sm font-medium">{step.name}</p>
                                          <Badge variant={getProcessStepBadgeVariant(step.status)}>
                                            {getProcessStepStatusLabel(step.status)}
                                          </Badge>
                                        </div>
                                        <p className="mt-2 text-sm text-muted-foreground">{step.reason}</p>
                                        {step.sourceNames.length > 0 ? (
                                          <div className="mt-2 flex flex-wrap gap-2">
                                            {step.sourceNames.map((sourceName) => (
                                              <span key={sourceName} className="rounded-full border px-2 py-0.5 text-xs text-muted-foreground">
                                                {sourceName}
                                              </span>
                                            ))}
                                          </div>
                                        ) : null}
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="text-sm text-muted-foreground">暂无流程步骤结果。</p>
                                )}
                              </div>

                              <div className="space-y-3 rounded-lg border bg-background p-4">
                                <div className="flex items-center justify-between gap-2">
                                  <p className="text-sm font-medium">知识问答问题</p>
                                  <Badge variant={getResultBadgeVariant(conversation.knowledgeStatus)}>
                                    {getKnowledgeStatusLabel(conversation.knowledgeStatus)}
                                  </Badge>
                                </div>

                                <div className="space-y-3">
                                  {turns.filter((turn) => turn.hasIssue === true).length > 0 ? turns
                                    .filter((turn) => turn.hasIssue === true)
                                    .map((turn) => (
                                      <div key={turn.id} className="rounded-md border bg-muted/20 p-3">
                                        <p className="text-sm font-medium">第 {turn.turnIndex + 1} 轮</p>
                                        <p className="mt-2 text-sm text-muted-foreground">
                                          正确回答：{turn.knowledgeAnswer || "尚未生成"}
                                        </p>
                                        {turn.retrievedSources.length > 0 ? (
                                          <div className="mt-2 flex flex-wrap gap-2">
                                            {turn.retrievedSources.map((source) => (
                                              <span key={source.chunkId} className="rounded-full border px-2 py-0.5 text-xs text-muted-foreground">
                                                {source.sourceName}
                                              </span>
                                            ))}
                                          </div>
                                        ) : null}
                                      </div>
                                    )) : (
                                  <p className="text-sm text-muted-foreground">当前没有知识问答错误。</p>
                                    )}
                                </div>
                              </div>

                              <div className="space-y-3 rounded-lg border border-rose-100 bg-rose-50 p-4">
                                <div className="flex items-center gap-2">
                                  <span className={`inline-block size-2 rounded-full ${getRiskDotClass(conversation.riskLevel)}`} />
                                  <p className="text-sm font-medium text-rose-700">问题摘要</p>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  <Badge variant={getResultBadgeVariant(conversation.overallStatus)}>
                                    {getOverallStatusLabel(conversation.overallStatus)}
                                  </Badge>
                                  <Badge variant={getResultBadgeVariant(conversation.processStatus)}>
                                    {getProcessStatusLabel(conversation.processStatus)}
                                  </Badge>
                                  <Badge variant={getResultBadgeVariant(conversation.knowledgeStatus)}>
                                    {getKnowledgeStatusLabel(conversation.knowledgeStatus)}
                                  </Badge>
                                </div>
                                <div className="text-sm leading-6 text-zinc-700">
                                  <p>
                                    {`${getRiskLabel(conversation.riskLevel)} · ${conversationScore}分`}
                                  </p>
                                  <p className="mt-2">
                                    {conversation.summary || "当前未生成摘要。"}
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">点击卡片查看对话内容与详细评估。</p>
                        )}
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
