# Prompt Manager

## 项目简介
Agent 驱动的对话式 Prompt 管理平台。用户通过对话与 AI Agent 交互，Agent 根据三级业务信息（全局→项目→Prompt）和知识库，智能生成、修改和优化 prompt。

## 技术栈
- **框架**: Next.js (全栈) + TypeScript
- **UI**: Tailwind CSS + shadcn/ui
- **数据库**: SQLite (better-sqlite3)
- **向量搜索**: 轻量向量存储（知识库语义检索）
- **流式输出**: Server-Sent Events (SSE)
- **AI**: 用户自配模型（OpenAI / Claude / Kimi / GLM / DeepSeek / 通义千问 / 任何 OpenAI 兼容 API）
- **分发**: npm 包 / npx

## 项目结构
```
prompt-manager/
├── docs/plans/          # 设计文档
├── src/
│   ├── app/             # Next.js App Router 页面
│   ├── components/      # React 组件
│   ├── lib/             # 核心逻辑（数据库、AI 调用、文档解析）
│   └── types/           # TypeScript 类型定义
├── public/              # 静态资源
└── data/                # SQLite 数据库文件（运行时生成）
```

## 核心架构
- **对话中心化**: 三栏布局（左侧栏 + 对话区 + 右侧面板）
- **Agent 驱动**: 每次修改 prompt 都由 Agent 执行，流程为 收集上下文→规划→用户确认→执行→迭代
- **三级业务信息**: 全局→项目→Prompt，Agent 每次操作前必须读取
- **@ 引用**: 用户在对话中通过 @ 引用多个 prompt 和知识库文档

## 核心功能模块
1. **项目管理** — 创建项目、维护业务说明/目标/背景
2. **知识库** — 上传业务文档（PDF/Word/TXT/MD）、管理已有 prompt
3. **对话式交互** — 用户通过对话与 Agent 交互，@ 引用 prompt 和文档
4. **Agent 规划** — 拆分需求为关键点，规划 prompt 操作，用户确认后执行
5. **Prompt 生成/修改** — 新建显示全文预览，修改显示 diff 对比，均可编辑
6. **版本管理** — 每次修改自动生成版本记录

## 数据模型
- **GlobalSettings**: provider, apiKey, model, baseUrl, businessDescription/Goal/Background
- **Project**: name, description, businessDescription/Goal/Background, timestamps
- **Prompt**: projectId, title, content, description, tags, variables, version, status, timestamps
- **PromptVersion**: promptId, version, content, changeNote, sessionId, timestamps
- **Document**: projectId, name, type, content, embedding, timestamps
- **Session**: projectId, title, timestamps
- **Message**: sessionId, role, content, references, metadata, timestamps

## 开发约定
- 遵循 immutable 数据模式，不直接修改对象
- 文件保持小而专注（200-400 行，不超过 800 行）
- 所有用户输入在边界处校验
- 错误处理要完整，不静默吞错
- commit message 格式: `<type>: <description>`

## 部署方式
```bash
npx prompt-manager          # 快速启动
npm install -g prompt-manager
prompt-manager start        # 全局安装后启动
```
启动后访问 http://localhost:3000

## 设计文档
- [项目设计文档](docs/plans/2026-02-28-prompt-manager-design.md)
