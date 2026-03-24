# Test Suite Routing Edit Button Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `路由配置` button beside `运行测试` on routed test suites so users can edit routing after the suite has been created.

**Architecture:** Reuse the existing routing dialog in the test suite detail header instead of adding a new page or API. Gate the button by `workflowMode === "routing"`, persist updated `routingConfig` through the existing suite update API, and refresh the suite after save so the detail view stays in sync.

**Tech Stack:** Next.js, React client components, existing shadcn dialog/button components, Vitest static/source assertions.

---

## Chunk 1: Detail Header Entry

### Task 1: Lock the new routing-only entry with tests

**Files:**
- Create: None
- Modify: `/Users/cs001/prompt-studio/src/components/test/__tests__/test-suite-detail.test.tsx`
- Test: `/Users/cs001/prompt-studio/src/components/test/__tests__/test-suite-detail.test.tsx`

- [ ] **Step 1: Write the failing test**
  Add assertions that a routing suite renders `路由配置` in the detail header and a single-prompt suite does not.

- [ ] **Step 2: Run test to verify it fails**
  Run: `./node_modules/.bin/vitest run --dir src src/components/test/__tests__/test-suite-detail.test.tsx`
  Expected: FAIL because the header still renders the generic `配置` button for all suites.

- [ ] **Step 3: Write minimal implementation**
  Update the detail header to replace the generic config button with a routing-only `路由配置` button placed beside `运行测试`.

- [ ] **Step 4: Run test to verify it passes**
  Run: `./node_modules/.bin/vitest run --dir src src/components/test/__tests__/test-suite-detail.test.tsx`
  Expected: PASS

### Task 2: Lock routing save behavior

**Files:**
- Create: None
- Modify: `/Users/cs001/prompt-studio/src/components/test/__tests__/test-suite-detail.test.tsx`
- Modify: `/Users/cs001/prompt-studio/src/components/test/test-suite-detail.tsx`
- Test: `/Users/cs001/prompt-studio/src/components/test/__tests__/test-suite-detail.test.tsx`

- [ ] **Step 1: Write the failing test**
  Add a source assertion that the routing dialog save path updates the suite with `workflowMode: "routing"` and the new `routingConfig`.

- [ ] **Step 2: Run test to verify it fails**
  Run: `./node_modules/.bin/vitest run --dir src src/components/test/__tests__/test-suite-detail.test.tsx`
  Expected: FAIL because save currently only sends `config`.

- [ ] **Step 3: Write minimal implementation**
  Add a dedicated routing-config save handler in the detail component and wire it into the reused dialog.

- [ ] **Step 4: Run test to verify it passes**
  Run: `./node_modules/.bin/vitest run --dir src src/components/test/__tests__/test-suite-detail.test.tsx`
  Expected: PASS

## Chunk 2: Verification

### Task 3: Run targeted regression tests

**Files:**
- Create: None
- Modify: None
- Test: `/Users/cs001/prompt-studio/src/components/test/__tests__/test-suite-detail.test.tsx`
- Test: `/Users/cs001/prompt-studio/src/components/test/__tests__/test-run-history.test.tsx`

- [ ] **Step 1: Run focused tests**
  Run: `./node_modules/.bin/vitest run --dir src src/components/test/__tests__/test-suite-detail.test.tsx src/components/test/__tests__/test-run-history.test.tsx`
  Expected: PASS

- [ ] **Step 2: Review for accidental UI regressions**
  Confirm no single-prompt suite path gained a new header action and the existing result/history views still render.
