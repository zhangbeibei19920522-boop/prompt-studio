import { generateAnswer } from '@/lib/ai/rag/answer-generator'
import type { RagLlmClient, RetrievalResult } from '@/lib/ai/rag/types'

function result(overrides: Partial<RetrievalResult>): RetrievalResult {
  return {
    docId: 'doc-reset',
    question: 'How do I reset the router?',
    score: 0.95,
    matchLane: 'exact_alias',
    metadata: { isExactFaq: true },
    matchedChunks: [
      {
        chunkId: 'chunk-1',
        chunkIndex: 1,
        chunkKind: 'steps',
        sectionTitle: 'Steps',
        chunkText: 'Hold the reset button for 10 seconds.',
      },
    ],
    ...overrides,
  }
}

describe('rag answer generator', () => {
  it('rejects prompt templates without the rag placeholder', async () => {
    const llmClient: RagLlmClient = {
      generate: vi.fn(async () => 'unused'),
    }

    await expect(
      generateAnswer({
        query: 'reset router',
        recallResults: [],
        promptTemplate: 'Answer from evidence',
        llmClient,
      }),
    ).rejects.toThrow('{rag_qas_text}')
  })

  it('falls back to LLM generation when recall results are empty', async () => {
    const generate = vi.fn(async () => '暂时未找到准确答案。')
    const llmClient: RagLlmClient = { generate }

    const answer = await generateAnswer({
      query: 'reset router',
      recallResults: [],
      promptTemplate: 'Use this evidence:\n{rag_qas_text}',
      llmClient,
    })

    expect(answer.answerMode).toBe('llm_fallback')
    expect(answer.evidenceText).toBe('')
    expect(generate).toHaveBeenCalledWith(
      [
        { role: 'system', content: 'Use this evidence:\n' },
        { role: 'user', content: 'reset router' },
      ],
      expect.any(Object),
    )
  })

  it('returns extractive evidence when the candidate is confident', async () => {
    const generate = vi.fn(async () => 'should not be called')

    const answer = await generateAnswer({
      query: 'reset router',
      recallResults: [result({})],
      promptTemplate: 'Use this evidence:\n{rag_qas_text}',
      llmClient: { generate },
    })

    expect(answer.answerMode).toBe('extractive')
    expect(answer.answerText).toContain('Hold the reset button for 10 seconds.')
    expect(answer.selectedDocId).toBe('doc-reset')
    expect(answer.selectedChunkIds).toEqual(['chunk-1'])
    expect(generate).not.toHaveBeenCalled()
  })

  it('falls back to LLM generation when the selection margin is too small', async () => {
    const generate = vi.fn(async () => 'LLM generated answer')

    const answer = await generateAnswer({
      query: 'router reset',
      recallResults: [
        result({
          docId: 'doc-a',
          question: 'Router reset steps',
          score: 0.8,
          matchLane: 'hybrid',
          metadata: {},
        }),
        result({
          docId: 'doc-b',
          question: 'Reset router guide',
          score: 0.79,
          matchLane: 'hybrid',
          metadata: {},
        }),
      ],
      promptTemplate: 'Use this evidence:\n{rag_qas_text}',
      llmClient: { generate },
    })

    expect(answer.answerMode).toBe('llm_fallback')
    expect(answer.selectionMargin).toBeLessThan(0.15)
    expect(answer.answerText).toBe('LLM generated answer')
    expect(generate).toHaveBeenCalled()
  })

  it('renders top 10 recall results in the qa_verify evidence format', async () => {
    const generate = vi.fn(async () => 'LLM generated answer')
    const recallResults = Array.from({ length: 12 }, (_, index) =>
      result({
        docId: `doc-${index}`,
        question: `Router reset ${index}`,
        score: 0.9 - (index * 0.01),
        matchLane: 'hybrid',
        metadata: {},
        matchedChunks: [
          {
            chunkId: `chunk-${index}`,
            chunkIndex: 1,
            chunkKind: 'steps',
            sectionTitle: 'Steps',
            chunkText: `Reset step ${index}`,
          },
        ],
      }),
    )

    const answer = await generateAnswer({
      query: 'router reset',
      recallResults,
      promptTemplate: 'Use this evidence:\n{rag_qas_text}',
      llmClient: { generate },
      policy: { extractiveEnabled: false },
    })

    expect(answer.answerMode).toBe('llm_fallback')
    expect(answer.evidenceText).toContain('[1] 问题: Router reset 0')
    expect(answer.evidenceText).toContain('文档ID: doc-0')
    expect(answer.evidenceText).toContain('召回分数: 0.9000')
    expect(answer.evidenceText).toContain('匹配片段:')
    expect(answer.evidenceText).toContain('[chunk-0] (steps) Reset step 0')
    expect(answer.evidenceText).toContain('[10] 问题: Router reset 9')
    expect(answer.evidenceText).not.toContain('[11] 问题: Router reset 10')
  })
})
