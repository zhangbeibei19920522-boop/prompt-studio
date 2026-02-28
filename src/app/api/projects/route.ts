import { NextResponse } from 'next/server'
import { findAllProjects, createProject } from '@/lib/db/repositories/projects'

export async function GET() {
  try {
    const data = findAllProjects()
    return NextResponse.json({ success: true, data, error: null })
  } catch (err) {
    console.error('[GET /api/projects]', err)
    return NextResponse.json(
      { success: false, data: null, error: 'Failed to fetch projects' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()

    if (!body.name) {
      return NextResponse.json(
        { success: false, data: null, error: 'Field "name" is required' },
        { status: 400 }
      )
    }

    const data = createProject(body)
    return NextResponse.json({ success: true, data, error: null }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/projects]', err)
    return NextResponse.json(
      { success: false, data: null, error: 'Failed to create project' },
      { status: 500 }
    )
  }
}
