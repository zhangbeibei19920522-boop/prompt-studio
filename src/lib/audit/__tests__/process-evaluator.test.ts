import type { AiProvider, ChatMessage } from '@/types/ai'

describe('evaluateConversationAuditConversation', () => {
  it('prioritizes process-like knowledge over unrelated faq chunks', async () => {
    const messagesSeen: ChatMessage[][] = []
    const provider: AiProvider = {
      async chat(messages) {
        messagesSeen.push(messages)
        return '```json\n{"processStatus":"failed","summary":"缺少订单核验","processSteps":[{"name":"核验订单信息","status":"failed","reason":"未执行核验","sourceNames":["售后SOP.docx"]}]}\n```'
      },
      async *chatStream() {},
    }

    const { evaluateConversationAuditConversation } = await import('@/lib/audit/process-evaluator')

    const result = await evaluateConversationAuditConversation(provider, {
      transcript: 'Round 1\nUser: 我要退款\nBot: 可以直接申请退款',
      knowledge: [
        {
          sourceName: '退款FAQ.docx',
          sourceType: 'docx',
          sheetName: null,
          chunkIndex: 0,
          content: '退款到账时间通常为 3-7 个工作日。',
        },
        {
          sourceName: '售后SOP.docx',
          sourceType: 'docx',
          sheetName: null,
          chunkIndex: 1,
          content: '退款流程\n1. 先确认用户诉求\n2. 必须核验订单信息\n3. 再判断退款条件\n4. 最后告知时效',
        },
        {
          sourceName: '运费规则.html',
          sourceType: 'html',
          sheetName: null,
          chunkIndex: 2,
          content: '运费退还规则：质量问题可退，非质量问题通常不退。',
        },
      ],
    })

    expect(result.processStatus).toBe('failed')
    expect(result.processSteps[0]).toMatchObject({
      name: '核验订单信息',
      status: 'failed',
      sourceNames: ['售后SOP.docx'],
    })
    expect(messagesSeen[0]?.[1]?.content).toContain('售后SOP.docx')
    expect(messagesSeen[0]?.[1]?.content).not.toContain('退款到账时间通常为 3-7 个工作日。')
  })

  it('falls back to unknown when no useful process knowledge is available', async () => {
    const provider: AiProvider = {
      async chat() {
        throw new Error('should not be called')
      },
      async *chatStream() {},
    }

    const { evaluateConversationAuditConversation } = await import('@/lib/audit/process-evaluator')

    const result = await evaluateConversationAuditConversation(provider, {
      transcript: 'Round 1\nUser: 你好\nBot: 你好',
      knowledge: [],
    })

    expect(result).toEqual({
      processStatus: 'unknown',
      summary: '未检索到足够的流程知识，暂时无法判断流程是否合规。',
      processSteps: [],
    })
  })

  it('preserves out-of-order step results from the model output', async () => {
    const provider: AiProvider = {
      async chat() {
        return '```json\n{"processStatus":"failed","summary":"退款条件判断顺序异常","processSteps":[{"name":"判断退款条件","status":"out_of_order","reason":"在核验订单信息前提前给出退款结论","sourceNames":["售后SOP.docx"]}]}\n```'
      },
      async *chatStream() {},
    }

    const { evaluateConversationAuditConversation } = await import('@/lib/audit/process-evaluator')

    const result = await evaluateConversationAuditConversation(provider, {
      transcript: 'Round 1\nUser: 我要退款\nBot: 可以直接退款',
      knowledge: [
        {
          sourceName: '售后SOP.docx',
          sourceType: 'docx',
          sheetName: null,
          chunkIndex: 0,
          content: '退款流程\n1. 先核验订单信息\n2. 再判断退款条件\n3. 最后告知时效',
        },
      ],
    })

    expect(result).toEqual({
      processStatus: 'failed',
      summary: '退款条件判断顺序异常',
      processSteps: [
        {
          name: '判断退款条件',
          status: 'out_of_order',
          reason: '在核验订单信息前提前给出退款结论',
          sourceNames: ['售后SOP.docx'],
        },
      ],
    })
  })
})
