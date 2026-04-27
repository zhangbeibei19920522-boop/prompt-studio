# Test Suite Generation Document Route Mode Design

**Goal**

Allow configured test suite generation to classify selected document sources as `R` or `非 R` inside the existing drawer flow, so generated test cases can carry the right hidden routing expectation without leaking that classification into the real execution input.

**Scope**

- Extend the existing "测试用例生成来源" picker to classify selected document sources as `走 R` or `走非 R`.
- Define the request contract for document route-mode configuration.
- Define how generated test cases persist source document ownership and hidden route-mode metadata.
- Define how routing workflows use that metadata to constrain `expectedIntent`.
- Keep actual test execution input unchanged: the model only receives the user query or multi-turn user transcript.

**Non-goals**

- Do not redesign the drawer outside the existing source picker flow.
- Do not let Prompt sources participate in `R / 非 R` classification.
- Do not inject `R / 非 R` labels into `testCase.input`.
- Do not overload `expectedOutputDiagnostics` with generation-only source metadata.
- Do not define a global document-level default; classification is per test suite generation request only.

## Problem

The current configured generation flow only knows which sources were selected:

- `generationSourceIds`
- referenced Prompt titles
- referenced document titles

That is not enough once a routing project needs a mixed source set such as:

- document A should generate cases whose expected route node is fixed to `R`
- document B should generate cases whose expected route node must be some non-`R` intent

Today, that distinction is lost:

- the drawer cannot capture it
- the generation request cannot transmit it
- generated cases do not remember which primary document they came from
- later display and regeneration cannot explain why a case expected `R` vs `P-xx`

## Design Principles

1. Keep the interaction inside the existing drawer and source picker.
2. Only classify document sources; Prompt sources remain generation references only.
3. Treat document route mode as generation-time control data and case metadata, not runtime input text.
4. Require one primary source document per generated case whenever document-based route constraints are active.
5. Keep routing diagnostics and generation metadata separate.
6. Keep non-routing suites compatible: they may store the metadata even if they do not use `expectedIntent`.

## Interaction Design

### 1. Drawer placement

Reuse the existing "测试用例生成来源" card in [test-suite-config-drawer.tsx](/Users/cs001/prompt-studio/src/components/test/test-suite-config-drawer.tsx).

The main drawer stays compact:

- current summary of selected sources
- one extra summary line for selected documents:
  - `文档：1 份走 R，2 份走非 R`

No per-document route-mode controls appear directly in the drawer body.

### 2. Source picker flow

The existing source picker dialog remains the only entry point.

Top half:

- unchanged mixed selection for:
  - `Prompt`
  - `文档库`

Bottom half:

- new "文档路由归类" section
- only lists currently selected document sources
- each selected document has a binary control:
  - `走 R`
  - `走非 R`

Defaults and behavior:

- a newly selected document defaults to `走非 R`
- unselecting a document removes its route-mode config immediately
- Prompt sources never show a route-mode control

Recommended batch actions in the dialog:

- `已选文档全部标为 R`
- `已选文档全部标为非 R`

### 3. Summary copy

Dialog summary:

- `已选 2 个 Prompt，3 份文档`
- `其中 1 份走 R，2 份走非 R`

Drawer summary:

- `已选 5 个来源`
- `文档：1 份走 R，2 份走非 R`

## Data Contract

### 1. Generation request

Keep `generationSourceIds` unchanged and add a new document-only field:

```ts
export interface GenerateConfiguredTestSuiteRequest {
  // existing fields...
  generationSourceIds: string[]
  generationDocumentRouteModes: Array<{
    documentId: string
    routeMode: 'rag' | 'non-r'
  }>
}
```

Meaning:

- `generationSourceIds`
  - which Prompts/documents were selected
- `generationDocumentRouteModes`
  - only for selected documents
  - classifies each selected document as `走 R` or `走非 R`

Validation rules:

- every selected document must have exactly one route mode
- no unselected document may appear in `generationDocumentRouteModes`
- Prompt IDs must never appear in `generationDocumentRouteModes`
- route mode values are restricted to:
  - `rag`
  - `non-r`

Persistence:

- `test_suite_generation_jobs.request_json` already stores the full request JSON
- this field can be added without a new table migration

### 2. Generated case metadata

Generated cases need hidden metadata so the source constraint survives generation.

Add:

```ts
export interface TestCaseGenerationMetadata {
  sourceDocumentId: string | null
  sourceDocumentName: string | null
  sourceRouteMode: 'rag' | 'non-r' | null
}
```

And store it on `TestCase`:

```ts
export interface TestCase {
  // existing fields...
  generationMetadata?: TestCaseGenerationMetadata | null
}
```

Persistence recommendation:

- add `generation_metadata_json TEXT` to `test_cases`
- read/write JSON through the repository

Why this must be separate from `expectedOutputDiagnostics`:

- `expectedOutputDiagnostics` represents execution-time routing trace
- document source ownership is generation-time metadata
- mixing them would make the diagnostics panel semantically inconsistent

### 3. Primary-document rule

When at least one document source is selected, each generated case must identify one primary document:

- `sourceDocumentId` must be a selected document ID
- `sourceRouteMode` must match that document's configured route mode

This is a hard rule.

A case may still be inspired by Prompt references, but route-mode ownership comes from exactly one primary document.

If the generation run contains only Prompt sources and no selected documents:

- `sourceDocumentId = null`
- `sourceRouteMode = null`

## Generation Semantics

### 1. Where the route mode is allowed

The `R / 非 R` classification may be used by:

- configured suite generation
- generated expected-output enrichment
- UI display of generated case provenance

It may not be written into:

- `testCase.input`
- actual runtime user messages
- the model input used when executing the tested prompt or routing flow

That means the real execution path still sees only:

- the single-turn user query
- or the multi-turn `User:/Assistant:` transcript

### 2. Generator instructions

The generation agent may receive the route-mode classification as structured system-level constraints, not as synthetic user input text.

For document-constrained generation, each emitted case must include:

- `sourceDocumentId`
- `expectedIntent` when the workflow uses routing

Recommended batch JSON extension:

```json
{
  "type": "test-suite-batch",
  "name": "测试集名称",
  "description": "测试集描述",
  "totalPlanned": 10,
  "cases": [
    {
      "title": "用例标题",
      "context": "用户场景",
      "input": "用户输入",
      "sourceDocumentId": "doc-refund",
      "expectedIntent": "R",
      "expectedOutput": "最终回复应满足的要点"
    }
  ]
}
```

### 3. Routing workflow behavior

When the generated suite uses routing semantics:

- if `sourceRouteMode === 'rag'`
  - `expectedIntent` must be exactly `R`
- if `sourceRouteMode === 'non-r'`
  - `expectedIntent` must not be `R`
  - the LLM should infer the specific non-`R` node name from the configured route Prompt and route table

This matches the approved product behavior:

- `R` documents force `R`
- `非 R` documents only mean "not R"
- they do not bind a specific node ahead of time

### 4. Non-routing workflow behavior

For non-routing suites:

- no `expectedIntent` contract is enforced
- `generationMetadata` is still persisted
- future expected-output enrichment may use `sourceRouteMode`
- runtime execution input remains unchanged

This keeps the drawer interaction reusable without forcing routing-only semantics into all suites.

## Server-side Validation

### 1. Request validation

`POST /api/projects/[id]/test-suites/generate` should reject requests where:

- a selected document lacks a route mode
- a route mode references an unselected document
- duplicate document IDs appear in `generationDocumentRouteModes`
- an unknown route mode value is provided

### 2. Generation result validation

Before persisting a generated batch:

- if document route modes were provided, every generated case must carry a valid `sourceDocumentId`
- `sourceDocumentId` must belong to the selected document set
- `sourceRouteMode` is derived server-side from the request, not trusted from the model
- routing suites must satisfy:
  - `rag -> expectedIntent === 'R'`
  - `non-r -> expectedIntent !== 'R'`

If any generated case violates these constraints:

- reject the batch
- surface a generation error or retry path
- do not silently persist mismatched cases

## Display

Generated case detail should surface a concise provenance summary near expected routing info:

- `来源文档：退款政策.docx`
- `来源归类：R`
- `预期节点：R`

or:

- `来源文档：客服话术规范.docx`
- `来源归类：非 R`
- `预期节点：P-退款`

This information is for operators only and must not appear in the executable `input` payload.

## Files Likely Affected

- [test-suite-config-drawer.tsx](/Users/cs001/prompt-studio/src/components/test/test-suite-config-drawer.tsx)
- [configured-generation.ts](/Users/cs001/prompt-studio/src/lib/test-suite-generation/configured-generation.ts)
- [run-configured-suite-generation.ts](/Users/cs001/prompt-studio/src/lib/test-suite-generation/run-configured-suite-generation.ts)
- [test-agent-prompt.ts](/Users/cs001/prompt-studio/src/lib/ai/test-agent-prompt.ts)
- [types/api.ts](/Users/cs001/prompt-studio/src/types/api.ts)
- [types/database.ts](/Users/cs001/prompt-studio/src/types/database.ts)
- [test-cases.ts](/Users/cs001/prompt-studio/src/lib/db/repositories/test-cases.ts)
- [index.ts](/Users/cs001/prompt-studio/src/lib/db/index.ts)

## Acceptance Criteria

1. Users can classify selected document sources as `走 R` or `走非 R` inside the existing source picker.
2. Prompt sources remain selectable but never show route-mode controls.
3. The generation request persists document route-mode config separately from `generationSourceIds`.
4. Generated cases persist one primary source document and hidden source route mode.
5. Routing suites force `expectedIntent = R` for `R` documents and forbid `R` for `非 R` documents.
6. Actual execution input remains only the user query transcript; no route-mode label is injected into `input`.
