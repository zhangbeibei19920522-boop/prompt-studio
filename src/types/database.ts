// 全局设置
export interface GlobalSettings {
  id: string
  provider: string
  apiKey: string
  model: string
  baseUrl: string
  businessDescription: string
  businessGoal: string
  businessBackground: string
}

// 项目
export interface Project {
  id: string
  name: string
  description: string
  businessDescription: string
  businessGoal: string
  businessBackground: string
  createdAt: string
  updatedAt: string
}

// Prompt 变量
export interface PromptVariable {
  name: string
  description: string
  defaultValue?: string
}

// Prompt
export interface Prompt {
  id: string
  projectId: string
  title: string
  content: string
  description: string
  tags: string[]
  variables: PromptVariable[]
  version: number
  status: 'draft' | 'active' | 'archived'
  createdAt: string
  updatedAt: string
}

// Prompt 版本
export interface PromptVersion {
  id: string
  promptId: string
  version: number
  content: string
  changeNote: string
  sessionId: string | null
  createdAt: string
}

// 知识库文档
export interface Document {
  id: string
  projectId: string
  name: string
  type: string
  content: string
  createdAt: string
}

// 对话会话
export interface Session {
  id: string
  projectId: string
  title: string
  createdAt: string
  updatedAt: string
}

// 消息引用
export interface MessageReference {
  type: 'prompt' | 'document'
  id: string
  title: string
}

// 消息元数据
export interface MessageMetadata {
  type: 'plan' | 'preview' | 'diff'
  data: PlanData | PreviewData | DiffData
}

// 消息
export interface Message {
  id: string
  sessionId: string
  role: 'user' | 'assistant'
  content: string
  references: MessageReference[]
  metadata: MessageMetadata | null
  createdAt: string
}

// 规划数据
export interface PlanKeyPoint {
  index: number
  description: string
  action: 'create' | 'modify'
  targetPromptId?: string
  targetPromptTitle: string
}

export interface PlanData {
  keyPoints: PlanKeyPoint[]
  status: 'pending' | 'confirmed' | 'rejected'
}

// 预览数据（新建 prompt）
export interface PreviewData {
  title: string
  content: string
  description: string
  tags: string[]
  variables: PromptVariable[]
}

// Diff 数据（修改 prompt）
export interface DiffData {
  promptId: string
  title: string
  oldContent: string
  newContent: string
}
