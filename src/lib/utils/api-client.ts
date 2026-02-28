import type { ApiResponse } from '@/types/api'
import type {
  GlobalSettings,
  Project,
  Prompt,
  Document,
  Session,
  Message,
  PromptVersion,
} from '@/types/database'

async function fetchApi<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  })
  const json: ApiResponse<T> = await res.json()
  if (!json.success) {
    throw new Error(json.error ?? '请求失败')
  }
  return json.data as T
}

// Settings
export const settingsApi = {
  get: () => fetchApi<GlobalSettings>('/api/settings'),
  update: (data: Partial<GlobalSettings>) =>
    fetchApi<GlobalSettings>('/api/settings', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
}

// Projects
export const projectsApi = {
  list: () => fetchApi<Project[]>('/api/projects'),
  get: (id: string) => fetchApi<Project>(`/api/projects/${id}`),
  create: (data: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>) =>
    fetchApi<Project>('/api/projects', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  update: (id: string, data: Partial<Project>) =>
    fetchApi<Project>(`/api/projects/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  delete: (id: string) =>
    fetchApi<null>(`/api/projects/${id}`, { method: 'DELETE' }),
}

// Prompts
export const promptsApi = {
  listByProject: (projectId: string) =>
    fetchApi<Prompt[]>(`/api/projects/${projectId}/prompts`),
  get: (id: string) => fetchApi<Prompt>(`/api/prompts/${id}`),
  create: (projectId: string, data: Partial<Prompt>) =>
    fetchApi<Prompt>(`/api/projects/${projectId}/prompts`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  update: (id: string, data: Partial<Prompt>) =>
    fetchApi<Prompt>(`/api/prompts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  delete: (id: string) =>
    fetchApi<null>(`/api/prompts/${id}`, { method: 'DELETE' }),
  versions: (id: string) =>
    fetchApi<PromptVersion[]>(`/api/prompts/${id}/versions`),
}

// Documents
export const documentsApi = {
  listByProject: (projectId: string) =>
    fetchApi<Document[]>(`/api/projects/${projectId}/documents`),
  get: (id: string) => fetchApi<Document>(`/api/documents/${id}`),
  create: (projectId: string, data: { name: string; type: string; content: string }) =>
    fetchApi<Document>(`/api/projects/${projectId}/documents`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  delete: (id: string) =>
    fetchApi<null>(`/api/documents/${id}`, { method: 'DELETE' }),
}

// Sessions
export const sessionsApi = {
  listByProject: (projectId: string) =>
    fetchApi<Session[]>(`/api/projects/${projectId}/sessions`),
  get: (id: string) => fetchApi<Session>(`/api/sessions/${id}`),
  create: (projectId: string, title?: string) =>
    fetchApi<Session>(`/api/projects/${projectId}/sessions`, {
      method: 'POST',
      body: JSON.stringify({ title }),
    }),
  delete: (id: string) =>
    fetchApi<null>(`/api/sessions/${id}`, { method: 'DELETE' }),
}

// Messages
export const messagesApi = {
  listBySession: (sessionId: string) =>
    fetchApi<Message[]>(`/api/sessions/${sessionId}/messages`),
}
