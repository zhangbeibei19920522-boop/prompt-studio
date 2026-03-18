# Conversation Audit Upload Compact Layout Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce the overall size of the conversation-audit upload cards while preserving fixed height and internal file-list scrolling.

**Architecture:** Keep the change scoped to the upload card in `ConversationAuditDetail`. Add a failing regression test for the new smaller fixed height, then minimally reduce card height, drag-area spacing, icon size, and file-list height to match.

**Tech Stack:** Next.js, React, TypeScript, Vitest, react-dom/server, Tailwind CSS

---

## Chunk 1: Lock the new compact layout in tests

### Task 1: Update the upload-card regression test

**Files:**
- Modify: `src/components/audit/__tests__/conversation-audit-detail.test.tsx`

- [ ] **Step 1: Write a failing test for the reduced card height**

```tsx
it('renders a more compact fixed-height upload card', () => {
  const html = renderCreateMode()

  expect(html).toContain('h-[18rem]')
  expect(html).not.toContain('h-[22rem]')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/components/audit/__tests__/conversation-audit-detail.test.tsx`
Expected: FAIL because the current card still uses the taller layout.

## Chunk 2: Implement the compact upload card

### Task 2: Reduce the fixed layout values

**Files:**
- Modify: `src/components/audit/conversation-audit-detail.tsx`
- Test: `src/components/audit/__tests__/conversation-audit-detail.test.tsx`

- [ ] **Step 1: Reduce overall card height**

Lower the fixed card height to a smaller value while keeping the card shell fixed.

- [ ] **Step 2: Reduce drag-area spacing**

Shrink:

- upload icon size
- drag-area gap
- drag-area vertical padding

- [ ] **Step 3: Reduce file-list height**

Keep internal scrolling, but shrink the reserved file-list area to fit the more compact card.

- [ ] **Step 4: Run the targeted test**

Run: `npm run test:run -- src/components/audit/__tests__/conversation-audit-detail.test.tsx`
Expected: PASS

## Chunk 3: Verify the compact layout does not regress behavior

### Task 3: Run verification

**Files:**
- Modify: none

- [ ] **Step 1: Run related tests**

Run: `npm run test:run -- src/components/audit/__tests__/conversation-audit-detail.test.tsx src/app/api/__tests__/conversation-audit-jobs-route.test.ts src/app/api/__tests__/conversation-audit-run-route.test.ts`
Expected: PASS

- [ ] **Step 2: Lint touched files**

Run: `npm run lint -- src/components/audit/conversation-audit-detail.tsx src/components/audit/__tests__/conversation-audit-detail.test.tsx`
Expected: PASS
