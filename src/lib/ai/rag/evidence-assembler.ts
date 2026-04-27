import {
  anchorPhraseScore,
  lexicalOverlapScore,
  phraseOverlapBonus,
} from './text'
import type { RetrievalChunk, RetrievalResult } from './types'

export interface AssembledEvidence {
  text: string
  docId: string
  chunkIds: string[]
}

interface ScoredCandidate {
  score: number
  routeScore: number
  index: number
  result: RetrievalResult
}

function metadata(result: RetrievalResult): Record<string, unknown> {
  return result.metadata && typeof result.metadata === 'object' ? result.metadata : {}
}

function isExactSource(result: RetrievalResult): boolean {
  const resultMetadata = metadata(result)
  const isExactFaq = resultMetadata.isExactFaq ?? resultMetadata.is_exact_faq
  return (
    result.matchLane === 'exact_alias' ||
    result.matchLane === 'exact_lane' ||
    isExactFaq === true ||
    String(isExactFaq).trim().toLowerCase() === 'true'
  )
}

function combinedCandidateText(result: RetrievalResult): string {
  return result.matchedChunks
    .map((chunk) => [chunk.sectionTitle, chunk.chunkText].filter(Boolean).join('\n'))
    .join('\n')
}

function candidateMatchScore(query: string, question: string, candidateText: string): number {
  const questionMatch =
    lexicalOverlapScore(query, question) +
    (0.35 * phraseOverlapBonus(query, question)) +
    (0.28 * anchorPhraseScore(query, question))
  const contentMatch = lexicalOverlapScore(query, candidateText) + (0.24 * anchorPhraseScore(query, candidateText))
  return (0.16 * questionMatch) + (0.14 * contentMatch)
}

function scoreCandidates(
  query: string,
  recallResults: RetrievalResult[],
  candidateWindow: number,
): ScoredCandidate[] {
  const window = Math.max(1, candidateWindow)
  const scored = recallResults.slice(0, window).map((result, index) => {
    const candidateText = combinedCandidateText(result)
    const baseScore = Number.isFinite(result.rerankScore) ? result.rerankScore ?? 0 : result.score
    const exactBonus = isExactSource(result) ? 0.6 : 0
    const routeScore = candidateMatchScore(query, result.question, candidateText)
    const score = exactBonus + (0.1 * Math.max(0, Math.min(baseScore, 1))) + routeScore
    return { score, routeScore, index, result }
  })

  return scored.sort((left, right) => {
    if (right.score !== left.score) return right.score - left.score
    if (right.routeScore !== left.routeScore) return right.routeScore - left.routeScore
    return left.index - right.index
  })
}

export function selectAnswerCandidate(
  query: string,
  recallResults: RetrievalResult[],
  options: { candidateWindow?: number } = {},
): RetrievalResult | null {
  const pool = scoreCandidates(query, recallResults, options.candidateWindow ?? 5)
  return pool[0]?.result ?? null
}

export function selectionScoreMargin(
  query: string,
  recallResults: RetrievalResult[],
  options: { candidateWindow?: number } = {},
): number {
  const pool = scoreCandidates(query, recallResults, options.candidateWindow ?? 5)
  if (pool.length < 2) return Number.POSITIVE_INFINITY
  return pool[0].score - pool[1].score
}

function withSectionTitle(chunk: RetrievalChunk, text: string): string {
  const sectionTitle = chunk.sectionTitle.trim()
  if (!sectionTitle || sectionTitle === '概述' || sectionTitle === '问题') {
    return text
  }
  if (text.slice(0, 80).includes(sectionTitle)) {
    return text
  }
  return `${sectionTitle}\n${text}`.trim()
}

function shouldKeepChunk(query: string, text: string, hasPrimarySelection: boolean, chunk: RetrievalChunk): boolean {
  if (chunk.chunkKind === 'note' && hasPrimarySelection) {
    return true
  }
  const relevance =
    lexicalOverlapScore(query, text) +
    phraseOverlapBonus(query, text) +
    anchorPhraseScore(query, text)
  return relevance > 0
}

export function assembleEvidence(
  query: string,
  recallResults: RetrievalResult[],
  options: { candidateWindow?: number } = {},
): AssembledEvidence | null {
  const bestResult = selectAnswerCandidate(query, recallResults, options)
  if (!bestResult || bestResult.matchedChunks.length === 0) {
    return null
  }

  const orderedChunks = [...bestResult.matchedChunks].sort((left, right) => left.chunkIndex - right.chunkIndex)
  const exactSource = isExactSource(bestResult)
  const seen = new Set<string>()
  const candidates: Array<{ chunk: RetrievalChunk; text: string }> = []

  for (const chunk of orderedChunks) {
    const text = withSectionTitle(chunk, chunk.chunkText.trim())
    const normalized = text.replace(/\s+/g, '')
    if (!text || !normalized || seen.has(normalized)) {
      continue
    }
    seen.add(normalized)
    candidates.push({ chunk, text })
  }

  if (candidates.length === 0) {
    return null
  }

  const selected: Array<{ chunk: RetrievalChunk; text: string }> = []
  if (exactSource && candidates.length <= 8) {
    selected.push(...candidates)
  } else {
    let hasPrimarySelection = false
    for (const candidate of candidates) {
      if (shouldKeepChunk(query, candidate.text, hasPrimarySelection, candidate.chunk)) {
        if (candidate.chunk.chunkKind !== 'note') {
          hasPrimarySelection = true
        }
        selected.push(candidate)
      }
    }
  }

  const finalParts = selected.length > 0 ? selected : candidates
  if (finalParts.length === 0) {
    return null
  }

  return {
    text: finalParts.map((part) => part.text).join('\n'),
    docId: bestResult.docId,
    chunkIds: finalParts.map((part) => part.chunk.chunkId),
  }
}
