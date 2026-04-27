import { NextRequest, NextResponse } from 'next/server'
import { createAiProvider } from '@/lib/ai/provider'
import {
  executePromptForCase,
  executeRoutingPromptForCase,
  formatRoutingExpectedTranscript,
} from '@/lib/ai/routing-executor'
import { findPromptById } from '@/lib/db/repositories/prompts'
import { getSettings } from '@/lib/db/repositories/settings'
import { findTestCasesBySuite, updateTestCase } from '@/lib/db/repositories/test-cases'
import { findTestSuiteById } from '@/lib/db/repositories/test-suites'

function resolveProviderConfig(suiteConfig: {
  provider: string
  apiKey: string
  model: string
  baseUrl: string
}) {
  if (suiteConfig.provider && suiteConfig.apiKey && suiteConfig.model) {
    return suiteConfig
  }
  return getSettings()
}

export async function POST(
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

    const providerConfig = resolveProviderConfig(suite.config)
    if (!providerConfig.apiKey || !providerConfig.model) {
      return NextResponse.json(
        { success: false, data: null, error: '缺少模型配置，无法重生成预期结果' },
        { status: 400 }
      )
    }

    const provider = createAiProvider(providerConfig)
    const cases = findTestCasesBySuite(id)

    let prompt = suite.promptId ? findPromptById(suite.promptId) : null
    let routePrompts: Record<string, NonNullable<ReturnType<typeof findPromptById>>> = {}

    if (suite.workflowMode === 'routing') {
      if (!suite.routingConfig) {
        return NextResponse.json(
          { success: false, data: null, error: '测试集缺少路由配置' },
          { status: 400 }
        )
      }

      prompt = findPromptById(suite.routingConfig.entryPromptId)
      routePrompts = Object.fromEntries(
        [...new Set(
          suite.routingConfig.routes
            .map((route) => route.intent === 'R' ? route.ragPromptId : route.promptId)
            .filter((promptId): promptId is string => typeof promptId === 'string' && promptId.trim().length > 0),
        )]
          .map((promptId) => [promptId, findPromptById(promptId)])
          .filter((entry): entry is [string, NonNullable<ReturnType<typeof findPromptById>>] => Boolean(entry[1]))
      )
    }

    if (!prompt) {
      return NextResponse.json(
        { success: false, data: null, error: '未找到测试集关联的 Prompt' },
        { status: 400 }
      )
    }

    let updatedCount = 0

    for (const testCase of cases) {
      try {
        let expectedOutput = testCase.expectedOutput
        let expectedOutputDiagnostics = testCase.expectedOutputDiagnostics ?? null

        if (suite.workflowMode === 'routing') {
          const routingResult = await executeRoutingPromptForCase(
            provider,
            prompt,
            testCase,
            suite,
            { routePrompts }
          )

          const hasCompleteTranscript =
            routingResult.routingSteps.length > 0 &&
            routingResult.routingSteps.every((step) => step.actualReply)

          if (hasCompleteTranscript) {
            expectedOutput = formatRoutingExpectedTranscript(testCase.input, routingResult)
            expectedOutputDiagnostics = null
          } else if (routingResult.routingSteps.length > 0) {
            expectedOutputDiagnostics = routingResult.routingSteps
          }
        } else {
          expectedOutput = await executePromptForCase(provider, prompt, testCase)
          expectedOutputDiagnostics = null
        }

        const diagnosticsChanged =
          JSON.stringify(expectedOutputDiagnostics ?? null) !==
          JSON.stringify(testCase.expectedOutputDiagnostics ?? null)

        if (expectedOutput !== testCase.expectedOutput || diagnosticsChanged) {
          updateTestCase(testCase.id, {
            expectedOutput,
            expectedOutputDiagnostics,
          })
          updatedCount += 1
        }
      } catch (error) {
        console.error('[Regenerate expected output failed]', {
          suiteId: id,
          testCaseId: testCase.id,
          error,
        })
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        updatedCount,
        totalCount: cases.length,
      },
      error: null,
    })
  } catch (err) {
    console.error('[POST /api/test-suites/[id]/regenerate-expected-outputs]', err)
    return NextResponse.json(
      { success: false, data: null, error: 'Failed to regenerate expected outputs' },
      { status: 500 }
    )
  }
}
