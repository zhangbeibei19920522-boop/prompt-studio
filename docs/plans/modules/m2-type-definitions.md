# M2: 类型定义

> 依赖：M1 | 产出：所有实体的 TypeScript 类型

## 目标

定义所有数据实体的 TypeScript 类型，供数据库层、API 层和 UI 层共用。

## 文件清单

### `src/types/database.ts` — 数据库实体类型

```typescript
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

export interface PromptVariable {
  name: string
  description: string
  defaultValue?: string
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

export interface MessageReference {
  type: 'prompt' | 'document'
  id: string
  title: string
}

export interface MessageMetadata {
  type: 'plan' | 'preview' | 'diff'
  data: PlanData | PreviewData | DiffData
}
```

### `src/types/api.ts` — API 请求/响应类型

```typescript
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
```

### `src/types/ai.ts` — AI 相关类型

```typescript
// AI Provider 配置
export interface AiProviderConfig {
  provider: string
  apiKey: string
  model: string
  baseUrl: string
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

export interface BusinessInfo {
  description: string
  goal: string
  background: string
}

// Agent 规划
export interface AgentPlan {
  keyPoints: PlanKeyPoint[]
}

export interface PlanKeyPoint {
  index: number
  description: string
  action: 'create' | 'modify'
  targetPromptId?: string
  targetPromptTitle: string
}

// 流式响应事件
export type StreamEvent =
  | { type: 'text'; content: string }
  | { type: 'plan'; data: AgentPlan }
  | { type: 'preview'; data: PreviewData }
  | { type: 'diff'; data: DiffData }
  | { type: 'done' }
  | { type: 'error'; message: string }
```

## 提交

```bash
git add src/types/
git commit -m "feat: add TypeScript type definitions for all entities"
```
