import { NextResponse } from 'next/server'
import { findSessionsByProject, createSession } from '@/lib/db/repositories/sessions'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const data = findSessionsByProject(id)
    return NextResponse.json({ success: true, data, error: null })
  } catch (err) {
    console.error('[GET /api/projects/[id]/sessions]', err)
    return NextResponse.json(
      { success: false, data: null, error: 'Failed to fetch sessions' },
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

    const data = createSession({ projectId: id, title: body.title })
    return NextResponse.json({ success: true, data, error: null }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/projects/[id]/sessions]', err)
    return NextResponse.json(
      { success: false, data: null, error: 'Failed to create session' },
      { status: 500 }
    )
  }
}
