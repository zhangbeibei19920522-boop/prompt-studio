import type { AiProvider, ChatMessage } from '@/types/ai'
import type { TestCase, TestCaseResult, TestReport, Prompt } from '@/types/database'
import { isAbortError } from '@/lib/test-run-abort'

// ---------- Helper: fill template placeholders ----------

/**
 * Replace `{key}` placeholders in a template string with values from data.
 */
export function fillTemplate(
  template: string,
  data: Record<string, string>
): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => {
    return key in data ? data[key] : match
  })
}

// ---------- Helper: extract JSON from LLM response ----------

/**
 * Try to extract and parse JSON from an LLM response.
 * First looks for a ```json code block, then tries raw JSON.parse.
 */
export function extractJson<T>(text: string): T | null {
  // Try ```json ... ``` block first
  const codeBlockMatch = text.match(/```json\s*([\s\S]*?)```/)
  if (codeBlockMatch) {
    try {
      return JSON.parse(codeBlockMatch[1].trim()) as T
    } catch {
      // fall through
    }
  }

  // Try raw JSON.parse (find first { or [)
  const jsonStart = text.search(/[{[]/)
  if (jsonStart !== -1) {
    try {
      return JSON.parse(text.slice(jsonStart)) as T
    } catch {
      // fall through
    }
  }

  return null
}

// ---------- evaluateTestCase ----------

interface EvaluateTestCaseInput {
  title: string
  context: string
  input: string
  expectedOutput: string
  actualOutput: string
}

export interface SingleEvalResult {
  passed: boolean
  score: number
  reason: string
}

export function evaluateIntentMatch(
  expectedIntent: string | null | undefined,
  actualIntent: string | null | undefined
): SingleEvalResult {
  const normalizedExpected = expectedIntent?.trim() ?? ''
  const normalizedActual = actualIntent?.trim() ?? ''
  const expectedLines = normalizedExpected
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
  const actualLines = normalizedActual
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  if (!normalizedExpected) {
    return {
      passed: true,
      score: 100,
      reason: '未配置期望 intent，跳过路由评估',
    }
  }

  if (!normalizedActual) {
    return {
      passed: false,
      score: 0,
      reason: '入口 Prompt 未返回可识别的 intent',
    }
  }

  if (expectedLines.length === 1 && actualLines.length > 1) {
    return {
      passed: true,
      score: 100,
      reason: '多轮对话暂未配置逐轮期望 intent，跳过路由评估',
    }
  }

  if (expectedLines.length !== actualLines.length) {
    return {
      passed: false,
      score: 0,
      reason: `intent 轮次数量不匹配，期望 ${expectedLines.length} 轮，实际 ${actualLines.length} 轮`,
    }
  }

  const mismatchIndex = expectedLines.findIndex(
    (expected, index) => expected !== actualLines[index]
  )

  if (mismatchIndex === -1) {
    return {
      passed: true,
      score: 100,
      reason:
        actualLines.length > 1
          ? `intent 全部命中：${actualLines.join(' -> ')}`
          : `intent 命中：${normalizedActual}`,
    }
  }

  return {
    passed: false,
    score: 0,
    reason: `第 ${mismatchIndex + 1} 轮 intent 不匹配，期望 ${expectedLines[mismatchIndex]}，实际 ${actualLines[mismatchIndex]}`,
  }
}

/**
 * Use LLM to evaluate whether a single test case's actual output matches expectations.
 */
export async function evaluateTestCase(
  provider: AiProvider,
  data: EvaluateTestCaseInput,
  options: { signal?: AbortSignal } = {}
): Promise<SingleEvalResult> {
  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: `你是一个 Prompt 质量评估专家。请评估以下测试用例的实际输出是否符合预期。

评估标准：
1. 语义一致性：实际输出是否表达了与预期输出相同的核心含义
2. 完整性：实际输出是否涵盖了预期输出中的关键信息
3. 质量：实际输出的语言质量、逻辑性和可读性

请严格以 JSON 格式返回评估结果，不要包含其他内容：
\`\`\`json
{
  "passed": true或false,
  "score": 0到100的整数,
  "reason": "评估理由"
}
\`\`\`

评分参考：
- 90-100：完全符合或超出预期
- 70-89：基本符合，有少量偏差
- 50-69：部分符合，有明显不足
- 0-49：不符合预期`,
    },
    {
      role: 'user',
      content: `测试用例：${data.title}

${data.context ? `上下文：\n${data.context}\n\n` : ''}用户输入：
${data.input}

预期输出：
${data.expectedOutput}

实际输出：
${data.actualOutput}`,
    },
  ]

  try {
    const response = await provider.chat(messages, {
      temperature: 0.1,
      signal: options.signal,
    })
    const result = extractJson<SingleEvalResult>(response)

    if (result && typeof result.passed === 'boolean' && typeof result.score === 'number') {
      return {
        passed: result.passed,
        score: Math.max(0, Math.min(100, Math.round(result.score))),
        reason: result.reason || '',
      }
    }

    // Parse failed — return failure
    return { passed: false, score: 0, reason: '评估结果解析失败' }
  } catch (error) {
    if (isAbortError(error) || options.signal?.aborted) {
      throw error
    }
    const message = error instanceof Error ? error.message : String(error)
    return { passed: false, score: 0, reason: `评估调用失败: ${message}` }
  }
}

// ---------- evaluateOverall ----------

/**
 * Generate an overall test report based on all test case results.
 */
export async function evaluateOverall(
  provider: AiProvider,
  prompt: Prompt,
  cases: TestCase[],
  results: TestCaseResult[],
  options: { signal?: AbortSignal } = {}
): Promise<TestReport> {
  const caseSummaries = cases.map((c, i) => {
    const r = results.find((res) => res.testCaseId === c.id)
    return `${i + 1}. ${c.title}
   输入：${c.input}
   预期：${c.expectedOutput}
   实际：${r?.actualOutput ?? '(无)'}
   得分：${r?.score ?? 0}  通过：${r?.passed ? '是' : '否'}
   原因：${r?.reason ?? '(无)'}`
  })

  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: `你是一个 Prompt 质量评估专家。请根据以下测试结果，对 Prompt 进行整体评估并给出改进建议。

请严格以 JSON 格式返回评估报告，不要包含其他内容：
\`\`\`json
{
  "summary": "整体评估摘要",
  "totalCases": 总用例数,
  "passedCases": 通过的用例数,
  "score": 0到100的整体评分,
  "improvements": ["改进建议1", "改进建议2"],
  "details": "详细分析"
}
\`\`\``,
    },
    {
      role: 'user',
      content: `被测试的 Prompt：
标题：${prompt.title}
内容：
${prompt.content}

测试结果（共 ${cases.length} 条）：
${caseSummaries.join('\n\n')}`,
    },
  ]

  // Calculate fallback values in case LLM parsing fails
  const totalCases = cases.length
  const passedCases = results.filter((r) => r.passed).length
  const avgScore =
    results.length > 0
      ? Math.round(results.reduce((sum, r) => sum + r.score, 0) / results.length)
      : 0

  try {
    const response = await provider.chat(messages, {
      temperature: 0.3,
      signal: options.signal,
    })
    const report = extractJson<TestReport>(response)

    if (report && typeof report.summary === 'string') {
      return {
        summary: report.summary,
        totalCases: totalCases,
        passedCases: passedCases,
        score: avgScore,
        improvements: Array.isArray(report.improvements) ? report.improvements : [],
        details: report.details || '',
      }
    }

    // Parse failed — use calculated fallback
    return {
      summary: `共 ${totalCases} 个测试用例，通过 ${passedCases} 个，平均得分 ${avgScore}`,
      totalCases,
      passedCases,
      score: avgScore,
      improvements: [],
      details: '评估报告解析失败，以上为自动计算结果。',
    }
  } catch (error) {
    if (isAbortError(error) || options.signal?.aborted) {
      throw error
    }
    return {
      summary: `共 ${totalCases} 个测试用例，通过 ${passedCases} 个，平均得分 ${avgScore}`,
      totalCases,
      passedCases,
      score: avgScore,
      improvements: [],
      details: '整体评估调用失败，以上为自动计算结果。',
    }
  }
}
