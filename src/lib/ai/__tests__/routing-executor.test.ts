import { executeRoutingPromptForCase } from "@/lib/ai/routing-executor"

describe("routing executor", () => {
  it("accepts long intent names and still routes to the target prompt", async () => {
    const longIntent = "P-TV_Cdmtv_Warranty_Accessories_Power_Compliance"
    const provider = {
      chat: vi.fn(),
      chatStream: vi
        .fn()
        .mockImplementationOnce(async function* () {
          yield longIntent
        })
        .mockImplementationOnce(async function* () {
          yield "The warranty is one year and the remote is included."
        }),
    }

    const entryPrompt = {
      id: "prompt-router",
      projectId: "project-1",
      title: "Intent Router",
      content: "Only output the route intent.",
      description: "",
      tags: [],
      variables: [],
      version: 1,
      status: "active" as const,
      createdAt: "2026-04-23T00:00:00.000Z",
      updatedAt: "2026-04-23T00:00:00.000Z",
    }

    const replyPrompt = {
      ...entryPrompt,
      id: "prompt-reply",
      title: "Warranty Reply",
      content: "Answer warranty questions.",
    }

    const testCase = {
      id: "case-1",
      testSuiteId: "suite-1",
      title: "Warranty question",
      context: "",
      input: "For model 43H6570G, how long is the warranty?",
      expectedOutput: "",
      expectedIntent: longIntent,
      sortOrder: 0,
    }

    const suite = {
      id: "suite-1",
      projectId: "project-1",
      sessionId: null,
      section: "full-flow" as const,
      name: "Routing Suite",
      description: "",
      promptId: null,
      promptVersionId: null,
      workflowMode: "routing" as const,
      routingConfig: {
        entryPromptId: entryPrompt.id,
        routes: [{ intent: longIntent, promptId: replyPrompt.id }],
      },
      config: {
        provider: "openai",
        apiKey: "test-key",
        model: "gpt-test",
        baseUrl: "",
      },
      status: "ready" as const,
      createdAt: "2026-04-23T00:00:00.000Z",
      updatedAt: "2026-04-23T00:00:00.000Z",
    }

    const result = await executeRoutingPromptForCase(
      provider,
      entryPrompt,
      testCase,
      suite,
      {
        routePrompts: {
          [replyPrompt.id]: replyPrompt,
        },
      }
    )

    expect(result).toMatchObject({
      actualIntent: longIntent,
      matchedPromptId: replyPrompt.id,
      matchedPromptTitle: "Warranty Reply",
      actualOutput: "The warranty is one year and the remote is included.",
      routingSteps: [
        {
          turnIndex: 0,
          rawIntent: longIntent,
          rawIntentOutput: longIntent,
          actualIntent: longIntent,
          matchedPromptId: replyPrompt.id,
          matchedPromptTitle: "Warranty Reply",
          actualReply: "The warranty is one year and the remote is included.",
        },
      ],
    })
  })

  it("executes R routes through index retrieval and answer generation", async () => {
    vi.resetModules()

    const ensureIndexIngestForIndexVersionId = vi.fn(() => ({
      backfilled: true,
      queryVector: [0.1, 0.2],
      ingest: {
        parents: [],
        chunks: [],
      },
    }))
    const searchIndexIngest = vi.fn(() => ({
      results: [
        {
          docId: "doc-reset",
          question: "How do I reset the router?",
          score: 0.99,
          matchLane: "exact_alias",
          metadata: { isExactFaq: true },
          matchedChunks: [
            {
              chunkId: "chunk-1",
              chunkIndex: 1,
              chunkKind: "steps",
              sectionTitle: "Steps",
              chunkText: "Hold the reset button for 10 seconds.",
            },
          ],
        },
      ],
    }))
    const generateAnswer = vi.fn(async () => ({
      answerText: "Hold the reset button for 10 seconds.",
      answerMode: "extractive",
      selectedDocId: "doc-reset",
      selectedChunkIds: ["chunk-1"],
      selectionMargin: 0.5,
      evidenceText: "Steps\nHold the reset button for 10 seconds.",
    }))

    vi.doMock("@/lib/knowledge/index-ingest", () => ({
      ensureIndexIngestForIndexVersionId,
    }))
    vi.doMock("@/lib/ai/rag/retriever", () => ({
      searchIndexIngest,
    }))
    vi.doMock("@/lib/ai/rag/llm-reranker", () => ({
      createGlobalRagLlmReranker: vi.fn(() => null),
    }))
    vi.doMock("@/lib/ai/rag/answer-generator", () => ({
      generateAnswer,
    }))

    const { executeRoutingPromptForCase: executeRagRoute } = await import("@/lib/ai/routing-executor")

    const provider = {
      chat: vi.fn(),
      chatStream: vi.fn().mockImplementationOnce(async function* () {
        yield "R"
      }),
    }

    const entryPrompt = {
      id: "prompt-router",
      projectId: "project-1",
      title: "Intent Router",
      content: "Only output the route intent.",
      description: "",
      tags: [],
      variables: [],
      version: 1,
      status: "active" as const,
      createdAt: "2026-04-23T00:00:00.000Z",
      updatedAt: "2026-04-23T00:00:00.000Z",
    }

    const ragPrompt = {
      ...entryPrompt,
      id: "prompt-rag",
      title: "RAG Reply",
      content: "Use this evidence:\n{rag_qas_text}",
    }

    const testCase = {
      id: "case-rag",
      testSuiteId: "suite-1",
      title: "Router reset question",
      context: "",
      input: "How do I reset the router?",
      expectedOutput: "",
      expectedIntent: "R",
      sortOrder: 0,
    }

    const suite = {
      id: "suite-1",
      projectId: "project-1",
      sessionId: null,
      section: "full-flow" as const,
      name: "Routing Suite",
      description: "",
      promptId: null,
      promptVersionId: null,
      workflowMode: "routing" as const,
      routingConfig: {
        entryPromptId: entryPrompt.id,
        routes: [
          {
            intent: "R",
            promptId: "",
            targetType: "prompt" as const,
            targetId: "",
            ragPromptId: ragPrompt.id,
            ragIndexVersionId: "index-1",
          },
        ],
      },
      config: {
        provider: "openai",
        apiKey: "test-key",
        model: "gpt-test",
        baseUrl: "",
      },
      status: "ready" as const,
      createdAt: "2026-04-23T00:00:00.000Z",
      updatedAt: "2026-04-23T00:00:00.000Z",
    }

    const result = await executeRagRoute(
      provider,
      entryPrompt,
      testCase,
      suite,
      {
        routePrompts: {
          [ragPrompt.id]: ragPrompt,
        },
      }
    )

    expect(ensureIndexIngestForIndexVersionId).toHaveBeenCalledWith("index-1", {
      query: "How do I reset the router?",
    })
    expect(searchIndexIngest).toHaveBeenCalledWith({
      query: "How do I reset the router?",
      ingest: {
        parents: [],
        chunks: [],
      },
      topK: 10,
      queryVector: [0.1, 0.2],
    })
    expect(generateAnswer).toHaveBeenCalledWith(
      expect.objectContaining({
        query: "How do I reset the router?",
        promptTemplate: "Use this evidence:\n{rag_qas_text}",
      }),
    )
    expect(result).toMatchObject({
      actualIntent: "R",
      matchedPromptId: "prompt-rag",
      matchedPromptTitle: "RAG Reply",
      actualOutput: "Hold the reset button for 10 seconds.",
      routingSteps: [
        {
          routeMode: "rag",
          ragPromptId: "prompt-rag",
          ragIndexVersionId: "index-1",
          retrievalTopK: 10,
          selectedDocId: "doc-reset",
          selectedChunkIds: ["chunk-1"],
          selectionMargin: 0.5,
          answerMode: "extractive",
          ingestBackfilled: true,
          actualReply: "Hold the reset button for 10 seconds.",
        },
      ],
    })
  })

  it("applies global LLM rerank to R route retrieval candidates", async () => {
    vi.resetModules()

    const ensureIndexIngestForIndexVersionId = vi.fn(() => ({
      backfilled: false,
      queryVector: [0.1, 0.2],
      ingest: {
        parents: [],
        chunks: [],
      },
    }))
    const stage2Results = [
      {
        docId: "doc-stage2",
        question: "Cloud sync overview",
        score: 0.9,
        matchedChunks: [],
        metadata: {},
      },
      {
        docId: "doc-llm",
        question: "Cloud sync mechanism",
        score: 0.4,
        matchedChunks: [],
        metadata: {},
      },
    ]
    const rerankedResults = [
      {
        ...stage2Results[1],
        llmRerankScore: 10,
        llmRerankCombinedScore: 0.95,
      },
    ]
    const searchIndexIngest = vi.fn(() => ({ results: stage2Results }))
    const rerank = vi.fn(async () => rerankedResults)
    const generateAnswer = vi.fn(async () => ({
      answerText: "LLM reranked answer",
      answerMode: "llm_fallback",
      selectedDocId: "doc-llm",
      selectedChunkIds: [],
      selectionMargin: 0.1,
      evidenceText: "[1] ...",
    }))

    vi.doMock("@/lib/knowledge/index-ingest", () => ({
      ensureIndexIngestForIndexVersionId,
    }))
    vi.doMock("@/lib/ai/rag/retriever", () => ({
      searchIndexIngest,
    }))
    vi.doMock("@/lib/ai/rag/llm-reranker", () => ({
      createGlobalRagLlmReranker: vi.fn(() => ({ rerank })),
    }))
    vi.doMock("@/lib/ai/rag/answer-generator", () => ({
      generateAnswer,
    }))

    const { executeRoutingPromptForCase: executeRagRoute } = await import("@/lib/ai/routing-executor")
    const provider = {
      chat: vi.fn(),
      chatStream: vi.fn().mockImplementationOnce(async function* () {
        yield "R"
      }),
    }
    const entryPrompt = {
      id: "prompt-router",
      projectId: "project-1",
      title: "Intent Router",
      content: "Only output the route intent.",
      description: "",
      tags: [],
      variables: [],
      version: 1,
      status: "active" as const,
      createdAt: "2026-04-23T00:00:00.000Z",
      updatedAt: "2026-04-23T00:00:00.000Z",
    }
    const ragPrompt = {
      ...entryPrompt,
      id: "prompt-rag",
      title: "RAG Reply",
      content: "Use this evidence:\n{rag_qas_text}",
    }
    const testCase = {
      id: "case-rag-rerank",
      testSuiteId: "suite-1",
      title: "Cloud sync",
      context: "",
      input: "How does cloud sync work?",
      expectedOutput: "",
      expectedIntent: "R",
      sortOrder: 0,
    }
    const suite = {
      id: "suite-1",
      projectId: "project-1",
      sessionId: null,
      section: "full-flow" as const,
      name: "Routing Suite",
      description: "",
      promptId: null,
      promptVersionId: null,
      workflowMode: "routing" as const,
      routingConfig: {
        entryPromptId: entryPrompt.id,
        routes: [
          {
            intent: "R",
            promptId: "",
            targetType: "prompt" as const,
            targetId: "",
            ragPromptId: ragPrompt.id,
            ragIndexVersionId: "index-1",
          },
        ],
      },
      config: {
        provider: "openai",
        apiKey: "test-key",
        model: "gpt-test",
        baseUrl: "",
      },
      status: "ready" as const,
      createdAt: "2026-04-23T00:00:00.000Z",
      updatedAt: "2026-04-23T00:00:00.000Z",
    }

    await executeRagRoute(provider, entryPrompt, testCase, suite, {
      routePrompts: {
        [ragPrompt.id]: ragPrompt,
      },
    })

    expect(searchIndexIngest).toHaveBeenCalledWith({
      query: "How does cloud sync work?",
      ingest: {
        parents: [],
        chunks: [],
      },
      topK: 40,
      queryVector: [0.1, 0.2],
    })
    expect(rerank).toHaveBeenCalledWith("How does cloud sync work?", stage2Results, 10)
    expect(generateAnswer).toHaveBeenCalledWith(
      expect.objectContaining({
        recallResults: rerankedResults,
      }),
    )
  })

  it("passes context and conversation history into RAG answer generation", async () => {
    vi.resetModules()

    const ensureIndexIngestForIndexVersionId = vi.fn(() => ({
      backfilled: false,
      ingest: {
        parents: [],
        chunks: [],
      },
    }))
    const searchIndexIngest = vi.fn(() => ({
      results: [
        {
          docId: "doc-router-reset",
          question: "How do I reset the router?",
          score: 0.62,
          matchLane: "hybrid",
          metadata: {},
          matchedChunks: [
            {
              chunkId: "chunk-2",
              chunkIndex: 1,
              chunkKind: "steps",
              sectionTitle: "步骤",
              chunkText: "Hold the reset button for 10 seconds.",
            },
          ],
        },
      ],
    }))
    const generateAnswer = vi.fn(async () => ({
      answerText: "请长按复位键 10 秒。",
      answerMode: "llm_fallback",
      selectedDocId: "doc-router-reset",
      selectedChunkIds: ["chunk-2"],
      selectionMargin: 0.08,
      evidenceText: "[1] ...",
    }))

    vi.doMock("@/lib/knowledge/index-ingest", () => ({
      ensureIndexIngestForIndexVersionId,
    }))
    vi.doMock("@/lib/ai/rag/retriever", () => ({
      searchIndexIngest,
    }))
    vi.doMock("@/lib/ai/rag/llm-reranker", () => ({
      createGlobalRagLlmReranker: vi.fn(() => null),
    }))
    vi.doMock("@/lib/ai/rag/answer-generator", () => ({
      generateAnswer,
    }))

    const { executeRoutingPromptForCase: executeRagRoute } = await import("@/lib/ai/routing-executor")

    const provider = {
      chat: vi.fn(),
      chatStream: vi.fn().mockImplementationOnce(async function* () {
        yield "R"
      }),
    }

    const entryPrompt = {
      id: "prompt-router",
      projectId: "project-1",
      title: "Intent Router",
      content: "Only output the route intent.",
      description: "",
      tags: [],
      variables: [],
      version: 1,
      status: "active" as const,
      createdAt: "2026-04-23T00:00:00.000Z",
      updatedAt: "2026-04-23T00:00:00.000Z",
    }

    const ragPrompt = {
      ...entryPrompt,
      id: "prompt-rag",
      title: "RAG Reply",
      content: "Use this evidence:\n{rag_qas_text}",
    }

    const testCase = {
      id: "case-rag-history",
      testSuiteId: "suite-1",
      title: "Router reset followup",
      context: "设备型号：AX3000",
      input: "User: 我刚才已经登录后台了\nAssistant: 好的，请继续描述问题。\nUser: 怎么恢复出厂设置？\nAssistant:",
      expectedOutput: "",
      expectedIntent: "R",
      sortOrder: 0,
    }

    const suite = {
      id: "suite-1",
      projectId: "project-1",
      sessionId: null,
      section: "full-flow" as const,
      name: "Routing Suite",
      description: "",
      promptId: null,
      promptVersionId: null,
      workflowMode: "routing" as const,
      routingConfig: {
        entryPromptId: entryPrompt.id,
        routes: [
          {
            intent: "R",
            promptId: "",
            targetType: "prompt" as const,
            targetId: "",
            ragPromptId: ragPrompt.id,
            ragIndexVersionId: "index-1",
          },
        ],
      },
      config: {
        provider: "openai",
        apiKey: "test-key",
        model: "gpt-test",
        baseUrl: "",
      },
      status: "ready" as const,
      createdAt: "2026-04-23T00:00:00.000Z",
      updatedAt: "2026-04-23T00:00:00.000Z",
    }

    await executeRagRoute(
      provider,
      entryPrompt,
      testCase,
      suite,
      {
        routePrompts: {
          [ragPrompt.id]: ragPrompt,
        },
      }
    )

    expect(generateAnswer).toHaveBeenCalledWith(
      expect.objectContaining({
        query: "怎么恢复出厂设置？",
        contextMessages: [
          { role: "system", content: "Context: 设备型号：AX3000" },
          { role: "user", content: "我刚才已经登录后台了" },
          { role: "assistant", content: "好的，请继续描述问题。" },
          { role: "user", content: "怎么恢复出厂设置？" },
        ],
      }),
    )
  })

  it("reports a routing error when the R prompt is missing the rag placeholder", async () => {
    vi.resetModules()

    const ensureIndexIngestForIndexVersionId = vi.fn(() => ({
      backfilled: false,
      ingest: { parents: [], chunks: [] },
    }))
    const searchIndexIngest = vi.fn(() => ({ results: [] }))

    vi.doMock("@/lib/knowledge/index-ingest", () => ({
      ensureIndexIngestForIndexVersionId,
    }))
    vi.doMock("@/lib/ai/rag/retriever", () => ({
      searchIndexIngest,
    }))
    vi.doMock("@/lib/ai/rag/llm-reranker", () => ({
      createGlobalRagLlmReranker: vi.fn(() => null),
    }))

    const { executeRoutingPromptForCase: executeRagRoute } = await import("@/lib/ai/routing-executor")

    const provider = {
      chat: vi.fn(),
      chatStream: vi.fn().mockImplementationOnce(async function* () {
        yield "R"
      }),
    }

    const entryPrompt = {
      id: "prompt-router",
      projectId: "project-1",
      title: "Intent Router",
      content: "Only output the route intent.",
      description: "",
      tags: [],
      variables: [],
      version: 1,
      status: "active" as const,
      createdAt: "2026-04-23T00:00:00.000Z",
      updatedAt: "2026-04-23T00:00:00.000Z",
    }

    const ragPrompt = {
      ...entryPrompt,
      id: "prompt-rag",
      title: "Broken RAG Reply",
      content: "Use this evidence directly.",
    }

    const result = await executeRagRoute(
      provider,
      entryPrompt,
      {
        id: "case-rag",
        testSuiteId: "suite-1",
        title: "Router reset question",
        context: "",
        input: "How do I reset the router?",
        expectedOutput: "",
        expectedIntent: "R",
        sortOrder: 0,
      },
      {
        id: "suite-1",
        projectId: "project-1",
        sessionId: null,
        section: "full-flow" as const,
        name: "Routing Suite",
        description: "",
        promptId: null,
        promptVersionId: null,
        workflowMode: "routing" as const,
        routingConfig: {
          entryPromptId: entryPrompt.id,
          routes: [
            {
              intent: "R",
              promptId: "",
              targetType: "prompt" as const,
              targetId: "",
              ragPromptId: ragPrompt.id,
              ragIndexVersionId: "index-1",
            },
          ],
        },
        config: {
          provider: "openai",
          apiKey: "test-key",
          model: "gpt-test",
          baseUrl: "",
        },
        status: "ready" as const,
        createdAt: "2026-04-23T00:00:00.000Z",
        updatedAt: "2026-04-23T00:00:00.000Z",
      },
      {
        routePrompts: {
          [ragPrompt.id]: ragPrompt,
        },
      }
    )

    expect(result.routingSteps[0]).toMatchObject({
      routeMode: "rag",
      ragPromptId: "prompt-rag",
      ragIndexVersionId: "index-1",
      actualReply: "",
      routingError: expect.stringContaining("{rag_qas_text}"),
    })
    expect(result.actualOutput).toBe("")
  })
})
