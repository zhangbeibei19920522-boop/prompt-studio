# Prompt Studio 部署指南

## 环境要求

- Windows / macOS / Linux
- Node.js >= 18
- Git
- npm

> 用户数据保存在项目目录的 `data/` 中。安装和更新命令不会删除 `data/`，只会更新代码、依赖和 `.next` 构建产物。

## 一条命令安装

macOS / Linux 终端执行：

```bash
curl -fsSL https://raw.githubusercontent.com/zhangbeibei19920522-boop/prompt-studio/master/scripts/install.sh | bash
```

Windows PowerShell 执行：

```powershell
irm https://raw.githubusercontent.com/zhangbeibei19920522-boop/prompt-studio/master/scripts/install.ps1 | iex
```

默认安装到当前用户目录下的 `prompt-studio`：

- macOS / Linux：`~/prompt-studio`
- Windows：`%USERPROFILE%\prompt-studio`

启动：

```bash
cd ~/prompt-studio
node bin/cli.js
```

Windows PowerShell：

```powershell
cd "$HOME\prompt-studio"
node bin/cli.js
```

浏览器打开 http://localhost:3000 即可使用。

## 一条命令更新

如果 Prompt Studio 正在运行，先在运行服务的终端按 `Ctrl + C` 停止。

macOS / Linux：

```bash
cd ~/prompt-studio && node bin/cli.js update
```

Windows PowerShell：

```powershell
cd "$HOME\prompt-studio"; node bin/cli.js update
```

更新命令会自动执行：

```bash
git pull --ff-only origin master
npm install
npm run build
```

它会清理并重建 `.next`，保证页面使用最新代码；不会删除 `data/` 里的历史项目、对话、Prompt、知识库文档和记忆数据。

## 自定义安装目录

macOS / Linux：

```bash
PROMPT_STUDIO_DIR="$HOME/apps/prompt-studio" curl -fsSL https://raw.githubusercontent.com/zhangbeibei19920522-boop/prompt-studio/master/scripts/install.sh | bash
```

Windows PowerShell：

```powershell
$env:PROMPT_STUDIO_DIR="$HOME\apps\prompt-studio"; irm https://raw.githubusercontent.com/zhangbeibei19920522-boop/prompt-studio/master/scripts/install.ps1 | iex
```

自定义目录后，启动和更新时进入对应目录执行 `node bin/cli.js` 或 `node bin/cli.js update`。

## 自定义端口

```bash
node bin/cli.js start -p 8080
```

## 常见问题

### 更新后页面没有变化

执行：

```bash
node bin/cli.js update
```

`update` 会重新构建 `.next`，不会再使用旧页面产物。

### update 提示本地代码有修改

更新命令不会自动覆盖本地代码修改。先执行：

```bash
git status
```

确认这些修改是否需要保留。`data/` 是用户数据目录，不会影响更新。

### npm install 报错

确认 Node.js 版本 >= 18：

```bash
node -v
```

### 端口被占用

换一个端口：

```bash
node bin/cli.js start -p 3001
```

### macOS / Linux 安装 Node.js

macOS：

```bash
brew install node
```

Ubuntu / Debian：

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```
