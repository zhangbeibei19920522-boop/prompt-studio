import { createRagLlmReranker } from '@/lib/ai/rag/llm-reranker'
import type { RetrievalResult } from '@/lib/ai/rag/types'

function candidate(overrides: Partial<RetrievalResult>): RetrievalResult {
  return {
    docId: 'doc-default',
    question: '云同步介绍',
    score: 0.4,
    rerankScore: 0.4,
    metadata: {},
    matchedChunks: [
      {
        chunkId: 'chunk-1',
        chunkIndex: 0,
        chunkKind: 'definition',
        sectionTitle: '概述',
        chunkText: '云同步会同步照片、联系人、便签等数据。',
      },
    ],
    ...overrides,
  }
}

describe('rag llm reranker', () => {
  it('reranks stage2 candidates using qa_verify style LLM scores', async () => {
    const chat = vi.fn(async () => JSON.stringify([
      { index: 1, score: 2 },
      { index: 2, score: 10 },
    ]))
    const reranker = createRagLlmReranker({
      chat,
      batchSize: 10,
    })

    const results = await reranker.rerank('请介绍一下云同步机制', [
      candidate({
        docId: 'doc-stage2',
        question: '云同步介绍',
        rerankScore: 0.9,
      }),
      candidate({
        docId: 'doc-llm',
        question: '云同步的机制说明',
        rerankScore: 0.2,
        matchedChunks: [
          {
            chunkId: 'chunk-2',
            chunkIndex: 0,
            chunkKind: 'definition',
            sectionTitle: '概述',
            chunkText: '新增、删除、编辑同步数据项时会触发云同步。',
          },
        ],
      }),
    ], 2)

    expect(results.map((result) => result.docId)).toEqual(['doc-llm', 'doc-stage2'])
    expect(results[0]).toEqual(
      expect.objectContaining({
        llmRerankScore: 10,
        llmRerankCombinedScore: expect.any(Number),
      }),
    )
    expect(chat).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          role: 'user',
          content: expect.stringContaining('用户问题：请介绍一下云同步机制'),
        }),
      ]),
      expect.objectContaining({
        temperature: 0,
        maxTokens: 1024,
      }),
    )
  })

  it('falls back to stage2 scores when one LLM rerank batch fails', async () => {
    const chat = vi
      .fn()
      .mockRejectedValueOnce(new Error('temporary failure'))
      .mockResolvedValueOnce(JSON.stringify([{ index: 1, score: 9 }]))
    const reranker = createRagLlmReranker({
      chat,
      batchSize: 1,
    })

    const results = await reranker.rerank('云同步机制', [
      candidate({
        docId: 'doc-stage2',
        question: '云同步介绍',
        rerankScore: 0.9,
      }),
      candidate({
        docId: 'doc-llm',
        question: '云同步机制说明',
        rerankScore: 0.1,
      }),
    ], 2)

    expect(results).toHaveLength(2)
    expect(results[0]?.docId).toBe('doc-stage2')
    expect(results.find((result) => result.docId === 'doc-stage2')).toEqual(
      expect.objectContaining({
        llmRerankScore: undefined,
        llmRerankCombinedScore: 1,
      }),
    )
  })

  it('creates the global reranker from default LLM settings without requiring baseUrl', async () => {
    vi.resetModules()
    const chat = vi.fn()
    const createAiProvider = vi.fn(() => ({
      chat,
      chatStream: vi.fn(),
    }))

    vi.doMock('@/lib/db/repositories/settings', () => ({
      getSettings: () => ({
        provider: 'openai',
        apiKey: 'test-key',
        model: 'gpt-test',
        baseUrl: '',
      }),
    }))
    vi.doMock('@/lib/ai/provider', () => ({
      createAiProvider,
    }))

    try {
      const { createGlobalRagLlmReranker } = await import('@/lib/ai/rag/llm-reranker')

      expect(createGlobalRagLlmReranker()).not.toBeNull()
      expect(createAiProvider).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: 'openai',
          apiKey: 'test-key',
          model: 'gpt-test',
          baseUrl: '',
        }),
      )
    } finally {
      vi.doUnmock('@/lib/db/repositories/settings')
      vi.doUnmock('@/lib/ai/provider')
      vi.resetModules()
    }
  })
})
