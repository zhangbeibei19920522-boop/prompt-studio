import {
  executePromptForCase,
  executeRoutingPromptForCase,
  formatRoutingExpectedTranscript,
} from "@/lib/ai/routing-executor"
import { createAiProvider } from "@/lib/ai/provider"
import { findPromptById } from "@/lib/db/repositories/prompts"
import { getSettings } from "@/lib/db/repositories/settings"
import type { TestSuiteGenerationData } from "@/types/ai"
import type { TestCase, TestSuite, TestSuiteConfig } from "@/types/database"

type GeneratedCase = TestSuiteGenerationData["cases"][number]

export interface EnrichedGeneratedCase extends GeneratedCase {
  expectedOutputDiagnostics?: TestCase["expectedOutputDiagnostics"]
}

function resolveProviderConfig(suiteConfig: TestSuiteConfig): TestSuiteConfig {
  if (suiteConfig.provider && suiteConfig.apiKey && suiteConfig.model) {
    return suiteConfig
  }

  return getSettings()
}

function buildDraftTestCase(
  suiteId: string,
  testCase: GeneratedCase,
  index: number
): TestCase {
  return {
    id: `draft-case-${index}`,
    testSuiteId: suiteId,
    title: testCase.title,
    context: testCase.context ?? "",
    input: testCase.input,
    expectedOutput: testCase.expectedOutput,
    expectedOutputDiagnostics: null,
    expectedIntent: testCase.expectedIntent ?? null,
    sortOrder: index,
  }
}

export async function enrichGeneratedCasesForSuite(
  suite: TestSuite,
  cases: GeneratedCase[]
): Promise<EnrichedGeneratedCase[]> {
  if (cases.length === 0) {
    return cases
  }

  const providerConfig = resolveProviderConfig(suite.config)
  if (!providerConfig.apiKey || !providerConfig.model) {
    return cases
  }

  const provider = createAiProvider(providerConfig)

  if (suite.workflowMode === "routing") {
    if (!suite.routingConfig) {
      return cases
    }

    const entryPrompt = findPromptById(suite.routingConfig.entryPromptId)
    if (!entryPrompt) {
      return cases
    }

    const routePrompts = Object.fromEntries(
      [...new Set(
        suite.routingConfig.routes
          .map((route) => route.intent === 'R' ? route.ragPromptId : route.promptId)
          .filter((promptId): promptId is string => typeof promptId === 'string' && promptId.trim().length > 0),
      )]
        .map((promptId) => [promptId, findPromptById(promptId)])
        .filter((entry): entry is [string, NonNullable<ReturnType<typeof findPromptById>>] => Boolean(entry[1]))
    )

    const enrichedCases: EnrichedGeneratedCase[] = []
    for (const [index, testCase] of cases.entries()) {
      try {
        const draftTestCase = buildDraftTestCase(suite.id, testCase, index)
        const routingResult = await executeRoutingPromptForCase(
          provider,
          entryPrompt,
          draftTestCase,
          suite,
          { routePrompts }
        )

        const hasCompleteTranscript =
          routingResult.routingSteps.length > 0 &&
          routingResult.routingSteps.every((step) => step.actualReply)

        if (hasCompleteTranscript) {
          enrichedCases.push({
            ...testCase,
            expectedOutput: formatRoutingExpectedTranscript(testCase.input, routingResult),
            expectedOutputDiagnostics: null,
          })
          continue
        }

        enrichedCases.push({
          ...testCase,
          expectedOutputDiagnostics:
            routingResult.routingSteps.length > 0 ? routingResult.routingSteps : null,
        })
      } catch (error) {
        console.error("[Generated routing expected output enrichment failed]", {
          suiteId: suite.id,
          title: testCase.title,
          error,
        })
        enrichedCases.push(testCase)
      }
    }

    return enrichedCases
  }

  if (!suite.promptId) {
    return cases
  }

  const prompt = findPromptById(suite.promptId)
  if (!prompt) {
    return cases
  }

  const enrichedCases: EnrichedGeneratedCase[] = []
  for (const [index, testCase] of cases.entries()) {
    try {
      const draftTestCase = buildDraftTestCase(suite.id, testCase, index)
      const expectedOutput = await executePromptForCase(provider, prompt, draftTestCase)

      enrichedCases.push({
        ...testCase,
        expectedOutput,
      })
    } catch (error) {
      console.error("[Generated expected output enrichment failed]", {
        suiteId: suite.id,
        title: testCase.title,
        error,
      })
      enrichedCases.push(testCase)
    }
  }

  return enrichedCases
}
