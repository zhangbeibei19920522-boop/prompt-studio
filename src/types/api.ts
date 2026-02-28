import type { MessageReference, Project, Prompt } from './database'

// 通用 API 响应
export interface ApiResponse<T> {
  success: boolean
  data: T | null
  error: string | null
}

// 创建/更新请求类型
export type CreateProjectRequest = Omit<Project, 'id' | 'createdAt' | 'updatedAt'>
export type UpdateProjectRequest = Partial<CreateProjectRequest>

export type CreatePromptRequest = Omit<Prompt, 'id' | 'version' | 'createdAt' | 'updatedAt'>
export type UpdatePromptRequest = Partial<Omit<CreatePromptRequest, 'projectId'>>

// AI 聊天请求
export interface ChatRequest {
  sessionId: string
  content: string
  references: MessageReference[]
}

// AI 应用修改请求
export interface ApplyPromptRequest {
  sessionId: string
  action: 'create' | 'update'
  promptId?: string
  projectId: string
  title: string
  content: string
  description: string
  tags: string[]
  variables: Prompt['variables']
  changeNote: string
}
