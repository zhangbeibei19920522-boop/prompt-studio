import { NextRequest, NextResponse } from 'next/server'
import { findTestSuiteById, updateTestSuite } from '@/lib/db/repositories/test-suites'
import { findTestCasesBySuite } from '@/lib/db/repositories/test-cases'
import { createTestRun, updateTestRun } from '@/lib/db/repositories/test-runs'
import { findPromptById } from '@/lib/db/repositories/prompts'
import { runTestSuite } from '@/lib/ai/test-runner'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const requestedPromptId = body.promptId

    // Validate suite exists
    const suite = findTestSuiteById(id)
    if (!suite) {
      return NextResponse.json(
        { success: false, data: null, error: 'Test suite not found' },
        { status: 404 }
      )
    }

    // Validate suite has cases
    const cases = findTestCasesBySuite(id)
    if (cases.length === 0) {
      return NextResponse.json(
        { success: false, data: null, error: 'Test suite has no test cases' },
        { status: 400 }
      )
    }

    const entryPromptId =
      suite.workflowMode === 'routing'
        ? suite.routingConfig?.entryPromptId ?? null
        : requestedPromptId

    if (!entryPromptId) {
      return NextResponse.json(
        { success: false, data: null, error: 'Field "promptId" is required' },
        { status: 400 }
      )
    }

    const prompt = findPromptById(entryPromptId)
    if (!prompt) {
      return NextResponse.json(
        { success: false, data: null, error: 'Prompt not found' },
        { status: 404 }
      )
    }

    const routePrompts =
      suite.workflowMode === 'routing' && suite.routingConfig
        ? Object.fromEntries(
            suite.routingConfig.routes
              .map((route) => {
                const routePrompt = findPromptById(route.promptId)
                return routePrompt ? [route.promptId, routePrompt] : null
              })
              .filter((entry): entry is [string, NonNullable<ReturnType<typeof findPromptById>>] => entry !== null)
          )
        : undefined

    // Update suite status to running and set promptId
    updateTestSuite(id, { status: 'running', promptId: entryPromptId })

    // Create test run record
    const run = createTestRun(id)

    // Create SSE stream
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const generator = runTestSuite(run.id, suite, cases, prompt, {
            routePrompts,
          })
          for await (const event of generator) {
            const data = `data: ${JSON.stringify(event)}\n\n`
            controller.enqueue(encoder.encode(data))
          }
        } catch (err) {
          console.error('[POST /api/test-suites/[id]/run] stream error', err)
          const errorEvent = {
            type: 'test-error',
            data: { error: err instanceof Error ? err.message : 'Unknown error' },
          }
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(errorEvent)}\n\n`))

          // Update run status to failed, suite back to ready
          updateTestRun(run.id, { status: 'failed' })
          updateTestSuite(id, { status: 'ready' })
        } finally {
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  } catch (err) {
    console.error('[POST /api/test-suites/[id]/run]', err)
    return NextResponse.json(
      { success: false, data: null, error: 'Failed to run test suite' },
      { status: 500 }
    )
  }
}
