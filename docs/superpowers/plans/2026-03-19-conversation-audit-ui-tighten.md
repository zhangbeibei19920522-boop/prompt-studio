# Conversation Audit UI Tighten Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tighten the conversation audit result page spacing without changing information structure.

**Architecture:** Keep the existing report layout and only adjust spacing classes and collapsed-card copy in the audit detail component. Cover the UI contract with a focused render test so the compact state does not regress.

**Tech Stack:** Next.js, React, TypeScript, Tailwind CSS, Vitest render-to-string tests

---

## Chunk 1: Compact Audit Detail UI

### Task 1: Lock the compact UI contract in tests

**Files:**
- Modify: `src/components/audit/__tests__/conversation-audit-detail.test.tsx`
- Test: `src/components/audit/__tests__/conversation-audit-detail.test.tsx`

- [ ] **Step 1: Write the failing test**

Add or extend a render test to assert:
- the collapsed helper copy only contains `点击卡片查看对话内容与详细评估。`
- the old fallback copy `展开查看会话内容与详细评估结果。` is absent
- the compact spacing classes for the metrics row and conversation card are present

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/components/audit/__tests__/conversation-audit-detail.test.tsx`
Expected: FAIL because the component still renders the old fallback copy and wider spacing classes.

- [ ] **Step 3: Write minimal implementation**

Update `src/components/audit/conversation-audit-detail.tsx` to:
- reduce the top metrics grid gap and card content spacing
- replace the fallback summary copy
- reduce collapsed conversation card spacing without changing expanded detail structure

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/components/audit/__tests__/conversation-audit-detail.test.tsx`
Expected: PASS

- [ ] **Step 5: Verify no local regression in the same area**

Run: `npm test -- src/components/audit/__tests__/conversation-audit-detail.test.tsx`
Expected: PASS with no additional failures in the targeted file.
