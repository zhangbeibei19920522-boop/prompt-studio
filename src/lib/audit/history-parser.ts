import * as XLSX from 'xlsx'

const REQUIRED_HEADERS = ['Conversation ID', 'Message Sender', 'Message'] as const

interface HistoryRowError {
  sheetName: string
  rowNumber: number
  message: string
}

interface ParsedConversationRow {
  conversationId: string
  sender: 'user' | 'bot'
  message: string
}

interface ParsedTurn {
  externalConversationId: string
  turnIndex: number
  userMessage: string
  botReply: string
}

interface ParsedConversation {
  externalConversationId: string
  turnCount: number
}

interface HistoryParseSummary {
  totalRows: number
  validRows: number
  invalidRows: number
  conversationCount: number
  turnCount: number
  errors: HistoryRowError[]
}

export interface ParsedConversationHistoryWorkbook {
  conversations: ParsedConversation[]
  turns: ParsedTurn[]
  summary: HistoryParseSummary
}

function normalizeCell(value: unknown): string {
  return String(value ?? '').trim()
}

function validateHeaders(sheetName: string, rows: unknown[][]): void {
  const headerRow = rows[0]?.map(normalizeCell) ?? []
  const isExactHeader =
    headerRow.length >= REQUIRED_HEADERS.length &&
    REQUIRED_HEADERS.every((header, index) => headerRow[index] === header)

  if (!isExactHeader) {
    throw new Error(
      `${sheetName ? 'History sheet' : 'Workbook'} must contain exact columns: ${REQUIRED_HEADERS.join(', ')}`
    )
  }
}

function finalizeConversationTurns(
  conversationId: string,
  rows: ParsedConversationRow[]
): ParsedTurn[] {
  const turns: ParsedTurn[] = []
  let currentTurn: ParsedTurn | null = null

  for (const row of rows) {
    if (row.sender === 'user') {
      if (currentTurn) {
        turns.push(currentTurn)
      }

      currentTurn = {
        externalConversationId: conversationId,
        turnIndex: turns.length,
        userMessage: row.message,
        botReply: '',
      }
      continue
    }

    if (!currentTurn) {
      continue
    }

    currentTurn.botReply = currentTurn.botReply
      ? `${currentTurn.botReply}\n${row.message}`
      : row.message
  }

  if (currentTurn) {
    turns.push(currentTurn)
  }

  return turns
}

export function parseConversationHistoryWorkbook(buffer: Buffer): ParsedConversationHistoryWorkbook {
  const workbook = XLSX.read(buffer, { type: 'buffer' })
  const groupedRows = new Map<string, ParsedConversationRow[]>()
  const errors: HistoryRowError[] = []
  let totalRows = 0
  let validRows = 0

  for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName]
    if (!worksheet) {
      continue
    }

    const rows = XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
      header: 1,
      defval: '',
      blankrows: false,
      raw: false,
    })

    if (rows.length === 0) {
      continue
    }

    validateHeaders(sheetName, rows)

    for (let rowIndex = 1; rowIndex < rows.length; rowIndex += 1) {
      const row = rows[rowIndex] ?? []
      totalRows += 1

      const conversationId = normalizeCell(row[0])
      const sender = normalizeCell(row[1]).toLowerCase()
      const message = normalizeCell(row[2])
      const rowNumber = rowIndex + 1

      if (!conversationId) {
        errors.push({
          sheetName,
          rowNumber,
          message: 'Conversation ID is required',
        })
        continue
      }

      if (sender !== 'user' && sender !== 'bot') {
        errors.push({
          sheetName,
          rowNumber,
          message: `Unsupported Message Sender value: ${normalizeCell(row[1])}`,
        })
        continue
      }

      if (!message) {
        errors.push({
          sheetName,
          rowNumber,
          message: 'Message is required',
        })
        continue
      }

      validRows += 1

      if (!groupedRows.has(conversationId)) {
        groupedRows.set(conversationId, [])
      }

      groupedRows.get(conversationId)!.push({
        conversationId,
        sender,
        message,
      })
    }
  }

  const turns: ParsedTurn[] = []
  const conversations: ParsedConversation[] = []

  for (const [conversationId, rows] of groupedRows.entries()) {
    const conversationTurns = finalizeConversationTurns(conversationId, rows)

    turns.push(...conversationTurns)
    conversations.push({
      externalConversationId: conversationId,
      turnCount: conversationTurns.length,
    })
  }

  return {
    conversations,
    turns,
    summary: {
      totalRows,
      validRows,
      invalidRows: errors.length,
      conversationCount: conversations.length,
      turnCount: turns.length,
      errors,
    },
  }
}
