# Conversation Audit Additive Upload Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make conversation-audit knowledge-file uploads additive across multiple selections while replacing same-name files with the latest selection.

**Architecture:** Keep the fix local to `ConversationAuditDetail` upload-card state handling. First add a failing regression test for the file-merge behavior, then implement the smallest possible merge helper and wire it into the `multiple` upload path only.

**Tech Stack:** Next.js, React, TypeScript, Vitest

---

## Chunk 1: Lock additive upload behavior in tests

### Task 1: Add a regression test for file merging

**Files:**
- Modify: `src/components/audit/__tests__/conversation-audit-detail.test.tsx`
- Test: `src/components/audit/__tests__/conversation-audit-detail.test.tsx`

- [ ] **Step 1: Write the failing test**

Add assertions that prove:
- existing files remain when new differently named files are added
- same-name files collapse to one entry using the latest file

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/components/audit/__tests__/conversation-audit-detail.test.tsx`
Expected: FAIL because the current upload logic replaces the whole file list.

## Chunk 2: Implement additive merge behavior

### Task 2: Update the multiple-file upload path

**Files:**
- Modify: `src/components/audit/conversation-audit-detail.tsx`
- Test: `src/components/audit/__tests__/conversation-audit-detail.test.tsx`

- [ ] **Step 1: Add a small merge helper**

Create a focused helper that combines existing files with incoming accepted files by `file.name`, replacing old entries when names match.

- [ ] **Step 2: Use the helper only for `multiple` uploads**

Keep single-file mode unchanged. Apply merge behavior only when the upload card is in multiple mode.

- [ ] **Step 3: Run the targeted test**

Run: `npm run test:run -- src/components/audit/__tests__/conversation-audit-detail.test.tsx`
Expected: PASS

## Chunk 3: Verify no upload regressions

### Task 3: Run focused verification

**Files:**
- Modify: none

- [ ] **Step 1: Run related tests**

Run: `npm run test:run -- src/components/audit/__tests__/conversation-audit-detail.test.tsx src/app/api/__tests__/conversation-audit-jobs-route.test.ts`
Expected: PASS

- [ ] **Step 2: Lint touched files**

Run: `npm run lint -- src/components/audit/conversation-audit-detail.tsx src/components/audit/__tests__/conversation-audit-detail.test.tsx`
Expected: PASS
