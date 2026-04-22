import { NextResponse } from 'next/server'

import { findProjectById } from '@/lib/db/repositories/projects'
import { createKnowledgeBaseForProject, findKnowledgeBaseForProject } from '@/lib/knowledge/service'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const data = findKnowledgeBaseForProject(id)

    if (!data) {
      return NextResponse.json(
        { success: false, data: null, error: 'Knowledge base not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, data, error: null })
  } catch (error) {
    console.error('[GET /api/projects/[id]/knowledge-base]', error)
    return NextResponse.json(
      { success: false, data: null, error: 'Failed to fetch knowledge base' },
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
    const project = findProjectById(id)

    if (!project) {
      return NextResponse.json(
        { success: false, data: null, error: 'Project not found' },
        { status: 404 }
      )
    }

    const existing = findKnowledgeBaseForProject(id)
    if (existing) {
      return NextResponse.json(
        { success: false, data: null, error: 'Knowledge base already exists for this project' },
        { status: 409 }
      )
    }

    const body = await request.json()
    if (!body.name) {
      return NextResponse.json(
        { success: false, data: null, error: 'Field "name" is required' },
        { status: 400 }
      )
    }

    const data = createKnowledgeBaseForProject(id, body)
    return NextResponse.json({ success: true, data, error: null }, { status: 201 })
  } catch (error) {
    console.error('[POST /api/projects/[id]/knowledge-base]', error)
    return NextResponse.json(
      { success: false, data: null, error: 'Failed to create knowledge base' },
      { status: 500 }
    )
  }
}
