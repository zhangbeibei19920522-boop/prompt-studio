"use client"

import { createContext, useContext, useState } from "react"
import type { Project, Session } from "@/types/database"

type RightPanelContent = {
  type: "prompt-preview" | "prompt-edit" | "document-preview" | "diff-view"
  id: string
} | null

interface AppState {
  currentProjectId: string | null
  currentSessionId: string | null
  rightPanelContent: RightPanelContent
  rightPanelOpen: boolean
}

interface AppActions {
  setCurrentProject: (project: Project | null) => void
  setCurrentSession: (session: Session | null) => void
  openRightPanel: (content: NonNullable<RightPanelContent>) => void
  closeRightPanel: () => void
}

type AppContextValue = AppState & AppActions

const AppContext = createContext<AppContextValue | null>(null)

const initialState: AppState = {
  currentProjectId: null,
  currentSessionId: null,
  rightPanelContent: null,
  rightPanelOpen: false,
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppState>(initialState)

  const setCurrentProject = (project: Project | null) => {
    setState((prev) => ({
      ...prev,
      currentProjectId: project?.id ?? null,
      currentSessionId: null,
    }))
  }

  const setCurrentSession = (session: Session | null) => {
    setState((prev) => ({
      ...prev,
      currentSessionId: session?.id ?? null,
    }))
  }

  const openRightPanel = (content: NonNullable<RightPanelContent>) => {
    setState((prev) => ({
      ...prev,
      rightPanelContent: content,
      rightPanelOpen: true,
    }))
  }

  const closeRightPanel = () => {
    setState((prev) => ({
      ...prev,
      rightPanelContent: null,
      rightPanelOpen: false,
    }))
  }

  return (
    <AppContext.Provider
      value={{ ...state, setCurrentProject, setCurrentSession, openRightPanel, closeRightPanel }}
    >
      {children}
    </AppContext.Provider>
  )
}

export function useApp(): AppContextValue {
  const context = useContext(AppContext)
  if (context === null) {
    throw new Error("useApp must be used within an AppProvider")
  }
  return context
}
