import React from "react"
import fs from "node:fs"
import path from "node:path"
import { renderToStaticMarkup } from "react-dom/server"

import { TestRoutingConfigForm } from "@/components/test/test-routing-config-dialog"

describe("TestRoutingConfigForm", () => {
  const prompts = [
    { id: "prompt-a", title: "入口 Prompt" },
    { id: "prompt-b", title: "售后 Prompt" },
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
})
