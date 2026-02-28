import { NextResponse } from 'next/server'
import { getSettings, updateSettings } from '@/lib/db/repositories/settings'

export async function GET() {
  try {
    const data = getSettings()
    return NextResponse.json({ success: true, data, error: null })
  } catch (err) {
    console.error('[GET /api/settings]', err)
    return NextResponse.json(
      { success: false, data: null, error: 'Failed to fetch settings' },
      { status: 500 }
    )
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const data = updateSettings(body)
    return NextResponse.json({ success: true, data, error: null })
  } catch (err) {
    console.error('[PUT /api/settings]', err)
    return NextResponse.json(
      { success: false, data: null, error: 'Failed to update settings' },
      { status: 500 }
    )
  }
}
