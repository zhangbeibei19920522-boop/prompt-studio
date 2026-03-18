import React from "react"
import { renderToStaticMarkup } from "react-dom/server"

import { ConversationAuditDetail } from "@/components/audit/conversation-audit-detail"

describe("ConversationAuditDetail create mode", () => {
  it("renders prominent upload cards and only allows mixed Word/HTML/Excel knowledge files", () => {
    const html = renderToStaticMarkup(
      <ConversationAuditDetail
        projectId="project-1"
        data={null}
        createMode
        onCreated={() => {}}
        onRefresh={async () => {
          throw new Error("unused in create mode")
        }}
      />
    )

    expect(html).toContain("点击上传或拖拽文件到此处")
    expect(html).toContain("支持混合上传 Word、HTML、Excel")
    expect(html).toContain("仅支持 Excel，对话按 Conversation ID 解析")
    expect(html).toContain('accept=".doc,.docx,.html,.htm,.xls,.xlsx"')
    expect(html).toContain('accept=".xls,.xlsx"')
    expect(html).not.toContain(".csv")
    expect(html).not.toContain(".txt")
    expect(html).not.toContain(".md")
  })
})
