import { NextResponse } from 'next/server'

import {
  deleteKnowledgeScopeMappingRecordForMapping,
  updateKnowledgeScopeMappingRecordForMapping,
} from '@/lib/knowledge/service'

function mapScopeMappingRecordErrorToStatus(error: unknown): number {
  if (!(error instanceof Error)) return 500
  if (error.message.includes('was not found')) return 404
  if (error.message.includes('already exists')) return 409
  if (error.message.includes('required')) return 400
  return 500
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const body = await request.json()
    const data = updateKnowledgeScopeMappingRecordForMapping(id, {
      lookupKey: body.lookupKey,
      scope: body.scope,
      raw: body.raw,
    })
    return NextResponse.json({ success: true, data, error: null })
  } catch (error) {
    console.error('[PATCH /api/knowledge-scope-mapping-records/[id]]', error)
    return NextResponse.json(
      {
        success: false,
        data: null,
        error: error instanceof Error ? error.message : 'Failed to update knowledge scope mapping record',
      },
      { status: mapScopeMappingRecordErrorToStatus(error) },
    )
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    deleteKnowledgeScopeMappingRecordForMapping(id)
    return NextResponse.json({ success: true, data: null, error: null })
  } catch (error) {
    console.error('[DELETE /api/knowledge-scope-mapping-records/[id]]', error)
    return NextResponse.json(
      {
        success: false,
        data: null,
        error: error instanceof Error ? error.message : 'Failed to delete knowledge scope mapping record',
      },
      { status: mapScopeMappingRecordErrorToStatus(error) },
    )
  }
}
