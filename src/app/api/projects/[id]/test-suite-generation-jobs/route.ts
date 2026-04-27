import { NextRequest, NextResponse } from 'next/server'

import { findTestSuiteGenerationJobsByProject } from '@/lib/db/repositories/test-suite-generation-jobs'
import { resumeConfiguredTestSuiteGenerationJobs } from '@/lib/test-suite-generation/job-scheduler'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    resumeConfiguredTestSuiteGenerationJobs(id)
    const data = findTestSuiteGenerationJobsByProject(id)
    return NextResponse.json({ success: true, data, error: null })
  } catch (err) {
    console.error('[GET /api/projects/[id]/test-suite-generation-jobs]', err)
    return NextResponse.json(
      { success: false, data: null, error: 'Failed to fetch test suite generation jobs' },
      { status: 500 }
    )
  }
}
