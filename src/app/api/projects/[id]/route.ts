import { NextResponse } from 'next/server'
import { findProjectById, updateProject, deleteProject } from '@/lib/db/repositories/projects'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const data = findProjectById(id)

    if (!data) {
      return NextResponse.json(
        { success: false, data: null, error: 'Project not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, data, error: null })
  } catch (err) {
    console.error('[GET /api/projects/[id]]', err)
    return NextResponse.json(
      { success: false, data: null, error: 'Failed to fetch project' },
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

    const existing = findProjectById(id)
    if (!existing) {
      return NextResponse.json(
        { success: false, data: null, error: 'Project not found' },
        { status: 404 }
      )
    }

    const data = updateProject(id, body)
    return NextResponse.json({ success: true, data, error: null })
  } catch (err) {
    console.error('[PUT /api/projects/[id]]', err)
    return NextResponse.json(
      { success: false, data: null, error: 'Failed to update project' },
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

    const existing = findProjectById(id)
    if (!existing) {
      return NextResponse.json(
        { success: false, data: null, error: 'Project not found' },
        { status: 404 }
      )
    }

    deleteProject(id)
    return NextResponse.json({ success: true, data: null, error: null })
  } catch (err) {
    console.error('[DELETE /api/projects/[id]]', err)
    return NextResponse.json(
      { success: false, data: null, error: 'Failed to delete project' },
      { status: 500 }
    )
  }
}
