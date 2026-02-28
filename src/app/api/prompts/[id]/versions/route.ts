import { NextResponse } from 'next/server'
import { findVersionsByPrompt } from '@/lib/db/repositories/prompt-versions'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const data = findVersionsByPrompt(id)
    return NextResponse.json({ success: true, data, error: null })
  } catch (err) {
    console.error('[GET /api/prompts/[id]/versions]', err)
    return NextResponse.json(
      { success: false, data: null, error: 'Failed to fetch prompt versions' },
      { status: 500 }
    )
  }
}
