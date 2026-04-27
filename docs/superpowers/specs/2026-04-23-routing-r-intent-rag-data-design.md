# Routing R Intent RAG Data Design

**Goal**

Define the persisted data changes needed to support `intent = R` retrieval-augmented routing and generic evidence assembly, while keeping all non-`R` routes on the current single-target path.

**Scope**

- Extend routing config data so the `R` route can bind both a target Prompt and a target index version.
- Extend knowledge artifacts so retrieval and evidence assembly can rely on generic structured metadata instead of customer-specific answer heuristics.
- Define compatibility and rebuild behavior for existing routing configs and existing index versions.
- Keep final answer generation Prompt-driven via the `{rag_qas_text}` placeholder.

**Non-goals**

- Do not define the detailed retrieval scoring algorithm in this document.
- Do not define the exact UI layout beyond the required persisted fields and validation rules.
- Do not move business-specific answer heuristics into the generic index contract.
- Do not hard-code a customer-specific generation prompt or provider into the generic answer module.

## Design Principles

1. Keep the current `intent -> target` model unchanged for non-`R` routes.
2. Store generic retrieval metadata in existing artifact structures where possible; avoid broad schema churn.
3. Generate stable normalization and structural metadata at build time; keep query-specific scoring at runtime.
4. Treat customer-specific business heuristics as optional Prompt or profile concerns, not as required index fields.
5. Keep old index versions runnable by generating or backfilling local ingest artifacts when needed.
6. Keep `generateAnswer()` generic: it may choose extractive or LLM fallback, but all Prompt templates, providers, and policy knobs must be injected or configurable.

## Data Changes Summary

### 1. Routing Config

`TestSuiteRoute` keeps its current shape for non-`R` routes and adds `R`-only fields:

```ts
interface TestSuiteRoute {
  intent: string
  promptId: string
  targetType?: TestRoutingTargetType
  targetId?: string
  ragPromptId?: string
  ragIndexVersionId?: string
}
```

Meaning:

- `promptId`, `targetType`, `targetId`
  - existing fields
  - continue to drive all non-`R` routes
- `ragPromptId`
  - `R`-only
  - the Prompt whose content contains `{rag_qas_text}`
- `ragIndexVersionId`
  - `R`-only
  - the index version used for retrieval before Prompt rendering

Validation rules:

- `intent !== "R"`
  - `ragPromptId` and `ragIndexVersionId` must be omitted or empty
  - execution continues to use the current single target contract
- `intent === "R"`
  - `ragPromptId` is required
  - `ragIndexVersionId` is required
  - the selected Prompt content must contain `{rag_qas_text}`
  - `promptId`, `targetType`, and `targetId` are ignored by execution and should be normalized to empty values on save

Persistence impact:

- `routingConfig` is already stored as JSON inside `test_suites.routing_config`
- adding these optional fields does not require a SQLite schema migration
- read-time normalization must default missing `ragPromptId` / `ragIndexVersionId` to empty values

Runtime contract for `R`:

- execute only through `ragPromptId` and `ragIndexVersionId`
- fail fast if either field is missing
- fail fast if `ragPromptId` does not resolve to a Prompt containing `{rag_qas_text}`
- never fall back to the non-`R` single-target path

UI behavior:

- show `ragPromptId` and `ragIndexVersionId` only when `intent === "R"`
- hide and clear these fields when a route changes away from `R`
- clear `promptId`, `targetType`, and `targetId` when a route changes to `R`
- save only normalized route data so hidden fields do not persist stale values

### 2. Knowledge Artifact Contract

The current project already persists:

- `knowledge_parents`
- `knowledge_chunks`
- `parents.jsonl`
- `chunks.jsonl`
- `manifest.json`

This design keeps those entities and adds retrieval-focused data inside existing fields rather than introducing new tables.

#### 2.1 Parent-level data

Use the existing `questionAliases` field on `KnowledgeParent` and stop treating it as always-empty placeholder data.

Parent records should provide:

- `question`
  - already present
  - original display question
- `question_clean`
  - already present in build artifacts
  - canonical question text used for retrieval and prompt rendering
- `questionAliases`
  - existing persisted field
  - now treated as real retrieval input, not placeholder data
- `metadata.questionNormalized`
  - new
  - normalized form of `question_clean`
- `metadata.questionSignature`
  - already present
  - stable normalized signature for exact matching
- `metadata.sourceParentQuestions`
  - new
  - list of upstream canonical question strings when merged/promoted records are involved
- `metadata.isExactFaq`
  - new
  - boolean
  - true when the source record is an explicit FAQ-style unit suitable for exact lookup
- `metadata.intent`
  - new optional field
  - generic intent label if a profile or enricher can derive one
- `metadata.subject`
  - new optional field
  - short subject label for retrieval rerank and evidence grouping
- `metadata.scopeTerms`
  - new optional field
  - array of scoped nouns or domain qualifiers
- `metadata.device`
  - new optional field
  - generic device category only
- `metadata.productModel`
  - new optional field
  - array of explicit model strings if they can be extracted without customer-specific code

#### 2.2 Chunk-level data

Chunk rows already provide:

- `chunkOrder`
- `sectionTitle`
- `chunkText`
- `embeddingText`
- `chunkType`
- `metadata`

This design adds retrieval/evidence fields to `chunk.metadata`:

- `question`
  - already written today
  - canonical parent question for this chunk
- `questionNormalized`
  - new
- `questionSignature`
  - already available via inherited parent metadata
- `questionAliases`
  - new
  - copied from the parent for exact and near-exact matching
- `sourceParentQuestions`
  - new
- `isExactFaq`
  - new
- `intent`
  - new optional field
- `subject`
  - new optional field
- `scopeTerms`
  - new optional field
- `device`
  - new optional field
- `productModel`
  - new optional field
- `chunkKind`
  - new
  - semantic evidence label used by retrieval/evidence assembly

`chunkType` vs `chunkKind`:

- `chunkType`
  - existing storage split marker
  - currently describes how the chunk was produced
- `chunkKind`
  - new semantic label
  - used by evidence assembly to distinguish evidence roles such as overview, steps, condition, note, policy, support-list, or definition

`chunkKind` must remain generic. It must not encode customer-specific classes such as named campaigns, named apps, or brand-specific support channels.

### 3. Index Manifest Contract

`manifest.json` should explicitly declare whether an index version supports the new retrieval/evidence contract.

Add a new top-level section:

```json
{
  "retrievalContract": {
    "version": 1,
    "supportsRagRoute": true,
    "supportsEvidenceAssembly": true,
    "enrichedMetadataKeys": [
      "questionNormalized",
      "questionSignature",
      "sourceParentQuestions",
      "isExactFaq",
      "chunkKind"
    ]
  }
}
```

Purpose:

- lets runtime detect whether an index version was built before or after the enrichment rollout
- allows graceful fallback for older index versions
- gives rebuild and rollout tooling a stable compatibility flag

No new SQLite column is required for this document. The source of truth remains the artifact manifest for contract detection, while `knowledge_index_versions` continues to point at the manifest path.

### 4. Index-local ingest artifacts

Every index version must have local ingest artifacts under its index artifact directory.

Current artifact layout:

- `data/knowledge/<projectId>/<knowledgeBaseId>/versions/<knowledgeVersionId>/parents.jsonl`
- `data/knowledge/<projectId>/<knowledgeBaseId>/versions/<knowledgeVersionId>/chunks.jsonl`
- `data/knowledge/<projectId>/<knowledgeBaseId>/versions/<knowledgeVersionId>/manifest.json`
- `data/knowledge/<projectId>/<knowledgeBaseId>/indexes/<knowledgeVersionId>/manifest.json`

Add index-local ingest files:

- `data/knowledge/<projectId>/<knowledgeBaseId>/indexes/<knowledgeVersionId>/parents.jsonl`
- `data/knowledge/<projectId>/<knowledgeBaseId>/indexes/<knowledgeVersionId>/chunks.jsonl`
- `data/knowledge/<projectId>/<knowledgeBaseId>/indexes/<knowledgeVersionId>/ingest.json`

Rules:

- new index versions write these ingest files during index creation
- old index versions are allowed to run
- if an old index version is missing ingest files, runtime creates them lazily from the associated knowledge version artifacts and persists them
- `R` retrieval reads the index-local ingest files, not an in-memory rebuild
- if both index ingest and source knowledge artifacts are unavailable, `R` execution fails with a routing error

This keeps old versions usable while still making retrieval execution version-specific and repeatable.

### 5. Generic answer generation contract

`generateAnswer()` must be a generic orchestration module, not a customer-specific generator.

Inputs:

```ts
interface GenerateAnswerInput {
  query: string
  recallResults: RetrievalResult[]
  promptTemplate: string
  llmClient: RagLlmClient
  policy?: Partial<AnswerPolicyConfig>
}
```

Output:

```ts
interface GenerateAnswerResult {
  answerText: string
  answerMode: 'extractive' | 'llm_fallback'
  selectedDocId: string | null
  selectedChunkIds: string[]
  selectionMargin: number | null
  evidenceText: string
}
```

Responsibilities:

- select the best candidate from recall results
- assemble extractive evidence from selected chunks
- decide whether the extractive answer is reliable enough
- if reliable, return `answerMode = "extractive"` and the assembled text
- otherwise render `{rag_qas_text}` into the injected Prompt template and call the injected LLM client
- expose diagnostics needed by routing execution

Non-responsibilities:

- no built-in OPPO or customer-specific system prompt
- no provider-specific HTTP implementation
- no hard-coded brand, hotline, campaign, app, or policy regexes
- no hidden access to project database state

Default behavior should match `qa_verify`:

- try extractive assembly first
- require a confident candidate margin before returning extractive text
- fall back to LLM generation when extractive assembly is missing, uncertain, structurally incomplete, or disabled by policy
- with empty recall results, still render the Prompt with an empty `{rag_qas_text}` value and use LLM fallback

Policy values:

- provide a default policy equivalent to the generic parts of `qa_verify`
- keep thresholds and candidate window configurable in code
- allow future profile-level overrides without requiring a schema change in this iteration

### 6. Evidence text contract

The LLM fallback evidence text must follow the existing `qa_verify` block shape.

Limits:

- final recall window: top 10
- candidate window for extractive selection: default 5, configurable through policy
- keep chunk order and matched chunk grouping from retrieval results

Rendered block format:

```text
[1] 问题: ...
文档ID: ...
召回分数: 0.9876
匹配片段:
[chunk-id-1] (chunk-kind) chunk text
[chunk-id-2] (chunk-kind) chunk text

[2] 问题: ...
文档ID: ...
召回分数: 0.9321
匹配片段:
[chunk-id-3] (chunk-kind) chunk text
```

If a result has no `matched_chunks`, use its `chunk_text` fallback exactly like `qa_verify`.

### 7. Routing step diagnostics

When an `R` route executes, `routingSteps` should keep the existing fields and add optional RAG diagnostics.

Add optional fields to `TestCaseRoutingStep`:

- `routeMode: "prompt" | "rag"`
- `ragPromptId`
- `ragIndexVersionId`
- `retrievalTopK`
- `selectedDocId`
- `selectedChunkIds`
- `selectionMargin`
- `answerMode`
- `ingestBackfilled`

These fields are optional so old test results and non-`R` steps remain valid.

## Build-time vs Runtime Responsibilities

### Build-time generated data

These values should be produced during knowledge build / index build and persisted in artifacts:

- `questionAliases`
- `questionNormalized`
- `questionSignature`
- `sourceParentQuestions`
- `isExactFaq`
- `chunkKind`
- optional generic enrichments:
  - `intent`
  - `subject`
  - `scopeTerms`
  - `device`
  - `productModel`

Why these belong in build-time data:

- they are stable for a given knowledge version
- they improve retrieval without depending on the current query
- they reduce repeated parsing work at request time

### Runtime-derived data

These values should remain runtime-only and must not be persisted as artifact data:

- lexical overlap
- phrase overlap
- anchor phrase score
- route compatibility score
- selection score
- top-1 / top-2 margin
- chunk inclusion / exclusion decisions for the current query
- final `rag_qas_text`

Why these stay runtime-only:

- they depend on the current user query
- they change with retrieval policy tuning
- persisting them would couple index artifacts to one scoring implementation

## Generic Enrichment Rules

The enrichment layer must stay generic.

Allowed:

- normalization
- structural chunk labeling
- exact FAQ detection
- generic device categories
- generic subject and scope extraction
- profile-driven alias generation if the source data supports it

Not allowed as required contract fields:

- brand name lists
- campaign name rules
- named customer service hotlines
- named app whitelists/blacklists
- case-by-case business regex branches copied from `answer_assembler.py`

If a project later wants those behaviors, they should live in one of:

- Prompt wording
- optional profile-specific enrichers
- runtime business adapters outside the generic retrieval contract

## Compatibility Strategy

### Existing routing configs

Existing routing configs remain valid because:

- `ragPromptId` and `ragIndexVersionId` are optional
- non-`R` routes keep their current execution path
- read/write normalization can safely add empty `R`-only fields without breaking old records

### Existing index versions

Existing index versions remain runnable.

Fallback behavior for old index versions:

- retrieval may still use:
  - `question`
  - `questionSignature`
  - `chunkText`
  - `sectionTitle`
- retrieval must not assume:
  - populated aliases
  - populated semantic metadata
  - populated `chunkKind`
  - declared `retrievalContract`

Runtime behavior:

- allow old index versions to be selected for `intent = R`
- if local index ingest files are missing, backfill them from the linked knowledge version artifacts
- set `ingestBackfilled = true` in routing diagnostics when this happens
- use fallback defaults for missing metadata:
  - `chunkKind = chunkType || "faq"`
  - `questionAliases = []`
  - `isExactFaq = false`
  - semantic fields omitted

Recommended rollout rule:

- new builds should emit `manifest.retrievalContract.version >= 1`
- old builds remain supported through the fallback path above

## Rebuild and Backfill Strategy

### Routing config

No historical backfill job is required.

- old JSON configs remain readable
- new saves normalize the route shape
- only suites that add an `R` route need the new fields populated

### Knowledge data

Knowledge tables do not need a broad schema rewrite for this design.

Required ingest behavior:

1. New index versions write index-local ingest artifacts immediately.
2. New builds emit enriched parent/chunk metadata.
3. New builds emit `manifest.retrievalContract`.
4. Old index versions lazily backfill missing local ingest artifacts at first `R` execution.

This keeps the migration simple:

- no destructive data rewrite
- no one-shot eager backfill over all old artifacts
- old project data remains runnable

## Testing Requirements

### Route data tests

- persist and load non-`R` routes unchanged
- persist and load `R` routes with both `ragPromptId` and `ragIndexVersionId`
- reject `R` routes with only one of the two fields
- reject non-`R` routes that accidentally carry `R`-only fields

### Builder / artifact tests

- new builds emit `questionNormalized`
- new builds emit non-placeholder `questionAliases` when source data provides them
- new builds emit `isExactFaq`
- new builds emit `chunkKind`
- new builds emit `manifest.retrievalContract.version = 1`

### Compatibility tests

- runtime can still load and search an older index version without crashing
- runtime degrades gracefully when enriched metadata keys are missing
- `intent = R` route lazily backfills missing index ingest files for old index versions
- `intent = R` route reports missing source artifacts when lazy backfill is impossible

### Answer generation tests

- `generateAnswer()` returns extractive text when evidence assembly and policy gates are confident
- `generateAnswer()` falls back to LLM when margin is too small
- `generateAnswer()` falls back to LLM when recall results are empty
- `generateAnswer()` renders top 10 recall results using the `qa_verify` evidence block format
- `generateAnswer()` rejects Prompt templates without `{rag_qas_text}`

## Files Expected To Change Later

- `src/types/database.ts`
- `src/lib/test-suite-routing.ts`
- `src/components/test/test-routing-config-dialog.tsx`
- `src/lib/knowledge/builder.ts`
- `src/lib/knowledge/service.ts`
- `src/lib/db/repositories/knowledge-versions.ts`
- `src/lib/ai/routing-executor.ts`
- `src/lib/knowledge/storage.ts`
- new retrieval / evidence assembly modules under `src/lib/ai/` or `src/lib/knowledge/`
