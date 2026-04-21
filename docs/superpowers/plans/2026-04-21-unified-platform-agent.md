# Unified Platform Agent Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a single-entry platform agent that can understand platform tasks, collect editable configuration through chat and config cards, and dispatch confirmed actions to domain executors without allowing publish-class operations.

**Architecture:** Add a unified orchestration layer on top of the existing chat SSE pipeline. The orchestrator owns task identification, task state, config cards, parameter patching, validation, and executor dispatch. Existing prompt, test, audit, memory, and settings capabilities are adapted behind domain executors, while `cleaning` and `knowledge_r` remain separate task domains.

**Tech Stack:** Next.js App Router, React, TypeScript, better-sqlite3, SSE streaming, existing AI provider abstraction, Vitest

---

## Chunk 1: Unified Task Contracts And SSE Protocol

### Task 1: Define task, config-card, and executor contracts

**Files:**
- Create: `src/lib/ai/task-types.ts`
- Create: `src/lib/ai/task-registry.ts`
- Modify: `src/types/ai.ts`
- Test: `src/lib/ai/__tests__/unified-task-types.test.ts`

- [ ] **Step 1: Write the failing test**

Add a contract-level test asserting:
- unified tasks support `domain`, `operation`, `status`, `missingFields`, and execution policy
- config-card data supports editable fields, source tracking, and validation errors
- stream events include `task-config`, `task-validation`, `task-status`, and `task-result`

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run src/lib/ai/__tests__/unified-task-types.test.ts`
Expected: FAIL because unified task contracts do not exist yet.

- [ ] **Step 3: Write minimal implementation**

Implement:
- task status enums
- task config field types
- config-card data shape
- executor interfaces
- new SSE event types in `src/types/ai.ts`

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --run src/lib/ai/__tests__/unified-task-types.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai/task-types.ts src/lib/ai/task-registry.ts src/types/ai.ts src/lib/ai/__tests__/unified-task-types.test.ts
git commit -m "feat: add unified agent task contracts"
```

### Task 2: Add a first-pass task registry with forbidden operation support

**Files:**
- Modify: `src/lib/ai/task-registry.ts`
- Test: `src/lib/ai/__tests__/task-registry.test.ts`

- [ ] **Step 1: Write the failing test**

Add a registry test asserting:
- supported task domains include `prompt`, `test`, `cleaning`, `audit`, `memory`, `project_settings`, and `knowledge_r`
- publish, rollback, and online-version-switch actions are marked forbidden
- `cleaning` and `knowledge_r` resolve to separate task families

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run src/lib/ai/__tests__/task-registry.test.ts`
Expected: FAIL because no registry entries exist yet.

- [ ] **Step 3: Write minimal implementation**

Implement:
- static registry entries for supported task domains
- forbidden action metadata
- placeholder executor mapping for each domain

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --run src/lib/ai/__tests__/task-registry.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai/task-registry.ts src/lib/ai/__tests__/task-registry.test.ts
git commit -m "feat: register unified platform agent task domains"
```

## Chunk 2: Task Context, Parameter Resolution, And Patch Flow

### Task 3: Build unified runtime context collection

**Files:**
- Create: `src/lib/ai/task-context.ts`
- Modify: `src/lib/ai/context-collector.ts`
- Test: `src/lib/ai/__tests__/task-context.test.ts`

- [ ] **Step 1: Write the failing test**

Add a context test asserting unified runtime context can expose:
- current session and project
- referenced prompts and documents
- active test or knowledge context when available
- recent session messages for parameter patching

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run src/lib/ai/__tests__/task-context.test.ts`
Expected: FAIL because unified runtime context does not exist yet.

- [ ] **Step 3: Write minimal implementation**

Implement:
- a runtime context wrapper around current collectors and repositories
- helper getters for current project, references, messages, and memory

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --run src/lib/ai/__tests__/task-context.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai/task-context.ts src/lib/ai/context-collector.ts src/lib/ai/__tests__/task-context.test.ts
git commit -m "feat: add unified agent runtime context"
```

### Task 4: Implement deterministic config resolution and parameter patching

**Files:**
- Create: `src/lib/ai/task-config-resolver.ts`
- Create: `src/lib/ai/task-patcher.ts`
- Test: `src/lib/ai/__tests__/task-config-resolver.test.ts`
- Test: `src/lib/ai/__tests__/task-patcher.test.ts`

- [ ] **Step 1: Write the failing tests**

Add focused tests asserting:
- inferred defaults never override user-card values
- user-chat values override inferred values
- a live task is patched before the same input is treated as a new task
- failed patches preserve the original config card

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- --run src/lib/ai/__tests__/task-config-resolver.test.ts src/lib/ai/__tests__/task-patcher.test.ts`
Expected: FAIL because no resolver or patcher exists yet.

- [ ] **Step 3: Write minimal implementation**

Implement:
- field-source priority rules
- merge logic for card edits vs chat updates
- patch result summaries with `updatedKeys`, `conflicts`, and `needsUserConfirmation`

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- --run src/lib/ai/__tests__/task-config-resolver.test.ts src/lib/ai/__tests__/task-patcher.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai/task-config-resolver.ts src/lib/ai/task-patcher.ts src/lib/ai/__tests__/task-config-resolver.test.ts src/lib/ai/__tests__/task-patcher.test.ts
git commit -m "feat: add unified agent config resolution and patching"
```

## Chunk 3: Unified Orchestrator And Chat API Integration

### Task 5: Add the unified chat orchestrator state machine

**Files:**
- Create: `src/lib/ai/unified-agent.ts`
- Modify: `src/lib/ai/agent.ts`
- Test: `src/lib/ai/__tests__/unified-agent.test.ts`

- [ ] **Step 1: Write the failing test**

Add an orchestrator test asserting:
- new requests can become draft tasks
- incomplete write operations emit `task-config`
- complete write operations transition to `ready_to_confirm`
- forbidden actions emit `task-validation` and never execute

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run src/lib/ai/__tests__/unified-agent.test.ts`
Expected: FAIL because the unified orchestrator does not exist yet.

- [ ] **Step 3: Write minimal implementation**

Implement:
- task identification hook
- active-task tracking in memory for the current request flow
- transitions for `draft`, `collecting_config`, `ready_to_confirm`, `executing`, and `completed`
- delegation path back to legacy prompt/test flows where needed during migration

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --run src/lib/ai/__tests__/unified-agent.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai/unified-agent.ts src/lib/ai/agent.ts src/lib/ai/__tests__/unified-agent.test.ts
git commit -m "feat: add unified platform agent orchestrator"
```

### Task 6: Extend the chat SSE route and client parsing for unified task events

**Files:**
- Modify: `src/app/api/ai/chat/route.ts`
- Modify: `src/lib/ai/stream-handler.ts`
- Modify: `src/lib/utils/sse-client.ts`
- Test: `src/app/api/__tests__/unified-chat-route.test.ts`

- [ ] **Step 1: Write the failing test**

Add a route/SSE test asserting:
- chat route can stream `task-config`, `task-validation`, `task-status`, and `task-result`
- existing `plan`, `preview`, and `diff` events still parse correctly

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run src/app/api/__tests__/unified-chat-route.test.ts`
Expected: FAIL because new unified task events are not encoded or parsed yet.

- [ ] **Step 3: Write minimal implementation**

Implement:
- route integration with the unified orchestrator
- SSE encoding support for new event types
- client-side parsing for the new task event payloads

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --run src/app/api/__tests__/unified-chat-route.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/api/ai/chat/route.ts src/lib/ai/stream-handler.ts src/lib/utils/sse-client.ts src/app/api/__tests__/unified-chat-route.test.ts
git commit -m "feat: stream unified agent task events"
```

## Chunk 4: Config Card UI And Chat Integration

### Task 7: Add a unified task config card and validation/status cards

**Files:**
- Create: `src/components/chat/task-config-card.tsx`
- Create: `src/components/chat/task-validation-card.tsx`
- Create: `src/components/chat/task-status-card.tsx`
- Create: `src/components/chat/task-result-card.tsx`
- Test: `src/components/chat/__tests__/task-config-card.test.tsx`

- [ ] **Step 1: Write the failing test**

Add component tests asserting:
- config cards render editable fields and source labels
- validation cards render blocking errors
- status cards render execution progress
- result cards render a summary and follow-up hint

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run src/components/chat/__tests__/task-config-card.test.tsx`
Expected: FAIL because the new cards do not exist yet.

- [ ] **Step 3: Write minimal implementation**

Implement:
- generic config-card rendering for supported field types
- read-only execution state mode
- field-level source badges (`user_card`, `user_chat`, `inferred`)
- validation and result card variants

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --run src/components/chat/__tests__/task-config-card.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/chat/task-config-card.tsx src/components/chat/task-validation-card.tsx src/components/chat/task-status-card.tsx src/components/chat/task-result-card.tsx src/components/chat/__tests__/task-config-card.test.tsx
git commit -m "feat: add unified agent config and status cards"
```

### Task 8: Wire task cards into the existing chat area without redesigning the UI shell

**Files:**
- Modify: `src/components/chat/message-bubble.tsx`
- Modify: `src/components/chat/chat-area.tsx`
- Modify: `src/types/database.ts`
- Test: `src/components/chat/__tests__/message-bubble-task-cards.test.tsx`

- [ ] **Step 1: Write the failing test**

Add a chat rendering test asserting:
- task cards render in the same message stream as existing cards
- card edits can be surfaced through callbacks
- existing `plan`, `preview`, and `diff` rendering still works

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run src/components/chat/__tests__/message-bubble-task-cards.test.tsx`
Expected: FAIL because message metadata and chat-area event handling do not support the new card types.

- [ ] **Step 3: Write minimal implementation**

Implement:
- message metadata extensions for task cards
- chat-area handling for new SSE events
- callbacks for config edit, config confirm, and retry

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --run src/components/chat/__tests__/message-bubble-task-cards.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/chat/message-bubble.tsx src/components/chat/chat-area.tsx src/types/database.ts src/components/chat/__tests__/message-bubble-task-cards.test.tsx
git commit -m "feat: render unified task cards in chat"
```

## Chunk 5: Domain Executor Migration

### Task 9: Adapt prompt, test, and memory features behind executor interfaces

**Files:**
- Create: `src/lib/ai/executors/prompt-executor.ts`
- Create: `src/lib/ai/executors/test-executor.ts`
- Create: `src/lib/ai/executors/memory-executor.ts`
- Test: `src/lib/ai/__tests__/prompt-executor.test.ts`
- Test: `src/lib/ai/__tests__/test-executor.test.ts`

- [ ] **Step 1: Write the failing tests**

Add executor tests asserting:
- prompt executor can infer prompt targets and produce preview/diff results
- test executor can collect routing config and create a test suite task
- memory executor can list/create/delete with unified summaries

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- --run src/lib/ai/__tests__/prompt-executor.test.ts src/lib/ai/__tests__/test-executor.test.ts`
Expected: FAIL because no executor adapters exist yet.

- [ ] **Step 3: Write minimal implementation**

Implement:
- thin adapters around existing prompt/test/memory code
- executor-specific param validation
- result translation back to unified task summaries

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- --run src/lib/ai/__tests__/prompt-executor.test.ts src/lib/ai/__tests__/test-executor.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai/executors/prompt-executor.ts src/lib/ai/executors/test-executor.ts src/lib/ai/executors/memory-executor.ts src/lib/ai/__tests__/prompt-executor.test.ts src/lib/ai/__tests__/test-executor.test.ts
git commit -m "feat: adapt prompt test and memory features as unified executors"
```

### Task 10: Add audit, project-settings, cleaning, and knowledge-r executor stubs with boundaries enforced

**Files:**
- Create: `src/lib/ai/executors/audit-executor.ts`
- Create: `src/lib/ai/executors/project-settings-executor.ts`
- Create: `src/lib/ai/executors/cleaning-executor.ts`
- Create: `src/lib/ai/executors/knowledge-r-executor.ts`
- Test: `src/lib/ai/__tests__/executor-boundaries.test.ts`

- [ ] **Step 1: Write the failing test**

Add boundary tests asserting:
- `cleaning` executor rejects publish/rollback operations
- `knowledge_r` executor rejects cleaning-task operations
- audit and project-settings executors expose only allowed operations

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run src/lib/ai/__tests__/executor-boundaries.test.ts`
Expected: FAIL because the executor stubs do not exist yet.

- [ ] **Step 3: Write minimal implementation**

Implement:
- executor skeletons and operation guards
- no-op or placeholder execution summaries where the real backend path is pending
- explicit forbidden-action failures for publish-class requests

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --run src/lib/ai/__tests__/executor-boundaries.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai/executors/audit-executor.ts src/lib/ai/executors/project-settings-executor.ts src/lib/ai/executors/cleaning-executor.ts src/lib/ai/executors/knowledge-r-executor.ts src/lib/ai/__tests__/executor-boundaries.test.ts
git commit -m "feat: add unified executor boundaries for remaining domains"
```

## Chunk 6: Verification And Migration Safety

### Task 11: Add regression coverage for legacy behaviors during unified-agent rollout

**Files:**
- Modify: `src/lib/ai/__tests__/test-agent-prompt.test.ts`
- Modify: `src/lib/ai/__tests__/test-runner-routing.test.ts`
- Create: `src/components/chat/__tests__/chat-area-unified-regression.test.tsx`
- Test: `src/components/chat/__tests__/chat-area-unified-regression.test.tsx`

- [ ] **Step 1: Write the failing regression test**

Add regression coverage asserting:
- old test-agent routing generation still works under the new SSE parsing path
- existing `plan`, `preview`, and `diff` cards still render
- parameter-patch messages do not accidentally create duplicate tasks

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run src/components/chat/__tests__/chat-area-unified-regression.test.tsx`
Expected: FAIL because unified task integration is not yet protecting legacy behavior.

- [ ] **Step 3: Write minimal implementation**

Implement:
- regression guards in chat event handling
- fallback compatibility for legacy metadata
- task-duplication prevention in the orchestrator

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --run src/components/chat/__tests__/chat-area-unified-regression.test.tsx`
Expected: PASS

- [ ] **Step 5: Run focused verification suite**

Run: `npm test -- --run src/lib/ai/__tests__/unified-task-types.test.ts src/lib/ai/__tests__/task-registry.test.ts src/lib/ai/__tests__/task-context.test.ts src/lib/ai/__tests__/task-config-resolver.test.ts src/lib/ai/__tests__/task-patcher.test.ts src/lib/ai/__tests__/unified-agent.test.ts src/app/api/__tests__/unified-chat-route.test.ts src/components/chat/__tests__/task-config-card.test.tsx src/components/chat/__tests__/message-bubble-task-cards.test.tsx src/components/chat/__tests__/chat-area-unified-regression.test.tsx`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/ai/__tests__/test-agent-prompt.test.ts src/lib/ai/__tests__/test-runner-routing.test.ts src/components/chat/__tests__/chat-area-unified-regression.test.tsx
git commit -m "test: cover unified agent rollout regressions"
```

---

Plan complete and saved to `docs/superpowers/plans/2026-04-21-unified-platform-agent.md`. Ready to execute?
