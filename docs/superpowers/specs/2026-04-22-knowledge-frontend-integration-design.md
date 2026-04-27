# Knowledge Frontend Integration Design

**Goal**

Wire the existing knowledge automation UI to the newly implemented generic backend without redesigning the current pages or changing the visual structure.

**Scope**

- Keep the existing knowledge canvas layout and prototype-oriented operator UI.
- Replace prototype-only knowledge data flows with real API-backed state for:
  - knowledge base existence
  - build task creation
  - version list
  - task list
  - version detail
  - push STG
  - push PROD
  - rollback
- Keep `DetailView` as a prototype-only deep workflow view for now.

**Non-goals**

- Do not redesign the knowledge module.
- Do not rebuild the risk-review prototype into a fully backend-driven workflow in this change.
- Do not refactor the global page state architecture beyond the minimum prop wiring needed.

## Integration Strategy

Use a thin integration layer inside `KnowledgeAutomationPanel`:

1. Add `projectId` to the panel props.
2. Load knowledge-base, task, version, and index-version data from the backend.
3. Convert backend records into the UI rows expected by the current views.
4. Keep the current UI shells and interaction patterns intact.
5. Trigger backend mutations from the existing buttons and refresh local state after success.

This keeps the frontend changes isolated to the knowledge module and avoids pulling more page-level state into the main canvas.

## View-by-View Behavior

### Create View

- Keep the current task creation form.
- Replace prototype history-version options with real project versions.
- Submit to:
  - `POST /api/projects/:id/knowledge-base` when the project has no knowledge base
  - `POST /api/projects/:id/knowledge-build-tasks` for task creation
- After success:
  - refresh panel data
  - open the version detail page for the created version

### List View

- Keep the current dual-mode shell:
  - `versions`
  - `tasks`
- Replace prototype tables with rows mapped from backend data.
- Push actions call:
  - `POST /api/knowledge-versions/:id/push-stg`
  - `POST /api/knowledge-versions/:id/push-prod`
  - `POST /api/knowledge-versions/:id/rollback`
- Refresh backend state after each mutation and show a small operator notice.

### Version Detail View

- Replace hardcoded rounds and index content with the selected knowledge version from the backend.
- Map:
  - `coverageAudit`
  - `stageSummary`
  - `parents`
  - `chunks`
- Preserve the current two-tab structure:
  - basic information
  - Q&A details

### Detail View

- No backend integration in this change.
- It remains available as a prototype flow entered from task actions if needed.
- The versions workflow should prefer the real version detail page.

## Data Mapping

Frontend mapping rules:

- `KnowledgeVersion.status`
  - `draft` -> `草稿`
  - `stg` -> `STG`
  - `prod` -> `PROD`
  - `archived` -> `已归档`
- Coverage uses `coverageAudit.coverage`.
- Audit status uses:
  - `正常` when `coverageAudit.auditStatus === "normal"`
  - `需关注：` plus joined reasons otherwise
- Index version ID is taken from `knowledge_index_versions` for the version when available, otherwise `待生成`.

## API Client Additions

Add a `knowledgeApi` group to `src/lib/utils/api-client.ts` for:

- `getKnowledgeBase`
- `createKnowledgeBase`
- `listKnowledgeTasks`
- `createKnowledgeTask`
- `listKnowledgeVersions`
- `listKnowledgeIndexVersions`
- `getKnowledgeVersion`
- `pushStg`
- `pushProd`
- `rollback`

## Testing

Follow TDD:

1. Add component-level failing tests for:
   - loading real versions/tasks
   - creating a knowledge base + task
   - push STG / push PROD / rollback callbacks
   - rendering real version detail data
2. Run the tests and confirm failure.
3. Implement the minimal integration code.
4. Re-run focused tests and a small regression slice.
