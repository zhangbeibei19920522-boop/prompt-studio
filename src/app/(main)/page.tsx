"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { formatDistanceToNow } from "date-fns"
import { zhCN } from "date-fns/locale"
import { useRouter } from "next/navigation"
import {
  BookOpen,
  Brain,
  ChevronLeft,
  FileText,
  FlaskConical,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  Trash2,
  Upload,
} from "lucide-react"

import { ConversationAuditDetail } from "@/components/audit/conversation-audit-detail"
import { ChatArea } from "@/components/chat/chat-area"
import { KnowledgeAutomationPanel } from "@/components/knowledge-automation/knowledge-automation-panel"
import { DocumentPreview } from "@/components/knowledge/document-preview"
import { UploadDialog } from "@/components/knowledge/upload-dialog"
import { MemoryList } from "@/components/memory/memory-list"
import { BatchUploadDialog } from "@/components/prompt/batch-upload-dialog"
import { PromptEditor } from "@/components/prompt/prompt-editor"
import { PromptPreview } from "@/components/prompt/prompt-preview"
import { VersionHistory } from "@/components/prompt/version-history"
import { CreateProjectDialog } from "@/components/project/create-project-dialog"
import {
  TestSuiteConfigDrawer,
  type TestSuiteConfigSubmitPayload,
} from "@/components/test/test-suite-config-drawer"
import { TestSuiteDetail } from "@/components/test/test-suite-detail"
import { TestSuiteGenerationStatus } from "@/components/test/test-suite-generation-status"
import { TestSuiteRunStatus } from "@/components/test/test-suite-run-status"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { WorkspaceChatDrawer } from "@/components/workspace/workspace-chat-drawer"
import { WorkspaceCommandPalette, type WorkspaceCommandItem } from "@/components/workspace/workspace-command-palette"
import { WorkspaceFrame, type WorkspaceModuleItem } from "@/components/workspace/workspace-frame"
import { historyVersionRows } from "@/components/knowledge-automation/prototype-data"
import { applyPrompt } from "@/lib/utils/sse-client"
import {
  conversationAuditJobsApi,
  documentsApi,
  memoriesApi,
  messagesApi,
  projectsApi,
  promptsApi,
  sessionsApi,
  testCasesApi,
  testSuiteGenerationJobsApi,
  testRunsApi,
  testSuitesApi,
} from "@/lib/utils/api-client"
import type { TestSuiteGenerationData } from "@/types/ai"
import type {
  ConversationAuditConversation,
  ConversationAuditJob,
  ConversationAuditTurn,
  DiffData,
  Document,
  Memory,
  Message,
  PreviewData,
  Project,
  Prompt,
  PromptVersion,
  Session,
  TestCase,
  TestRun,
  TestSuite,
  TestSuiteGenerationJob,
  TestSuiteRunProgress,
} from "@/types/database"

type ModuleId = "home" | "prompt" | "test" | "audit" | "knowledge" | "memory" | "settings"
type PromptCanvasMode = "empty" | "preview" | "edit" | "history"
type TestCanvasView = "list" | "detail"
type TestCanvasSection = "full-flow" | "unit"
type AuditCanvasView = "list" | "detail"
type KnowledgeCanvasView = "documents" | "versions" | "tasks"
type LibraryFilter = "all" | "active" | "draft"

function formatUpdatedLabel(updatedAt: string): string {
  try {
    return formatDistanceToNow(new Date(updatedAt), {
      addSuffix: true,
      locale: zhCN,
    })
  } catch {
    return updatedAt
  }
}

function getPromptStatusLabel(status: string): string {
  switch (status) {
    case "active":
      return "已发布"
    case "archived":
      return "已归档"
    case "draft":
      return "草稿"
    default:
      return status
  }
}

function getTestStatusLabel(status: string): string {
  switch (status) {
    case "completed":
      return "已完成"
    case "ready":
      return "就绪"
    case "running":
      return "运行中"
    case "draft":
      return "草稿"
    default:
      return status
  }
}

function shouldShowGenerationJobStatus(status: TestSuiteGenerationJob["status"]) {
  return status === "queued" || status === "running" || status === "failed"
}

function getAuditStatusLabel(status: string): string {
  switch (status) {
    case "completed":
      return "已完成"
    case "draft":
      return "草稿"
    case "failed":
      return "失败"
    case "parsing":
      return "解析中"
    case "running":
      return "运行中"
    default:
      return status
  }
}

function getTestSectionLabel(section: TestCanvasSection): string {
  return section === "unit" ? "单元测试" : "全流程测试"
}

function getLibraryBadgeClass(status: string): string {
  switch (status) {
    case "active":
    case "completed":
      return "bg-emerald-50 text-emerald-600"
    case "running":
    case "parsing":
      return "bg-blue-50 text-blue-600"
    case "failed":
      return "bg-rose-50 text-rose-600"
    case "draft":
    default:
      return "bg-zinc-100 text-zinc-600"
  }
}

function getCanvasIconClass(tone: "test" | "audit" | "library" | "knowledge"): string {
  switch (tone) {
    case "test":
      return "bg-emerald-100 text-emerald-700"
    case "audit":
      return "bg-blue-100 text-blue-700"
    case "knowledge":
      return "bg-orange-100 text-orange-700"
    case "library":
    default:
      return "bg-violet-100 text-violet-700"
  }
}

function formatCanvasTimeLabel(updatedAt: string, prefix = "更新于"): string {
  return `${prefix} ${formatUpdatedLabel(updatedAt)}`
}

function CanvasSection({
  title,
  action,
  children,
}: {
  title: string
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="mb-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}

function CanvasFilterChip({
  active,
  children,
  onClick,
}: {
  active?: boolean
  children: React.ReactNode
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
        active
          ? "border-zinc-950 bg-zinc-950 text-white"
          : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50"
      }`}
    >
      {children}
    </button>
  )
}

function CanvasListCard({
  icon,
  tone,
  title,
  meta,
  status,
  statusNode,
  actions,
  active = false,
  onClick,
}: {
  icon: React.ReactNode
  tone: "test" | "audit" | "library" | "knowledge"
  title: string
  meta: string
  status: string
  statusNode?: React.ReactNode
  actions?: React.ReactNode
  active?: boolean
  onClick: () => void
}) {
  return (
    <div
      className={`mb-2 flex w-full items-center gap-3 rounded-lg border px-3.5 py-3 text-left transition-colors ${
        active
          ? "border-zinc-300 bg-zinc-50"
          : "border-zinc-200 bg-white hover:border-zinc-300 hover:bg-zinc-50"
      }`}
    >
      <button
        type="button"
        onClick={onClick}
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
      >
        <div className={`grid size-10 place-items-center rounded-lg ${getCanvasIconClass(tone)}`}>
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-zinc-950">{title}</div>
          <div className="mt-1 truncate text-xs text-zinc-500">{meta}</div>
        </div>
      </button>
      <div className="flex items-center gap-2">
        {statusNode ?? (
          <span className={`rounded-full px-2 py-1 text-[11px] font-medium ${getLibraryBadgeClass(status)}`}>
            {status}
          </span>
        )}
        {actions}
      </div>
    </div>
  )
}

function PromptListCard({
  title,
  meta,
  status,
  active = false,
  checked = false,
  onClick,
  onCheckedChange,
  onDelete,
}: {
  title: string
  meta: string
  status: string
  active?: boolean
  checked?: boolean
  onClick: () => void
  onCheckedChange: (checked: boolean) => void
  onDelete: () => void
}) {
  return (
    <div
      className={`mb-2 flex items-center gap-3 rounded-lg border px-3.5 py-3 transition-colors ${
        active ? "border-zinc-300 bg-zinc-50" : "border-zinc-200 bg-white"
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onCheckedChange(event.target.checked)}
        aria-label={`选择 Prompt ${title}`}
        className="size-4 rounded border-zinc-300 text-zinc-950 focus:ring-zinc-950"
      />
      <button
        type="button"
        onClick={onClick}
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
      >
        <div className={`grid size-10 place-items-center rounded-lg ${getCanvasIconClass("library")}`}>
          <FileText className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-zinc-950">{title}</div>
          <div className="mt-1 truncate text-xs text-zinc-500">{meta}</div>
        </div>
      </button>
      <span className={`rounded-full px-2 py-1 text-[11px] font-medium ${getLibraryBadgeClass(status)}`}>{status}</span>
      <Button type="button" variant="ghost" size="icon-sm" onClick={onDelete} aria-label={`删除 Prompt ${title}`}>
        <Trash2 className="size-4 text-zinc-500" />
      </Button>
    </div>
  )
}

function CanvasMetricCard({
  value,
  label,
  tone = "default",
}: {
  value: string
  label: string
  tone?: "default" | "success" | "info" | "warning" | "danger"
}) {
  const toneClass = {
    default: "text-zinc-950",
    success: "text-emerald-600",
    info: "text-blue-600",
    warning: "text-orange-500",
    danger: "text-rose-600",
  }[tone]

  return (
    <div className="rounded-lg border border-zinc-200 bg-white px-4 py-3 text-center">
      <div className={`text-2xl font-semibold ${toneClass}`}>{value}</div>
      <div className="mt-1 text-xs text-zinc-500">{label}</div>
    </div>
  )
}

function CanvasBackButton({
  children,
  onClick,
}: {
  children: React.ReactNode
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mb-4 inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-950"
    >
      <ChevronLeft className="size-4" />
      {children}
    </button>
  )
}

function CanvasDetailHeader({
  title,
  subtitle,
  actions,
}: {
  title: string
  subtitle: string
  actions?: React.ReactNode
}) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div>
        <div className="text-lg font-semibold text-zinc-950">{title}</div>
        <div className="mt-1 text-xs text-zinc-500">{subtitle}</div>
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  )
}

function CanvasField({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="space-y-1">
      <div className="text-xs font-medium text-zinc-600">{label}</div>
      <input
        value={value}
        readOnly
        className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700"
      />
    </div>
  )
}

function CanvasTextField({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="space-y-1">
      <div className="text-xs font-medium text-zinc-600">{label}</div>
      <textarea
        value={value}
        readOnly
        className="min-h-[84px] w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm leading-6 text-zinc-700"
      />
    </div>
  )
}

export default function MainPage() {
  const router = useRouter()

  const [projects, setProjects] = useState<Project[]>([])
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null)
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  const [prompts, setPrompts] = useState<Prompt[]>([])
  const [documents, setDocuments] = useState<Document[]>([])
  const [sessions, setSessions] = useState<Session[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [versions, setVersions] = useState<PromptVersion[]>([])
  const [projectMemories, setProjectMemories] = useState<Memory[]>([])

  const [testSuites, setTestSuites] = useState<TestSuite[]>([])
  const [testSuiteGenerationJobs, setTestSuiteGenerationJobs] = useState<TestSuiteGenerationJob[]>([])
  const [runningTestSuiteProgress, setRunningTestSuiteProgress] = useState<TestSuiteRunProgress[]>([])
  const [currentTestSuiteId, setCurrentTestSuiteId] = useState<string | null>(null)
  const [currentTestCases, setCurrentTestCases] = useState<TestCase[]>([])
  const [currentTestRun, setCurrentTestRun] = useState<TestRun | null>(null)
  const [testMode, setTestMode] = useState(false)

  const [conversationAuditJobs, setConversationAuditJobs] = useState<ConversationAuditJob[]>([])
  const [currentConversationAuditJobId, setCurrentConversationAuditJobId] = useState<string | null>(null)
  const [conversationAuditCreateMode, setConversationAuditCreateMode] = useState(false)
  const [currentConversationAuditData, setCurrentConversationAuditData] = useState<{
    job: ConversationAuditJob
    parseSummary: ConversationAuditJob["parseSummary"]
    conversations: ConversationAuditConversation[]
    turns: ConversationAuditTurn[]
  } | null>(null)

  const [chatDrawerOpen, setChatDrawerOpen] = useState(false)
  const [activeModuleId, setActiveModuleId] = useState<ModuleId>("home")
  const [promptCanvasMode, setPromptCanvasMode] = useState<PromptCanvasMode>("empty")
  const [libraryQuery, setLibraryQuery] = useState("")
  const [libraryFilter, setLibraryFilter] = useState<LibraryFilter>("all")
  const [selectedPromptIds, setSelectedPromptIds] = useState<string[]>([])
  const [promptIdsPendingDelete, setPromptIdsPendingDelete] = useState<string[]>([])
  const [promptDeleteDialogOpen, setPromptDeleteDialogOpen] = useState(false)
  const [deletingPrompts, setDeletingPrompts] = useState(false)
  const [testSuiteIdPendingDelete, setTestSuiteIdPendingDelete] = useState<string | null>(null)
  const [testSuiteDeleteDialogOpen, setTestSuiteDeleteDialogOpen] = useState(false)
  const [deletingTestSuite, setDeletingTestSuite] = useState(false)
  const [testCanvasView, setTestCanvasView] = useState<TestCanvasView>("list")
  const [testCanvasSection, setTestCanvasSection] = useState<TestCanvasSection>("full-flow")
  const [testSuiteConfigDrawerOpen, setTestSuiteConfigDrawerOpen] = useState(false)
  const [auditCanvasView, setAuditCanvasView] = useState<AuditCanvasView>("list")
  const [knowledgeCanvasView, setKnowledgeCanvasView] = useState<KnowledgeCanvasView>("documents")

  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)
  const [createProjectOpen, setCreateProjectOpen] = useState(false)
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false)
  const [batchPromptUploadOpen, setBatchPromptUploadOpen] = useState(false)

  const [currentPrompt, setCurrentPrompt] = useState<Prompt | null>(null)
  const [currentDocument, setCurrentDocument] = useState<Document | null>(null)

  const prevSessionIdRef = useRef<string | null>(null)
  const [memoryBadgeCount, setMemoryBadgeCount] = useState(0)

  const currentProject = projects.find((project) => project.id === currentProjectId) ?? null
  const currentSuite = testSuites.find((suite) => suite.id === currentTestSuiteId) ?? null
  const visibleTestSuites = useMemo(
    () =>
      testSuites.filter(
        (suite) => (suite.section ?? "full-flow") === testCanvasSection
      ),
    [testCanvasSection, testSuites]
  )
  const generationJobsBySuiteId = useMemo(() => {
    const nextMap = new Map<string, TestSuiteGenerationJob>()
    for (const job of testSuiteGenerationJobs) {
      if (!shouldShowGenerationJobStatus(job.status)) continue
      if (!nextMap.has(job.suiteId)) {
        nextMap.set(job.suiteId, job)
      }
    }
    return nextMap
  }, [testSuiteGenerationJobs])
  const hasActiveTestSuiteGenerationJob = testSuiteGenerationJobs.some(
    (job) => job.status === "queued" || job.status === "running"
  )
  const runningTestSuiteProgressBySuiteId = useMemo(() => {
    const nextMap = new Map<string, TestSuiteRunProgress>()
    for (const progress of runningTestSuiteProgress) {
      nextMap.set(progress.suiteId, progress)
    }
    return nextMap
  }, [runningTestSuiteProgress])
  const hasActiveTestSuiteRun =
    runningTestSuiteProgress.length > 0 || testSuites.some((suite) => suite.status === "running")
  const indexVersionOptions = historyVersionRows
    .filter((row) => row.indexVersionId !== "待生成")
    .map((row) => ({
      id: row.indexVersionId,
      title: `${row.indexVersionId} · ${row.knowledgeVersionId}`,
    }))
  const filteredPrompts = prompts.filter((prompt) => {
    const matchesQuery =
      libraryQuery.trim().length === 0
      || prompt.title.toLowerCase().includes(libraryQuery.trim().toLowerCase())
      || prompt.description.toLowerCase().includes(libraryQuery.trim().toLowerCase())

    const matchesFilter =
      libraryFilter === "all"
      || (libraryFilter === "active" && prompt.status === "active")
      || (libraryFilter === "draft" && prompt.status === "draft")

    return matchesQuery && matchesFilter
  })
  const allVisiblePromptsSelected =
    filteredPrompts.length > 0 && filteredPrompts.every((prompt) => selectedPromptIds.includes(prompt.id))

  const resetProjectScopedState = useCallback(() => {
    setCurrentPrompt(null)
    setPromptCanvasMode("empty")
    setVersions([])
    setCurrentDocument(null)
    setTestSuiteGenerationJobs([])
    setRunningTestSuiteProgress([])
    setCurrentTestSuiteId(null)
    setCurrentTestCases([])
    setCurrentTestRun(null)
    setTestMode(false)
    setCurrentConversationAuditJobId(null)
    setConversationAuditCreateMode(false)
    setCurrentConversationAuditData(null)
    setTestCanvasView("list")
    setTestCanvasSection("full-flow")
    setTestSuiteConfigDrawerOpen(false)
    setAuditCanvasView("list")
    setKnowledgeCanvasView("documents")
    setChatDrawerOpen(false)
    setActiveModuleId("home")
  }, [])

  const openModule = useCallback((tab: Exclude<ModuleId, "home">) => {
    if (tab === "test") {
      setTestCanvasView("list")
      setTestCanvasSection("full-flow")
    }
    if (tab === "audit") {
      setAuditCanvasView("list")
    }
    setActiveModuleId(tab)
  }, [])

  useEffect(() => {
    projectsApi
      .list()
      .then((data) => {
        setProjects(data)
        if (data.length > 0) {
          setCurrentProjectId((prev) => prev ?? data[0].id)
        }
      })
      .catch(console.error)
  }, [])

  const refreshProjectMemories = useCallback(() => {
    if (!currentProjectId) return
    memoriesApi.listByProject(currentProjectId).then(setProjectMemories).catch(console.error)
  }, [currentProjectId])

  useEffect(() => {
    if (!currentProjectId) return

    promptsApi.listByProject(currentProjectId).then(setPrompts).catch(console.error)
    documentsApi.listByProject(currentProjectId).then(setDocuments).catch(console.error)
    memoriesApi.listByProject(currentProjectId).then(setProjectMemories).catch(console.error)
    sessionsApi
      .listByProject(currentProjectId)
      .then((data) => {
        setSessions(data)
        setCurrentSessionId(data[0]?.id ?? null)
      })
      .catch(console.error)
    testSuitesApi.listByProject(currentProjectId).then(setTestSuites).catch(console.error)
    testSuiteGenerationJobsApi.listByProject(currentProjectId).then(setTestSuiteGenerationJobs).catch(console.error)
    conversationAuditJobsApi.listByProject(currentProjectId).then(setConversationAuditJobs).catch(console.error)
  }, [currentProjectId])

  useEffect(() => {
    const prevId = prevSessionIdRef.current
    prevSessionIdRef.current = currentSessionId

    if (prevId && prevId !== currentSessionId) {
      fetch("/api/ai/extract-memories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: prevId }),
      })
        .then((res) => res.json())
        .then((json) => {
          if (json.success && json.data?.actions) {
            const newCount = json.data.actions.filter(
              (action: { action: string }) => action.action === "insert" || action.action === "update"
            ).length
            if (newCount > 0) {
              setMemoryBadgeCount(newCount)
              refreshProjectMemories()
            }
          }
        })
        .catch(console.error)
    }
  }, [currentSessionId, refreshProjectMemories])

  useEffect(() => {
    if (!currentSessionId) return
    messagesApi.listBySession(currentSessionId).then(setMessages).catch(console.error)
  }, [currentSessionId])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault()
        setCommandPaletteOpen((open) => !open)
      }
      if (event.key === "Escape") {
        setChatDrawerOpen(false)
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  const refreshMessages = useCallback(() => {
    if (!currentSessionId) return
    messagesApi.listBySession(currentSessionId).then(setMessages).catch(console.error)
  }, [currentSessionId])

  const refreshPrompts = useCallback(() => {
    if (!currentProjectId) return
    promptsApi.listByProject(currentProjectId).then(setPrompts).catch(console.error)
  }, [currentProjectId])

  useEffect(() => {
    setSelectedPromptIds((prev) => prev.filter((id) => prompts.some((prompt) => prompt.id === id)))
  }, [prompts])

  const refreshTestSuites = useCallback(() => {
    if (!currentProjectId) return
    testSuitesApi.listByProject(currentProjectId).then(setTestSuites).catch(console.error)
  }, [currentProjectId])

  const refreshTestSuiteGenerationJobs = useCallback(() => {
    if (!currentProjectId) return
    testSuiteGenerationJobsApi.listByProject(currentProjectId).then(setTestSuiteGenerationJobs).catch(console.error)
  }, [currentProjectId])

  const refreshRunningTestSuiteProgress = useCallback(() => {
    if (!currentProjectId) return
    testRunsApi.listRunningByProject(currentProjectId).then(setRunningTestSuiteProgress).catch(console.error)
  }, [currentProjectId])

  useEffect(() => {
    if (activeModuleId !== "test" || !currentProjectId) return

    refreshTestSuites()
    refreshTestSuiteGenerationJobs()
    refreshRunningTestSuiteProgress()
  }, [
    activeModuleId,
    currentProjectId,
    refreshTestSuites,
    refreshTestSuiteGenerationJobs,
    refreshRunningTestSuiteProgress,
  ])

  const refreshConversationAuditJobs = useCallback(() => {
    if (!currentProjectId) return
    conversationAuditJobsApi.listByProject(currentProjectId).then(setConversationAuditJobs).catch(console.error)
  }, [currentProjectId])

  useEffect(() => {
    if (!currentProjectId || (!hasActiveTestSuiteGenerationJob && !hasActiveTestSuiteRun)) return

    const timer = window.setInterval(() => {
      refreshTestSuites()
      refreshTestSuiteGenerationJobs()
      refreshRunningTestSuiteProgress()
    }, 1200)

    return () => window.clearInterval(timer)
  }, [
    currentProjectId,
    hasActiveTestSuiteGenerationJob,
    hasActiveTestSuiteRun,
    refreshTestSuiteGenerationJobs,
    refreshTestSuites,
    refreshRunningTestSuiteProgress,
  ])

  const handleCreateProject = async (data: Omit<Project, "id" | "createdAt" | "updatedAt">) => {
    try {
      const created = await projectsApi.create(data)
      setProjects((prev) => [...prev, created])
      resetProjectScopedState()
      setCurrentProjectId(created.id)
      setCreateProjectOpen(false)
    } catch (error) {
      console.error("Create project failed:", error)
    }
  }

  const handleNewSession = async (options?: { title?: string; useTestAgent?: boolean }) => {
    if (!currentProjectId) return
    try {
      const session = await sessionsApi.create(currentProjectId, options?.title)
      setSessions((prev) => [session, ...prev])
      setCurrentSessionId(session.id)
      setTestMode(options?.useTestAgent ?? false)
    } catch (error) {
      console.error("Create session failed:", error)
    }
  }

  const handlePromptClick = async (id: string) => {
    try {
      const prompt = await promptsApi.get(id)
      setCurrentPrompt(prompt)
      setPromptCanvasMode("preview")
      openModule("prompt")
    } catch (error) {
      console.error(error)
    }
  }

  const handleCreatePrompt = async () => {
    if (!currentProjectId) return
    try {
      const created = await promptsApi.create(currentProjectId, {
        title: "新建 Prompt",
        content: "",
        description: "",
        tags: [],
        variables: [],
        status: "draft",
      })
      refreshPrompts()
      const prompt = await promptsApi.get(created.id)
      setCurrentPrompt(prompt)
      setPromptCanvasMode("edit")
      openModule("prompt")
    } catch (error) {
      console.error("Create prompt failed:", error)
    }
  }

  const handleBatchPromptUpload = async (items: Array<{ title: string; content: string }>) => {
    if (!currentProjectId) return
    for (const item of items) {
      try {
        await promptsApi.create(currentProjectId, {
          title: item.title,
          content: item.content,
          description: "",
          tags: [],
          variables: [],
          status: "draft",
        })
      } catch (error) {
        console.error("Batch create prompt failed:", error)
      }
    }
    refreshPrompts()
    setCurrentPrompt(null)
    setPromptCanvasMode("empty")
    openModule("prompt")
  }

  const handleViewHistory = async (promptId: string) => {
    try {
      const [prompt, versionData] = await Promise.all([
        currentPrompt?.id === promptId ? Promise.resolve(currentPrompt) : promptsApi.get(promptId),
        promptsApi.versions(promptId),
      ])
      setCurrentPrompt(prompt)
      setVersions(versionData)
      setPromptCanvasMode("history")
      openModule("prompt")
    } catch (error) {
      console.error(error)
    }
  }

  const handleDeletePrompt = async (id: string) => {
    try {
      await promptsApi.delete(id)
      refreshPrompts()
      if (currentPrompt?.id === id) {
        setCurrentPrompt(null)
        setVersions([])
        setPromptCanvasMode("empty")
      }
      openModule("prompt")
    } catch (error) {
      console.error("Delete prompt failed:", error)
    }
  }

  const handleRequestDeletePrompts = (ids: string[]) => {
    if (ids.length === 0) return
    setPromptIdsPendingDelete(ids)
    setPromptDeleteDialogOpen(true)
  }

  const handleConfirmDeletePrompts = async () => {
    if (!currentProjectId || promptIdsPendingDelete.length === 0) return

    setDeletingPrompts(true)
    try {
      await Promise.all(promptIdsPendingDelete.map((id) => promptsApi.delete(id)))
      const nextPrompts = await promptsApi.listByProject(currentProjectId)
      setPrompts(nextPrompts)
      setSelectedPromptIds((prev) => prev.filter((id) => !promptIdsPendingDelete.includes(id)))
      if (currentPrompt && promptIdsPendingDelete.includes(currentPrompt.id)) {
        setCurrentPrompt(null)
        setVersions([])
        setPromptCanvasMode("empty")
      }
      openModule("prompt")
      setPromptDeleteDialogOpen(false)
      setPromptIdsPendingDelete([])
    } catch (error) {
      console.error("Delete prompts failed:", error)
    } finally {
      setDeletingPrompts(false)
    }
  }

  const handleDocumentClick = async (id: string) => {
    try {
      const document = await documentsApi.get(id)
      setCurrentDocument(document)
      openModule("knowledge")
    } catch (error) {
      console.error(error)
    }
  }

  const handleDeleteDocument = async (id: string) => {
    try {
      await documentsApi.delete(id)
      if (currentProjectId) {
        const nextDocuments = await documentsApi.listByProject(currentProjectId)
        setDocuments(nextDocuments)
      }
      if (currentDocument?.id === id) {
        setCurrentDocument(null)
      }
    } catch (error) {
      console.error("Delete document failed:", error)
    }
  }

  const handleUpload = async (files: File[]) => {
    if (!currentProjectId) return
    try {
      await documentsApi.upload(currentProjectId, files)
      const nextDocuments = await documentsApi.listByProject(currentProjectId)
      setDocuments(nextDocuments)
      if (nextDocuments[0]) {
        const detail = await documentsApi.get(nextDocuments[0].id)
        setCurrentDocument(detail)
      }
      setKnowledgeCanvasView("documents")
      openModule("knowledge")
    } catch (error) {
      console.error("Upload failed:", error)
    }
    setUploadDialogOpen(false)
  }

  const handleApplyPreview = async (data: PreviewData) => {
    if (!currentProjectId || !currentSessionId) return
    try {
      await applyPrompt({
        action: "create",
        projectId: currentProjectId,
        title: data.title,
        content: data.content,
        description: data.description ?? "",
        tags: data.tags ?? [],
        variables: data.variables ?? [],
        changeNote: "Agent 生成",
        sessionId: currentSessionId,
      })
      refreshPrompts()
    } catch (error) {
      console.error("Apply preview failed:", error)
    }
  }

  const handleApplyDiff = async (data: DiffData) => {
    if (!currentSessionId) return
    try {
      let resolvedPromptId = data.promptId
      const directMatch = prompts.find((prompt) => prompt.id === data.promptId)
      if (!directMatch) {
        const titleMatch = prompts.find(
          (prompt) => prompt.title === data.promptId || prompt.title === data.title
        )
        if (titleMatch) {
          resolvedPromptId = titleMatch.id
        }
      }

      await applyPrompt({
        action: "update",
        promptId: resolvedPromptId,
        projectId: currentProjectId ?? "",
        title: data.title,
        content: data.newContent,
        description: "",
        tags: [],
        variables: [],
        changeNote: "Agent 修改",
        sessionId: currentSessionId,
      })
      refreshPrompts()
    } catch (error) {
      console.error("Apply diff failed:", error)
    }
  }

  const handleEditInPanel = (data: PreviewData | DiffData) => {
    const content = "newContent" in data ? data.newContent : data.content
    const description = "description" in data ? (data.description ?? "") : ""

    if ("promptId" in data && data.promptId) {
      const existing = prompts.find((prompt) => prompt.id === data.promptId)
      if (existing) {
        setCurrentPrompt({ ...existing, content, title: data.title })
        setPromptCanvasMode("edit")
        openModule("prompt")
        return
      }
    }

    if (!currentProjectId) return

    promptsApi
      .create(currentProjectId, {
        title: data.title,
        content,
        description,
        tags: "tags" in data ? (data.tags ?? []) : [],
        variables: "variables" in data ? (data.variables ?? []) : [],
        status: "draft",
      })
      .then(async (created) => {
        refreshPrompts()
        const prompt = await promptsApi.get(created.id)
        setCurrentPrompt(prompt)
        setPromptCanvasMode("edit")
        openModule("prompt")
      })
      .catch(console.error)
  }

  const handleNewTestSuite = () => {
    setCurrentTestSuiteId(null)
    setCurrentTestCases([])
    setCurrentTestRun(null)
    setTestCanvasView("list")
    setActiveModuleId("test")
    setTestSuiteConfigDrawerOpen(true)
  }

  const handleCreateConfiguredTestSuite = async (data: TestSuiteConfigSubmitPayload) => {
    if (!currentProjectId) return

    try {
      const generated = await testSuitesApi.generateConfigured(currentProjectId, data)
      setTestSuites((current) => [
        generated.suite,
        ...current.filter((suite) => suite.id !== generated.suite.id),
      ])
      setTestSuiteGenerationJobs((current) => [
        generated.job,
        ...current.filter((job) => job.id !== generated.job.id),
      ])
      setCurrentTestSuiteId(generated.suite.id)
      setCurrentTestCases([])
      setCurrentTestRun(null)
      setTestMode(false)
      setTestCanvasView("list")
      setActiveModuleId("test")
      setTestSuiteConfigDrawerOpen(false)
    } catch (error) {
      console.error("Create configured test suite failed:", error)
      alert(`生成测试集失败: ${error instanceof Error ? error.message : "未知错误"}`)
    }
  }

  const handleTestSuiteClick = async (id: string) => {
    try {
      const data = await testSuitesApi.get(id)
      setCurrentTestSuiteId(id)
      setCurrentTestCases(data.cases)
      setTestMode(false)
      const runs = await testRunsApi.listBySuite(id)
      setCurrentTestRun(runs[0] ?? null)
      setTestCanvasView("detail")
      setActiveModuleId("test")
    } catch (error) {
      console.error(error)
    }
  }

  const handleRequestDeleteTestSuite = (id: string) => {
    setTestSuiteIdPendingDelete(id)
    setTestSuiteDeleteDialogOpen(true)
  }

  const handleConfirmDeleteTestSuite = async () => {
    if (!currentProjectId || !testSuiteIdPendingDelete) return

    setDeletingTestSuite(true)
    try {
      await testSuitesApi.delete(testSuiteIdPendingDelete)
      const [nextSuites, nextJobs, nextRunningProgress] = await Promise.all([
        testSuitesApi.listByProject(currentProjectId),
        testSuiteGenerationJobsApi.listByProject(currentProjectId),
        testRunsApi.listRunningByProject(currentProjectId),
      ])
      setTestSuites(nextSuites)
      setTestSuiteGenerationJobs(nextJobs)
      setRunningTestSuiteProgress(nextRunningProgress)

      if (currentTestSuiteId === testSuiteIdPendingDelete) {
        setCurrentTestSuiteId(null)
        setCurrentTestCases([])
        setCurrentTestRun(null)
        setTestCanvasView("list")
      }

      setTestSuiteDeleteDialogOpen(false)
      setTestSuiteIdPendingDelete(null)
    } catch (error) {
      console.error("Delete test suite failed:", error)
    } finally {
      setDeletingTestSuite(false)
    }
  }

  const handleConfirmTestSuite = async (data: TestSuiteGenerationData) => {
    if (!currentProjectId || !currentSessionId) return
    try {
      const suite = await testSuitesApi.create(currentProjectId, {
        section: testCanvasSection,
        name: data.name,
        description: data.description,
        sessionId: currentSessionId,
        workflowMode: data.workflowMode,
        routingConfig: data.routingConfig,
      })
      await testCasesApi.createBatch(suite.id, data.cases)

      const [updatedSuites, suiteDetail, runs] = await Promise.all([
        testSuitesApi.listByProject(currentProjectId),
        testSuitesApi.get(suite.id),
        testRunsApi.listBySuite(suite.id),
      ])

      setTestSuites(updatedSuites)
      setCurrentTestSuiteId(suite.id)
      setCurrentTestCases(suiteDetail.cases)
      setCurrentTestRun(runs[0] ?? null)
      setTestMode(false)
      setTestCanvasView("detail")
      setActiveModuleId("test")
    } catch (error) {
      console.error("Create test suite failed:", error)
    }
  }

  const handleNewConversationAuditJob = () => {
    setCurrentConversationAuditJobId(null)
    setCurrentConversationAuditData(null)
    setConversationAuditCreateMode(true)
    setAuditCanvasView("detail")
    setActiveModuleId("audit")
  }

  const handleConversationAuditJobClick = async (id: string) => {
    try {
      const data = await conversationAuditJobsApi.get(id)
      setCurrentConversationAuditJobId(id)
      setCurrentConversationAuditData(data)
      setConversationAuditCreateMode(false)
      setAuditCanvasView("detail")
      setActiveModuleId("audit")
    } catch (error) {
      console.error(error)
    }
  }

  const commandActions: WorkspaceCommandItem[] = [
    { id: "new-session", title: "新建对话", description: "创建一个新的对话线程" },
    { id: "new-prompt", title: "新建 Prompt", description: "打开 Prompt 模块并创建空白资产" },
    { id: "new-test-suite", title: "新建测试集", description: "打开右侧抽屉并配置测试集" },
    { id: "new-audit-job", title: "新建质检任务", description: "打开质检模块并开始上传文件" },
    { id: "open-knowledge", title: "知识库", description: "打开知识库模块查看和上传文档" },
    { id: "open-memory", title: "记忆", description: "打开当前项目的记忆管理" },
    { id: "open-settings", title: "设置", description: "打开设置模块或跳转完整设置页" },
  ]

  const workspaceModules: WorkspaceModuleItem[] = [
    {
      id: "prompt",
      label: "Prompt",
      description: "Prompt 列表和编辑",
      icon: <FileText className="size-4" />,
      active: activeModuleId === "prompt",
    },
    {
      id: "test",
      label: "自动化测试",
      description: "测试集和运行报告",
      icon: <FlaskConical className="size-4" />,
      active: activeModuleId === "test",
      children: [
        { id: "full-flow", label: "全流程测试", active: activeModuleId === "test" && testCanvasSection === "full-flow" },
        { id: "unit", label: "单元测试", active: activeModuleId === "test" && testCanvasSection === "unit" },
      ],
    },
    {
      id: "audit",
      label: "会话质检",
      description: "历史对话和知识校验",
      icon: <ShieldCheck className="size-4" />,
      active: activeModuleId === "audit",
    },
    {
      id: "knowledge",
      label: "知识库",
      description: "文档、版本和任务",
      icon: <BookOpen className="size-4" />,
      active: activeModuleId === "knowledge",
      children: [
        { id: "documents", label: "文档库", active: activeModuleId === "knowledge" && knowledgeCanvasView === "documents" },
        { id: "tasks", label: "清洗任务", active: activeModuleId === "knowledge" && knowledgeCanvasView === "tasks" },
        { id: "versions", label: "版本管理", active: activeModuleId === "knowledge" && knowledgeCanvasView === "versions" },
      ],
    },
    {
      id: "memory",
      label: "记忆",
      description:
        memoryBadgeCount > 0
          ? `${projectMemories.length} 条，新增 ${memoryBadgeCount} 条`
          : `${projectMemories.length} 条项目记忆`,
      icon: <Brain className="size-4" />,
      active: activeModuleId === "memory",
    },
    {
      id: "settings",
      label: "设置",
      description: "模型和业务信息",
      icon: <Settings2 className="size-4" />,
      active: activeModuleId === "settings",
    },
  ]

  const workspaceSessions = sessions.map((session) => ({
    id: session.id,
    title: session.title,
    updatedLabel: formatUpdatedLabel(session.updatedAt),
    active: session.id === currentSessionId,
  }))

  const projectSwitcher = (
    <div className="flex items-center gap-2">
      <Select
        value={currentProjectId ?? undefined}
        onValueChange={(value) => {
          resetProjectScopedState()
          setCurrentProjectId(value)
        }}
      >
        <SelectTrigger className="h-8 min-w-[180px] rounded-md border-zinc-200 bg-white shadow-none">
          <SelectValue placeholder="选择项目" />
        </SelectTrigger>
        <SelectContent>
          {projects.map((project) => (
            <SelectItem key={project.id} value={project.id}>
              {project.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setCreateProjectOpen(true)}
        className="h-8 rounded-md px-2"
      >
        <Plus className="size-4" />
      </Button>
    </div>
  )

  function getWorkflowLabel(mode: TestSuite["workflowMode"]) {
    return mode === "routing" ? "路由模式" : "单 Prompt"
  }

  function getTestSuiteMeta(suite: TestSuite) {
    const description = suite.description.trim()
    if (description) {
      return description
    }
    return `${getWorkflowLabel(suite.workflowMode)} · ${formatCanvasTimeLabel(suite.updatedAt)}`
  }

  function getTestMetricCards() {
    const report = currentTestRun?.report
    const totalCases = report?.totalCases ?? currentTestCases.length
    const passedCases = report?.passedCases ?? currentTestRun?.results.filter((item) => item.passed).length ?? 0
    const score = currentTestRun?.score ?? report?.score ?? null
    const intentResults = currentTestRun?.results.filter((result) => result.intentPassed !== null && result.intentPassed !== undefined) ?? []
    const passedIntentCount = intentResults.filter((result) => result.intentPassed).length
    const intentRate =
      intentResults.length > 0 ? `${Math.round((passedIntentCount / intentResults.length) * 100)}%` : "暂无"

    return [
      {
        label: "总评分",
        value: score !== null ? `${score}` : "未运行",
        tone: score !== null && score >= 80 ? "success" : "default",
      },
      {
        label: "通过率",
        value: totalCases > 0 ? `${passedCases}/${totalCases}` : "0/0",
        tone: totalCases > 0 && passedCases === totalCases ? "success" : "default",
      },
      {
        label: "意图匹配",
        value: intentRate,
        tone: intentRate === "暂无" ? "default" : "info",
      },
      {
        label: "最近更新",
        value: formatUpdatedLabel(currentSuite?.updatedAt ?? new Date().toISOString()),
        tone: "default",
      },
      {
        label: "工作流",
        value: currentSuite ? getWorkflowLabel(currentSuite.workflowMode) : "未选择",
        tone: "default",
      },
      {
        label: "状态",
        value: currentSuite ? getTestStatusLabel(currentSuite.status) : "草稿",
        tone: currentSuite?.status === "completed" ? "success" : currentSuite?.status === "running" ? "info" : "default",
      },
    ] as const
  }

  function getAuditMetricCards() {
    if (!currentConversationAuditData) {
      return [
        { label: "整体通过率", value: "0%", tone: "default" },
        { label: "流程合规率", value: "0%", tone: "default" },
        { label: "知识准确率", value: "0%", tone: "default" },
        { label: "高风险对话", value: "0", tone: "default" },
      ] as const
    }

    const conversations = currentConversationAuditData.conversations
    const total = conversations.length || 1
    const overallPassed = conversations.filter((item) => item.overallStatus === "passed").length
    const processPassed = conversations.filter((item) => item.processStatus === "passed").length
    const knowledgePassed = conversations.filter((item) => item.knowledgeStatus === "passed").length
    const highRisk = conversations.filter((item) => item.riskLevel === "high").length

    return [
      { label: "整体通过率", value: `${Math.round((overallPassed / total) * 100)}%`, tone: "success" },
      { label: "流程合规率", value: `${Math.round((processPassed / total) * 100)}%`, tone: "info" },
      { label: "知识准确率", value: `${Math.round((knowledgePassed / total) * 100)}%`, tone: "warning" },
      { label: "高风险对话", value: `${highRisk}`, tone: highRisk > 0 ? "danger" : "success" },
    ] as const
  }

  function renderPromptCanvas() {
    if (!currentPrompt) {
      return renderPromptListCanvas()
    }

    if (promptCanvasMode === "edit") {
      return (
        <>
          <CanvasBackButton onClick={showPromptList}>返回 Prompt 列表</CanvasBackButton>
          <PromptEditor
            prompt={currentPrompt}
            onSave={async (data) => {
              await promptsApi.update(currentPrompt.id, data)
              refreshPrompts()
              const updated = await promptsApi.get(currentPrompt.id)
              setCurrentPrompt(updated)
              setPromptCanvasMode("preview")
            }}
            onCancel={() => setPromptCanvasMode("preview")}
          />
        </>
      )
    }

    if (promptCanvasMode === "history") {
      return (
        <>
          <CanvasBackButton onClick={showPromptList}>返回 Prompt 列表</CanvasBackButton>
          <VersionHistory
            versions={versions}
            currentVersion={currentPrompt.version}
            onRestore={(versionId) => console.log("Restore:", versionId)}
          />
        </>
      )
    }

    return (
      <>
        <CanvasBackButton onClick={showPromptList}>返回 Prompt 列表</CanvasBackButton>
        <PromptPreview
          prompt={currentPrompt}
          onEdit={() => setPromptCanvasMode("edit")}
          onViewHistory={() => void handleViewHistory(currentPrompt.id)}
          onDelete={() => void handleDeletePrompt(currentPrompt.id)}
        />
      </>
    )
  }

  function renderPromptListCanvas() {
    return (
      <div>
        <CanvasDetailHeader
          title="Prompt"
          subtitle={`${filteredPrompts.length} 个资产`}
          actions={
            <>
              <Button variant="outline" size="sm" onClick={() => setBatchPromptUploadOpen(true)}>
                批量导入
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={filteredPrompts.length === 0}
                onClick={() =>
                  setSelectedPromptIds((prev) =>
                    allVisiblePromptsSelected
                      ? prev.filter((id) => !filteredPrompts.some((prompt) => prompt.id === id))
                      : Array.from(new Set([...prev, ...filteredPrompts.map((prompt) => prompt.id)]))
                  )
                }
              >
                {allVisiblePromptsSelected ? "取消全选" : "全选"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={selectedPromptIds.length === 0}
                onClick={() => handleRequestDeletePrompts(selectedPromptIds)}
              >
                <Trash2 className="size-4" />
                批量删除
              </Button>
              <Button variant="outline" size="sm" onClick={() => void handleCreatePrompt()}>
                <Plus className="size-4" />
                新建
              </Button>
            </>
          }
        />

        <div className="mb-4 flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2">
          <Search className="size-4 text-zinc-400" />
          <input
            value={libraryQuery}
            onChange={(event) => setLibraryQuery(event.target.value)}
            placeholder="搜索 Prompt 标题或说明..."
            className="w-full bg-transparent text-sm outline-none placeholder:text-zinc-400"
          />
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          <CanvasFilterChip active={libraryFilter === "all"} onClick={() => setLibraryFilter("all")}>
            全部
          </CanvasFilterChip>
          <CanvasFilterChip active={libraryFilter === "active"} onClick={() => setLibraryFilter("active")}>
            已发布
          </CanvasFilterChip>
          <CanvasFilterChip active={libraryFilter === "draft"} onClick={() => setLibraryFilter("draft")}>
            草稿
          </CanvasFilterChip>
        </div>

        {filteredPrompts.length === 0 ? (
          <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-6 text-sm text-zinc-500">
            当前筛选条件下没有 Prompt。
          </div>
        ) : (
          filteredPrompts.map((prompt) => (
            <PromptListCard
              key={prompt.id}
              title={prompt.title}
              meta={`v${prompt.version} · ${getPromptStatusLabel(prompt.status)} · ${formatCanvasTimeLabel(prompt.updatedAt)}`}
              status={getPromptStatusLabel(prompt.status)}
              active={currentPrompt?.id === prompt.id}
              checked={selectedPromptIds.includes(prompt.id)}
              onClick={() => void handlePromptClick(prompt.id)}
              onCheckedChange={(checked) =>
                setSelectedPromptIds((prev) =>
                  checked ? Array.from(new Set([...prev, prompt.id])) : prev.filter((id) => id !== prompt.id)
                )
              }
              onDelete={() => handleRequestDeletePrompts([prompt.id])}
            />
          ))
        )}
      </div>
    )
  }

  function showPromptList() {
    setCurrentPrompt(null)
    setPromptCanvasMode("empty")
    setVersions([])
  }

  const promptDeleteTargets = prompts.filter((prompt) => promptIdsPendingDelete.includes(prompt.id))
  const promptDeleteDescription =
    promptIdsPendingDelete.length === 1
      ? `确定要删除 Prompt「${promptDeleteTargets[0]?.title ?? ""}」吗？此操作无法撤销。`
      : `确定要删除已选中的 ${promptIdsPendingDelete.length} 个 Prompt 吗？此操作无法撤销。`
  const testSuitePendingDelete =
    testSuiteIdPendingDelete
      ? testSuites.find((suite) => suite.id === testSuiteIdPendingDelete) ?? null
      : null
  const testSuiteDeleteDescription = `确定要删除测试集「${testSuitePendingDelete?.name ?? ""}」吗？此操作无法撤销。`

  function renderTestCanvasList() {
    return (
      <div>
        <CanvasDetailHeader
          title={getTestSectionLabel(testCanvasSection)}
          subtitle={`${visibleTestSuites.length} 个测试资产`}
          actions={
            <Button variant="outline" size="sm" onClick={handleNewTestSuite}>
              <Plus className="size-4" />
              新建测试集
            </Button>
          }
        />
        {visibleTestSuites.length === 0 ? (
          <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-6 text-sm text-zinc-500">
            还没有测试集。点击右上角新建测试集后，在右侧抽屉里完成配置。
          </div>
        ) : (
          visibleTestSuites.map((suite) => (
            <CanvasListCard
              key={suite.id}
              icon={<FlaskConical className="size-4" />}
              tone="test"
              title={suite.name}
              meta={getTestSuiteMeta(suite)}
              status={getTestStatusLabel(suite.status)}
              statusNode={
                generationJobsBySuiteId.has(suite.id) ? (
                  <TestSuiteGenerationStatus job={generationJobsBySuiteId.get(suite.id)!} />
                ) : runningTestSuiteProgressBySuiteId.has(suite.id) ? (
                  <TestSuiteRunStatus progress={runningTestSuiteProgressBySuiteId.get(suite.id)!} />
                ) : undefined
              }
              active={currentTestSuiteId === suite.id}
              actions={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => handleRequestDeleteTestSuite(suite.id)}
                  aria-label={`删除测试集 ${suite.name}`}
                >
                  <Trash2 className="size-4 text-zinc-500" />
                </Button>
              }
              onClick={() => void handleTestSuiteClick(suite.id)}
            />
          ))
        )}
      </div>
    )
  }

  function renderTestCanvasDetail() {
    if (!currentSuite || (currentSuite.section ?? "full-flow") !== testCanvasSection) {
      return renderTestCanvasList()
    }

    return (
      <>
        <CanvasBackButton onClick={() => setTestCanvasView("list")}>返回列表</CanvasBackButton>
        <CanvasDetailHeader
          title={currentSuite.name}
          subtitle={`${currentTestCases.length} 个用例 · ${getWorkflowLabel(currentSuite.workflowMode)}`}
        />
        <div className="mb-5 grid gap-3 md:grid-cols-3">
          {getTestMetricCards().map((metric) => (
            <CanvasMetricCard
              key={metric.label}
              value={metric.value}
              label={metric.label}
              tone={metric.tone}
            />
          ))}
        </div>
        <TestSuiteDetail
          suite={currentSuite}
          cases={currentTestCases}
          latestRun={currentTestRun}
          prompts={prompts.map((prompt) => ({ id: prompt.id, title: prompt.title, content: prompt.content }))}
          indexVersions={indexVersionOptions}
          onSuiteUpdate={() => {
            refreshTestSuites()
            if (currentTestSuiteId) {
              testSuitesApi.get(currentTestSuiteId).then((data) => {
                setCurrentTestCases(data.cases)
              }).catch(console.error)
              testRunsApi.listBySuite(currentTestSuiteId).then((runs) => {
                setCurrentTestRun(runs[0] ?? null)
              }).catch(console.error)
            }
          }}
          onCaseUpdate={() => {
            if (currentTestSuiteId) {
              testCasesApi.listBySuite(currentTestSuiteId).then(setCurrentTestCases).catch(console.error)
            }
          }}
        />
      </>
    )
  }

  function renderTestCanvas() {
    return testCanvasView === "detail" ? renderTestCanvasDetail() : renderTestCanvasList()
  }

  function renderAuditCanvasList() {
    return (
      <div>
        <CanvasDetailHeader
          title="质检任务"
          subtitle={`${conversationAuditJobs.length} 个质检任务`}
          actions={
            <Button variant="outline" size="sm" onClick={handleNewConversationAuditJob}>
              <Plus className="size-4" />
              新建质检任务
            </Button>
          }
        />
        {conversationAuditJobs.length === 0 ? (
          <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-6 text-sm text-zinc-500">
            还没有质检任务。
          </div>
        ) : (
          conversationAuditJobs.map((job) => (
            <CanvasListCard
              key={job.id}
              icon={<ShieldCheck className="size-4" />}
              tone="audit"
              title={job.name}
              meta={`${job.parseSummary.conversationCount} 段对话 · ${formatCanvasTimeLabel(job.completedAt ?? job.updatedAt, job.completedAt ? "完成于" : "更新于")}`}
              status={getAuditStatusLabel(job.status)}
              active={currentConversationAuditJobId === job.id}
              onClick={() => void handleConversationAuditJobClick(job.id)}
            />
          ))
        )}
      </div>
    )
  }

  function renderAuditCanvasDetail() {
    if (!currentProjectId || (!conversationAuditCreateMode && !currentConversationAuditData)) {
      return renderAuditCanvasList()
    }

    return (
      <>
        <CanvasBackButton onClick={() => setAuditCanvasView("list")}>返回列表</CanvasBackButton>
        <CanvasDetailHeader
          title={conversationAuditCreateMode ? "新建质检任务" : (currentConversationAuditData?.job.name ?? "质检任务")}
          subtitle={
            conversationAuditCreateMode
              ? "上传历史对话和知识文件后开始质检"
              : `${currentConversationAuditData?.parseSummary.conversationCount ?? 0} 段对话 · ${formatCanvasTimeLabel(currentConversationAuditData?.job.completedAt ?? currentConversationAuditData?.job.updatedAt ?? new Date().toISOString(), currentConversationAuditData?.job.completedAt ? "完成于" : "更新于")}`
          }
        />
        {!conversationAuditCreateMode && (
          <div className="mb-5 grid gap-3 md:grid-cols-2">
            {getAuditMetricCards().map((metric) => (
              <CanvasMetricCard
                key={metric.label}
                value={metric.value}
                label={metric.label}
                tone={metric.tone}
              />
            ))}
          </div>
        )}
        <ConversationAuditDetail
          projectId={currentProjectId}
          data={currentConversationAuditData}
          createMode={conversationAuditCreateMode}
          onCreated={async (jobId) => {
            refreshConversationAuditJobs()
            setConversationAuditCreateMode(false)
            setCurrentConversationAuditJobId(jobId)
            const detail = await conversationAuditJobsApi.get(jobId)
            setCurrentConversationAuditData(detail)
            setAuditCanvasView("detail")
          }}
          onRefresh={async (jobId) => {
            refreshConversationAuditJobs()
            const detail = await conversationAuditJobsApi.get(jobId)
            setCurrentConversationAuditData((current) => (current?.job.id === jobId ? detail : current))
            return detail
          }}
          onDeleted={async () => {
            refreshConversationAuditJobs()
            setCurrentConversationAuditJobId(null)
            setCurrentConversationAuditData(null)
            setConversationAuditCreateMode(false)
            setAuditCanvasView("list")
          }}
        />
      </>
    )
  }

  function renderAuditCanvas() {
    return auditCanvasView === "detail" ? renderAuditCanvasDetail() : renderAuditCanvasList()
  }

  function renderKnowledgeCanvas() {
    return (
      <>
        <CanvasDetailHeader
          title="知识库"
          subtitle={`${documents.length} 份文档`}
        />

        {knowledgeCanvasView === "documents" ? (
          <>
            <button
              type="button"
              onClick={() => setUploadDialogOpen(true)}
              className="mb-4 flex w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-zinc-200 bg-zinc-50 px-6 py-8 text-center text-zinc-500 transition-colors hover:border-blue-300 hover:bg-blue-50"
            >
              <Upload className="mb-2 size-7" />
              <span className="text-sm font-medium text-zinc-700">拖拽文件到此处，或点击上传</span>
              <span className="mt-1 text-xs text-zinc-500">支持 PDF、Word、TXT、Markdown</span>
            </button>
            <CanvasSection title={`已上传文档 (${documents.length})`}>
              {documents.length === 0 ? (
                <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-6 text-sm text-zinc-500">
                  还没有知识文档。
                </div>
              ) : (
                documents.map((document) => (
                  <CanvasListCard
                    key={document.id}
                    icon={<BookOpen className="size-4" />}
                    tone="knowledge"
                    title={document.name}
                    meta={`${document.type.toUpperCase()} · ${formatCanvasTimeLabel(document.createdAt, "上传于")}`}
                    status={document.type.toUpperCase()}
                    active={currentDocument?.id === document.id}
                    onClick={() => void handleDocumentClick(document.id)}
                  />
                ))
              )}
            </CanvasSection>

            {currentDocument && (
              <CanvasSection title="文档预览">
                <div className="rounded-lg border border-zinc-200">
                  <DocumentPreview
                    document={currentDocument}
                    onDelete={() => void handleDeleteDocument(currentDocument.id)}
                  />
                </div>
              </CanvasSection>
            )}
          </>
        ) : knowledgeCanvasView === "versions" ? (
          <KnowledgeAutomationPanel
            key={knowledgeCanvasView}
            projectId={currentProject?.id ?? null}
            projectName={currentProject?.name ?? "当前项目"}
            section="versions"
            documents={documents.map((document) => ({
              id: document.id,
              name: document.name,
              type: document.type,
            }))}
          />
        ) : (
          <KnowledgeAutomationPanel
            key={knowledgeCanvasView}
            projectId={currentProject?.id ?? null}
            projectName={currentProject?.name ?? "当前项目"}
            section="tasks"
            documents={documents.map((document) => ({
              id: document.id,
              name: document.name,
              type: document.type,
            }))}
          />
        )}
      </>
    )
  }

  function renderMemoryCanvas() {
    return (
      <div>
        <CanvasDetailHeader
          title="记忆"
          subtitle={`${projectMemories.length} 条项目记忆`}
          actions={
            <Button variant="outline" size="sm" onClick={() => router.push("/settings")}>
              全局记忆
            </Button>
          }
        />
        {!currentProjectId ? (
          <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-6 text-sm text-zinc-500">
            请选择一个项目后管理记忆。
          </div>
        ) : (
          <MemoryList
            memories={projectMemories}
            scope="project"
            onAdd={async (data) => {
              await memoriesApi.createForProject(currentProjectId, data)
              refreshProjectMemories()
              setMemoryBadgeCount(0)
            }}
            onEdit={async (id, data) => {
              await memoriesApi.update(id, data)
              refreshProjectMemories()
            }}
            onDelete={async (id) => {
              await memoriesApi.delete(id)
              refreshProjectMemories()
              setMemoryBadgeCount(0)
            }}
            onPromote={async (id) => {
              await memoriesApi.promote(id)
              refreshProjectMemories()
            }}
          />
        )}
      </div>
    )
  }

  function renderSettingsCanvas() {
    return (
      <div>
        <CanvasDetailHeader
          title="设置"
          subtitle={currentProject?.name ?? "未选择项目"}
          actions={
            <Button variant="outline" size="sm" onClick={() => router.push("/settings")}>
              打开完整设置页
            </Button>
          }
        />
        <section className="mb-6">
          <div className="mb-3 border-b border-zinc-200 pb-2 text-sm font-semibold text-zinc-950">
            AI 模型配置
          </div>
          <div className="space-y-3">
            <CanvasField label="Provider" value="OpenAI" />
            <CanvasField label="Model" value="gpt-4o" />
            <CanvasField label="API Key" value="sk-xxxxxxxxxxxxx" />
            <CanvasField label="Base URL (可选)" value="https://api.openai.com/v1" />
          </div>
        </section>
        <section className="space-y-3">
          <div className="border-b border-zinc-200 pb-2 text-sm font-semibold text-zinc-950">
            全局业务信息
          </div>
          <CanvasTextField
            label="业务描述"
            value={currentProject?.businessDescription || "我们是一家综合电商平台，使用 AI 辅助客服完成回复。"}
          />
          <CanvasTextField
            label="业务目标"
            value={currentProject?.businessGoal || "提升客服回复质量和一致性，减少人工介入率。"}
          />
          <CanvasTextField
            label="业务背景"
            value={
              currentProject?.businessBackground
              || `当前项目包含 ${prompts.length} 个 Prompt、${testSuites.length} 个测试集、${conversationAuditJobs.length} 个质检任务，项目记忆 ${projectMemories.length} 条${memoryBadgeCount > 0 ? `，最近新增 ${memoryBadgeCount} 条信号。` : "。"}`
            }
          />
        </section>
      </div>
    )
  }

  function renderHomeModule() {
    return (
      <div className="flex min-h-full items-center justify-center">
        <div className="max-w-xl rounded-lg border border-dashed border-zinc-300 bg-white px-8 py-10 text-center shadow-sm">
          <div className="mx-auto mb-4 grid size-12 place-items-center rounded-md bg-zinc-100">
            <Search className="size-6 text-zinc-500" />
          </div>
          <h2 className="text-xl font-semibold text-zinc-950">从左侧选择一个功能开始。</h2>
          <p className="mt-3 text-sm leading-6 text-zinc-600">
            Prompt、测试、质检和知识库现在作为主工作台展示；需要协助时，点击右上角打开 Agent 对话。
          </p>
        </div>
      </div>
    )
  }

  function renderModuleBody() {
    switch (activeModuleId) {
      case "home":
        return renderHomeModule()
      case "prompt":
        return renderPromptCanvas()
      case "test":
        return renderTestCanvas()
      case "audit":
        return renderAuditCanvas()
      case "knowledge":
        return renderKnowledgeCanvas()
      case "memory":
        return renderMemoryCanvas()
      case "settings":
        return renderSettingsCanvas()
    }
  }

  function handleModuleSelect(id: string) {
    const nextModule = id as ModuleId
    if (nextModule === "prompt") {
      showPromptList()
    }
    if (nextModule === "test") {
      setTestCanvasView("list")
      setTestCanvasSection("full-flow")
    }
    if (nextModule === "audit") {
      setAuditCanvasView("list")
    }
    if (nextModule === "memory") {
      setMemoryBadgeCount(0)
    }
    if (nextModule !== "test") {
      setTestSuiteConfigDrawerOpen(false)
    }
    setActiveModuleId(nextModule)
  }

  function handleModuleChildSelect(moduleId: string, childId: string) {
    if (moduleId === "test") {
      setActiveModuleId("test")
      setTestCanvasSection(childId as TestCanvasSection)
      setTestCanvasView("list")
      setCurrentTestSuiteId(null)
      setCurrentTestCases([])
      setCurrentTestRun(null)
      setTestSuiteConfigDrawerOpen(false)
      return
    }
    if (moduleId === "knowledge") {
      setActiveModuleId("knowledge")
      setKnowledgeCanvasView(childId as KnowledgeCanvasView)
    }
  }

  return (
    <>
      <WorkspaceFrame
        projectName={currentProject?.name ?? "Prompt Studio"}
        projectSwitcher={projectSwitcher}
        modules={workspaceModules}
        onModuleSelect={handleModuleSelect}
        onModuleChildSelect={handleModuleChildSelect}
        onOpenCommandPalette={() => setCommandPaletteOpen(true)}
        onOpenChatDrawer={() => setChatDrawerOpen(true)}
        onToggleSidebar={() => setSidebarCollapsed((value) => !value)}
        sidebarCollapsed={sidebarCollapsed}
      >
        <div className="h-full overflow-y-auto bg-stone-50 p-5">{renderModuleBody()}</div>
      </WorkspaceFrame>

      <WorkspaceChatDrawer
        open={chatDrawerOpen}
        sessions={workspaceSessions}
        onClose={() => setChatDrawerOpen(false)}
        onCreateSession={() => void handleNewSession()}
        onSessionSelect={(id) => {
          setCurrentSessionId(id)
          setTestMode(false)
        }}
      >
        <ChatArea
          messages={currentSessionId ? messages : []}
          sessionId={currentSessionId}
          prompts={prompts.map((prompt) => ({ id: prompt.id, title: prompt.title, content: prompt.content }))}
          documents={documents.map((document) => ({ id: document.id, name: document.name }))}
          indexVersions={indexVersionOptions}
          onMessagesChange={refreshMessages}
          onApplyPreview={handleApplyPreview}
          onApplyDiff={handleApplyDiff}
          onEditInPanel={handleEditInPanel}
          onViewHistory={(promptId) => {
            const byId = prompts.find((prompt) => prompt.id === promptId)
            const resolved = byId ?? prompts.find((prompt) => prompt.title === promptId)
            if (resolved) {
              void handleViewHistory(resolved.id)
            }
          }}
          onNewSession={() => void handleNewSession({ useTestAgent: testMode })}
          onMemoryCommand={(data) => {
            if (data.command === "create" || data.command === "delete") {
              refreshProjectMemories()
            }
          }}
          onConfirmTestSuite={handleConfirmTestSuite}
          onSessionTitleUpdate={(sessionId, title) => {
            setSessions((prev) =>
              prev.map((session) => (session.id === sessionId ? { ...session, title } : session))
            )
          }}
          useTestAgent={testMode}
        />
      </WorkspaceChatDrawer>

      <WorkspaceCommandPalette
        open={commandPaletteOpen}
        onOpenChange={setCommandPaletteOpen}
        actions={commandActions}
        prompts={prompts.map((prompt) => ({
          id: prompt.id,
          title: prompt.title,
          description: `v${prompt.version} · ${getPromptStatusLabel(prompt.status)}`,
        }))}
        testSuites={testSuites.map((suite) => ({
          id: suite.id,
          title: suite.name,
          description: suite.description || getTestStatusLabel(suite.status),
        }))}
        audits={conversationAuditJobs.map((job) => ({
          id: job.id,
          title: job.name,
          description: getAuditStatusLabel(job.status),
        }))}
        documents={documents.map((document) => ({
          id: document.id,
          title: document.name,
          description: document.type.toUpperCase(),
        }))}
        onActionSelect={(id) => {
          setCommandPaletteOpen(false)
          switch (id) {
            case "new-session":
              void handleNewSession()
              setChatDrawerOpen(true)
              return
            case "new-prompt":
              void handleCreatePrompt()
              return
            case "new-test-suite":
              handleNewTestSuite()
              return
            case "new-audit-job":
              handleNewConversationAuditJob()
              return
            case "open-knowledge":
              openModule("knowledge")
              return
            case "open-memory":
              openModule("memory")
              setMemoryBadgeCount(0)
              return
            case "open-settings":
              openModule("settings")
          }
        }}
        onPromptSelect={(id) => {
          setCommandPaletteOpen(false)
          void handlePromptClick(id)
        }}
        onTestSuiteSelect={(id) => {
          setCommandPaletteOpen(false)
          void handleTestSuiteClick(id)
        }}
        onAuditSelect={(id) => {
          setCommandPaletteOpen(false)
          void handleConversationAuditJobClick(id)
        }}
        onDocumentSelect={(id) => {
          setCommandPaletteOpen(false)
          void handleDocumentClick(id)
        }}
      />

      {testSuiteConfigDrawerOpen ? (
        <TestSuiteConfigDrawer
          open={testSuiteConfigDrawerOpen}
          section={testCanvasSection}
          prompts={prompts.map((prompt) => ({ id: prompt.id, title: prompt.title, content: prompt.content }))}
          documents={documents.map((document) => ({ id: document.id, name: document.name }))}
          indexVersions={indexVersionOptions}
          onClose={() => setTestSuiteConfigDrawerOpen(false)}
          onSubmit={(payload) => void handleCreateConfiguredTestSuite(payload)}
        />
      ) : null}

      <CreateProjectDialog
        open={createProjectOpen}
        onOpenChange={setCreateProjectOpen}
        onSubmit={handleCreateProject}
      />
      <UploadDialog
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
        onUpload={handleUpload}
      />
      <BatchUploadDialog
        open={batchPromptUploadOpen}
        onOpenChange={setBatchPromptUploadOpen}
        onUpload={handleBatchPromptUpload}
      />
      <Dialog
        open={promptDeleteDialogOpen}
        onOpenChange={(open) => {
          setPromptDeleteDialogOpen(open)
          if (!open && !deletingPrompts) {
            setPromptIdsPendingDelete([])
          }
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
            <DialogDescription>{promptDeleteDescription}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setPromptDeleteDialogOpen(false)
                setPromptIdsPendingDelete([])
              }}
              disabled={deletingPrompts}
            >
              取消
            </Button>
            <Button variant="destructive" onClick={() => void handleConfirmDeletePrompts()} disabled={deletingPrompts}>
              <Trash2 className="size-4" />
              删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={testSuiteDeleteDialogOpen}
        onOpenChange={(open) => {
          setTestSuiteDeleteDialogOpen(open)
          if (!open && !deletingTestSuite) {
            setTestSuiteIdPendingDelete(null)
          }
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
            <DialogDescription>{testSuiteDeleteDescription}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setTestSuiteDeleteDialogOpen(false)
                setTestSuiteIdPendingDelete(null)
              }}
              disabled={deletingTestSuite}
            >
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={() => void handleConfirmDeleteTestSuite()}
              disabled={deletingTestSuite}
            >
              <Trash2 className="size-4" />
              删除测试集
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
