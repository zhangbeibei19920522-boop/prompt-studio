import React from "react"
import { renderToStaticMarkup } from "react-dom/server"

import { WorkspaceChatDrawer } from "@/components/workspace/workspace-chat-drawer"

describe("WorkspaceChatDrawer", () => {
  it("renders conversation history inside the drawer next to chat content", () => {
    const html = renderToStaticMarkup(
      <WorkspaceChatDrawer
        open
        sessions={[
          { id: "s1", title: "路由策略整理", updatedLabel: "3 分钟前", active: true },
          { id: "s2", title: "退款测试集重跑", updatedLabel: "20 分钟前", active: false },
        ]}
        onClose={() => {}}
        onCreateSession={() => {}}
        onSessionSelect={() => {}}
      >
        <div>chat-body</div>
      </WorkspaceChatDrawer>
    )

    expect(html).toContain("Agent 对话")
    expect(html).toContain("路由策略整理")
    expect(html).toContain("退款测试集重跑")
    expect(html).toContain("chat-body")
  })
})
