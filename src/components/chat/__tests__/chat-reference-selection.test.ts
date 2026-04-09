import { describe, expect, test } from "vitest"

import type { MessageReference } from "@/types/database"

describe("chat reference selection helpers", () => {
  test("reports fully-selected state only when every item of the type is selected", async () => {
    let mod: Awaited<typeof import("../chat-reference-selection")> | null = null

    try {
      mod = await import("../chat-reference-selection")
    } catch {
      mod = null
    }

    const references: MessageReference[] = [
      { type: "prompt", id: "prompt-a", title: "Prompt A" },
      { type: "prompt", id: "prompt-b", title: "Prompt B" },
      { type: "document", id: "doc-a", title: "Doc A" },
    ]

    expect(
      mod?.areAllReferencesSelected(references, "prompt", [
        { id: "prompt-a", label: "Prompt A" },
        { id: "prompt-b", label: "Prompt B" },
      ])
    ).toBe(true)

    expect(
      mod?.areAllReferencesSelected(references, "document", [
        { id: "doc-a", label: "Doc A" },
        { id: "doc-b", label: "Doc B" },
      ])
    ).toBe(false)
  })

  test("selects all references of a type while preserving the other type", async () => {
    let mod: Awaited<typeof import("../chat-reference-selection")> | null = null

    try {
      mod = await import("../chat-reference-selection")
    } catch {
      mod = null
    }

    const references: MessageReference[] = [
      { type: "prompt", id: "prompt-a", title: "Prompt A" },
      { type: "document", id: "doc-a", title: "Doc A" },
    ]

    expect(
      mod?.toggleAllReferencesForType(references, "prompt", [
        { id: "prompt-a", label: "Prompt A" },
        { id: "prompt-b", label: "Prompt B" },
      ])
    ).toEqual([
      { type: "document", id: "doc-a", title: "Doc A" },
      { type: "prompt", id: "prompt-a", title: "Prompt A" },
      { type: "prompt", id: "prompt-b", title: "Prompt B" },
    ])
  })

  test("clears all references of a type when they are already fully selected", async () => {
    let mod: Awaited<typeof import("../chat-reference-selection")> | null = null

    try {
      mod = await import("../chat-reference-selection")
    } catch {
      mod = null
    }

    const references: MessageReference[] = [
      { type: "prompt", id: "prompt-a", title: "Prompt A" },
      { type: "prompt", id: "prompt-b", title: "Prompt B" },
      { type: "document", id: "doc-a", title: "Doc A" },
    ]

    expect(
      mod?.toggleAllReferencesForType(references, "prompt", [
        { id: "prompt-a", label: "Prompt A" },
        { id: "prompt-b", label: "Prompt B" },
      ])
    ).toEqual([{ type: "document", id: "doc-a", title: "Doc A" }])
  })
})
