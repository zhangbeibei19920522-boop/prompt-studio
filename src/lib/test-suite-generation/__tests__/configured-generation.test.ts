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

  it("includes embedding config for unit index version generation", () => {
    const request = {
      section: "unit" as const,
      structure: "single" as const,
      promptId: null,
      routingConfig: null,
      targetType: "index-version" as const,
      targetId: "kb-index-2024-04-20",
      embeddingRequestUrl: "https://embedding.example.com/v1/embeddings",
      embeddingModelName: "text-embedding-v4",
      caseCount: 8,
      conversationMode: "single-turn" as const,
      minTurns: null,
      maxTurns: null,
      generationSourceIds: [],
    }

    const references = buildGenerationReferences(request)
    const content = buildGenerationContent(request, references)

    expect(content).toContain("Embedding 请求 URL：https://embedding.example.com/v1/embeddings。")
    expect(content).toContain("Embedding 模型名称：text-embedding-v4。")
  })
})
