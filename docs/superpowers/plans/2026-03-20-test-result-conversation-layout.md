# Test Result Conversation Layout Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把测试结果页和历史记录详情改成左右双栏，并让 `预期输出` 以会话形式展示。

**Architecture:** 在现有结果展示层上抽一个通用会话面板，复用现有对话解析逻辑，并新增一条针对 `expectedOutput` 的解析路径。结果页和历史页只负责布局，不再各自拼消息块。

**Tech Stack:** React, TypeScript, Vitest, existing shadcn/ui styles

---

## Chunk 1: Tests First

### Task 1: 为预期输出会话化写失败测试

**Files:**
- Modify: `src/components/test/__tests__/test-suite-detail.test.tsx`
- Modify: `src/components/test/__tests__/test-run-history.test.tsx`
- Test: `src/components/test/__tests__/test-suite-detail.test.tsx`
- Test: `src/components/test/__tests__/test-run-history.test.tsx`

- [ ] **Step 1: 写失败测试**
- [ ] **Step 2: 运行测试并确认失败**
- [ ] **Step 3: 只写最小实现让测试通过**
- [ ] **Step 4: 重新运行测试确认通过**

## Chunk 2: Shared Conversation Panel

### Task 2: 抽通用会话面板并统一双栏布局

**Files:**
- Create: `src/components/test/conversation-panel.tsx`
- Modify: `src/components/test/conversation-output.ts`
- Modify: `src/components/test/test-suite-detail.tsx`
- Modify: `src/components/test/test-run-history.tsx`
- Test: `src/components/test/__tests__/test-suite-detail.test.tsx`
- Test: `src/components/test/__tests__/test-run-history.test.tsx`

- [ ] **Step 1: 增加 `expectedOutput` 解析能力**
- [ ] **Step 2: 抽出通用会话面板**
- [ ] **Step 3: 把当前结果页切到双栏**
- [ ] **Step 4: 把历史记录详情切到双栏**
- [ ] **Step 5: 跑相关测试并确认全部通过**
