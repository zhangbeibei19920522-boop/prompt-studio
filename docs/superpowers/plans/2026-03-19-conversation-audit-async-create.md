# Conversation Audit Async Create Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make conversation-audit job creation return quickly while parsing uploaded files asynchronously in the background.

**Architecture:** Introduce a `parsing` job status plus a background parse service that reads job-scoped temp uploads, writes parsed audit data, and transitions the job to `draft` or `failed`. Update the create route to persist uploads and return immediately, and update the detail UI to poll while parsing and disable actions until parsing finishes.

**Tech Stack:** Next.js App Router, React, TypeScript, better-sqlite3, Vitest, Node fs/path

---

## Chunk 1: Lock the new parsing lifecycle in tests

### Task 1: Add failing route and UI tests for async create

**Files:**
- Modify: `src/app/api/__tests__/conversation-audit-jobs-route.test.ts`
- Modify: `src/components/audit/__tests__/conversation-audit-detail.test.tsx`

- [ ] **Step 1: Write the failing route test**

Add a test proving create now returns a job in `parsing` state before parsed conversations/turns are available.

- [ ] **Step 2: Write the failing UI test**

Add a test proving the detail view shows a parsing message and disables run/export/filter actions while the job status is `parsing`.

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm run test:run -- src/app/api/__tests__/conversation-audit-jobs-route.test.ts src/components/audit/__tests__/conversation-audit-detail.test.tsx`
Expected: FAIL because the current route is synchronous and the UI has no parsing state.

## Chunk 2: Add backend async-create infrastructure

### Task 2: Introduce parsing status and background parse service

**Files:**
- Modify: `src/types/database.ts`
- Modify: `src/components/audit/conversation-audit-detail.tsx`
- Modify: `src/lib/db/repositories/conversation-audit-jobs.ts`
- Create: `src/lib/audit/job-upload-storage.ts`
- Create: `src/lib/audit/job-parser.ts`
- Test: `src/app/api/__tests__/conversation-audit-jobs-route.test.ts`

- [ ] **Step 1: Add `parsing` status to types and status-label helpers**

Update the job status union and UI label/variant logic to understand `parsing`.

- [ ] **Step 2: Add upload persistence helpers**

Implement job-scoped temp storage helpers that save uploaded files under `data/conversation-audit-jobs/<jobId>/uploads` and clean them up after parsing.

- [ ] **Step 3: Extract synchronous parse logic into a reusable parser service**

Move current create-route parsing/write behavior into a dedicated service function that accepts a job id and persisted uploads.

- [ ] **Step 4: Update create route to return immediately**

Create the job in `parsing`, persist uploads, fire the parser service asynchronously, and return the new job with empty conversations/turns.

- [ ] **Step 5: Run focused tests**

Run: `npm run test:run -- src/app/api/__tests__/conversation-audit-jobs-route.test.ts`
Expected: PASS

## Chunk 3: Update detail UI for parsing state

### Task 3: Poll while parsing and disable actions

**Files:**
- Modify: `src/components/audit/conversation-audit-detail.tsx`
- Modify: `src/app/(main)/page.tsx`
- Test: `src/components/audit/__tests__/conversation-audit-detail.test.tsx`

- [ ] **Step 1: Add parsing-state presentation**

Show a parsing message, surface parse failure text when present, and disable actions that require parsed data.

- [ ] **Step 2: Add polling until parsing completes**

After creation or refresh, keep fetching detail while the job is `parsing`, then stop when the status changes.

- [ ] **Step 3: Run focused tests**

Run: `npm run test:run -- src/components/audit/__tests__/conversation-audit-detail.test.tsx`
Expected: PASS

## Chunk 4: Verify the full flow

### Task 4: Run verification

**Files:**
- Modify: none

- [ ] **Step 1: Run related tests**

Run: `npm run test:run -- src/app/api/__tests__/conversation-audit-jobs-route.test.ts src/app/api/__tests__/conversation-audit-run-route.test.ts src/components/audit/__tests__/conversation-audit-detail.test.tsx`
Expected: PASS

- [ ] **Step 2: Lint touched files**

Run: `npm run lint -- src/app/api/projects/[id]/conversation-audit-jobs/route.ts src/app/(main)/page.tsx src/components/audit/conversation-audit-detail.tsx src/app/api/__tests__/conversation-audit-jobs-route.test.ts src/components/audit/__tests__/conversation-audit-detail.test.tsx src/lib/audit/job-upload-storage.ts src/lib/audit/job-parser.ts src/types/database.ts src/lib/db/repositories/conversation-audit-jobs.ts`
Expected: PASS
