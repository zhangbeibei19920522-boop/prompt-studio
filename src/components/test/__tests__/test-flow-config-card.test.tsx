import React from "react"
import fs from "node:fs"
import path from "node:path"
import { renderToStaticMarkup } from "react-dom/server"

import { TestFlowConfigCard } from "@/components/test/test-flow-config-card"
import { TestRoutingConfigForm } from "@/components/test/test-routing-config-dialog"

describe("test flow config UI", () => {
  it("renders a productized routing summary card for multi-prompt tests", () => {
    const html = renderToStaticMarkup(
      <TestFlowConfigCard
        data={{
          mode: "routing",
          summary: "先用入口 Prompt 识别 intent，再根据 intent 命中子 Prompt 输出回复。",
        }}
        onOpenConfig={() => {}}
      />
    )

    expect(html).toContain("多 Prompt 业务流程")
    expect(html).toContain("先用入口 Prompt 识别 intent")
    expect(html).toContain("配置业务流程")
    expect(html).not.toContain("Execution Shape")
    expect(html).not.toContain("从“单 Prompt 测试”切到")
  })

  it("uses prompt dropdowns instead of free-text prompt fields in the routing dialog", () => {
    const html = renderToStaticMarkup(
      <TestRoutingConfigForm
        prompts={[
          { id: "prompt-a", title: "PromptA · 意图识别" },
          { id: "prompt-b", title: "PromptB · 售后回复" },
        ]}
        entryPromptId="prompt-a"
        routes={[{ intent: "after_sale", promptId: "prompt-b" }]}
        onEntryPromptChange={() => {}}
        onRouteChange={() => {}}
        onAddRoute={() => {}}
        onRemoveRoute={() => {}}
      />
    )

    expect(html).toContain("入口 Prompt")
    expect(html).toContain("intent 值")
    expect(html.match(/data-slot="select-trigger"/g)).toHaveLength(2)
    expect(html).not.toContain('placeholder="输入 Prompt ID"')
    expect(html).not.toContain('placeholder="输入 Prompt 名称"')
  })

  it("keeps route row keys independent from editable intent and prompt values", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "src/components/test/test-routing-config-dialog.tsx"),
      "utf8"
    )

    expect(source).toContain("key={route.id}")
    expect(source).not.toContain("key={`${index}-${route.intent}-${route.promptId}`}")
  })
})
