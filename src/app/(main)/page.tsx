"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { TopBar } from "@/components/layout/top-bar"
import { Sidebar } from "@/components/layout/sidebar"
import { RightPanel } from "@/components/layout/right-panel"
import { ChatArea } from "@/components/chat/chat-area"
import { TestSuiteDetail } from "@/components/test/test-suite-detail"
import { CreateProjectDialog } from "@/components/project/create-project-dialog"
import { ProjectSettings } from "@/components/project/project-settings"
import { PromptPreview } from "@/components/prompt/prompt-preview"
import { PromptEditor } from "@/components/prompt/prompt-editor"
import { VersionHistory } from "@/components/prompt/version-history"
import { DocumentPreview } from "@/components/knowledge/document-preview"
import { UploadDialog } from "@/components/knowledge/upload-dialog"
import { BatchUploadDialog } from "@/components/prompt/batch-upload-dialog"
import {
  projectsApi,
  promptsApi,
  documentsApi,
  sessionsApi,
  messagesApi,
  memoriesApi,
  testSuitesApi,
  testCasesApi,
  testRunsApi,
} from "@/lib/utils/api-client"
import type { Project, Prompt, Document, Session, Message, Memory, PromptVersion, PreviewData, DiffData, TestSuite, TestCase, TestRun } from "@/types/database"
import type { TestSuiteGenerationData } from "@/types/ai"
import { applyPrompt } from "@/lib/utils/sse-client"

type RightPanelView =
  | { type: "prompt-preview"; id: string }
  | { type: "prompt-edit"; id: string }
  | { type: "prompt-history"; id: string }
  | { type: "document-preview"; id: string }
  | { type: "project-settings" }
  | null

export default function MainPage() {
  const router = useRouter()

  // Core state
  const [projects, setProjects] = useState<Project[]>([])
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null)
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
  const [rightPanelView, setRightPanelView] = useState<RightPanelView>(null)

  // Data
  const [prompts, setPrompts] = useState<Prompt[]>([])
  const [documents, setDocuments] = useState<Document[]>([])
  const [sessions, setSessions] = useState<Session[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [versions, setVersions] = useState<PromptVersion[]>([])
  const [projectMemories, setProjectMemories] = useState<Memory[]>([])

  // Test state
  const [testSuites, setTestSuites] = useState<TestSuite[]>([])
  const [currentTestSuiteId, setCurrentTestSuiteId] = useState<string | null>(null)
  const [currentTestCases, setCurrentTestCases] = useState<TestCase[]>([])
  const [currentTestRun, setCurrentTestRun] = useState<TestRun | null>(null)
  const [testMode, setTestMode] = useState(false)

  // Memory extraction tracking
  const prevSessionIdRef = useRef<string | null>(null)
  const [memoryBadgeCount, setMemoryBadgeCount] = useState(0)

  // Dialogs
  const [createProjectOpen, setCreateProjectOpen] = useState(false)
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false)
  const [batchPromptUploadOpen, setBatchPromptUploadOpen] = useState(false)

  // Current items for panel
  const [currentPrompt, setCurrentPrompt] = useState<Prompt | null>(null)
  const [currentDocument, setCurrentDocument] = useState<Document | null>(null)
  const currentProject = projects.find((p) => p.id === currentProjectId) ?? null
  const currentSuite = testSuites.find((s) => s.id === currentTestSuiteId) ?? null

  // Load projects on mount
  useEffect(() => {
    projectsApi.list().then((data) => {
      setProjects(data)
      if (data.length > 0 && !currentProjectId) {
        setCurrentProjectId(data[0].id)
      }
    }).catch(console.error)
  }, [])

  const refreshProjectMemories = useCallback(() => {
    if (!currentProjectId) return
    memoriesApi.listByProject(currentProjectId).then(setProjectMemories).catch(console.error)
  }, [currentProjectId])

  // Load project data when project changes
  useEffect(() => {
    if (!currentProjectId) return
    promptsApi.listByProject(currentProjectId).then(setPrompts).catch(console.error)
    documentsApi.listByProject(currentProjectId).then(setDocuments).catch(console.error)
    memoriesApi.listByProject(currentProjectId).then(setProjectMemories).catch(console.error)
    sessionsApi.listByProject(currentProjectId).then((data) => {
      setSessions(data)
      if (data.length > 0) setCurrentSessionId(data[0].id)
      else setCurrentSessionId(null)
    }).catch(console.error)
    testSuitesApi.listByProject(currentProjectId).then(setTestSuites).catch(console.error)
  }, [currentProjectId])

  // Trigger memory extraction when switching sessions
  useEffect(() => {
    const prevId = prevSessionIdRef.current
    prevSessionIdRef.current = currentSessionId

    if (prevId && prevId !== currentSessionId) {
      // Fire-and-forget extraction for previous session
      fetch('/api/ai/extract-memories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: prevId }),
      })
        .then((res) => res.json())
        .then((json) => {
          if (json.success && json.data?.actions) {
            const newCount = json.data.actions.filter(
              (a: { action: string }) => a.action === 'insert' || a.action === 'update'
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

  // Load messages when session changes
  useEffect(() => {
    if (!currentSessionId) {
      setMessages([])
      return
    }
    messagesApi.listBySession(currentSessionId).then(setMessages).catch(console.error)
  }, [currentSessionId])

  const refreshMessages = useCallback(() => {
    if (!currentSessionId) return
    messagesApi.listBySession(currentSessionId).then(setMessages).catch(console.error)
  }, [currentSessionId])

  const refreshPrompts = useCallback(() => {
    if (!currentProjectId) return
    promptsApi.listByProject(currentProjectId).then(setPrompts).catch(console.error)
  }, [currentProjectId])

  // Project actions
  const handleCreateProject = async (data: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      const created = await projectsApi.create(data)
      setProjects((prev) => [...prev, created])
      setCurrentProjectId(created.id)
      setCreateProjectOpen(false)
    } catch (e) {
      console.error("Create project failed:", e)
    }
  }

  const handleNewSession = async () => {
    if (!currentProjectId) return
    try {
      const session = await sessionsApi.create(currentProjectId)
      setSessions((prev) => [session, ...prev])
      setCurrentSessionId(session.id)
    } catch (e) {
      console.error("Create session failed:", e)
    }
  }

  // Panel handlers
  const handlePromptClick = async (id: string) => {
    try {
      const prompt = await promptsApi.get(id)
      setCurrentPrompt(prompt)
      setRightPanelView({ type: "prompt-preview", id })
    } catch (e) {
      console.error(e)
    }
  }

  const handleDocumentClick = async (id: string) => {
    try {
      const doc = await documentsApi.get(id)
      setCurrentDocument(doc)
      setRightPanelView({ type: "document-preview", id })
    } catch (e) {
      console.error(e)
    }
  }

  const handleViewHistory = async (promptId: string) => {
    try {
      const v = await promptsApi.versions(promptId)
      setVersions(v)
      setRightPanelView({ type: "prompt-history", id: promptId })
    } catch (e) {
      console.error(e)
    }
  }

  const handleUpload = async (files: File[]) => {
    if (!currentProjectId) return
    try {
      await documentsApi.upload(currentProjectId, files)
    } catch (e) {
      console.error("Upload failed:", e)
    }
    documentsApi.listByProject(currentProjectId).then(setDocuments).catch(console.error)
    setUploadDialogOpen(false)
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
      setRightPanelView({ type: "prompt-edit", id: created.id })
    } catch (e) {
      console.error("Create prompt failed:", e)
    }
  }

  const handleBatchPromptUpload = async (
    items: Array<{ title: string; content: string }>
  ) => {
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
      } catch (e) {
        console.error("Batch create prompt failed:", e)
      }
    }
    refreshPrompts()
  }

  const handleDeletePrompt = async (id: string) => {
    try {
      await promptsApi.delete(id)
      refreshPrompts()
      // Close right panel if the deleted prompt is currently open
      if (
        rightPanelView &&
        (rightPanelView.type === "prompt-preview" ||
          rightPanelView.type === "prompt-edit" ||
          rightPanelView.type === "prompt-history") &&
        rightPanelView.id === id
      ) {
        setRightPanelView(null)
      }
    } catch (e) {
      console.error("Delete prompt failed:", e)
    }
  }

  const handleDeleteDocument = async (id: string) => {
    try {
      await documentsApi.delete(id)
      if (currentProjectId) {
        documentsApi.listByProject(currentProjectId).then(setDocuments).catch(console.error)
      }
      // Close right panel if the deleted document is currently open
      if (
        rightPanelView &&
        rightPanelView.type === "document-preview" &&
        rightPanelView.id === id
      ) {
        setRightPanelView(null)
      }
    } catch (e) {
      console.error("Delete document failed:", e)
    }
  }

  // Agent action handlers
  const handleApplyPreview = async (data: PreviewData) => {
    if (!currentProjectId || !currentSessionId) return
    try {
      await applyPrompt({
        action: 'create',
        projectId: currentProjectId,
        title: data.title,
        content: data.content,
        description: data.description ?? '',
        tags: data.tags ?? [],
        variables: data.variables ?? [],
        changeNote: 'Agent 生成',
        sessionId: currentSessionId,
      })
      refreshPrompts()
    } catch (e) {
      console.error('Apply preview failed:', e)
    }
  }

  const handleApplyDiff = async (data: DiffData) => {
    if (!currentSessionId) return
    try {
      // Try to find prompt by ID first; if not found, fallback to find by title
      let resolvedPromptId = data.promptId
      const directMatch = prompts.find((p) => p.id === data.promptId)
      if (!directMatch) {
        const titleMatch = prompts.find(
          (p) => p.title === data.promptId || p.title === data.title
        )
        if (titleMatch) {
          resolvedPromptId = titleMatch.id
        }
      }

      await applyPrompt({
        action: 'update',
        promptId: resolvedPromptId,
        projectId: currentProjectId ?? '',
        title: data.title,
        content: data.newContent,
        description: '',
        tags: [],
        variables: [],
        changeNote: 'Agent 修改',
        sessionId: currentSessionId,
      })
      refreshPrompts()
    } catch (e) {
      console.error('Apply diff failed:', e)
    }
  }

  const handleEditInPanel = (data: PreviewData | DiffData) => {
    const content = 'newContent' in data ? data.newContent : data.content
    const description = 'description' in data ? (data.description ?? '') : ''

    // Find existing prompt or create temp one for editing
    if ('promptId' in data && data.promptId) {
      const existing = prompts.find((p) => p.id === data.promptId)
      if (existing) {
        setCurrentPrompt({ ...existing, content, title: data.title })
        setRightPanelView({ type: 'prompt-edit', id: existing.id })
        return
      }
    }

    // For new prompts, create one first then open editor
    if (currentProjectId) {
      promptsApi
        .create(currentProjectId, {
          title: data.title,
          content,
          description,
          tags: 'tags' in data ? (data.tags ?? []) : [],
          variables: 'variables' in data ? (data.variables ?? []) : [],
          status: 'draft',
        })
        .then(async (created) => {
          refreshPrompts()
          const prompt = await promptsApi.get(created.id)
          setCurrentPrompt(prompt)
          setRightPanelView({ type: 'prompt-edit', id: created.id })
        })
        .catch(console.error)
    }
  }

  // Test suite handlers
  const refreshTestSuites = useCallback(() => {
    if (!currentProjectId) return
    testSuitesApi.listByProject(currentProjectId).then(setTestSuites).catch(console.error)
  }, [currentProjectId])

  const handleNewTestSuite = async () => {
    if (!currentProjectId) return
    try {
      const session = await sessionsApi.create(currentProjectId, '新建测试集')
      setSessions((prev) => [session, ...prev])
      setCurrentSessionId(session.id)
      setCurrentTestSuiteId(null)
      setTestMode(true)
    } catch (e) {
      console.error("Create test session failed:", e)
    }
  }

  const handleTestSuiteClick = async (id: string) => {
    try {
      const data = await testSuitesApi.get(id)
      setCurrentTestSuiteId(id)
      setCurrentTestCases(data.cases)
      setCurrentSessionId(null)
      const runs = await testRunsApi.listBySuite(id)
      setCurrentTestRun(runs.length > 0 ? runs[0] : null)
    } catch (e) {
      console.error(e)
    }
  }

  const handleDeleteTestSuite = async (id: string) => {
    try {
      await testSuitesApi.delete(id)
      refreshTestSuites()
      if (currentTestSuiteId === id) {
        setCurrentTestSuiteId(null)
      }
    } catch (e) {
      console.error(e)
    }
  }

  const handleConfirmTestSuite = async (data: TestSuiteGenerationData) => {
    if (!currentProjectId || !currentSessionId) return
    try {
      const suite = await testSuitesApi.create(currentProjectId, {
        name: data.name,
        description: data.description,
        sessionId: currentSessionId,
      })
      await testCasesApi.createBatch(suite.id, data.cases)
      refreshTestSuites()
      setTestMode(false)
      handleTestSuiteClick(suite.id)
    } catch (e) {
      console.error('Create test suite failed:', e)
    }
  }

  // Panel title
  const getRightPanelTitle = (): string => {
    if (!rightPanelView) return ""
    switch (rightPanelView.type) {
      case "prompt-preview":
      case "prompt-edit":
        return currentPrompt?.title ?? "Prompt"
      case "prompt-history":
        return "版本历史"
      case "document-preview":
        return currentDocument?.name ?? "文档"
      case "project-settings":
        return "项目设置"
    }
  }

  // Panel content
  const renderRightPanelContent = () => {
    if (!rightPanelView) return null

    switch (rightPanelView.type) {
      case "prompt-preview":
        if (!currentPrompt) return null
        return (
          <PromptPreview
            prompt={currentPrompt}
            onEdit={() => setRightPanelView({ type: "prompt-edit", id: currentPrompt.id })}
            onViewHistory={() => handleViewHistory(currentPrompt.id)}
            onDelete={async () => {
              await handleDeletePrompt(currentPrompt.id)
            }}
          />
        )
      case "prompt-edit":
        if (!currentPrompt) return null
        return (
          <PromptEditor
            prompt={currentPrompt}
            onSave={async (data) => {
              await promptsApi.update(currentPrompt.id, data)
              refreshPrompts()
              const updated = await promptsApi.get(currentPrompt.id)
              setCurrentPrompt(updated)
              setRightPanelView({ type: "prompt-preview", id: currentPrompt.id })
            }}
            onCancel={() => setRightPanelView({ type: "prompt-preview", id: currentPrompt.id })}
          />
        )
      case "prompt-history":
        if (!currentPrompt) return null
        return (
          <VersionHistory
            versions={versions}
            currentVersion={currentPrompt.version}
            onRestore={(versionId) => console.log("Restore:", versionId)}
          />
        )
      case "document-preview":
        if (!currentDocument) return null
        return (
          <DocumentPreview
            document={currentDocument}
            onDelete={async () => {
              await documentsApi.delete(currentDocument.id)
              if (currentProjectId) {
                documentsApi.listByProject(currentProjectId).then(setDocuments).catch(console.error)
              }
              setRightPanelView(null)
            }}
          />
        )
      case "project-settings":
        if (!currentProject) return null
        return (
          <ProjectSettings
            project={currentProject}
            onSave={async (data) => {
              await projectsApi.update(currentProject.id, data)
              const updated = await projectsApi.list()
              setProjects(updated)
            }}
            onDelete={async () => {
              await projectsApi.delete(currentProject.id)
              const remaining = await projectsApi.list()
              setProjects(remaining)
              setCurrentProjectId(remaining[0]?.id ?? null)
              setRightPanelView(null)
            }}
            memories={projectMemories}
            onMemoryAdd={async (data) => {
              await memoriesApi.createForProject(currentProject.id, data)
              refreshProjectMemories()
            }}
            onMemoryEdit={async (id, data) => {
              await memoriesApi.update(id, data)
              refreshProjectMemories()
            }}
            onMemoryDelete={async (id) => {
              await memoriesApi.delete(id)
              refreshProjectMemories()
            }}
            onMemoryPromote={async (id) => {
              await memoriesApi.promote(id)
              refreshProjectMemories()
            }}
          />
        )
    }
  }

  return (
    <div className="flex h-screen flex-col">
      <TopBar
        projects={projects.map((p) => ({ id: p.id, name: p.name }))}
        currentProjectId={currentProjectId}
        onProjectChange={(id) => {
          setCurrentProjectId(id)
          setCurrentSessionId(null)
          setRightPanelView(null)
        }}
        onNewProject={() => setCreateProjectOpen(true)}
        onSettingsClick={() => router.push("/settings")}
      />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          sessions={sessions}
          currentSessionId={currentSessionId}
          onSessionSelect={(id) => { setCurrentSessionId(id); setCurrentTestSuiteId(null); setTestMode(false) }}
          onNewSession={handleNewSession}
          prompts={prompts.map((p) => ({ id: p.id, title: p.title, status: p.status }))}
          onPromptClick={handlePromptClick}
          onCreatePrompt={handleCreatePrompt}
          onBatchUploadPrompt={() => setBatchPromptUploadOpen(true)}
          documents={documents.map((d) => ({ id: d.id, name: d.name, type: d.type }))}
          onDocumentClick={handleDocumentClick}
          onUploadDocument={() => setUploadDialogOpen(true)}
          onSettingsClick={() => setRightPanelView({ type: "project-settings" })}
          onDeletePrompt={handleDeletePrompt}
          onDeleteDocument={handleDeleteDocument}
          memoryBadgeCount={memoryBadgeCount}
          onMemoryBadgeClick={() => {
            setMemoryBadgeCount(0)
            setRightPanelView({ type: "project-settings" })
          }}
          testSuites={testSuites.map((s) => ({ id: s.id, name: s.name, status: s.status }))}
          currentTestSuiteId={currentTestSuiteId}
          onTestSuiteClick={handleTestSuiteClick}
          onNewTestSuite={handleNewTestSuite}
          onDeleteTestSuite={handleDeleteTestSuite}
        />
        <main className="flex flex-1 overflow-hidden">
          {currentSuite ? (
            <div className="flex-1 overflow-hidden">
              <TestSuiteDetail
                suite={currentSuite}
                cases={currentTestCases}
                latestRun={currentTestRun}
                prompts={prompts.map((p) => ({ id: p.id, title: p.title }))}
                onSuiteUpdate={() => {
                  refreshTestSuites()
                  if (currentTestSuiteId) {
                    testSuitesApi.get(currentTestSuiteId).then((data) => {
                      setCurrentTestCases(data.cases)
                    }).catch(console.error)
                    testRunsApi.listBySuite(currentTestSuiteId).then((runs) => {
                      setCurrentTestRun(runs.length > 0 ? runs[0] : null)
                    }).catch(console.error)
                  }
                }}
                onCaseUpdate={() => {
                  if (currentTestSuiteId) {
                    testCasesApi.listBySuite(currentTestSuiteId).then(setCurrentTestCases).catch(console.error)
                  }
                }}
              />
            </div>
          ) : (
            <ChatArea
              messages={messages}
              sessionId={currentSessionId}
              prompts={prompts.map((p) => ({ id: p.id, title: p.title }))}
              documents={documents.map((d) => ({ id: d.id, name: d.name }))}
              onMessagesChange={refreshMessages}
              onApplyPreview={handleApplyPreview}
              onApplyDiff={handleApplyDiff}
              onEditInPanel={handleEditInPanel}
              onViewHistory={(promptId) => {
                const byId = prompts.find((p) => p.id === promptId)
                const resolved = byId ?? prompts.find((p) => p.title === promptId)
                if (resolved) handleViewHistory(resolved.id)
              }}
              onNewSession={handleNewSession}
              onMemoryCommand={(data) => {
                if (data.command === 'create' || data.command === 'delete') {
                  refreshProjectMemories()
                }
              }}
              onConfirmTestSuite={handleConfirmTestSuite}
              useTestAgent={testMode}
            />
          )}
        </main>
        <RightPanel
          open={rightPanelView !== null}
          onClose={() => setRightPanelView(null)}
          title={getRightPanelTitle()}
        >
          {renderRightPanelContent()}
        </RightPanel>
      </div>

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
    </div>
  )
}
