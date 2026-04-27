import fs from "node:fs"
import path from "node:path"

describe("test suite delete workflow", () => {
  it("supports deleting a suite from the test suite list with confirmation", () => {
    const pagePath = path.join(process.cwd(), "src", "app", "(main)", "page.tsx")
    const source = fs.readFileSync(pagePath, "utf8")

    expect(source).toContain("testSuiteIdPendingDelete")
    expect(source).toContain("testSuiteDeleteDialogOpen")
    expect(source).toContain("handleRequestDeleteTestSuite")
    expect(source).toContain("handleConfirmDeleteTestSuite")
    expect(source).toContain("删除测试集")
    expect(source).toContain("确定要删除测试集")
  })
})
