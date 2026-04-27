import { handleTestAgentChat } from '@/lib/ai/agent'
import { createSession } from '@/lib/db/repositories/sessions'
import {
  replaceTestCasesForSuite,
} from '@/lib/db/repositories/test-cases'
import {
  updateTestSuite,
} from '@/lib/db/repositories/test-suites'
import {
  updateTestSuiteGenerationJob,
} from '@/lib/db/repositories/test-suite-generation-jobs'
import {
  buildGenerationMetadataForCase,
  buildGenerationContent,
  buildGenerationReferences,
  getConfiguredSuitePromptId,
  getConfiguredSuiteWorkflowMode,
  normalizeGenerationDocumentRouteModes,
  validateGeneratedCasesAgainstDocumentRouteModes,
} from '@/lib/test-suite-generation/configured-generation'
import { enrichGeneratedCasesForSuite } from '@/lib/test-suite-generation/enrich-generated-cases'
import type { TestSuiteGenerationData } from '@/types/ai'
import type {
  GenerateConfiguredTestSuiteRequest,
} from '@/types/api'
import type { TestSuiteRoutingConfig } from '@/types/database'

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
    const normalizedGenerationDocumentRouteModes = normalizeGenerationDocumentRouteModes({
      generationSourceIds: request.generationSourceIds,
      generationDocumentRouteModes: request.generationDocumentRouteModes,
    })

    for await (const event of handleTestAgentChat(generationSession.id, content, references, {
      routingConfig,
      documentRouteModes: normalizedGenerationDocumentRouteModes,
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

    const workflowMode = generatedSuite.workflowMode ?? getConfiguredSuiteWorkflowMode(request)

    const persistedSuite = updateTestSuite(suiteId, {
      name: request.suiteName.trim() || generatedSuite.name,
      description: generatedSuite.description,
      promptId: getConfiguredSuitePromptId(request),
      workflowMode,
      routingConfig: generatedSuite.routingConfig ?? routingConfig,
      status: 'draft',
    })

    if (!persistedSuite) {
      throw new Error('Failed to update generated test suite')
    }

    const casesToPersist =
      request.section === 'full-flow' && request.conversationMode === 'multi-turn'
        ? await enrichGeneratedCasesForSuite(persistedSuite, generatedSuite.cases)
        : generatedSuite.cases

    validateGeneratedCasesAgainstDocumentRouteModes(casesToPersist, {
      generationSourceIds: request.generationSourceIds,
      generationDocumentRouteModes: normalizedGenerationDocumentRouteModes,
      workflowMode,
    })

    replaceTestCasesForSuite(
      suiteId,
      casesToPersist.map((testCase) => ({
        title: testCase.title,
        context: testCase.context,
        input: testCase.input,
        expectedOutput: testCase.expectedOutput,
        expectedOutputDiagnostics: testCase.expectedOutputDiagnostics,
        expectedIntent: testCase.expectedIntent ?? null,
        generationMetadata: buildGenerationMetadataForCase(testCase, {
          generationSourceIds: request.generationSourceIds,
          generationDocumentRouteModes: normalizedGenerationDocumentRouteModes,
        }),
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
