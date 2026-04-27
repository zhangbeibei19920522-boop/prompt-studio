import {
  anchorPhraseScore,
  cosineSimilarity,
  createLocalTextVector,
  lexicalOverlapScore,
  normalizeText,
  phraseOverlapBonus,
  tokenizeText,
} from './text'
import type { IndexIngestData, RetrievalChunk, RetrievalMatchLane, RetrievalResult } from './types'

export interface SearchIndexIngestInput {
  query: string
  ingest: IndexIngestData
  topK?: number
  retrievalTopK?: number
  rerankTopK?: number
  llmRerankTopK?: number
  bm25Enabled?: boolean
  rrfK?: number
  queryVector?: number[]
  llmReranker?: (query: string, candidates: RetrievalResult[], topK: number) => RetrievalResult[]
}

export interface SearchIndexIngestResult {
  results: RetrievalResult[]
}

interface InternalChunk {
  chunkId: string
  docId: string
  question: string
  answerPreview: string
  chunkText: string
  embeddingText: string
  chunkIndex: number
  chunkTotal: number
  chunkKind: string
  textType: string
  sectionTitle: string
  metadata: Record<string, unknown>
}

interface RankedChunk {
  chunkId: string
  score: number
}

interface Stage1Entry extends RetrievalResult {
  _documentMatches: RetrievalChunk[]
  _fallbackMatch: RetrievalChunk | null
}

const DEFAULT_RETRIEVAL_TOP_K = 50
const DEFAULT_RERANK_TOP_K = 40
const DEFAULT_LLM_RERANK_TOP_K = 10
const DEFAULT_RRF_K = 60

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

function asNumberArray(value: unknown): number[] {
  return Array.isArray(value)
    ? value.filter((item): item is number => typeof item === 'number' && Number.isFinite(item))
    : []
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function asBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') return value
  const normalized = String(value ?? '').trim().toLowerCase()
  return ['1', 'true', 'yes', 'y'].includes(normalized)
}

function getParentQuestion(parent: Record<string, unknown>): string {
  return asString(parent.question_clean) || asString(parent.question) || asString(asRecord(parent.metadata).question)
}

function getQuestionAliases(metadata: Record<string, unknown>, parent?: Record<string, unknown>): string[] {
  const parentMetadata = parent ? asRecord(parent.metadata) : {}
  return [
    ...asStringArray(parent?.question_aliases),
    ...asStringArray(parent?.questionAliases),
    ...asStringArray(parentMetadata.question_aliases),
    ...asStringArray(parentMetadata.questionAliases),
    ...asStringArray(metadata.question_aliases),
    ...asStringArray(metadata.questionAliases),
  ]
}

function getQuestionAliasSignatures(metadata: Record<string, unknown>, parent?: Record<string, unknown>): string[] {
  const parentMetadata = parent ? asRecord(parent.metadata) : {}
  return [
    ...asStringArray(parentMetadata.question_alias_signatures),
    ...asStringArray(parentMetadata.questionAliasSignatures),
    ...asStringArray(metadata.question_alias_signatures),
    ...asStringArray(metadata.questionAliasSignatures),
  ]
}

function getSourceParentQuestions(metadata: Record<string, unknown>, parent?: Record<string, unknown>): string[] {
  const parentMetadata = parent ? asRecord(parent.metadata) : {}
  return [
    ...asStringArray(parentMetadata.source_parent_questions),
    ...asStringArray(parentMetadata.sourceParentQuestions),
    ...asStringArray(metadata.source_parent_questions),
    ...asStringArray(metadata.sourceParentQuestions),
  ]
}

function toInternalChunk(
  rawChunk: Record<string, unknown>,
  parentById: Map<string, Record<string, unknown>>,
): InternalChunk | null {
  const docId = asString(rawChunk.parent_id) || asString(rawChunk.parentId)
  if (!docId) return null

  const parent = parentById.get(docId) ?? {}
  const rawMetadata = asRecord(rawChunk.metadata)
  const parentMetadata = asRecord(parent.metadata)
  const questionAliases = [
    ...asStringArray(parent.question_aliases),
    ...asStringArray(parent.questionAliases),
    ...asStringArray(parentMetadata.question_aliases),
    ...asStringArray(parentMetadata.questionAliases),
    ...asStringArray(rawMetadata.question_aliases),
    ...asStringArray(rawMetadata.questionAliases),
  ]
  const questionAliasSignatures = [
    ...asStringArray(parent.question_alias_signatures),
    ...asStringArray(parent.questionAliasSignatures),
    ...asStringArray(parentMetadata.question_alias_signatures),
    ...asStringArray(parentMetadata.questionAliasSignatures),
    ...asStringArray(rawMetadata.question_alias_signatures),
    ...asStringArray(rawMetadata.questionAliasSignatures),
  ]
  const sourceParentQuestions = [
    ...asStringArray(parent.source_parent_questions),
    ...asStringArray(parent.sourceParentQuestions),
    ...asStringArray(parentMetadata.source_parent_questions),
    ...asStringArray(parentMetadata.sourceParentQuestions),
    ...asStringArray(rawMetadata.source_parent_questions),
    ...asStringArray(rawMetadata.sourceParentQuestions),
  ]
  const question = getParentQuestion(parent) || asString(rawChunk.question)
  const sectionTitle = asString(rawChunk.section_title) || asString(rawChunk.sectionTitle)
  const chunkText = asString(rawChunk.chunk_text) || asString(rawChunk.chunkText)
  const chunkKind = asString(rawMetadata.chunk_kind) ||
    asString(rawMetadata.chunkKind) ||
    asString(rawChunk.chunk_kind) ||
    asString(rawChunk.chunk_type) ||
    asString(rawChunk.chunkKind) ||
    'faq'
  const textType = asString(rawMetadata.text_type) ||
    asString(rawMetadata.textType) ||
    asString(rawChunk.text_type) ||
    asString(rawChunk.textType) ||
    'document'
  const embeddingText = asString(rawChunk.embedding_text) ||
    asString(rawChunk.embeddingText) ||
    [question, sectionTitle, chunkText].filter(Boolean).join('\n')

  return {
    chunkId: asString(rawChunk.id) || asString(rawChunk.chunk_id) || asString(rawChunk.chunkId),
    docId,
    question,
    answerPreview: asString(parent.answer_preview) || asString(parent.answerPreview),
    chunkText,
    embeddingText,
    chunkIndex: asNumber(rawChunk.chunk_order ?? rawChunk.chunk_index ?? rawChunk.chunkIndex, 0),
    chunkTotal: asNumber(rawChunk.chunk_total ?? rawChunk.chunkTotal, 1),
    chunkKind,
    textType,
    sectionTitle,
    metadata: {
      ...parentMetadata,
      ...rawMetadata,
      question_aliases: questionAliases,
      question_alias_signatures: questionAliasSignatures,
      source_parent_questions: sourceParentQuestions,
      chunk_id: asString(rawChunk.id) || asString(rawChunk.chunk_id) || asString(rawChunk.chunkId),
      chunk_index: asNumber(rawChunk.chunk_order ?? rawChunk.chunk_index ?? rawChunk.chunkIndex, 0),
      chunk_total: asNumber(rawChunk.chunk_total ?? rawChunk.chunkTotal, 1),
      chunk_kind: chunkKind,
      text_type: textType,
      section_title: sectionTitle,
    },
  }
}

function buildChunks(ingest: IndexIngestData): InternalChunk[] {
  const parentById = new Map<string, Record<string, unknown>>()
  for (const parent of ingest.parents) {
    const id = asString(parent.id)
    if (id) {
      parentById.set(id, parent)
    }
  }

  return ingest.chunks
    .map((rawChunk) => toInternalChunk(rawChunk, parentById))
    .filter((chunk): chunk is InternalChunk => Boolean(chunk?.chunkId && chunk.docId && chunk.question))
}

function buildVectorByChunkId(ingest: IndexIngestData, chunks: InternalChunk[]): Map<string, number[]> {
  const vectors = new Map<string, number[]>()

  for (const rawVector of ingest.vectors ?? []) {
    const chunkId = asString(rawVector.chunk_id) || asString(rawVector.chunkId)
    const vector = asNumberArray(rawVector.vector)
    if (chunkId && vector.length > 0) {
      vectors.set(chunkId, vector)
    }
  }

  for (const chunk of chunks) {
    if (!vectors.has(chunk.chunkId)) {
      vectors.set(chunk.chunkId, createLocalTextVector(chunk.embeddingText))
    }
  }

  return vectors
}

function rankVectorChunks(
  queryVector: number[],
  chunks: InternalChunk[],
  vectorByChunkId: Map<string, number[]>,
  topK: number,
): RankedChunk[] {
  return chunks
    .map((chunk) => ({
      chunkId: chunk.chunkId,
      score: cosineSimilarity(queryVector, vectorByChunkId.get(chunk.chunkId) ?? []),
    }))
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score
      return right.chunkId.localeCompare(left.chunkId)
    })
    .slice(0, Math.max(1, topK))
}

function calculateBm25Results(query: string, chunks: InternalChunk[], topK: number): RankedChunk[] {
  const queryTokens = tokenizeText(query)
  if (queryTokens.length === 0 || chunks.length === 0) return []

  const corpus = chunks.map((chunk) => tokenizeText([chunk.question, chunk.chunkText].filter(Boolean).join(' ')))
  const docCount = corpus.length
  const docLengths = corpus.map((tokens) => tokens.length)
  const avgDocLength = docLengths.reduce((sum, length) => sum + length, 0) / (docLengths.length || 1)
  const documentFrequency = new Map<string, number>()
  const termFrequency = corpus.map((tokens) => {
    const counts = new Map<string, number>()
    for (const token of tokens) {
      counts.set(token, (counts.get(token) ?? 0) + 1)
    }
    for (const token of new Set(tokens)) {
      documentFrequency.set(token, (documentFrequency.get(token) ?? 0) + 1)
    }
    return counts
  })

  const k1 = 1.5
  const b = 0.75
  const rawScores = corpus.map((_tokens, docIndex) => {
    let score = 0
    const docLength = docLengths[docIndex] || 0
    const frequencies = termFrequency[docIndex]
    for (const token of queryTokens) {
      const frequency = frequencies.get(token) ?? 0
      if (!frequency) continue

      const df = documentFrequency.get(token) ?? 0
      const idf = Math.log(1 + ((docCount - df + 0.5) / (df + 0.5)))
      const numerator = frequency * (k1 + 1)
      const denominator = frequency + (k1 * (1 - b + (b * (docLength / (avgDocLength || 1)))))
      score += idf * (numerator / (denominator || 1))
    }
    return score
  })
  const positives = rawScores.filter((score) => score > 0)
  if (positives.length === 0) return []

  const minScore = Math.min(...positives)
  const maxScore = Math.max(...positives)
  return rawScores
    .map((score, index) => ({ score, index }))
    .filter((item) => item.score > 0)
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score
      return chunks[right.index].chunkId.localeCompare(chunks[left.index].chunkId)
    })
    .slice(0, Math.max(1, topK))
    .map((item) => ({
      chunkId: chunks[item.index].chunkId,
      score: maxScore > minScore ? (item.score - minScore) / (maxScore - minScore) : 1,
    }))
}

function singleLaneRrf(results: RankedChunk[], rrfK: number): Map<string, number> {
  const merged = new Map<string, number>()
  results.forEach((result, index) => {
    merged.set(result.chunkId, (merged.get(result.chunkId) ?? 0) + (1 / (rrfK + index + 1)))
  })
  return merged
}

function rrfMerge(vectorResults: RankedChunk[], bm25Results: RankedChunk[], rrfK: number): Map<string, number> {
  const merged = singleLaneRrf(vectorResults, rrfK)
  bm25Results.forEach((result, index) => {
    merged.set(result.chunkId, (merged.get(result.chunkId) ?? 0) + (1 / (rrfK + index + 1)))
  })
  return merged
}

function normalizedLookupText(text: string): string {
  return normalizeText(text)
}

function exactAliasScore(queryNormalized: string, chunk: InternalChunk): number {
  if (!queryNormalized) return 0

  const candidates = [
    chunk.question,
    asString(chunk.metadata.question_normalized),
    asString(chunk.metadata.questionNormalized),
    asString(chunk.metadata.question_signature),
    asString(chunk.metadata.questionSignature),
    ...getQuestionAliases(chunk.metadata),
    ...getQuestionAliasSignatures(chunk.metadata),
    ...getSourceParentQuestions(chunk.metadata),
  ]
  const exactCandidates = candidates.map((candidate) => normalizedLookupText(candidate)).filter(Boolean)
  if (!exactCandidates.includes(queryNormalized)) {
    return 0
  }

  return asBoolean(chunk.metadata.is_exact_faq ?? chunk.metadata.isExactFaq) ? 2 : 1.4
}

function exactDocIds(query: string, chunks: InternalChunk[]): string[] {
  const queryNormalized = normalizedLookupText(query)
  const docIds: string[] = []
  for (const chunk of chunks) {
    if (exactAliasScore(queryNormalized, chunk) > 0 && !docIds.includes(chunk.docId)) {
      docIds.push(chunk.docId)
    }
  }
  return docIds
}

function matchLane(exactMatchScore: number, semanticScore: number, bm25Score: number): RetrievalMatchLane {
  if (exactMatchScore > 0) return 'exact_alias'
  if (semanticScore > 0) return 'semantic'
  if (bm25Score > 0) return 'bm25'
  return 'semantic'
}

function docSortKey(entry: RetrievalResult): [number, number, number, number, string] {
  return [
    entry.score || 0,
    entry.exactMatchScore || 0,
    entry.bm25Score || 0,
    entry.semanticScore || 0,
    entry.docId || '',
  ]
}

function compareSortKey(left: [number, number, number, number, string], right: [number, number, number, number, string]): number {
  for (let index = 0; index < 4; index++) {
    if (left[index] !== right[index]) {
      return Number(left[index]) - Number(right[index])
    }
  }
  return String(left[4]).localeCompare(String(right[4]))
}

function isBetterChunkScore(
  next: [number, number, number, number],
  current: [number, number, number, number],
): boolean {
  for (let index = 0; index < next.length; index++) {
    if (next[index] !== current[index]) return next[index] > current[index]
  }
  return false
}

function toRetrievalChunk(
  chunk: InternalChunk,
  scores: {
    score: number
    semanticScore: number
    bm25Score: number
    rrfScore: number
    exactMatchScore: number
    matchLane: RetrievalMatchLane
  },
): RetrievalChunk {
  return {
    chunkId: chunk.chunkId,
    chunkIndex: chunk.chunkIndex,
    chunkKind: chunk.chunkKind,
    sectionTitle: chunk.sectionTitle,
    chunkText: chunk.chunkText,
    ...scores,
  }
}

function createStage1Entry(chunk: InternalChunk, scores: {
  score: number
  semanticScore: number
  bm25Score: number
  rrfScore: number
  exactMatchScore: number
  matchLane: RetrievalMatchLane
}): Stage1Entry {
  return {
    docId: chunk.docId,
    score: scores.score,
    distance: 1 - scores.score,
    semanticScore: scores.semanticScore,
    bm25Score: scores.bm25Score,
    rrfScore: scores.rrfScore,
    exactMatchScore: scores.exactMatchScore,
    question: chunk.question,
    answerPreview: chunk.answerPreview,
    chunkText: '',
    metadata: chunk.metadata,
    matchLane: scores.matchLane,
    matchedChunks: [],
    _documentMatches: [],
    _fallbackMatch: null,
  }
}

function buildStage1Results(input: {
  query: string
  chunks: InternalChunk[]
  retrievalTopK: number
  chunkRrfScores: Map<string, number>
  vectorResults: RankedChunk[]
  bm25Results: RankedChunk[]
  exactDocIds: string[]
}): RetrievalResult[] {
  const chunkById = new Map(input.chunks.map((chunk) => [chunk.chunkId, chunk]))
  const vectorScoreMap = new Map(input.vectorResults.map((result) => [result.chunkId, result.score]))
  const bm25ScoreMap = new Map(input.bm25Results.map((result) => [result.chunkId, result.score]))
  const queryNormalized = normalizedLookupText(input.query)
  const docEntries = new Map<string, Stage1Entry>()
  const rankedChunkIds = [...input.chunkRrfScores.keys()].sort((left, right) => {
    const leftTuple: [number, number, number, string] = [
      input.chunkRrfScores.get(left) ?? 0,
      bm25ScoreMap.get(left) ?? 0,
      vectorScoreMap.get(left) ?? 0,
      left,
    ]
    const rightTuple: [number, number, number, string] = [
      input.chunkRrfScores.get(right) ?? 0,
      bm25ScoreMap.get(right) ?? 0,
      vectorScoreMap.get(right) ?? 0,
      right,
    ]
    for (let index = 0; index < 3; index++) {
      if (rightTuple[index] !== leftTuple[index]) {
        return Number(rightTuple[index]) - Number(leftTuple[index])
      }
    }
    return String(rightTuple[3]).localeCompare(String(leftTuple[3]))
  })

  for (const chunkId of rankedChunkIds) {
    const chunk = chunkById.get(chunkId)
    if (!chunk) continue

    const exactMatchScore = exactAliasScore(queryNormalized, chunk)
    const rrfScore = input.chunkRrfScores.get(chunkId) ?? 0
    const semanticScore = vectorScoreMap.get(chunkId) ?? 0
    const bm25Score = bm25ScoreMap.get(chunkId) ?? 0
    const score = rrfScore + exactMatchScore
    const lane = matchLane(exactMatchScore, semanticScore, bm25Score)
    const scores = { score, semanticScore, bm25Score, rrfScore, exactMatchScore, matchLane: lane }

    const entry = docEntries.get(chunk.docId) ?? createStage1Entry(chunk, scores)
    docEntries.set(chunk.docId, entry)

    if (
      isBetterChunkScore(
        [score, exactMatchScore, bm25Score, semanticScore],
        [entry.score || 0, entry.exactMatchScore || 0, entry.bm25Score || 0, entry.semanticScore || 0],
      )
    ) {
      entry.score = score
      entry.distance = 1 - score
      entry.semanticScore = semanticScore
      entry.bm25Score = bm25Score
      entry.rrfScore = rrfScore
      entry.exactMatchScore = exactMatchScore
      entry.question = chunk.question
      entry.answerPreview = chunk.answerPreview
      entry.metadata = chunk.metadata
      entry.matchLane = lane
    }

    const chunkMatch = toRetrievalChunk(chunk, scores)
    if (chunk.textType === 'document') {
      entry._documentMatches.push(chunkMatch)
    } else if (!entry._fallbackMatch) {
      entry._fallbackMatch = chunkMatch
    }
  }

  for (const exactDocId of input.exactDocIds) {
    if (!docEntries.has(exactDocId)) {
      injectExactDocEntry(docEntries, input.chunks, exactDocId, queryNormalized)
    }
  }

  const rankedDocIds = [...docEntries.keys()].sort((left, right) =>
    compareSortKey(docSortKey(docEntries.get(right)!), docSortKey(docEntries.get(left)!)),
  )
  const selectedDocIds = rankedDocIds.slice(0, input.retrievalTopK)
  for (const exactDocId of input.exactDocIds) {
    if (docEntries.has(exactDocId) && !selectedDocIds.includes(exactDocId)) {
      selectedDocIds.push(exactDocId)
    }
  }

  return selectedDocIds
    .map((docId) => docEntries.get(docId))
    .filter((entry): entry is Stage1Entry => Boolean(entry))
    .map(finalizeDocEntry)
    .sort((left, right) => compareSortKey(docSortKey(right), docSortKey(left)))
}

function injectExactDocEntry(
  docEntries: Map<string, Stage1Entry>,
  chunks: InternalChunk[],
  exactDocId: string,
  queryNormalized: string,
): void {
  for (const chunk of chunks) {
    if (chunk.docId !== exactDocId) continue

    const exactMatchScore = exactAliasScore(queryNormalized, chunk)
    const score = exactMatchScore
    const lane: RetrievalMatchLane = exactMatchScore > 0 ? 'exact_lane' : 'semantic'
    const scores = {
      score,
      semanticScore: 0,
      bm25Score: 0,
      rrfScore: 0,
      exactMatchScore,
      matchLane: lane,
    }
    const entry = docEntries.get(chunk.docId) ?? createStage1Entry(chunk, scores)
    docEntries.set(chunk.docId, entry)

    if (score > (entry.score || 0)) {
      entry.score = score
      entry.distance = 1 - score
      entry.question = chunk.question
      entry.answerPreview = chunk.answerPreview
      entry.metadata = chunk.metadata
      entry.matchLane = lane
      entry.exactMatchScore = exactMatchScore
    }

    const chunkMatch = toRetrievalChunk(chunk, scores)
    if (chunk.textType === 'document') {
      entry._documentMatches.push(chunkMatch)
    } else if (!entry._fallbackMatch) {
      entry._fallbackMatch = chunkMatch
    }
  }
}

function selectDocumentMatches(documentMatches: RetrievalChunk[]): RetrievalChunk[] {
  if (documentMatches.length === 0) return []

  const byOrder = [...documentMatches].sort((left, right) => {
    if (left.chunkIndex !== right.chunkIndex) return left.chunkIndex - right.chunkIndex
    return left.chunkId.localeCompare(right.chunkId)
  })
  if (byOrder.length <= 8) {
    return byOrder
  }

  const bestMatch = [...documentMatches].sort((left, right) => {
    const scoreDiff = (right.score ?? 0) - (left.score ?? 0)
    if (scoreDiff !== 0) return scoreDiff
    return left.chunkIndex - right.chunkIndex
  })[0]
  const bestIndex = bestMatch?.chunkIndex ?? 0
  const selectedIds = new Set(
    byOrder
      .filter((item) => Math.abs(item.chunkIndex - bestIndex) <= 1)
      .map((item) => item.chunkId),
  )

  const byMatchStrength = [...documentMatches].sort((left, right) => {
    const scoreDiff = (right.score ?? 0) - (left.score ?? 0)
    if (scoreDiff !== 0) return scoreDiff
    return left.chunkIndex - right.chunkIndex
  })
  for (const item of byMatchStrength) {
    if (selectedIds.size >= 8) break
    selectedIds.add(item.chunkId)
  }

  return byOrder.filter((item) => selectedIds.has(item.chunkId)).slice(0, 8)
}

function finalizeDocEntry(entry: Stage1Entry): RetrievalResult {
  const documentMatches = [...entry._documentMatches].sort((left, right) => {
    const scoreDiff = (right.score ?? 0) - (left.score ?? 0)
    if (scoreDiff !== 0) return scoreDiff
    if (left.chunkIndex !== right.chunkIndex) return left.chunkIndex - right.chunkIndex
    return left.chunkId.localeCompare(right.chunkId)
  })
  const matchedChunks = selectDocumentMatches(documentMatches)
  const fallbackChunks = matchedChunks.length > 0
    ? matchedChunks
    : (entry._fallbackMatch ? [entry._fallbackMatch] : [])

  return {
    docId: entry.docId,
    question: entry.question,
    score: entry.score,
    distance: entry.distance,
    semanticScore: entry.semanticScore,
    bm25Score: entry.bm25Score,
    rrfScore: entry.rrfScore,
    exactMatchScore: entry.exactMatchScore,
    metadata: entry.metadata,
    matchLane: entry.matchLane,
    answerPreview: entry.answerPreview,
    matchedChunks: fallbackChunks,
    matchedChunkIds: fallbackChunks.map((chunk) => chunk.chunkId),
    matchedChunkCount: fallbackChunks.length,
    chunkText: fallbackChunks.map((chunk) => chunk.chunkText).filter(Boolean).join('\n\n'),
  }
}

function exactAliasBonus(result: RetrievalResult): number {
  if (result.matchLane === 'exact_alias' || result.matchLane === 'exact_lane') {
    return 0.28
  }
  const exactMatchScore = result.exactMatchScore ?? 0
  return exactMatchScore > 0 ? Math.min(0.28, 0.12 * exactMatchScore) : 0
}

function metadataBonus(result: RetrievalResult): number {
  if ((result.matchLane === 'exact_alias' || result.matchLane === 'exact_lane') &&
    asBoolean(result.metadata.is_exact_faq ?? result.metadata.isExactFaq)) {
    return 0.08
  }
  return 0
}

function scoreResult(query: string, result: RetrievalResult): number {
  const baseScore = result.rrfScore ?? result.score ?? 0
  const lexical = lexicalOverlapScore(query, result.question)
  const phraseBonus = phraseOverlapBonus(query, result.question)
  const anchorBonus = anchorPhraseScore(query, result.question)

  return (
    baseScore +
    (0.4 * lexical) +
    (0.2 * phraseBonus) +
    (0.3 * anchorBonus) +
    exactAliasBonus(result) +
    metadataBonus(result)
  )
}

function rerankResults(query: string, results: RetrievalResult[]): RetrievalResult[] {
  return results
    .map((result) => ({
      ...result,
      rerankScore: scoreResult(query, result),
    }))
    .sort((left, right) => {
      if ((right.rerankScore ?? 0) !== (left.rerankScore ?? 0)) {
        return (right.rerankScore ?? 0) - (left.rerankScore ?? 0)
      }
      if ((right.rrfScore ?? right.score) !== (left.rrfScore ?? left.score)) {
        return (right.rrfScore ?? right.score) - (left.rrfScore ?? left.score)
      }
      return right.score - left.score
    })
}

export function searchIndexIngest(input: SearchIndexIngestInput): SearchIndexIngestResult {
  const outputTopK = Math.max(1, input.topK ?? 10)
  const retrievalTopK = Math.max(1, input.retrievalTopK ?? DEFAULT_RETRIEVAL_TOP_K)
  const rerankTopK = Math.max(1, input.rerankTopK ?? DEFAULT_RERANK_TOP_K)
  const llmRerankTopK = Math.max(1, input.llmRerankTopK ?? DEFAULT_LLM_RERANK_TOP_K)
  const bm25Enabled = input.bm25Enabled ?? true
  const rrfK = Math.max(1, input.rrfK ?? DEFAULT_RRF_K)
  const chunks = buildChunks(input.ingest)
  if (chunks.length === 0) {
    return { results: [] }
  }

  const vectorByChunkId = buildVectorByChunkId(input.ingest, chunks)
  const queryVector = input.queryVector ?? createLocalTextVector(input.query)
  const candidateTopK = Math.max(200, retrievalTopK * 8)
  const vectorResults = rankVectorChunks(queryVector, chunks, vectorByChunkId, candidateTopK)
  const bm25Results = bm25Enabled ? calculateBm25Results(input.query, chunks, candidateTopK) : []
  const chunkRrfScores = bm25Enabled
    ? rrfMerge(vectorResults, bm25Results, rrfK)
    : singleLaneRrf(vectorResults, rrfK)
  const stage1Results = buildStage1Results({
    query: input.query,
    chunks,
    retrievalTopK,
    chunkRrfScores,
    vectorResults,
    bm25Results,
    exactDocIds: exactDocIds(input.query, chunks),
  })
  const stage2Results = rerankResults(input.query, stage1Results).slice(0, rerankTopK)

  if (input.llmReranker) {
    return {
      results: input.llmReranker(input.query, stage2Results, llmRerankTopK).slice(0, outputTopK),
    }
  }

  return {
    results: stage2Results.slice(0, outputTopK),
  }
}
