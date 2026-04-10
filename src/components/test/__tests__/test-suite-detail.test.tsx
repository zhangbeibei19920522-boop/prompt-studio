import React from "react"
import fs from "node:fs"
import path from "node:path"
import { renderToStaticMarkup } from "react-dom/server"

import { TestSuiteDetail } from "@/components/test/test-suite-detail"
import { TestRoutingResultDetails } from "@/components/test/test-routing-result-details"

describe("routing test result details", () => {
  it("renders only reply evaluation without routing metadata blocks", () => {
    const html = renderToStaticMarkup(
      <TestRoutingResultDetails
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

    expect(html).toContain("回复评估")
    expect(html).toContain("回复完整且符合预期")
    expect(html).not.toContain("期望 intent")
    expect(html).not.toContain("实际 intent")
    expect(html).not.toContain("命中 Prompt")
    expect(html).not.toContain("路由评估")
    expect(html).not.toContain("逐轮路由结果")
  })

  it("does not render per-turn routing metadata blocks for multi-turn routing cases", () => {
    const html = renderToStaticMarkup(
      <TestRoutingResultDetails
        testCase={{
          id: "case-1",
          testSuiteId: "suite-1",
          title: "Refund route",
          context: "",
          input: "User: 我要退款\nAssistant:\nUser: 退款多久能到账？\nAssistant:",
          expectedIntent: "refund",
          expectedOutput: "完整多轮回复",
          sortOrder: 0,
        }}
        result={{
          testCaseId: "case-1",
          actualOutput:
            "User: 我要退款\nAssistant: 请提供订单号，我来帮您申请退款。\nUser: 退款多久能到账？\nAssistant: 退款审核通过后，通常 1 到 3 个工作日到账。",
          actualIntent: "refund\nrefund_progress",
          matchedPromptId: "prompt-b\nprompt-c",
          matchedPromptTitle: "Refund Reply\nRefund Progress Reply",
          routingSteps: [
            {
              turnIndex: 0,
              userInput: "我要退款",
              actualIntent: "refund",
              matchedPromptId: "prompt-b",
              matchedPromptTitle: "Refund Reply",
              actualReply: "请提供订单号，我来帮您申请退款。",
            },
            {
              turnIndex: 1,
              userInput: "退款多久能到账？",
              actualIntent: "refund_progress",
              matchedPromptId: "prompt-c",
              matchedPromptTitle: "Refund Progress Reply",
              actualReply: "退款审核通过后，通常 1 到 3 个工作日到账。",
            },
          ],
          intentPassed: true,
          intentScore: 100,
          intentReason: "多轮对话暂未配置逐轮期望 intent，跳过路由评估",
          replyPassed: true,
          replyScore: 90,
          replyReason: "多轮回复符合预期",
          passed: true,
          score: 95,
          reason: "路由评估：跳过；回复评估：多轮回复符合预期",
        }}
      />
    )

    expect(html).toContain("回复评估")
    expect(html).toContain("多轮回复符合预期")
    expect(html).not.toContain("逐轮路由结果")
    expect(html).not.toContain("第 1 轮")
    expect(html).not.toContain("第 2 轮")
    expect(html).not.toContain("Refund Progress Reply")
  })

  it("shows raw router output when routing fails before a valid intent is parsed", () => {
    const html = renderToStaticMarkup(
      <TestRoutingResultDetails
        testCase={{
          id: "case-1",
          testSuiteId: "suite-1",
          title: "Invalid router prose",
          context: "",
          input: "营业时间呢？",
          expectedIntent: "store_hours",
          expectedOutput: "请先确认所在城市。",
          sortOrder: 0,
        }}
        result={{
          testCaseId: "case-1",
          actualOutput: "",
          actualIntent: null,
          routingSteps: [
            {
              turnIndex: 0,
              userInput: "营业时间呢？",
              rawIntent: null,
              rawIntentOutput: "我不确定，可能要先去查门店信息。",
              actualIntent: null,
              matchedPromptId: null,
              matchedPromptTitle: null,
              actualReply: "",
              routingError: "入口 Prompt 未返回有效的 intent",
            },
          ],
          intentPassed: false,
          intentScore: 0,
          intentReason: "入口 Prompt 未返回可识别的 intent",
          replyPassed: false,
          replyScore: 0,
          replyReason: "路由未命中目标 Prompt，无法生成最终回复",
          passed: false,
          score: 0,
          reason: "路由评估：入口 Prompt 未返回可识别的 intent\n回复评估：路由未命中目标 Prompt，无法生成最终回复",
        }}
      />
    )

    expect(html).toContain("入口 Prompt 原始输出")
    expect(html).toContain("我不确定，可能要先去查门店信息。")
    expect(html).toContain("回复评估")
  })

  it("renders all raw router outputs for multi-turn routing failures", () => {
    const html = renderToStaticMarkup(
      <TestRoutingResultDetails
        testCase={{
          id: "case-1",
          testSuiteId: "suite-1",
          title: "Multi-turn invalid router prose",
          context: "",
          input: "User: 门店几点关门？\nAssistant:\nUser: 那周末开吗？\nAssistant:",
          expectedIntent: "store_hours",
          expectedOutput: "完整多轮回复",
          sortOrder: 0,
        }}
        result={{
          testCaseId: "case-1",
          actualOutput: "",
          actualIntent: null,
          routingSteps: [
            {
              turnIndex: 0,
              userInput: "门店几点关门？",
              rawIntent: null,
              rawIntentOutput: "先确认您所在城市。",
              actualIntent: null,
              matchedPromptId: null,
              matchedPromptTitle: null,
              actualReply: "",
              routingError: "入口 Prompt 未返回有效的 intent",
            },
            {
              turnIndex: 1,
              userInput: "那周末开吗？",
              rawIntent: null,
              rawIntentOutput: "建议到官网服务中心页面查询最近门店。",
              actualIntent: null,
              matchedPromptId: null,
              matchedPromptTitle: null,
              actualReply: "",
              routingError: "入口 Prompt 未返回有效的 intent",
            },
          ],
          intentPassed: false,
          intentScore: 0,
          intentReason: "入口 Prompt 未返回可识别的 intent",
          replyPassed: false,
          replyScore: 0,
          replyReason: "路由未命中目标 Prompt，无法生成最终回复",
          passed: false,
          score: 0,
          reason: "路由评估失败",
        }}
      />
    )

    expect(html).toContain("第 1 轮")
    expect(html).toContain("门店几点关门？")
    expect(html).toContain("先确认您所在城市。")
    expect(html).toContain("第 2 轮")
    expect(html).toContain("那周末开吗？")
    expect(html).toContain("建议到官网服务中心页面查询最近门店。")
  })

  it("renders routing diagnostics in suite detail even when actual output is empty", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "src/components/test/test-suite-detail.tsx"),
      "utf8"
    )

    expect(source).toContain("const hasRoutingDiagnostics =")
    expect(source).toContain("result && (hasConversationOutput || hasRoutingDiagnostics)")
    expect(source).toContain("hasConversationOutput && (")
    expect(source).toContain("<TestRoutingResultDetails testCase={tc} result={result} />")
  })

  it("renders expected output diagnostics when the latest regeneration failed", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "src/components/test/test-suite-detail.tsx"),
      "utf8"
    )

    expect(source).toContain("tc.expectedOutputDiagnostics?.length")
    expect(source).toContain("预期结果生成诊断")
    expect(source).toContain("tc.expectedOutputDiagnostics")
  })

  it("shows the 路由配置 header action only for routing suites", () => {
    const baseSuite = {
      id: "suite-1",
      projectId: "project-1",
      sessionId: null,
      name: "Suite",
      description: "",
      promptId: "prompt-a",
      promptVersionId: null,
      config: {
        provider: "openai",
        model: "gpt-4.1",
        apiKey: "sk-test",
        baseUrl: "",
      },
      status: "ready" as const,
      createdAt: "2026-03-20T00:00:00.000Z",
      updatedAt: "2026-03-20T00:00:00.000Z",
    }

    const routingHtml = renderToStaticMarkup(
      <TestSuiteDetail
        suite={{
          ...baseSuite,
          workflowMode: "routing",
          routingConfig: {
            entryPromptId: "prompt-a",
            routes: [{ intent: "refund", promptId: "prompt-b" }],
          },
        }}
        cases={[]}
        latestRun={null}
        prompts={[
          { id: "prompt-a", title: "PromptA" },
          { id: "prompt-b", title: "PromptB" },
        ]}
        onSuiteUpdate={() => {}}
        onCaseUpdate={() => {}}
      />
    )

    const singleHtml = renderToStaticMarkup(
      <TestSuiteDetail
        suite={{
          ...baseSuite,
          workflowMode: "single",
          routingConfig: null,
        }}
        cases={[]}
        latestRun={null}
        prompts={[{ id: "prompt-a", title: "PromptA" }]}
        onSuiteUpdate={() => {}}
        onCaseUpdate={() => {}}
      />
    )

    expect(routingHtml).toContain("路由配置")
    expect(singleHtml).not.toContain("路由配置")
  })

  it("persists edited routing config back onto the test suite for later runs", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "src/components/test/test-suite-detail.tsx"),
      "utf8"
    )

    expect(source).toContain("async function handleRoutingConfigSave")
    expect(source).toContain('workflowMode: "routing"')
    expect(source).toContain("routingConfig")
    expect(source).toContain("<TestRoutingConfigDialog")
    expect(source).toContain("onSave={handleRoutingConfigSave}")
  })

  it("does not render the aggregate evaluation reason block in the current result view", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "src/components/test/test-suite-detail.tsx"),
      "utf8"
    )

    expect(source).not.toContain("评估原因")
  })

  it("uses a side-by-side conversation layout for expected output and transcript", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "src/components/test/test-suite-detail.tsx"),
      "utf8"
    )

    expect(source).toContain("md:grid-cols-2")
    expect(source).toContain("预期输出")
    expect(source).toContain("对话记录")
    expect(source).toContain("parseExpectedConversationOutput")
  })

  it("includes a header action to regenerate expected outputs for the suite", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "src/components/test/test-suite-detail.tsx"),
      "utf8"
    )

    expect(source).toContain("重生成预期结果")
    expect(source).toContain("handleRegenerateExpectedOutputs")
    expect(source).toContain("testSuitesApi.regenerateExpectedOutputs")
  })

  it("shows both PDF and HTML export actions for test reports", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "src/components/test/test-suite-detail.tsx"),
      "utf8"
    )

    expect(source).toContain("导出 PDF")
    expect(source).toContain("导出 HTML")
  })

  it("keeps prototype-style metrics, history count, and trend shell in suite detail", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "src/components/test/test-suite-detail.tsx"),
      "utf8"
    )

    expect(source).toContain("historyCount")
    expect(source).toContain("历史记录 (")
    expect(source).toContain("总评分")
    expect(source).toContain("意图匹配")
    expect(source).toContain("趋势")
    expect(source).toContain("rounded-lg border border-zinc-200 bg-white")
  })
})
