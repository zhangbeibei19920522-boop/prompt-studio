$ErrorActionPreference = "Stop"

$RepoUrl = if ([string]::IsNullOrWhiteSpace($env:PROMPT_STUDIO_REPO)) {
  "https://github.com/zhangbeibei19920522-boop/prompt-studio.git"
} else {
  $env:PROMPT_STUDIO_REPO
}

$Branch = if ([string]::IsNullOrWhiteSpace($env:PROMPT_STUDIO_BRANCH)) {
  "master"
} else {
  $env:PROMPT_STUDIO_BRANCH
}

$InstallDir = if ([string]::IsNullOrWhiteSpace($env:PROMPT_STUDIO_DIR)) {
  Join-Path $HOME "prompt-studio"
} else {
  $env:PROMPT_STUDIO_DIR
}

function Write-Step {
  param([string]$Message)
  Write-Host ""
  Write-Host $Message
}

function Fail {
  param([string]$Message)
  Write-Host ""
  Write-Error "Prompt Studio 安装/更新失败：$Message"
  exit 1
}

function Require-Command {
  param([string]$Name)
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    Fail "缺少 $Name。请先安装 Node.js >= 18、Git 和 npm 后重试。"
  }
}

function Check-NodeVersion {
  $Major = [int](node -p "process.versions.node.split('.')[0]")
  if ($Major -lt 18) {
    Fail "Node.js 版本需要 >= 18。当前版本：$(node -v)"
  }
}

function Run-Step {
  param(
    [string]$Command,
    [string[]]$Arguments
  )
  Write-Step "> $Command $($Arguments -join ' ')"
  & $Command @Arguments
  if ($LASTEXITCODE -ne 0) {
    Fail "$Command 执行失败。"
  }
}

Require-Command git
Require-Command node
Require-Command npm
Check-NodeVersion

$GitDir = Join-Path $InstallDir ".git"

if (Test-Path $GitDir) {
  Write-Step "检测到已安装，开始更新代码。"
  Push-Location $InstallDir
  $Dirty = git status --porcelain --untracked-files=no
  if (-not [string]::IsNullOrWhiteSpace($Dirty)) {
    Fail "检测到本地代码有修改。为避免覆盖内容，请先处理 git status 里的改动。data/ 数据不会被更新命令删除。"
  }
  Run-Step "git" @("pull", "--ff-only", "origin", $Branch)
} else {
  if ((Test-Path $InstallDir) -and ((Get-ChildItem -Force $InstallDir | Select-Object -First 1) -ne $null)) {
    Fail "$InstallDir 已存在但不是 Git 安装目录。请设置 PROMPT_STUDIO_DIR 到一个空目录后重试。"
  }
  Write-Step "开始安装 Prompt Studio 到 $InstallDir"
  Run-Step "git" @("clone", "--branch", $Branch, $RepoUrl, $InstallDir)
  Push-Location $InstallDir
}

Run-Step "npm" @("install")
Run-Step "node" @("bin/cli.js", "build")

Pop-Location

Write-Step "Prompt Studio 已就绪。"
Write-Host "启动命令：cd `"$InstallDir`"; node bin/cli.js"
Write-Host "更新命令：cd `"$InstallDir`"; node bin/cli.js update"
