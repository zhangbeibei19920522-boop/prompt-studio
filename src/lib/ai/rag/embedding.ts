import { proxyFetch } from '@/lib/ai/proxy-fetch'

export type EmbeddingTextType = 'document' | 'query'

export interface EmbeddingProgress {
  textType: EmbeddingTextType
  batchIndex: number
  totalBatches: number
  completedItems: number
  totalItems: number
}

export interface EmbeddingClient {
  provider: string
  modelName: string
  baseUrl: string
  embedText(text: string, options: { textType: EmbeddingTextType }): Promise<number[]>
  embedTexts(
    texts: string[],
    options: {
      textType: EmbeddingTextType
      progressCallback?: (progress: EmbeddingProgress) => void
    },
  ): Promise<number[][]>
}

export interface ExternalEmbeddingClientConfig {
  apiKey: string
  modelName?: string
  baseUrl?: string
  batchSize?: number
  parallelRequests?: number
  retryAttempts?: number
  retryBackoffMs?: number
  fetchImpl?: typeof fetch
}

export const DEFAULT_EMBEDDING_BASE_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1'
export const DEFAULT_EMBEDDING_MODEL = 'text-embedding-v4'
const DEFAULT_BATCH_SIZE = 10
const DEFAULT_RETRY_ATTEMPTS = 3
const DEFAULT_RETRY_BACKOFF_MS = 1000
const MAX_EMBEDDING_INPUT_LENGTH = 8192

function truncateEmbeddingInput(text: string): string {
  return text.length <= MAX_EMBEDDING_INPUT_LENGTH ? text : text.slice(0, MAX_EMBEDDING_INPUT_LENGTH)
}

function batched<T>(items: T[], batchSize: number): T[][] {
  const batches: T[][] = []
  for (let index = 0; index < items.length; index += batchSize) {
    batches.push(items.slice(index, index + batchSize))
  }
  return batches
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function parseEmbeddingPayload(payload: unknown): number[][] {
  const record = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {}
  const data = Array.isArray(record.data) ? record.data : []

  return data
    .map((item, fallbackIndex) => {
      const row = item && typeof item === 'object' ? item as Record<string, unknown> : {}
      return {
        index: typeof row.index === 'number' ? row.index : fallbackIndex,
        embedding: Array.isArray(row.embedding)
          ? row.embedding.filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
          : [],
      }
    })
    .sort((left, right) => left.index - right.index)
    .map((item) => item.embedding)
}

export function createExternalEmbeddingClient(config: ExternalEmbeddingClientConfig): EmbeddingClient {
  const modelName = config.modelName || DEFAULT_EMBEDDING_MODEL
  const baseUrl = (config.baseUrl || DEFAULT_EMBEDDING_BASE_URL).replace(/\/+$/, '')
  const batchSize = Math.max(1, config.batchSize ?? DEFAULT_BATCH_SIZE)
  const parallelRequests = Math.max(1, config.parallelRequests ?? 1)
  const retryAttempts = Math.max(1, config.retryAttempts ?? DEFAULT_RETRY_ATTEMPTS)
  const retryBackoffMs = Math.max(0, config.retryBackoffMs ?? DEFAULT_RETRY_BACKOFF_MS)
  const fetchImpl = config.fetchImpl ?? proxyFetch
  let queryQueue = Promise.resolve()

  async function withQueryLock<T>(operation: () => Promise<T>): Promise<T> {
    const previous = queryQueue
    let release!: () => void
    queryQueue = new Promise<void>((resolve) => {
      release = resolve
    })
    await previous
    try {
      return await operation()
    } finally {
      release()
    }
  }

  async function doCallEmbedding(input: string | string[], textType: EmbeddingTextType): Promise<number[][]> {
    if (!config.apiKey) {
      throw new Error('Embedding API key is required')
    }

    const normalizedInput = Array.isArray(input)
      ? input.map(truncateEmbeddingInput)
      : truncateEmbeddingInput(input)
    let lastError: unknown = null

    for (let attempt = 0; attempt < retryAttempts; attempt++) {
      try {
        const res = await fetchImpl(`${baseUrl}/embeddings`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${config.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: modelName,
            input: normalizedInput,
            text_type: textType,
          }),
        })

        if (res.ok) {
          return parseEmbeddingPayload(await res.json())
        }

        throw new Error(`Embedding API error (${res.status}): ${await res.text()}`)
      } catch (error) {
        lastError = error
        if (attempt + 1 >= retryAttempts) break
        await delay(retryBackoffMs * (2 ** attempt))
      }
    }

    throw new Error(
      `Failed to get embeddings from external service: ${lastError instanceof Error ? lastError.message : String(lastError)}`,
    )
  }

  async function callEmbedding(input: string | string[], textType: EmbeddingTextType): Promise<number[][]> {
    if (textType === 'query') {
      return withQueryLock(() => doCallEmbedding(input, textType))
    }
    return doCallEmbedding(input, textType)
  }

  async function embedBatchesInParallel(
    batches: string[][],
    textType: EmbeddingTextType,
    progressCallback: ((progress: EmbeddingProgress) => void) | undefined,
    totalItems: number,
  ): Promise<number[][]> {
    const resultsByBatch = new Map<number, number[][]>()
    let completedItems = 0
    let nextBatchIndex = 0

    async function worker(): Promise<void> {
      while (nextBatchIndex < batches.length) {
        const batchIndex = nextBatchIndex
        nextBatchIndex += 1
        const batch = batches[batchIndex]
        resultsByBatch.set(batchIndex, await callEmbedding(batch, textType))
        completedItems += batch.length
        progressCallback?.({
          textType,
          batchIndex: batchIndex + 1,
          totalBatches: batches.length,
          completedItems,
          totalItems,
        })
      }
    }

    await Promise.all(
      Array.from({ length: Math.min(parallelRequests, batches.length) }, () => worker()),
    )

    return batches.flatMap((_batch, index) => resultsByBatch.get(index) ?? [])
  }

  return {
    provider: 'external',
    modelName,
    baseUrl,
    async embedText(text, options) {
      return (await callEmbedding(text, options.textType))[0] ?? []
    },
    async embedTexts(texts, options) {
      if (texts.length === 0) return []

      const batches = batched(texts, batchSize)
      if (parallelRequests > 1 && options.textType !== 'query' && batches.length > 1) {
        return embedBatchesInParallel(
          batches,
          options.textType,
          options.progressCallback,
          texts.length,
        )
      }

      const embeddings: number[][] = []
      let completedItems = 0
      for (const [batchOffset, batch] of batches.entries()) {
        embeddings.push(...await callEmbedding(batch, options.textType))
        completedItems += batch.length
        options.progressCallback?.({
          textType: options.textType,
          batchIndex: batchOffset + 1,
          totalBatches: batches.length,
          completedItems,
          totalItems: texts.length,
        })
      }

      return embeddings
    },
  }
}
