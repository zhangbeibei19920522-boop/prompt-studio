import { NextResponse } from 'next/server'
import { findProjectMemories, createMemory } from '@/lib/db/repositories/memories'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const data = findProjectMemories(id)
    return NextResponse.json({ success: true, data, error: null })
  } catch (err) {
    console.error('[GET /api/projects/[id]/memories]', err)
    return NextResponse.json(
      { success: false, data: null, error: 'Failed to fetch project memories' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    if (!body.content) {
      return NextResponse.json(
        { success: false, data: null, error: 'Field "content" is required' },
        { status: 400 }
      )
    }

    const data = createMemory({
      scope: 'project',
      projectId: id,
      category: body.category ?? 'fact',
      content: body.content,
      source: body.source ?? 'manual',
      sourceSessionId: body.sourceSessionId ?? null,
    })
    return NextResponse.json({ success: true, data, error: null }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/projects/[id]/memories]', err)
    return NextResponse.json(
      { success: false, data: null, error: 'Failed to create project memory' },
      { status: 500 }
    )
  }
}
