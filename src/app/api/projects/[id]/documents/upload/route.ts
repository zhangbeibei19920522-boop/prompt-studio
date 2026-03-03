import { NextResponse } from 'next/server'
import { createDocument } from '@/lib/db/repositories/documents'
import { parseDocumentBuffer } from '@/lib/utils/parse-document'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params
    const formData = await request.formData()
    const files = formData.getAll('files') as File[]

    if (files.length === 0) {
      return NextResponse.json(
        { success: false, data: null, error: 'No files provided' },
        { status: 400 }
      )
    }

    const results = []

    for (const file of files) {
      const arrayBuffer = await file.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)
      const ext = file.name.split('.').pop() ?? 'txt'

      const content = await parseDocumentBuffer(buffer, ext)

      const doc = createDocument({
        projectId,
        name: file.name,
        type: ext,
        content,
      })
      results.push(doc)
    }

    return NextResponse.json(
      { success: true, data: results, error: null },
      { status: 201 }
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to upload documents'
    console.error('[POST /api/projects/[id]/documents/upload]', err)
    return NextResponse.json(
      { success: false, data: null, error: message },
      { status: 500 }
    )
  }
}
