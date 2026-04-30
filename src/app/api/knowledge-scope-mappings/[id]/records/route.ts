import { NextResponse } from 'next/server'

import {
  createKnowledgeScopeMappingRecordForMapping,
  getKnowledgeScopeMappingDetail,
} from '@/lib/knowledge/service'

function mapScopeMappingRecordErrorToStatus(error: unknown): number {
  if (!(error instanceof Error)) return 500
  if (error.message.includes('was not found')) return 404
  if (error.message.includes('already exists')) return 409
  if (error.message.includes('required')) return 400
  return 500
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const data = getKnowledgeScopeMappingDetail(id).records
    return NextResponse.json({ success: true, data, error: null })
  } catch (error) {
    console.error('[GET /api/knowledge-scope-mappings/[id]/records]', error)
    return NextResponse.json(
      {
        success: false,
        data: null,
        error: error instanceof Error ? error.message : 'Failed to fetch knowledge scope mapping records',
      },
      { status: mapScopeMappingRecordErrorToStatus(error) },
    )
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const body = await request.json()
    const data = createKnowledgeScopeMappingRecordForMapping(id, {
      lookupKey: body.lookupKey,
      scope: body.scope,
      raw: body.raw,
    })
    return NextResponse.json({ success: true, data, error: null }, { status: 201 })
  } catch (error) {
    console.error('[POST /api/knowledge-scope-mappings/[id]/records]', error)
    return NextResponse.json(
      {
        success: false,
        data: null,
        error: error instanceof Error ? error.message : 'Failed to create knowledge scope mapping record',
      },
      { status: mapScopeMappingRecordErrorToStatus(error) },
    )
  }
}
