import * as XLSX from 'xlsx'

describe('parseConversationHistoryWorkbook', () => {
  it('groups rows by conversation and builds user-to-bot turns', async () => {
    const workbook = XLSX.utils.book_new()
    const worksheet = XLSX.utils.aoa_to_sheet([
      ['Conversation ID', 'Message Sender', 'Message'],
      ['conv-1', 'user', 'How do I reset my password?'],
      ['conv-1', 'bot', 'Open the password reset page.'],
      ['conv-1', 'bot', 'Then follow the link sent to your email.'],
      ['conv-1', 'user', 'What if I do not get the email?'],
      ['conv-1', 'user', 'Can support help me manually?'],
      ['conv-1', 'bot', 'Support can verify your identity first.'],
      ['conv-2', 'user', 'How do I change my phone number?'],
      ['conv-2', 'agent', 'Invalid sender row'],
    ])
    XLSX.utils.book_append_sheet(workbook, worksheet, 'History')

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer
    const { parseConversationHistoryWorkbook } = await import('@/lib/audit/history-parser')

    const result = parseConversationHistoryWorkbook(buffer)

    expect(result.conversations).toEqual([
      { externalConversationId: 'conv-1', turnCount: 3 },
      { externalConversationId: 'conv-2', turnCount: 1 },
    ])
    expect(result.turns).toEqual([
      {
        externalConversationId: 'conv-1',
        turnIndex: 0,
        userMessage: 'How do I reset my password?',
        botReply: 'Open the password reset page.\nThen follow the link sent to your email.',
      },
      {
        externalConversationId: 'conv-1',
        turnIndex: 1,
        userMessage: 'What if I do not get the email?',
        botReply: '',
      },
      {
        externalConversationId: 'conv-1',
        turnIndex: 2,
        userMessage: 'Can support help me manually?',
        botReply: 'Support can verify your identity first.',
      },
      {
        externalConversationId: 'conv-2',
        turnIndex: 0,
        userMessage: 'How do I change my phone number?',
        botReply: '',
      },
    ])
    expect(result.summary).toMatchObject({
      totalRows: 8,
      validRows: 7,
      invalidRows: 1,
      conversationCount: 2,
      turnCount: 4,
    })
    expect(result.summary.errors).toEqual([
      {
        sheetName: 'History',
        rowNumber: 9,
        message: 'Unsupported Message Sender value: agent',
      },
    ])
  })

  it('requires the exact expected columns', async () => {
    const workbook = XLSX.utils.book_new()
    const worksheet = XLSX.utils.aoa_to_sheet([
      ['ConversationId', 'Sender', 'Text'],
      ['conv-1', 'user', 'Question'],
    ])
    XLSX.utils.book_append_sheet(workbook, worksheet, 'History')

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer
    const { parseConversationHistoryWorkbook } = await import('@/lib/audit/history-parser')

    expect(() => parseConversationHistoryWorkbook(buffer)).toThrow(
      'History sheet must contain exact columns: Conversation ID, Message Sender, Message'
    )
  })
})
