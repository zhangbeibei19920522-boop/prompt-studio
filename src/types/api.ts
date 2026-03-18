import type { Memory, MessageReference, Project, Prompt } from './database'

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

// 记忆请求类型
export type CreateMemoryRequest = Pick<Memory, 'scope' | 'category' | 'content'> & {
  projectId?: string
}

export type UpdateMemoryRequest = Partial<Pick<Memory, 'content' | 'category'>>

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

// 测试集请求类型
export interface CreateTestSuiteRequest {
  name: string
  description?: string
  sessionId?: string
}

export interface UpdateTestSuiteRequest {
  name?: string
  description?: string
  promptId?: string
  promptVersionId?: string
  config?: import('./database').TestSuiteConfig
  status?: 'draft' | 'ready' | 'running' | 'completed'
}

export interface CreateTestCaseRequest {
  title: string
  context?: string
  input: string
  expectedOutput: string
  sortOrder?: number
}

export interface UpdateTestCaseRequest {
  title?: string
  context?: string
  input?: string
  expectedOutput?: string
  sortOrder?: number
}

export interface RunTestRequest {
  promptId: string
}

export interface ConversationAuditParseSummary {
  knowledgeFileCount: number
  conversationCount: number
  turnCount: number
  invalidRowCount: number
}

export interface CreateConversationAuditJobRequest {
  name: string
}

export interface RunConversationAuditResponse {
  jobId: string
  status: 'running'
}
