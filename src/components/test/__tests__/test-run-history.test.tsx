import React from "react"
import { renderToStaticMarkup } from "react-dom/server"

import { TestRunCaseResultCard } from "@/components/test/test-run-history"

describe("test run history routing detail", () => {
  it("renders assistant replies with prominent intent badges and hides routing metadata blocks", () => {
    const html = renderToStaticMarkup(
      <TestRunCaseResultCard
        index={0}
        testCase={{
          id: "case-1",
          testSuiteId: "suite-1",
          title: "Refund route",
          context: "",
          input: "我要退款",
          expectedIntent: "refund",
          expectedOutput: "请提供订单号，我们为您处理退款。",
          sortOrder: 0,
        }}
        result={{
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
        }}
      />
    )

    expect(html).toContain('data-slot="badge"')
    expect(html).toContain(">refund<")
    expect(html).toContain("请提供订单号，我们为您处理退款。")
    expect(html).not.toContain("（refund）")
    expect(html).toContain("回复评估")
    expect(html).not.toContain("期望 intent")
    expect(html).not.toContain("实际 intent")
    expect(html).not.toContain("命中 Prompt")
    expect(html).not.toContain("评估理由")
    expect(html).not.toContain("路由评估：intent 命中；回复评估：回复完整且符合预期")
  })

  it("renders expected output as a conversation in a side-by-side layout", () => {
    const html = renderToStaticMarkup(
      <TestRunCaseResultCard
        index={0}
        testCase={{
          id: "case-2",
          testSuiteId: "suite-1",
          title: "Repair route",
          context: "",
          input: "我想寄修一下手机。",
          expectedIntent: "repair",
          expectedOutput: "User: 我想寄修一下手机。\nAssistant: P-JX\n好的，请问您的手机是哪一款？比如 Find X8 Pro。",
          sortOrder: 1,
        }}
        result={{
          testCaseId: "case-2",
          actualOutput: "User: 我想寄修一下手机。\nAssistant: 好的，请问您的手机是哪一款？比如 Find X8 Pro。",
          actualIntent: "repair",
          replyPassed: true,
          replyScore: 95,
          replyReason: "回复符合预期",
          passed: true,
          score: 95,
          reason: "回复符合预期",
        }}
      />
    )

    expect(html).toContain("预期输出")
    expect(html).toContain("对话记录")
    expect(html).toContain("md:grid-cols-2")
    expect(html).toContain("我想寄修一下手机。")
    expect(html).toContain("好的，请问您的手机是哪一款？比如 Find X8 Pro。")
    expect(html).toContain(">P-JX<")
  })
})
