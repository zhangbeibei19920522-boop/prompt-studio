# Routing G Intent Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 routing 测试链路支持保留 intent `G`，并把它解析为上一轮已成功命中的 intent。

**Architecture:** 在共享 routing 执行器里维护 `lastResolvedIntent`，把入口 Prompt 输出拆成 `rawIntent` 和 `resolvedIntent`。`actualIntent` 继续暴露 resolved intent，`routingSteps` 追加可选 `rawIntent`。测试集生成 prompt 同步写入 `G` 规则，确保生成与执行一致。

**Tech Stack:** TypeScript, Next.js route handlers, Vitest, existing routing executor/test runner

---

## Chunk 1: Red Tests

### Task 1: 为 `G` fallback 行为补失败测试

**Files:**
- Modify: `src/lib/ai/__tests__/test-runner-routing.test.ts`
- Test: `src/lib/ai/__tests__/test-runner-routing.test.ts`

- [ ] **Step 1: 写失败测试，覆盖第二轮 raw intent 为 `G` 时沿用上一轮 resolved intent**
- [ ] **Step 2: 运行 `src/lib/ai/__tests__/test-runner-routing.test.ts` 并确认失败原因正确**

### Task 2: 为生成 prompt 补失败测试

**Files:**
- Modify: `src/lib/ai/__tests__/test-agent-prompt.test.ts`
- Test: `src/lib/ai/__tests__/test-agent-prompt.test.ts`

- [ ] **Step 1: 写失败测试，断言 routing system prompt 明确描述 `G` 规则**
- [ ] **Step 2: 运行 `src/lib/ai/__tests__/test-agent-prompt.test.ts` 并确认失败原因正确**

## Chunk 2: Green Implementation

### Task 3: 在 routing 执行器里解析 `G`

**Files:**
- Modify: `src/lib/ai/routing-executor.ts`
- Modify: `src/types/database.ts`
- Test: `src/lib/ai/__tests__/test-runner-routing.test.ts`

- [ ] **Step 1: 给 `TestCaseRoutingStep` 增加可选 `rawIntent`**
- [ ] **Step 2: 在执行器里维护上一轮 resolved intent，并让 `G` 复用该值**
- [ ] **Step 3: 保持 `actualIntent` 与评估逻辑继续使用 resolved intent**
- [ ] **Step 4: 重新运行 runner 测试确认通过**

### Task 4: 同步生成侧规则

**Files:**
- Modify: `src/lib/ai/test-agent-prompt.ts`
- Test: `src/lib/ai/__tests__/test-agent-prompt.test.ts`

- [ ] **Step 1: 在 routing generation system prompt 中补充 `G` 规则**
- [ ] **Step 2: 重新运行 prompt 测试确认通过**

## Chunk 3: Verification

### Task 5: 回归关键 routing 测试

**Files:**
- Test: `src/lib/ai/__tests__/test-runner-routing.test.ts`
- Test: `src/lib/ai/__tests__/test-agent-prompt.test.ts`

- [ ] **Step 1: 运行相关测试文件**
- [ ] **Step 2: 确认没有引入现有 routing 行为回归**
