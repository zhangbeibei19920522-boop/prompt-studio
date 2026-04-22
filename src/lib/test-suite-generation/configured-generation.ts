import { findKnowledgeIndexVersionById } from '@/lib/db/repositories/knowledge-index-versions'
import { findDocumentById } from '@/lib/db/repositories/documents'
import { findPromptById } from '@/lib/db/repositories/prompts'
import {
  getTestRouteTargetId,
  getTestRouteTargetType,
} from '@/lib/test-suite-routing'
import type {
  GenerateConfiguredTestSuiteRequest,
} from '@/types/api'
import type {
  MessageReference,
  TestConversationMode,
  TestGenerationSection,
  TestGenerationStructure,
  TestGenerationTargetType,
  TestSuiteWorkflowMode,
} from '@/types/database'

export function isValidSection(value: unknown): value is TestGenerationSection {
  return value === 'full-flow' || value === 'unit'
}

export function isValidStructure(value: unknown): value is TestGenerationStructure {
  return value === 'single' || value === 'multi'
}

export function isValidTargetType(value: unknown): value is TestGenerationTargetType {
  return value === 'prompt' || value === 'index-version'
}

export function isValidConversationMode(value: unknown): value is TestConversationMode {
  return value === 'single-turn' || value === 'multi-turn'
}

function getPromptTitle(promptId: string | null) {
  if (!promptId) return null
  return findPromptById(promptId)?.title ?? null
}

function getIndexVersionTitle(indexVersionId: string | null) {
  if (!indexVersionId) return null
  return findKnowledgeIndexVersionById(indexVersionId)?.name ?? indexVersionId
}

function formatRouteTarget(route: { promptId: string; targetType?: 'prompt' | 'index-version'; targetId?: string }) {
  const targetType = getTestRouteTargetType(route)
  const targetId = getTestRouteTargetId(route)

  if (targetType === 'index-version') {
    return `索引版本：${getIndexVersionTitle(targetId)}`
  }

  return `Prompt：${getPromptTitle(targetId) ?? targetId}`
}

export function getConfiguredSuitePromptId(body: GenerateConfiguredTestSuiteRequest): string | null {
  if (body.section === 'full-flow' && body.structure === 'single') {
    return body.promptId
  }

  if (body.section === 'unit' && body.targetType === 'prompt') {
    return body.targetId
  }

  return null
}

export function getConfiguredSuiteWorkflowMode(
  body: GenerateConfiguredTestSuiteRequest
): TestSuiteWorkflowMode {
  return body.section === 'full-flow' && body.structure === 'multi' ? 'routing' : 'single'
}

export function buildPendingSuiteName(body: GenerateConfiguredTestSuiteRequest): string {
  if (body.section === 'full-flow') {
    if (body.structure === 'single') {
      return `${getPromptTitle(body.promptId) ?? '单 Prompt'} 测试集`
    }

    return `${getPromptTitle(body.routingConfig?.entryPromptId ?? null) ?? '多 Prompt'} 全流程测试集`
  }

  if (body.targetType === 'prompt') {
    return `${getPromptTitle(body.targetId) ?? 'Prompt'} 单元测试`
  }

  return `${body.targetId ?? '索引版本'} 单元测试`
}

export function buildPendingSuiteDescription(body: GenerateConfiguredTestSuiteRequest): string {
  const conversationSummary =
    body.conversationMode === 'multi-turn'
      ? `多轮对话 ${body.minTurns}-${body.maxTurns} 轮`
      : '单轮对话'

  const sourceCount = body.generationSourceIds.length
  return `正在生成 ${body.caseCount} 个测试用例 · ${conversationSummary} · ${sourceCount} 个来源`
}

export function buildGenerationReferences(
  body: GenerateConfiguredTestSuiteRequest
): MessageReference[] {
  const references: MessageReference[] = []
  const seen = new Set<string>()

  function addPrompt(promptId: string | null) {
    if (!promptId) return
    const prompt = findPromptById(promptId)
    if (!prompt) return
    const key = `prompt:${prompt.id}`
    if (seen.has(key)) return
    seen.add(key)
    references.push({
      type: 'prompt',
      id: prompt.id,
      title: prompt.title,
    })
  }

  function addDocument(documentId: string | null) {
    if (!documentId) return
    const document = findDocumentById(documentId)
    if (!document) return
    const key = `document:${document.id}`
    if (seen.has(key)) return
    seen.add(key)
    references.push({
      type: 'document',
      id: document.id,
      title: document.name,
    })
  }

  if (body.section === 'full-flow') {
    if (body.structure === 'single') {
      addPrompt(body.promptId)
    } else {
      addPrompt(body.routingConfig?.entryPromptId ?? null)
      for (const route of body.routingConfig?.routes ?? []) {
        if (getTestRouteTargetType(route) === 'prompt') {
          addPrompt(getTestRouteTargetId(route))
        }
      }
    }
  } else if (body.targetType === 'prompt') {
    addPrompt(body.targetId)
  }

  for (const sourceId of body.generationSourceIds) {
    if (sourceId.startsWith('prompt:')) {
      addPrompt(sourceId.replace(/^prompt:/, ''))
    } else if (sourceId.startsWith('document:')) {
      addDocument(sourceId.replace(/^document:/, ''))
    }
  }

  return references
}

export function buildGenerationContent(
  body: GenerateConfiguredTestSuiteRequest,
  references: MessageReference[]
): string {
  const promptTitle = (() => {
    const promptId =
      body.section === 'full-flow'
        ? body.structure === 'single'
          ? body.promptId
          : body.routingConfig?.entryPromptId ?? null
        : body.targetType === 'prompt'
          ? body.targetId
          : null
    return getPromptTitle(promptId) ?? '未命名 Prompt'
  })()

  const sourceSummary = references
    .filter((reference) => body.generationSourceIds.includes(`${reference.type}:${reference.id}`))
    .map((reference) => reference.title)
    .join('、')

  const parts = [
    body.section === 'full-flow'
      ? body.structure === 'multi'
        ? '请生成一套多 Prompt 全流程测试集。'
        : `请为「${promptTitle}」生成一套单 Prompt 全流程测试集。`
      : body.targetType === 'index-version'
        ? `请为索引版本「${body.targetId ?? '当前索引版本'}」生成一套单元测试集。`
        : `请为「${promptTitle}」生成一套单元测试集。`,
    `请生成 ${body.caseCount} 个测试用例。`,
    body.conversationMode === 'multi-turn'
      ? `测试用例形式：多轮对话，轮次区间 ${body.minTurns}-${body.maxTurns}。`
      : '测试用例形式：单轮对话。',
  ]

  if (body.section === 'full-flow' && body.structure === 'multi' && body.routingConfig) {
    parts.push(
      `入口 Prompt：${getPromptTitle(body.routingConfig.entryPromptId) ?? body.routingConfig.entryPromptId}。`
    )
    parts.push(
      `路由规则：${body.routingConfig.routes
        .map((route) => `${route.intent} -> ${formatRouteTarget(route)}`)
        .join('；')}。`
    )
  }

  if (body.section === 'unit' && body.targetType === 'index-version') {
    if (body.embeddingRequestUrl) {
      parts.push(`Embedding 请求 URL：${body.embeddingRequestUrl}。`)
    }
    if (body.embeddingModelName) {
      parts.push(`Embedding 模型名称：${body.embeddingModelName}。`)
    }
  }

  if (sourceSummary.length > 0) {
    parts.push(`请优先结合这些生成来源设计用例：${sourceSummary}。`)
  }

  return parts.join('\n')
}
