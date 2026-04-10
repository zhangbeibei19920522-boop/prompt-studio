# Test Report Remove PDF UI Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove PDF export entry points from test report UI while preserving the underlying PDF export implementation.

**Architecture:** Update only the two test report client components that surface export actions, then adjust the component tests so they assert HTML-only exposure. No changes to `src/lib/utils/pdf-export.ts` behavior.

**Tech Stack:** React client components, TypeScript, Vitest, ESLint.

---

## Chunk 1: Test First

### Task 1: Add failing UI assertions

**Files:**
- Modify: `src/components/test/__tests__/test-suite-detail.test.tsx`
- Modify: `src/components/test/__tests__/test-run-history.test.tsx`

- [ ] **Step 1: Write failing tests that require HTML export and forbid PDF export in the test report UI**
- [ ] **Step 2: Run `npx vitest --run --exclude '.worktrees/**' src/components/test/__tests__/test-suite-detail.test.tsx src/components/test/__tests__/test-run-history.test.tsx` and verify they fail**
- [ ] **Step 3: Implement the minimal UI changes**
- [ ] **Step 4: Re-run the same command and verify it passes**

## Chunk 2: Verification

### Task 2: Run focused checks

**Files:**
- Modify as needed based on failures

- [ ] **Step 1: Run `npx eslint src/components/test/test-suite-detail.tsx src/components/test/test-run-history.tsx src/components/test/__tests__/test-suite-detail.test.tsx src/components/test/__tests__/test-run-history.test.tsx`**
- [ ] **Step 2: Confirm only the UI exposure changed and the PDF utility was left intact**
