import { NextResponse } from 'next/server'

import { listKnowledgeIndexVersions } from '@/lib/knowledge/service'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const data = listKnowledgeIndexVersions(id)
    return NextResponse.json({ success: true, data, error: null })
  } catch (error) {
    console.error('[GET /api/projects/[id]/knowledge-index-versions]', error)
    return NextResponse.json(
      { success: false, data: null, error: 'Failed to fetch knowledge index versions' },
      { status: 500 }
    )
  }
}
