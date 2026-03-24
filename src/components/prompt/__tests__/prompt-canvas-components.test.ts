import fs from "node:fs"
import path from "node:path"

describe("prompt canvas components", () => {
  it("keeps prototype-style prompt editor and version history shells", () => {
    const editorSource = fs.readFileSync(
      path.join(process.cwd(), "src/components/prompt/prompt-editor.tsx"),
      "utf8"
    )
    const previewSource = fs.readFileSync(
      path.join(process.cwd(), "src/components/prompt/prompt-preview.tsx"),
      "utf8"
    )
    const historySource = fs.readFileSync(
      path.join(process.cwd(), "src/components/prompt/version-history.tsx"),
      "utf8"
    )

    expect(editorSource).toContain("prompt-editor-title")
    expect(editorSource).toContain("prompt-field-label")
    expect(previewSource).toContain("prompt-var")
    expect(historySource).toContain("prompt-version-item")
    expect(historySource).toContain("prompt-version-time")
  })

  it("keeps prototype-style history run rows in test run history", () => {
    const historySource = fs.readFileSync(
      path.join(process.cwd(), "src/components/test/test-run-history.tsx"),
      "utf8"
    )

    expect(historySource).toContain("history-run")
    expect(historySource).toContain("history-run-score")
    expect(historySource).toContain("history-run-time")
  })
})
