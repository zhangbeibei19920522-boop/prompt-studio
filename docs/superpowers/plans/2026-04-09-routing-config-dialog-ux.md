# Routing Config Dialog UX Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the routing-config dialog usable with many intents and add a fast same-name configuration path by generating `intent -> Prompt` mappings directly from existing prompts.

**Architecture:** Keep the existing routing dialog entry points intact, but refactor the dialog into a fixed header/footer with a scrollable body inside [`src/components/test/test-routing-config-dialog.tsx`](/Users/cs001/prompt-studio/src/components/test/test-routing-config-dialog.tsx). Extract pure matching/generation helpers into a small utility module so the same-name bulk-generation rule and the row-level auto-match rule stay deterministic and testable. Reuse the existing `Popover + Command` UI primitives for searchable Prompt selection instead of introducing a new global input pattern.

**Tech Stack:** Next.js, React client components, existing shadcn dialog/button/input/popover/command components, Vitest.

---

## Chunk 1: Matching Rules and Bulk Generation Helpers

### Task 1: Lock the naming and generation rules with unit tests

**Files:**
- Create: `/Users/cs001/prompt-studio/src/components/test/__tests__/routing-config-utils.test.ts`
- Test: `/Users/cs001/prompt-studio/src/components/test/__tests__/routing-config-utils.test.ts`

- [ ] **Step 1: Write the failing tests**
  Add tests for:
  - `normalizeRoutingKey` trimming whitespace, lowercasing, and treating `-`, `_`, and spaces as equivalent
  - `buildRoutesFromPrompts` excluding the entry Prompt and preserving prompt order
  - `findUniquePromptMatch` returning a Prompt only on a unique normalized-title match
  - ambiguous matches returning `null`

- [ ] **Step 2: Run test to verify it fails**
  Run: `./node_modules/.bin/vitest run --dir src src/components/test/__tests__/routing-config-utils.test.ts`
  Expected: FAIL because the helper module does not exist yet.

### Task 2: Implement the pure helper module

**Files:**
- Create: `/Users/cs001/prompt-studio/src/components/test/routing-config-utils.ts`
- Test: `/Users/cs001/prompt-studio/src/components/test/__tests__/routing-config-utils.test.ts`

- [ ] **Step 1: Write minimal implementation**
  Add a focused utility module that exports:
  - `normalizeRoutingKey(value: string): string`
  - `findUniquePromptMatch(intent: string, prompts: Array<{ id: string; title: string }>, entryPromptId: string): { id: string; title: string } | null`
  - `buildRoutesFromPrompts(prompts: Array<{ id: string; title: string }>, entryPromptId: string): Array<{ intent: string; promptId: string }>`

- [ ] **Step 2: Run test to verify it passes**
  Run: `./node_modules/.bin/vitest run --dir src src/components/test/__tests__/routing-config-utils.test.ts`
  Expected: PASS

## Chunk 2: Dialog Scrollability and Fixed Actions

### Task 3: Lock the dialog layout expectations with component/source tests

**Files:**
- Modify: `/Users/cs001/prompt-studio/src/components/test/__tests__/test-flow-config-card.test.tsx`
- Test: `/Users/cs001/prompt-studio/src/components/test/__tests__/test-flow-config-card.test.tsx`

- [ ] **Step 1: Write the failing test**
  Add assertions that the routing dialog source contains:
  - a local max-height constraint on the dialog content
  - `overflow-hidden` on the shell
  - a dedicated scroll container for the form body
  - a footer that remains outside the scrolling region

- [ ] **Step 2: Run test to verify it fails**
  Run: `./node_modules/.bin/vitest run --dir src src/components/test/__tests__/test-flow-config-card.test.tsx`
  Expected: FAIL because the dialog currently renders one uninterrupted flow and the footer scrolls with the form.

### Task 4: Refactor the routing dialog into header/body/footer regions

**Files:**
- Modify: `/Users/cs001/prompt-studio/src/components/test/test-routing-config-dialog.tsx`
- Test: `/Users/cs001/prompt-studio/src/components/test/__tests__/test-flow-config-card.test.tsx`

- [ ] **Step 1: Write minimal implementation**
  Update the dialog to use a local layout like:
  - `DialogContent` with `sm:max-w-2xl`, local max-height, and `overflow-hidden`
  - an outer flex column shell
  - a middle `overflow-y-auto` body that contains the form
  - a footer rendered after the scroll container so save/cancel stay visible

- [ ] **Step 2: Run test to verify it passes**
  Run: `./node_modules/.bin/vitest run --dir src src/components/test/__tests__/test-flow-config-card.test.tsx`
  Expected: PASS

## Chunk 3: Fast Same-Name Configuration

### Task 5: Add failing tests for bulk generation and fast route setup

**Files:**
- Modify: `/Users/cs001/prompt-studio/src/components/test/__tests__/test-flow-config-card.test.tsx`
- Test: `/Users/cs001/prompt-studio/src/components/test/__tests__/test-flow-config-card.test.tsx`

- [ ] **Step 1: Write the failing tests**
  Add assertions that:
  - the dialog exposes `从 Prompts 生成路由`
  - the button depends on `entryPromptId`
  - the implementation uses the helper functions for generation/matching
  - the row keying remains based on stable route draft IDs

- [ ] **Step 2: Run test to verify it fails**
  Run: `./node_modules/.bin/vitest run --dir src src/components/test/__tests__/test-flow-config-card.test.tsx`
  Expected: FAIL because the dialog still only supports manual row-by-row entry.

### Task 6: Implement bulk generation and row-level auto-match

**Files:**
- Modify: `/Users/cs001/prompt-studio/src/components/test/test-routing-config-dialog.tsx`
- Modify: `/Users/cs001/prompt-studio/src/components/test/__tests__/test-flow-config-card.test.tsx`
- Test: `/Users/cs001/prompt-studio/src/components/test/__tests__/routing-config-utils.test.ts`
- Test: `/Users/cs001/prompt-studio/src/components/test/__tests__/test-flow-config-card.test.tsx`

- [ ] **Step 1: Write minimal implementation**
  In the dialog:
  - add `从 Prompts 生成路由`
  - disable it until an entry Prompt is selected
  - generate routes from all non-entry prompts with `intent = prompt.title`
  - if existing populated routes are present, ask for confirmation before replacing them
  - when an `intent` changes on a row with empty `promptId`, auto-fill the Prompt only if `findUniquePromptMatch` returns exactly one candidate

- [ ] **Step 2: Run tests to verify they pass**
  Run: `./node_modules/.bin/vitest run --dir src src/components/test/__tests__/routing-config-utils.test.ts src/components/test/__tests__/test-flow-config-card.test.tsx`
  Expected: PASS

### Task 7: Replace the target Prompt dropdown with a searchable picker

**Files:**
- Modify: `/Users/cs001/prompt-studio/src/components/test/test-routing-config-dialog.tsx`
- Test: `/Users/cs001/prompt-studio/src/components/test/__tests__/test-flow-config-card.test.tsx`

- [ ] **Step 1: Write the failing test**
  Add source or static-render assertions that the target Prompt control now uses the existing `Popover + Command` primitives instead of a long unsearchable dropdown.

- [ ] **Step 2: Run test to verify it fails**
  Run: `./node_modules/.bin/vitest run --dir src src/components/test/__tests__/test-flow-config-card.test.tsx`
  Expected: FAIL because each route row still uses `Select`.

- [ ] **Step 3: Write minimal implementation**
  Replace the route-row Prompt selector with a searchable picker that:
  - lists all non-entry prompts
  - filters by title
  - shows the current selection inline
  - updates only the current row

- [ ] **Step 4: Run test to verify it passes**
  Run: `./node_modules/.bin/vitest run --dir src src/components/test/__tests__/test-flow-config-card.test.tsx`
  Expected: PASS

## Chunk 4: Focused Verification

### Task 8: Run the affected routing UI tests together

**Files:**
- Modify: None
- Test: `/Users/cs001/prompt-studio/src/components/test/__tests__/routing-config-utils.test.ts`
- Test: `/Users/cs001/prompt-studio/src/components/test/__tests__/test-flow-config-card.test.tsx`
- Test: `/Users/cs001/prompt-studio/src/components/test/__tests__/test-suite-detail.test.tsx`

- [ ] **Step 1: Run focused regression tests**
  Run: `./node_modules/.bin/vitest run --dir src src/components/test/__tests__/routing-config-utils.test.ts src/components/test/__tests__/test-flow-config-card.test.tsx src/components/test/__tests__/test-suite-detail.test.tsx`
  Expected: PASS

- [ ] **Step 2: Review behavioral boundaries**
  Confirm:
  - the chat-triggered routing dialog still saves and continues generation
  - the test-suite detail entry still reuses the same dialog
  - manual route editing, add, and delete flows still behave as before

### Task 9: Optional manual smoke check in UI

**Files:**
- Modify: None
- Test: None

- [ ] **Step 1: Run a manual smoke check**
  Open a routing test flow with many prompts/intents and verify:
  - the dialog body scrolls independently
  - the footer stays visible
  - `从 Prompts 生成路由` fills routes immediately after selecting the entry Prompt
  - a mismatched or ambiguous name does not silently auto-select the wrong Prompt

- [ ] **Step 2: Record any follow-up polish separately**
  If the searchable picker or overwrite confirmation still feels noisy, capture that as a follow-up UX task instead of widening this implementation scope.
