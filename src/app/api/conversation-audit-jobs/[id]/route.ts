import { NextResponse } from 'next/server'

import { findAuditConversationsByJob } from '@/lib/db/repositories/conversation-audit-conversations'
import {
  deleteConversationAuditJob,
  findConversationAuditJobById,
} from '@/lib/db/repositories/conversation-audit-jobs'
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

    return NextResponse.json({
      success: true,
      data: {
        job,
        parseSummary: job.parseSummary,
        conversations: findAuditConversationsByJob(id),
        turns: findAuditTurnsByJob(id),
      },
      error: null,
    })
  } catch (error) {
    console.error('[GET /api/conversation-audit-jobs/[id]]', error)
    return NextResponse.json(
      { success: false, data: null, error: 'Failed to fetch conversation audit job' },
      { status: 500 }
    )
  }
}

export async function DELETE(
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

    deleteConversationAuditJob(id)

    return NextResponse.json({
      success: true,
      data: null,
      error: null,
    })
  } catch (error) {
    console.error('[DELETE /api/conversation-audit-jobs/[id]]', error)
    return NextResponse.json(
      { success: false, data: null, error: 'Failed to delete conversation audit job' },
      { status: 500 }
    )
  }
}
