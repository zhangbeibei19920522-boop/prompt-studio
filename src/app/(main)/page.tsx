"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { formatDistanceToNow } from "date-fns"
import { zhCN } from "date-fns/locale"
import { useRouter } from "next/navigation"
import {
  BookOpen,
  ChevronLeft,
  FileText,
  FlaskConical,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  Upload,
} from "lucide-react"

import { ConversationAuditDetail } from "@/components/audit/conversation-audit-detail"
import { ChatArea } from "@/components/chat/chat-area"
import { DocumentPreview } from "@/components/knowledge/document-preview"
import { UploadDialog } from "@/components/knowledge/upload-dialog"
import { BatchUploadDialog } from "@/components/prompt/batch-upload-dialog"
import { PromptEditor } from "@/components/prompt/prompt-editor"
import { PromptPreview } from "@/components/prompt/prompt-preview"
import { VersionHistory } from "@/components/prompt/version-history"
import { CreateProjectDialog } from "@/components/project/create-project-dialog"
import { TestSuiteDetail } from "@/components/test/test-suite-detail"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DEFAULT_WORKSPACE_CANVAS_WIDTH,
  WorkspaceCanvas,
  type WorkspaceCanvasTab,
} from "@/components/workspace/workspace-canvas"
import { WorkspaceCommandPalette, type WorkspaceCommandItem } from "@/components/workspace/workspace-command-palette"
import { WorkspaceFrame } from "@/components/workspace/workspace-frame"
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
} from "@/types/database"

type CanvasTabId = "prompt" | "library" | "test" | "audit" | "knowledge" | "settings"
type PromptCanvasMode = "empty" | "preview" | "edit" | "history"
type TestCanvasView = "list" | "detail"
type AuditCanvasView = "list" | "detail"
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
  active = false,
  onClick,
}: {
  icon: React.ReactNode
  tone: "test" | "audit" | "library" | "knowledge"
  title: string
  meta: string
  status: string
  active?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`mb-2 flex w-full items-center gap-3 rounded-lg border px-3.5 py-3 text-left transition-colors ${
        active
          ? "border-zinc-300 bg-zinc-50"
          : "border-zinc-200 bg-white hover:border-zinc-300 hover:bg-zinc-50"
      }`}
    >
      <div className={`grid size-10 place-items-center rounded-lg ${getCanvasIconClass(tone)}`}>
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-zinc-950">{title}</div>
        <div className="mt-1 truncate text-xs text-zinc-500">{meta}</div>
      </div>
      <span className={`rounded-full px-2 py-1 text-[11px] font-medium ${getLibraryBadgeClass(status)}`}>
        {status}
      </span>
    </button>
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

  const [canvasOpen, setCanvasOpen] = useState(false)
  const [activeCanvasTab, setActiveCanvasTab] = useState<CanvasTabId>("prompt")
  const [promptCanvasMode, setPromptCanvasMode] = useState<PromptCanvasMode>("empty")
  const [libraryQuery, setLibraryQuery] = useState("")
  const [libraryFilter, setLibraryFilter] = useState<LibraryFilter>("all")
  const [testCanvasView, setTestCanvasView] = useState<TestCanvasView>("list")
  const [auditCanvasView, setAuditCanvasView] = useState<AuditCanvasView>("list")

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

  const resetProjectScopedState = useCallback(() => {
    setCurrentPrompt(null)
    setPromptCanvasMode("empty")
    setVersions([])
    setCurrentDocument(null)
    setCurrentTestSuiteId(null)
    setCurrentTestCases([])
    setCurrentTestRun(null)
    setTestMode(false)
    setCurrentConversationAuditJobId(null)
    setConversationAuditCreateMode(false)
    setCurrentConversationAuditData(null)
    setTestCanvasView("list")
    setAuditCanvasView("list")
    setCanvasOpen(false)
    setActiveCanvasTab("prompt")
  }, [])

  const openCanvas = useCallback((tab: CanvasTabId) => {
    if (tab === "test") {
      setTestCanvasView("list")
    }
    if (tab === "audit") {
      setAuditCanvasView("list")
    }
    setActiveCanvasTab(tab)
    setCanvasOpen(true)
  }, [])

  const canvasExpanded =
    (activeCanvasTab === "test" && testCanvasView === "detail")
    || (activeCanvasTab === "audit" && auditCanvasView === "detail")

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
        setCanvasOpen(false)
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

  const refreshTestSuites = useCallback(() => {
    if (!currentProjectId) return
    testSuitesApi.listByProject(currentProjectId).then(setTestSuites).catch(console.error)
  }, [currentProjectId])

  const refreshConversationAuditJobs = useCallback(() => {
    if (!currentProjectId) return
    conversationAuditJobsApi.listByProject(currentProjectId).then(setConversationAuditJobs).catch(console.error)
  }, [currentProjectId])

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
      openCanvas("prompt")
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
      openCanvas("prompt")
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
    openCanvas("library")
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
      openCanvas("prompt")
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
      openCanvas("library")
    } catch (error) {
      console.error("Delete prompt failed:", error)
    }
  }

  const handleDocumentClick = async (id: string) => {
    try {
      const document = await documentsApi.get(id)
      setCurrentDocument(document)
      openCanvas("knowledge")
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
      openCanvas("knowledge")
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
        openCanvas("prompt")
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
        openCanvas("prompt")
      })
      .catch(console.error)
  }

  const handleNewTestSuite = () => {
    void handleNewSession({ title: "新建测试集", useTestAgent: true })
    openCanvas("test")
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
      setActiveCanvasTab("test")
      setCanvasOpen(true)
    } catch (error) {
      console.error(error)
    }
  }

  const handleConfirmTestSuite = async (data: TestSuiteGenerationData) => {
    if (!currentProjectId || !currentSessionId) return
    try {
      const suite = await testSuitesApi.create(currentProjectId, {
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
      setActiveCanvasTab("test")
      setCanvasOpen(true)
    } catch (error) {
      console.error("Create test suite failed:", error)
    }
  }

  const handleNewConversationAuditJob = () => {
    setCurrentConversationAuditJobId(null)
    setCurrentConversationAuditData(null)
    setConversationAuditCreateMode(true)
    setAuditCanvasView("detail")
    setActiveCanvasTab("audit")
    setCanvasOpen(true)
  }

  const handleConversationAuditJobClick = async (id: string) => {
    try {
      const data = await conversationAuditJobsApi.get(id)
      setCurrentConversationAuditJobId(id)
      setCurrentConversationAuditData(data)
      setConversationAuditCreateMode(false)
      setAuditCanvasView("detail")
      setActiveCanvasTab("audit")
      setCanvasOpen(true)
    } catch (error) {
      console.error(error)
    }
  }

  const commandActions: WorkspaceCommandItem[] = [
    { id: "new-session", title: "新建对话", description: "创建一个新的对话线程" },
    { id: "new-prompt", title: "新建 Prompt", description: "打开 Prompt canvas 并创建空白资产" },
    { id: "new-test-suite", title: "新建测试集", description: "创建测试生成会话并打开测试 canvas" },
    { id: "new-audit-job", title: "新建质检任务", description: "打开质检 canvas 并开始上传文件" },
    { id: "open-knowledge", title: "知识库", description: "打开知识库 canvas 查看和上传文档" },
    { id: "open-settings", title: "设置", description: "打开设置 canvas 或跳转完整设置页" },
  ]

  const canvasTabs: WorkspaceCanvasTab[] = [
    { id: "prompt", label: "Prompt", icon: <FileText className="size-3.5" /> },
    { id: "library", label: "Prompt 库", icon: <FileText className="size-3.5" /> },
    { id: "test", label: "测试", icon: <FlaskConical className="size-3.5" /> },
    { id: "audit", label: "质检", icon: <ShieldCheck className="size-3.5" /> },
    { id: "knowledge", label: "知识库", icon: <BookOpen className="size-3.5" /> },
    { id: "settings", label: "设置", icon: <Settings2 className="size-3.5" /> },
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
      return (
        <CanvasSection
          title="Prompt"
          action={
            <Button variant="outline" size="sm" onClick={() => void handleCreatePrompt()}>
              <Plus className="size-4" />
              新建 Prompt
            </Button>
          }
        >
          <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-6 text-sm text-zinc-500">
            选择一个 Prompt，或从 Prompt 库中打开现有资产。
          </div>
        </CanvasSection>
      )
    }

    if (promptCanvasMode === "edit") {
      return (
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
      )
    }

    if (promptCanvasMode === "history") {
      return (
        <VersionHistory
          versions={versions}
          currentVersion={currentPrompt.version}
          onRestore={(versionId) => console.log("Restore:", versionId)}
        />
      )
    }

    return (
      <PromptPreview
        prompt={currentPrompt}
        onEdit={() => setPromptCanvasMode("edit")}
        onViewHistory={() => void handleViewHistory(currentPrompt.id)}
        onDelete={() => void handleDeletePrompt(currentPrompt.id)}
      />
    )
  }

  function renderLibraryCanvas() {
    return (
      <div>
        <CanvasDetailHeader
          title="Prompt 库"
          subtitle={`${filteredPrompts.length} 个资产`}
          actions={
            <>
              <Button variant="outline" size="sm" onClick={() => setBatchPromptUploadOpen(true)}>
                批量导入
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
            <CanvasListCard
              key={prompt.id}
              icon={<FileText className="size-4" />}
              tone="library"
              title={prompt.title}
              meta={`v${prompt.version} · ${getPromptStatusLabel(prompt.status)} · ${formatCanvasTimeLabel(prompt.updatedAt)}`}
              status={getPromptStatusLabel(prompt.status)}
              active={currentPrompt?.id === prompt.id}
              onClick={() => void handlePromptClick(prompt.id)}
            />
          ))
        )}
      </div>
    )
  }

  function renderTestCanvasList() {
    return (
      <div>
        <CanvasDetailHeader
          title="测试套件"
          subtitle={`${testSuites.length} 个测试资产`}
          actions={
            <Button variant="outline" size="sm" onClick={handleNewTestSuite}>
              <Plus className="size-4" />
              新建测试集
            </Button>
          }
        />
        {testSuites.length === 0 ? (
          <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-6 text-sm text-zinc-500">
            还没有测试集。你可以先在对话区生成，再在这里查看详情。
          </div>
        ) : (
          testSuites.map((suite) => (
            <CanvasListCard
              key={suite.id}
              icon={<FlaskConical className="size-4" />}
              tone="test"
              title={suite.name}
              meta={getTestSuiteMeta(suite)}
              status={getTestStatusLabel(suite.status)}
              active={currentTestSuiteId === suite.id}
              onClick={() => void handleTestSuiteClick(suite.id)}
            />
          ))
        )}
      </div>
    )
  }

  function renderTestCanvasDetail() {
    if (!currentSuite) {
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
          prompts={prompts.map((prompt) => ({ id: prompt.id, title: prompt.title }))}
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
          actions={
            <Button variant="outline" size="sm" onClick={() => setUploadDialogOpen(true)}>
              <Plus className="size-4" />
              上传文档
            </Button>
          }
        />
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

  function renderCanvasBody() {
    switch (activeCanvasTab) {
      case "prompt":
        return renderPromptCanvas()
      case "library":
        return renderLibraryCanvas()
      case "test":
        return renderTestCanvas()
      case "audit":
        return renderAuditCanvas()
      case "knowledge":
        return renderKnowledgeCanvas()
      case "settings":
        return renderSettingsCanvas()
    }
  }

  return (
    <>
      <WorkspaceFrame
        projectName={currentProject?.name ?? "Prompt Studio"}
        projectSwitcher={projectSwitcher}
        sessions={workspaceSessions}
        onSessionSelect={(id) => {
          setCurrentSessionId(id)
          setTestMode(false)
        }}
        onCreateSession={() => void handleNewSession()}
        onOpenCommandPalette={() => setCommandPaletteOpen(true)}
        onOpenKnowledgeDrawer={() => openCanvas("knowledge")}
        onOpenSettings={() => openCanvas("settings")}
        onToggleSidebar={() => setSidebarCollapsed((value) => !value)}
        sidebarCollapsed={sidebarCollapsed}
      >
        <div
          className={`conversation h-full bg-stone-50 transition-[margin] duration-200 ${canvasExpanded ? "hidden-by-canvas hidden" : ""}`}
          style={{ marginRight: canvasOpen && !canvasExpanded ? `${DEFAULT_WORKSPACE_CANVAS_WIDTH}px` : "0" }}
        >
          <ChatArea
            messages={currentSessionId ? messages : []}
            sessionId={currentSessionId}
            prompts={prompts.map((prompt) => ({ id: prompt.id, title: prompt.title }))}
            documents={documents.map((document) => ({ id: document.id, name: document.name }))}
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
        </div>
      </WorkspaceFrame>

      <WorkspaceCanvas
        open={canvasOpen}
        activeTab={activeCanvasTab}
        tabs={canvasTabs}
        onTabChange={(tabId) => {
          const nextTab = tabId as CanvasTabId
          if (nextTab === "test") {
            setTestCanvasView("list")
          }
          if (nextTab === "audit") {
            setAuditCanvasView("list")
          }
          setActiveCanvasTab(nextTab)
        }}
        onClose={() => setCanvasOpen(false)}
        expanded={canvasExpanded}
        hideOverlay={canvasExpanded}
      >
        {renderCanvasBody()}
      </WorkspaceCanvas>

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
              openCanvas("knowledge")
              return
            case "open-settings":
              openCanvas("settings")
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
    </>
  )
}
