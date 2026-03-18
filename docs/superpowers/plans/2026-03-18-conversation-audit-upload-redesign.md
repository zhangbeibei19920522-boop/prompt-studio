# Conversation Audit Upload Redesign Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the conversation-audit create-page file inputs with prominent drag-and-drop upload areas while keeping the existing create API unchanged.

**Architecture:** Keep the change entirely in the create-mode UI of the conversation audit detail component. Add test coverage for the new file selection behavior first, then implement drag-and-drop upload cards that feed the existing `historyFile` and `knowledgeFiles` state.

**Tech Stack:** Next.js, React, TypeScript, Vitest, Testing Library, Tailwind CSS, lucide-react

---

## Chunk 1: Define and test the new upload interactions

### Task 1: Add create-mode tests for upload cards

**Files:**
- Modify: `src/components/audit/__tests__/conversation-audit-detail.test.tsx`

- [ ] **Step 1: Write a failing test for mixed-format knowledge uploads**

```tsx
it('accepts mixed-format knowledge files from the create form', async () => {
  renderCreateMode()

  const input = screen.getByLabelText('知识库文件上传')
  await user.upload(input, [
    new File(['doc'], 'policy.docx', {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    }),
    new File(['html'], 'faq.html', { type: 'text/html' }),
    new File(['sheet'], 'rules.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }),
  ])

  expect(screen.getByText('已选择 3 个文件')).toBeInTheDocument()
  expect(screen.getByText('policy.docx')).toBeInTheDocument()
  expect(screen.getByText('faq.html')).toBeInTheDocument()
  expect(screen.getByText('rules.xlsx')).toBeInTheDocument()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/components/audit/__tests__/conversation-audit-detail.test.tsx`
Expected: FAIL because the create form does not expose the new upload card labels or selected-file summary yet.

- [ ] **Step 3: Write a failing test for history upload replacement**

```tsx
it('replaces the selected history workbook when a new file is chosen', async () => {
  renderCreateMode()

  const input = screen.getByLabelText('历史对话文件上传')
  await user.upload(input, new File(['a'], 'history-a.xlsx', { type: EXCEL_MIME }))
  await user.upload(input, new File(['b'], 'history-b.xlsx', { type: EXCEL_MIME }))

  expect(screen.queryByText('history-a.xlsx')).not.toBeInTheDocument()
  expect(screen.getByText('history-b.xlsx')).toBeInTheDocument()
})
```

- [ ] **Step 4: Run test to verify it fails**

Run: `npm run test:run -- src/components/audit/__tests__/conversation-audit-detail.test.tsx`
Expected: FAIL because the selected history file summary does not yet behave like the upload card design.

- [ ] **Step 5: Commit**

```bash
git add src/components/audit/__tests__/conversation-audit-detail.test.tsx
git commit -m "test: cover conversation audit upload cards"
```

## Chunk 2: Implement drag-and-drop upload cards

### Task 2: Build the upload-card UI in create mode

**Files:**
- Modify: `src/components/audit/conversation-audit-detail.tsx`
- Test: `src/components/audit/__tests__/conversation-audit-detail.test.tsx`

- [ ] **Step 1: Implement minimal upload-card helpers**

Add focused create-mode helpers for:

- hidden file input wiring
- click-to-open behavior
- drag enter / drag leave / drop highlighting
- single-file history selection
- multi-file knowledge selection

- [ ] **Step 2: Replace the two native file inputs with upload cards**

Render two prominent cards with:

- clear title
- format guidance
- “点击上传或拖拽文件到此处”
- selected file summary

- [ ] **Step 3: Run the targeted test file**

Run: `npm run test:run -- src/components/audit/__tests__/conversation-audit-detail.test.tsx`
Expected: PASS

- [ ] **Step 4: Refactor only if needed**

If the component grows unwieldy, extract a small local helper component without changing behavior.

- [ ] **Step 5: Commit**

```bash
git add src/components/audit/conversation-audit-detail.tsx src/components/audit/__tests__/conversation-audit-detail.test.tsx
git commit -m "feat: redesign conversation audit upload areas"
```

## Chunk 3: Verify the UI change against project baselines

### Task 3: Run verification

**Files:**
- Modify: none

- [ ] **Step 1: Run the focused upload tests**

Run: `npm run test:run -- src/components/audit/__tests__/conversation-audit-detail.test.tsx`
Expected: PASS

- [ ] **Step 2: Run the broader conversation-audit test suite**

Run: `npm run test:run -- src/components/audit/__tests__/conversation-audit-detail.test.tsx src/app/api/__tests__/conversation-audit-jobs-route.test.ts src/app/api/__tests__/conversation-audit-run-route.test.ts`
Expected: PASS

- [ ] **Step 3: Commit any final documentation or cleanup if needed**

```bash
git add <changed-files>
git commit -m "chore: finalize conversation audit upload polish"
```
