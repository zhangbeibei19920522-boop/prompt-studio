# Test Report HTML Export Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add HTML export for test reports without changing the existing PDF export flow.

**Architecture:** Reuse the current report HTML template in `src/lib/utils/pdf-export.ts`, add a browser download path for `.html`, and surface new buttons anywhere the report can currently be exported as PDF.

**Tech Stack:** Next.js client components, TypeScript, Vitest, existing browser-side export utilities.

---

## Chunk 1: Export Utility

### Task 1: Add failing HTML export tests

**Files:**
- Modify: `src/lib/utils/__tests__/pdf-export-browser.test.ts`
- Modify: `src/lib/utils/__tests__/pdf-export.test.ts`

- [ ] **Step 1: Write the failing tests**
- [ ] **Step 2: Run `npm run test:run -- src/lib/utils/__tests__/pdf-export.test.ts src/lib/utils/__tests__/pdf-export-browser.test.ts` and verify they fail for missing HTML export**
- [ ] **Step 3: Implement the minimal HTML export utility**
- [ ] **Step 4: Re-run the same command and verify it passes**

## Chunk 2: UI Entry Points

### Task 2: Add HTML export buttons next to PDF export

**Files:**
- Modify: `src/components/test/test-suite-detail.tsx`
- Modify: `src/components/test/test-run-history.tsx`
- Modify: `src/components/test/__tests__/test-suite-detail.test.tsx`

- [ ] **Step 1: Write the failing component assertion for the HTML export entry**
- [ ] **Step 2: Run `npm run test:run -- src/components/test/__tests__/test-suite-detail.test.tsx` and verify it fails**
- [ ] **Step 3: Implement the minimal UI changes**
- [ ] **Step 4: Re-run the same command and verify it passes**

## Chunk 3: Final Verification

### Task 3: Run focused regression checks

**Files:**
- Modify as needed based on failures

- [ ] **Step 1: Run `npm run test:run -- src/lib/utils/__tests__/pdf-export.test.ts src/lib/utils/__tests__/pdf-export-browser.test.ts src/components/test/__tests__/test-suite-detail.test.tsx`**
- [ ] **Step 2: Run `npm run test:run -- src/components/test/__tests__/test-run-history.test.tsx`**
- [ ] **Step 3: Confirm both PDF and HTML export paths are covered by fresh test evidence**
