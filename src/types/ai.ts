import type {
  DiffData,
  Memory,
  Message,
  PlanData,
  PreviewData,
  Prompt,
  Document,
} from './database'

// AI Provider 配置
export interface AiProviderConfig {
  provider: string
  apiKey: string
  model: string
  baseUrl: string
}

// Chat 消息格式（发给 LLM）
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

// Chat 选项
export interface ChatOptions {
  temperature?: number
  maxTokens?: number
}

// AI Provider 接口
export interface AiProvider {
  chat(messages: ChatMessage[], options?: ChatOptions): Promise<string>
  chatStream(
    messages: ChatMessage[],
    options?: ChatOptions
  ): AsyncGenerator<string>
}

// Agent 业务信息
export interface BusinessInfo {
  description: string
  goal: string
  background: string
}

// Agent 上下文
export interface AgentContext {
  globalBusiness: BusinessInfo
  projectBusiness: BusinessInfo
  globalMemories: Memory[]
  projectMemories: Memory[]
  referencedPrompts: Prompt[]
  referencedDocuments: Document[]
  sessionHistory: Message[]
  userMessage: string
}

// Agent 规划
export interface AgentPlan {
  keyPoints: PlanData['keyPoints']
}

// Agent 上下文摘要（思考链日志）
export interface AgentContextSummary {
  referencedPrompts: Array<{ id: string; title: string }>
  referencedDocuments: Array<{ id: string; name: string }>
  hasGlobalBusiness: boolean
  hasProjectBusiness: boolean
  historyMessageCount: number
  globalMemoryCount: number
  projectMemoryCount: number
}

// 记忆提取动作
export interface MemoryExtractionAction {
  action: 'insert' | 'update' | 'skip'
  content?: string
  category?: 'preference' | 'fact'
  targetId?: string
}

// 记忆提取结果
export interface MemoryExtractionResult {
  actions: MemoryExtractionAction[]
  sessionId: string
}

// 记忆指令数据
export interface MemoryCommandData {
  command: 'create' | 'delete' | 'list'
  scope: 'global' | 'project'
  content?: string
  memoryId?: string
}

// 流式响应事件
export type StreamEvent =
  | { type: 'text'; content: string }
  | { type: 'context'; data: AgentContextSummary }
  | { type: 'plan'; data: PlanData }
  | { type: 'preview'; data: PreviewData }
  | { type: 'diff'; data: DiffData }
  | { type: 'memory'; data: MemoryCommandData }
  | { type: 'done' }
  | { type: 'error'; message: string }
