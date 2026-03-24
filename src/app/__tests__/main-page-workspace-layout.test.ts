import fs from "node:fs"
import path from "node:path"

describe("main page workspace layout", () => {
  it("uses the conversational workspace shell instead of the legacy three-panel layout", () => {
    const pagePath = path.join(process.cwd(), "src", "app", "(main)", "page.tsx")
    const source = fs.readFileSync(pagePath, "utf8")

    expect(source).toContain("WorkspaceFrame")
    expect(source).toContain("WorkspaceCommandPalette")
    expect(source).toContain("WorkspaceCanvas")
    expect(source).not.toContain("sideContent={renderSideContent()}")

    expect(source).not.toContain('import { TopBar }')
    expect(source).not.toContain('import { Sidebar }')
    expect(source).not.toContain('import { RightPanel }')
  })

  it("models the right canvas after the prototype with list/detail states and expanded behavior", () => {
    const pagePath = path.join(process.cwd(), "src", "app", "(main)", "page.tsx")
    const source = fs.readFileSync(pagePath, "utf8")

    expect(source).toContain("testCanvasView")
    expect(source).toContain("auditCanvasView")
    expect(source).toContain("renderTestCanvasList")
    expect(source).toContain("renderAuditCanvasList")
    expect(source).toContain("renderAuditCanvasDetail")
    expect(source).toContain("canvasExpanded")
    expect(source).toContain("marginRight")
    expect(source).toContain("hidden-by-canvas")
    expect(source).not.toContain('expanded={activeCanvasTab === "test" || activeCanvasTab === "audit"}')
  })

  it("keeps prototype-style canvas shells for library, metrics, knowledge upload, and settings", () => {
    const pagePath = path.join(process.cwd(), "src", "app", "(main)", "page.tsx")
    const source = fs.readFileSync(pagePath, "utf8")

    expect(source).toContain("libraryQuery")
    expect(source).toContain("libraryFilter")
    expect(source).toContain("CanvasMetricCard")
    expect(source).toContain("CanvasListCard")
    expect(source).toContain("拖拽文件到此处，或点击上传")
    expect(source).toContain("AI 模型配置")
    expect(source).toContain("全部")
    expect(source).toContain("已发布")
    expect(source).toContain("草稿")
  })
})
