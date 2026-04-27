import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'

import { getSettings } from '@/lib/db/repositories/settings'
import { findKnowledgeBaseById } from '@/lib/db/repositories/knowledge-bases'
import { findKnowledgeIndexVersionById } from '@/lib/db/repositories/knowledge-index-versions'
import { findKnowledgeVersionById } from '@/lib/db/repositories/knowledge-versions'
import type { KnowledgeArtifactPaths } from '@/lib/knowledge/storage'
import { buildKnowledgeArtifactPaths, ensureKnowledgeArtifactDir } from '@/lib/knowledge/storage'
import { createLocalTextVector } from '@/lib/ai/rag/text'
import type { IndexIngestData } from '@/lib/ai/rag/types'
import type { EmbeddingClient, EmbeddingTextType } from '@/lib/ai/rag/embedding'
import {
  createExternalEmbeddingClient,
  DEFAULT_EMBEDDING_BASE_URL,
  DEFAULT_EMBEDDING_MODEL,
} from '@/lib/ai/rag/embedding'

export interface IndexIngestResult {
  parents: Record<string, unknown>[]
  chunks: Record<string, unknown>[]
  vectors: Record<string, unknown>[]
  backfilled: boolean
  embeddingProvider: string
  embeddingModel: string
  embeddingBaseUrl: string
}

interface WriteIndexIngestInput {
  paths: KnowledgeArtifactPaths
  parents: Record<string, unknown>[]
  chunks: Record<string, unknown>[]
  embeddingClient?: EmbeddingClient | null
}

interface EnsureIndexIngestInput {
  paths: KnowledgeArtifactPaths
  embeddingClient?: EmbeddingClient | null
}

export interface EnsureIndexIngestForVersionResult {
  ingest: IndexIngestData
  backfilled: boolean
  queryVector?: number[]
}

interface EnsureIndexIngestForVersionOptions {
  query?: string
  embeddingClient?: EmbeddingClient | null
}

interface IngestMetadata {
  generatedAt?: string
  parentCount?: number
  chunkCount?: number
  vectorCount?: number
  embeddingProvider?: string
  embeddingModel?: string
  embeddingBaseUrl?: string
}

interface EmbeddingCacheFile {
  embeddingProvider: string
  embeddingModel: string
  embeddingBaseUrl: string
  entries: Array<{
    fingerprint: string
    vector: number[]
  }>
}

function readJsonLinesFile<T extends Record<string, unknown>>(filePath: string): T[] {
  if (!fs.existsSync(filePath)) {
    return []
  }

  const content = fs.readFileSync(filePath, 'utf-8').trim()
  if (!content) {
    return []
  }

  return content
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line) as T)
}

function writeJsonLinesFile(filePath: string, rows: Record<string, unknown>[]): void {
  ensureKnowledgeArtifactDir(filePath)
  const content = rows.map((row) => JSON.stringify(row)).join('\n')
  fs.writeFileSync(filePath, content ? `${content}\n` : '', 'utf-8')
}

function writeJsonFile(filePath: string, data: Record<string, unknown>): void {
  ensureKnowledgeArtifactDir(filePath)
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8')
}

function readJsonFile(filePath: string): IngestMetadata {
  if (!fs.existsSync(filePath)) return {}
  const content = fs.readFileSync(filePath, 'utf-8').trim()
  if (!content) return {}
  return JSON.parse(content) as IngestMetadata
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function positiveIntegerFromEnv(value: string | undefined): number | undefined {
  if (!value) return undefined
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined
}

export function resolveIndexEmbeddingClient(): EmbeddingClient | null {
  let settings: ReturnType<typeof getSettings> | null = null
  try {
    settings = getSettings()
  } catch {
    settings = null
  }

  const apiKey =
    process.env.EMBEDDING_API_KEY ||
    process.env.DASHSCOPE_API_KEY ||
    process.env.QA_VERIFY_API_KEY ||
    settings?.apiKey ||
    ''
  if (!apiKey) return null

  return createExternalEmbeddingClient({
    apiKey,
    modelName: process.env.EMBEDDING_MODEL || DEFAULT_EMBEDDING_MODEL,
    baseUrl: process.env.EMBEDDING_BASE_URL || process.env.DASHSCOPE_BASE_URL || settings?.baseUrl || DEFAULT_EMBEDDING_BASE_URL,
    batchSize: positiveIntegerFromEnv(process.env.EMBEDDING_BATCH_SIZE),
    parallelRequests: positiveIntegerFromEnv(process.env.EMBEDDING_PARALLEL_REQUESTS),
  })
}

function chunkEmbeddingText(chunk: Record<string, unknown>): string {
  return (
    asString(chunk.embedding_text) ||
    asString(chunk.embeddingText) ||
    [asString(chunk.section_title), asString(chunk.chunk_text) || asString(chunk.chunkText)]
      .filter(Boolean)
      .join('\n')
  )
}

function chunkTextType(chunk: Record<string, unknown>): EmbeddingTextType {
  const metadata = chunk.metadata && typeof chunk.metadata === 'object' && !Array.isArray(chunk.metadata)
    ? chunk.metadata as Record<string, unknown>
    : {}
  const textType = asString(chunk.text_type) || asString(chunk.textType) || asString(metadata.text_type) || asString(metadata.textType)
  return textType === 'query' ? 'query' : 'document'
}

function embeddingCacheFilePath(paths: KnowledgeArtifactPaths): string {
  return path.join(paths.indexDir, 'embedding-cache.json')
}

function chunkEmbeddingFingerprint(row: { embedding_text: string; text_type: EmbeddingTextType }): string {
  return createHash('sha256')
    .update(JSON.stringify({
      text_type: row.text_type,
      embedding_text: row.embedding_text,
    }))
    .digest('hex')
}

function loadEmbeddingCache(paths: KnowledgeArtifactPaths, embeddingClient: EmbeddingClient): Map<string, number[]> {
  const filePath = embeddingCacheFilePath(paths)
  if (!fs.existsSync(filePath)) return new Map()

  try {
    const payload = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as EmbeddingCacheFile
    if (
      payload.embeddingProvider !== embeddingClient.provider ||
      payload.embeddingModel !== embeddingClient.modelName ||
      payload.embeddingBaseUrl !== embeddingClient.baseUrl ||
      !Array.isArray(payload.entries)
    ) {
      return new Map()
    }

    return new Map(
      payload.entries
        .filter((entry) => typeof entry.fingerprint === 'string' && Array.isArray(entry.vector))
        .map((entry) => [entry.fingerprint, entry.vector]),
    )
  } catch {
    return new Map()
  }
}

function saveEmbeddingCache(
  paths: KnowledgeArtifactPaths,
  embeddingClient: EmbeddingClient,
  cache: Map<string, number[]>,
): void {
  writeJsonFile(embeddingCacheFilePath(paths), {
    embeddingProvider: embeddingClient.provider,
    embeddingModel: embeddingClient.modelName,
    embeddingBaseUrl: embeddingClient.baseUrl,
    entries: [...cache.entries()].map(([fingerprint, vector]) => ({
      fingerprint,
      vector,
    })),
  })
}

function buildLocalVectorRows(chunks: Record<string, unknown>[]): Record<string, unknown>[] {
  return chunks.map((chunk) => {
    const embeddingText = chunkEmbeddingText(chunk)

    return {
      chunk_id: asString(chunk.id),
      parent_id: asString(chunk.parent_id) || asString(chunk.parentId),
      embedding_text: embeddingText,
      text_type: chunkTextType(chunk),
      embedding_provider: 'local-hash-v1',
      embedding_model: 'local-hash-v1',
      vector: createLocalTextVector(embeddingText),
    }
  })
}

async function buildExternalVectorRows(
  paths: KnowledgeArtifactPaths,
  chunks: Record<string, unknown>[],
  embeddingClient: EmbeddingClient,
): Promise<Record<string, unknown>[]> {
  const rows = chunks.map((chunk) => ({
    chunk,
    chunk_id: asString(chunk.id),
    parent_id: asString(chunk.parent_id) || asString(chunk.parentId),
    embedding_text: chunkEmbeddingText(chunk),
    text_type: chunkTextType(chunk),
  }))
  const embeddingCache = loadEmbeddingCache(paths, embeddingClient)
  const vectorsByChunkId = new Map<string, number[]>()

  for (const textType of ['document', 'query'] satisfies EmbeddingTextType[]) {
    const typedRows = rows.filter((row) => row.text_type === textType)
    if (typedRows.length === 0) continue

    const missingRows: typeof typedRows = []
    for (const row of typedRows) {
      const cached = embeddingCache.get(chunkEmbeddingFingerprint(row))
      if (cached) {
        vectorsByChunkId.set(row.chunk_id, cached)
      } else {
        missingRows.push(row)
      }
    }
    if (missingRows.length === 0) continue

    const vectors = await embeddingClient.embedTexts(
      missingRows.map((row) => row.embedding_text),
      { textType },
    )
    missingRows.forEach((row, index) => {
      const vector = vectors[index] ?? []
      vectorsByChunkId.set(row.chunk_id, vector)
      embeddingCache.set(chunkEmbeddingFingerprint(row), vector)
    })
  }
  saveEmbeddingCache(paths, embeddingClient, embeddingCache)

  return rows.map((row) => ({
    chunk_id: row.chunk_id,
    parent_id: row.parent_id,
    embedding_text: row.embedding_text,
    text_type: row.text_type,
    embedding_provider: embeddingClient.provider,
    embedding_model: embeddingClient.modelName,
    vector: vectorsByChunkId.get(row.chunk_id) ?? [],
  }))
}

function writeIndexIngestResult(input: {
  paths: KnowledgeArtifactPaths
  parents: Record<string, unknown>[]
  chunks: Record<string, unknown>[]
  vectors: Record<string, unknown>[]
  embeddingClient?: EmbeddingClient | null
  backfilled: boolean
}): IndexIngestResult {
  const embeddingProvider = input.embeddingClient?.provider ?? 'local-hash-v1'
  const embeddingModel = input.embeddingClient?.modelName ?? 'local-hash-v1'
  const embeddingBaseUrl = input.embeddingClient?.baseUrl ?? ''

  writeJsonLinesFile(input.paths.indexParentsFilePath, input.parents)
  writeJsonLinesFile(input.paths.indexChunksFilePath, input.chunks)
  writeJsonLinesFile(input.paths.indexVectorsFilePath, input.vectors)
  writeJsonFile(input.paths.indexIngestFilePath, {
    generatedAt: new Date().toISOString(),
    parentCount: input.parents.length,
    chunkCount: input.chunks.length,
    vectorCount: input.vectors.length,
    embeddingProvider,
    embeddingModel,
    embeddingBaseUrl,
  })

  return {
    parents: input.parents,
    chunks: input.chunks,
    vectors: input.vectors,
    backfilled: input.backfilled,
    embeddingProvider,
    embeddingModel,
    embeddingBaseUrl,
  }
}

export function writeIndexIngestArtifacts(
  input: WriteIndexIngestInput & { embeddingClient: EmbeddingClient },
): Promise<IndexIngestResult>
export function writeIndexIngestArtifacts(
  input: WriteIndexIngestInput & { embeddingClient?: null | undefined },
): IndexIngestResult
export function writeIndexIngestArtifacts(input: WriteIndexIngestInput): IndexIngestResult | Promise<IndexIngestResult> {
  if (input.embeddingClient) {
    return buildExternalVectorRows(input.paths, input.chunks, input.embeddingClient).then((vectors) =>
      writeIndexIngestResult({
        ...input,
        vectors,
        backfilled: false,
      }),
    )
  }

  return writeIndexIngestResult({
    ...input,
    vectors: buildLocalVectorRows(input.chunks),
    backfilled: false,
  })
}

function shouldRebuildVectors(metadata: IngestMetadata, embeddingClient?: EmbeddingClient | null): boolean {
  if (!embeddingClient) return false
  return (
    metadata.embeddingProvider !== embeddingClient.provider ||
    metadata.embeddingModel !== embeddingClient.modelName ||
    metadata.embeddingBaseUrl !== embeddingClient.baseUrl
  )
}

export function ensureIndexIngestArtifacts(
  input: EnsureIndexIngestInput & { embeddingClient: EmbeddingClient },
): Promise<IndexIngestResult>
export function ensureIndexIngestArtifacts(
  input: EnsureIndexIngestInput & { embeddingClient?: null | undefined },
): IndexIngestResult
export function ensureIndexIngestArtifacts(input: EnsureIndexIngestInput): IndexIngestResult | Promise<IndexIngestResult> {
  const hasIndexArtifacts =
    fs.existsSync(input.paths.indexParentsFilePath) &&
    fs.existsSync(input.paths.indexChunksFilePath) &&
    fs.existsSync(input.paths.indexIngestFilePath)

  if (hasIndexArtifacts) {
    const parents = readJsonLinesFile(input.paths.indexParentsFilePath)
    const chunks = readJsonLinesFile(input.paths.indexChunksFilePath)
    const hasVectorArtifacts = fs.existsSync(input.paths.indexVectorsFilePath)
    const metadata = readJsonFile(input.paths.indexIngestFilePath)

    if (hasVectorArtifacts && !shouldRebuildVectors(metadata, input.embeddingClient)) {
      const vectors = readJsonLinesFile(input.paths.indexVectorsFilePath)

      return {
        parents,
        chunks,
        vectors,
        backfilled: false,
        embeddingProvider: metadata.embeddingProvider ?? 'local-hash-v1',
        embeddingModel: metadata.embeddingModel ?? 'local-hash-v1',
        embeddingBaseUrl: metadata.embeddingBaseUrl ?? '',
      }
    }

    if (input.embeddingClient) {
      return buildExternalVectorRows(input.paths, chunks, input.embeddingClient).then((vectors) =>
        writeIndexIngestResult({
          paths: input.paths,
          parents,
          chunks,
          vectors,
          embeddingClient: input.embeddingClient,
          backfilled: true,
        }),
      )
    }

    return writeIndexIngestResult({
      paths: input.paths,
      parents,
      chunks,
      vectors: buildLocalVectorRows(chunks),
      backfilled: true,
    })
  }

  const parents = readJsonLinesFile(input.paths.parentsFilePath)
  const chunks = readJsonLinesFile(input.paths.chunksFilePath)

  if (parents.length === 0 && !fs.existsSync(input.paths.parentsFilePath)) {
    throw new Error(`Knowledge parents artifact not found: ${input.paths.parentsFilePath}`)
  }

  if (chunks.length === 0 && !fs.existsSync(input.paths.chunksFilePath)) {
    throw new Error(`Knowledge chunks artifact not found: ${input.paths.chunksFilePath}`)
  }

  if (input.embeddingClient) {
    return buildExternalVectorRows(input.paths, chunks, input.embeddingClient).then((vectors) =>
      writeIndexIngestResult({
        paths: input.paths,
        parents,
        chunks,
        vectors,
        embeddingClient: input.embeddingClient,
        backfilled: true,
      }),
    )
  }

  return writeIndexIngestResult({
    paths: input.paths,
    parents,
    chunks,
    vectors: buildLocalVectorRows(chunks),
    backfilled: true,
  })
}

export async function ensureIndexIngestForIndexVersionId(
  indexVersionId: string,
  options: EnsureIndexIngestForVersionOptions = {},
): Promise<EnsureIndexIngestForVersionResult> {
  const indexVersion = findKnowledgeIndexVersionById(indexVersionId)
  if (!indexVersion) {
    throw new Error(`Knowledge index version not found: ${indexVersionId}`)
  }

  const knowledgeVersion = findKnowledgeVersionById(indexVersion.knowledgeVersionId)
  if (!knowledgeVersion) {
    throw new Error(`Knowledge version not found: ${indexVersion.knowledgeVersionId}`)
  }

  const knowledgeBase = findKnowledgeBaseById(indexVersion.knowledgeBaseId)
  if (!knowledgeBase) {
    throw new Error(`Knowledge base not found: ${indexVersion.knowledgeBaseId}`)
  }

  const paths = buildKnowledgeArtifactPaths({
    projectId: knowledgeBase.projectId,
    knowledgeBaseId: knowledgeBase.id,
    knowledgeVersionId: knowledgeVersion.id,
  })
  const embeddingClient = options.embeddingClient === undefined
    ? resolveIndexEmbeddingClient()
    : options.embeddingClient
  const ingest = embeddingClient
    ? await ensureIndexIngestArtifacts({
        paths,
        embeddingClient,
      })
    : ensureIndexIngestArtifacts({
        paths,
      })
  const queryVector = options.query && embeddingClient && ingest.embeddingProvider !== 'local-hash-v1'
    ? await embeddingClient.embedText(options.query, { textType: 'query' })
    : undefined

  return {
    ingest: {
      parents: ingest.parents,
      chunks: ingest.chunks,
      vectors: ingest.vectors,
      embeddingProvider: ingest.embeddingProvider,
      embeddingModel: ingest.embeddingModel,
      embeddingBaseUrl: ingest.embeddingBaseUrl,
    },
    backfilled: ingest.backfilled,
    queryVector,
  }
}
