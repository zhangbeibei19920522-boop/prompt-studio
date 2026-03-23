import { NextRequest, NextResponse } from 'next/server'
import { findTestCasesBySuite, createTestCase, createTestCasesBatch } from '@/lib/db/repositories/test-cases'
import { findTestSuiteById } from '@/lib/db/repositories/test-suites'
import { findPromptById } from '@/lib/db/repositories/prompts'
import { getSettings } from '@/lib/db/repositories/settings'
import { createAiProvider } from '@/lib/ai/provider'
import { executeRoutingPromptForCase, formatRoutingExpectedTranscript } from '@/lib/ai/routing-executor'
import type { TestCase } from '@/types/database'

async function enrichRoutingCaseExpectedOutput(
  testSuiteId: string,
  draftCase: {
    title: string
    context?: string
    input: string
    expectedOutput: string
    expectedOutputDiagnostics?: TestCase['expectedOutputDiagnostics']
    expectedIntent?: string | null
    sortOrder?: number
  }
) {
  const suite = findTestSuiteById(testSuiteId)
  if (!suite || suite.workflowMode !== 'routing' || !suite.routingConfig) {
    return draftCase
  }

  const entryPrompt = findPromptById(suite.routingConfig.entryPromptId)
  if (!entryPrompt) {
    return draftCase
  }

  const routePrompts = Object.fromEntries(
    suite.routingConfig.routes
      .map((route) => [route.promptId, findPromptById(route.promptId)])
      .filter((entry): entry is [string, NonNullable<ReturnType<typeof findPromptById>>] => Boolean(entry[1]))
  )

  try {
    const settings = getSettings()
    const provider = createAiProvider({
      provider: settings.provider,
      apiKey: settings.apiKey,
      model: settings.model,
      baseUrl: settings.baseUrl,
    })

    const testCase: TestCase = {
      id: 'draft-case',
      testSuiteId,
      title: draftCase.title,
      context: draftCase.context ?? '',
      input: draftCase.input,
      expectedOutput: draftCase.expectedOutput,
      expectedIntent: draftCase.expectedIntent ?? null,
      sortOrder: draftCase.sortOrder ?? 0,
    }

    const routingResult = await executeRoutingPromptForCase(
      provider,
      entryPrompt,
      testCase,
      suite,
      { routePrompts }
    )

    const hasCompleteTranscript =
      routingResult.routingSteps.length > 0 &&
      routingResult.routingSteps.every((step) => step.actualReply)

    if (!hasCompleteTranscript) {
      return {
        ...draftCase,
        expectedOutputDiagnostics: routingResult.routingSteps.length > 0
          ? routingResult.routingSteps
          : null,
      }
    }

    return {
      ...draftCase,
      expectedOutput: formatRoutingExpectedTranscript(draftCase.input, routingResult),
      expectedOutputDiagnostics: null,
    }
  } catch (error) {
    console.error('[Routing expected output enrichment failed]', error)
    return draftCase
  }
}

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
      const enrichedCases = await Promise.all(
        body.map((draftCase) => enrichRoutingCaseExpectedOutput(testSuiteId, draftCase))
      )
      const data = createTestCasesBatch(testSuiteId, enrichedCases)
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

    const enrichedCase = await enrichRoutingCaseExpectedOutput(testSuiteId, body)

    const data = createTestCase({
      testSuiteId,
      title: enrichedCase.title,
      context: enrichedCase.context,
      input: enrichedCase.input,
      expectedOutput: enrichedCase.expectedOutput,
      expectedOutputDiagnostics: enrichedCase.expectedOutputDiagnostics,
      expectedIntent: enrichedCase.expectedIntent,
      sortOrder: enrichedCase.sortOrder,
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
