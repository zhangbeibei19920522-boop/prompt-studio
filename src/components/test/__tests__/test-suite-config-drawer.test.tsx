import React from "react"
import fs from "node:fs"
import path from "node:path"
import { renderToStaticMarkup } from "react-dom/server"

import { TestSuiteConfigDrawer } from "@/components/test/test-suite-config-drawer"

describe("TestSuiteConfigDrawer", () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), "src/components/test/test-suite-config-drawer.tsx"),
    "utf8"
  )
  const prompts = [
    { id: "prompt-a", title: "入口 Prompt" },
    { id: "prompt-b", title: "售后 Prompt" },
  ]

  const documents = [
    { id: "doc-1", name: "售后知识库.pdf" },
    { id: "doc-2", name: "退款政策.docx" },
  ]

  const indexVersions = [
    { id: "kb-index-2024-04-20", title: "kb-index-2024-04-20" },
    { id: "kb-index-2024-04-18", title: "kb-index-2024-04-18" },
  ]

  it("renders the full-flow test drawer fields", () => {
    const html = renderToStaticMarkup(
      <TestSuiteConfigDrawer
        open
        section="full-flow"
        prompts={prompts}
        documents={documents}
        indexVersions={indexVersions}
        onClose={() => {}}
        onSubmit={() => {}}
      />
    )

    expect(html).toContain("新建全流程测试集")
    expect(html).toContain("多 Prompt 业务流程")
    expect(html).toContain("测试用例数量")
    expect(html).toContain("测试用例形式")
    expect(html).toContain("测试用例生成来源")
    expect(html).toContain("选择来源")
    expect(html).not.toContain("测试结构")
    expect(html).not.toContain("选择需要测试的 Prompt")
    expect(source).toContain("generationSourceIds")
    expect(source).toContain("全选当前结果")
    expect(source).toContain("支持混选 Prompt 和文档库内容")
  })

  it("renders the unit test drawer fields", () => {
    const html = renderToStaticMarkup(
      <TestSuiteConfigDrawer
        open
        section="unit"
        prompts={prompts}
        documents={documents}
        indexVersions={indexVersions}
        onClose={() => {}}
        onSubmit={() => {}}
      />
    )

    expect(html).toContain("新建单元测试集")
    expect(html).toContain("测试目标")
    expect(html).toContain("测试内容")
    expect(html).toContain("测试用例数量")
    expect(html).toContain("测试用例形式")
    expect(html).toContain("测试用例生成来源")
    expect(html).toContain("选择来源")
    expect(source).toContain("Prompt")
    expect(source).toContain("索引版本")
    expect(source).toContain("搜索 Prompt 或文档")
  })

  it("reuses the existing routing config form for multi-prompt configuration", () => {
    expect(source).toContain("TestRoutingConfigForm")
    expect(source).toContain("onGenerateRoutes")
    expect(source).toContain("findUniquePromptMatch")
    expect(source).toContain("对话轮次区间")
  })
})
