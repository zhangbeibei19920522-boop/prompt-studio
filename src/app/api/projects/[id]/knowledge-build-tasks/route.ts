import { NextResponse } from 'next/server'

import { findProjectById } from '@/lib/db/repositories/projects'
import { buildKnowledgeTaskForProject, findKnowledgeBaseForProject, listKnowledgeBuildTasks } from '@/lib/knowledge/service'

function hasBuildSources(body: {
  documentIds?: string[]
  manualDrafts?: unknown[]
  repairQuestions?: unknown[]
  taskType?: string
}): boolean {
  if (body.taskType === 'full') {
    return true
  }

  return Boolean(
    (body.documentIds?.length ?? 0) > 0 ||
      (body.manualDrafts?.length ?? 0) > 0 ||
      (body.repairQuestions?.length ?? 0) > 0
  )
}

function mapTaskErrorToStatus(error: unknown): number {
  if (!(error instanceof Error)) {
    return 500
  }

  if (error.message.includes('not found')) {
    return 404
  }

  if (error.message.includes('Document')) {
    return 400
  }

  return 500
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const data = listKnowledgeBuildTasks(id)
    return NextResponse.json({ success: true, data, error: null })
  } catch (error) {
    console.error('[GET /api/projects/[id]/knowledge-build-tasks]', error)
    return NextResponse.json(
      { success: false, data: null, error: 'Failed to fetch knowledge build tasks' },
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

    const knowledgeBase = findKnowledgeBaseForProject(id)
    if (!knowledgeBase) {
      return NextResponse.json(
        { success: false, data: null, error: 'Knowledge base not found' },
        { status: 404 }
      )
    }

    const body = await request.json()

    if (!body.name || !body.taskType) {
      return NextResponse.json(
        { success: false, data: null, error: 'Fields "name" and "taskType" are required' },
        { status: 400 }
      )
    }

    if (!hasBuildSources(body)) {
      return NextResponse.json(
        { success: false, data: null, error: 'At least one document, manual draft, or repair question is required' },
        { status: 400 }
      )
    }

    const data = buildKnowledgeTaskForProject(id, {
      name: body.name,
      taskType: body.taskType,
      baseVersionId: body.baseVersionId ?? null,
      documentIds: body.documentIds ?? [],
      manualDrafts: body.manualDrafts ?? [],
      repairQuestions: body.repairQuestions ?? [],
    })

    return NextResponse.json({ success: true, data, error: null }, { status: 201 })
  } catch (error) {
    console.error('[POST /api/projects/[id]/knowledge-build-tasks]', error)
    return NextResponse.json(
      {
        success: false,
        data: null,
        error: error instanceof Error ? error.message : 'Failed to build knowledge task',
      },
      { status: mapTaskErrorToStatus(error) }
    )
  }
}
