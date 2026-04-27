# Test Suite Generation Document Route Mode Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add per-document `R / 非 R` classification to configured test suite generation, persist hidden source metadata on generated cases, and enforce routing intent constraints without leaking route-mode labels into real execution input.

**Architecture:** Keep the existing source picker and `generationSourceIds` flow, then layer a document-only route-mode config beside it. The backend validates that config, passes it to the generation agent as system-level constraints, persists case provenance metadata, and uses it to validate generated `expectedIntent` only where routing semantics apply.

**Tech Stack:** TypeScript, React, Next.js route handlers, Vitest, better-sqlite3, existing test-suite generation agent pipeline

---

## File Structure

- Modify: `src/types/api.ts`
  - Add `generationDocumentRouteModes` to the configured suite generation request type.
- Modify: `src/types/database.ts`
  - Add `TestCaseGenerationMetadata`.
  - Add `generationMetadata` to `TestCase`.
- Modify: `src/lib/db/index.ts`
  - Add `generation_metadata_json` column to `test_cases` with migration guard.
- Modify: `src/lib/db/repositories/test-cases.ts`
  - Read/write the new JSON metadata field.
- Modify: `src/components/test/test-suite-config-drawer.tsx`
  - Add document route-mode state, summary, dialog controls, and submit payload support.
- Modify: `src/components/test/__tests__/test-suite-config-drawer.test.tsx`
  - Cover document route-mode UI, defaults, cleanup, and summary copy.
- Modify: `src/app/api/projects/[id]/test-suites/generate/route.ts`
  - Validate `generationDocumentRouteModes`.
- Modify: `src/lib/test-suite-generation/configured-generation.ts`
  - Add request helpers for document-route validation and generation content assembly.
- Modify: `src/lib/test-suite-generation/run-configured-suite-generation.ts`
  - Thread document route-mode config into agent generation and case persistence.
- Modify: `src/lib/ai/test-agent-prompt.ts`
  - Add structured instructions for document route-mode constrained generation.
- Modify: `src/types/ai.ts`
  - Extend generated batch case shape with `sourceDocumentId`.
- Modify: `src/lib/test-suite-generation/enrich-generated-cases.ts`
  - Preserve `generationMetadata` when enriching generated outputs.
- Modify: `src/app/api/test-suites/[id]/regenerate-expected-outputs/route.ts`
  - Keep regeneration behavior compatible with persisted case metadata.
- Modify: `src/app/api/test-suites/[id]/cases/route.ts`
  - Return and accept `generationMetadata` where appropriate.
- Modify: `src/app/api/__tests__/test-suites-route.test.ts`
  - Add API-level validation and persistence tests.
- Modify: `src/lib/test-suite-generation/__tests__/configured-generation.test.ts`
  - Test request validation/content generation helpers.

## Chunk 1: Request and Persistence Contract

### Task 1: Add failing request typing tests

**Files:**
- Modify: `src/lib/test-suite-generation/__tests__/configured-generation.test.ts`
- Test: `src/lib/test-suite-generation/__tests__/configured-generation.test.ts`

- [ ] **Step 1: Add a failing test for document route-mode validation**

```ts
it('rejects selected documents without route-mode config', () => {
  expect(() =>
    validateGenerationDocumentRouteModes({
      generationSourceIds: ['document:doc-a', 'prompt:prompt-a'],
      generationDocumentRouteModes: [],
    }),
  ).toThrow('Each selected document must declare a route mode')
})
```

- [ ] **Step 2: Add a failing test for duplicate or unknown document IDs**

```ts
it('rejects duplicate or unselected document route-mode entries', () => {
  expect(() =>
    validateGenerationDocumentRouteModes({
      generationSourceIds: ['document:doc-a'],
      generationDocumentRouteModes: [
        { documentId: 'doc-a', routeMode: 'rag' },
        { documentId: 'doc-a', routeMode: 'non-r' },
      ],
    }),
  ).toThrow('Duplicate document route mode')
})
```

- [ ] **Step 3: Run the helper test**

Run: `npm run test:run -- src/lib/test-suite-generation/__tests__/configured-generation.test.ts`

Expected: FAIL because the helper and new type do not exist yet.

### Task 2: Add API and database types

**Files:**
- Modify: `src/types/api.ts`
- Modify: `src/types/database.ts`
- Test: `src/lib/test-suite-generation/__tests__/configured-generation.test.ts`

- [ ] **Step 1: Add the generation request field**

```ts
generationDocumentRouteModes: Array<{
  documentId: string
  routeMode: 'rag' | 'non-r'
}>
```

- [ ] **Step 2: Add case metadata types**

```ts
export interface TestCaseGenerationMetadata {
  sourceDocumentId: string | null
  sourceDocumentName: string | null
  sourceRouteMode: 'rag' | 'non-r' | null
}
```

- [ ] **Step 3: Attach metadata to `TestCase`**

```ts
generationMetadata?: TestCaseGenerationMetadata | null
```

- [ ] **Step 4: Re-run the helper test**

Run: `npm run test:run -- src/lib/test-suite-generation/__tests__/configured-generation.test.ts`

Expected: still FAIL on missing validation implementation, but compile with the new types.

### Task 3: Persist generation metadata on test cases

**Files:**
- Modify: `src/lib/db/index.ts`
- Modify: `src/lib/db/repositories/test-cases.ts`
- Modify: `src/lib/db/__tests__/test-suites-routing-schema.test.ts` or nearest repository test

- [ ] **Step 1: Add a failing repository test**

```ts
expect(createdCase.generationMetadata).toEqual({
  sourceDocumentId: 'doc-a',
  sourceDocumentName: '退款政策.docx',
  sourceRouteMode: 'rag',
})
```

- [ ] **Step 2: Add the SQLite column**

Use `ensureColumn()` to add:

```sql
generation_metadata_json TEXT
```

- [ ] **Step 3: Read/write JSON in the repository**

Map:

```ts
generationMetadata: row.generation_metadata_json
  ? JSON.parse(row.generation_metadata_json)
  : null
```

- [ ] **Step 4: Re-run repository tests**

Run: `npm run test:run -- src/lib/db/__tests__/test-suites-routing-schema.test.ts`

Expected: PASS with metadata persisted.

## Chunk 2: Drawer Interaction

### Task 4: Add failing drawer tests for document route modes

**Files:**
- Modify: `src/components/test/__tests__/test-suite-config-drawer.test.tsx`
- Test: `src/components/test/__tests__/test-suite-config-drawer.test.tsx`

- [ ] **Step 1: Add a failing source-picker expectation**

Assert the drawer source includes:

```ts
expect(source).toContain('文档路由归类')
expect(source).toContain('走 R')
expect(source).toContain('走非 R')
```

- [ ] **Step 2: Add a render test for default non-R selection**

Render the drawer with one selected document and assert:

- the document appears in the route-mode section
- the default state is `走非 R`

- [ ] **Step 3: Add a test for cleanup on document deselect**

Assert that removing a document from the selected source list removes its route-mode config from the submitted payload.

- [ ] **Step 4: Run the drawer tests**

Run: `npm run test:run -- src/components/test/__tests__/test-suite-config-drawer.test.tsx`

Expected: FAIL because the controls and payload do not exist yet.

### Task 5: Implement drawer state and summary

**Files:**
- Modify: `src/components/test/test-suite-config-drawer.tsx`
- Test: `src/components/test/__tests__/test-suite-config-drawer.test.tsx`

- [ ] **Step 1: Add local document route-mode state**

Use a document-ID keyed structure:

```ts
const [generationDocumentRouteModes, setGenerationDocumentRouteModes] = useState<
  Array<{ documentId: string; routeMode: 'rag' | 'non-r' }>
>([])
```

- [ ] **Step 2: Sync defaults and cleanup**

Rules:

- selected document defaults to `non-r`
- deselected document is removed from the config

- [ ] **Step 3: Add route-mode controls to the dialog**

Render only for selected documents. Prompt sources remain unchanged.

- [ ] **Step 4: Add summary copy and batch actions**

Support:

- `文档：X 份走 R，Y 份走非 R`
- `已选文档全部标为 R`
- `已选文档全部标为非 R`

- [ ] **Step 5: Include the field in submit payload**

```ts
generationDocumentRouteModes
```

- [ ] **Step 6: Re-run drawer tests**

Run: `npm run test:run -- src/components/test/__tests__/test-suite-config-drawer.test.tsx`

Expected: PASS.

## Chunk 3: Request Validation and Agent Prompting

### Task 6: Implement request validation helpers

**Files:**
- Modify: `src/lib/test-suite-generation/configured-generation.ts`
- Modify: `src/app/api/projects/[id]/test-suites/generate/route.ts`
- Test: `src/lib/test-suite-generation/__tests__/configured-generation.test.ts`
- Test: `src/app/api/__tests__/test-suites-route.test.ts`

- [ ] **Step 1: Add `validateGenerationDocumentRouteModes()`**

Implement:

- selected document extraction from `generationSourceIds`
- duplicate detection
- missing route-mode detection
- unselected document rejection

- [ ] **Step 2: Call the helper from the API route**

Reject bad requests with `400`.

- [ ] **Step 3: Add API tests**

Cover:

- missing route mode for a selected document
- extra route mode for an unselected document
- accepted request with valid `rag` and `non-r` entries

- [ ] **Step 4: Run helper and API tests**

Run: `npm run test:run -- src/lib/test-suite-generation/__tests__/configured-generation.test.ts src/app/api/__tests__/test-suites-route.test.ts`

Expected: PASS.

### Task 7: Extend generation agent prompt and batch schema

**Files:**
- Modify: `src/types/ai.ts`
- Modify: `src/lib/ai/test-agent-prompt.ts`
- Test: `src/lib/ai/__tests__/test-agent-prompt.test.ts`

- [ ] **Step 1: Add `sourceDocumentId` to generated case shape**

```ts
cases: Array<{
  title: string
  context: string
  input: string
  sourceDocumentId?: string | null
  expectedOutput: string
  expectedIntent?: string | null
}>
```

- [ ] **Step 2: Add structured generator instructions**

In routing-aware generation prompt:

- list selected documents and route modes
- require one primary `sourceDocumentId` per generated case when documents are present
- require `expectedIntent = R` for `rag` documents
- require `expectedIntent !== R` for `non-r` documents

- [ ] **Step 3: Add a failing-then-passing prompt test**

Assert the system prompt includes:

- document route-mode summary
- one-primary-document rule
- `rag -> R`
- `non-r -> not R`

- [ ] **Step 4: Run prompt tests**

Run: `npm run test:run -- src/lib/ai/__tests__/test-agent-prompt.test.ts`

Expected: PASS.

## Chunk 4: Generated Case Validation and Persistence

### Task 8: Validate generated case provenance before persistence

**Files:**
- Modify: `src/lib/test-suite-generation/run-configured-suite-generation.ts`
- Modify: `src/lib/test-suite-generation/configured-generation.ts`
- Test: `src/lib/test-suite-generation/__tests__/configured-generation.test.ts`

- [ ] **Step 1: Add a failing validation test for generated cases**

Cover:

- case missing `sourceDocumentId` when document route modes are active
- case with `sourceDocumentId` not in selected docs
- routing case with `rag` doc but non-`R` expected intent
- routing case with `non-r` doc but `expectedIntent = R`

- [ ] **Step 2: Implement a validator**

Recommended helper:

```ts
validateGeneratedCasesAgainstDocumentRouteModes(...)
```

- [ ] **Step 3: Derive `generationMetadata` server-side**

Do not trust the model to emit `sourceRouteMode`.
Look it up from request config.

- [ ] **Step 4: Run the validator tests**

Run: `npm run test:run -- src/lib/test-suite-generation/__tests__/configured-generation.test.ts`

Expected: PASS.

### Task 9: Persist metadata when replacing generated cases

**Files:**
- Modify: `src/lib/test-suite-generation/run-configured-suite-generation.ts`
- Modify: `src/lib/test-suite-generation/enrich-generated-cases.ts`
- Modify: `src/lib/db/repositories/test-cases.ts`
- Test: `src/app/api/__tests__/test-suites-route.test.ts`

- [ ] **Step 1: Thread `generationMetadata` into persisted cases**

Populate:

```ts
generationMetadata: {
  sourceDocumentId,
  sourceDocumentName,
  sourceRouteMode,
}
```

- [ ] **Step 2: Preserve metadata during expected-output enrichment**

Ensure enrichment does not drop `generationMetadata`.

- [ ] **Step 3: Add API persistence assertions**

After generation completes, assert saved cases return metadata alongside `expectedIntent`.

- [ ] **Step 4: Run persistence tests**

Run: `npm run test:run -- src/app/api/__tests__/test-suites-route.test.ts`

Expected: PASS.

## Chunk 5: Display and Regression Safety

### Task 10: Surface generation metadata in case detail

**Files:**
- Modify: `src/components/test/test-suite-detail.tsx`
- Modify: `src/components/test/__tests__/test-suite-detail.test.tsx`

- [ ] **Step 1: Add a failing detail-view test**

Assert case detail can show:

- `来源文档`
- `来源归类`

without modifying the displayed `input`.

- [ ] **Step 2: Implement a compact provenance summary**

Render only when `generationMetadata` exists.

- [ ] **Step 3: Re-run detail tests**

Run: `npm run test:run -- src/components/test/__tests__/test-suite-detail.test.tsx`

Expected: PASS.

### Task 11: Run focused regression suite

**Files:**
- Test: `src/components/test/__tests__/test-suite-config-drawer.test.tsx`
- Test: `src/lib/test-suite-generation/__tests__/configured-generation.test.ts`
- Test: `src/app/api/__tests__/test-suites-route.test.ts`
- Test: `src/lib/ai/__tests__/test-agent-prompt.test.ts`
- Test: `src/components/test/__tests__/test-suite-detail.test.tsx`

- [ ] **Step 1: Run the targeted test suite**

Run:

```bash
npm run test:run -- \
  src/components/test/__tests__/test-suite-config-drawer.test.tsx \
  src/lib/test-suite-generation/__tests__/configured-generation.test.ts \
  src/app/api/__tests__/test-suites-route.test.ts \
  src/lib/ai/__tests__/test-agent-prompt.test.ts \
  src/components/test/__tests__/test-suite-detail.test.tsx
```

Expected: PASS.

- [ ] **Step 2: Run targeted lint on modified files**

Run:

```bash
npm run lint -- \
  src/components/test/test-suite-config-drawer.tsx \
  src/lib/test-suite-generation/configured-generation.ts \
  src/lib/test-suite-generation/run-configured-suite-generation.ts \
  src/lib/ai/test-agent-prompt.ts \
  src/lib/db/repositories/test-cases.ts \
  src/components/test/test-suite-detail.tsx
```

Expected: exit code `0`.

- [ ] **Step 3: Commit**

```bash
git add \
  docs/superpowers/specs/2026-04-23-test-suite-generation-document-route-mode-design.md \
  docs/superpowers/plans/2026-04-23-test-suite-generation-document-route-mode.md \
  src/types/api.ts \
  src/types/database.ts \
  src/lib/db/index.ts \
  src/lib/db/repositories/test-cases.ts \
  src/components/test/test-suite-config-drawer.tsx \
  src/lib/test-suite-generation/configured-generation.ts \
  src/lib/test-suite-generation/run-configured-suite-generation.ts \
  src/lib/ai/test-agent-prompt.ts \
  src/components/test/test-suite-detail.tsx
git commit -m "feat: add document route modes to test generation"
```
