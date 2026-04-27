import {
  buildGenerationContent,
  buildGenerationMetadataForCase,
  buildGenerationReferences,
  normalizeGenerationDocumentRouteModes,
  validateGeneratedCasesAgainstDocumentRouteModes,
  validateGenerationDocumentRouteModes,
} from "@/lib/test-suite-generation/configured-generation"

describe("configured generation", () => {
  it("rejects selected documents without route-mode config", () => {
    expect(() =>
      validateGenerationDocumentRouteModes({
        generationSourceIds: ["document:doc-a", "prompt:prompt-a"],
        generationDocumentRouteModes: [],
      })
    ).toThrow("Each selected document must declare a route mode")
  })

  it("rejects non-string generation source ids", () => {
    expect(() =>
      validateGenerationDocumentRouteModes({
        generationSourceIds: [123] as never,
        generationDocumentRouteModes: [],
      })
    ).toThrow("Generation source ids must be strings")
  })

  it("rejects duplicate or unselected document route-mode entries", () => {
    expect(() =>
      validateGenerationDocumentRouteModes({
        generationSourceIds: ["document:doc-a"],
        generationDocumentRouteModes: [
          { documentId: "doc-a", routeMode: "rag" },
          { documentId: "doc-a", routeMode: "non-r" },
        ],
      })
    ).toThrow("Duplicate document route mode")

    expect(() =>
      validateGenerationDocumentRouteModes({
        generationSourceIds: ["document:doc-a"],
        generationDocumentRouteModes: [{ documentId: "doc-b", routeMode: "rag" }],
      })
    ).toThrow("Document route mode references an unselected document")
  })

  it("rejects unsupported document route modes", () => {
    expect(() =>
      validateGenerationDocumentRouteModes({
        generationSourceIds: ["document:doc-a"],
        generationDocumentRouteModes: [{ documentId: "doc-a", routeMode: "unknown" }] as never,
      })
    ).toThrow("Document route mode must be rag or non-r")
  })

  it("defaults legacy document selections to non-r when route-mode config is missing", () => {
    expect(
      normalizeGenerationDocumentRouteModes({
        generationSourceIds: ["prompt:prompt-a", "document:doc-a", "document:doc-b"],
      })
    ).toEqual([
      { documentId: "doc-a", routeMode: "non-r" },
      { documentId: "doc-b", routeMode: "non-r" },
    ])
  })

  it("rejects generated cases that miss source documents or violate route-mode intent rules", () => {
    expect(() =>
      validateGeneratedCasesAgainstDocumentRouteModes(
        [
          {
            title: "退款问题",
            context: "",
            input: "退款多久到账？",
            expectedOutput: "说明退款时效",
          },
        ],
        {
          generationSourceIds: ["document:doc-a"],
          generationDocumentRouteModes: [{ documentId: "doc-a", routeMode: "rag" }],
          workflowMode: "routing",
        }
      )
    ).toThrow("Each generated case must include a sourceDocumentId")

    expect(() =>
      validateGeneratedCasesAgainstDocumentRouteModes(
        [
          {
            title: "退款问题",
            context: "",
            input: "退款多久到账？",
            sourceDocumentId: "doc-a",
            expectedIntent: "P-SQ",
            expectedOutput: "说明退款时效",
          },
        ],
        {
          generationSourceIds: ["document:doc-a"],
          generationDocumentRouteModes: [{ documentId: "doc-a", routeMode: "rag" }],
          workflowMode: "routing",
        }
      )
    ).toThrow("RAG document cases must use expectedIntent = R")

    expect(() =>
      validateGeneratedCasesAgainstDocumentRouteModes(
        [
          {
            title: "退款问题",
            context: "",
            input: "退款多久到账？",
            sourceDocumentId: "doc-a",
            expectedIntent: "R",
            expectedOutput: "说明退款时效",
          },
        ],
        {
          generationSourceIds: ["document:doc-a"],
          generationDocumentRouteModes: [{ documentId: "doc-a", routeMode: "non-r" }],
          workflowMode: "routing",
        }
      )
    ).toThrow("Non-R document cases must not use expectedIntent = R")
  })

  it("builds generation metadata from the source document route-mode config", () => {
    expect(
      buildGenerationMetadataForCase(
        {
          title: "退款问题",
          context: "",
          input: "退款多久到账？",
          sourceDocumentId: "doc-a",
          expectedOutput: "说明退款时效",
        },
        {
          generationSourceIds: ["document:doc-a"],
          generationDocumentRouteModes: [{ documentId: "doc-a", routeMode: "rag" }],
        }
      )
    ).toEqual({
      sourceDocumentId: "doc-a",
      sourceDocumentName: "doc-a",
      sourceRouteMode: "rag",
    })
  })

  it("summarizes routing rules with index version targets", () => {
    const request = {
      suiteName: "客服路由流程测试",
      suiteLanguage: "zh" as const,
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
      generationDocumentRouteModes: [],
    }

    const references = buildGenerationReferences(request)
    const content = buildGenerationContent(request, references)

    expect(content).toContain("faq_search -> 索引版本：kb-index-2024-04-20")
  })

  it("includes embedding config for unit index version generation", () => {
    const request = {
      suiteName: "索引版本召回测试",
      suiteLanguage: "zh" as const,
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
      generationDocumentRouteModes: [],
    }

    const references = buildGenerationReferences(request)
    const content = buildGenerationContent(request, references)

    expect(content).toContain("Embedding 请求 URL：https://embedding.example.com/v1/embeddings。")
    expect(content).toContain("Embedding 模型名称：text-embedding-v4。")
  })

  it("uses configured suite name for pending suite titles", async () => {
    const { buildPendingSuiteName } = await import("@/lib/test-suite-generation/configured-generation")

    const request = {
      suiteName: "手动命名测试集",
      suiteLanguage: "zh" as const,
      section: "unit" as const,
      structure: "single" as const,
      promptId: null,
      routingConfig: null,
      targetType: "prompt" as const,
      targetId: "prompt-a",
      caseCount: 5,
      conversationMode: "single-turn" as const,
      minTurns: null,
      maxTurns: null,
      generationSourceIds: [],
      generationDocumentRouteModes: [],
    }

    expect(buildPendingSuiteName(request)).toBe("手动命名测试集")
  })

  it("adds english generation instruction when suite language is english", () => {
    const request = {
      suiteName: "English suite",
      suiteLanguage: "en" as const,
      section: "unit" as const,
      structure: "single" as const,
      promptId: null,
      routingConfig: null,
      targetType: "prompt" as const,
      targetId: "prompt-a",
      caseCount: 5,
      conversationMode: "single-turn" as const,
      minTurns: null,
      maxTurns: null,
      generationSourceIds: [],
      generationDocumentRouteModes: [],
    }

    const references = buildGenerationReferences(request)
    const content = buildGenerationContent(request, references)

    expect(content).toContain("测试集语言：英文。")
    expect(content).toContain("请使用英文生成测试用例标题、输入、期望输出和相关说明。")
  })
})
