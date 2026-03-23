import { NextRequest } from 'next/server'
import { handleTestAgentChat } from '@/lib/ai/agent'
import { createSSEStream } from '@/lib/ai/stream-handler'
import type { MessageReference, TestSuiteRoutingConfig } from '@/types/database'

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { sessionId, content, references = [], routingConfig } = body as {
    sessionId?: string
    content?: string
    references?: MessageReference[]
    routingConfig?: TestSuiteRoutingConfig | null
  }

  if (!sessionId || typeof sessionId !== 'string') {
    return new Response(
      JSON.stringify({ success: false, data: null, error: 'sessionId is required' }),
      { status: 400 }
    )
  }

  const generator = handleTestAgentChat(sessionId, content || '', references, {
    routingConfig: routingConfig ?? null,
  })
  const stream = createSSEStream(generator)

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
