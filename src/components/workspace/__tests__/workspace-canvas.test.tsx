import fs from "node:fs"
import path from "node:path"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"

import { WorkspaceCanvas } from "@/components/workspace/workspace-canvas"

describe("WorkspaceCanvas", () => {
  it("keeps canvas tabs in a single horizontal row instead of wrapping vertically", () => {
    const html = renderToStaticMarkup(
      <WorkspaceCanvas
        open
        activeTab="prompt"
        tabs={[
          { id: "prompt", label: "Prompt" },
          { id: "library", label: "Prompt 库" },
          { id: "test", label: "测试" },
          { id: "audit", label: "质检" },
          { id: "knowledge", label: "知识库" },
          { id: "settings", label: "设置" },
        ]}
        onTabChange={() => {}}
        onClose={() => {}}
      >
        <div>canvas-body</div>
      </WorkspaceCanvas>
    )

    expect(html).toContain("overflow-x-auto")
    expect(html).toContain("whitespace-nowrap")
    expect(html).toContain("shrink-0")
  })

  it("uses a wider default drawer width so the full top tab row fits without scrolling", () => {
    const canvasSource = fs.readFileSync(
      path.join(process.cwd(), "src/components/workspace/workspace-canvas.tsx"),
      "utf8"
    )
    const pageSource = fs.readFileSync(
      path.join(process.cwd(), "src/app/(main)/page.tsx"),
      "utf8"
    )

    expect(canvasSource).toContain("DEFAULT_WORKSPACE_CANVAS_WIDTH = 640")
    expect(pageSource).toContain("DEFAULT_WORKSPACE_CANVAS_WIDTH")
  })
})
