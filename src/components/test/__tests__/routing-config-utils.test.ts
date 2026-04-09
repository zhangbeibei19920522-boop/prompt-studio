describe("routing config utils", () => {
  it("normalizes intent-like names by trimming, lowercasing, and collapsing separators", async () => {
    let mod: Awaited<typeof import("../routing-config-utils")> | null = null

    try {
      mod = await import("../routing-config-utils")
    } catch {
      mod = null
    }

    expect(mod?.normalizeRoutingKey("  After_Sale-Flow  ")).toBe("aftersaleflow")
    expect(mod?.normalizeRoutingKey("After Sale Flow")).toBe("aftersaleflow")
  })

  it("builds routes from non-entry prompts while preserving prompt order", async () => {
    let mod: Awaited<typeof import("../routing-config-utils")> | null = null

    try {
      mod = await import("../routing-config-utils")
    } catch {
      mod = null
    }

    expect(
      mod?.buildRoutesFromPrompts(
        [
          { id: "entry", title: "Intent Router" },
          { id: "prompt-a", title: "after_sale" },
          { id: "prompt-b", title: "refund" },
        ],
        "entry"
      )
    ).toEqual([
      { intent: "after_sale", promptId: "prompt-a" },
      { intent: "refund", promptId: "prompt-b" },
    ])
  })

  it("finds a unique prompt match by normalized title and ignores ambiguous duplicates", async () => {
    let mod: Awaited<typeof import("../routing-config-utils")> | null = null

    try {
      mod = await import("../routing-config-utils")
    } catch {
      mod = null
    }

    const prompts = [
      { id: "entry", title: "Intent Router" },
      { id: "prompt-a", title: "After Sale" },
      { id: "prompt-b", title: "Refund" },
      { id: "prompt-c", title: "refund" },
    ]

    expect(mod?.findUniquePromptMatch("after_sale", prompts, "entry")).toEqual({
      id: "prompt-a",
      title: "After Sale",
    })
    expect(mod?.findUniquePromptMatch("refund", prompts, "entry")).toBeNull()
    expect(mod?.findUniquePromptMatch("Intent Router", prompts, "entry")).toBeNull()
  })
})
