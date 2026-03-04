import { NextResponse } from 'next/server'
import { findGlobalMemories, createMemory } from '@/lib/db/repositories/memories'

export async function GET() {
  try {
    const data = findGlobalMemories()
    return NextResponse.json({ success: true, data, error: null })
  } catch (err) {
    console.error('[GET /api/memories]', err)
    return NextResponse.json(
      { success: false, data: null, error: 'Failed to fetch global memories' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()

    if (!body.content) {
      return NextResponse.json(
        { success: false, data: null, error: 'Field "content" is required' },
        { status: 400 }
      )
    }

    const data = createMemory({
      scope: 'global',
      category: body.category ?? 'fact',
      content: body.content,
      source: body.source ?? 'manual',
    })
    return NextResponse.json({ success: true, data, error: null }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/memories]', err)
    return NextResponse.json(
      { success: false, data: null, error: 'Failed to create global memory' },
      { status: 500 }
    )
  }
}
