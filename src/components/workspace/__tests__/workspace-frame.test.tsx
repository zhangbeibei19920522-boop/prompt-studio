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
          {
            id: "test",
            label: "自动化测试",
            description: "测试集和运行报告",
            active: true,
            children: [
              { id: "full-flow", label: "全流程测试", active: true },
              { id: "unit", label: "单元测试", active: false },
            ],
          },
          {
            id: "knowledge",
            label: "知识库",
            description: "文档、版本和任务",
            active: true,
            children: [
              { id: "documents", label: "文档库", active: true },
              { id: "tasks", label: "清洗任务", active: false },
              { id: "versions", label: "版本管理", active: false },
            ],
          },
        ]}
        onModuleSelect={() => {}}
        onModuleChildSelect={() => {}}
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
    expect(html).toContain("自动化测试")
    expect(html).toContain("全流程测试")
    expect(html).toContain("单元测试")
    expect(html).toContain("知识库")
    expect(html).toContain("文档库")
    expect(html).toContain("版本管理")
    expect(html).toContain("清洗任务")
    expect(html.indexOf("全流程测试")).toBeLessThan(html.indexOf("单元测试"))
    expect(html.indexOf("文档库")).toBeLessThan(html.indexOf("清洗任务"))
    expect(html.indexOf("清洗任务")).toBeLessThan(html.indexOf("版本管理"))
    expect(html).toContain("Agent 对话")
    expect(html).toContain("workspace-body")
  })
})
