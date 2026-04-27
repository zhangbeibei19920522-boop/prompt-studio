import type { TestRunEvent } from '@/types/ai'
import type {
  TestSuite,
  TestCase,
  TestCaseResult,
  Prompt,
  TestCaseRoutingStep,
} from '@/types/database'
import { createAiProvider } from './provider'
import { getSettings } from '@/lib/db/repositories/settings'
import { updateTestRun } from '@/lib/db/repositories/test-runs'
import { updateTestSuite } from '@/lib/db/repositories/test-suites'
import { evaluateIntentMatch, evaluateTestCase, evaluateOverall } from './test-evaluator'
import {
  executePromptForCase as executeCasePrompt,
  executeRoutingPromptForCase,
} from './routing-executor'
import { isAbortError, throwIfAborted } from '@/lib/test-run-abort'

interface RoutingRunOptions {
  routePrompts?: Record<string, Prompt>
  signal?: AbortSignal
}

function mergePersistedResults(
  caseResults: TestCaseResult[],
  evalResults: TestCaseResult[]
): TestCaseResult[] {
  if (evalResults.length === 0) {
    return caseResults
  }

  const evalResultMap = new Map(evalResults.map((result) => [result.testCaseId, result]))
  return caseResults.map((result) => evalResultMap.get(result.testCaseId) ?? result)
}

/**
 * Run a full test suite: execute each case against the LLM, evaluate results,
 * generate an overall report, and persist everything to the database.
 *
 * Yields TestRunEvent objects that can be streamed to the client via SSE.
 */
export async function* runTestSuite(
  runId: string,
  suite: TestSuite,
  cases: TestCase[],
  prompt: Prompt,
  options: RoutingRunOptions = {}
): AsyncGenerator<TestRunEvent> {
  const { config } = suite
  const { signal } = options
  const caseResults: TestCaseResult[] = []
  const evalResults: TestCaseResult[] = []
  try {
    throwIfAborted(signal)
    yield { type: 'test-start', data: { totalCases: cases.length } }

    if (!config.apiKey || !config.model) {
      const errorMsg = '测试集配置不完整：需要配置 API Key 和模型'
      yield { type: 'test-error', data: { error: errorMsg } }
      updateTestRun(runId, { status: 'failed' })
      updateTestSuite(suite.id, { status: 'ready' })
      return
    }

    let testProvider
    try {
      testProvider = createAiProvider({
        provider: config.provider,
        apiKey: config.apiKey,
        model: config.model,
        baseUrl: config.baseUrl,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      yield { type: 'test-error', data: { error: `创建测试 Provider 失败: ${message}` } }
      updateTestRun(runId, { status: 'failed' })
      updateTestSuite(suite.id, { status: 'ready' })
      return
    }

    for (let i = 0; i < cases.length; i++) {
      const testCase = cases[i]

      throwIfAborted(signal)
      yield {
        type: 'test-case-start',
        data: { caseId: testCase.id, index: i, title: testCase.title },
      }
      throwIfAborted(signal)

      let actualOutput = ''
      let actualIntent: string | null = null
      let matchedPromptId: string | null = null
      let matchedPromptTitle: string | null = null
      let routingSteps: TestCaseRoutingStep[] = []

      try {
        if (suite.workflowMode === 'routing' && suite.routingConfig) {
          const routingResult = await executeRoutingPromptForCase(
            testProvider,
            prompt,
            testCase,
            suite,
            options,
            {
              workflowMode: 'routing',
              provider: config.provider,
              model: config.model,
              caseId: testCase.id,
              caseTitle: testCase.title,
            }
          )
          actualOutput = routingResult.actualOutput
          actualIntent = routingResult.actualIntent
          matchedPromptId = routingResult.matchedPromptId
          matchedPromptTitle = routingResult.matchedPromptTitle
          routingSteps = routingResult.routingSteps
        } else {
          actualOutput = await executeCasePrompt(testProvider, prompt, testCase, {
            signal,
            debugContext: {
              workflowMode: 'single',
              provider: config.provider,
              model: config.model,
              caseId: testCase.id,
              caseTitle: testCase.title,
            },
          })
        }
      } catch (error) {
        if (isAbortError(error) || signal?.aborted) {
          throw error
        }
        const message = error instanceof Error ? error.message : String(error)
        actualOutput = `[ERROR] ${message}`
      }

      caseResults.push({
        testCaseId: testCase.id,
        actualOutput,
        actualIntent,
        matchedPromptId,
        matchedPromptTitle,
        routingSteps,
        passed: false,
        score: 0,
        reason: '',
      })

      updateTestRun(runId, {
        status: 'running',
        results: [...caseResults],
      })

      yield {
        type: 'test-case-done',
        data: {
          caseId: testCase.id,
          actualOutput,
          actualIntent,
          matchedPromptId,
          matchedPromptTitle,
          routingSteps,
        },
      }
    }

    throwIfAborted(signal)
    yield { type: 'eval-start' }

    let evalProvider
    try {
      const settings = getSettings()
      evalProvider = createAiProvider({
        provider: settings.provider,
        apiKey: settings.apiKey,
        model: settings.model,
        baseUrl: settings.baseUrl,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      const avgScore = 0
      const report = {
        summary: `评估 Provider 创建失败: ${message}`,
        totalCases: cases.length,
        passedCases: 0,
        score: avgScore,
        improvements: [],
        details: '无法创建评估 Provider，跳过评估阶段。',
      }
      yield { type: 'eval-report', data: report }
      updateTestRun(runId, {
        status: 'completed',
        results: caseResults,
        report,
        score: avgScore,
      })
      updateTestSuite(suite.id, { status: 'completed' })
      yield { type: 'test-complete', data: { runId, score: avgScore } }
      return
    }

    for (let i = 0; i < caseResults.length; i++) {
      throwIfAborted(signal)
      const caseResult = caseResults[i]
      const testCase = cases[i]

      try {
        const intentEval =
          suite.workflowMode === 'routing'
            ? evaluateIntentMatch(testCase.expectedIntent, caseResult.actualIntent)
            : null

        const hasRoutingError =
          suite.workflowMode === 'routing' &&
          Boolean(caseResult.routingSteps?.some((step) => step.routingError))

        const replyEval =
          hasRoutingError
            ? {
                passed: false,
                score: 0,
                reason: '路由未命中目标 Prompt，无法生成最终回复',
              }
            : await evaluateTestCase(
                evalProvider,
                {
                  title: testCase.title,
                  context: testCase.context,
                  input: testCase.input,
                  expectedOutput: testCase.expectedOutput,
                  actualOutput: caseResult.actualOutput,
                },
                { signal }
              )

        const passed = intentEval
          ? intentEval.passed && replyEval.passed
          : replyEval.passed
        const score = intentEval
          ? Math.round((intentEval.score + replyEval.score) / 2)
          : replyEval.score
        const reason = intentEval
          ? `路由评估：${intentEval.reason}\n回复评估：${replyEval.reason}`
          : replyEval.reason

        const evalResult: TestCaseResult = {
          ...caseResult,
          intentPassed: intentEval?.passed ?? null,
          intentScore: intentEval?.score ?? null,
          intentReason: intentEval?.reason ?? '',
          replyPassed: replyEval.passed,
          replyScore: replyEval.score,
          replyReason: replyEval.reason,
          passed,
          score,
          reason,
        }

        evalResults.push(evalResult)

        updateTestRun(runId, {
          status: 'running',
          results: mergePersistedResults(caseResults, evalResults),
        })

        yield {
          type: 'eval-case-done',
          data: {
            caseId: testCase.id,
            passed,
            score,
            reason,
            intentPassed: intentEval?.passed ?? null,
            intentScore: intentEval?.score ?? null,
            intentReason: intentEval?.reason ?? '',
            replyPassed: replyEval.passed,
            replyScore: replyEval.score,
            replyReason: replyEval.reason,
          },
        }
      } catch (error) {
        if (isAbortError(error) || signal?.aborted) {
          throw error
        }

        const fallbackResult: TestCaseResult = {
          ...caseResult,
          passed: false,
          score: 0,
          reason: '单条评估失败',
        }
        evalResults.push(fallbackResult)

        updateTestRun(runId, {
          status: 'running',
          results: mergePersistedResults(caseResults, evalResults),
        })

        yield {
          type: 'eval-case-done',
          data: {
            caseId: testCase.id,
            passed: false,
            score: 0,
            reason: '单条评估失败',
          },
        }
      }
    }

    let report
    try {
      report = await evaluateOverall(evalProvider, prompt, cases, evalResults, { signal })
    } catch (error) {
      if (isAbortError(error) || signal?.aborted) {
        throw error
      }

      const totalCases = cases.length
      const passedCases = evalResults.filter((result) => result.passed).length
      const avgScore =
        evalResults.length > 0
          ? Math.round(evalResults.reduce((sum, result) => sum + result.score, 0) / evalResults.length)
          : 0

      report = {
        summary: `共 ${totalCases} 个测试用例，通过 ${passedCases} 个，平均得分 ${avgScore}`,
        totalCases,
        passedCases,
        score: avgScore,
        improvements: [],
        details: '整体评估失败，以上为自动计算结果。',
      }
    }

    throwIfAborted(signal)
    yield { type: 'eval-report', data: report }

    updateTestRun(runId, {
      status: 'completed',
      results: evalResults,
      report,
      score: report.score,
    })
    updateTestSuite(suite.id, { status: 'completed' })

    yield { type: 'test-complete', data: { runId, score: report.score } }
  } catch (error) {
    if (isAbortError(error) || signal?.aborted) {
      updateTestRun(runId, {
        status: 'failed',
        results: mergePersistedResults(caseResults, evalResults),
      })
      updateTestSuite(suite.id, { status: 'ready' })
      return
    }

    const message = error instanceof Error ? error.message : String(error)
    yield { type: 'test-error', data: { error: message } }
    updateTestRun(runId, {
      status: 'failed',
      results: mergePersistedResults(caseResults, evalResults),
    })
    updateTestSuite(suite.id, { status: 'ready' })
  }
}
