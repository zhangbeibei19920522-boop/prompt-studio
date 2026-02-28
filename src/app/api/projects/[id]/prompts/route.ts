import { NextResponse } from 'next/server'
import { findPromptsByProject, createPrompt } from '@/lib/db/repositories/prompts'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const data = findPromptsByProject(id)
    return NextResponse.json({ success: true, data, error: null })
  } catch (err) {
    console.error('[GET /api/projects/[id]/prompts]', err)
    return NextResponse.json(
      { success: false, data: null, error: 'Failed to fetch prompts' },
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

    if (!body.title) {
      return NextResponse.json(
        { success: false, data: null, error: 'Field "title" is required' },
        { status: 400 }
      )
    }

    const data = createPrompt({ ...body, projectId: id })
    return NextResponse.json({ success: true, data, error: null }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/projects/[id]/prompts]', err)
    return NextResponse.json(
      { success: false, data: null, error: 'Failed to create prompt' },
      { status: 500 }
    )
  }
}
