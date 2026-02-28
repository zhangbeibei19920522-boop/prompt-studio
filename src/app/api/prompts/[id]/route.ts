import { NextResponse } from 'next/server'
import { findPromptById, updatePrompt, deletePrompt } from '@/lib/db/repositories/prompts'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const data = findPromptById(id)

    if (!data) {
      return NextResponse.json(
        { success: false, data: null, error: 'Prompt not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, data, error: null })
  } catch (err) {
    console.error('[GET /api/prompts/[id]]', err)
    return NextResponse.json(
      { success: false, data: null, error: 'Failed to fetch prompt' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    const existing = findPromptById(id)
    if (!existing) {
      return NextResponse.json(
        { success: false, data: null, error: 'Prompt not found' },
        { status: 404 }
      )
    }

    const data = updatePrompt(id, body)
    return NextResponse.json({ success: true, data, error: null })
  } catch (err) {
    console.error('[PUT /api/prompts/[id]]', err)
    return NextResponse.json(
      { success: false, data: null, error: 'Failed to update prompt' },
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

    const existing = findPromptById(id)
    if (!existing) {
      return NextResponse.json(
        { success: false, data: null, error: 'Prompt not found' },
        { status: 404 }
      )
    }

    deletePrompt(id)
    return NextResponse.json({ success: true, data: null, error: null })
  } catch (err) {
    console.error('[DELETE /api/prompts/[id]]', err)
    return NextResponse.json(
      { success: false, data: null, error: 'Failed to delete prompt' },
      { status: 500 }
    )
  }
}
