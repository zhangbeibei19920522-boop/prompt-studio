import type { ChatMessage, ChatOptions } from '@/types/ai'

export interface RetrievalChunk {
  chunkId: string
  chunkIndex: number
  chunkKind: string
  sectionTitle: string
  chunkText: string
  score?: number
  semanticScore?: number
  bm25Score?: number
  rrfScore?: number
  exactMatchScore?: number
  matchLane?: RetrievalMatchLane
}

export type RetrievalMatchLane =
  | 'exact_alias'
  | 'exact_lane'
  | 'semantic'
  | 'bm25'
  | 'hybrid'
  | 'vector'

export interface RetrievalResult {
  docId: string
  question: string
  score: number
  distance?: number
  semanticScore?: number
  bm25Score?: number
  rrfScore?: number
  exactMatchScore?: number
  rerankScore?: number
  llmRerankScore?: number
  llmRerankCombinedScore?: number
  matchLane?: RetrievalMatchLane
  metadata: Record<string, unknown>
  matchedChunks: RetrievalChunk[]
  matchedChunkIds?: string[]
  matchedChunkCount?: number
  chunkText?: string
  answerPreview?: string
}

export interface IndexIngestData {
  parents: Record<string, unknown>[]
  chunks: Record<string, unknown>[]
  vectors?: Record<string, unknown>[]
  embeddingProvider?: string
  embeddingModel?: string
  embeddingBaseUrl?: string
}

export interface RagLlmClient {
  generate(messages: ChatMessage[], options?: ChatOptions): Promise<string>
}
