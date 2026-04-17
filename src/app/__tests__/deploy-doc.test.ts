import fs from "node:fs"
import path from "node:path"

describe("deployment documentation", () => {
  it("documents one-command install and update flows", () => {
    const deployPath = path.join(process.cwd(), "DEPLOY.md")
    const source = fs.readFileSync(deployPath, "utf8")

    expect(source).toContain("一条命令安装")
    expect(source).toContain("一条命令更新")
    expect(source).toContain("scripts/install.sh")
    expect(source).toContain("scripts/install.ps1")
    expect(source).toContain("node bin/cli.js update")
  })
})
