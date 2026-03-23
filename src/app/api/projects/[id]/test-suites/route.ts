import { NextRequest, NextResponse } from 'next/server'
import { findTestSuitesByProject, createTestSuite } from '@/lib/db/repositories/test-suites'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const data = findTestSuitesByProject(id)
    return NextResponse.json({ success: true, data, error: null })
  } catch (err) {
    console.error('[GET /api/projects/[id]/test-suites]', err)
    return NextResponse.json(
      { success: false, data: null, error: 'Failed to fetch test suites' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    if (!body.name) {
      return NextResponse.json(
        { success: false, data: null, error: 'Field "name" is required' },
        { status: 400 }
      )
    }

    const data = createTestSuite({
      projectId: id,
      name: body.name,
      description: body.description,
      sessionId: body.sessionId,
      workflowMode: body.workflowMode,
      routingConfig: body.routingConfig,
    })
    return NextResponse.json({ success: true, data, error: null }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/projects/[id]/test-suites]', err)
    return NextResponse.json(
      { success: false, data: null, error: 'Failed to create test suite' },
      { status: 500 }
    )
  }
}
