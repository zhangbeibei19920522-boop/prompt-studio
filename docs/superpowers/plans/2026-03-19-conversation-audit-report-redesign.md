# Conversation Audit Report Redesign Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign conversation audit into a report-style workspace that shows task-level pass rates, per-conversation evaluation summaries, conversation-level process compliance results, turn-level knowledge QA findings, and task deletion.

**Architecture:** Keep the existing audit job workflow, but extend persistence and APIs with conversation-level evaluation summaries plus process-step results. Split the frontend away from the current single-file card list into report sections: overview metrics, conversation evaluation list, and selected-conversation detail with separate process and knowledge panels. Preserve turn-level knowledge evaluation while adding a new conversation-level process evaluation pass that uses the same uploaded knowledge base.

**Tech Stack:** Next.js App Router, TypeScript, better-sqlite3, existing AI provider abstraction, existing conversation audit APIs, Vitest, React client components, `xlsx` export.

---

## Chunk 1: Data Model And Evaluation Pipeline

### Task 1: Add the failing tests for conversation-level audit summaries

**Files:**
- Modify: `src/types/database.ts`
- Modify: `src/types/api.ts`
- Test: `src/app/api/__tests__/conversation-audit-jobs-route.test.ts`
- Test: `src/app/api/__tests__/conversation-audit-run-route.test.ts`

- [ ] **Step 1: Extend the route tests with the new expected payload shape**

Add assertions for:

- job-level metrics: `conversationPassCount`, `processPassCount`, `knowledgePassCount`, `highRiskConversationCount`
- conversation-level fields: `overallStatus`, `processStatus`, `knowledgeStatus`, `riskLevel`, `summary`
- conversation detail fields: `processSteps`

- [ ] **Step 2: Run the API tests to verify they fail**

Run: `npm run test:run -- src/app/api/__tests__/conversation-audit-jobs-route.test.ts src/app/api/__tests__/conversation-audit-run-route.test.ts`

Expected:

- failing assertions because the new fields are missing

- [ ] **Step 3: Add the new types**

Update `src/types/database.ts` with:

- `ConversationAuditConversationOverallStatus`
- `ConversationAuditConversationProcessStatus`
- `ConversationAuditConversationKnowledgeStatus`
- `ConversationAuditConversationRiskLevel`
- `ConversationAuditProcessStepResult`

Extend:

- `ConversationAuditJob`
- `ConversationAuditConversation`
- `ConversationAuditTurn`

Update `src/types/api.ts` for the expanded detail payload.

- [ ] **Step 4: Re-run the API tests and confirm they still fail on implementation, not on type mismatches**

Run the same command.

Expected:

- tests compile and fail because persistence/logic is not implemented yet

- [ ] **Step 5: Commit**

```bash
git add src/types/database.ts src/types/api.ts src/app/api/__tests__/conversation-audit-jobs-route.test.ts src/app/api/__tests__/conversation-audit-run-route.test.ts
git commit -m "test: define expanded conversation audit result contract"
```

### Task 2: Persist conversation-level evaluation results

**Files:**
- Modify: `src/lib/db/schema.sql`
- Modify: `src/lib/db/repositories/conversation-audit-conversations.ts`
- Test: `src/lib/db/__tests__/conversation-audit-repositories.test.ts`

- [ ] **Step 1: Add failing repository tests**

Add coverage for:

- storing conversation-level overall/process/knowledge/risk statuses
- storing summary text
- storing serialized process step results
- reading these fields back in list order

- [ ] **Step 2: Run the repository tests to verify failure**

Run: `npm run test:run -- src/lib/db/__tests__/conversation-audit-repositories.test.ts`

Expected:

- failure because the schema and repository mappings do not support the new fields

- [ ] **Step 3: Update persistence minimally**

Modify `src/lib/db/schema.sql`:

- add columns to `conversation_audit_conversations` for:
  - `overall_status`
  - `process_status`
  - `knowledge_status`
  - `risk_level`
  - `summary`
  - `process_steps_json`

Modify `src/lib/db/repositories/conversation-audit-conversations.ts`:

- map the new columns to typed fields
- allow `replaceAuditConversations` to write initial defaults
- add an update function for conversation-level evaluation results

- [ ] **Step 4: Re-run repository tests**

Run: `npm run test:run -- src/lib/db/__tests__/conversation-audit-repositories.test.ts`

Expected:

- PASS for the new conversation fields

- [ ] **Step 5: Commit**

```bash
git add src/lib/db/schema.sql src/lib/db/repositories/conversation-audit-conversations.ts src/lib/db/__tests__/conversation-audit-repositories.test.ts
git commit -m "feat: persist conversation-level audit summaries"
```

### Task 3: Add conversation-level process evaluation tests

**Files:**
- Create: `src/lib/audit/process-evaluator.ts`
- Test: `src/lib/audit/__tests__/process-evaluator.test.ts`
- Modify: `src/lib/audit/runner.ts`

- [ ] **Step 1: Write failing unit tests for process evaluation**

Create tests for:

- process pass when all required steps are found in the conversation
- process fail when a required step is missing
- process fail when a step is reached but the content is incorrect
- generated step results include step name, status, summary, and source file names

- [ ] **Step 2: Run the unit tests to verify failure**

Run: `npm run test:run -- src/lib/audit/__tests__/process-evaluator.test.ts`

Expected:

- failure because `process-evaluator.ts` does not exist yet

- [ ] **Step 3: Implement minimal process evaluation**

Create `src/lib/audit/process-evaluator.ts` with helpers that:

- identify likely process chunks from the uploaded knowledge chunks
- ask the LLM to summarize the process into step checks for the current conversation
- evaluate the full conversation transcript against those step checks
- return:
  - `processStatus`
  - `processSteps`
  - `summary`

Keep it minimal:

- derive process evidence from the existing knowledge chunks
- do not introduce a separate template authoring system

Modify `src/lib/audit/runner.ts` to:

- build a full conversation transcript from the job turns
- run process evaluation once per conversation
- persist the conversation-level result

- [ ] **Step 4: Re-run the process evaluator tests**

Run: `npm run test:run -- src/lib/audit/__tests__/process-evaluator.test.ts`

Expected:

- PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/audit/process-evaluator.ts src/lib/audit/__tests__/process-evaluator.test.ts src/lib/audit/runner.ts
git commit -m "feat: add conversation-level process evaluation"
```

### Task 4: Recompute task-level summary metrics from conversation results

**Files:**
- Modify: `src/lib/db/repositories/conversation-audit-jobs.ts`
- Modify: `src/lib/audit/runner.ts`
- Test: `src/app/api/__tests__/conversation-audit-run-route.test.ts`

- [ ] **Step 1: Add failing run-route assertions for summary metrics**

Assert after a completed run:

- `conversationPassCount`
- `processPassCount`
- `knowledgePassCount`
- `highRiskConversationCount`

- [ ] **Step 2: Run the run-route test**

Run: `npm run test:run -- src/app/api/__tests__/conversation-audit-run-route.test.ts`

Expected:

- failure because the job summary metrics are not updated

- [ ] **Step 3: Implement job summary aggregation**

Modify `src/lib/db/repositories/conversation-audit-jobs.ts` and `src/lib/audit/runner.ts` to:

- count conversation-level pass/fail results after the run completes
- store the new summary counters on the job
- keep `issueCount` and `totalTurns` for backward compatibility until the UI no longer needs them

- [ ] **Step 4: Re-run the run-route test**

Run: `npm run test:run -- src/app/api/__tests__/conversation-audit-run-route.test.ts`

Expected:

- PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/db/repositories/conversation-audit-jobs.ts src/lib/audit/runner.ts src/app/api/__tests__/conversation-audit-run-route.test.ts
git commit -m "feat: aggregate audit report metrics by conversation"
```

## Chunk 2: APIs, Deletion, And Report UI

### Task 5: Add delete-task support end to end

**Files:**
- Modify: `src/lib/db/repositories/conversation-audit-jobs.ts`
- Create: `src/app/api/conversation-audit-jobs/[id]/route.ts`
- Modify: `src/lib/utils/api-client.ts`
- Test: `src/app/api/__tests__/conversation-audit-jobs-route.test.ts`

- [ ] **Step 1: Add the failing delete test**

Add a route test that:

- creates a job with conversations, turns, and knowledge chunks
- calls `DELETE /api/conversation-audit-jobs/[id]`
- verifies the job and related rows are removed

- [ ] **Step 2: Run the route test**

Run: `npm run test:run -- src/app/api/__tests__/conversation-audit-jobs-route.test.ts`

Expected:

- failure because delete is not implemented

- [ ] **Step 3: Implement delete support**

Update `src/lib/db/repositories/conversation-audit-jobs.ts`:

- add `deleteConversationAuditJob(id)`

Update `src/app/api/conversation-audit-jobs/[id]/route.ts`:

- keep `GET`
- add `DELETE`

Update `src/lib/utils/api-client.ts`:

- add `conversationAuditJobsApi.delete(id)`

Rely on DB cascade deletes for child rows.

- [ ] **Step 4: Re-run the delete test**

Run: `npm run test:run -- src/app/api/__tests__/conversation-audit-jobs-route.test.ts`

Expected:

- PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/db/repositories/conversation-audit-jobs.ts src/app/api/conversation-audit-jobs/[id]/route.ts src/lib/utils/api-client.ts src/app/api/__tests__/conversation-audit-jobs-route.test.ts
git commit -m "feat: add conversation audit job deletion"
```

### Task 6: Split the current audit detail component into report-focused sections

**Files:**
- Modify: `src/components/audit/conversation-audit-detail.tsx`
- Create: `src/components/audit/conversation-audit-report-overview.tsx`
- Create: `src/components/audit/conversation-audit-conversation-list.tsx`
- Create: `src/components/audit/conversation-audit-conversation-detail.tsx`
- Test: `src/components/audit/__tests__/conversation-audit-detail.test.tsx`

- [ ] **Step 1: Add failing component tests for the new report layout**

Cover:

- the overview metrics render conversation-level pass rates
- the conversation list renders one row per conversation
- clicking a conversation shows separate process and knowledge sections
- the empty state still works when there is no selected conversation

- [ ] **Step 2: Run the component tests**

Run: `npm run test:run -- src/components/audit/__tests__/conversation-audit-detail.test.tsx`

Expected:

- failure because the current component only renders turn cards

- [ ] **Step 3: Refactor the UI into focused components**

Create `src/components/audit/conversation-audit-report-overview.tsx`:

- task-level metrics cards
- compact risk summary area

Create `src/components/audit/conversation-audit-conversation-list.tsx`:

- per-conversation evaluation list
- filters for all / failed / process / knowledge

Create `src/components/audit/conversation-audit-conversation-detail.tsx`:

- process section
- knowledge issue section
- source file badges

Modify `src/components/audit/conversation-audit-detail.tsx`:

- preserve create flow
- use the new report components for the result state
- add delete action with confirmation

- [ ] **Step 4: Re-run the component tests**

Run: `npm run test:run -- src/components/audit/__tests__/conversation-audit-detail.test.tsx`

Expected:

- PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/audit/conversation-audit-detail.tsx src/components/audit/conversation-audit-report-overview.tsx src/components/audit/conversation-audit-conversation-list.tsx src/components/audit/conversation-audit-conversation-detail.tsx src/components/audit/__tests__/conversation-audit-detail.test.tsx
git commit -m "feat: redesign conversation audit results as report workspace"
```

### Task 7: Update main page state wiring for selection and deletion

**Files:**
- Modify: `src/app/(main)/page.tsx`
- Test: `src/app/__tests__/main-page-audit-state.test.ts`

- [ ] **Step 1: Add failing state-management tests**

Cover:

- selecting a conversation audit job loads report data
- deleting the selected job clears the current selection
- create mode remains intact after the refactor

- [ ] **Step 2: Run the state tests**

Run: `npm run test:run -- src/app/__tests__/main-page-audit-state.test.ts`

Expected:

- failure because the current state model does not handle delete/reset paths

- [ ] **Step 3: Implement the page wiring**

Modify `src/app/(main)/page.tsx` to:

- keep the selected job and its detail data in sync after deletion
- refresh the job list after delete
- keep create mode and job selection transitions predictable

- [ ] **Step 4: Re-run the state tests**

Run: `npm run test:run -- src/app/__tests__/main-page-audit-state.test.ts`

Expected:

- PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/(main)/page.tsx src/app/__tests__/main-page-audit-state.test.ts
git commit -m "fix: keep audit report state consistent after selection changes"
```

### Task 8: Expand export to match the report model

**Files:**
- Modify: `src/app/api/conversation-audit-jobs/[id]/export/route.ts`
- Test: `src/app/api/__tests__/conversation-audit-run-route.test.ts`

- [ ] **Step 1: Add failing export assertions**

Verify the workbook contains:

- `Summary`
- `Conversation Details`

and that rows include:

- conversation-level statuses
- summaries
- process step summaries
- knowledge issue details with source names

- [ ] **Step 2: Run the export test**

Run: `npm run test:run -- src/app/api/__tests__/conversation-audit-run-route.test.ts`

Expected:

- failure because export still writes a turn-only sheet

- [ ] **Step 3: Implement the new export shape**

Modify `src/app/api/conversation-audit-jobs/[id]/export/route.ts`:

- build a summary sheet from job-level metrics
- build a conversation detail sheet from conversation-level and turn-level results
- optionally keep a turn-level sheet only if it adds value for debugging

- [ ] **Step 4: Re-run the export test**

Run: `npm run test:run -- src/app/api/__tests__/conversation-audit-run-route.test.ts`

Expected:

- PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/api/conversation-audit-jobs/[id]/export/route.ts src/app/api/__tests__/conversation-audit-run-route.test.ts
git commit -m "feat: export conversation audit report summary and details"
```

---

Plan complete and saved to `docs/superpowers/plans/2026-03-19-conversation-audit-report-redesign.md`. Ready to execute?
