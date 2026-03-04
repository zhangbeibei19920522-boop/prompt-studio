import { NextResponse } from 'next/server'
import { findMemoryById, updateMemory, deleteMemory, promoteToGlobal } from '@/lib/db/repositories/memories'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const data = findMemoryById(id)

    if (!data) {
      return NextResponse.json(
        { success: false, data: null, error: 'Memory not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, data, error: null })
  } catch (err) {
    console.error('[GET /api/memories/[id]]', err)
    return NextResponse.json(
      { success: false, data: null, error: 'Failed to fetch memory' },
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

    const existing = findMemoryById(id)
    if (!existing) {
      return NextResponse.json(
        { success: false, data: null, error: 'Memory not found' },
        { status: 404 }
      )
    }

    // 提升为全局
    if (body.promote) {
      const data = promoteToGlobal(id)
      return NextResponse.json({ success: true, data, error: null })
    }

    const data = updateMemory(id, body)
    return NextResponse.json({ success: true, data, error: null })
  } catch (err) {
    console.error('[PUT /api/memories/[id]]', err)
    return NextResponse.json(
      { success: false, data: null, error: 'Failed to update memory' },
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

    const existing = findMemoryById(id)
    if (!existing) {
      return NextResponse.json(
        { success: false, data: null, error: 'Memory not found' },
        { status: 404 }
      )
    }

    deleteMemory(id)
    return NextResponse.json({ success: true, data: null, error: null })
  } catch (err) {
    console.error('[DELETE /api/memories/[id]]', err)
    return NextResponse.json(
      { success: false, data: null, error: 'Failed to delete memory' },
      { status: 500 }
    )
  }
}
