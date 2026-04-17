#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */

const { execSync, spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

const rootDir = path.resolve(__dirname, "..");
const args = process.argv.slice(2);
const command = args[0] || "start";
const port = getPort(args);
const nextDir = path.join(rootDir, ".next");
const buildStampPath = path.join(nextDir, "prompt-studio-build.json");
const repoBranch = process.env.PROMPT_STUDIO_BRANCH || "master";

function getPort(args) {
  const idx = args.indexOf("--port");
  if (idx !== -1 && args[idx + 1]) return parseInt(args[idx + 1], 10);
  const pIdx = args.indexOf("-p");
  if (pIdx !== -1 && args[pIdx + 1]) return parseInt(args[pIdx + 1], 10);
  return parseInt(process.env.PORT || "3000", 10);
}

function getPackageVersion() {
  try {
    const packageJson = JSON.parse(fs.readFileSync(path.join(rootDir, "package.json"), "utf8"));
    return packageJson.version || "local";
  } catch {
    return "local";
  }
}

function runCommand(commandLine, label) {
  try {
    execSync(commandLine, { cwd: rootDir, stdio: "inherit" });
  } catch (error) {
    const status = typeof error.status === "number" ? error.status : 1;
    console.error("");
    console.error(`${label}失败。`);
    console.error("请确认网络、Git、Node.js 和 npm 可用；如果服务正在运行，请先按 Ctrl+C 停止后重试。");
    process.exit(status);
  }
}

function readCommand(commandLine) {
  try {
    return execSync(commandLine, { cwd: rootDir, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return "";
  }
}

function ensureDataDir() {
  const dataDir = path.join(rootDir, "data");
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

function getGitCommit() {
  return readCommand("git rev-parse HEAD");
}

function readBuildStamp() {
  try {
    return JSON.parse(fs.readFileSync(buildStampPath, "utf8"));
  } catch {
    return null;
  }
}

function writeBuildStamp() {
  try {
    if (!fs.existsSync(nextDir)) {
      fs.mkdirSync(nextDir, { recursive: true });
    }
    fs.writeFileSync(
      buildStampPath,
      JSON.stringify(
        {
          commit: getGitCommit(),
          version: getPackageVersion(),
          builtAt: new Date().toISOString(),
        },
        null,
        2
      )
    );
  } catch (error) {
    console.warn("构建记录写入失败，但不影响启动：", error.message);
  }
}

function clearBuildDir() {
  try {
    fs.rmSync(nextDir, { recursive: true, force: true });
  } catch (error) {
    console.error("");
    console.error("清理旧构建失败。请先停止正在运行的 Prompt Studio，再重试。");
    console.error(error.message);
    process.exit(1);
  }
}

function buildApp(reason) {
  ensureDataDir();
  console.log(reason);
  clearBuildDir();
  runCommand("npm run build", "构建");
  writeBuildStamp();
  console.log("构建完成！\n");
}

function ensureBuilt() {
  const currentCommit = getGitCommit();
  const stamp = readBuildStamp();

  if (!fs.existsSync(nextDir)) {
    buildApp("首次启动，正在构建...");
    return;
  }

  if (currentCommit && (!stamp || stamp.commit !== currentCommit)) {
    buildApp("检测到代码已更新，正在重新构建...");
  }
}

function ensureGitRepo() {
  if (!fs.existsSync(path.join(rootDir, ".git"))) {
    console.error("");
    console.error("当前目录不是 Git 安装版本，无法自动更新。");
    console.error("请使用 DEPLOY.md 里的一条命令安装方式重新安装。");
    process.exit(1);
  }
}

function ensureNoTrackedChanges() {
  const dirty = readCommand("git status --porcelain --untracked-files=no");
  if (dirty) {
    console.error("");
    console.error("检测到本地代码有修改，自动更新已停止，避免覆盖你的内容。");
    console.error("如果这些修改不需要，请先处理 git status 里的改动后再执行 update。");
    process.exit(1);
  }
}

function updateApp() {
  ensureGitRepo();
  ensureNoTrackedChanges();
  console.log("正在更新 Prompt Studio...");
  runCommand(`git pull --ff-only origin ${repoBranch}`, "拉取最新代码");
  runCommand("npm install", "安装依赖");
  buildApp("正在重建最新页面...");
  console.log("更新完成。重新执行 node bin/cli.js 即可启动最新版本。");
}

function printBanner(port) {
  console.log("");
  console.log("  ╔══════════════════════════════════════╗");
  console.log(`  ║        Prompt Manager v${getPackageVersion()}        ║`);
  console.log("  ╠══════════════════════════════════════╣");
  console.log(`  ║  http://localhost:${port}               ║`);
  console.log("  ╚══════════════════════════════════════╝");
  console.log("");
}

if (command === "start" || command === undefined) {
  ensureDataDir();
  ensureBuilt();
  printBanner(port);

  // Use standalone server if available, otherwise fallback to next start
  const standaloneServer = path.join(rootDir, ".next", "standalone", "server.js");
  const useStandalone = fs.existsSync(standaloneServer);

  const child = useStandalone
    ? spawn(process.execPath, [standaloneServer], {
        cwd: rootDir,
        stdio: "inherit",
        env: { ...process.env, PORT: String(port), HOSTNAME: "0.0.0.0" },
      })
    : spawn(process.execPath, [require.resolve("next/dist/bin/next"), "start", "-p", String(port)], {
        cwd: rootDir,
        stdio: "inherit",
      });

  child.on("error", (err) => {
    console.error("启动失败:", err.message);
    process.exit(1);
  });

  child.on("exit", (code) => {
    process.exit(code || 0);
  });

  // Forward signals
  process.on("SIGINT", () => child.kill("SIGINT"));
  process.on("SIGTERM", () => child.kill("SIGTERM"));
} else if (command === "dev") {
  ensureDataDir();
  printBanner(port);

  const child = spawn(process.execPath, [require.resolve("next/dist/bin/next"), "dev", "-p", String(port)], {
    cwd: rootDir,
    stdio: "inherit",
  });

  child.on("exit", (code) => process.exit(code || 0));
  process.on("SIGINT", () => child.kill("SIGINT"));
  process.on("SIGTERM", () => child.kill("SIGTERM"));
} else if (command === "build") {
  buildApp("正在构建...");
} else if (command === "update") {
  updateApp();
} else {
  console.log(`
Prompt Manager - Agent 驱动的对话式 Prompt 管理平台

用法:
  prompt-manager              启动服务 (默认端口 3000)
  prompt-manager start        启动服务
  prompt-manager start -p 8080  指定端口
  prompt-manager dev          开发模式
  prompt-manager build        仅构建
  prompt-manager update       拉取最新代码、安装依赖并重新构建

选项:
  -p, --port <port>   指定端口号 (默认: 3000)
  `);
}
