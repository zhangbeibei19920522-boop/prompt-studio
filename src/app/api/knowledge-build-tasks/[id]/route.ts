import { NextResponse } from 'next/server'

import { findKnowledgeBuildTaskById } from '@/lib/db/repositories/knowledge-build-tasks'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const data = findKnowledgeBuildTaskById(id)

    if (!data) {
      return NextResponse.json(
        { success: false, data: null, error: 'Knowledge build task not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, data, error: null })
  } catch (error) {
    console.error('[GET /api/knowledge-build-tasks/[id]]', error)
    return NextResponse.json(
      { success: false, data: null, error: 'Failed to fetch knowledge build task' },
      { status: 500 }
    )
  }
}
