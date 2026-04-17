import { NextResponse } from 'next/server'
import * as XLSX from 'xlsx'

import { findAuditConversationsByJob } from '@/lib/db/repositories/conversation-audit-conversations'
import { findConversationAuditJobById } from '@/lib/db/repositories/conversation-audit-jobs'
import { findAuditTurnsByJob } from '@/lib/db/repositories/conversation-audit-turns'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const job = findConversationAuditJobById(id)

    if (!job) {
      return NextResponse.json(
        { success: false, data: null, error: 'Conversation audit job not found' },
        { status: 404 }
      )
    }

    const conversations = findAuditConversationsByJob(id)
    const turns = findAuditTurnsByJob(id)
    const conversationIdMap = new Map(
      conversations.map((conversation) => [conversation.id, conversation.externalConversationId])
    )

    const rows = [
      [
        'Conversation ID',
        'Turn Index',
        'User Message',
        'Bot Reply',
        'Has Issue',
        'Knowledge Answer',
      ],
      ...turns.map((turn) => [
        conversationIdMap.get(turn.conversationId) ?? '',
        turn.turnIndex,
        turn.userMessage,
        turn.botReply,
        turn.hasIssue === true ? 'YES' : turn.hasIssue === false ? 'NO' : '',
        turn.knowledgeAnswer ?? '',
      ]),
    ]

    const workbook = XLSX.utils.book_new()
    const worksheet = XLSX.utils.aoa_to_sheet(rows)
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Audit Results')

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer

    return new Response(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${job.name}.xlsx"`,
      },
    })
  } catch (error) {
    console.error('[GET /api/conversation-audit-jobs/[id]/export]', error)
    return NextResponse.json(
      { success: false, data: null, error: 'Failed to export conversation audit job' },
      { status: 500 }
    )
  }
}
