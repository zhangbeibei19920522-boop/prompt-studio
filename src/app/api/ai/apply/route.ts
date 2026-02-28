import { NextRequest, NextResponse } from 'next/server'
import { createPrompt, updatePrompt } from '@/lib/db/repositories/prompts'
import type { PromptVariable } from '@/types/database'

interface ApplyBody {
  action?: string
  promptId?: string
  projectId?: string
  title?: string
  content?: string
  description?: string
  tags?: string[]
  variables?: PromptVariable[]
  changeNote?: string
  sessionId?: string
}

/**
 * POST /api/ai/apply
 *
 * Apply a prompt modification produced by the Agent — either create a new
 * prompt or update an existing one.
 *
 * Request body:
 *   action     'create' | 'update'    (required)
 *   projectId  string                 (required for create)
 *   promptId   string                 (required for update)
 *   title      string                 (required)
 *   content    string                 (required)
 *   description string
 *   tags        string[]
 *   variables   PromptVariable[]
 *   changeNote  string
 *   sessionId   string
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as ApplyBody

    const {
      action,
      promptId,
      projectId,
      title,
      content,
      description = '',
      tags = [],
      variables = [],
      changeNote,
      sessionId,
    } = body

    if (!action || (action !== 'create' && action !== 'update')) {
      return NextResponse.json(
        { success: false, data: null, error: 'action must be "create" or "update"' },
        { status: 400 }
      )
    }

    if (!title || typeof title !== 'string') {
      return NextResponse.json(
        { success: false, data: null, error: 'title is required' },
        { status: 400 }
      )
    }

    if (!content || typeof content !== 'string') {
      return NextResponse.json(
        { success: false, data: null, error: 'content is required' },
        { status: 400 }
      )
    }

    if (action === 'create') {
      if (!projectId || typeof projectId !== 'string') {
        return NextResponse.json(
          { success: false, data: null, error: 'projectId is required for create' },
          { status: 400 }
        )
      }

      const prompt = createPrompt({
        projectId,
        title,
        content,
        description,
        tags,
        variables,
        status: 'draft',
      })

      return NextResponse.json({ success: true, data: prompt, error: null })
    }

    // action === 'update'
    if (!promptId || typeof promptId !== 'string') {
      return NextResponse.json(
        { success: false, data: null, error: 'promptId is required for update' },
        { status: 400 }
      )
    }

    const updated = updatePrompt(
      promptId,
      { title, content, description, tags, variables, ...(changeNote ? {} : {}) },
      sessionId
    )

    if (!updated) {
      return NextResponse.json(
        { success: false, data: null, error: 'Prompt not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, data: updated, error: null })
  } catch (error) {
    console.error('[POST /api/ai/apply]', error)
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json(
      { success: false, data: null, error: message },
      { status: 500 }
    )
  }
}
