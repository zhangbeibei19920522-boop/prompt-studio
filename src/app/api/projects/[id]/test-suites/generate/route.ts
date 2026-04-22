import { NextRequest, NextResponse } from 'next/server'

import { createTestSuiteGenerationJob } from '@/lib/db/repositories/test-suite-generation-jobs'
import { createTestSuite } from '@/lib/db/repositories/test-suites'
import {
  buildPendingSuiteDescription,
  buildPendingSuiteName,
  getConfiguredSuitePromptId,
  getConfiguredSuiteWorkflowMode,
  isValidConversationMode,
  isValidSection,
  isValidStructure,
  isValidTargetType,
} from '@/lib/test-suite-generation/configured-generation'
import { runConfiguredTestSuiteGenerationJob } from '@/lib/test-suite-generation/run-configured-suite-generation'
import type {
  GenerateConfiguredTestSuiteRequest,
  GenerateConfiguredTestSuiteResponse,
} from '@/types/api'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params
    const body = (await request.json()) as Partial<GenerateConfiguredTestSuiteRequest>

    if (
      !isValidSection(body.section) ||
      !isValidStructure(body.structure) ||
      !isValidTargetType(body.targetType) ||
      !isValidConversationMode(body.conversationMode)
    ) {
      return NextResponse.json(
        { success: false, data: null, error: 'Invalid test suite generation config' },
        { status: 400 }
      )
    }

    if (!Array.isArray(body.generationSourceIds) || body.generationSourceIds.length === 0) {
      return NextResponse.json(
        { success: false, data: null, error: 'At least one generation source is required' },
        { status: 400 }
      )
    }

    if (typeof body.caseCount !== 'number' || body.caseCount <= 0) {
      return NextResponse.json(
        { success: false, data: null, error: 'caseCount must be a positive number' },
        { status: 400 }
      )
    }

    if (body.section === 'full-flow' && body.structure === 'single' && !body.promptId) {
      return NextResponse.json(
        { success: false, data: null, error: 'promptId is required for single full-flow tests' },
        { status: 400 }
      )
    }

    if (body.section === 'full-flow' && body.structure === 'multi' && !body.routingConfig) {
      return NextResponse.json(
        { success: false, data: null, error: 'routingConfig is required for multi full-flow tests' },
        { status: 400 }
      )
    }

    if (body.section === 'unit' && body.targetType === 'prompt' && !body.targetId) {
      return NextResponse.json(
        { success: false, data: null, error: 'targetId is required for prompt unit tests' },
        { status: 400 }
      )
    }

    if (
      body.section === 'unit' &&
      body.targetType === 'index-version' &&
      (!body.targetId || !body.embeddingRequestUrl || !body.embeddingModelName)
    ) {
      return NextResponse.json(
        {
          success: false,
          data: null,
          error: 'targetId, embeddingRequestUrl, and embeddingModelName are required for index version unit tests',
        },
        { status: 400 }
      )
    }

    const generationRequest = body as GenerateConfiguredTestSuiteRequest
    const suite = createTestSuite({
      projectId,
      section: generationRequest.section,
      name: buildPendingSuiteName(generationRequest),
      description: buildPendingSuiteDescription(generationRequest),
      promptId: getConfiguredSuitePromptId(generationRequest),
      workflowMode: getConfiguredSuiteWorkflowMode(generationRequest),
      routingConfig:
        generationRequest.section === 'full-flow' && generationRequest.structure === 'multi'
          ? generationRequest.routingConfig
          : null,
      status: 'draft',
    })

    const job = createTestSuiteGenerationJob({
      projectId,
      suiteId: suite.id,
      totalCount: generationRequest.caseCount,
    })

    setTimeout(() => {
      void runConfiguredTestSuiteGenerationJob({
        projectId,
        suiteId: suite.id,
        jobId: job.id,
        request: generationRequest,
      })
    }, 0)

    return NextResponse.json(
      {
        success: true,
        data: {
          suite,
          job,
        } satisfies GenerateConfiguredTestSuiteResponse,
        error: null,
      },
      { status: 202 }
    )
  } catch (err) {
    console.error('[POST /api/projects/[id]/test-suites/generate]', err)
    return NextResponse.json(
      {
        success: false,
        data: null,
        error: err instanceof Error ? err.message : 'Failed to generate configured test suite',
      },
      { status: 500 }
    )
  }
}
