import type {
  ApiResponse,
  CreateKnowledgeBaseRequest,
  CreateKnowledgeBuildTaskRequest,
  CreateKnowledgeBuildTaskResponse,
  CreateKnowledgeMappingVersionRequest,
  CreateKnowledgeScopeMappingRecordRequest,
  CreateKnowledgeScopeMappingRequest,
  CreateMemoryRequest,
  UpdateKnowledgeScopeMappingRecordRequest,
  UpdateKnowledgeScopeMappingRequest,
  UpdateMemoryRequest,
  CreateTestSuiteRequest,
  GenerateConfiguredTestSuiteRequest,
  GenerateConfiguredTestSuiteResponse,
  KnowledgeVersionPushResponse,
  UpdateTestSuiteRequest,
  CreateTestCaseRequest,
  UpdateTestCaseRequest,
} from '@/types/api'
import type {
  GlobalSettings,
  Project,
  Prompt,
  Document,
  KnowledgeBase,
  KnowledgeBuildTask,
  KnowledgeIndexVersion,
  KnowledgeScopeMapping,
  KnowledgeScopeMappingDetail,
  KnowledgeScopeMappingRecord,
  KnowledgeScopeMappingVersion,
  KnowledgeVersion,
  Session,
  Message,
  Memory,
  PromptVersion,
  TestSuite,
  TestSuiteGenerationJob,
  TestSuiteRunProgress,
  TestCase,
  TestRun,
  ConversationAuditJob,
  ConversationAuditConversation,
  ConversationAuditTurn,
} from '@/types/database'
import type { CreateConversationAuditJobRequest } from '@/types/api'

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

async function fetchNullableApi<T>(url: string, options?: RequestInit): Promise<T | null> {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  })

  if (res.status === 404) {
    return null
  }

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
  upload: async (projectId: string, files: File[]): Promise<Document[]> => {
    const formData = new FormData()
    for (const file of files) {
      formData.append('files', file)
    }
    const res = await fetch(`/api/projects/${projectId}/documents/upload`, {
      method: 'POST',
      body: formData,
    })
    const json = await res.json()
    if (!json.success) {
      throw new Error(json.error ?? '上传失败')
    }
    return json.data as Document[]
  },
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

// Memories
export const memoriesApi = {
  listGlobal: () => fetchApi<Memory[]>('/api/memories'),
  listByProject: (projectId: string) =>
    fetchApi<Memory[]>(`/api/projects/${projectId}/memories`),
  create: (data: CreateMemoryRequest) =>
    fetchApi<Memory>('/api/memories', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  createForProject: (projectId: string, data: Omit<CreateMemoryRequest, 'scope' | 'projectId'>) =>
    fetchApi<Memory>(`/api/projects/${projectId}/memories`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  update: (id: string, data: UpdateMemoryRequest) =>
    fetchApi<Memory>(`/api/memories/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  promote: (id: string) =>
    fetchApi<Memory>(`/api/memories/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ promote: true }),
    }),
  delete: (id: string) =>
    fetchApi<null>(`/api/memories/${id}`, { method: 'DELETE' }),
}

// Test Suites
export const testSuitesApi = {
  listByProject: (projectId: string) =>
    fetchApi<TestSuite[]>(`/api/projects/${projectId}/test-suites`),
  get: (id: string) =>
    fetchApi<TestSuite & { cases: TestCase[] }>(`/api/test-suites/${id}`),
  create: (projectId: string, data: CreateTestSuiteRequest) =>
    fetchApi<TestSuite>(`/api/projects/${projectId}/test-suites`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  generateConfigured: (projectId: string, data: GenerateConfiguredTestSuiteRequest) =>
    fetchApi<GenerateConfiguredTestSuiteResponse>(`/api/projects/${projectId}/test-suites/generate`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  update: (id: string, data: UpdateTestSuiteRequest) =>
    fetchApi<TestSuite>(`/api/test-suites/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  regenerateExpectedOutputs: (id: string) =>
    fetchApi<{ updatedCount: number; totalCount: number }>(`/api/test-suites/${id}/regenerate-expected-outputs`, {
      method: 'POST',
    }),
  delete: (id: string) =>
    fetchApi<null>(`/api/test-suites/${id}`, { method: 'DELETE' }),
}

export const testSuiteGenerationJobsApi = {
  listByProject: (projectId: string) =>
    fetchApi<TestSuiteGenerationJob[]>(`/api/projects/${projectId}/test-suite-generation-jobs`),
}

// Test Cases
export const testCasesApi = {
  listBySuite: (suiteId: string) =>
    fetchApi<TestCase[]>(`/api/test-suites/${suiteId}/cases`),
  create: (suiteId: string, data: CreateTestCaseRequest) =>
    fetchApi<TestCase>(`/api/test-suites/${suiteId}/cases`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  createBatch: (suiteId: string, cases: CreateTestCaseRequest[]) =>
    fetchApi<TestCase[]>(`/api/test-suites/${suiteId}/cases`, {
      method: 'POST',
      body: JSON.stringify(cases),
    }),
  update: (id: string, data: UpdateTestCaseRequest) =>
    fetchApi<TestCase>(`/api/test-cases/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  delete: (id: string) =>
    fetchApi<null>(`/api/test-cases/${id}`, { method: 'DELETE' }),
}

// Test Runs
export const testRunsApi = {
  listBySuite: (suiteId: string) =>
    fetchApi<TestRun[]>(`/api/test-suites/${suiteId}/runs`),
  get: (id: string) =>
    fetchApi<TestRun>(`/api/test-runs/${id}`),
  listRunningByProject: (projectId: string) =>
    fetchApi<TestSuiteRunProgress[]>(`/api/projects/${projectId}/test-suite-run-progress`),
}

export const conversationAuditJobsApi = {
  listByProject: (projectId: string) =>
    fetchApi<ConversationAuditJob[]>(`/api/projects/${projectId}/conversation-audit-jobs`),
  get: (id: string) =>
    fetchApi<{
      job: ConversationAuditJob
      parseSummary: ConversationAuditJob['parseSummary']
      conversations: ConversationAuditConversation[]
      turns: ConversationAuditTurn[]
    }>(`/api/conversation-audit-jobs/${id}`),
  create: async (
    projectId: string,
    data: CreateConversationAuditJobRequest & {
      historyFile: File
      knowledgeFiles?: File[]
    }
  ) => {
    const formData = new FormData()
    formData.set('name', data.name)
    formData.set('historyFile', data.historyFile)

    for (const file of data.knowledgeFiles ?? []) {
      formData.append('knowledgeFiles', file)
    }

    const res = await fetch(`/api/projects/${projectId}/conversation-audit-jobs`, {
      method: 'POST',
      body: formData,
    })
    const json = await res.json()
    if (!json.success) {
      throw new Error(json.error ?? '创建会话质检任务失败')
    }
    return json.data as {
      job: ConversationAuditJob
      parseSummary: ConversationAuditJob['parseSummary']
      conversations: ConversationAuditConversation[]
      turns: ConversationAuditTurn[]
    }
  },
  delete: (id: string) =>
    fetchApi<null>(`/api/conversation-audit-jobs/${id}`, { method: 'DELETE' }),
}

export const knowledgeApi = {
  getKnowledgeBase: (projectId: string) =>
    fetchNullableApi<KnowledgeBase>(`/api/projects/${projectId}/knowledge-base`),
  createKnowledgeBase: (projectId: string, data: CreateKnowledgeBaseRequest) =>
    fetchApi<KnowledgeBase>(`/api/projects/${projectId}/knowledge-base`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  listKnowledgeTasks: (projectId: string) =>
    fetchApi<KnowledgeBuildTask[]>(`/api/projects/${projectId}/knowledge-build-tasks`),
  createKnowledgeTask: (projectId: string, data: CreateKnowledgeBuildTaskRequest) =>
    fetchApi<CreateKnowledgeBuildTaskResponse>(`/api/projects/${projectId}/knowledge-build-tasks`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  listKnowledgeMappingVersions: (projectId: string) =>
    fetchApi<KnowledgeScopeMappingVersion[]>(`/api/projects/${projectId}/knowledge-mapping-versions`),
  createKnowledgeMappingVersion: (projectId: string, data: CreateKnowledgeMappingVersionRequest) =>
    fetchApi<KnowledgeScopeMappingVersion>(`/api/projects/${projectId}/knowledge-mapping-versions`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  listKnowledgeScopeMappings: (projectId: string) =>
    fetchApi<KnowledgeScopeMapping[]>(`/api/projects/${projectId}/knowledge-scope-mappings`),
  createKnowledgeScopeMapping: (projectId: string, data: CreateKnowledgeScopeMappingRequest) =>
    fetchApi<KnowledgeScopeMappingDetail>(`/api/projects/${projectId}/knowledge-scope-mappings`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateKnowledgeScopeMapping: (id: string, data: UpdateKnowledgeScopeMappingRequest) =>
    fetchApi<KnowledgeScopeMappingDetail>(`/api/knowledge-scope-mappings/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  deleteKnowledgeScopeMapping: (id: string) =>
    fetchApi<null>(`/api/knowledge-scope-mappings/${id}`, { method: 'DELETE' }),
  getKnowledgeScopeMapping: (id: string) =>
    fetchApi<KnowledgeScopeMappingDetail>(`/api/knowledge-scope-mappings/${id}`),
  createKnowledgeScopeMappingRecord: (mappingId: string, data: CreateKnowledgeScopeMappingRecordRequest) =>
    fetchApi<KnowledgeScopeMappingRecord>(`/api/knowledge-scope-mappings/${mappingId}/records`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateKnowledgeScopeMappingRecord: (id: string, data: UpdateKnowledgeScopeMappingRecordRequest) =>
    fetchApi<KnowledgeScopeMappingRecord>(`/api/knowledge-scope-mapping-records/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  deleteKnowledgeScopeMappingRecord: (id: string) =>
    fetchApi<null>(`/api/knowledge-scope-mapping-records/${id}`, { method: 'DELETE' }),
  uploadKnowledgeMappingVersions: async (projectId: string, files: File[]): Promise<KnowledgeScopeMappingVersion[]> => {
    const formData = new FormData()
    for (const file of files) {
      formData.append('files', file)
    }
    const res = await fetch(`/api/projects/${projectId}/knowledge-mapping-versions`, {
      method: 'POST',
      body: formData,
    })
    const json = await res.json()
    if (!json.success) {
      throw new Error(json.error ?? '上传映射表失败')
    }
    return json.data as KnowledgeScopeMappingVersion[]
  },
  uploadKnowledgeScopeMappings: async (projectId: string, files: File[]): Promise<KnowledgeScopeMappingDetail[]> => {
    const formData = new FormData()
    for (const file of files) {
      formData.append('files', file)
    }
    const res = await fetch(`/api/projects/${projectId}/knowledge-scope-mappings`, {
      method: 'POST',
      body: formData,
    })
    const json = await res.json()
    if (!json.success) {
      throw new Error(json.error ?? '上传映射表失败')
    }
    return json.data as KnowledgeScopeMappingDetail[]
  },
  listKnowledgeVersions: (projectId: string) =>
    fetchApi<KnowledgeVersion[]>(`/api/projects/${projectId}/knowledge-versions`),
  listKnowledgeIndexVersions: (projectId: string) =>
    fetchApi<KnowledgeIndexVersion[]>(`/api/projects/${projectId}/knowledge-index-versions`),
  getKnowledgeVersion: (id: string) =>
    fetchApi<KnowledgeVersion>(`/api/knowledge-versions/${id}`),
  pushStg: (id: string) =>
    fetchApi<KnowledgeVersionPushResponse>(`/api/knowledge-versions/${id}/push-stg`, {
      method: 'POST',
    }),
  pushProd: (id: string) =>
    fetchApi<KnowledgeVersionPushResponse>(`/api/knowledge-versions/${id}/push-prod`, {
      method: 'POST',
    }),
  rollback: (id: string) =>
    fetchApi<KnowledgeVersionPushResponse>(`/api/knowledge-versions/${id}/rollback`, {
      method: 'POST',
    }),
}
