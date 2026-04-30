import { NextResponse } from 'next/server'

import {
  createKnowledgeMappingVersionForProject,
  listKnowledgeMappingVersions,
} from '@/lib/knowledge/service'
import { parseDocumentBuffer } from '@/lib/utils/parse-document'

function getCreateErrorStatus(error: unknown): number {
  if (!(error instanceof Error)) return 500
  if (error.message.includes('was not found')) return 404
  if (error.message.includes('暂时无法解析')) return 400
  return 500
}

async function createFromJson(projectId: string, request: Request) {
  const body = await request.json()
  if (!body.name || !body.fileName || !body.content) {
    return NextResponse.json(
      { success: false, data: null, error: 'Fields "name", "fileName", and "content" are required' },
      { status: 400 },
    )
  }

  const data = createKnowledgeMappingVersionForProject(projectId, {
    name: body.name,
    fileName: body.fileName,
    content: body.content,
  })

  return NextResponse.json({ success: true, data, error: null }, { status: 201 })
}

async function createFromFormData(projectId: string, request: Request) {
  const formData = await request.formData()
  const files = formData.getAll('files') as File[]

  if (files.length === 0) {
    return NextResponse.json(
      { success: false, data: null, error: 'No files provided' },
      { status: 400 },
    )
  }

  const data = []
  for (const file of files) {
    const buffer = Buffer.from(await file.arrayBuffer())
    const ext = file.name.split('.').pop() ?? 'txt'
    const content = await parseDocumentBuffer(buffer, ext)
    data.push(
      createKnowledgeMappingVersionForProject(projectId, {
        name: file.name.replace(/\.[^.]+$/, ''),
        fileName: file.name,
        content,
      }),
    )
  }

  return NextResponse.json({ success: true, data, error: null }, { status: 201 })
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const data = listKnowledgeMappingVersions(id)
    return NextResponse.json({ success: true, data, error: null })
  } catch (error) {
    console.error('[GET /api/projects/[id]/knowledge-mapping-versions]', error)
    return NextResponse.json(
      { success: false, data: null, error: 'Failed to fetch knowledge mapping versions' },
      { status: 500 },
    )
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const contentType = request.headers.get('content-type') ?? ''
    if (contentType.includes('multipart/form-data')) {
      return await createFromFormData(id, request)
    }

    return await createFromJson(id, request)
  } catch (error) {
    console.error('[POST /api/projects/[id]/knowledge-mapping-versions]', error)
    return NextResponse.json(
      {
        success: false,
        data: null,
        error: error instanceof Error ? error.message : 'Failed to create knowledge mapping version',
      },
      { status: getCreateErrorStatus(error) },
    )
  }
}
