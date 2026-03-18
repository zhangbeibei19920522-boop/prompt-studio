# Conversation Audit Upload Fixed Height Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep the conversation-audit create form stable by making both upload areas fixed-height with internal scrolling for long selected-file lists.

**Architecture:** Limit the change to the upload card UI inside `ConversationAuditDetail`. Add a failing regression test for reserved upload-card height and empty-state rendering, then minimally refactor the upload card so its list area always exists and scrolls internally.

**Tech Stack:** Next.js, React, TypeScript, Vitest, react-dom/server, Tailwind CSS

---

## Chunk 1: Add regression coverage for stable upload-card layout

### Task 1: Extend the create-mode test

**Files:**
- Modify: `src/components/audit/__tests__/conversation-audit-detail.test.tsx`

- [ ] **Step 1: Write a failing test for fixed-height upload cards**

```tsx
it('renders upload cards with reserved file-list space and internal scrolling', () => {
  const html = renderCreateMode()

  expect(html).toContain('h-[22rem]')
  expect(html).toContain('overflow-y-auto')
  expect(html).toContain('尚未选择文件')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/components/audit/__tests__/conversation-audit-detail.test.tsx`
Expected: FAIL because the current upload card only renders the file-list block when files exist and does not use fixed-height layout.

- [ ] **Step 3: Commit**

```bash
git add src/components/audit/__tests__/conversation-audit-detail.test.tsx
git commit -m "test: cover fixed-height audit upload cards"
```

## Chunk 2: Implement the fixed-height upload-card layout

### Task 2: Refactor the upload card

**Files:**
- Modify: `src/components/audit/conversation-audit-detail.tsx`
- Test: `src/components/audit/__tests__/conversation-audit-detail.test.tsx`

- [ ] **Step 1: Implement a fixed-height card shell**

Give each upload card a fixed overall height and split it into:

- a top drag area
- a bottom file-list region with reserved height

- [ ] **Step 2: Make the file-list region always render**

Show:

- an empty-state hint when no files are selected
- the selected files when present
- internal scrolling when the list is long

- [ ] **Step 3: Run the targeted test**

Run: `npm run test:run -- src/components/audit/__tests__/conversation-audit-detail.test.tsx`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/components/audit/conversation-audit-detail.tsx src/components/audit/__tests__/conversation-audit-detail.test.tsx
git commit -m "fix: keep conversation audit upload actions visible"
```

## Chunk 3: Verify related behavior still passes

### Task 3: Run verification

**Files:**
- Modify: none

- [ ] **Step 1: Run the focused create-mode test**

Run: `npm run test:run -- src/components/audit/__tests__/conversation-audit-detail.test.tsx`
Expected: PASS

- [ ] **Step 2: Run related conversation-audit route tests**

Run: `npm run test:run -- src/components/audit/__tests__/conversation-audit-detail.test.tsx src/app/api/__tests__/conversation-audit-jobs-route.test.ts src/app/api/__tests__/conversation-audit-run-route.test.ts`
Expected: PASS

- [ ] **Step 3: Run lint on touched files**

Run: `npm run lint -- src/components/audit/conversation-audit-detail.tsx src/components/audit/__tests__/conversation-audit-detail.test.tsx`
Expected: PASS
