import { NextResponse } from 'next/server'

import { findKnowledgeVersionById } from '@/lib/db/repositories/knowledge-versions'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const data = findKnowledgeVersionById(id)

    if (!data) {
      return NextResponse.json(
        { success: false, data: null, error: 'Knowledge version not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, data, error: null })
  } catch (error) {
    console.error('[GET /api/knowledge-versions/[id]]', error)
    return NextResponse.json(
      { success: false, data: null, error: 'Failed to fetch knowledge version' },
      { status: 500 }
    )
  }
}
