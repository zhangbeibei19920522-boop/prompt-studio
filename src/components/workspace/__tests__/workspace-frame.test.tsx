import React from "react"
import { renderToStaticMarkup } from "react-dom/server"

import { WorkspaceFrame } from "@/components/workspace/workspace-frame"

describe("WorkspaceFrame", () => {
  it("renders the prototype-style shell with top bar, sidebar, and persistent conversation area", () => {
    const html = renderToStaticMarkup(
      <WorkspaceFrame
        projectName="Prompt Studio"
        sessions={[
          { id: "s1", title: "路由策略整理", updatedLabel: "3 分钟前", active: true },
          { id: "s2", title: "退款测试集重跑", updatedLabel: "20 分钟前", active: false },
        ]}
        onSessionSelect={() => {}}
        onCreateSession={() => {}}
        onOpenCommandPalette={() => {}}
        onOpenKnowledgeDrawer={() => {}}
      >
        <div>workspace-body</div>
      </WorkspaceFrame>
    )

    expect(html).toContain("搜索 Prompt、测试、文档...")
    expect(html).toContain("对话")
    expect(html).toContain("路由策略整理")
    expect(html).toContain("退款测试集重跑")
    expect(html).toContain("workspace-body")
  })
})
