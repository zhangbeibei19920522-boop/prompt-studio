import { NextResponse } from 'next/server'
import { findDocumentById, deleteDocument } from '@/lib/db/repositories/documents'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const data = findDocumentById(id)

    if (!data) {
      return NextResponse.json(
        { success: false, data: null, error: 'Document not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, data, error: null })
  } catch (err) {
    console.error('[GET /api/documents/[id]]', err)
    return NextResponse.json(
      { success: false, data: null, error: 'Failed to fetch document' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const existing = findDocumentById(id)
    if (!existing) {
      return NextResponse.json(
        { success: false, data: null, error: 'Document not found' },
        { status: 404 }
      )
    }

    deleteDocument(id)
    return NextResponse.json({ success: true, data: null, error: null })
  } catch (err) {
    console.error('[DELETE /api/documents/[id]]', err)
    return NextResponse.json(
      { success: false, data: null, error: 'Failed to delete document' },
      { status: 500 }
    )
  }
}
