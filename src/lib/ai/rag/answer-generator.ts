import type { ChatMessage, ChatOptions } from '@/types/ai'

import { assembleEvidence, selectionScoreMargin } from './evidence-assembler'
import type { RagLlmClient, RetrievalResult } from './types'

export interface AnswerPolicyConfig {
  extractiveEnabled: boolean
  minExtractiveMargin: number
  candidateWindow: number
  retrievalTopK: number
  llmOptions?: ChatOptions
}

export interface GenerateAnswerInput {
  query: string
  recallResults: RetrievalResult[]
  promptTemplate: string
  llmClient: RagLlmClient
  contextMessages?: ChatMessage[]
  policy?: Partial<AnswerPolicyConfig>
}

export interface GenerateAnswerResult {
  answerText: string
  answerMode: 'extractive' | 'llm_fallback'
  selectedDocId: string | null
  selectedChunkIds: string[]
  selectionMargin: number | null
  evidenceText: string
  llmMessages: ChatMessage[]
}

const DEFAULT_POLICY: AnswerPolicyConfig = {
  extractiveEnabled: true,
  minExtractiveMargin: 0.15,
  candidateWindow: 5,
  retrievalTopK: 10,
  llmOptions: {
    temperature: 0,
  },
}

function renderEvidenceText(recallResults: RetrievalResult[], topK: number): string {
  return recallResults.slice(0, topK).map((result, index) => {
    const chunkBlock =
      result.matchedChunks.length > 0
        ? [
            '匹配片段:',
            ...result.matchedChunks.map((chunk) =>
              `[${chunk.chunkId}] (${chunk.chunkKind || 'faq'}) ${chunk.chunkText}`.trim(),
            ),
          ].join('\n')
        : (result.chunkText ?? '')

    return [
      `[${index + 1}] 问题: ${result.question}`,
      `文档ID: ${result.docId}`,
      `召回分数: ${result.score.toFixed(4)}`,
      chunkBlock,
    ].filter(Boolean).join('\n')
  }).join('\n\n')
}

function buildMessages(
  query: string,
  promptTemplate: string,
  evidenceText: string,
  contextMessages: ChatMessage[] = [],
): ChatMessage[] {
  return [
    {
      role: 'system',
      content: promptTemplate.replace('{rag_qas_text}', evidenceText),
    },
    ...(contextMessages.length > 0
      ? contextMessages
      : [
          {
            role: 'user' as const,
            content: query,
          },
        ]),
  ]
}

export async function generateAnswer(input: GenerateAnswerInput): Promise<GenerateAnswerResult> {
  if (!input.promptTemplate.includes('{rag_qas_text}')) {
    throw new Error('Prompt template must contain {rag_qas_text}')
  }

  const policy = {
    ...DEFAULT_POLICY,
    ...input.policy,
    llmOptions: {
      ...DEFAULT_POLICY.llmOptions,
      ...(input.policy?.llmOptions ?? {}),
    },
  }

  const assembled = policy.extractiveEnabled
    ? assembleEvidence(input.query, input.recallResults, {
        candidateWindow: policy.candidateWindow,
      })
    : null
  const selectionMargin = input.recallResults.length > 0
    ? selectionScoreMargin(input.query, input.recallResults, {
        candidateWindow: policy.candidateWindow,
      })
    : null

  if (
    assembled &&
    policy.extractiveEnabled &&
    selectionMargin !== null &&
    selectionMargin >= policy.minExtractiveMargin
  ) {
    return {
      answerText: assembled.text,
      answerMode: 'extractive',
      selectedDocId: assembled.docId,
      selectedChunkIds: assembled.chunkIds,
      selectionMargin,
      evidenceText: assembled.text,
      llmMessages: [],
    }
  }

  const evidenceText = renderEvidenceText(input.recallResults, policy.retrievalTopK)
  const llmMessages = buildMessages(
    input.query,
    input.promptTemplate,
    evidenceText,
    input.contextMessages ?? [],
  )
  const answerText = await input.llmClient.generate(
    llmMessages,
    policy.llmOptions,
  )

  return {
    answerText,
    answerMode: 'llm_fallback',
    selectedDocId: assembled?.docId ?? null,
    selectedChunkIds: assembled?.chunkIds ?? [],
    selectionMargin,
    evidenceText,
    llmMessages,
  }
}
