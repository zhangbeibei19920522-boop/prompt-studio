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

export type KnowledgeTaskType = 'batch' | 'manual' | 'repair' | 'full'
export type KnowledgeBuildTaskStatus = 'pending' | 'running' | 'succeeded' | 'failed' | 'cancelled'
export type KnowledgeVersionStatus = 'draft' | 'stg' | 'prod' | 'archived'
export type KnowledgeIndexVersionStatus = 'draft' | 'ready' | 'stg' | 'prod' | 'archived'
export type KnowledgeReviewStatus = 'approved' | 'pending' | 'blocked'

export interface KnowledgeManualDraftInput {
  title: string
  content: string
  source: string
}

export interface KnowledgeRepairQuestionInput {
  query: string
  problem: string
  direction: string
}

export interface KnowledgeScopeMappingRecord {
  id?: string
  mappingId?: string
  lookupKey: string
  scope: Record<string, string[]>
  raw?: Record<string, unknown>
  createdAt?: string
  updatedAt?: string
}

export interface KnowledgeScopeMapping {
  id: string
  projectId: string
  name: string
  sourceFileName: string
  sourceFileHash: string
  keyField: string
  scopeFields: string[]
  rowCount: number
  diagnostics: Array<Record<string, unknown>>
  createdAt: string
  updatedAt: string
}

export interface KnowledgeScopeMappingDetail extends KnowledgeScopeMapping {
  records: KnowledgeScopeMappingRecord[]
}

export interface KnowledgeScopeMappingVersion {
  id: string
  projectId: string
  name: string
  fileName: string
  fileHash: string
  rowCount: number
  keyField: string
  scopeFields: string[]
  recordsFilePath: string
  records: KnowledgeScopeMappingRecord[]
  createdAt: string
  updatedAt: string
}

export interface KnowledgeTaskInput {
  documentIds: string[]
  mappingId?: string | null
  mappingVersionId?: string | null
  mappingRecords?: KnowledgeScopeMappingRecord[]
  manualDrafts: KnowledgeManualDraftInput[]
  repairQuestions: KnowledgeRepairQuestionInput[]
}

export interface KnowledgeStageCount {
  stage: string
  value: string
}

export interface KnowledgeCoverageAudit {
  coverage: number
  auditStatus: 'normal' | 'warning'
  reasons: string[]
  orphanRecords: string[]
  ambiguityRecords: string[]
}

export interface KnowledgeRetrievalContract {
  version: number
  supportsRagRoute: boolean
  supportsEvidenceAssembly: boolean
  enrichedMetadataKeys: string[]
}

export interface KnowledgeCleaningContract {
  version: number
  supportsScope: boolean
  supportsMappingVersion: boolean
  supportsSheetLayoutDiagnostics: boolean
}

export interface KnowledgeArtifactManifest {
  generatedAt: string
  profileKey: string
  projectName: string
  sourceSummary: Record<string, unknown>
  stageSummary: KnowledgeStageSummary
  coverageAudit: KnowledgeCoverageAudit
  pendingRecords: Array<Record<string, unknown>>
  blockedRecords: Array<Record<string, unknown>>
  highRiskRecords: Array<Record<string, unknown>>
  documentDiagnostics?: Array<Record<string, unknown>>
  scopeDiagnostics?: Array<Record<string, unknown>>
  stageArtifacts: Record<string, Array<Record<string, unknown>>>
  snapshotHash: string
  retrievalContract?: KnowledgeRetrievalContract
  cleaningContract?: KnowledgeCleaningContract
}

export interface KnowledgeStageSummary {
  sourceCount: number
  excludedCount: number
  rawRecordCount: number
  cleanedCount: number
  includeCount: number
  highRiskCount: number
  conflictCount: number
  pendingCount: number
  blockedCount: number
  approvedCount: number
  parentCount: number
  chunkCount: number
  coverage: number
  orphanCount: number
  ambiguityCount: number
  stageCounts: KnowledgeStageCount[]
}

export interface KnowledgeProfileConfig {
  sourceAdapters: Record<string, unknown>
  cleaningRules: Record<string, unknown>
  riskRules: Record<string, unknown>
  promotionRules: Record<string, unknown>
  mergeRules: Record<string, unknown>
  conflictRules: Record<string, unknown>
  metadataSchema: string[]
  entityDictionary: Record<string, string[]>
}

export interface KnowledgeBase {
  id: string
  projectId: string
  name: string
  profileKey: string
  profileConfig: KnowledgeProfileConfig
  repairConfig: Record<string, unknown>
  currentDraftVersionId: string | null
  currentStgVersionId: string | null
  currentProdVersionId: string | null
  currentStgIndexVersionId: string | null
  currentProdIndexVersionId: string | null
  createdAt: string
  updatedAt: string
}

export interface KnowledgeBuildTask {
  id: string
  projectId: string
  knowledgeBaseId: string
  knowledgeVersionId: string | null
  knowledgeIndexVersionId: string | null
  name: string
  taskType: KnowledgeTaskType
  status: KnowledgeBuildTaskStatus
  currentStep: string
  progress: number
  baseVersionId: string | null
  input: KnowledgeTaskInput
  stageSummary: KnowledgeStageSummary | null
  errorMessage: string | null
  createdAt: string
  updatedAt: string
  startedAt: string | null
  completedAt: string | null
}

export interface KnowledgeParent {
  id: string
  knowledgeVersionId: string
  question: string
  answer: string
  questionAliases: string[]
  metadata: Record<string, unknown>
  sourceFiles: string[]
  sourceRecordIds: string[]
  reviewStatus: KnowledgeReviewStatus
  recordKind: string
  isHighRisk: boolean
  inheritedRiskReason: string
  createdAt: string
  updatedAt: string
}

export interface KnowledgeChunk {
  id: string
  knowledgeVersionId: string
  parentId: string
  chunkOrder: number
  sectionTitle: string
  chunkText: string
  embeddingText: string
  chunkType: string
  metadata: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export interface KnowledgeVersion {
  id: string
  knowledgeBaseId: string
  taskId: string | null
  name: string
  status: KnowledgeVersionStatus
  buildProfile: string
  sourceSummary: Record<string, unknown>
  stageSummary: KnowledgeStageSummary
  coverageAudit: KnowledgeCoverageAudit
  qaPairCount: number
  parentCount: number
  chunkCount: number
  pendingCount: number
  blockedCount: number
  parentsFilePath: string
  chunksFilePath: string
  manifestFilePath: string
  createdAt: string
  updatedAt: string
  publishedAt: string | null
  manifest?: KnowledgeArtifactManifest | null
  parents?: KnowledgeParent[]
  chunks?: KnowledgeChunk[]
}

export interface KnowledgeIndexVersion {
  id: string
  knowledgeBaseId: string
  knowledgeVersionId: string
  name: string
  status: KnowledgeIndexVersionStatus
  profileKey: string
  parentCount: number
  chunkCount: number
  stageSummary: KnowledgeStageSummary
  manifestFilePath: string
  createdAt: string
  updatedAt: string
  builtAt: string | null
  publishedAt: string | null
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

// 记忆
export interface Memory {
  id: string
  scope: 'global' | 'project'
  projectId: string | null
  category: 'preference' | 'fact'
  content: string
  source: 'auto' | 'manual'
  sourceSessionId: string | null
  createdAt: string
  updatedAt: string
}

// 会话提取进度
export interface SessionExtractionProgress {
  sessionId: string
  lastExtractedMessageIndex: number
  updatedAt: string
}

// 测试集配置
export interface TestSuiteConfig {
  provider: string
  model: string
  apiKey: string
  baseUrl: string
}

export type TestSuiteWorkflowMode = 'single' | 'routing'
export type TestGenerationSection = 'full-flow' | 'unit'
export type TestGenerationStructure = 'single' | 'multi'
export type TestConversationMode = 'single-turn' | 'multi-turn'
export type TestGenerationTargetType = 'prompt' | 'index-version'
export type TestDocumentRouteMode = 'rag' | 'non-r'
export type TestRoutingTargetType = 'prompt' | 'index-version'
export type TestSuiteGenerationJobStatus = 'queued' | 'running' | 'completed' | 'failed'

export interface TestGenerationDocumentRouteMode {
  documentId: string
  routeMode: TestDocumentRouteMode
}

export interface TestSuiteRoute {
  intent: string
  promptId: string
  targetType?: TestRoutingTargetType
  targetId?: string
  ragPromptId?: string
  ragIndexVersionId?: string
}

export interface TestSuiteRoutingConfig {
  entryPromptId: string
  routes: TestSuiteRoute[]
}

export interface TestCaseRoutingStep {
  turnIndex: number
  userInput: string
  rawIntent?: string | null
  rawIntentOutput?: string | null
  actualIntent: string | null
  matchedPromptId: string | null
  matchedPromptTitle: string | null
  actualReply: string
  routingError?: string | null
  routeMode?: 'prompt' | 'rag'
  ragPromptId?: string | null
  ragIndexVersionId?: string | null
  retrievalTopK?: number | null
  selectedDocId?: string | null
  selectedChunkIds?: string[]
  selectionMargin?: number | null
  answerMode?: 'extractive' | 'llm_fallback' | null
  ingestBackfilled?: boolean
}

export interface TestCaseGenerationMetadata {
  sourceDocumentId: string | null
  sourceDocumentName: string | null
  sourceRouteMode: TestDocumentRouteMode | null
}

// 测试集
export interface TestSuite {
  id: string
  projectId: string
  sessionId: string | null
  section: TestGenerationSection
  name: string
  description: string
  promptId: string | null
  promptVersionId: string | null
  workflowMode: TestSuiteWorkflowMode
  routingConfig: TestSuiteRoutingConfig | null
  config: TestSuiteConfig
  status: 'draft' | 'ready' | 'running' | 'completed'
  createdAt: string
  updatedAt: string
}

export interface TestSuiteGenerationJob {
  id: string
  projectId: string
  suiteId: string
  status: TestSuiteGenerationJobStatus
  generatedCount: number
  totalCount: number
  errorMessage: string | null
  createdAt: string
  updatedAt: string
  completedAt: string | null
}

// 测试用例
export interface TestCase {
  id: string
  testSuiteId: string
  title: string
  context: string
  input: string
  expectedOutput: string
  expectedOutputDiagnostics?: TestCaseRoutingStep[] | null
  expectedIntent: string | null
  generationMetadata?: TestCaseGenerationMetadata | null
  sortOrder: number
}

// 单条测试结果
export interface TestCaseResult {
  testCaseId: string
  actualOutput: string
  actualIntent?: string | null
  matchedPromptId?: string | null
  matchedPromptTitle?: string | null
  routingSteps?: TestCaseRoutingStep[]
  intentPassed?: boolean | null
  intentScore?: number | null
  intentReason?: string
  replyPassed?: boolean | null
  replyScore?: number | null
  replyReason?: string
  passed: boolean
  score: number
  reason: string
}

// 测试报告
export interface TestReport {
  summary: string
  totalCases: number
  passedCases: number
  score: number
  improvements: string[]
  details: string
}

// 测试运行记录
export interface TestRun {
  id: string
  testSuiteId: string
  status: 'running' | 'completed' | 'failed'
  results: TestCaseResult[]
  report: TestReport | null
  score: number | null
  startedAt: string
  completedAt: string | null
}

export interface TestSuiteRunProgress {
  suiteId: string
  runId: string
  status: 'running' | 'evaluating'
  completedCases: number
  evaluatedCases: number
  totalCases: number
}

export type ConversationAuditJobStatus = 'parsing' | 'draft' | 'running' | 'completed' | 'failed'

export interface ConversationAuditParseSummary {
  knowledgeFileCount: number
  conversationCount: number
  turnCount: number
  invalidRowCount: number
}

export interface ConversationAuditRetrievedSource {
  chunkId: string
  sourceName: string
  score: number
}

export type ConversationAuditOverallStatus = 'passed' | 'failed' | 'unknown'
export type ConversationAuditProcessStatus = 'passed' | 'failed' | 'unknown'
export type ConversationAuditKnowledgeStatus = 'passed' | 'failed' | 'unknown'
export type ConversationAuditRiskLevel = 'low' | 'medium' | 'high'

export interface ConversationAuditProcessStep {
  name: string
  status: 'passed' | 'failed' | 'out_of_order'
  reason: string
  sourceNames: string[]
}

export interface ConversationAuditJob {
  id: string
  projectId: string
  name: string
  status: ConversationAuditJobStatus
  parseSummary: ConversationAuditParseSummary
  issueCount: number
  totalTurns: number
  errorMessage: string | null
  createdAt: string
  updatedAt: string
  completedAt: string | null
}

export interface ConversationAuditKnowledgeChunk {
  id: string
  jobId: string
  sourceName: string
  sourceType: string
  chunkIndex: number
  content: string
  metadata: Record<string, unknown>
  createdAt: string
}

export interface ConversationAuditConversation {
  id: string
  jobId: string
  externalConversationId: string
  turnCount: number
  overallStatus: ConversationAuditOverallStatus
  processStatus: ConversationAuditProcessStatus
  knowledgeStatus: ConversationAuditKnowledgeStatus
  riskLevel: ConversationAuditRiskLevel
  summary: string
  processSteps: ConversationAuditProcessStep[]
  createdAt: string
}

export interface ConversationAuditTurn {
  id: string
  jobId: string
  conversationId: string
  turnIndex: number
  userMessage: string
  botReply: string
  hasIssue: boolean | null
  knowledgeAnswer: string | null
  retrievedSources: ConversationAuditRetrievedSource[]
  createdAt: string
  updatedAt: string
}
