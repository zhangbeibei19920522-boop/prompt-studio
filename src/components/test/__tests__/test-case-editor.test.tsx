import React from "react"
import { renderToStaticMarkup } from "react-dom/server"

import { TestCaseEditor } from "@/components/test/test-case-editor"

describe("test case editor", () => {
  it("shows expected intent field only for routing suites", () => {
    const routingHtml = renderToStaticMarkup(
      <TestCaseEditor
        showExpectedIntent
        initialData={{
          title: "Refund case",
          context: "",
          input: "我要退款",
          expectedIntent: "refund",
          expectedOutput: "请提供订单号，我们为您处理退款。",
        }}
        onSave={() => {}}
        onCancel={() => {}}
      />
    )

    const singleHtml = renderToStaticMarkup(
      <TestCaseEditor
        initialData={{
          title: "Single case",
          context: "",
          input: "你好",
          expectedOutput: "正常回复",
        }}
        onSave={() => {}}
        onCancel={() => {}}
      />
    )

    expect(routingHtml).toContain("期望 intent")
    expect(routingHtml).toContain("例如 after_sale")
    expect(routingHtml).toContain('value="refund"')
    expect(singleHtml).not.toContain("期望 intent")
  })
})
