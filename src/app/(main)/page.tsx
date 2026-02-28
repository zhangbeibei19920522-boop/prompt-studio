"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { TopBar } from "@/components/layout/top-bar"
import { Sidebar } from "@/components/layout/sidebar"
import { RightPanel } from "@/components/layout/right-panel"
import { ChatArea } from "@/components/chat/chat-area"
import { CreateProjectDialog } from "@/components/project/create-project-dialog"
import { ProjectSettings } from "@/components/project/project-settings"
import { PromptPreview } from "@/components/prompt/prompt-preview"
import { PromptEditor } from "@/components/prompt/prompt-editor"
import { VersionHistory } from "@/components/prompt/version-history"
import { DocumentPreview } from "@/components/knowledge/document-preview"
import { UploadDialog } from "@/components/knowledge/upload-dialog"
import {
  projectsApi,
  promptsApi,
  documentsApi,
  sessionsApi,
  messagesApi,
} from "@/lib/utils/api-client"
import type { Project, Prompt, Document, Session, Message, PromptVersion } from "@/types/database"

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

  // Dialogs
  const [createProjectOpen, setCreateProjectOpen] = useState(false)
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false)

  // Current items for panel
  const [currentPrompt, setCurrentPrompt] = useState<Prompt | null>(null)
  const [currentDocument, setCurrentDocument] = useState<Document | null>(null)
  const currentProject = projects.find((p) => p.id === currentProjectId) ?? null

  // Load projects on mount
  useEffect(() => {
    projectsApi.list().then((data) => {
      setProjects(data)
      if (data.length > 0 && !currentProjectId) {
        setCurrentProjectId(data[0].id)
      }
    }).catch(console.error)
  }, [])

  // Load project data when project changes
  useEffect(() => {
    if (!currentProjectId) return
    promptsApi.listByProject(currentProjectId).then(setPrompts).catch(console.error)
    documentsApi.listByProject(currentProjectId).then(setDocuments).catch(console.error)
    sessionsApi.listByProject(currentProjectId).then((data) => {
      setSessions(data)
      if (data.length > 0) setCurrentSessionId(data[0].id)
      else setCurrentSessionId(null)
    }).catch(console.error)
  }, [currentProjectId])

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
    for (const file of files) {
      const content = await file.text()
      const ext = file.name.split(".").pop() ?? "txt"
      try {
        await documentsApi.create(currentProjectId, {
          name: file.name,
          type: ext,
          content,
        })
      } catch (e) {
        console.error("Upload failed:", e)
      }
    }
    documentsApi.listByProject(currentProjectId).then(setDocuments).catch(console.error)
    setUploadDialogOpen(false)
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
          onSessionSelect={setCurrentSessionId}
          onNewSession={handleNewSession}
          prompts={prompts.map((p) => ({ id: p.id, title: p.title, status: p.status }))}
          onPromptClick={handlePromptClick}
          documents={documents.map((d) => ({ id: d.id, name: d.name, type: d.type }))}
          onDocumentClick={handleDocumentClick}
          onSettingsClick={() => setRightPanelView({ type: "project-settings" })}
        />
        <main className="flex flex-1 overflow-hidden">
          <ChatArea
            messages={messages}
            sessionId={currentSessionId}
            prompts={prompts.map((p) => ({ id: p.id, title: p.title }))}
            documents={documents.map((d) => ({ id: d.id, name: d.name }))}
            onMessagesChange={refreshMessages}
          />
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
    </div>
  )
}
