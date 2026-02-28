import type {
  DiffData,
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
  referencedPrompts: Prompt[]
  referencedDocuments: Document[]
  sessionHistory: Message[]
  userMessage: string
}

// Agent 规划
export interface AgentPlan {
  keyPoints: PlanData['keyPoints']
}

// 流式响应事件
export type StreamEvent =
  | { type: 'text'; content: string }
  | { type: 'plan'; data: PlanData }
  | { type: 'preview'; data: PreviewData }
  | { type: 'diff'; data: DiffData }
  | { type: 'done' }
  | { type: 'error'; message: string }
