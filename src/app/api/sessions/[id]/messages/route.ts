import { NextResponse } from 'next/server'
import { findMessagesBySession } from '@/lib/db/repositories/messages'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const data = findMessagesBySession(id)
    return NextResponse.json({ success: true, data, error: null })
  } catch (err) {
    console.error('[GET /api/sessions/[id]/messages]', err)
    return NextResponse.json(
      { success: false, data: null, error: 'Failed to fetch messages' },
      { status: 500 }
    )
  }
}
