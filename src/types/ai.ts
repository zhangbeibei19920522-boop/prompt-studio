import type {
  DiffData,
  Memory,
  Message,
  PlanData,
  PreviewData,
  Prompt,
  Document,
  TestCaseRoutingStep,
  TestSuiteRoutingConfig,
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
  signal?: AbortSignal
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
  | { type: 'test-flow-config'; data: TestFlowConfigRequestData }
  | { type: 'test-suite'; data: TestSuiteGenerationData }
  | { type: 'test-suite-progress'; data: TestSuiteProgressData }
  | { type: 'continuation'; data: { iteration: number; maxIterations: number } }
  | { type: 'session-title'; data: { sessionId: string; title: string } }
  | { type: 'done' }
  | { type: 'error'; message: string }

// 测试运行 SSE 事件
export type TestRunEvent =
  | { type: 'test-start'; data: { totalCases: number } }
  | { type: 'test-case-start'; data: { caseId: string; index: number; title: string } }
  | {
      type: 'test-case-done'
      data: {
        caseId: string
        actualOutput: string
        actualIntent?: string | null
        matchedPromptId?: string | null
        matchedPromptTitle?: string | null
        routingSteps?: TestCaseRoutingStep[]
      }
    }
  | { type: 'eval-start' }
  | {
      type: 'eval-case-done'
      data: {
        caseId: string
        passed: boolean
        score: number
        reason: string
        intentPassed?: boolean | null
        intentScore?: number | null
        intentReason?: string
        replyPassed?: boolean | null
        replyScore?: number | null
        replyReason?: string
      }
    }
  | { type: 'eval-report'; data: import('./database').TestReport }
  | { type: 'test-complete'; data: { runId: string; score: number } }
  | { type: 'test-error'; data: { error: string } }

export type ConversationAuditRunEvent =
  | { type: 'audit-start'; data: { jobId: string; totalTurns: number } }
  | { type: 'audit-turn-start'; data: { turnId: string; index: number } }
  | { type: 'audit-turn-done'; data: { turnId: string; hasIssue: boolean | null } }
  | { type: 'audit-complete'; data: { jobId: string; issueCount: number; totalTurns: number } }
  | { type: 'audit-error'; data: { error: string } }

// 测试集生成进度
export interface TestSuiteProgressData {
  generated: number
  total: number
}

export interface TestFlowConfigRequestData {
  mode: 'routing'
  summary: string
}

// 测试集生成数据（Agent 对话中生成）
export interface TestSuiteGenerationData {
  name: string
  description: string
  workflowMode?: 'single' | 'routing'
  routingConfig?: TestSuiteRoutingConfig | null
  cases: Array<{
    title: string
    context: string
    input: string
    sourceDocumentId?: string | null
    expectedOutput: string
    expectedOutputDiagnostics?: TestCaseRoutingStep[] | null
    expectedIntent?: string | null
  }>
}

// 测试集分批生成数据（Agent 每次最多 3 个用例）
export interface TestSuiteBatchData {
  name: string
  description: string
  totalPlanned: number
  workflowMode?: 'single' | 'routing'
  routingConfig?: TestSuiteRoutingConfig | null
  cases: Array<{
    title: string
    context: string
    input: string
    sourceDocumentId?: string | null
    expectedOutput: string
    expectedOutputDiagnostics?: TestCaseRoutingStep[] | null
    expectedIntent?: string | null
  }>
}
