# Prompt Studio 部署指南

## 环境要求

- Windows / macOS / Linux
- Node.js >= 18
- Git（可选，也可以下载 ZIP）

## 方式一：命令行部署

打开终端（Windows 用 PowerShell 或 CMD），依次执行：

```bash
# 1. 安装 Git（如果没装过，已装跳过）
winget install Git.Git

# 2. 安装 Node.js（如果没装过，已装跳过）
winget install OpenJS.NodeJS.LTS

# 3. 关闭终端，重新打开（让环境变量生效）

# 4. 验证安装
node -v
git --version

# 5. 克隆项目
git clone https://github.com/zhangbeibei19920522-boop/prompt-studio.git

# 6. 进入目录
cd prompt-studio

# 7. 安装依赖
npm install

# 8. 启动
node bin/cli.js
```

启动后浏览器打开 http://localhost:3000 即可使用。

## 方式二：下载 ZIP 部署（不需要 Git）

1. 打开 https://github.com/zhangbeibei19920522-boop/prompt-studio
2. 点击绿色按钮 "Code" → "Download ZIP"
3. 解压到任意目录
4. 打开终端，进入解压后的目录
5. 执行：

```bash
npm install
node bin/cli.js
```

## 自定义端口

```bash
node bin/cli.js start -p 8080
```

## 常见问题

### npm install 报错
确认 Node.js 版本 >= 18：`node -v`

### 端口被占用
换一个端口：`node bin/cli.js start -p 3001`

### macOS / Linux 安装 Node.js
```bash
# macOS
brew install node

# Ubuntu / Debian
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```
