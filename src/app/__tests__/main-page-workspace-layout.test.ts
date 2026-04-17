import fs from "node:fs"
import path from "node:path"

describe("main page workspace layout", () => {
  it("uses a function-first workspace shell with chat as a drawer", () => {
    const pagePath = path.join(process.cwd(), "src", "app", "(main)", "page.tsx")
    const source = fs.readFileSync(pagePath, "utf8")

    expect(source).toContain("WorkspaceFrame")
    expect(source).toContain("WorkspaceChatDrawer")
    expect(source).toContain("WorkspaceCommandPalette")
    expect(source).toContain("workspaceModules")
    expect(source).toContain("renderModuleBody")
    expect(source).toContain("renderPromptListCanvas")
    expect(source).toContain("setChatDrawerOpen(true)")
    expect(source).not.toContain("sideContent={renderSideContent()}")
    expect(source).not.toContain("WorkspaceCanvas")
    expect(source).not.toContain("Prompt 库")

    expect(source).not.toContain('import { TopBar }')
    expect(source).not.toContain('import { Sidebar }')
    expect(source).not.toContain('import { RightPanel }')
  })

  it("models test and audit modules with list/detail states in the main work area", () => {
    const pagePath = path.join(process.cwd(), "src", "app", "(main)", "page.tsx")
    const source = fs.readFileSync(pagePath, "utf8")

    expect(source).toContain("testCanvasView")
    expect(source).toContain("auditCanvasView")
    expect(source).toContain("renderTestCanvasList")
    expect(source).toContain("renderAuditCanvasList")
    expect(source).toContain("renderAuditCanvasDetail")
    expect(source).toContain("activeModuleId")
    expect(source).not.toContain("工作台首页")
    expect(source).not.toContain("canvasExpanded")
    expect(source).not.toContain("marginRight")
    expect(source).not.toContain("hidden-by-canvas")
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

  it("does not put upload document action in the knowledge page header", () => {
    const pagePath = path.join(process.cwd(), "src", "app", "(main)", "page.tsx")
    const source = fs.readFileSync(pagePath, "utf8")

    expect(source).not.toMatch(/title="知识库"[\s\S]{0,200}actions=\{/)
  })

  it("keeps the cleaning and indexing page as a development placeholder in the formal app", () => {
    const pagePath = path.join(process.cwd(), "src", "app", "(main)", "page.tsx")
    const source = fs.readFileSync(pagePath, "utf8")

    expect(source).toContain("功能开发中")
    expect(source).not.toContain("KnowledgeAutomationPanel")
  })
})
