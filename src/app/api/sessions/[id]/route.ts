import { NextResponse } from 'next/server'
import { findSessionById, deleteSession } from '@/lib/db/repositories/sessions'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const data = findSessionById(id)

    if (!data) {
      return NextResponse.json(
        { success: false, data: null, error: 'Session not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, data, error: null })
  } catch (err) {
    console.error('[GET /api/sessions/[id]]', err)
    return NextResponse.json(
      { success: false, data: null, error: 'Failed to fetch session' },
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

    const existing = findSessionById(id)
    if (!existing) {
      return NextResponse.json(
        { success: false, data: null, error: 'Session not found' },
        { status: 404 }
      )
    }

    deleteSession(id)
    return NextResponse.json({ success: true, data: null, error: null })
  } catch (err) {
    console.error('[DELETE /api/sessions/[id]]', err)
    return NextResponse.json(
      { success: false, data: null, error: 'Failed to delete session' },
      { status: 500 }
    )
  }
}
