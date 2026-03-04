import { NextRequest, NextResponse } from 'next/server'
import { findTestRunsBySuite } from '@/lib/db/repositories/test-runs'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const data = findTestRunsBySuite(id)
    return NextResponse.json({ success: true, data, error: null })
  } catch (err) {
    console.error('[GET /api/test-suites/[id]/runs]', err)
    return NextResponse.json(
      { success: false, data: null, error: 'Failed to fetch test runs' },
      { status: 500 }
    )
  }
}
