# Conversation Audit Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a new project-level conversation audit module that ingests knowledge-base files plus an external conversation-history Excel, evaluates each `user -> bot` turn against the knowledge base, and outputs only `hasIssue` and `knowledgeAnswer`.

**Architecture:** Keep the module independent from the existing `TestSuite` flow. Parse uploaded files into normalized records, persist audit jobs and per-turn results in dedicated tables, run retrieval + LLM evaluation using global model settings, and surface progress/results through a dedicated UI plus SSE run streaming.

**Tech Stack:** Next.js App Router, TypeScript, better-sqlite3, existing AI provider abstraction, `xlsx` for Excel parsing, `vitest` for unit tests.

---

## Chunk 1: Foundations And Persistence

### Task 1: Add missing dependencies and test harness

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`
- Create: `src/test/setup.ts`

- [ ] **Step 1: Write the failing test command expectation**

Decide the baseline command set that the repo will support:

- `npm run test`
- `npm run test -- --run`

Expected initial state before changes:
- `npm run test` should fail because no script exists yet.

- [ ] **Step 2: Verify the baseline is missing**

Run: `npm run test`
Expected: npm script error such as `Missing script: "test"`.

- [ ] **Step 3: Add minimal test infrastructure**

Update `package.json`:
- add dependency: `xlsx`
- add dev dependency: `vitest`
- add scripts:
  - `"test": "vitest"`
  - `"test:run": "vitest --run"`

Create `vitest.config.ts` with:
- `test.environment = 'node'`
- `test.globals = true`
- `setupFiles = ['src/test/setup.ts']`
- alias `@` -> `src`

Create `src/test/setup.ts` as an empty shared setup file for future DB/test helpers.

- [ ] **Step 4: Verify the harness works**

Run: `npm run test:run`
Expected: Vitest starts successfully and reports `No test files found` or equivalent.

- [ ] **Step 5: Commit**

```bash
git add package.json vitest.config.ts src/test/setup.ts
git commit -m "test: add vitest and xlsx dependencies"
```

### Task 2: Add audit data types and database schema

**Files:**
- Modify: `src/types/database.ts`
- Modify: `src/types/api.ts`
- Modify: `src/lib/db/schema.sql`

- [ ] **Step 1: Write the failing schema/type test**

Create the first schema coverage test file:
- `src/lib/db/__tests__/conversation-audit-schema.test.ts`

Test behavior:
- importing `getDb()` should create the new audit tables
- inserting a minimal row into `conversation_audit_jobs` should succeed

- [ ] **Step 2: Verify the test fails for the right reason**

Run: `npm run test:run -- src/lib/db/__tests__/conversation-audit-schema.test.ts`
Expected: fail because the new tables/types do not exist yet.

- [ ] **Step 3: Add database and API types**

In `src/types/database.ts`, add:
- `ConversationAuditJob`
- `ConversationAuditKnowledgeChunk`
- `ConversationAuditConversation`
- `ConversationAuditTurn`
- `ConversationAuditJobStatus`

Recommended shapes:
- `ConversationAuditJob.status`: `'draft' | 'running' | 'completed' | 'failed'`
- `ConversationAuditTurn.hasIssue`: `boolean | null` until evaluated
- `ConversationAuditTurn.retrievedSources`: array of source descriptors

In `src/types/api.ts`, add:
- `ConversationAuditParseSummary`
- `CreateConversationAuditJobRequest`
- `RunConversationAuditResponse`

Update `src/lib/db/schema.sql` with new tables:
- `conversation_audit_jobs`
- `conversation_audit_knowledge_chunks`
- `conversation_audit_conversations`
- `conversation_audit_turns`

Add indexes:
- `idx_audit_jobs_project`
- `idx_audit_chunks_job`
- `idx_audit_conversations_job`
- `idx_audit_turns_job`
- `idx_audit_turns_conversation`

- [ ] **Step 4: Verify the schema test passes**

Run: `npm run test:run -- src/lib/db/__tests__/conversation-audit-schema.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/types/database.ts src/types/api.ts src/lib/db/schema.sql src/lib/db/__tests__/conversation-audit-schema.test.ts
git commit -m "feat: add conversation audit schema and types"
```

### Task 3: Add audit repositories

**Files:**
- Create: `src/lib/db/repositories/conversation-audit-jobs.ts`
- Create: `src/lib/db/repositories/conversation-audit-knowledge-chunks.ts`
- Create: `src/lib/db/repositories/conversation-audit-conversations.ts`
- Create: `src/lib/db/repositories/conversation-audit-turns.ts`
- Test: `src/lib/db/__tests__/conversation-audit-repositories.test.ts`

- [ ] **Step 1: Write the failing repository tests**

Add tests for:
- creating and fetching an audit job by project
- replacing knowledge chunks for a job
- creating conversations and turns
- updating job status and issue counts
- filtering turns by `hasIssue`

- [ ] **Step 2: Verify the repository tests fail**

Run: `npm run test:run -- src/lib/db/__tests__/conversation-audit-repositories.test.ts`
Expected: fail because the repositories do not exist yet.

- [ ] **Step 3: Implement the repositories**

Follow existing repository style:
- map DB rows to typed objects
- keep JSON columns serialized/deserialized in repository layer
- expose focused functions only

Required functions:

`conversation-audit-jobs.ts`
- `findConversationAuditJobsByProject(projectId)`
- `findConversationAuditJobById(id)`
- `createConversationAuditJob(data)`
- `updateConversationAuditJob(id, data)`

`conversation-audit-knowledge-chunks.ts`
- `replaceKnowledgeChunks(jobId, chunks)`
- `findKnowledgeChunksByJob(jobId)`

`conversation-audit-conversations.ts`
- `replaceAuditConversations(jobId, conversations)`
- `findAuditConversationsByJob(jobId)`

`conversation-audit-turns.ts`
- `replaceAuditTurns(jobId, turns)`
- `findAuditTurnsByJob(jobId, options?)`
- `updateAuditTurnResult(id, result)`

- [ ] **Step 4: Verify the repository tests pass**

Run: `npm run test:run -- src/lib/db/__tests__/conversation-audit-repositories.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/db/repositories/conversation-audit-jobs.ts src/lib/db/repositories/conversation-audit-knowledge-chunks.ts src/lib/db/repositories/conversation-audit-conversations.ts src/lib/db/repositories/conversation-audit-turns.ts src/lib/db/__tests__/conversation-audit-repositories.test.ts
git commit -m "feat: add conversation audit repositories"
```

## Chunk 2: Parsing, Chunking, Retrieval, Evaluation

### Task 4: Extend document parsing for HTML and Excel

**Files:**
- Modify: `src/lib/utils/parse-document.ts`
- Create: `src/lib/utils/parse-html.ts`
- Create: `src/lib/utils/parse-workbook.ts`
- Test: `src/lib/utils/__tests__/parse-document.test.ts`

- [ ] **Step 1: Write the failing parser tests**

Add tests covering:
- `.html` strips tags and keeps visible text
- `.xls/.xlsx` workbook parsing returns readable text with sheet names and rows
- existing `.doc/.docx/.txt` behavior remains intact

- [ ] **Step 2: Verify parser tests fail**

Run: `npm run test:run -- src/lib/utils/__tests__/parse-document.test.ts`
Expected: fail because HTML and Excel parsing are incomplete.

- [ ] **Step 3: Implement minimal parsing**

`src/lib/utils/parse-html.ts`
- export `extractTextFromHtml(html: string): string`
- remove `script/style`
- strip tags
- decode the common entities already handled today

`src/lib/utils/parse-workbook.ts`
- export `parseWorkbookBuffer(buffer: Buffer): string`
- use `xlsx.read(buffer, { type: 'buffer' })`
- iterate sheets in workbook order
- render each sheet as:
  - `Sheet: <name>`
  - row-by-row normalized text

`src/lib/utils/parse-document.ts`
- route `html/htm` to `extractTextFromHtml`
- route `xls/xlsx/csv` to `parseWorkbookBuffer`
- preserve current Word/PDF/text behavior

- [ ] **Step 4: Verify parser tests pass**

Run: `npm run test:run -- src/lib/utils/__tests__/parse-document.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/utils/parse-document.ts src/lib/utils/parse-html.ts src/lib/utils/parse-workbook.ts src/lib/utils/__tests__/parse-document.test.ts
git commit -m "feat: add html and excel document parsing"
```

### Task 5: Parse history Excel into conversations and turns

**Files:**
- Create: `src/lib/audit/history-parser.ts`
- Test: `src/lib/audit/__tests__/history-parser.test.ts`

- [ ] **Step 1: Write the failing history-parser tests**

Test cases:
- rows grouped by `Conversation ID`
- one `user` plus following `bot` rows become one turn
- consecutive `bot` rows merge into one reply
- consecutive `user` rows create a turn with empty `botReply`
- invalid sender rows are reported in parse summary

- [ ] **Step 2: Verify the tests fail**

Run: `npm run test:run -- src/lib/audit/__tests__/history-parser.test.ts`
Expected: fail because the parser module does not exist yet.

- [ ] **Step 3: Implement the parser**

Expose:
- `parseConversationHistoryWorkbook(buffer: Buffer)`

Return shape should include:
- `conversations`
- `turns`
- `summary`

Summary fields:
- `totalRows`
- `validRows`
- `invalidRows`
- `conversationCount`
- `turnCount`
- `errors`

Implementation rules:
- require exact columns `Conversation ID`, `Message Sender`, `Message`
- accept sender values `user` and `bot` only
- preserve source row numbers in parse errors for UI display

- [ ] **Step 4: Verify the tests pass**

Run: `npm run test:run -- src/lib/audit/__tests__/history-parser.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/audit/history-parser.ts src/lib/audit/__tests__/history-parser.test.ts
git commit -m "feat: add conversation history parser"
```

### Task 6: Add knowledge chunking and lightweight retrieval

**Files:**
- Create: `src/lib/audit/knowledge-chunker.ts`
- Create: `src/lib/audit/retriever.ts`
- Test: `src/lib/audit/__tests__/retriever.test.ts`

- [ ] **Step 1: Write the failing retrieval tests**

Test behaviors:
- paragraph text becomes multiple knowledge chunks with source metadata
- workbook-like text with `Sheet:` markers becomes row-oriented chunks
- query terms rank the most relevant chunks first
- retrieval caps results to a small top-N set

- [ ] **Step 2: Verify the retrieval tests fail**

Run: `npm run test:run -- src/lib/audit/__tests__/retriever.test.ts`
Expected: fail because chunking and retrieval modules do not exist yet.

- [ ] **Step 3: Implement minimal chunking and scoring**

`knowledge-chunker.ts`
- split content by paragraph blocks and explicit workbook markers
- emit chunks with:
  - `sourceName`
  - `sourceType`
  - `sheetName`
  - `chunkIndex`
  - `content`

`retriever.ts`
- normalize query and chunk text
- score using:
  - exact term hits
  - token overlap count
  - mild length penalty for very short/noisy chunks
- export `retrieveRelevantKnowledge(chunks, query, limit)`

- [ ] **Step 4: Verify the retrieval tests pass**

Run: `npm run test:run -- src/lib/audit/__tests__/retriever.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/audit/knowledge-chunker.ts src/lib/audit/retriever.ts src/lib/audit/__tests__/retriever.test.ts
git commit -m "feat: add conversation audit retrieval"
```

### Task 7: Add audit evaluator and runner using global settings

**Files:**
- Create: `src/lib/audit/evaluator.ts`
- Create: `src/lib/audit/runner.ts`
- Modify: `src/types/ai.ts`
- Test: `src/lib/audit/__tests__/evaluator.test.ts`
- Test: `src/lib/audit/__tests__/runner.test.ts`

- [ ] **Step 1: Write the failing evaluator and runner tests**

Evaluator tests:
- valid JSON response maps to `{ hasIssue, knowledgeAnswer }`
- malformed JSON falls back to `hasIssue: null` and empty `knowledgeAnswer`
- prompt payload includes retrieved knowledge and bot reply

Runner tests:
- job status changes from `draft` -> `running` -> `completed`
- each turn writes a result
- issue count aggregates correctly
- global settings are used to construct the provider

- [ ] **Step 2: Verify the tests fail**

Run: `npm run test:run -- src/lib/audit/__tests__/evaluator.test.ts src/lib/audit/__tests__/runner.test.ts`
Expected: fail because evaluator and runner do not exist yet.

- [ ] **Step 3: Implement evaluator**

`evaluator.ts`
- mirror the JSON extraction style from `src/lib/ai/test-evaluator.ts`
- system prompt must constrain the model to:
  - use only provided knowledge
  - avoid unsupported claims
  - output:

```json
{
  "hasIssue": true,
  "knowledgeAnswer": "..."
}
```

- [ ] **Step 4: Implement runner**

`runner.ts`
- load global settings via existing settings repository
- create provider with `createAiProvider`
- load job, chunks, and turns
- for each turn:
  - retrieve top knowledge chunks
  - evaluate turn
  - persist result
  - emit streaming progress event
- update final `issueTurns` and status

Add `ConversationAuditRunEvent` to `src/types/ai.ts` with events like:
- `audit-start`
- `audit-turn-start`
- `audit-turn-done`
- `audit-complete`
- `audit-error`

- [ ] **Step 5: Verify the tests pass**

Run: `npm run test:run -- src/lib/audit/__tests__/evaluator.test.ts src/lib/audit/__tests__/runner.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/audit/evaluator.ts src/lib/audit/runner.ts src/types/ai.ts src/lib/audit/__tests__/evaluator.test.ts src/lib/audit/__tests__/runner.test.ts
git commit -m "feat: add conversation audit evaluator and runner"
```

## Chunk 3: API And Client Wiring

### Task 8: Create audit job creation and detail APIs

**Files:**
- Create: `src/app/api/projects/[id]/conversation-audit-jobs/route.ts`
- Create: `src/app/api/conversation-audit-jobs/[id]/route.ts`
- Modify: `src/lib/utils/api-client.ts`
- Test: `src/app/api/__tests__/conversation-audit-jobs-route.test.ts`

- [ ] **Step 1: Write the failing route tests**

Test behaviors:
- creating a job requires `historyFile`
- creating a job parses knowledge files and history file
- GET detail returns job, parse summary, conversations, and turns
- list-by-project returns newest jobs first

- [ ] **Step 2: Verify the route tests fail**

Run: `npm run test:run -- src/app/api/__tests__/conversation-audit-jobs-route.test.ts`
Expected: fail because the routes do not exist yet.

- [ ] **Step 3: Implement creation route**

`POST /api/projects/[id]/conversation-audit-jobs`
- consume `multipart/form-data`
- require:
  - `name`
  - `historyFile`
- optional:
  - `knowledgeFiles[]`
- parse and persist:
  - job
  - knowledge chunks
  - conversations
  - turns
- store parse summary and file names on the job

`GET /api/projects/[id]/conversation-audit-jobs`
- return all jobs for the project

`GET /api/conversation-audit-jobs/[id]`
- return:
  - job
  - conversations
  - turns
  - parse summary

Update `src/lib/utils/api-client.ts` with `conversationAuditJobsApi`.

- [ ] **Step 4: Verify the route tests pass**

Run: `npm run test:run -- src/app/api/__tests__/conversation-audit-jobs-route.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/projects/[id]/conversation-audit-jobs/route.ts src/app/api/conversation-audit-jobs/[id]/route.ts src/lib/utils/api-client.ts src/app/api/__tests__/conversation-audit-jobs-route.test.ts
git commit -m "feat: add conversation audit job APIs"
```

### Task 9: Add run streaming and export APIs

**Files:**
- Create: `src/app/api/conversation-audit-jobs/[id]/run/route.ts`
- Create: `src/app/api/conversation-audit-jobs/[id]/export/route.ts`
- Modify: `src/lib/utils/sse-client.ts`
- Test: `src/app/api/__tests__/conversation-audit-run-route.test.ts`

- [ ] **Step 1: Write the failing tests**

Test behaviors:
- run route streams progress events until completion
- run route marks job failed when settings are incomplete
- export route returns an Excel file payload with headers

- [ ] **Step 2: Verify the tests fail**

Run: `npm run test:run -- src/app/api/__tests__/conversation-audit-run-route.test.ts`
Expected: fail because the routes and SSE client support do not exist yet.

- [ ] **Step 3: Implement run route**

`POST /api/conversation-audit-jobs/[id]/run`
- load job
- create `ReadableStream`
- iterate `runConversationAudit(jobId)`
- emit `data: <json>\n\n` lines like the existing test-run route

Update `src/lib/utils/sse-client.ts`:
- add `streamConversationAuditRun(jobId)`
- parse `ConversationAuditRunEvent`

- [ ] **Step 4: Implement export route**

`GET /api/conversation-audit-jobs/[id]/export`
- load job + turns
- create workbook with one result sheet
- columns:
  - `Conversation ID`
  - `Turn Index`
  - `User Message`
  - `Bot Reply`
  - `Has Issue`
  - `Knowledge Answer`
- return as downloadable `.xlsx`

- [ ] **Step 5: Verify the tests pass**

Run: `npm run test:run -- src/app/api/__tests__/conversation-audit-run-route.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/conversation-audit-jobs/[id]/run/route.ts src/app/api/conversation-audit-jobs/[id]/export/route.ts src/lib/utils/sse-client.ts src/app/api/__tests__/conversation-audit-run-route.test.ts
git commit -m "feat: add conversation audit run and export APIs"
```

## Chunk 4: UI Integration

### Task 10: Add sidebar entry and page state for audit mode

**Files:**
- Modify: `src/components/layout/sidebar.tsx`
- Modify: `src/app/(main)/page.tsx`

- [ ] **Step 1: Write the failing state/unit expectations**

Add a lightweight test file:
- `src/app/__tests__/main-page-audit-state.test.ts`

Coverage:
- page can switch between normal chat, test suite, and audit job views
- sidebar receives audit jobs and current selection state

- [ ] **Step 2: Verify the tests fail**

Run: `npm run test:run -- src/app/__tests__/main-page-audit-state.test.ts`
Expected: fail because audit state is not wired yet.

- [ ] **Step 3: Implement minimal page wiring**

`src/components/layout/sidebar.tsx`
- add optional props:
  - `auditJobs`
  - `currentAuditJobId`
  - `onAuditJobClick`
  - `onNewAuditJob`
- add a new collapsible group labeled `会话质检`

`src/app/(main)/page.tsx`
- add state:
  - `conversationAuditJobs`
  - `currentAuditJobId`
  - `currentAuditJobDetail`
  - `auditMode`
- load jobs when project changes
- add handlers for:
  - create job
  - select job
  - refresh detail

- [ ] **Step 4: Verify the state test passes**

Run: `npm run test:run -- src/app/__tests__/main-page-audit-state.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/layout/sidebar.tsx 'src/app/(main)/page.tsx' src/app/__tests__/main-page-audit-state.test.ts
git commit -m "feat: wire conversation audit page state"
```

### Task 11: Build audit upload and results UI

**Files:**
- Create: `src/components/audit/conversation-audit-upload-dialog.tsx`
- Create: `src/components/audit/conversation-audit-list.tsx`
- Create: `src/components/audit/conversation-audit-detail.tsx`
- Create: `src/components/audit/conversation-audit-results-table.tsx`
- Modify: `src/app/(main)/page.tsx`

- [ ] **Step 1: Write the failing component tests**

Add tests:
- `src/components/audit/__tests__/conversation-audit-detail.test.ts`

Cover:
- parse summary renders counts and errors
- results table defaults to issue-first display
- `only issues` filter hides clean turns
- export button points to the export API

- [ ] **Step 2: Verify the component tests fail**

Run: `npm run test:run -- src/components/audit/__tests__/conversation-audit-detail.test.ts`
Expected: fail because the audit components do not exist yet.

- [ ] **Step 3: Implement the upload dialog**

`conversation-audit-upload-dialog.tsx`
- fields:
  - job name
  - knowledge file multi-upload
  - history Excel single-upload
- submit to `conversationAuditJobsApi.create`
- close and refresh on success

- [ ] **Step 4: Implement list and detail views**

`conversation-audit-list.tsx`
- job rows with name, status, conversations, turns, issues

`conversation-audit-detail.tsx`
- summary cards
- parse errors section
- run button
- export button
- progress banner while running
- result filters:
  - only issues
  - conversation id search

`conversation-audit-results-table.tsx`
- columns:
  - `Conversation ID`
  - `轮次`
  - `用户问题`
  - `Bot 回答`
  - `是否有问题`
  - `原知识库回答`

Page integration:
- when `auditMode` is active, render the audit detail in the main pane instead of chat/test detail
- use `streamConversationAuditRun(jobId)` for progress

- [ ] **Step 5: Verify the component tests pass**

Run: `npm run test:run -- src/components/audit/__tests__/conversation-audit-detail.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/audit/conversation-audit-upload-dialog.tsx src/components/audit/conversation-audit-list.tsx src/components/audit/conversation-audit-detail.tsx src/components/audit/conversation-audit-results-table.tsx 'src/app/(main)/page.tsx' src/components/audit/__tests__/conversation-audit-detail.test.ts
git commit -m "feat: add conversation audit UI"
```

## Chunk 5: Verification

### Task 12: Run automated verification and manual workflow check

**Files:**
- Modify as needed based on failures in any file touched above

- [ ] **Step 1: Run the full automated suite**

Run: `npm run test:run`
Expected: all audit-related tests pass.

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: no lint errors.

- [ ] **Step 3: Run the app and verify the workflow manually**

Run: `npm run dev`

Manual checks:
- create an audit job with:
  - one HTML knowledge file
  - one Word knowledge file
  - one Excel knowledge file
  - one conversation history Excel
- confirm parse summary appears
- start run and verify progress updates
- confirm issue-only filter works
- confirm export downloads `.xlsx`

- [ ] **Step 4: Commit final fixes**

```bash
git add .
git commit -m "feat: complete conversation audit module"
```

## File Map

### New files expected

- `vitest.config.ts`
- `src/test/setup.ts`
- `src/lib/db/__tests__/conversation-audit-schema.test.ts`
- `src/lib/db/__tests__/conversation-audit-repositories.test.ts`
- `src/lib/utils/__tests__/parse-document.test.ts`
- `src/lib/audit/history-parser.ts`
- `src/lib/audit/knowledge-chunker.ts`
- `src/lib/audit/retriever.ts`
- `src/lib/audit/evaluator.ts`
- `src/lib/audit/runner.ts`
- `src/lib/audit/__tests__/history-parser.test.ts`
- `src/lib/audit/__tests__/retriever.test.ts`
- `src/lib/audit/__tests__/evaluator.test.ts`
- `src/lib/audit/__tests__/runner.test.ts`
- `src/lib/utils/parse-html.ts`
- `src/lib/utils/parse-workbook.ts`
- `src/lib/db/repositories/conversation-audit-jobs.ts`
- `src/lib/db/repositories/conversation-audit-knowledge-chunks.ts`
- `src/lib/db/repositories/conversation-audit-conversations.ts`
- `src/lib/db/repositories/conversation-audit-turns.ts`
- `src/app/api/projects/[id]/conversation-audit-jobs/route.ts`
- `src/app/api/conversation-audit-jobs/[id]/route.ts`
- `src/app/api/conversation-audit-jobs/[id]/run/route.ts`
- `src/app/api/conversation-audit-jobs/[id]/export/route.ts`
- `src/app/api/__tests__/conversation-audit-jobs-route.test.ts`
- `src/app/api/__tests__/conversation-audit-run-route.test.ts`
- `src/app/__tests__/main-page-audit-state.test.ts`
- `src/components/audit/conversation-audit-upload-dialog.tsx`
- `src/components/audit/conversation-audit-list.tsx`
- `src/components/audit/conversation-audit-detail.tsx`
- `src/components/audit/conversation-audit-results-table.tsx`
- `src/components/audit/__tests__/conversation-audit-detail.test.ts`

### Existing files expected to change

- `package.json`
- `src/types/database.ts`
- `src/types/api.ts`
- `src/types/ai.ts`
- `src/lib/db/schema.sql`
- `src/lib/utils/parse-document.ts`
- `src/lib/utils/api-client.ts`
- `src/lib/utils/sse-client.ts`
- `src/components/layout/sidebar.tsx`
- `src/app/(main)/page.tsx`

## Risks

- Workbook parsing may produce noisy text if source Excel is heavily merged or formatted; keep first version row-oriented and text-only.
- Route tests that touch `getDb()` must isolate or reset test data to avoid cross-test contamination.
- SSE UI can become noisy if every turn triggers a full detail reload; prefer local incremental state during runs.
- Query-only retrieval is intentionally simple for phase one, so prompt constraints and “insufficient evidence” handling are essential.

Plan complete and saved to `docs/plans/2026-03-18-conversation-audit-implementation.md`. Ready to execute?
