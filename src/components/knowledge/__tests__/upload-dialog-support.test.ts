import fs from "node:fs"
import path from "node:path"

describe("knowledge upload dialog format support", () => {
  it("accepts excel-style document formats for project document uploads", () => {
    const filePath = path.join(process.cwd(), "src", "components", "knowledge", "upload-dialog.tsx")
    const source = fs.readFileSync(filePath, "utf8")

    expect(source).toContain('".xlsx"')
    expect(source).toContain('".xls"')
    expect(source).toContain('".csv"')
    expect(source).toContain("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    expect(source).toContain("application/vnd.ms-excel")
    expect(source).toContain("text/csv")
    expect(source).toContain('accept={ACCEPTED_EXTENSIONS.join(",")}')
  })
})
