# Routing Expected Output Enrichment Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在创建 routing 测试集时，按真实路由链路补全每条 case 的 `expectedOutput`，尤其是多轮对话场景。

**Architecture:** 抽出共享的 routing 执行器，供 `test-runner` 和 test cases 创建 API 共用。创建 API 在批量写入 cases 前，对 routing cases 做 enrichment，生成完整会话化 `expectedOutput`。

**Tech Stack:** Next.js route handlers, TypeScript, Vitest, existing AI provider + prompt repositories

---

## Chunk 1: Tests First

### Task 1: 锁定 routing cases 创建时的 enrichment 行为

**Files:**
- Modify: `src/app/api/__tests__/test-suites-route.test.ts`
- Test: `src/app/api/__tests__/test-suites-route.test.ts`

- [ ] **Step 1: 写失败测试，验证 routing 多轮 case 创建时 expectedOutput 被补全**
- [ ] **Step 2: 运行测试并确认失败**
- [ ] **Step 3: 写最小实现让测试通过**
- [ ] **Step 4: 重新运行测试确认通过**

## Chunk 2: Shared Routing Executor

### Task 2: 抽共享路由执行器并接入创建 API

**Files:**
- Create: `src/lib/ai/routing-executor.ts`
- Modify: `src/lib/ai/test-runner.ts`
- Modify: `src/app/api/test-suites/[id]/cases/route.ts`
- Modify: `src/app/api/__tests__/test-suites-route.test.ts`

- [ ] **Step 1: 从 test-runner 抽出共享 routing 执行和 transcript 格式化逻辑**
- [ ] **Step 2: 在 cases 创建 API 中，对 routing suite 先 enrichment 再写库**
- [ ] **Step 3: 处理 enrichment 失败时的单 case 回退**
- [ ] **Step 4: 跑 routing API 和 runner 相关测试**
