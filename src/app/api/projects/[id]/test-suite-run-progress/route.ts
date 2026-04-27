import { NextRequest, NextResponse } from 'next/server'

import { findRunningTestSuiteProgressByProject } from '@/lib/db/repositories/test-runs'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const data = findRunningTestSuiteProgressByProject(id)
    return NextResponse.json({ success: true, data, error: null })
  } catch (err) {
    console.error('[GET /api/projects/[id]/test-suite-run-progress]', err)
    return NextResponse.json(
      { success: false, data: null, error: 'Failed to fetch test suite run progress' },
      { status: 500 }
    )
  }
}
