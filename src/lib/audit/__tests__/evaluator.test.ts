import type { AiProvider, ChatMessage } from '@/types/ai'

describe('evaluateConversationAuditTurn', () => {
  it('maps a valid JSON response into hasIssue and knowledgeAnswer', async () => {
    const messagesSeen: ChatMessage[][] = []
    const provider: AiProvider = {
      async chat(messages) {
        messagesSeen.push(messages)
        return '```json\n{"hasIssue":true,"knowledgeAnswer":"Use the reset link from the login page."}\n```'
      },
      async *chatStream() {},
    }

    const { evaluateConversationAuditTurn } = await import('@/lib/audit/evaluator')

    const result = await evaluateConversationAuditTurn(provider, {
      userMessage: 'How do I reset my password?',
      botReply: 'I am not sure.',
      knowledge: [
        {
          sourceName: 'faq.docx',
          sourceType: 'docx',
          sheetName: null,
          chunkIndex: 0,
          content: 'Reset password | Use the reset link from the login page.',
        },
      ],
    })

    expect(result).toEqual({
      hasIssue: true,
      knowledgeAnswer: 'Use the reset link from the login page.',
    })
    expect(messagesSeen[0]?.[1]?.content).toContain('How do I reset my password?')
    expect(messagesSeen[0]?.[1]?.content).toContain('I am not sure.')
    expect(messagesSeen[0]?.[1]?.content).toContain('faq.docx')
  })

  it('falls back when the model response is malformed', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const provider: AiProvider = {
      async chat() {
        return 'not valid json'
      },
      async *chatStream() {},
    }

    const { evaluateConversationAuditTurn } = await import('@/lib/audit/evaluator')

    const result = await evaluateConversationAuditTurn(provider, {
      userMessage: 'Question',
      botReply: 'Answer',
      knowledge: [],
    })

    expect(result).toEqual({
      hasIssue: null,
      knowledgeAnswer: '',
    })
    expect(consoleError).toHaveBeenCalledWith(
      '[ConversationAudit] Failed to parse evaluation response',
      expect.objectContaining({
        userMessage: 'Question',
        botReply: 'Answer',
        rawResponsePreview: 'not valid json',
      })
    )
  })

  it('logs provider failures before falling back', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const provider: AiProvider = {
      async chat() {
        throw new Error('boom')
      },
      async *chatStream() {},
    }

    const { evaluateConversationAuditTurn } = await import('@/lib/audit/evaluator')

    const result = await evaluateConversationAuditTurn(provider, {
      userMessage: 'Question',
      botReply: 'Answer',
      knowledge: [],
    })

    expect(result).toEqual({
      hasIssue: null,
      knowledgeAnswer: '',
    })
    expect(consoleError).toHaveBeenCalledWith(
      '[ConversationAudit] Evaluation request failed',
      expect.objectContaining({
        userMessage: 'Question',
        botReply: 'Answer',
        error: 'boom',
      })
    )
  })
})
