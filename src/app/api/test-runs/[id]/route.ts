import { NextRequest, NextResponse } from 'next/server'
import { findTestRunById } from '@/lib/db/repositories/test-runs'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const data = findTestRunById(id)

    if (!data) {
      return NextResponse.json(
        { success: false, data: null, error: 'Test run not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, data, error: null })
  } catch (err) {
    console.error('[GET /api/test-runs/[id]]', err)
    return NextResponse.json(
      { success: false, data: null, error: 'Failed to fetch test run' },
      { status: 500 }
    )
  }
}
