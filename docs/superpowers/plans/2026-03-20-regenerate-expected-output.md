# Regenerate Expected Output Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为测试集详情页增加“重生成预期结果”按钮，并通过服务端批量更新整套测试集的 `expectedOutput`。

**Architecture:** 新增测试集级 API 路由来批量重生成 `expectedOutput`，前端只负责触发和刷新。单 Prompt 和 routing 均复用现有共享执行器，避免维护两套调用逻辑。

**Tech Stack:** Next.js route handlers, React, TypeScript, Vitest

---

## Chunk 1: Tests First

### Task 1: 锁定 API 和按钮入口

**Files:**
- Modify: `src/app/api/__tests__/test-suites-route.test.ts`
- Modify: `src/components/test/__tests__/test-suite-detail.test.tsx`

- [ ] **Step 1: 写失败测试，验证批量重生成 API 会更新 expectedOutput**
- [ ] **Step 2: 写失败测试，验证详情页出现 `重生成预期结果` 按钮**
- [ ] **Step 3: 运行测试并确认失败**

## Chunk 2: API And UI

### Task 2: 实现批量重生成和前端按钮

**Files:**
- Create: `src/app/api/test-suites/[id]/regenerate-expected-outputs/route.ts`
- Modify: `src/lib/ai/routing-executor.ts`
- Modify: `src/lib/ai/test-runner.ts`
- Modify: `src/lib/utils/api-client.ts`
- Modify: `src/components/test/test-suite-detail.tsx`
- Modify: `src/app/api/__tests__/test-suites-route.test.ts`
- Modify: `src/components/test/__tests__/test-suite-detail.test.tsx`

- [ ] **Step 1: 抽单 Prompt 共享执行能力**
- [ ] **Step 2: 实现测试集级重生成 API**
- [ ] **Step 3: 接入 API client 和详情页按钮**
- [ ] **Step 4: 完成后刷新测试集详情并提示结果**
- [ ] **Step 5: 跑相关测试确认通过**
