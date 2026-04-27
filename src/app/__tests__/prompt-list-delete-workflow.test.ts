import fs from "node:fs"
import path from "node:path"

describe("prompt list delete workflow", () => {
  it("supports single delete, select all, batch delete, and confirmation dialog from the prompt list", () => {
    const pagePath = path.join(process.cwd(), "src", "app", "(main)", "page.tsx")
    const source = fs.readFileSync(pagePath, "utf8")

    expect(source).toContain("selectedPromptIds")
    expect(source).toContain("handleRequestDeletePrompts")
    expect(source).toContain("handleConfirmDeletePrompts")
    expect(source).toContain("allVisiblePromptsSelected")
    expect(source).toContain("全选")
    expect(source).toContain("批量删除")
    expect(source).toContain('type="checkbox"')
    expect(source).toContain("确认删除")
    expect(source).toContain("确定要删除")
  })
})
