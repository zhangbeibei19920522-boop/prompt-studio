# Routing R Intent RAG Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an `intent = R` routing branch that retrieves from a selected index version, renders `{rag_qas_text}` into a selected Prompt, and generates answers through a generic `generateAnswer()` module that matches `qa_verify` behavior without embedding OPPO-specific rules.

**Architecture:** Keep non-`R` routes on the existing `intent -> prompt` path. Add R-only route fields, index-local ingest artifacts, a generic RAG retrieval/evidence/generation module, and a small R branch in `routing-executor`. The RAG module owns retrieval, candidate selection, evidence assembly, extractive-vs-LLM policy, and Prompt rendering; routing execution only wires route config, Prompt lookup, index lookup, and diagnostics.

**Tech Stack:** TypeScript, Next.js route handlers, Vitest, SQLite repositories, JSONL knowledge artifacts, existing `AiProvider` streaming interface

---

## File Structure

- Modify: `src/types/database.ts`
  - Add R-only route fields.
  - Add optional RAG diagnostics to `TestCaseRoutingStep`.
  - Add `retrievalContract` to `KnowledgeArtifactManifest`.
- Modify: `src/lib/test-suite-routing.ts`
  - Normalize `R` routes separately from non-`R` routes.
  - Enforce `ragPromptId + ragIndexVersionId` completeness for `R`.
- Create: `src/lib/__tests__/test-suite-routing.test.ts`
  - Unit tests for route normalization and completeness.
- Modify: `src/lib/db/__tests__/test-suites-routing-schema.test.ts`
  - Persistence test for `R` route JSON.
- Modify: `src/lib/knowledge/storage.ts`
  - Add index-local `parents.jsonl`, `chunks.jsonl`, and `ingest.json` paths.
- Create: `src/lib/knowledge/index-ingest.ts`
  - Read/write/backfill index-local ingest artifacts.
- Create: `src/lib/knowledge/__tests__/index-ingest.test.ts`
  - Tests for new ingest writes and old-index lazy backfill.
- Modify: `src/lib/knowledge/builder.ts`
  - Emit generic retrieval metadata and `manifest.retrievalContract`.
- Modify: `src/lib/knowledge/__tests__/builder.test.ts`
  - Tests for metadata and manifest contract.
- Modify: `src/lib/knowledge/service.ts`
  - Write index-local ingest artifacts when creating an index version.
- Modify: `src/lib/db/repositories/knowledge-index-versions.ts`
  - Keep current repository shape; only add helper usage if needed.
- Create: `src/lib/ai/rag/types.ts`
  - Shared retrieval, evidence, policy, and generation types.
- Create: `src/lib/ai/rag/text.ts`
  - Generic normalization, lexical overlap, phrase overlap, and anchor scoring.
- Create: `src/lib/ai/rag/retriever.ts`
  - Search top 10 from index-local ingest using exact lookup and lightweight hybrid scoring.
- Create: `src/lib/ai/rag/evidence-assembler.ts`
  - Port generic `qa_verify` candidate selection and chunk assembly behavior.
- Create: `src/lib/ai/rag/answer-generator.ts`
  - Generic `generateAnswer()` orchestration.
- Create: `src/lib/ai/rag/__tests__/retriever.test.ts`
  - Retrieval behavior tests.
- Create: `src/lib/ai/rag/__tests__/evidence-assembler.test.ts`
  - Candidate selection and chunk assembly tests.
- Create: `src/lib/ai/rag/__tests__/answer-generator.test.ts`
  - Extractive and LLM fallback behavior tests.
- Modify: `src/lib/ai/routing-executor.ts`
  - Add the `intent = R` execution branch.
- Modify: `src/lib/ai/test-runner.ts`
  - Thread any new routing options through without changing single-prompt behavior.
- Modify: `src/app/api/test-suites/[id]/run/route.ts`
  - Load `ragPromptId` Prompts for R routes in addition to normal route Prompts.
- Modify: `src/lib/ai/__tests__/routing-executor.test.ts`
  - Integration tests for the R route branch.
- Modify: `src/lib/ai/__tests__/test-runner-routing.test.ts`
  - Runner-level test that result events include RAG diagnostics.
- Modify: `src/components/test/test-routing-config-dialog.tsx`
  - Show R-only Prompt + index version fields and clear hidden fields on intent changes.
- Modify: `src/components/test/__tests__/test-suite-config-drawer.test.tsx` or nearest routing-dialog test file
  - UI validation tests for `R` route configuration.

## Chunk 1: Route Data Contract

### Task 1: Add failing route normalization tests

**Files:**
- Create: `src/lib/__tests__/test-suite-routing.test.ts`
- Test: `src/lib/__tests__/test-suite-routing.test.ts`

- [ ] **Step 1: Write failing tests for non-`R` backward compatibility**

```ts
import {
  isTestSuiteRouteComplete,
  normalizeTestSuiteRoute,
} from '@/lib/test-suite-routing'

describe('test suite routing helpers', () => {
  it('keeps non-R prompt routes on the existing target contract', () => {
    expect(
      normalizeTestSuiteRoute({
        intent: 'refund',
        promptId: 'prompt-refund',
        ragPromptId: 'prompt-rag',
        ragIndexVersionId: 'index-1',
      }),
    ).toEqual({
      intent: 'refund',
      promptId: 'prompt-refund',
      targetType: 'prompt',
      targetId: 'prompt-refund',
    })
  })
})
```

- [ ] **Step 2: Write failing tests for `R` route normalization**

```ts
it('normalizes R routes to ragPromptId and ragIndexVersionId only', () => {
  expect(
    normalizeTestSuiteRoute({
      intent: 'R',
      promptId: 'legacy-prompt',
      targetType: 'prompt',
      targetId: 'legacy-prompt',
      ragPromptId: 'prompt-rag',
      ragIndexVersionId: 'index-1',
    }),
  ).toEqual({
    intent: 'R',
    promptId: '',
    targetType: 'prompt',
    targetId: '',
    ragPromptId: 'prompt-rag',
    ragIndexVersionId: 'index-1',
  })
})

it('requires both rag fields for R routes', () => {
  expect(isTestSuiteRouteComplete(normalizeTestSuiteRoute({
    intent: 'R',
    ragPromptId: 'prompt-rag',
  }))).toBe(false)
  expect(isTestSuiteRouteComplete(normalizeTestSuiteRoute({
    intent: 'R',
    ragPromptId: 'prompt-rag',
    ragIndexVersionId: 'index-1',
  }))).toBe(true)
})
```

- [ ] **Step 3: Run the tests and confirm they fail**

Run: `npm run test:run -- src/lib/__tests__/test-suite-routing.test.ts`

Expected: FAIL because `ragPromptId` / `ragIndexVersionId` are not typed or normalized yet.

### Task 2: Implement route types and helpers

**Files:**
- Modify: `src/types/database.ts`
- Modify: `src/lib/test-suite-routing.ts`
- Test: `src/lib/__tests__/test-suite-routing.test.ts`

- [ ] **Step 1: Add optional R fields to `TestSuiteRoute`**

```ts
export interface TestSuiteRoute {
  intent: string
  promptId: string
  targetType?: TestRoutingTargetType
  targetId?: string
  ragPromptId?: string
  ragIndexVersionId?: string
}
```

- [ ] **Step 2: Add optional RAG diagnostics to `TestCaseRoutingStep`**

```ts
export interface TestCaseRoutingStep {
  turnIndex: number
  userInput: string
  rawIntent?: string | null
  rawIntentOutput?: string | null
  actualIntent: string | null
  matchedPromptId: string | null
  matchedPromptTitle: string | null
  actualReply: string
  routingError?: string | null
  routeMode?: 'prompt' | 'rag'
  ragPromptId?: string | null
  ragIndexVersionId?: string | null
  retrievalTopK?: number | null
  selectedDocId?: string | null
  selectedChunkIds?: string[]
  selectionMargin?: number | null
  answerMode?: 'extractive' | 'llm_fallback' | null
  ingestBackfilled?: boolean
}
```

- [ ] **Step 3: Update `normalizeTestSuiteRoute()`**

Implementation rule:

```ts
if ((route.intent ?? '').trim() === 'R') {
  return {
    intent: 'R',
    promptId: '',
    targetType: 'prompt',
    targetId: '',
    ragPromptId: (route.ragPromptId ?? '').trim(),
    ragIndexVersionId: (route.ragIndexVersionId ?? '').trim(),
  }
}
```

- [ ] **Step 4: Update `isTestSuiteRouteComplete()`**

Implementation rule:

```ts
if (route.intent.trim() === 'R') {
  return Boolean(route.ragPromptId?.trim() && route.ragIndexVersionId?.trim())
}
return route.intent.trim().length > 0 && getTestRouteTargetId(route).trim().length > 0
```

- [ ] **Step 5: Run route helper tests**

Run: `npm run test:run -- src/lib/__tests__/test-suite-routing.test.ts`

Expected: PASS.

### Task 3: Persist R route JSON

**Files:**
- Modify: `src/lib/db/__tests__/test-suites-routing-schema.test.ts`
- Test: `src/lib/db/__tests__/test-suites-routing-schema.test.ts`

- [ ] **Step 1: Add a failing persistence assertion**

Append a route to the existing routing config:

```ts
{
  intent: 'R',
  promptId: '',
  targetType: 'prompt',
  targetId: '',
  ragPromptId: 'prompt-rag',
  ragIndexVersionId: 'index-1',
}
```

Assert `findTestSuiteById()` returns the same R-only fields.

- [ ] **Step 2: Run the DB routing test**

Run: `npm run test:run -- src/lib/db/__tests__/test-suites-routing-schema.test.ts`

Expected: PASS after type/helper updates because `routing_config` is JSON and needs no schema migration.

## Chunk 2: Index-local Ingest and Build Metadata

### Task 4: Add ingest paths

**Files:**
- Modify: `src/lib/knowledge/storage.ts`
- Test: `src/lib/knowledge/__tests__/index-ingest.test.ts`

- [ ] **Step 1: Write a failing path test**

```ts
import { buildKnowledgeArtifactPaths } from '@/lib/knowledge/storage'

it('exposes index-local ingest artifact paths', () => {
  const paths = buildKnowledgeArtifactPaths({
    projectId: 'project-1',
    knowledgeBaseId: 'kb-1',
    knowledgeVersionId: 'version-1',
  })

  expect(paths.indexParentsFilePath).toContain('/indexes/version-1/parents.jsonl')
  expect(paths.indexChunksFilePath).toContain('/indexes/version-1/chunks.jsonl')
  expect(paths.indexIngestFilePath).toContain('/indexes/version-1/ingest.json')
})
```

- [ ] **Step 2: Add the path fields**

Add to `KnowledgeArtifactPaths`:

```ts
indexParentsFilePath: string
indexChunksFilePath: string
indexIngestFilePath: string
```

- [ ] **Step 3: Run the test**

Run: `npm run test:run -- src/lib/knowledge/__tests__/index-ingest.test.ts`

Expected: PASS.

### Task 5: Implement index ingest read/write/backfill

**Files:**
- Create: `src/lib/knowledge/index-ingest.ts`
- Create: `src/lib/knowledge/__tests__/index-ingest.test.ts`
- Modify: `src/lib/knowledge/storage.ts`
- Test: `src/lib/knowledge/__tests__/index-ingest.test.ts`

- [ ] **Step 1: Write failing tests for writing index ingest**

Test shape:

```ts
const result = writeIndexIngestArtifacts({
  paths,
  parents: [{ id: 'parent-1', question_clean: 'How to reset?', question_aliases: [] }],
  chunks: [{ id: 'chunk-1', parent_id: 'parent-1', chunk_text: 'Hold reset.' }],
})

expect(result.backfilled).toBe(false)
expect(fs.existsSync(paths.indexParentsFilePath)).toBe(true)
expect(fs.existsSync(paths.indexChunksFilePath)).toBe(true)
expect(fs.existsSync(paths.indexIngestFilePath)).toBe(true)
```

- [ ] **Step 2: Write failing tests for lazy backfill**

Test shape:

```ts
const result = ensureIndexIngestArtifacts({
  paths,
  sourceParentsFilePath: paths.parentsFilePath,
  sourceChunksFilePath: paths.chunksFilePath,
})

expect(result.backfilled).toBe(true)
expect(result.parents).toHaveLength(1)
expect(result.chunks).toHaveLength(1)
```

- [ ] **Step 3: Implement JSONL helpers**

Implement focused functions:

```ts
export function readJsonLinesFile<T>(filePath: string): T[]
export function writeJsonLinesFile(filePath: string, rows: unknown[]): void
export function writeIndexIngestArtifacts(input: WriteIndexIngestInput): IndexIngestResult
export function ensureIndexIngestArtifacts(input: EnsureIndexIngestInput): IndexIngestResult
```

- [ ] **Step 4: Run ingest tests**

Run: `npm run test:run -- src/lib/knowledge/__tests__/index-ingest.test.ts`

Expected: PASS.

### Task 6: Emit retrieval metadata and manifest contract

**Files:**
- Modify: `src/types/database.ts`
- Modify: `src/lib/knowledge/builder.ts`
- Modify: `src/lib/knowledge/__tests__/builder.test.ts`
- Test: `src/lib/knowledge/__tests__/builder.test.ts`

- [ ] **Step 1: Write failing builder assertions**

Add assertions to existing builder tests:

```ts
expect(artifacts.manifest.retrievalContract).toEqual(
  expect.objectContaining({
    version: 1,
    supportsRagRoute: true,
    supportsEvidenceAssembly: true,
  }),
)
expect(artifacts.parents[0]?.metadata).toEqual(
  expect.objectContaining({
    questionNormalized: expect.any(String),
    questionSignature: expect.any(String),
    isExactFaq: expect.any(Boolean),
  }),
)
expect(artifacts.chunks[0]?.metadata).toEqual(
  expect.objectContaining({
    questionNormalized: expect.any(String),
    chunkKind: expect.any(String),
  }),
)
```

- [ ] **Step 2: Add the manifest type**

```ts
export interface KnowledgeRetrievalContract {
  version: number
  supportsRagRoute: boolean
  supportsEvidenceAssembly: boolean
  enrichedMetadataKeys: string[]
}
```

Add `retrievalContract: KnowledgeRetrievalContract` to `KnowledgeArtifactManifest`.

- [ ] **Step 3: Implement generic metadata enrichment**

Implementation rules:

- `questionNormalized`: normalized `question_clean`.
- `questionAliases`: preserve source aliases when present; otherwise `[]`.
- `isExactFaq`: true for explicit FAQ-like parent records.
- `sourceParentQuestions`: include merged/promoted source questions when available, otherwise `[question_clean]`.
- `chunkKind`: generic label derived from section title and chunk text, with fallback `chunkType || 'faq'`.

- [ ] **Step 4: Run builder tests**

Run: `npm run test:run -- src/lib/knowledge/__tests__/builder.test.ts`

Expected: PASS.

### Task 7: Write ingest when creating index versions

**Files:**
- Modify: `src/lib/knowledge/service.ts`
- Modify: `src/lib/knowledge/__tests__/index-ingest.test.ts`
- Test: `src/lib/knowledge/__tests__/index-ingest.test.ts`

- [ ] **Step 1: Add a failing service-level test**

Use a temp cwd, create a knowledge version with parent/chunk artifacts, call `ensureKnowledgeIndexVersion(versionId)`, and assert:

```ts
expect(fs.existsSync(paths.indexParentsFilePath)).toBe(true)
expect(fs.existsSync(paths.indexChunksFilePath)).toBe(true)
expect(fs.existsSync(paths.indexIngestFilePath)).toBe(true)
```

- [ ] **Step 2: Update `ensureKnowledgeIndexVersion()`**

Implementation rule:

- when creating a new index version, call `ensureIndexIngestArtifacts()`
- when an existing index version is returned, also call `ensureIndexIngestArtifacts()` so old versions get lazy backfill

- [ ] **Step 3: Run ingest/service tests**

Run: `npm run test:run -- src/lib/knowledge/__tests__/index-ingest.test.ts`

Expected: PASS.

## Chunk 3: Generic RAG Modules

### Task 8: Add RAG shared types

**Files:**
- Create: `src/lib/ai/rag/types.ts`
- Test: covered by later RAG tests

- [ ] **Step 1: Define retrieval result types**

```ts
export interface RetrievalChunk {
  chunkId: string
  chunkIndex: number
  chunkKind: string
  sectionTitle: string
  chunkText: string
}

export interface RetrievalResult {
  docId: string
  question: string
  score: number
  rerankScore?: number
  matchLane?: 'exact_alias' | 'hybrid'
  metadata: Record<string, unknown>
  matchedChunks: RetrievalChunk[]
  chunkText?: string
}
```

- [ ] **Step 2: Define answer generation types**

```ts
export interface RagLlmClient {
  generate(messages: ChatMessage[], options?: ChatOptions): Promise<string>
}

export interface GenerateAnswerResult {
  answerText: string
  answerMode: 'extractive' | 'llm_fallback'
  selectedDocId: string | null
  selectedChunkIds: string[]
  selectionMargin: number | null
  evidenceText: string
}
```

### Task 9: Port generic text scoring

**Files:**
- Create: `src/lib/ai/rag/text.ts`
- Create: `src/lib/ai/rag/__tests__/retriever.test.ts`
- Test: `src/lib/ai/rag/__tests__/retriever.test.ts`

- [ ] **Step 1: Write failing text scoring tests**

Assert:

- normalized text removes whitespace and common punctuation
- lexical overlap is higher for related question/content than unrelated content
- phrase overlap gives a bonus for longer shared substrings
- anchor score rewards exact anchors in the candidate question

- [ ] **Step 2: Implement generic text helpers**

Functions:

```ts
export function normalizeText(input: string): string
export function tokenizeText(input: string): string[]
export function lexicalOverlapScore(query: string, candidate: string): number
export function phraseOverlapBonus(query: string, candidate: string): number
export function anchorPhraseScore(query: string, candidate: string): number
```

- [ ] **Step 3: Run retriever tests**

Run: `npm run test:run -- src/lib/ai/rag/__tests__/retriever.test.ts`

Expected: PASS for text helper tests.

### Task 10: Implement local retriever

**Files:**
- Create: `src/lib/ai/rag/retriever.ts`
- Modify: `src/lib/ai/rag/__tests__/retriever.test.ts`
- Test: `src/lib/ai/rag/__tests__/retriever.test.ts`

- [ ] **Step 1: Write failing exact lookup test**

Input:

- parent question: `How do I reset the router?`
- alias: `reset router`
- query: `reset router`

Expected:

- first result has `matchLane = 'exact_alias'`
- first result has higher score than unrelated parent

- [ ] **Step 2: Write failing top 10 test**

Create 12 relevant parents and assert:

```ts
expect(searchIndexIngest({ query, ingest, topK: 10 }).results).toHaveLength(10)
```

- [ ] **Step 3: Implement `searchIndexIngest()`**

Implementation behavior:

- load parent/chunk ingest rows from caller-provided ingest data
- exact lane compares query against `question`, `questionNormalized`, `questionSignature`, and `questionAliases`
- hybrid lane combines lexical overlap, phrase overlap, anchor score, and chunk evidence score
- aggregate chunks by parent document
- return top 10 by default
- preserve matched chunk order

- [ ] **Step 4: Run retriever tests**

Run: `npm run test:run -- src/lib/ai/rag/__tests__/retriever.test.ts`

Expected: PASS.

### Task 11: Implement evidence assembler

**Files:**
- Create: `src/lib/ai/rag/evidence-assembler.ts`
- Create: `src/lib/ai/rag/__tests__/evidence-assembler.test.ts`
- Test: `src/lib/ai/rag/__tests__/evidence-assembler.test.ts`

- [ ] **Step 1: Write failing candidate selection tests**

Cover:

- `selectAnswerCandidate()` prefers exact source when compatible.
- `selectionScoreMargin()` returns `Infinity` when there is only one candidate.
- a scoped mismatch is penalized below a compatible second result.

- [ ] **Step 2: Write failing chunk assembly tests**

Cover:

- duplicate chunk text is removed
- section title is prepended when useful
- exact source with eight or fewer parts keeps all candidate parts
- non-exact source filters to query-relevant chunks
- structurally incomplete assembly returns `null`

- [ ] **Step 3: Implement generic candidate scoring**

Port only generic behavior from `qa_verify/src/answer_assembler.py`:

- base score from `rerankScore` or `score`
- exact source bonus
- question overlap
- content overlap
- anchor phrase score
- generic scope mismatch penalty
- top-N candidate window, default 5

- [ ] **Step 4: Implement `assembleEvidence()`**

Return shape:

```ts
export interface AssembledEvidence {
  text: string
  docId: string
  chunkIds: string[]
}
```

- [ ] **Step 5: Run evidence assembler tests**

Run: `npm run test:run -- src/lib/ai/rag/__tests__/evidence-assembler.test.ts`

Expected: PASS.

### Task 12: Implement generic `generateAnswer()`

**Files:**
- Create: `src/lib/ai/rag/answer-generator.ts`
- Create: `src/lib/ai/rag/__tests__/answer-generator.test.ts`
- Test: `src/lib/ai/rag/__tests__/answer-generator.test.ts`

- [ ] **Step 1: Write failing Prompt placeholder validation test**

```ts
await expect(generateAnswer({
  query: 'reset router',
  recallResults: [],
  promptTemplate: 'Answer from evidence',
  llmClient,
})).rejects.toThrow('{rag_qas_text}')
```

- [ ] **Step 2: Write failing empty recall fallback test**

Assert:

- `llmClient.generate()` is called
- system message contains no evidence after the placeholder replacement
- result has `answerMode = 'llm_fallback'`

- [ ] **Step 3: Write failing extractive success test**

Use a single high-confidence exact result and assert:

- `llmClient.generate()` is not called
- result answer text equals assembled evidence
- `answerMode = 'extractive'`

- [ ] **Step 4: Write failing low-margin LLM fallback test**

Use two close candidates and assert:

- `llmClient.generate()` is called
- result `selectionMargin` is below default threshold
- `answerMode = 'llm_fallback'`

- [ ] **Step 5: Write failing evidence rendering format test**

Assert rendered `evidenceText` includes:

```text
[1] 问题:
文档ID:
召回分数:
匹配片段:
[chunk-id] (chunk-kind) chunk text
```

- [ ] **Step 6: Implement `generateAnswer()`**

Rules:

- require `{rag_qas_text}` in `promptTemplate`
- call `assembleEvidence()` first unless policy disables extractive mode
- call `shouldUseExtractiveAnswer()` with default policy
- if extractive accepted, return assembled text
- otherwise render top 10 recall results into evidence text and call injected `llmClient.generate()`
- do not import provider factories or repositories

- [ ] **Step 7: Run answer generator tests**

Run: `npm run test:run -- src/lib/ai/rag/__tests__/answer-generator.test.ts`

Expected: PASS.

## Chunk 4: Routing Execution

### Task 13: Add R route execution tests

**Files:**
- Modify: `src/lib/ai/__tests__/routing-executor.test.ts`
- Test: `src/lib/ai/__tests__/routing-executor.test.ts`

- [ ] **Step 1: Mock index ingest loading and retrieval**

Mock new module functions:

```ts
vi.doMock('@/lib/knowledge/index-ingest', () => ({
  ensureIndexIngestForVersion: vi.fn(() => ({
    backfilled: true,
    ingest: fakeIngest,
  })),
}))
```

- [ ] **Step 2: Write failing R route test**

Set route:

```ts
routes: [{
  intent: 'R',
  promptId: '',
  targetType: 'prompt',
  targetId: '',
  ragPromptId: 'prompt-rag',
  ragIndexVersionId: 'index-1',
}]
```

Assert:

- entry Prompt returns `R`
- `generateAnswer()` receives `promptTemplate` from `prompt-rag`
- final output is generated answer
- `routingSteps[0].routeMode = 'rag'`
- `routingSteps[0].answerMode` is set
- `routingSteps[0].ingestBackfilled = true`

- [ ] **Step 3: Write failing missing placeholder test**

Assert an R Prompt without `{rag_qas_text}` produces a routing error and no final reply.

- [ ] **Step 4: Run test and confirm failure**

Run: `npm run test:run -- src/lib/ai/__tests__/routing-executor.test.ts`

Expected: FAIL until executor branch exists.

### Task 14: Implement R route branch

**Files:**
- Modify: `src/lib/ai/routing-executor.ts`
- Modify: `src/lib/ai/test-runner.ts`
- Test: `src/lib/ai/__tests__/routing-executor.test.ts`

- [ ] **Step 1: Extend routing options**

Use existing `routePrompts` for both normal Prompt routes and `ragPromptId` Prompts, or add a focused `ragPrompts` map if that keeps code clearer. Do not fetch Prompts inside `routing-executor`.

- [ ] **Step 2: Split normal and R route handling**

Implementation rule:

```ts
const isRagRoute = matchedRoute?.intent === 'R'
```

For non-R routes, keep existing behavior unchanged.

- [ ] **Step 3: For R routes, execute RAG flow**

Flow:

1. Resolve `ragPrompt` from `routePrompts[matchedRoute.ragPromptId]`.
2. Ensure prompt contains `{rag_qas_text}`.
3. Ensure index-local ingest for `ragIndexVersionId`.
4. Search ingest with topK 10.
5. Call `generateAnswer()`.
6. Return a normal routing step with RAG diagnostics.

- [ ] **Step 4: Wrap `AiProvider` as `RagLlmClient`**

Implementation:

```ts
const llmClient = {
  generate: (messages, chatOptions) => executePromptMessages(provider, messages, {
    ...DEFAULT_PROMPT_OPTIONS,
    ...chatOptions,
    signal: options.signal,
  }),
}
```

- [ ] **Step 5: Preserve multi-turn history behavior**

Use the same history array already passed to normal target Prompts. The RAG generation user message should be the current `userInput`; do not duplicate the full transcript unless current normal path does.

- [ ] **Step 6: Run routing executor tests**

Run: `npm run test:run -- src/lib/ai/__tests__/routing-executor.test.ts`

Expected: PASS.

### Task 15: Load RAG Prompts from the run API

**Files:**
- Modify: `src/app/api/test-suites/[id]/run/route.ts`
- Modify: `src/app/api/__tests__/test-suites-route.test.ts`
- Test: `src/app/api/__tests__/test-suites-route.test.ts`

- [ ] **Step 1: Add failing API test**

Create a routing suite with an `R` route and assert `runTestSuite()` receives a `routePrompts` map containing the `ragPromptId`.

- [ ] **Step 2: Update route prompt loading**

Implementation rule:

```ts
const promptIds = new Set<string>()
for (const route of suite.routingConfig.routes) {
  if (route.intent === 'R') {
    if (route.ragPromptId) promptIds.add(route.ragPromptId)
  } else if (route.promptId) {
    promptIds.add(route.promptId)
  }
}
```

- [ ] **Step 3: Run API tests**

Run: `npm run test:run -- src/app/api/__tests__/test-suites-route.test.ts`

Expected: PASS.

### Task 16: Runner-level RAG diagnostics

**Files:**
- Modify: `src/lib/ai/__tests__/test-runner-routing.test.ts`
- Test: `src/lib/ai/__tests__/test-runner-routing.test.ts`

- [ ] **Step 1: Add failing runner test**

Assert the `test-case-done` event contains:

```ts
routingSteps: [
  expect.objectContaining({
    routeMode: 'rag',
    ragPromptId: 'prompt-rag',
    ragIndexVersionId: 'index-1',
    retrievalTopK: 10,
    answerMode: expect.stringMatching(/extractive|llm_fallback/),
  }),
]
```

- [ ] **Step 2: Ensure no runner logic strips optional diagnostics**

If the executor returns diagnostics, `test-runner.ts` should already pass them through. Only adjust if tests show a failure.

- [ ] **Step 3: Run runner tests**

Run: `npm run test:run -- src/lib/ai/__tests__/test-runner-routing.test.ts`

Expected: PASS.

## Chunk 5: Routing Config UI

### Task 17: Add R route UI tests

**Files:**
- Modify: `src/components/test/__tests__/test-suite-config-drawer.test.tsx` or create `src/components/test/__tests__/test-routing-config-dialog.test.tsx`
- Modify: `src/components/test/test-routing-config-dialog.tsx`
- Test: chosen UI test file

- [ ] **Step 1: Write failing test for showing R-only fields**

Render `TestRoutingConfigForm` with a route whose intent is `R`.

Assert:

- target Prompt selector is visible
- index version selector is visible
- normal single target selector is not used for R

- [ ] **Step 2: Write failing test for clearing hidden fields**

Interaction:

1. Start with non-R route targeting `prompt-b`.
2. Change intent to `R`.
3. Select `ragPromptId` and `ragIndexVersionId`.
4. Change intent to `refund`.

Assert saved route no longer contains R-only fields.

- [ ] **Step 3: Run UI test and confirm failure**

Run: `npm run test:run -- src/components/test/__tests__/test-suite-config-drawer.test.tsx`

Expected: FAIL until UI supports R fields.

### Task 18: Implement R route UI

**Files:**
- Modify: `src/components/test/test-routing-config-dialog.tsx`
- Test: chosen UI test file

- [ ] **Step 1: Extend `RouteDraft`**

```ts
interface RouteDraft {
  id: string
  intent: string
  promptId: string
  targetType: TestRoutingTargetType
  targetId: string
  ragPromptId: string
  ragIndexVersionId: string
}
```

- [ ] **Step 2: Update draft creation and normalization**

Use `normalizeTestSuiteRoute()` as source of truth. For `R`, set normal target fields empty and preserve R fields.

- [ ] **Step 3: Update route intent changes**

Rules:

- when switching to `R`, clear `promptId`, `targetType`, and `targetId`
- when switching away from `R`, clear `ragPromptId` and `ragIndexVersionId`

- [ ] **Step 4: Render R-specific controls**

For `route.intent.trim() === 'R'`, show:

- Prompt combobox labeled `RAG Prompt`
- index version select labeled `索引版本`

- [ ] **Step 5: Validate save**

`canSave` should use `isTestSuiteRouteComplete(normalizeTestSuiteRoute(route))`.

- [ ] **Step 6: Run UI tests**

Run: `npm run test:run -- src/components/test/__tests__/test-suite-config-drawer.test.tsx`

Expected: PASS.

## Chunk 6: End-to-End Verification

### Task 19: Run targeted test suite

**Files:**
- Test only

- [ ] **Step 1: Run route helper tests**

Run: `npm run test:run -- src/lib/__tests__/test-suite-routing.test.ts`

Expected: PASS.

- [ ] **Step 2: Run knowledge ingest and builder tests**

Run: `npm run test:run -- src/lib/knowledge/__tests__/index-ingest.test.ts src/lib/knowledge/__tests__/builder.test.ts`

Expected: PASS.

- [ ] **Step 3: Run RAG module tests**

Run: `npm run test:run -- src/lib/ai/rag/__tests__/retriever.test.ts src/lib/ai/rag/__tests__/evidence-assembler.test.ts src/lib/ai/rag/__tests__/answer-generator.test.ts`

Expected: PASS.

- [ ] **Step 4: Run routing execution tests**

Run: `npm run test:run -- src/lib/ai/__tests__/routing-executor.test.ts src/lib/ai/__tests__/test-runner-routing.test.ts`

Expected: PASS.

- [ ] **Step 5: Run API and UI tests**

Run: `npm run test:run -- src/app/api/__tests__/test-suites-route.test.ts src/components/test/__tests__/test-suite-config-drawer.test.tsx`

Expected: PASS.

### Task 20: Run final checks

**Files:**
- Test only

- [ ] **Step 1: Run full test suite**

Run: `npm run test:run`

Expected: PASS.

- [ ] **Step 2: Run lint**

Run: `npm run lint`

Expected: PASS.

- [ ] **Step 3: Review git diff**

Run: `git diff --stat`

Expected: Only files listed in this plan changed, plus any test snapshot updates that are directly caused by the feature.

### Task 21: Implementation notes before commit

**Files:**
- Review only

- [ ] **Step 1: Verify no OPPO-specific logic entered generic modules**

Search:

Run: `rg -n "OPPO|小欧|欢律|热线|活动|客服" src/lib/ai/rag src/lib/knowledge`

Expected: no matches in generic RAG modules, except test fixture text if explicitly justified.

- [ ] **Step 2: Verify old route behavior still works**

Run: `npm run test:run -- src/lib/ai/__tests__/routing-executor.test.ts src/lib/db/__tests__/test-suites-routing-schema.test.ts`

Expected: existing non-R tests still pass.

- [ ] **Step 3: Commit only from a clean feature branch or isolated worktree**

Recommended commit groups:

```bash
git add src/types/database.ts src/lib/test-suite-routing.ts src/lib/__tests__/test-suite-routing.test.ts src/lib/db/__tests__/test-suites-routing-schema.test.ts
git commit -m "feat: add R route data contract"

git add src/lib/knowledge src/types/database.ts
git commit -m "feat: add index-local RAG ingest artifacts"

git add src/lib/ai/rag
git commit -m "feat: add generic RAG answer generator"

git add src/lib/ai src/app/api/test-suites src/components/test
git commit -m "feat: execute R intent routes with RAG"
```

Do not commit unrelated existing workspace changes.
