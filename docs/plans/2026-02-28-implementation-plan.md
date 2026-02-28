# Prompt Manager - 总体开发计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 构建一个 Agent 驱动的对话式 Prompt 管理平台

**Architecture:** Next.js 全栈应用，三栏对话中心化布局。后端使用 SQLite 存储 7 张表，AI 服务层支持多家大模型（OpenAI 兼容 API）。前端以对话窗口为核心，Agent 通过 SSE 流式响应与用户交互。

**Tech Stack:** Next.js 15 + TypeScript + Tailwind CSS + shadcn/ui + SQLite (better-sqlite3) + SSE

---

## 模块总览

| # | 模块 | 描述 | 依赖 | 预估文件数 |
|---|------|------|------|-----------|
| M1 | 项目初始化 | Next.js 脚手架、依赖安装、目录结构 | 无 | ~10 |
| M2 | 类型定义 | 所有实体的 TypeScript 类型 | M1 | 3-4 |
| M3 | 数据库层 | SQLite 初始化、7 张表、CRUD 操作 | M1, M2 | 8-10 |
| M4 | API 层 | 所有实体的 REST API Routes | M3 | 12-15 |
| M5 | AI 服务层 | 多模型接入、流式调用、Agent Prompt 构造 | M1, M2 | 4-6 |
| M6 | 布局与导航 | 三栏布局、项目切换、全局设置页 | M1, M4 | 6-8 |
| M7 | 项目管理 UI | 创建/编辑项目、业务信息维护 | M4, M6 | 4-6 |
| M8 | 知识库 UI | 文档上传、解析、管理 | M4, M6 | 5-7 |
| M9 | Prompt 管理 UI | 侧边栏列表、详情预览、版本历史 | M4, M6 | 5-7 |
| M10 | 对话界面 | 消息流、输入框、@ 引用交互 | M4, M6 | 8-10 |
| M11 | Agent 工作流 | 上下文收集、规划、执行、迭代 | M5, M10 | 6-8 |
| M12 | 对话特殊组件 | 规划卡片、预览卡片、Diff 卡片 | M10, M11 | 5-7 |

## 开发顺序与依赖图

```
M1 项目初始化
 ├── M2 类型定义
 │    └── M3 数据库层
 │         └── M4 API 层
 │              ├── M6 布局与导航
 │              │    ├── M7 项目管理 UI
 │              │    ├── M8 知识库 UI
 │              │    ├── M9 Prompt 管理 UI
 │              │    └── M10 对话界面
 │              │         ├── M12 对话特殊组件
 │              │         └── M11 Agent 工作流
 └── M5 AI 服务层 ──────────┘
```

## 各模块详细开发文档

详见各模块独立文档：
- [M1 项目初始化](./modules/m1-project-init.md)
- [M2 类型定义](./modules/m2-type-definitions.md)
- [M3 数据库层](./modules/m3-database.md)
- [M4 API 层](./modules/m4-api.md)
- [M5 AI 服务层](./modules/m5-ai-service.md)
- [M6 布局与导航](./modules/m6-layout.md)
- [M7 项目管理 UI](./modules/m7-project-ui.md)
- [M8 知识库 UI](./modules/m8-knowledge-base-ui.md)
- [M9 Prompt 管理 UI](./modules/m9-prompt-ui.md)
- [M10 对话界面](./modules/m10-chat-ui.md)
- [M11 Agent 工作流](./modules/m11-agent-workflow.md)
- [M12 对话特殊组件](./modules/m12-chat-components.md)
