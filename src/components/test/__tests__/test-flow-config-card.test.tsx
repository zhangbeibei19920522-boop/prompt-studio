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

  it("uses an entry prompt dropdown plus a searchable picker for target prompts", () => {
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
    const source = fs.readFileSync(
      path.join(process.cwd(), "src/components/test/test-routing-config-dialog.tsx"),
      "utf8"
    )

    expect(html).toContain("入口 Prompt")
    expect(html).toContain("intent 值")
    expect(html.match(/data-slot="select-trigger"/g)).toHaveLength(1)
    expect(html).not.toContain('placeholder="输入 Prompt ID"')
    expect(html).not.toContain('placeholder="输入 Prompt 名称"')
    expect(source).toContain("PromptCombobox")
    expect(source).toContain('CommandInput placeholder="搜索 Prompt..."')
    expect(source).toContain("PopoverTrigger asChild")
  })

  it("renders a fast bulk-generation action and keeps it disabled until entry prompt is selected", () => {
    const html = renderToStaticMarkup(
      <TestRoutingConfigForm
        prompts={[
          { id: "prompt-a", title: "PromptA · 意图识别" },
          { id: "prompt-b", title: "after_sale" },
        ]}
        entryPromptId=""
        routes={[{ intent: "", promptId: "" }]}
        onEntryPromptChange={() => {}}
        onRouteChange={() => {}}
        onAddRoute={() => {}}
        onRemoveRoute={() => {}}
      />
    )

    expect(html).toContain("从 Prompts 生成路由")
    expect(html).toContain("disabled")
  })

  it("keeps the routing dialog footer outside the scrolling form body", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "src/components/test/test-routing-config-dialog.tsx"),
      "utf8"
    )

    expect(source).toContain("sm:max-h-[85vh]")
    expect(source).toContain("overflow-hidden")
    expect(source).toContain("min-h-0 flex-1 overflow-y-auto")
    expect(source).toContain("border-t px-6 py-4")
  })

  it("wires intent input changes through the unique prompt auto-match helper", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "src/components/test/test-routing-config-dialog.tsx"),
      "utf8"
    )

    expect(source).toContain("handleRouteIntentChange")
    expect(source).toContain("findUniquePromptMatch")
    expect(source).toContain("onRouteIntentChange(index, event.target.value)")
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
