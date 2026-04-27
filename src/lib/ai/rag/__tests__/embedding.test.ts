import { createExternalEmbeddingClient } from '@/lib/ai/rag/embedding'

function response(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('external embedding client', () => {
  it('uses the qa_verify compatible embeddings endpoint and text_type', async () => {
    const fetchImpl = vi.fn(async () =>
      response({
        data: [
          { index: 1, embedding: [0.3, 0.4] },
          { index: 0, embedding: [0.1, 0.2] },
        ],
      }),
    )
    const client = createExternalEmbeddingClient({
      apiKey: 'test-key',
      modelName: 'text-embedding-v4',
      baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      fetchImpl,
    })

    const embeddings = await client.embedTexts(['文档一', '文档二'], { textType: 'document' })

    expect(embeddings).toEqual([[0.1, 0.2], [0.3, 0.4]])
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://dashscope.aliyuncs.com/compatible-mode/v1/embeddings',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer test-key',
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({
          model: 'text-embedding-v4',
          input: ['文档一', '文档二'],
          text_type: 'document',
        }),
      }),
    )
  })

  it('serializes query embeddings as text_type=query', async () => {
    const fetchImpl = vi.fn(async () =>
      response({
        data: [{ index: 0, embedding: [0.5, 0.6] }],
      }),
    )
    const client = createExternalEmbeddingClient({
      apiKey: 'test-key',
      modelName: 'text-embedding-v4',
      baseUrl: 'https://embedding.example/v1/',
      fetchImpl,
    })

    await expect(client.embedText('怎么连接 WiFi', { textType: 'query' })).resolves.toEqual([0.5, 0.6])
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://embedding.example/v1/embeddings',
      expect.objectContaining({
        body: JSON.stringify({
          model: 'text-embedding-v4',
          input: '怎么连接 WiFi',
          text_type: 'query',
        }),
      }),
    )
  })

  it('rejects missing api key before calling the endpoint', async () => {
    const fetchImpl = vi.fn()
    const client = createExternalEmbeddingClient({
      apiKey: '',
      modelName: 'text-embedding-v4',
      baseUrl: 'https://embedding.example/v1',
      fetchImpl,
    })

    await expect(client.embedTexts(['文档'], { textType: 'document' })).rejects.toThrow('Embedding API key is required')
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('runs document embedding batches in parallel when configured', async () => {
    let activeRequests = 0
    let maxActiveRequests = 0
    const fetchImpl = vi.fn(async (_url, init) => {
      activeRequests += 1
      maxActiveRequests = Math.max(maxActiveRequests, activeRequests)
      await new Promise((resolve) => setTimeout(resolve, 20))
      activeRequests -= 1
      const body = JSON.parse(String(init?.body)) as { input: string[] }
      return response({
        data: body.input.map((_text, index) => ({ index, embedding: [index] })),
      })
    })
    const client = createExternalEmbeddingClient({
      apiKey: 'test-key',
      modelName: 'text-embedding-v4',
      baseUrl: 'https://embedding.example/v1',
      batchSize: 1,
      parallelRequests: 2,
      fetchImpl,
    })

    await client.embedTexts(['文档一', '文档二', '文档三'], { textType: 'document' })

    expect(maxActiveRequests).toBeGreaterThan(1)
  })

  it('serializes concurrent query embedding calls', async () => {
    let activeRequests = 0
    let maxActiveRequests = 0
    const fetchImpl = vi.fn(async () => {
      activeRequests += 1
      maxActiveRequests = Math.max(maxActiveRequests, activeRequests)
      await new Promise((resolve) => setTimeout(resolve, 20))
      activeRequests -= 1
      return response({ data: [{ index: 0, embedding: [0.1, 0.2] }] })
    })
    const client = createExternalEmbeddingClient({
      apiKey: 'test-key',
      modelName: 'text-embedding-v4',
      baseUrl: 'https://embedding.example/v1',
      fetchImpl,
    })

    await Promise.all([
      client.embedText('问题一', { textType: 'query' }),
      client.embedText('问题二', { textType: 'query' }),
    ])

    expect(maxActiveRequests).toBe(1)
  })
})
