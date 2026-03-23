import type { KnowledgeChunk } from '@/lib/audit/knowledge-chunker'

export interface RetrievedKnowledge {
  chunk: KnowledgeChunk
  score: number
}

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function tokenize(value: string): string[] {
  const normalized = normalizeText(value)
  const wordTokens = normalized
    .split(' ')
    .map((token) => token.trim())
    .filter((token) => token.length > 1)
    .filter((token) => /[a-z0-9]/.test(token))

  const chineseSequences = normalized.match(/[\u4e00-\u9fff]+/g) ?? []
  const chineseTokens = chineseSequences.flatMap((sequence) => {
    if (sequence.length <= 2) {
      return [sequence, ...sequence.split('')]
    }

    const grams: string[] = []
    for (let index = 0; index < sequence.length - 1; index += 1) {
      grams.push(sequence.slice(index, index + 2))
    }

    return [...sequence.split(''), ...grams]
  })

  return Array.from(new Set([...wordTokens, ...chineseTokens]))
}

function buildQueryPhrases(tokens: string[]): string[] {
  const phrases: string[] = []

  for (let index = 0; index < tokens.length - 1; index += 1) {
    phrases.push(`${tokens[index]} ${tokens[index + 1]}`)
  }

  return phrases
}

function isTitleLikeChunk(content: string): boolean {
  const normalized = normalizeText(content)
  return (
    normalized.length > 0
    && normalized.length <= 20
    && !content.includes('|')
    && !/[.!?。！？:：;；]/.test(content)
  )
}

function scoreChunk(chunk: KnowledgeChunk, query: string): number {
  const queryTokens = tokenize(query)
  const chunkText = normalizeText(chunk.content)
  const chunkTokens = new Set(tokenize(chunk.content))

  if (queryTokens.length === 0 || chunkTokens.size === 0) {
    return 0
  }

  let overlapCount = 0
  for (const token of queryTokens) {
    if (chunkTokens.has(token)) {
      overlapCount += 1
    }
  }

  let phraseBonus = 0
  for (const phrase of buildQueryPhrases(queryTokens)) {
    if (chunkText.includes(phrase)) {
      phraseBonus += 2
    }
  }

  const shortPenalty = chunkText.length < 12 ? 0.5 : 0
  const titlePenalty = isTitleLikeChunk(chunk.content) ? 2 : 0
  const detailBonus = chunk.content.length >= 24 ? 1 : 0
  return overlapCount * 3 + phraseBonus + detailBonus - shortPenalty - titlePenalty
}

export function retrieveRelevantKnowledge(
  chunks: KnowledgeChunk[],
  query: string,
  limit = 5
): RetrievedKnowledge[] {
  if (!normalizeText(query)) {
    return []
  }

  return chunks
    .map((chunk) => ({
      chunk,
      score: scoreChunk(chunk, query),
    }))
    .filter((result) => result.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, limit)
}
