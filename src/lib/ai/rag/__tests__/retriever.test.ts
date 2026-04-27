import {
  createLocalTextVector,
  anchorPhraseScore,
  lexicalOverlapScore,
  normalizeText,
  phraseOverlapBonus,
} from '@/lib/ai/rag/text'
import { searchIndexIngest } from '@/lib/ai/rag/retriever'

describe('rag text scoring', () => {
  it('normalizes text for retrieval matching', () => {
    expect(normalizeText(' How do I reset the Router? ')).toBe('howdoiresettherouter')
    expect(normalizeText('蓝牙 耳机，怎么清洁？')).toBe('蓝牙耳机怎么清洁')
    expect(normalizeText('鿿 特殊汉字')).toBe('鿿特殊汉字')
  })

  it('scores lexical overlap higher for related text', () => {
    const related = lexicalOverlapScore('reset router password', 'How to reset the router password')
    const unrelated = lexicalOverlapScore('reset router password', 'refunds arrive within 7 days')

    expect(related).toBeGreaterThan(unrelated)
    expect(related).toBeGreaterThan(0)
  })

  it('rewards shared phrases and anchors', () => {
    expect(phraseOverlapBonus('reset router password', 'reset router password steps')).toBeGreaterThan(
      phraseOverlapBonus('reset router password', 'router setup guide'),
    )
    expect(anchorPhraseScore('reset router password', 'How to reset router password')).toBeGreaterThan(0)
  })
})

describe('rag retriever', () => {
  it('prefers exact alias matches over unrelated parents', () => {
    const result = searchIndexIngest({
      query: 'reset router',
      ingest: {
        parents: [
          {
            id: 'parent-1',
            question_clean: 'How do I reset the router?',
            question_aliases: ['reset router'],
            metadata: {
              questionNormalized: 'howdoiresettherouter',
              questionSignature: 'how do i reset the router',
              isExactFaq: true,
            },
          },
          {
            id: 'parent-2',
            question_clean: 'When do refunds arrive?',
            question_aliases: [],
            metadata: {
              questionNormalized: 'whendorefundsarrive',
              questionSignature: 'when do refunds arrive',
            },
          },
        ],
        chunks: [
          {
            id: 'chunk-1',
            parent_id: 'parent-1',
            chunk_order: 1,
            chunk_text: 'Hold the reset button for 10 seconds.',
            chunk_type: 'answer',
            metadata: { chunkKind: 'steps' },
          },
          {
            id: 'chunk-2',
            parent_id: 'parent-2',
            chunk_order: 1,
            chunk_text: 'Refunds arrive within 7 days.',
            chunk_type: 'answer',
            metadata: { chunkKind: 'policy' },
          },
        ],
      },
      topK: 10,
    })

    expect(result.results[0]).toEqual(
      expect.objectContaining({
        docId: 'parent-1',
        question: 'How do I reset the router?',
        matchLane: 'exact_alias',
      }),
    )
    expect(result.results[0]?.score).toBeGreaterThan(result.results[1]?.score ?? 0)
  })

  it('returns top 10 results by default', () => {
    const parents = Array.from({ length: 12 }, (_, index) => ({
      id: `parent-${index}`,
      question_clean: `Router reset method ${index}`,
      question_aliases: [],
      metadata: {
        questionNormalized: `routerresetmethod${index}`,
        questionSignature: `router reset method ${index}`,
      },
    }))
    const chunks = parents.map((parent, index) => ({
      id: `chunk-${index}`,
      parent_id: parent.id,
      chunk_order: 1,
      chunk_text: `Router reset method ${index} uses the reset button.`,
      chunk_type: 'answer',
      metadata: { chunkKind: 'steps' },
    }))

    const result = searchIndexIngest({
      query: 'router reset method',
      ingest: { parents, chunks },
    })

    expect(result.results).toHaveLength(10)
  })

  it('aggregates matched chunks under the parent document', () => {
    const result = searchIndexIngest({
      query: 'router reset',
      ingest: {
        parents: [
          {
            id: 'parent-1',
            question_clean: 'How do I reset the router?',
            question_aliases: [],
            metadata: {
              questionNormalized: 'howdoiresettherouter',
              questionSignature: 'how do i reset the router',
            },
          },
        ],
        chunks: [
          {
            id: 'chunk-2',
            parent_id: 'parent-1',
            chunk_order: 2,
            section_title: 'Warning',
            chunk_text: 'Back up your settings before reset.',
            chunk_type: 'answer',
            metadata: { chunkKind: 'note' },
          },
          {
            id: 'chunk-1',
            parent_id: 'parent-1',
            chunk_order: 1,
            section_title: 'Steps',
            chunk_text: 'Hold the reset button for 10 seconds.',
            chunk_type: 'answer',
            metadata: { chunkKind: 'steps' },
          },
        ],
      },
    })

    expect(result.results[0]?.matchedChunks.map((chunk) => chunk.chunkId)).toEqual(['chunk-1', 'chunk-2'])
  })

  it('uses local vector similarity as part of retrieval ranking', () => {
    const result = searchIndexIngest({
      query: 'bluetooth pairing',
      ingest: {
        parents: [
          {
            id: 'parent-1',
            question_clean: 'Alpha topic',
            question_aliases: [],
            metadata: {},
          },
          {
            id: 'parent-2',
            question_clean: 'Beta topic',
            question_aliases: [],
            metadata: {},
          },
        ],
        chunks: [
          {
            id: 'chunk-1',
            parent_id: 'parent-1',
            chunk_order: 1,
            chunk_text: 'Alpha content',
            chunk_type: 'answer',
          },
          {
            id: 'chunk-2',
            parent_id: 'parent-2',
            chunk_order: 1,
            chunk_text: 'Beta content',
            chunk_type: 'answer',
          },
        ],
        vectors: [
          {
            chunk_id: 'chunk-1',
            parent_id: 'parent-1',
            vector: createLocalTextVector('unrelated refund timing'),
          },
          {
            chunk_id: 'chunk-2',
            parent_id: 'parent-2',
            vector: createLocalTextVector('bluetooth pairing'),
          },
        ],
      },
      topK: 2,
    })

    expect(result.results[0]).toEqual(
      expect.objectContaining({
        docId: 'parent-2',
        matchLane: 'semantic',
      }),
    )
    expect(result.results[0]?.rerankScore).toBeGreaterThan(0)
  })

  it('uses BM25 and RRF lanes before document rerank', () => {
    const result = searchIndexIngest({
      query: '虚拟公交卡开通方法',
      ingest: {
        parents: [
          {
            id: 'doc-reset',
            question_clean: '如何恢复出厂设置',
            metadata: {},
          },
          {
            id: 'doc-card',
            question_clean: '公交卡服务办理入口',
            metadata: {},
          },
        ],
        chunks: [
          {
            id: 'doc-reset:0',
            parent_id: 'doc-reset',
            chunk_order: 0,
            chunk_text: '进入设置后重置手机。',
            embedding_text: '如何恢复出厂设置',
            chunk_type: 'steps',
          },
          {
            id: 'doc-card:0',
            parent_id: 'doc-card',
            chunk_order: 0,
            chunk_text: '打开钱包后进入公交卡页面，按提示开通。',
            embedding_text: '完全不相关的向量文本',
            chunk_type: 'steps',
          },
        ],
        vectors: [
          {
            chunk_id: 'doc-reset:0',
            parent_id: 'doc-reset',
            vector: createLocalTextVector('虚拟公交卡开通方法'),
          },
          {
            chunk_id: 'doc-card:0',
            parent_id: 'doc-card',
            vector: createLocalTextVector('恢复出厂设置'),
          },
        ],
      },
      topK: 2,
    })

    expect(result.results[0]).toEqual(
      expect.objectContaining({
        docId: 'doc-card',
        bm25Score: expect.any(Number),
        rrfScore: expect.any(Number),
        semanticScore: expect.any(Number),
        exactMatchScore: 0,
      }),
    )
    expect(result.results[0]?.bm25Score).toBeGreaterThan(0)
    expect(result.results[0]?.rerankScore).toBeGreaterThan(result.results[1]?.rerankScore ?? 0)
  })

  it('applies qa_verify style stage2 rerank under dense vector ties', () => {
    const tiedVector = [1, 0]
    const result = searchIndexIngest({
      query: '游戏弹幕设置方法',
      ingest: {
        parents: [
          {
            id: 'doc-intro',
            question_clean: '游戏弹幕功能介绍',
            metadata: {},
          },
          {
            id: 'doc-setup',
            question_clean: '游戏弹幕设置方法',
            metadata: {},
          },
        ],
        chunks: [
          {
            id: 'doc-intro:0',
            parent_id: 'doc-intro',
            chunk_order: 0,
            chunk_text: '游戏弹幕用于在游戏中显示微信、QQ、短信的弹幕提醒。',
            embedding_text: '游戏弹幕功能介绍',
            chunk_type: 'definition',
          },
          {
            id: 'doc-setup:0',
            parent_id: 'doc-setup',
            chunk_order: 0,
            chunk_text: '进入游戏助手后打开弹幕通知即可。',
            embedding_text: '游戏弹幕设置方法',
            chunk_type: 'steps',
          },
        ],
        vectors: [
          { chunk_id: 'doc-intro:0', parent_id: 'doc-intro', vector: tiedVector },
          { chunk_id: 'doc-setup:0', parent_id: 'doc-setup', vector: tiedVector },
        ],
      },
      topK: 2,
      queryVector: tiedVector,
      bm25Enabled: false,
    })

    expect(result.results.map((item) => item.docId)).toEqual(['doc-setup', 'doc-intro'])
    expect(result.results[0]?.rerankScore).toBeGreaterThan(result.results[1]?.rerankScore ?? 0)
  })

  it('matches snake_case exact aliases and exposes exact match score', () => {
    const result = searchIndexIngest({
      query: '这个手机激活了多久？',
      ingest: {
        parents: [
          {
            id: 'doc-semantic',
            question_clean: '手机使用时长查询',
            metadata: { is_exact_faq: 'false' },
          },
          {
            id: 'doc-exact',
            question_clean: '激活时间查询方法',
            metadata: {
              question_alias_signatures: ['这个手机激活了多久'],
              is_exact_faq: 'true',
            },
          },
        ],
        chunks: [
          {
            id: 'doc-semantic:0',
            parent_id: 'doc-semantic',
            chunk_order: 0,
            chunk_text: '可在设置中查看部分使用时长统计。',
            embedding_text: '手机使用时长查询',
            chunk_type: 'faq',
            metadata: { is_exact_faq: 'false' },
          },
          {
            id: 'doc-exact:0',
            parent_id: 'doc-exact',
            chunk_order: 0,
            chunk_text: '可通过真伪及激活查询入口查询激活时间。',
            embedding_text: '激活时间查询方法',
            chunk_type: 'steps',
            metadata: {
              question_alias_signatures: ['这个手机激活了多久'],
              is_exact_faq: 'true',
            },
          },
        ],
        vectors: [
          {
            chunk_id: 'doc-semantic:0',
            parent_id: 'doc-semantic',
            vector: createLocalTextVector('这个手机激活了多久'),
          },
          {
            chunk_id: 'doc-exact:0',
            parent_id: 'doc-exact',
            vector: createLocalTextVector('完全不相关'),
          },
        ],
      },
      topK: 2,
      bm25Enabled: false,
    })

    expect(result.results[0]).toEqual(
      expect.objectContaining({
        docId: 'doc-exact',
        matchLane: 'exact_alias',
        exactMatchScore: 2,
      }),
    )
  })

  it('can search with a precomputed query vector', () => {
    const result = searchIndexIngest({
      query: '怎么连接 wifi',
      queryVector: [1, 0],
      ingest: {
        parents: [
          { id: 'doc-wifi', question_clean: '怎么连接 WiFi', metadata: {} },
          { id: 'doc-reset', question_clean: '如何恢复出厂设置', metadata: {} },
        ],
        chunks: [
          {
            id: 'doc-wifi:0',
            parent_id: 'doc-wifi',
            chunk_order: 0,
            chunk_text: '打开设置后连接 WiFi。',
            embedding_text: '打开设置后连接 WiFi。',
            chunk_type: 'steps',
          },
          {
            id: 'doc-reset:0',
            parent_id: 'doc-reset',
            chunk_order: 0,
            chunk_text: '进入设置后重置手机。',
            embedding_text: '进入设置后重置手机。',
            chunk_type: 'steps',
          },
        ],
        vectors: [
          { chunk_id: 'doc-wifi:0', parent_id: 'doc-wifi', vector: [1, 0] },
          { chunk_id: 'doc-reset:0', parent_id: 'doc-reset', vector: [0, 1] },
        ],
      },
      topK: 1,
      bm25Enabled: false,
    })

    expect(result.results).toHaveLength(1)
    expect(result.results[0]?.docId).toBe('doc-wifi')
  })

  it('keeps qa_verify matched chunk selection contract', () => {
    const chunks = Array.from({ length: 10 }, (_, index) => ({
      id: `doc-long:${index}`,
      parent_id: 'doc-long',
      chunk_order: index,
      chunk_text: index === 7 ? '自动息屏设置的关键步骤。' : `补充说明 ${index}`,
      embedding_text: index === 7 ? '自动息屏设置' : `补充说明 ${index}`,
      chunk_type: 'steps',
      section_title: `ColorOS ${index}`,
    }))

    const result = searchIndexIngest({
      query: '自动息屏设置',
      ingest: {
        parents: [{ id: 'doc-long', question_clean: '自动息屏怎么设置', metadata: {} }],
        chunks,
        vectors: chunks.map((chunk) => ({
          chunk_id: chunk.id,
          parent_id: chunk.parent_id,
          vector: createLocalTextVector(chunk.embedding_text),
        })),
      },
      topK: 1,
      bm25Enabled: false,
    })

    expect(result.results[0]?.matchedChunks).toHaveLength(8)
    expect(result.results[0]?.matchedChunkIds).toEqual(result.results[0]?.matchedChunks.map((chunk) => chunk.chunkId))
    expect(result.results[0]?.matchedChunkCount).toBe(8)
    expect(result.results[0]?.matchedChunks.some((chunk) => chunk.chunkId === 'doc-long:7')).toBe(true)
  })

  it('applies an optional LLM rerank hook after stage2 rerank', () => {
    const result = searchIndexIngest({
      query: '请介绍一下云同步功能',
      ingest: {
        parents: [
          { id: 'doc-stage2', question_clean: '云同步介绍', metadata: {} },
          { id: 'doc-llm', question_clean: '云同步的机制说明', metadata: {} },
        ],
        chunks: [
          {
            id: 'doc-stage2:0',
            parent_id: 'doc-stage2',
            chunk_order: 0,
            chunk_text: '云同步会在本地设备和云端之间同步照片、联系人、便签等数据。',
            embedding_text: '云同步介绍',
            chunk_type: 'definition',
          },
          {
            id: 'doc-llm:0',
            parent_id: 'doc-llm',
            chunk_order: 0,
            chunk_text: '当用户在本地设备或云端新增、删除、编辑同步数据项时会触发云同步。',
            embedding_text: '云同步的机制说明',
            chunk_type: 'definition',
          },
        ],
        vectors: [
          { chunk_id: 'doc-stage2:0', parent_id: 'doc-stage2', vector: [1, 0] },
          { chunk_id: 'doc-llm:0', parent_id: 'doc-llm', vector: [1, 0] },
        ],
      },
      topK: 2,
      queryVector: [1, 0],
      llmRerankTopK: 2,
      llmReranker: (_query, candidates, topK) => {
        return candidates
          .map((candidate) => ({
            ...candidate,
            llmRerankScore: candidate.docId === 'doc-llm' ? 0.95 : 0.1,
            llmRerankCombinedScore: candidate.docId === 'doc-llm' ? 0.95 : 0.1,
          }))
          .sort((left, right) => (right.llmRerankCombinedScore ?? 0) - (left.llmRerankCombinedScore ?? 0))
          .slice(0, topK)
      },
    })

    expect(result.results.map((item) => item.docId)).toEqual(['doc-llm', 'doc-stage2'])
    expect(result.results[0]?.llmRerankScore).toBe(0.95)
  })
})
