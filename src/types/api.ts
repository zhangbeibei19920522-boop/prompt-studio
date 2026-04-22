import type {
  KnowledgeBase,
  KnowledgeBuildTask,
  KnowledgeCoverageAudit,
  KnowledgeIndexVersion,
  KnowledgeManualDraftInput,
  KnowledgeRepairQuestionInput,
  KnowledgeStageSummary,
  KnowledgeTaskType,
  KnowledgeVersion,
  Memory,
  MessageReference,
  Project,
  Prompt,
  TestConversationMode,
  TestGenerationTargetType,
  TestGenerationSection,
  TestGenerationStructure,
  TestSuiteConfig,
  TestSuiteGenerationJob,
  TestSuiteRoutingConfig,
  TestSuiteWorkflowMode,
  TestSuite,
} from './database'

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
  section?: TestGenerationSection
  name: string
  description?: string
  sessionId?: string
  workflowMode?: TestSuiteWorkflowMode
  routingConfig?: TestSuiteRoutingConfig | null
}

export interface GenerateConfiguredTestSuiteRequest {
  section: TestGenerationSection
  structure: TestGenerationStructure
  promptId: string | null
  routingConfig: TestSuiteRoutingConfig | null
  targetType: TestGenerationTargetType
  targetId: string | null
  embeddingRequestUrl?: string | null
  embeddingModelName?: string | null
  caseCount: number
  conversationMode: TestConversationMode
  minTurns: number | null
  maxTurns: number | null
  generationSourceIds: string[]
}

export interface GenerateConfiguredTestSuiteResponse {
  suite: TestSuite
  job: TestSuiteGenerationJob
}

export interface UpdateTestSuiteRequest {
  name?: string
  description?: string
  promptId?: string
  promptVersionId?: string
  workflowMode?: TestSuiteWorkflowMode
  routingConfig?: TestSuiteRoutingConfig | null
  config?: TestSuiteConfig
  status?: 'draft' | 'ready' | 'running' | 'completed'
}

export interface CreateTestCaseRequest {
  title: string
  context?: string
  input: string
  expectedOutput: string
  expectedOutputDiagnostics?: import('./database').TestCaseRoutingStep[] | null
  expectedIntent?: string | null
  sortOrder?: number
}

export interface UpdateTestCaseRequest {
  title?: string
  context?: string
  input?: string
  expectedOutput?: string
  expectedOutputDiagnostics?: import('./database').TestCaseRoutingStep[] | null
  expectedIntent?: string | null
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

export interface CreateKnowledgeBaseRequest {
  name: string
  profileKey?: string
  profileConfig?: Partial<KnowledgeBase['profileConfig']>
  repairConfig?: Record<string, unknown>
}

export interface UpdateKnowledgeBaseRequest {
  name?: string
  profileKey?: string
  profileConfig?: Partial<KnowledgeBase['profileConfig']>
  repairConfig?: Record<string, unknown>
  currentDraftVersionId?: string | null
  currentStgVersionId?: string | null
  currentProdVersionId?: string | null
  currentStgIndexVersionId?: string | null
  currentProdIndexVersionId?: string | null
}

export interface CreateKnowledgeBuildTaskRequest {
  name: string
  taskType: KnowledgeTaskType
  baseVersionId?: string | null
  documentIds?: string[]
  manualDrafts?: KnowledgeManualDraftInput[]
  repairQuestions?: KnowledgeRepairQuestionInput[]
}

export interface CreateKnowledgeBuildTaskResponse {
  task: KnowledgeBuildTask
  version: KnowledgeVersion
}

export interface UpdateKnowledgeBuildTaskRequest {
  status?: KnowledgeBuildTask['status']
  currentStep?: string
  progress?: number
  knowledgeVersionId?: string | null
  knowledgeIndexVersionId?: string | null
  stageSummary?: KnowledgeStageSummary | null
  errorMessage?: string | null
}

export interface UpdateKnowledgeVersionRequest {
  status?: KnowledgeVersion['status']
  stageSummary?: KnowledgeStageSummary
  coverageAudit?: KnowledgeCoverageAudit
  publishedAt?: string | null
}

export interface CreateKnowledgeIndexVersionRequest {
  knowledgeVersionId: string
  name: string
}

export interface KnowledgeVersionPushResponse {
  knowledgeBase: KnowledgeBase
  version: KnowledgeVersion
  indexVersion: KnowledgeIndexVersion
}
