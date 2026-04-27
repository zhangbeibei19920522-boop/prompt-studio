import React from "react"
import fs from "node:fs"
import path from "node:path"
import { renderToStaticMarkup } from "react-dom/server"

import { TestRoutingConfigForm } from "@/components/test/test-routing-config-dialog"

describe("TestRoutingConfigForm", () => {
  const prompts = [
    { id: "prompt-a", title: "入口 Prompt", content: "入口 Prompt 内容" },
    { id: "prompt-b", title: "售后 Prompt", content: "售后 Prompt 内容\n{rag_qas_text}" },
    { id: "prompt-invalid-rag", title: "无占位符 Prompt", content: "这里只有普通说明" },
  ]

  const indexVersions = [
    { id: "kb-index-2024-04-20", title: "kb-index-2024-04-20" },
  ]

  it("renders route target type and index version options", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "src/components/test/test-routing-config-dialog.tsx"),
      "utf8"
    )
    const html = renderToStaticMarkup(
      <TestRoutingConfigForm
        prompts={prompts}
        indexVersions={indexVersions}
        entryPromptId="prompt-a"
        routes={[
          {
            intent: "faq_search",
            targetType: "index-version",
            targetId: "kb-index-2024-04-20",
          },
        ]}
        onEntryPromptChange={() => {}}
        onRouteChange={() => {}}
        onAddRoute={() => {}}
        onRemoveRoute={() => {}}
      />
    )

    expect(html).toContain("目标类型")
    expect(html).toContain("目标内容")
    expect(html).toContain("索引版本")
    expect(source).toContain('placeholder="选择索引版本"')
    expect(source).toContain("indexVersions.map((indexVersion)")
  })

  it("renders dedicated rag prompt and index selectors for R routes", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "src/components/test/test-routing-config-dialog.tsx"),
      "utf8"
    )
    const html = renderToStaticMarkup(
      <TestRoutingConfigForm
        prompts={prompts}
        indexVersions={indexVersions}
        entryPromptId="prompt-a"
        routes={[
          {
            intent: "R",
            promptId: "",
            targetType: "prompt",
            targetId: "",
            ragPromptId: "prompt-b",
            ragIndexVersionId: "kb-index-2024-04-20",
          },
        ]}
        onEntryPromptChange={() => {}}
        onRouteChange={() => {}}
        onAddRoute={() => {}}
        onRemoveRoute={() => {}}
      />
    )

    expect(html).toContain("RAG Prompt")
    expect(html).toContain("索引版本")
    expect(source).toContain('route.intent.trim() === "R"')
    expect(source).toContain("ragPromptId")
    expect(source).toContain("ragIndexVersionId")
  })

  it("disables save when an R route selects a prompt without rag_qas_text placeholder", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "src/components/test/test-routing-config-dialog.tsx"),
      "utf8"
    )
    const html = renderToStaticMarkup(
      <TestRoutingConfigForm
        prompts={prompts}
        indexVersions={indexVersions}
        entryPromptId="prompt-a"
        routes={[
          {
            intent: "R",
            promptId: "",
            targetType: "prompt",
            targetId: "",
            ragPromptId: "prompt-invalid-rag",
            ragIndexVersionId: "kb-index-2024-04-20",
          },
        ]}
        onEntryPromptChange={() => {}}
        onRouteChange={() => {}}
        onAddRoute={() => {}}
        onRemoveRoute={() => {}}
      />
    )

    expect(html).toContain("RAG Prompt 必须包含 {rag_qas_text}")
    expect(source).toContain("!getRagRouteValidationError(normalizedRoute, prompts)")
  })
})
