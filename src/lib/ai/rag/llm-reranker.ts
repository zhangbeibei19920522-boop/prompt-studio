import { createAiProvider } from '@/lib/ai/provider'
import { getSettings } from '@/lib/db/repositories/settings'
import type { ChatMessage, ChatOptions } from '@/types/ai'
import type { RetrievalResult } from './types'

const LLM_RERANK_PROMPT = `你是一个文档相关性评分器。给定用户问题和一组候选文档，判断每个文档是否能回答用户问题。

用户问题：{query}

{candidates_text}

对每个候选文档给出 0-10 的相关性评分：
- 10：文档直接回答了用户问题
- 7-9：文档包含回答所需的核心信息
- 4-6：文档涉及同一主题但不直接回答
- 1-3：主题有交集但角度不同
- 0：不相关

只输出 JSON 数组：[{"index": 1, "score": 8}, ...]`

export interface RagLlmReranker {
  rerank(query: string, candidates: RetrievalResult[], topK: number): Promise<RetrievalResult[]>
}

export interface CreateRagLlmRerankerInput {
  chat: (messages: ChatMessage[], options?: ChatOptions) => Promise<string>
  batchSize?: number
  temperature?: number
  maxTokens?: number
}

function stage2Score(candidate: RetrievalResult): number {
  return candidate.rerankScore ?? candidate.score ?? 0
}

function normalizeStage2Scores(candidates: RetrievalResult[]): number[] {
  const scores = candidates.map(stage2Score)
  if (scores.length === 0) return []

  const minScore = Math.min(...scores)
  const maxScore = Math.max(...scores)
  if (maxScore <= minScore) {
    return scores.map(() => 1)
  }
  return scores.map((score) => (score - minScore) / (maxScore - minScore))
}

function parseScores(content: string, batchSize: number): Map<number, number> {
  const match = content.match(/\[[\s\S]*\]/)
  const text = match ? match[0] : content.trim()
  if (!text) return new Map()

  const payload = JSON.parse(text) as unknown
  if (!Array.isArray(payload)) return new Map()

  const scores = new Map<number, number>()
  for (const row of payload) {
    if (!row || typeof row !== 'object') continue
    const record = row as Record<string, unknown>
    const index = Math.trunc(Number(record.index)) - 1
    const score = Math.max(0, Math.min(10, Number(record.score)))
    if (index >= 0 && index < batchSize && Number.isFinite(score)) {
      scores.set(index, score)
    }
  }
  return scores
}

function renderCandidates(candidates: RetrievalResult[]): string {
  return candidates.map((candidate, index) => {
    const chunkLines = candidate.matchedChunks.slice(0, 5).map((chunk) => {
      const sectionTitle = chunk.sectionTitle || '概述'
      return `- 片段 [${sectionTitle}]：${chunk.chunkText.slice(0, 1200)}`
    })
    const fallback = candidate.chunkText
      ? [`- 片段 [概述]：${candidate.chunkText.slice(0, 1200)}`]
      : []

    return [
      `候选 ${index + 1}：`,
      `- 标题：${candidate.question}`,
      ...(chunkLines.length > 0 ? chunkLines : fallback),
    ].join('\n')
  }).join('\n\n')
}

function batched<T>(items: T[], batchSize: number): T[][] {
  const batches: T[][] = []
  for (let index = 0; index < items.length; index += batchSize) {
    batches.push(items.slice(index, index + batchSize))
  }
  return batches
}

async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  task: (item: T, index: number) => Promise<void>,
): Promise<void> {
  let nextIndex = 0

  async function worker(): Promise<void> {
    while (nextIndex < items.length) {
      const index = nextIndex
      nextIndex += 1
      await task(items[index], index)
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(Math.max(1, concurrency), items.length) }, () => worker()),
  )
}

export function createRagLlmReranker(input: CreateRagLlmRerankerInput): RagLlmReranker {
  const batchSize = Math.max(1, input.batchSize ?? 10)
  const temperature = input.temperature ?? 0
  const maxTokens = input.maxTokens ?? 1024

  return {
    async rerank(query, candidates, topK) {
      const limit = Math.max(1, topK)
      const ranked = [...candidates].sort((left, right) => stage2Score(right) - stage2Score(left))
      if (ranked.length === 0) return []

      const normalizedStage2 = normalizeStage2Scores(ranked)
      const llmScores = new Map<number, number>()
      const batches = batched(ranked, batchSize)

      await runWithConcurrency(batches, 4, async (batch, batchIndex) => {
        try {
          const content = await input.chat(
            [
              {
                role: 'user',
                content: LLM_RERANK_PROMPT
                  .replace('{query}', query)
                  .replace('{candidates_text}', renderCandidates(batch)),
              },
            ],
            {
              temperature,
              maxTokens,
            },
          )
          const scores = parseScores(content, batch.length)
          for (const [localIndex, score] of scores.entries()) {
            llmScores.set((batchIndex * batchSize) + localIndex, score)
          }
        } catch {
          // qa_verify keeps reranking resilient: failed batches simply fall back to stage2 scores.
        }
      })

      return ranked
        .map((candidate, index) => {
          const llmScore = llmScores.get(index)
          const stage2 = normalizedStage2[index] ?? 0
          const combined = llmScore === undefined
            ? stage2
            : (0.6 * (llmScore / 10)) + (0.4 * stage2)
          return {
            ...candidate,
            llmRerankScore: llmScore,
            llmRerankCombinedScore: combined,
          }
        })
        .sort((left, right) => {
          if ((right.llmRerankCombinedScore ?? 0) !== (left.llmRerankCombinedScore ?? 0)) {
            return (right.llmRerankCombinedScore ?? 0) - (left.llmRerankCombinedScore ?? 0)
          }
          return stage2Score(right) - stage2Score(left)
        })
        .slice(0, limit)
    },
  }
}

export function createGlobalRagLlmReranker(): RagLlmReranker | null {
  let settings: ReturnType<typeof getSettings> | null = null
  try {
    settings = getSettings()
  } catch {
    settings = null
  }

  if (!settings?.apiKey || !settings.model) {
    return null
  }

  const provider = createAiProvider(settings)
  return createRagLlmReranker({
    chat: provider.chat,
    batchSize: Number(process.env.RAG_LLM_RERANK_BATCH_SIZE || 10),
  })
}
