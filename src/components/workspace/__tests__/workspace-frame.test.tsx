import React from "react"
import { renderToStaticMarkup } from "react-dom/server"

import { WorkspaceFrame } from "@/components/workspace/workspace-frame"

describe("WorkspaceFrame", () => {
  it("renders a function-first shell with module navigation and an Agent drawer trigger", () => {
    const html = renderToStaticMarkup(
      <WorkspaceFrame
        projectName="Prompt Studio"
        modules={[
          { id: "prompt", label: "Prompt", description: "当前 Prompt 编辑", active: false },
          { id: "knowledge", label: "知识库", description: "文档、清洗与索引", active: true },
        ]}
        onModuleSelect={() => {}}
        onOpenCommandPalette={() => {}}
        onOpenChatDrawer={() => {}}
      >
        <div>workspace-body</div>
      </WorkspaceFrame>
    )

    expect(html).toContain("搜索 Prompt、测试、文档...")
    expect(html).toContain("功能")
    expect(html).not.toContain("工作台首页")
    expect(html).toContain("Prompt")
    expect(html).toContain("知识库")
    expect(html).toContain("Agent 对话")
    expect(html).toContain("workspace-body")
  })
})
