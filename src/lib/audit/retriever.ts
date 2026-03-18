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
  return normalizeText(value)
    .split(' ')
    .map((token) => token.trim())
    .filter((token) => token.length > 1)
}

function buildQueryPhrases(tokens: string[]): string[] {
  const phrases: string[] = []

  for (let index = 0; index < tokens.length - 1; index += 1) {
    phrases.push(`${tokens[index]} ${tokens[index + 1]}`)
  }

  return phrases
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
  return overlapCount * 3 + phraseBonus - shortPenalty
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
    .sort((left, right) => right.score - left.score)
    .slice(0, limit)
}
