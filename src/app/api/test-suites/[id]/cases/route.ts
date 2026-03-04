import { NextRequest, NextResponse } from 'next/server'
import { findTestCasesBySuite, createTestCase, createTestCasesBatch } from '@/lib/db/repositories/test-cases'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const data = findTestCasesBySuite(id)
    return NextResponse.json({ success: true, data, error: null })
  } catch (err) {
    console.error('[GET /api/test-suites/[id]/cases]', err)
    return NextResponse.json(
      { success: false, data: null, error: 'Failed to fetch test cases' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: testSuiteId } = await params
    const body = await request.json()

    // Batch create if body is an array
    if (Array.isArray(body)) {
      const data = createTestCasesBatch(testSuiteId, body)
      return NextResponse.json({ success: true, data, error: null }, { status: 201 })
    }

    // Single create — validate required fields
    if (!body.title) {
      return NextResponse.json(
        { success: false, data: null, error: 'Field "title" is required' },
        { status: 400 }
      )
    }
    if (!body.input) {
      return NextResponse.json(
        { success: false, data: null, error: 'Field "input" is required' },
        { status: 400 }
      )
    }
    if (!body.expectedOutput) {
      return NextResponse.json(
        { success: false, data: null, error: 'Field "expectedOutput" is required' },
        { status: 400 }
      )
    }

    const data = createTestCase({
      testSuiteId,
      title: body.title,
      context: body.context,
      input: body.input,
      expectedOutput: body.expectedOutput,
      sortOrder: body.sortOrder,
    })
    return NextResponse.json({ success: true, data, error: null }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/test-suites/[id]/cases]', err)
    return NextResponse.json(
      { success: false, data: null, error: 'Failed to create test case(s)' },
      { status: 500 }
    )
  }
}
