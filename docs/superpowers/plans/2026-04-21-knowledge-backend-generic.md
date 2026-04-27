# Knowledge Backend Generic Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a generic backend-only knowledge automation pipeline with persistent knowledge entities, generic task execution, artifact generation, and version publish flows.

**Architecture:** Add SQLite-backed knowledge entities plus a TypeScript builder service that converts project documents and task input into generic `parents/chunks` artifacts. Keep tenant-specific logic in config-shaped profile data and keep repair as a separate extension point.

**Tech Stack:** Next.js route handlers, TypeScript, better-sqlite3, Vitest, filesystem JSONL artifacts

---

### Task 1: Add Knowledge Types And Schema

**Files:**
- Modify: `src/types/database.ts`
- Modify: `src/types/api.ts`
- Modify: `src/lib/db/schema.sql`
- Test: `src/lib/db/__tests__/knowledge-schema.test.ts`

- [ ] **Step 1: Write the failing schema test**

Create a Vitest file that opens a temp database and asserts the six knowledge tables exist.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run src/lib/db/__tests__/knowledge-schema.test.ts`
Expected: FAIL because the tables are missing.

- [ ] **Step 3: Add knowledge TypeScript types and SQL tables**

Define database and API types for knowledge bases, tasks, versions, parents, chunks, index versions, task input, and stage summaries. Extend `schema.sql` with the new tables and indexes.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --run src/lib/db/__tests__/knowledge-schema.test.ts`
Expected: PASS.

### Task 2: Add Repositories And Artifact Storage

**Files:**
- Create: `src/lib/db/repositories/knowledge-bases.ts`
- Create: `src/lib/db/repositories/knowledge-build-tasks.ts`
- Create: `src/lib/db/repositories/knowledge-versions.ts`
- Create: `src/lib/db/repositories/knowledge-index-versions.ts`
- Create: `src/lib/knowledge/storage.ts`
- Test: `src/lib/db/__tests__/knowledge-repositories.test.ts`

- [ ] **Step 1: Write the failing repository test**

Cover create/find/update flows and artifact path generation.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run src/lib/db/__tests__/knowledge-repositories.test.ts`
Expected: FAIL because repositories do not exist.

- [ ] **Step 3: Implement repositories and storage helpers**

Use the existing repository style with row mappers, JSON parsing, and timestamp updates.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --run src/lib/db/__tests__/knowledge-repositories.test.ts`
Expected: PASS.

### Task 3: Build Generic Knowledge Pipeline

**Files:**
- Create: `src/lib/knowledge/profile.ts`
- Create: `src/lib/knowledge/builder.ts`
- Test: `src/lib/knowledge/__tests__/builder.test.ts`

- [ ] **Step 1: Write the failing builder test**

Cover a generic batch/manual/repair task input producing stage summaries plus persisted parent/chunk payloads.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run src/lib/knowledge/__tests__/builder.test.ts`
Expected: FAIL because the builder does not exist.

- [ ] **Step 3: Implement the generic builder**

Add a default `generic_customer_service` profile, generic normalization, routing, merge/conflict checks, stage summaries, and parent/chunk generation.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --run src/lib/knowledge/__tests__/builder.test.ts`
Expected: PASS.

### Task 4: Add Knowledge API Routes

**Files:**
- Create: `src/app/api/projects/[id]/knowledge-base/route.ts`
- Create: `src/app/api/projects/[id]/knowledge-build-tasks/route.ts`
- Create: `src/app/api/projects/[id]/knowledge-versions/route.ts`
- Create: `src/app/api/projects/[id]/knowledge-index-versions/route.ts`
- Create: `src/app/api/knowledge-build-tasks/[id]/route.ts`
- Create: `src/app/api/knowledge-versions/[id]/route.ts`
- Create: `src/app/api/knowledge-versions/[id]/push-stg/route.ts`
- Create: `src/app/api/knowledge-versions/[id]/push-prod/route.ts`
- Create: `src/app/api/knowledge-versions/[id]/rollback/route.ts`
- Test: `src/app/api/__tests__/knowledge-routes.test.ts`

- [ ] **Step 1: Write the failing route test**

Cover create knowledge base, create build task, inspect detail, push STG, push PROD, rollback.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run src/app/api/__tests__/knowledge-routes.test.ts`
Expected: FAIL because the routes do not exist.

- [ ] **Step 3: Implement the route handlers**

Follow the existing API style: validate input, call repositories/services, return `{ success, data, error }`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --run src/app/api/__tests__/knowledge-routes.test.ts`
Expected: PASS.

### Task 5: Verify End-To-End Behavior

**Files:**
- Modify: any touched files from prior tasks

- [ ] **Step 1: Run the focused knowledge test suite**

Run: `npm test -- --run src/lib/db/__tests__/knowledge-schema.test.ts src/lib/db/__tests__/knowledge-repositories.test.ts src/lib/knowledge/__tests__/builder.test.ts src/app/api/__tests__/knowledge-routes.test.ts`
Expected: PASS.

- [ ] **Step 2: Run a broader regression slice**

Run: `npm test -- --run src/app/api/__tests__/test-suites-route.test.ts src/app/api/__tests__/conversation-audit-jobs-route.test.ts`
Expected: PASS, proving the new schema and repository changes did not break neighboring systems.

- [ ] **Step 3: Review diff for frontend isolation**

Run: `git diff -- src/components src/app/(main)`
Expected: no intentional frontend behavior changes for this task.
