import { NextResponse } from 'next/server'

import { listKnowledgeVersions } from '@/lib/knowledge/service'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const data = listKnowledgeVersions(id)
    return NextResponse.json({ success: true, data, error: null })
  } catch (error) {
    console.error('[GET /api/projects/[id]/knowledge-versions]', error)
    return NextResponse.json(
      { success: false, data: null, error: 'Failed to fetch knowledge versions' },
      { status: 500 }
    )
  }
}
