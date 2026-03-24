# Conversational Workspace Redesign Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a real conversational workspace shell that keeps chat as the entry point while elevating Prompt, Test, and Audit into first-class workspaces.

**Architecture:** Add a new workspace shell component tree and swap the main page to use it. Reuse the current chat, test, audit, and prompt content components so the redesign focuses on navigation, layout, and interaction model rather than rewriting backend behavior.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Tailwind CSS v4, shadcn/ui, Vitest

---

## Chunk 1: Workspace Shell

### Task 1: Add failing shell test

**Files:**
- Test: `src/components/workspace/__tests__/workspace-frame.test.tsx`

- [x] **Step 1: Write the failing test**
- [x] **Step 2: Run test to verify it fails**
  Run: `npm test -- --run src/components/workspace/__tests__/workspace-frame.test.tsx`
  Expected: FAIL because `workspace-frame` does not exist yet.

### Task 2: Implement workspace frame and overlays

**Files:**
- Create: `src/components/workspace/workspace-frame.tsx`
- Create: `src/components/workspace/workspace-command-palette.tsx`
- Create: `src/components/workspace/workspace-knowledge-drawer.tsx`
- Modify: `src/app/globals.css`

- [ ] **Step 1: Implement the shell structure**
- [ ] **Step 2: Add command palette and knowledge drawer**
- [ ] **Step 3: Add supporting visual styles**
- [ ] **Step 4: Re-run shell test**

## Chunk 2: Main Page Integration

### Task 3: Swap the main page to the new workspace shell

**Files:**
- Modify: `src/app/(main)/page.tsx`

- [ ] **Step 1: Replace old top bar / sidebar / right panel layout**
- [ ] **Step 2: Mount chat, prompt, test, and audit views into the new workspace**
- [ ] **Step 3: Wire command palette actions and asset recall**
- [ ] **Step 4: Wire knowledge drawer document preview and upload entry**

## Chunk 3: Verification

### Task 4: Verify the redesign

**Files:**
- Modify: `.gitignore`

- [ ] **Step 1: Ignore `.superpowers/` artifacts**
- [ ] **Step 2: Run targeted tests**
  Run: `npm test -- --run src/components/workspace/__tests__/workspace-frame.test.tsx`
- [ ] **Step 3: Run lint or broader test slice if feasible**
  Run: `npm test -- --run src/components/workspace/__tests__/workspace-frame.test.tsx src/components/test/__tests__/test-suite-detail.test.tsx`
- [ ] **Step 4: Report actual verification results**
