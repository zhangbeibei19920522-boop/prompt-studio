import { NextRequest, NextResponse } from 'next/server'
import { findTestSuiteById, updateTestSuite, deleteTestSuite } from '@/lib/db/repositories/test-suites'
import { findTestCasesBySuite } from '@/lib/db/repositories/test-cases'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const suite = findTestSuiteById(id)

    if (!suite) {
      return NextResponse.json(
        { success: false, data: null, error: 'Test suite not found' },
        { status: 404 }
      )
    }

    const cases = findTestCasesBySuite(id)
    return NextResponse.json({ success: true, data: { ...suite, cases }, error: null })
  } catch (err) {
    console.error('[GET /api/test-suites/[id]]', err)
    return NextResponse.json(
      { success: false, data: null, error: 'Failed to fetch test suite' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    const existing = findTestSuiteById(id)
    if (!existing) {
      return NextResponse.json(
        { success: false, data: null, error: 'Test suite not found' },
        { status: 404 }
      )
    }

    const data = updateTestSuite(id, body)
    return NextResponse.json({ success: true, data, error: null })
  } catch (err) {
    console.error('[PUT /api/test-suites/[id]]', err)
    return NextResponse.json(
      { success: false, data: null, error: 'Failed to update test suite' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const existing = findTestSuiteById(id)
    if (!existing) {
      return NextResponse.json(
        { success: false, data: null, error: 'Test suite not found' },
        { status: 404 }
      )
    }

    deleteTestSuite(id)
    return NextResponse.json({ success: true, data: null, error: null })
  } catch (err) {
    console.error('[DELETE /api/test-suites/[id]]', err)
    return NextResponse.json(
      { success: false, data: null, error: 'Failed to delete test suite' },
      { status: 500 }
    )
  }
}
