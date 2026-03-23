import { NextResponse } from 'next/server'

import { findConversationAuditJobById } from '@/lib/db/repositories/conversation-audit-jobs'
import { runConversationAudit } from '@/lib/audit/runner'

export async function POST(
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

    if (job.status === 'parsing') {
      return NextResponse.json(
        { success: false, data: null, error: 'Conversation audit job is still parsing uploads' },
        { status: 409 }
      )
    }

    if (job.status === 'running') {
      return NextResponse.json(
        { success: false, data: null, error: 'Conversation audit job is already running' },
        { status: 409 }
      )
    }

    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of runConversationAudit(id)) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
          }
        } catch (error) {
          const event = {
            type: 'audit-error',
            data: {
              error: error instanceof Error ? error.message : 'Unknown error',
            },
          }
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
        } finally {
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  } catch (error) {
    console.error('[POST /api/conversation-audit-jobs/[id]/run]', error)
    return NextResponse.json(
      { success: false, data: null, error: 'Failed to run conversation audit job' },
      { status: 500 }
    )
  }
}
