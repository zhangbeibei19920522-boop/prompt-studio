import { NextRequest, NextResponse } from 'next/server'
import { handleAgentChat } from '@/lib/ai/agent'
import { createSSEStream } from '@/lib/ai/stream-handler'
import type { MessageReference } from '@/types/database'

/**
 * POST /api/ai/chat
 *
 * SSE endpoint that streams Agent responses for a given session.
 *
 * Request body:
 *   { sessionId: string, content: string, references?: MessageReference[] }
 *
 * Response: text/event-stream with StreamEvent objects encoded as SSE lines.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      sessionId?: string
      content?: string
      references?: MessageReference[]
    }

    const { sessionId, content, references = [] } = body

    if (!sessionId || typeof sessionId !== 'string') {
      return NextResponse.json(
        { success: false, data: null, error: 'sessionId is required' },
        { status: 400 }
      )
    }

    if (!content || typeof content !== 'string') {
      return NextResponse.json(
        { success: false, data: null, error: 'content is required' },
        { status: 400 }
      )
    }

    const generator = handleAgentChat(sessionId, content, references)
    const stream = createSSEStream(generator)

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  } catch (error) {
    console.error('[POST /api/ai/chat]', error)
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json(
      { success: false, data: null, error: message },
      { status: 500 }
    )
  }
}
