import { createAiProvider } from '@/lib/ai/provider'
import { evaluateConversationAuditTurn } from '@/lib/audit/evaluator'
import type { ConversationAuditEvaluationResult } from '@/lib/audit/evaluator'
import type { KnowledgeChunk } from '@/lib/audit/knowledge-chunker'
import { retrieveRelevantKnowledge } from '@/lib/audit/retriever'
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
import type { ConversationAuditRetrievedSource } from '@/types/database'

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
    const provider = providerFactory({
      provider: settings.provider,
      model: settings.model,
      apiKey: settings.apiKey,
      baseUrl: settings.baseUrl,
    })

    const chunks = findKnowledgeChunksByJob(jobId).map(mapStoredChunkToKnowledgeChunk)
    const turns = findAuditTurnsByJob(jobId)

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
      yield {
        type: 'audit-turn-start',
        data: {
          turnId: turn.id,
          index: turn.turnIndex,
        },
      }

      const retrieved = retrieveKnowledge(chunks, turn.userMessage, 5)
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

      yield {
        type: 'audit-turn-done',
        data: {
          turnId: turn.id,
          hasIssue: result.hasIssue,
        },
      }
    }

    updateConversationAuditJob(jobId, {
      status: 'completed',
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
