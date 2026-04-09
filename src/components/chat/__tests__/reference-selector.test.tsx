import fs from "node:fs"
import path from "node:path"

describe("reference selector", () => {
  test("renders a select-all toggle in the popover actions row", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "src/components/chat/reference-selector.tsx"),
      "utf8"
    )

    expect(source).toContain("onToggleAll")
    expect(source).toContain("allSelected = false")
    expect(source).toContain('{allSelected ? "取消全选" : "全选"}')
    expect(source).toContain("justify-end border-b px-3 py-2")
  })

  test("chat input wires both selectors to batch toggle handlers", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "src/components/chat/chat-input.tsx"),
      "utf8"
    )

    expect(source).toContain("handleToggleAllReferences")
    expect(source).toContain("allSelected={allPromptsSelected}")
    expect(source).toContain("allSelected={allDocumentsSelected}")
    expect(source).toContain("onToggleAll={() => handleToggleAllReferences(\"prompt\", promptItems)}")
    expect(source).toContain('onToggleAll={() => handleToggleAllReferences("document", documentItems)}')
  })
})
