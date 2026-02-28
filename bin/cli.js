#!/usr/bin/env node

const { execSync, spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

const rootDir = path.resolve(__dirname, "..");
const args = process.argv.slice(2);
const command = args[0] || "start";
const port = getPort(args);

function getPort(args) {
  const idx = args.indexOf("--port");
  if (idx !== -1 && args[idx + 1]) return parseInt(args[idx + 1], 10);
  const pIdx = args.indexOf("-p");
  if (pIdx !== -1 && args[pIdx + 1]) return parseInt(args[pIdx + 1], 10);
  return parseInt(process.env.PORT || "3000", 10);
}

function ensureBuilt() {
  const nextDir = path.join(rootDir, ".next");
  if (!fs.existsSync(nextDir)) {
    console.log("首次启动，正在构建...");
    execSync("npm run build", { cwd: rootDir, stdio: "inherit" });
    console.log("构建完成！\n");
  }
}

function ensureDataDir() {
  const dataDir = path.join(rootDir, "data");
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

function printBanner(port) {
  console.log("");
  console.log("  ╔══════════════════════════════════════╗");
  console.log("  ║        Prompt Manager v0.1.0         ║");
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
  ensureDataDir();
  console.log("正在构建...");
  execSync("npm run build", { cwd: rootDir, stdio: "inherit" });
  console.log("构建完成！");
} else {
  console.log(`
Prompt Manager - Agent 驱动的对话式 Prompt 管理平台

用法:
  prompt-manager              启动服务 (默认端口 3000)
  prompt-manager start        启动服务
  prompt-manager start -p 8080  指定端口
  prompt-manager dev          开发模式
  prompt-manager build        仅构建

选项:
  -p, --port <port>   指定端口号 (默认: 3000)
  `);
}
