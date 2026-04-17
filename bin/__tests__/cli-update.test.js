import fs from "node:fs"
import path from "node:path"

describe("prompt-manager cli distribution commands", () => {
  it("supports update and rebuilds when the git commit changes", () => {
    const cliPath = path.join(process.cwd(), "bin", "cli.js")
    const source = fs.readFileSync(cliPath, "utf8")

    expect(source).toContain('command === "update"')
    expect(source).toContain("git pull --ff-only origin")
    expect(source).toContain("npm install")
    expect(source).toContain("npm run build")
    expect(source).toContain("prompt-studio-build.json")
    expect(source).toContain("git rev-parse HEAD")
    expect(source).toContain("fs.rmSync(nextDir")
    expect(source).not.toContain('rmSync(path.join(rootDir, "data"')
  })

  it("ships one-command install scripts for macOS/Linux and Windows", () => {
    const shellInstaller = fs.readFileSync(
      path.join(process.cwd(), "scripts", "install.sh"),
      "utf8"
    )
    const powershellInstaller = fs.readFileSync(
      path.join(process.cwd(), "scripts", "install.ps1"),
      "utf8"
    )

    expect(shellInstaller).toContain("git clone")
    expect(shellInstaller).toContain("npm install")
    expect(shellInstaller).toContain("node bin/cli.js build")
    expect(powershellInstaller).toContain('"clone"')
    expect(powershellInstaller).toContain('"install"')
    expect(powershellInstaller).toContain('"bin/cli.js", "build"')
  })
})
