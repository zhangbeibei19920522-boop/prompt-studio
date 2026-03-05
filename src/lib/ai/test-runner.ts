import type { TestRunEvent, ChatMessage } from '@/types/ai'
import type { TestSuite, TestCase, TestCaseResult, Prompt } from '@/types/database'
import { createAiProvider } from './provider'
import { getSettings } from '@/lib/db/repositories/settings'
import { updateTestRun } from '@/lib/db/repositories/test-runs'
import { updateTestSuite } from '@/lib/db/repositories/test-suites'
import { evaluateTestCase, evaluateOverall } from './test-evaluator'

/**
 * Parse multi-turn conversation input.
 * Detects "User: ... / Assistant: ..." pattern and returns turns.
 * Returns null if the input is not multi-turn format.
 */
function parseConversationTurns(
  input: string
): Array<{ role: 'user' | 'assistant'; content: string }> | null {
  const lines = input.split('\n')
  const turns: Array<{ role: 'user' | 'assistant'; content: string }> = []
  let currentRole: 'user' | 'assistant' | null = null
  let currentContent = ''

  for (const line of lines) {
    const userMatch = line.match(/^User:\s*(.*)/)
    const assistantMatch = line.match(/^Assistant:\s*(.*)/)

    if (userMatch) {
      if (currentRole) {
        turns.push({ role: currentRole, content: currentContent.trim() })
      }
      currentRole = 'user'
      currentContent = userMatch[1]
    } else if (assistantMatch) {
      if (currentRole) {
        turns.push({ role: currentRole, content: currentContent.trim() })
      }
      currentRole = 'assistant'
      currentContent = assistantMatch[1]
    } else if (currentRole) {
      currentContent += '\n' + line
    }
  }

  if (currentRole) {
    turns.push({ role: currentRole, content: currentContent.trim() })
  }

  // Must have at least 2 user turns to count as multi-turn
  const userTurns = turns.filter((t) => t.role === 'user')
  if (userTurns.length < 2) return null

  return turns
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
  prompt: Prompt
): AsyncGenerator<TestRunEvent> {
  // 1. Yield test-start
  yield { type: 'test-start', data: { totalCases: cases.length } }

  // 2. Validate suite config
  const { config } = suite
  if (!config.apiKey || !config.model) {
    const errorMsg = '测试集配置不完整：需要配置 API Key 和模型'
    yield { type: 'test-error', data: { error: errorMsg } }
    updateTestRun(runId, { status: 'failed' })
    updateTestSuite(suite.id, { status: 'ready' })
    return
  }

  // 3. Create test provider from suite config
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

  // 4. Execute each test case
  const caseResults: TestCaseResult[] = []

  for (let i = 0; i < cases.length; i++) {
    const testCase = cases[i]

    yield {
      type: 'test-case-start',
      data: { caseId: testCase.id, index: i, title: testCase.title },
    }

    let actualOutput = ''

    try {
      const systemMsg: ChatMessage = { role: 'system', content: prompt.content }
      const turns = parseConversationTurns(testCase.input)

      if (turns) {
        // --- Multi-turn execution: run each user turn sequentially ---
        const messages: ChatMessage[] = [systemMsg]
        if (testCase.context) {
          messages.push({ role: 'system', content: `Context: ${testCase.context}` })
        }

        const conversationParts: string[] = []

        for (const turn of turns) {
          if (turn.role === 'user') {
            messages.push({ role: 'user', content: turn.content })
            conversationParts.push(`User: ${turn.content}`)
          } else if (turn.role === 'assistant' && turn.content) {
            // Pre-filled assistant content — use as-is
            messages.push({ role: 'assistant', content: turn.content })
            conversationParts.push(`Assistant: ${turn.content}`)
          } else {
            // Empty assistant slot — generate response from LLM
            let response = ''
            const stream = testProvider.chatStream(messages, { temperature: 0.7 })
            for await (const chunk of stream) {
              response += chunk
            }
            messages.push({ role: 'assistant', content: response })
            conversationParts.push(`Assistant: ${response}`)
          }
        }

        actualOutput = conversationParts.join('\n')
      } else {
        // --- Single-turn execution (original behavior) ---
        const messages: ChatMessage[] = [systemMsg]

        let userContent = ''
        if (testCase.context) {
          userContent += `${testCase.context}\n\n`
        }
        userContent += testCase.input

        messages.push({ role: 'user', content: userContent })

        const stream = testProvider.chatStream(messages, { temperature: 0.7 })
        for await (const chunk of stream) {
          actualOutput += chunk
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      actualOutput = `[ERROR] ${message}`
    }

    caseResults.push({
      testCaseId: testCase.id,
      actualOutput,
      passed: false,
      score: 0,
      reason: '',
    })

    yield {
      type: 'test-case-done',
      data: { caseId: testCase.id, actualOutput },
    }
  }

  // 5. Start evaluation phase
  yield { type: 'eval-start' }

  // 6. Create eval provider from global settings
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
    // Evaluation provider creation failed — fill in defaults and finish
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

  // 7. Evaluate each test case result
  const evalResults: TestCaseResult[] = []

  for (let i = 0; i < caseResults.length; i++) {
    const caseResult = caseResults[i]
    const testCase = cases[i]

    try {
      const evalResult = await evaluateTestCase(evalProvider, {
        title: testCase.title,
        context: testCase.context,
        input: testCase.input,
        expectedOutput: testCase.expectedOutput,
        actualOutput: caseResult.actualOutput,
      })

      const evaluatedResult: TestCaseResult = {
        ...caseResult,
        passed: evalResult.passed,
        score: evalResult.score,
        reason: evalResult.reason,
      }
      evalResults.push(evaluatedResult)

      yield {
        type: 'eval-case-done',
        data: {
          caseId: testCase.id,
          passed: evalResult.passed,
          score: evalResult.score,
          reason: evalResult.reason,
        },
      }
    } catch {
      // Individual evaluation failed — store defaults
      const fallbackResult: TestCaseResult = {
        ...caseResult,
        passed: false,
        score: 0,
        reason: '单条评估失败',
      }
      evalResults.push(fallbackResult)

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

  // 8. Overall evaluation
  let report
  try {
    report = await evaluateOverall(evalProvider, prompt, cases, evalResults)
  } catch {
    // Overall evaluation failed — calculate fallback
    const totalCases = cases.length
    const passedCases = evalResults.filter((r) => r.passed).length
    const avgScore =
      evalResults.length > 0
        ? Math.round(evalResults.reduce((sum, r) => sum + r.score, 0) / evalResults.length)
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

  yield { type: 'eval-report', data: report }

  // 9. Update test run DB record
  updateTestRun(runId, {
    status: 'completed',
    results: evalResults,
    report,
    score: report.score,
  })

  // 10. Update suite status
  updateTestSuite(suite.id, { status: 'completed' })

  // 11. Yield test-complete
  yield { type: 'test-complete', data: { runId, score: report.score } }
}
