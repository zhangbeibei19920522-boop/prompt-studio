import { NextRequest } from 'next/server'

import { handleTestAgentChat } from '@/lib/ai/agent'
import { createSession } from '@/lib/db/repositories/sessions'
import {
  updateTestSuite,
} from '@/lib/db/repositories/test-suites'
import {
  updateTestSuiteGenerationJob,
} from '@/lib/db/repositories/test-suite-generation-jobs'
import {
  buildGenerationContent,
  buildGenerationReferences,
  getConfiguredSuitePromptId,
  getConfiguredSuiteWorkflowMode,
} from '@/lib/test-suite-generation/configured-generation'
import type { TestSuiteGenerationData } from '@/types/ai'
import type {
  GenerateConfiguredTestSuiteRequest,
} from '@/types/api'
import type { TestCase, TestSuiteRoutingConfig } from '@/types/database'

async function createCasesViaRoute(
  testSuiteId: string,
  cases: Array<{
    title: string
    context: string
    input: string
    expectedOutput: string
    expectedIntent?: string | null
  }>
) {
  const casesRoute = await import('@/app/api/test-suites/[id]/cases/route')
  const response = await casesRoute.POST(
    new NextRequest('http://localhost', {
      method: 'POST',
      body: JSON.stringify(cases),
    }),
    { params: Promise.resolve({ id: testSuiteId }) }
  )

  const payload = await response.json()
  if (!response.ok || !payload.success) {
    throw new Error(payload.error ?? 'Failed to create generated test cases')
  }

  return payload.data as TestCase[]
}

export async function runConfiguredTestSuiteGenerationJob(data: {
  projectId: string
  suiteId: string
  jobId: string
  request: GenerateConfiguredTestSuiteRequest
}) {
  const { projectId, suiteId, jobId, request } = data

  try {
    updateTestSuiteGenerationJob(jobId, {
      status: 'running',
      generatedCount: 0,
      totalCount: request.caseCount,
      errorMessage: null,
      completedAt: null,
    })

    const references = buildGenerationReferences(request)
    const content = buildGenerationContent(request, references)
    const generationSession = createSession({
      projectId,
      title: '测试集生成',
    })

    const routingConfig: TestSuiteRoutingConfig | null =
      request.section === 'full-flow' && request.structure === 'multi'
        ? request.routingConfig
        : null

    let generatedSuite: TestSuiteGenerationData | null = null

    for await (const event of handleTestAgentChat(generationSession.id, content, references, {
      routingConfig,
    })) {
      if (event.type === 'test-suite-progress') {
        updateTestSuiteGenerationJob(jobId, {
          status: 'running',
          generatedCount: event.data.generated,
          totalCount: event.data.total,
        })
      }

      if (event.type === 'test-suite') {
        generatedSuite = event.data
      }

      if (event.type === 'error') {
        throw new Error(event.message)
      }
    }

    if (!generatedSuite) {
      throw new Error('未生成测试集结果')
    }

    const persistedSuite = updateTestSuite(suiteId, {
      name: generatedSuite.name,
      description: generatedSuite.description,
      promptId: getConfiguredSuitePromptId(request),
      workflowMode: generatedSuite.workflowMode ?? getConfiguredSuiteWorkflowMode(request),
      routingConfig: generatedSuite.routingConfig ?? routingConfig,
      status: 'draft',
    })

    if (!persistedSuite) {
      throw new Error('Failed to update generated test suite')
    }

    await createCasesViaRoute(
      suiteId,
      generatedSuite.cases.map((testCase) => ({
        title: testCase.title,
        context: testCase.context,
        input: testCase.input,
        expectedOutput: testCase.expectedOutput,
        expectedIntent: testCase.expectedIntent ?? null,
      }))
    )

    updateTestSuiteGenerationJob(jobId, {
      status: 'completed',
      generatedCount: generatedSuite.cases.length,
      totalCount: generatedSuite.cases.length,
      errorMessage: null,
      completedAt: new Date().toISOString(),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : '生成测试集失败'

    console.error('[Configured test suite generation failed]', {
      jobId,
      suiteId,
      error: message,
    })

    updateTestSuiteGenerationJob(jobId, {
      status: 'failed',
      errorMessage: message,
      completedAt: new Date().toISOString(),
    })
  }
}
