import { NextResponse } from 'next/server'
import { extractMemoriesFromSession } from '@/lib/ai/memory-extraction'

export async function POST(request: Request) {
  try {
    const body = await request.json()

    if (!body.sessionId || typeof body.sessionId !== 'string') {
      return NextResponse.json(
        { success: false, data: null, error: 'Field "sessionId" is required' },
        { status: 400 }
      )
    }

    const data = await extractMemoriesFromSession(body.sessionId)
    return NextResponse.json({ success: true, data, error: null })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[POST /api/ai/extract-memories]', err)
    return NextResponse.json(
      { success: false, data: null, error: message },
      { status: 500 }
    )
  }
}
