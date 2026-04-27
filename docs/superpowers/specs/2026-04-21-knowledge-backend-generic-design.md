# Knowledge Backend Generic Design

**Goal**

Add a backend-only knowledge automation foundation that matches the generic multi-tenant cleaning model in [0420-data-cleaning-technical-doc.md](/Users/cs001/prompt-studio/knowledgeui/0420-data-cleaning-technical-doc.md), without changing current frontend components.

**Scope**

- Add persistent backend entities for knowledge bases, build tasks, knowledge versions, parents, chunks, and index versions.
- Add a generic in-project build pipeline that consumes project documents and manual task input and produces `parents/chunks` artifacts plus stage summaries.
- Keep the runtime generic. Do not hardcode OPPO source groups, metadata labels, or risk rules.
- Reuse only the generic parts of `qa_verify`: snapshot validation concepts, chunk/index persistence expectations, and artifact shape.

**Non-goals**

- Do not wire current frontend pages to the new APIs in this change.
- Do not import or execute external Stage 1-11 Python scripts.
- Do not implement tenant-specific repair rules beyond a generic extension point.

## Architecture

The backend is split into three layers that mirror the technical doc:

1. `generic execution layer`
   - Generic build pipeline in TypeScript.
   - Produces stage summaries, release decisions, `parents`, `chunks`, and version manifests.

2. `tenant configuration layer`
   - Stored as profile/config JSON on the knowledge base.
   - Holds generic rule inputs such as source adapters, cleaning rules, risk rules, merge rules, and metadata schema.
   - First version ships with a `generic_customer_service` default profile and empty overrides.

3. `tenant repair layer`
   - Separate optional config bucket.
   - Not executed as custom code in this change.
   - Exists so future repair logic does not pollute the generic pipeline.

## Data Model

New persistent entities:

- `knowledge_bases`
- `knowledge_build_tasks`
- `knowledge_versions`
- `knowledge_parents`
- `knowledge_chunks`
- `knowledge_index_versions`

One project owns at most one active knowledge base in the first version. A build task belongs to one knowledge base and can produce one draft knowledge version. `knowledge_parents` and `knowledge_chunks` are persisted both in SQLite and as artifact files under `data/knowledge/...`.

## Generic Build Pipeline

The builder is intentionally generic and document-driven:

1. Normalize task input into source items.
   - Selected project documents.
   - Manual draft rows.
   - Repair questions.

2. Run a TypeScript build pipeline with generic heuristics.
   - Stage 1 manifest: classify source items, drop empty inputs.
   - Stage 2 raw records: convert each source item to one or more raw records.
   - Stage 3 cleaning: normalize whitespace and remove empty boilerplate.
   - Stage 4 routing: generic include/high-risk/exclude rules.
   - Stage 5 structure: detect explicit FAQ vs composite content.
   - Stage 6 promotion: reserved hook, generic no-op unless a structure rule promotes extra FAQs.
   - Stage 7 merge: exact normalized-question merge.
   - Stage 8 conflict detection: same normalized question with materially different answers becomes blocked.
   - Stage 9 release gating: blocked and high-risk records remain pending unless the profile explicitly allows them.
   - Stage 10 generation: build `parents/chunks`.
   - Stage 11 coverage: compute summary counters and orphan-style stats.

3. Persist artifacts.
   - `parents.jsonl`
   - `chunks.jsonl`
   - `manifest.json`

4. Persist database state.
   - Task status and stage summary.
   - Draft knowledge version.
   - Parents/chunks rows.

## Index Version Flow

Task creation produces a draft knowledge version, not a STG/PROD deployment.

- `Push STG`
  - Creates or updates a `knowledge_index_version`.
  - Marks the knowledge version as `stg`.

- `Push PROD`
  - Marks the selected version as `prod`.
  - Archives the previous prod version.
  - Updates knowledge-base pointers.

- `Rollback`
  - Switches prod pointer back to a historical version.
  - Creates a new prod publish event in database state by updating statuses and pointers.

## API Surface

Project-scoped routes:

- `GET/POST /api/projects/:id/knowledge-base`
- `GET/POST /api/projects/:id/knowledge-build-tasks`
- `GET /api/projects/:id/knowledge-versions`
- `GET /api/projects/:id/knowledge-index-versions`

Entity routes:

- `GET /api/knowledge-build-tasks/:id`
- `GET /api/knowledge-versions/:id`
- `POST /api/knowledge-versions/:id/push-stg`
- `POST /api/knowledge-versions/:id/push-prod`
- `POST /api/knowledge-versions/:id/rollback`

## Testing

Use TDD with route and repository tests.

- Schema test: new knowledge tables exist.
- Route tests: create knowledge base, create build task, inspect version detail, push STG, push PROD, rollback.
- Builder tests: generic input creates valid `parents/chunks` with stage summaries and generic release decisions.
