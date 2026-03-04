import { NextRequest, NextResponse } from 'next/server'
import { findTestCaseById, updateTestCase, deleteTestCase } from '@/lib/db/repositories/test-cases'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const data = findTestCaseById(id)

    if (!data) {
      return NextResponse.json(
        { success: false, data: null, error: 'Test case not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, data, error: null })
  } catch (err) {
    console.error('[GET /api/test-cases/[id]]', err)
    return NextResponse.json(
      { success: false, data: null, error: 'Failed to fetch test case' },
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

    const existing = findTestCaseById(id)
    if (!existing) {
      return NextResponse.json(
        { success: false, data: null, error: 'Test case not found' },
        { status: 404 }
      )
    }

    const data = updateTestCase(id, body)
    return NextResponse.json({ success: true, data, error: null })
  } catch (err) {
    console.error('[PUT /api/test-cases/[id]]', err)
    return NextResponse.json(
      { success: false, data: null, error: 'Failed to update test case' },
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

    const existing = findTestCaseById(id)
    if (!existing) {
      return NextResponse.json(
        { success: false, data: null, error: 'Test case not found' },
        { status: 404 }
      )
    }

    deleteTestCase(id)
    return NextResponse.json({ success: true, data: null, error: null })
  } catch (err) {
    console.error('[DELETE /api/test-cases/[id]]', err)
    return NextResponse.json(
      { success: false, data: null, error: 'Failed to delete test case' },
      { status: 500 }
    )
  }
}
