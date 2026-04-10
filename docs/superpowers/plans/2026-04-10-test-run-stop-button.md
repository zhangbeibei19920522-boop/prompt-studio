# Test Run Stop Button Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a stop button for the currently running test session and wire true cancellation through the request, route, runner, and provider stack.

**Architecture:** The client owns an `AbortController`, `streamTestRun(...)` forwards the signal to `fetch`, the run route forwards `request.signal` to the runner, and the runner/provider stack aborts current model calls and marks the run as failed with a stop reason.

**Tech Stack:** React client components, Next.js route handlers, TypeScript, Vitest.

---

## Chunk 1: Red Tests

### Task 1: Add failing stop-run tests

**Files:**
- Modify: `src/components/test/__tests__/test-suite-detail.test.tsx`
- Create: `src/lib/utils/__tests__/sse-client.test.ts`
- Create: `src/app/api/__tests__/test-suite-run-route.test.ts`
- Modify: `src/lib/ai/__tests__/test-runner-routing.test.ts`

- [ ] **Step 1: Write failing tests for the stop button, client signal forwarding, route signal forwarding, and runner abort handling**
- [ ] **Step 2: Run `npx vitest --run --exclude '.worktrees/**' src/components/test/__tests__/test-suite-detail.test.tsx src/lib/utils/__tests__/sse-client.test.ts src/app/api/__tests__/test-suite-run-route.test.ts src/lib/ai/__tests__/test-runner-routing.test.ts` and verify they fail**

## Chunk 2: Cancellation Wiring

### Task 2: Implement cancellation end to end

**Files:**
- Create: `src/lib/test-run-control.ts`
- Modify: `src/types/ai.ts`
- Modify: `src/lib/utils/sse-client.ts`
- Modify: `src/components/test/test-suite-detail.tsx`
- Modify: `src/app/api/test-suites/[id]/run/route.ts`
- Modify: `src/lib/ai/test-runner.ts`
- Modify: `src/lib/ai/routing-executor.ts`
- Modify: `src/lib/ai/test-evaluator.ts`
- Modify: `src/lib/ai/openai-compatible.ts`
- Modify: `src/lib/ai/anthropic.ts`

- [ ] **Step 1: Add shared abort helpers and extend provider options with `signal`**
- [ ] **Step 2: Make `streamTestRun(...)` and `TestSuiteDetail` use `AbortController`**
- [ ] **Step 3: Pass `request.signal` through the run route into `runTestSuite(...)`**
- [ ] **Step 4: Abort case execution and evaluation cleanly in the runner stack**
- [ ] **Step 5: Re-run the same targeted Vitest command and verify it passes**

## Chunk 3: Focused Verification

### Task 3: Run final checks

**Files:**
- Modify as needed based on failures

- [ ] **Step 1: Run `npx eslint src/components/test/test-suite-detail.tsx src/lib/utils/sse-client.ts src/app/api/test-suites/[id]/run/route.ts src/lib/ai/test-runner.ts src/lib/ai/routing-executor.ts src/lib/ai/test-evaluator.ts src/lib/ai/openai-compatible.ts src/lib/ai/anthropic.ts src/lib/test-run-control.ts src/components/test/__tests__/test-suite-detail.test.tsx src/lib/utils/__tests__/sse-client.test.ts src/app/api/__tests__/test-suite-run-route.test.ts src/lib/ai/__tests__/test-runner-routing.test.ts`**
- [ ] **Step 2: Confirm stop only affects the current in-flight run and does not remove existing HTML export or run history behavior**
