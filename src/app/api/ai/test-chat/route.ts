import { NextRequest } from 'next/server'
import { handleTestAgentChat } from '@/lib/ai/agent'
import { createSSEStream } from '@/lib/ai/stream-handler'

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { sessionId, content } = body

  if (!sessionId || typeof sessionId !== 'string') {
    return new Response(
      JSON.stringify({ success: false, data: null, error: 'sessionId is required' }),
      { status: 400 }
    )
  }

  const generator = handleTestAgentChat(sessionId, content || '')
  const stream = createSSEStream(generator)

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
