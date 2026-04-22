import { NextResponse } from 'next/server'

import { pushKnowledgeVersionToProd } from '@/lib/knowledge/service'

function mapStatus(error: unknown): number {
  return error instanceof Error && error.message.includes('not found') ? 404 : 500
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const data = pushKnowledgeVersionToProd(id)
    return NextResponse.json({ success: true, data, error: null })
  } catch (error) {
    console.error('[POST /api/knowledge-versions/[id]/push-prod]', error)
    return NextResponse.json(
      {
        success: false,
        data: null,
        error: error instanceof Error ? error.message : 'Failed to push knowledge version to PROD',
      },
      { status: mapStatus(error) }
    )
  }
}
