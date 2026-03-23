import { createAiProvider } from '@/lib/ai/provider'
import { evaluateConversationAuditConversation } from '@/lib/audit/process-evaluator'
import type { ConversationAuditConversationEvaluationResult } from '@/lib/audit/process-evaluator'
import { evaluateConversationAuditTurn } from '@/lib/audit/evaluator'
import type { ConversationAuditEvaluationResult } from '@/lib/audit/evaluator'
import type { KnowledgeChunk } from '@/lib/audit/knowledge-chunker'
import { retrieveRelevantKnowledge } from '@/lib/audit/retriever'
import {
  findAuditConversationsByJob,
  updateAuditConversationResult,
} from '@/lib/db/repositories/conversation-audit-conversations'
import { findKnowledgeChunksByJob } from '@/lib/db/repositories/conversation-audit-knowledge-chunks'
import {
  findConversationAuditJobById,
  updateConversationAuditJob,
} from '@/lib/db/repositories/conversation-audit-jobs'
import { findAuditTurnsByJob, updateAuditTurnResult } from '@/lib/db/repositories/conversation-audit-turns'
import { getSettings } from '@/lib/db/repositories/settings'
import type {
  AiProvider,
  AiProviderConfig,
  ConversationAuditRunEvent,
} from '@/types/ai'
import type {
  ConversationAuditConversation,
  ConversationAuditKnowledgeStatus,
  ConversationAuditOverallStatus,
  ConversationAuditRetrievedSource,
  ConversationAuditRiskLevel,
} from '@/types/database'

interface RunConversationAuditDependencies {
  createProvider?: (config: AiProviderConfig) => AiProvider
  retrieveKnowledge?: typeof retrieveRelevantKnowledge
  evaluateTurn?: (
    provider: AiProvider,
    input: {
      userMessage: string
      botReply: string
      knowledge: KnowledgeChunk[]
    }
  ) => Promise<ConversationAuditEvaluationResult>
  evaluateConversation?: (
    provider: AiProvider,
    input: {
      transcript: string
      knowledge: KnowledgeChunk[]
    }
  ) => Promise<ConversationAuditConversationEvaluationResult>
}

function previewText(text: string, maxLength = 240): string {
  if (text.length <= maxLength) {
    return text
  }

  return `${text.slice(0, maxLength)}...`
}

function mapStoredChunkToKnowledgeChunk(chunk: {
  sourceName: string
  sourceType: string
  chunkIndex: number
  content: string
  metadata: Record<string, unknown>
}): KnowledgeChunk {
  return {
    sourceName: chunk.sourceName,
    sourceType: chunk.sourceType,
    sheetName: typeof chunk.metadata.sheetName === 'string' ? chunk.metadata.sheetName : null,
    chunkIndex: chunk.chunkIndex,
    content: chunk.content,
  }
}

function mapRetrievedSources(
  results: ReturnType<typeof retrieveRelevantKnowledge>
): ConversationAuditRetrievedSource[] {
  return results.map(({ chunk, score }) => ({
    chunkId: `${chunk.sourceName}:${chunk.chunkIndex}`,
    sourceName: chunk.sourceName,
    score,
  }))
}

function summarizeRetrievedKnowledge(results: ReturnType<typeof retrieveRelevantKnowledge>) {
  return results.map(({ chunk, score }) => ({
    sourceName: chunk.sourceName,
    chunkIndex: chunk.chunkIndex,
    sheetName: chunk.sheetName,
    score,
    contentPreview: previewText(chunk.content),
  }))
}

function buildConversationTranscript(turns: Array<{ turnIndex: number; userMessage: string; botReply: string }>): string {
  return turns
    .slice()
    .sort((a, b) => a.turnIndex - b.turnIndex)
    .map((turn, index) => {
      const parts = [`Round ${index + 1}`, `User: ${turn.userMessage}`]
      if (turn.botReply) {
        parts.push(`Bot: ${turn.botReply}`)
      }
      return parts.join('\n')
    })
    .join('\n\n')
}

function deriveKnowledgeStatus(turns: Array<{ hasIssue: boolean | null }>): ConversationAuditKnowledgeStatus {
  if (turns.some((turn) => turn.hasIssue === true)) {
    return 'failed'
  }

  if (turns.length > 0 && turns.every((turn) => turn.hasIssue === false)) {
    return 'passed'
  }

  return 'unknown'
}

function deriveOverallStatus(
  processStatus: ConversationAuditConversation['processStatus'],
  knowledgeStatus: ConversationAuditKnowledgeStatus
): ConversationAuditOverallStatus {
  if (processStatus === 'failed' || knowledgeStatus === 'failed') {
    return 'failed'
  }

  if (processStatus === 'passed' && knowledgeStatus === 'passed') {
    return 'passed'
  }

  return 'unknown'
}

function deriveRiskLevel(
  processStatus: ConversationAuditConversation['processStatus'],
  knowledgeStatus: ConversationAuditKnowledgeStatus
): ConversationAuditRiskLevel {
  if (processStatus === 'failed' && knowledgeStatus === 'failed') {
    return 'high'
  }

  if (processStatus === 'failed' || knowledgeStatus === 'failed') {
    return 'medium'
  }

  return 'low'
}

function deriveConversationSummary(
  processStatus: ConversationAuditConversation['processStatus'],
  knowledgeStatus: ConversationAuditKnowledgeStatus,
  processSummary: string
): string {
  if (processSummary.trim()) {
    return processSummary
  }

  if (processStatus === 'failed' && knowledgeStatus === 'failed') {
    return '流程存在异常，且有知识问答错误。'
  }

  if (processStatus === 'failed') {
    return '流程存在异常。'
  }

  if (knowledgeStatus === 'failed') {
    return '知识问答存在错误。'
  }

  if (processStatus === 'passed' && knowledgeStatus === 'passed') {
    return '流程和知识问答均通过。'
  }

  return '当前会话仍有待确认的评估结果。'
}

export async function* runConversationAudit(
  jobId: string,
  dependencies: RunConversationAuditDependencies = {}
): AsyncGenerator<ConversationAuditRunEvent> {
  const job = findConversationAuditJobById(jobId)
  if (!job) {
    throw new Error(`Conversation audit job not found: ${jobId}`)
  }

  try {
    const settings = getSettings()
    const providerFactory = dependencies.createProvider ?? createAiProvider
    const retrieveKnowledge = dependencies.retrieveKnowledge ?? retrieveRelevantKnowledge
    const evaluateTurn = dependencies.evaluateTurn ?? evaluateConversationAuditTurn
    const evaluateConversation = dependencies.evaluateConversation ?? evaluateConversationAuditConversation
    const provider = providerFactory({
      provider: settings.provider,
      model: settings.model,
      apiKey: settings.apiKey,
      baseUrl: settings.baseUrl,
    })

    const chunks = findKnowledgeChunksByJob(jobId).map(mapStoredChunkToKnowledgeChunk)
    const conversations = findAuditConversationsByJob(jobId)
    const turns = findAuditTurnsByJob(jobId)

    console.log('[ConversationAudit] Starting job', {
      jobId,
      knowledgeChunkCount: chunks.length,
      totalTurns: turns.length,
    })

    updateConversationAuditJob(jobId, {
      status: 'running',
      issueCount: 0,
      totalTurns: turns.length,
      errorMessage: null,
      completedAt: null,
    })

    yield {
      type: 'audit-start',
      data: {
        jobId,
        totalTurns: turns.length,
      },
    }

    let issueCount = 0

    for (const turn of turns) {
      console.log('[ConversationAudit] Starting turn', {
        jobId,
        turnId: turn.id,
        turnIndex: turn.turnIndex,
        userMessage: turn.userMessage,
        botReply: turn.botReply,
      })

      yield {
        type: 'audit-turn-start',
        data: {
          turnId: turn.id,
          index: turn.turnIndex,
        },
      }

      const retrieved = retrieveKnowledge(chunks, turn.userMessage, 5)
      console.log('[ConversationAudit] Retrieved knowledge', {
        jobId,
        turnId: turn.id,
        turnIndex: turn.turnIndex,
        retrievedSourceCount: retrieved.length,
        retrievedSources: summarizeRetrievedKnowledge(retrieved),
      })
      const result = await evaluateTurn(provider, {
        userMessage: turn.userMessage,
        botReply: turn.botReply,
        knowledge: retrieved.map(({ chunk }) => chunk),
      })

      if (result.hasIssue === true) {
        issueCount += 1
      }

      updateAuditTurnResult(turn.id, {
        hasIssue: result.hasIssue,
        knowledgeAnswer: result.knowledgeAnswer,
        retrievedSources: mapRetrievedSources(retrieved),
      })

      console.log('[ConversationAudit] Completed turn', {
        jobId,
        turnId: turn.id,
        turnIndex: turn.turnIndex,
        hasIssue: result.hasIssue,
        knowledgeAnswer: result.knowledgeAnswer,
        retrievedSourceCount: retrieved.length,
      })

      yield {
        type: 'audit-turn-done',
        data: {
          turnId: turn.id,
          hasIssue: result.hasIssue,
        },
      }
    }

    const turnsByConversation = new Map<string, typeof turns>()

    for (const turn of findAuditTurnsByJob(jobId)) {
      const existing = turnsByConversation.get(turn.conversationId) ?? []
      existing.push(turn)
      turnsByConversation.set(turn.conversationId, existing)
    }

    for (const conversation of conversations) {
      const conversationTurns = turnsByConversation.get(conversation.id) ?? []
      const transcript = buildConversationTranscript(conversationTurns)
      const processResult = await evaluateConversation(provider, {
        transcript,
        knowledge: chunks,
      })
      const knowledgeStatus = deriveKnowledgeStatus(conversationTurns)
      const overallStatus = deriveOverallStatus(processResult.processStatus, knowledgeStatus)
      const riskLevel = deriveRiskLevel(processResult.processStatus, knowledgeStatus)
      const summary = deriveConversationSummary(
        processResult.processStatus,
        knowledgeStatus,
        processResult.summary
      )

      updateAuditConversationResult(conversation.id, {
        overallStatus,
        processStatus: processResult.processStatus,
        knowledgeStatus,
        riskLevel,
        summary,
        processSteps: processResult.processSteps,
      })
    }

    updateConversationAuditJob(jobId, {
      status: 'completed',
      issueCount,
      totalTurns: turns.length,
    })

    console.log('[ConversationAudit] Completed job', {
      jobId,
      issueCount,
      totalTurns: turns.length,
    })

    yield {
      type: 'audit-complete',
      data: {
        jobId,
        issueCount,
        totalTurns: turns.length,
      },
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('[ConversationAudit] Job failed', {
      jobId,
      error: message,
    })
    updateConversationAuditJob(jobId, {
      status: 'failed',
      errorMessage: message,
    })

    yield {
      type: 'audit-error',
      data: {
        error: message,
      },
    }
  }
}
