import { NextResponse } from 'next/server'
import { findDocumentsByProject, createDocument } from '@/lib/db/repositories/documents'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const data = findDocumentsByProject(id)
    return NextResponse.json({ success: true, data, error: null })
  } catch (err) {
    console.error('[GET /api/projects/[id]/documents]', err)
    return NextResponse.json(
      { success: false, data: null, error: 'Failed to fetch documents' },
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

    if (!body.name) {
      return NextResponse.json(
        { success: false, data: null, error: 'Field "name" is required' },
        { status: 400 }
      )
    }

    if (!body.content) {
      return NextResponse.json(
        { success: false, data: null, error: 'Field "content" is required' },
        { status: 400 }
      )
    }

    const data = createDocument({ ...body, projectId: id })
    return NextResponse.json({ success: true, data, error: null }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/projects/[id]/documents]', err)
    return NextResponse.json(
      { success: false, data: null, error: 'Failed to create document' },
      { status: 500 }
    )
  }
}
