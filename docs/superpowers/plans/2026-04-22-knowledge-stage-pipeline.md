# Knowledge Stage Pipeline Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current one-document-one-record knowledge builder with a real Stage 1-11 style pipeline that produces inspectable intermediate artifacts and better parents/chunks.

**Architecture:** Keep `buildKnowledgeArtifacts` as the public entrypoint, but restructure it into explicit stage helpers: source manifest, raw extraction, cleaning, routing, structure, promotion, merge, conflict handling, release gating, parent/chunk generation, and coverage audit. Persist the same final version records while enriching the manifest with stage artifacts so UI and debugging can inspect what happened.

**Tech Stack:** TypeScript, Vitest, existing knowledge DB/service layer, local JSONL artifact storage

---

## Chunk 1: Builder Restructure

### Task 1: Lock the new stage behavior with failing tests

**Files:**
- Modify: `src/lib/knowledge/__tests__/builder.test.ts`

- [x] Add a failing workbook extraction test that expects multiple FAQ records from one spreadsheet.
- [x] Add a failing manifest test that expects explicit Stage 1-11 artifact collections and stage counts.
- [x] Run: `npx vitest run --exclude '.worktrees/**' 'src/lib/knowledge/__tests__/builder.test.ts'`

### Task 2: Implement Stage 1-11 builder skeleton

**Files:**
- Modify: `src/lib/knowledge/builder.ts`
- Modify: `src/lib/knowledge/profile.ts`

- [x] Introduce explicit stage helpers inside the builder.
- [x] Add workbook row extraction and composite document section promotion.
- [x] Add stage artifacts to the manifest.
- [x] Tighten generic high-risk defaults so normal knowledge files are not all blocked.

### Task 3: Verify the builder slice

**Files:**
- Modify: `src/lib/knowledge/__tests__/builder.test.ts`
- Modify: `src/lib/knowledge/builder.ts`
- Modify: `src/lib/knowledge/profile.ts`

- [x] Run: `npx vitest run --exclude '.worktrees/**' 'src/lib/knowledge/__tests__/builder.test.ts'`
- [x] Run: `npm run lint -- 'src/lib/knowledge/builder.ts' 'src/lib/knowledge/profile.ts' 'src/lib/knowledge/__tests__/builder.test.ts'`

## Next

- [ ] Run the new builder against the user's real six-document task payload and inspect stage artifact output.
- [ ] Adjust Stage 2 spreadsheet heuristics against real workbook formats that do not follow `Question | Answer`.
- [ ] Tighten Stage 6 promotion for policy/process documents and Stage 8 conflict handling against real customer documents.
