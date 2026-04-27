import { NextResponse } from 'next/server'

import { pushKnowledgeVersionToStg } from '@/lib/knowledge/service'

function mapStatus(error: unknown): number {
  return error instanceof Error && error.message.includes('not found') ? 404 : 500
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const data = await pushKnowledgeVersionToStg(id)
    return NextResponse.json({ success: true, data, error: null })
  } catch (error) {
    console.error('[POST /api/knowledge-versions/[id]/push-stg]', error)
    return NextResponse.json(
      {
        success: false,
        data: null,
        error: error instanceof Error ? error.message : 'Failed to push knowledge version to STG',
      },
      { status: mapStatus(error) }
    )
  }
}
