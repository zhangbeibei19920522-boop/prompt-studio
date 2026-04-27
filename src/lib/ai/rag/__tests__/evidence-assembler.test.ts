import {
  assembleEvidence,
  selectAnswerCandidate,
  selectionScoreMargin,
} from '@/lib/ai/rag/evidence-assembler'
import type { RetrievalResult } from '@/lib/ai/rag/types'

function result(overrides: Partial<RetrievalResult>): RetrievalResult {
  return {
    docId: 'doc-1',
    question: 'How do I reset the router?',
    score: 0.8,
    metadata: {},
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

describe('rag evidence assembler', () => {
  it('selects the strongest exact candidate from the candidate window', () => {
    const selected = selectAnswerCandidate('reset router', [
      result({
        docId: 'doc-overview',
        question: 'Router overview',
        score: 0.92,
        matchedChunks: [
          {
            chunkId: 'overview-1',
            chunkIndex: 1,
            chunkKind: 'definition',
            sectionTitle: 'Overview',
            chunkText: 'Routers connect devices to a network.',
          },
        ],
      }),
      result({
        docId: 'doc-reset',
        question: 'How do I reset the router?',
        score: 0.82,
        matchLane: 'exact_alias',
        metadata: { isExactFaq: true },
      }),
    ])

    expect(selected?.docId).toBe('doc-reset')
  })

  it('returns infinite selection margin when only one candidate exists', () => {
    expect(selectionScoreMargin('reset router', [result({})])).toBe(Number.POSITIVE_INFINITY)
  })

  it('assembles deduplicated chunks and prepends useful section titles', () => {
    const assembled = assembleEvidence('reset router', [
      result({
        docId: 'doc-reset',
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
          {
            chunkId: 'chunk-duplicate',
            chunkIndex: 2,
            chunkKind: 'steps',
            sectionTitle: 'Steps',
            chunkText: 'Hold the reset button for 10 seconds.',
          },
          {
            chunkId: 'chunk-2',
            chunkIndex: 3,
            chunkKind: 'note',
            sectionTitle: 'Warning',
            chunkText: 'Back up your settings before reset.',
          },
        ],
      }),
    ])

    expect(assembled).toEqual(
      expect.objectContaining({
        docId: 'doc-reset',
        chunkIds: ['chunk-1', 'chunk-2'],
      }),
    )
    expect(assembled?.text).toContain('Steps\nHold the reset button for 10 seconds.')
    expect(assembled?.text).toContain('Warning\nBack up your settings before reset.')
    expect(assembled?.text.match(/Hold the reset button/g)).toHaveLength(1)
  })

  it('treats exact lane and snake_case exact metadata as exact evidence sources', () => {
    const assembled = assembleEvidence('reset router', [
      result({
        docId: 'doc-reset',
        matchLane: 'exact_lane',
        metadata: { is_exact_faq: 'true' },
        matchedChunks: [
          {
            chunkId: 'chunk-1',
            chunkIndex: 1,
            chunkKind: 'steps',
            sectionTitle: 'Steps',
            chunkText: 'Hold the reset button for 10 seconds.',
          },
          {
            chunkId: 'chunk-2',
            chunkIndex: 2,
            chunkKind: 'condition',
            sectionTitle: 'Condition',
            chunkText: 'Disconnect power before continuing.',
          },
        ],
      }),
    ])

    expect(assembled?.chunkIds).toEqual(['chunk-1', 'chunk-2'])
  })

  it('returns null when no useful chunks can be assembled', () => {
    expect(
      assembleEvidence('reset router', [
        result({
          matchedChunks: [],
        }),
      ]),
    ).toBeNull()
  })
})
