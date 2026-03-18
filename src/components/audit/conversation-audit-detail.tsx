"use client"

import type { ChangeEvent, DragEvent } from "react"
import { useEffect, useMemo, useRef, useState } from "react"
import { Download, FileText, Loader2, Play, RefreshCw, Upload } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { conversationAuditJobsApi } from "@/lib/utils/api-client"
import { streamConversationAuditRun } from "@/lib/utils/sse-client"
import { cn } from "@/lib/utils"
import type {
  ConversationAuditConversation,
  ConversationAuditJob,
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
}

const HISTORY_FILE_ACCEPT = [".xls", ".xlsx"]
const KNOWLEDGE_FILE_ACCEPT = [".doc", ".docx", ".html", ".htm", ".xls", ".xlsx"]

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
    onFilesChange(multiple ? accepted : accepted.slice(0, 1))
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
        role="button"
        tabIndex={0}
        aria-label={title}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors outline-none",
          isDragging
            ? "border-primary bg-primary/5 text-primary"
            : "border-muted-foreground/30 bg-background hover:border-primary/50 hover:bg-muted/30"
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
        <Upload className="size-10 shrink-0" />
        <div className="space-y-1">
          <p className="text-base font-semibold text-foreground">{title}</p>
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

      {files.length > 0 ? (
        <div className="rounded-lg border bg-muted/20 p-3">
          <p className="text-xs font-medium text-muted-foreground">
            {multiple ? `已选择 ${files.length} 个文件` : "已选择文件"}
          </p>
          <div className="mt-2 space-y-2">
            {files.map((file) => (
              <div key={file.name} className="flex items-center gap-2 text-sm">
                <FileText className="size-4 text-muted-foreground" />
                <span className="truncate">{file.name}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  )
}

function getStatusLabel(status: string): string {
  switch (status) {
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

export function ConversationAuditDetail({
  projectId,
  data,
  createMode,
  onCreated,
  onRefresh,
}: ConversationAuditDetailProps) {
  const [name, setName] = useState("历史会话质检")
  const [historyFile, setHistoryFile] = useState<File | null>(null)
  const [knowledgeFiles, setKnowledgeFiles] = useState<File[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [running, setRunning] = useState(false)
  const [showIssuesOnly, setShowIssuesOnly] = useState(false)
  const [localData, setLocalData] = useState<ConversationAuditDetailData | null>(data)
  const [progressText, setProgressText] = useState("")

  useEffect(() => {
    setLocalData(data)
  }, [data])

  const filteredTurns = useMemo(() => {
    const turns = localData?.turns ?? []
    if (!showIssuesOnly) {
      return turns
    }
    return turns.filter((turn) => turn.hasIssue === true)
  }, [localData, showIssuesOnly])

  const conversationLookup = useMemo(() => {
    return new Map((localData?.conversations ?? []).map((conversation) => [conversation.id, conversation]))
  }, [localData])

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

    setRunning(true)
    setProgressText("准备开始...")

    try {
      for await (const event of streamConversationAuditRun(localData.job.id)) {
        switch (event.type) {
          case "audit-start":
            setProgressText(`开始检查，共 ${event.data.totalTurns} 轮`)
            break
          case "audit-turn-start":
            setProgressText(`正在检查第 ${event.data.index + 1} 轮`)
            break
          case "audit-turn-done":
            setProgressText(event.data.hasIssue ? "发现问题轮次" : "本轮检查完成")
            break
          case "audit-complete":
            setProgressText(`检查完成，共发现 ${event.data.issueCount} 个问题轮次`)
            setLocalData(await onRefresh(localData.job.id))
            break
          case "audit-error":
            setProgressText(`运行失败：${event.data.error}`)
            setLocalData(await onRefresh(localData.job.id))
            break
        }
      }
    } catch (error) {
      console.error("Run conversation audit failed:", error)
    } finally {
      setRunning(false)
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

  if (createMode || !localData) {
    return (
      <div className="flex h-full flex-1 overflow-hidden bg-muted/20">
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-6">
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
            <p className="mt-1 text-sm text-muted-foreground">{progressText || "上传完成后可直接运行会话质检"}</p>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setShowIssuesOnly((value) => !value)}>
              {showIssuesOnly ? "显示全部" : "只看问题"}
            </Button>
            <Button variant="outline" onClick={handleRefresh}>
              <RefreshCw className="mr-2 size-4" />
              刷新
            </Button>
            <Button variant="outline" onClick={handleExport}>
              <Download className="mr-2 size-4" />
              导出 Excel
            </Button>
            <Button onClick={handleRun} disabled={running}>
              {running ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Play className="mr-2 size-4" />}
              开始检查
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">知识库文件</p>
              <p className="mt-2 text-2xl font-semibold">{localData.parseSummary.knowledgeFileCount}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">会话数</p>
              <p className="mt-2 text-2xl font-semibold">{localData.parseSummary.conversationCount}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">轮次数</p>
              <p className="mt-2 text-2xl font-semibold">{localData.turns.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">问题轮次</p>
              <p className="mt-2 text-2xl font-semibold">
                {localData.turns.filter((turn) => turn.hasIssue === true).length}
              </p>
            </CardContent>
          </Card>
        </div>

        <Card className="flex min-h-0 flex-1 flex-col">
          <CardHeader>
            <CardTitle>逐轮检查结果</CardTitle>
          </CardHeader>
          <CardContent className="min-h-0 flex-1">
            <ScrollArea className="h-full pr-4">
              <div className="space-y-4">
                {filteredTurns.length === 0 ? (
                  <p className="text-sm text-muted-foreground">当前没有可展示的轮次结果。</p>
                ) : null}

                {filteredTurns.map((turn) => {
                  const conversation = conversationLookup.get(turn.conversationId)

                  return (
                    <Card key={turn.id} className="border border-border/60">
                      <CardContent className="space-y-4 pt-6">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium">
                              会话 {conversation?.externalConversationId ?? turn.conversationId}
                            </p>
                            <p className="text-xs text-muted-foreground">第 {turn.turnIndex + 1} 轮</p>
                          </div>
                          <Badge variant={turn.hasIssue === true ? "destructive" : turn.hasIssue === false ? "default" : "outline"}>
                            {turn.hasIssue === true ? "有问题" : turn.hasIssue === false ? "无问题" : "待检查"}
                          </Badge>
                        </div>

                        <div className="space-y-2">
                          <div>
                            <p className="text-xs font-medium text-muted-foreground">用户问题</p>
                            <p className="mt-1 whitespace-pre-wrap text-sm">{turn.userMessage}</p>
                          </div>
                          <div>
                            <p className="text-xs font-medium text-muted-foreground">Bot 回答</p>
                            <p className="mt-1 whitespace-pre-wrap text-sm">{turn.botReply || "无回复"}</p>
                          </div>
                          <div>
                            <p className="text-xs font-medium text-muted-foreground">原知识库回答</p>
                            <p className="mt-1 whitespace-pre-wrap text-sm">
                              {turn.knowledgeAnswer || "尚未生成"}
                            </p>
                          </div>
                        </div>
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
