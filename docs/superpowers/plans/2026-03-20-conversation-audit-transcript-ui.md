# Conversation Audit Transcript UI Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align the conversation-audit detail transcript UI with the test module conversation panel while omitting intent metadata.

**Architecture:** Reuse the existing test-module `ConversationPanel` rather than copying markup. Add a small adapter in the conversation-audit detail component that flattens each audit turn into ordered user/assistant transcript entries and renders them without intent badges.

**Tech Stack:** Next.js, React, TypeScript, Vitest, Tailwind CSS

---

### Task 1: Lock the expected transcript rendering in tests

**Files:**
- Modify: `src/components/audit/__tests__/conversation-audit-detail.test.tsx`
- Test: `src/components/audit/__tests__/conversation-audit-detail.test.tsx`

- [ ] **Step 1: Write the failing test**

Add assertions that the expanded conversation content:
- uses the shared conversation-panel container classes
- shows `用户` and `助手`
- renders `无回复` for empty assistant replies
- does not render the old `机器人` label

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/components/audit/__tests__/conversation-audit-detail.test.tsx`
Expected: FAIL because the audit detail still renders the old transcript structure.

### Task 2: Reuse the shared conversation panel in conversation-audit detail

**Files:**
- Modify: `src/components/audit/conversation-audit-detail.tsx`
- Test: `src/components/audit/__tests__/conversation-audit-detail.test.tsx`

- [ ] **Step 1: Write minimal implementation**

Update `src/components/audit/conversation-audit-detail.tsx` to:
- import `ConversationPanel` and its turn type support
- convert grouped audit turns into ordered `user` and `assistant` transcript items
- render `ConversationPanel` for the “对话内容” section without intent badges

- [ ] **Step 2: Run test to verify it passes**

Run: `npm run test:run -- src/components/audit/__tests__/conversation-audit-detail.test.tsx`
Expected: PASS

### Task 3: Verify no regression in shared transcript helpers

**Files:**
- Test: `src/components/test/__tests__/conversation-output.test.ts`

- [ ] **Step 1: Run related tests**

Run: `npm run test:run -- src/components/audit/__tests__/conversation-audit-detail.test.tsx src/components/test/__tests__/conversation-output.test.ts`
Expected: PASS
