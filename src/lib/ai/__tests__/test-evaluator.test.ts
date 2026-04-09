import { evaluateOverall } from "@/lib/ai/test-evaluator"

describe("evaluateOverall", () => {
  it("uses case statistics for overall score even when the evaluator returns a lower score", async () => {
    const provider = {
      chat: vi.fn(async () => `\`\`\`json
{
  "summary": "整体说明",
  "totalCases": 999,
  "passedCases": 1,
  "score": 62,
  "improvements": ["改进建议"],
  "details": "详细分析"
}
\`\`\``),
      chatStream: vi.fn(),
    }

    const prompt = {
      id: "prompt-1",
      projectId: "project-1",
      title: "Router Prompt",
      content: "只输出节点名",
      description: "",
      tags: [],
      variables: [],
      version: 1,
      status: "active" as const,
      createdAt: "2026-04-09T00:00:00.000Z",
      updatedAt: "2026-04-09T00:00:00.000Z",
    }

    const cases = [
      {
        id: "case-1",
        testSuiteId: "suite-1",
        title: "Case 1",
        context: "",
        input: "input-1",
        expectedOutput: "expected-1",
        expectedIntent: null,
        sortOrder: 0,
      },
      {
        id: "case-2",
        testSuiteId: "suite-1",
        title: "Case 2",
        context: "",
        input: "input-2",
        expectedOutput: "expected-2",
        expectedIntent: null,
        sortOrder: 1,
      },
    ]

    const results = [
      {
        testCaseId: "case-1",
        actualOutput: "actual-1",
        passed: true,
        score: 98,
        reason: "good",
      },
      {
        testCaseId: "case-2",
        actualOutput: "actual-2",
        passed: false,
        score: 90,
        reason: "still decent but failed",
      },
    ]

    const report = await evaluateOverall(provider, prompt, cases, results)

    expect(report).toMatchObject({
      summary: "整体说明",
      totalCases: 2,
      passedCases: 1,
      score: 94,
      improvements: ["改进建议"],
      details: "详细分析",
    })
  })
})
