import {
  buildGenerationContent,
  buildGenerationReferences,
} from "@/lib/test-suite-generation/configured-generation"

describe("configured generation", () => {
  it("summarizes routing rules with index version targets", () => {
    const request = {
      section: "full-flow" as const,
      structure: "multi" as const,
      promptId: null,
      routingConfig: {
        entryPromptId: "prompt-a",
        routes: [
          {
            intent: "faq_search",
            targetType: "index-version" as const,
            targetId: "kb-index-2024-04-20",
          },
        ],
      },
      targetType: "prompt" as const,
      targetId: null,
      caseCount: 10,
      conversationMode: "single-turn" as const,
      minTurns: null,
      maxTurns: null,
      generationSourceIds: [],
    }

    const references = buildGenerationReferences(request)
    const content = buildGenerationContent(request, references)

    expect(content).toContain("faq_search -> 索引版本：kb-index-2024-04-20")
  })
})
