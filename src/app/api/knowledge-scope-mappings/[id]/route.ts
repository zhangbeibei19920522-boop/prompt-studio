import { NextResponse } from 'next/server'

import {
  deleteKnowledgeScopeMappingForProject,
  getKnowledgeScopeMappingDetail,
  updateKnowledgeScopeMappingForProject,
} from '@/lib/knowledge/service'

function mapScopeMappingErrorToStatus(error: unknown): number {
  if (!(error instanceof Error)) return 500
  if (error.message.includes('was not found')) return 404
  if (error.message.includes('required')) return 400
  return 500
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const data = getKnowledgeScopeMappingDetail(id)
    return NextResponse.json({ success: true, data, error: null })
  } catch (error) {
    console.error('[GET /api/knowledge-scope-mappings/[id]]', error)
    return NextResponse.json(
      {
        success: false,
        data: null,
        error: error instanceof Error ? error.message : 'Failed to fetch knowledge scope mapping',
      },
      { status: mapScopeMappingErrorToStatus(error) },
    )
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const body = await request.json()
    const data = updateKnowledgeScopeMappingForProject(id, {
      name: body.name,
    })
    return NextResponse.json({ success: true, data, error: null })
  } catch (error) {
    console.error('[PATCH /api/knowledge-scope-mappings/[id]]', error)
    return NextResponse.json(
      {
        success: false,
        data: null,
        error: error instanceof Error ? error.message : 'Failed to update knowledge scope mapping',
      },
      { status: mapScopeMappingErrorToStatus(error) },
    )
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    deleteKnowledgeScopeMappingForProject(id)
    return NextResponse.json({ success: true, data: null, error: null })
  } catch (error) {
    console.error('[DELETE /api/knowledge-scope-mappings/[id]]', error)
    return NextResponse.json(
      {
        success: false,
        data: null,
        error: error instanceof Error ? error.message : 'Failed to delete knowledge scope mapping',
      },
      { status: mapScopeMappingErrorToStatus(error) },
    )
  }
}
