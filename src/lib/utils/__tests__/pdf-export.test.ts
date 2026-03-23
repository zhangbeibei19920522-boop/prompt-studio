import { buildCaseRowHtml } from "@/lib/utils/pdf-export"

describe("pdf export routing detail", () => {
  it("includes routing metadata for routing suites in exported case rows", () => {
    const html = buildCaseRowHtml(
      0,
      {
        id: "case-1",
        testSuiteId: "suite-1",
        title: "Refund route",
        context: "",
        input: "我要退款",
        expectedIntent: "refund",
        expectedOutput: "请提供订单号，我们为您处理退款。",
        sortOrder: 0,
      },
      {
        testCaseId: "case-1",
        actualOutput: "请提供订单号，我们为您处理退款。",
        actualIntent: "refund",
        matchedPromptId: "prompt-b",
        matchedPromptTitle: "Refund Reply",
        intentPassed: true,
        intentScore: 100,
        intentReason: "intent 命中：refund",
        replyPassed: true,
        replyScore: 92,
        replyReason: "回复完整且符合预期",
        passed: true,
        score: 96,
        reason: "路由评估：intent 命中；回复评估：回复完整且符合预期",
      }
    )

    expect(html).toContain("期望 intent")
    expect(html).toContain("实际 intent")
    expect(html).toContain("命中 Prompt")
    expect(html).toContain("Refund Reply")
    expect(html).toContain("路由评估")
    expect(html).toContain("回复评估")
  })
})
