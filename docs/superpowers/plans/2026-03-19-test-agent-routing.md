# Test Agent Routing Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add conversation-driven routing test creation so the test agent can branch between unchanged single-prompt flow and a chat-triggered multi-prompt routing flow.

**Architecture:** Extend the test-domain schema to support `single` vs `routing` suites, surface a routing configuration step inside the existing test-agent chat flow, and update the runner/evaluator to execute a fixed `entryPrompt -> intent route -> replyPrompt` chain. Keep existing single-prompt suite creation and result layout intact, only adding routing-specific fields where needed.

**Tech Stack:** Next.js App Router, React, TypeScript, better-sqlite3, SSE streaming, Vitest

---

## Chunk 1: Schema And Type Contracts

### Task 1: Lock new routing test contracts in type-level and repository tests

**Files:**
- Modify: `src/lib/db/__tests__/conversation-audit-schema.test.ts`
- Create: `src/lib/db/__tests__/test-suites-routing-schema.test.ts`
- Test: `src/lib/db/__tests__/test-suites-routing-schema.test.ts`

- [ ] **Step 1: Write the failing test**

Add a focused schema/repository test that asserts:
- `test_suites` can persist `workflow_mode` and `routing_config`
- `test_cases` can persist `expected_intent`
- existing single-prompt rows still map correctly

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/db/__tests__/test-suites-routing-schema.test.ts`
Expected: FAIL because the schema and repository layer do not expose routing fields yet.

- [ ] **Step 3: Write minimal schema and repository implementation**

Modify:
- `src/lib/db/schema.sql`
- `src/lib/db/index.ts`
- `src/lib/db/repositories/test-suites.ts`
- `src/lib/db/repositories/test-cases.ts`
- `src/types/database.ts`
- `src/types/api.ts`

Implement:
- `workflowMode` and `routingConfig` on `TestSuite`
- `expectedIntent` on `TestCase`
- backward-compatible defaults for existing rows
- migration logic in `src/lib/db/index.ts` for new columns

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/db/__tests__/test-suites-routing-schema.test.ts`
Expected: PASS

- [ ] **Step 5: Verify related repository behavior**

Run: `npm test -- src/lib/db/__tests__/test-suites-routing-schema.test.ts`
Expected: PASS with stable row mapping for both single and routing suites.

## Chunk 2: Test Agent Chat Flow And Routing Configuration UI

### Task 2: Add routing-mode events and UI contract tests

**Files:**
- Create: `src/components/test/__tests__/test-flow-config-card.test.tsx`
- Modify: `src/components/chat/chat-area.tsx`
- Modify: `src/types/ai.ts`
- Test: `src/components/test/__tests__/test-flow-config-card.test.tsx`

- [ ] **Step 1: Write the failing test**

Add a render test that asserts:
- chat can render a routing configuration card event
- the card exposes a multi-prompt flow summary
- the configuration dialog uses prompt dropdowns, not free-text prompt inputs

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/components/test/__tests__/test-flow-config-card.test.tsx`
Expected: FAIL because no routing configuration card or dialog exists yet.

- [ ] **Step 3: Write minimal UI implementation**

Create or modify:
- `src/components/test/test-flow-config-card.tsx`
- `src/components/test/test-routing-config-dialog.tsx`
- `src/components/chat/chat-area.tsx`
- `src/lib/utils/sse-client.ts`
- `src/types/ai.ts`

Implement:
- a new stream event for “choose flow” / “configure routing”
- a chat-inline routing config card
- a routing config dialog that only uses existing project prompts as dropdown options
- local chat state so save closes the dialog and resumes the flow

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/components/test/__tests__/test-flow-config-card.test.tsx`
Expected: PASS

- [ ] **Step 5: Verify no regression in chat rendering**

Run: `npm test -- src/components/test/__tests__/test-flow-config-card.test.tsx`
Expected: PASS with the routing card rendered only for routing-mode events.

### Task 3: Update the test-agent prompt and stream parsing to branch on single vs routing

**Files:**
- Modify: `src/lib/ai/test-agent-prompt.ts`
- Modify: `src/app/api/ai/test-chat/route.ts`
- Modify: `src/types/ai.ts`
- Test: `src/app/api/ai/test-chat/route.ts` via existing or new route test

- [ ] **Step 1: Write the failing test**

Add or extend a route/parser test asserting:
- single-prompt requests still emit `test-suite-batch`
- routing requests emit a routing-configuration event before any test-suite batch

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/app/api/ai/test-chat/route.test.ts`
Expected: FAIL because the route does not emit routing setup events yet.

- [ ] **Step 3: Write minimal prompt and parser implementation**

Update:
- the system prompt so the agent first classifies the flow as `single` or `routing`
- the route parser so routing responses emit a dedicated event instead of immediately creating a pending test suite
- continuation logic so test generation resumes after routing config is supplied

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/app/api/ai/test-chat/route.test.ts`
Expected: PASS

- [ ] **Step 5: Verify unchanged single-prompt behavior**

Run: `npm test -- src/app/api/ai/test-chat/route.test.ts`
Expected: PASS with unchanged single-prompt batch behavior.

## Chunk 3: Test Suite Creation And Persistence

### Task 4: Create routing suites and routing cases from the existing confirmation path

**Files:**
- Modify: `src/app/(main)/page.tsx`
- Modify: `src/lib/utils/api-client.ts`
- Modify: `src/app/api/projects/[id]/test-suites/route.ts`
- Modify: `src/app/api/test-suites/[id]/route.ts`
- Modify: `src/lib/db/repositories/test-suites.ts`
- Modify: `src/lib/db/repositories/test-cases.ts`
- Modify: `src/components/test/test-suite-card.tsx`
- Test: add or extend suite creation tests around the affected API route

- [ ] **Step 1: Write the failing test**

Add an API or repository-level test asserting:
- a routing suite can be created with `workflowMode = 'routing'`
- the suite persists `routingConfig`
- batch-created cases persist `expectedIntent`

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/app/api/projects/[id]/test-suites/route.test.ts`
Expected: FAIL because the create route ignores routing fields and expected intent.

- [ ] **Step 3: Write minimal implementation**

Update:
- suite creation payloads in `src/app/(main)/page.tsx`
- API client request types in `src/lib/utils/api-client.ts`
- create/update routes for test suites
- batch case creation to accept `expectedIntent`
- `TestSuiteCard` to display `expectedIntent` only when present

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/app/api/projects/[id]/test-suites/route.test.ts`
Expected: PASS

- [ ] **Step 5: Verify existing single-prompt creation path**

Run: `npm test -- src/app/api/projects/[id]/test-suites/route.test.ts`
Expected: PASS for both single and routing payloads.

## Chunk 4: Runner, Evaluator, And Result Surface

### Task 5: Add routing execution tests before changing the runner

**Files:**
- Create: `src/lib/ai/__tests__/test-runner-routing.test.ts`
- Modify: `src/lib/ai/test-runner.ts`
- Modify: `src/lib/ai/test-evaluator.ts`
- Modify: `src/types/database.ts`
- Test: `src/lib/ai/__tests__/test-runner-routing.test.ts`

- [ ] **Step 1: Write the failing test**

Add a runner test asserting a routing suite:
- executes the entry prompt first
- extracts an `actualIntent`
- selects the mapped prompt
- stores `matchedPromptId` / `matchedPromptTitle`
- evaluates both intent and reply dimensions

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/ai/__tests__/test-runner-routing.test.ts`
Expected: FAIL because the current runner only accepts one prompt and one evaluation path.

- [ ] **Step 3: Write minimal implementation**

Update:
- `src/lib/ai/test-runner.ts` to branch on `workflowMode`
- `src/lib/ai/test-evaluator.ts` to add intent evaluation alongside reply evaluation
- test-run persistence structures in `src/types/database.ts`
- `src/app/api/test-suites/[id]/run/route.ts` to resolve entry and mapped prompts for routing suites

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/ai/__tests__/test-runner-routing.test.ts`
Expected: PASS

- [ ] **Step 5: Verify existing single-prompt runner behavior**

Run: `npm test -- src/lib/ai/__tests__/test-runner-routing.test.ts`
Expected: PASS with no breakage to the single-prompt branch.

### Task 6: Extend result rendering with routing metadata

**Files:**
- Modify: `src/components/test/test-suite-detail.tsx`
- Modify: `src/components/test/test-report.tsx`
- Test: add or extend render test covering routing result fields

- [ ] **Step 1: Write the failing test**

Add a focused render test asserting the result UI shows:
- expected intent
- actual intent
- matched prompt
- separated route-vs-reply reasoning

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/components/test/test-suite-detail.test.tsx`
Expected: FAIL because the result view does not render routing metadata yet.

- [ ] **Step 3: Write minimal implementation**

Update:
- `src/components/test/test-suite-detail.tsx`
- `src/components/test/test-report.tsx`

Render routing fields only when `workflowMode === 'routing'`, preserving the current single-prompt layout for all existing suites.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/components/test/test-suite-detail.test.tsx`
Expected: PASS

- [ ] **Step 5: Run targeted regression verification**

Run: `npm test -- src/components/test/test-suite-detail.test.tsx src/lib/ai/__tests__/test-runner-routing.test.ts src/components/test/__tests__/test-flow-config-card.test.tsx`
Expected: PASS
