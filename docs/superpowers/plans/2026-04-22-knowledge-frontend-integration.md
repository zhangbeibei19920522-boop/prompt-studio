# Knowledge Frontend Integration Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connect the existing knowledge automation frontend to the new generic backend while preserving the current UI structure.

**Architecture:** Add a thin API-backed state layer inside the knowledge automation panel, keep the current view components, and map backend knowledge records into the operator-facing table/detail shapes already used by the prototype UI. Leave the deep workflow prototype view untouched for now.

**Tech Stack:** Next.js, React, TypeScript, Vitest, existing `fetchApi` API client helpers

---

### Task 1: Add Frontend Knowledge API Client Coverage

**Files:**
- Modify: `src/lib/utils/api-client.ts`
- Test: `src/components/knowledge-automation/__tests__/knowledge-automation-panel.test.tsx`

- [ ] **Step 1: Write the failing test**

Add an assertion that the knowledge panel source references a dedicated API client entry instead of only prototype data.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest --run --dir src src/components/knowledge-automation/__tests__/knowledge-automation-panel.test.tsx`
Expected: FAIL because the panel still relies on prototype-only data.

- [ ] **Step 3: Implement the knowledge API client helpers**

Add a `knowledgeApi` export that covers base, task, version, detail, and publish actions.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest --run --dir src src/components/knowledge-automation/__tests__/knowledge-automation-panel.test.tsx`
Expected: PASS for the new API-client assertions.

### Task 2: Integrate Panel-Level Data Loading

**Files:**
- Modify: `src/components/knowledge-automation/knowledge-automation-panel.tsx`
- Modify: `src/app/(main)/page.tsx`
- Test: `src/components/knowledge-automation/__tests__/knowledge-automation-panel.test.tsx`

- [ ] **Step 1: Write the failing test**

Add expectations that the panel accepts `projectId` and loads real data instead of deriving knowledge-base existence from document count alone.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest --run --dir src src/components/knowledge-automation/__tests__/knowledge-automation-panel.test.tsx`
Expected: FAIL because the panel still uses `documents.length > 0` as the knowledge-base gate.

- [ ] **Step 3: Implement panel data loading**

Load knowledge base, versions, tasks, and index versions in the panel and pass mapped rows into child views.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest --run --dir src src/components/knowledge-automation/__tests__/knowledge-automation-panel.test.tsx`
Expected: PASS.

### Task 3: Integrate Create And Version Actions

**Files:**
- Modify: `src/components/knowledge-automation/create-view.tsx`
- Modify: `src/components/knowledge-automation/list-view.tsx`
- Test: `src/components/knowledge-automation/__tests__/create-view.test.tsx`
- Test: `src/components/knowledge-automation/__tests__/knowledge-automation-panel.test.tsx`

- [ ] **Step 1: Write the failing tests**

Add expectations that:
- create view accepts real version options and submit callbacks
- list view exposes real push/rollback callbacks instead of only mutating local prototype arrays

- [ ] **Step 2: Run test to verify they fail**

Run: `npx vitest --run --dir src src/components/knowledge-automation/__tests__/create-view.test.tsx src/components/knowledge-automation/__tests__/knowledge-automation-panel.test.tsx`
Expected: FAIL because the views still own prototype-only state.

- [ ] **Step 3: Implement the action wiring**

Make create and version actions call panel-provided async handlers and refresh real backend state on success.

- [ ] **Step 4: Run test to verify they pass**

Run: `npx vitest --run --dir src src/components/knowledge-automation/__tests__/create-view.test.tsx src/components/knowledge-automation/__tests__/knowledge-automation-panel.test.tsx`
Expected: PASS.

### Task 4: Integrate Real Version Detail Data

**Files:**
- Modify: `src/components/knowledge-automation/version-detail-view.tsx`
- Test: `src/components/knowledge-automation/__tests__/knowledge-automation-panel.test.tsx`

- [ ] **Step 1: Write the failing test**

Add assertions that the version detail source renders backend-driven coverage, audit, parent, and chunk data instead of only the hardcoded rounds array.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest --run --dir src src/components/knowledge-automation/__tests__/knowledge-automation-panel.test.tsx`
Expected: FAIL because version detail still uses static rounds.

- [ ] **Step 3: Implement the version detail mapping**

Drive the detail screen from fetched knowledge version data while keeping the existing two-tab layout.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest --run --dir src src/components/knowledge-automation/__tests__/knowledge-automation-panel.test.tsx`
Expected: PASS.

### Task 5: Verify The Integration Slice

**Files:**
- Modify: any files from prior tasks

- [ ] **Step 1: Run the focused knowledge frontend tests**

Run: `npx vitest --run --dir src src/components/knowledge-automation/__tests__/create-view.test.tsx src/components/knowledge-automation/__tests__/knowledge-automation-panel.test.tsx`
Expected: PASS.

- [ ] **Step 2: Run knowledge backend route tests**

Run: `npx vitest --run --dir src src/app/api/__tests__/knowledge-routes.test.ts`
Expected: PASS.

- [ ] **Step 3: Run the nearby workspace regression slice**

Run: `npx vitest --run --dir src src/app/__tests__/main-page-workspace-layout.test.ts`
Expected: PASS.
