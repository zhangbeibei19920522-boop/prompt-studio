async function collectRoutingRunEvents() {
  vi.resetModules()

  const updateTestRun = vi.fn()
  const updateTestSuite = vi.fn()

  const testProvider = {
    chat: vi.fn(),
    chatStream: vi
      .fn()
      .mockImplementationOnce(async function* () {
        yield "refund"
      })
      .mockImplementationOnce(async function* () {
        yield "请提供订单号，我们为您处理退款。"
      }),
  }

  const evalProvider = {
    chat: vi.fn(async () => `\`\`\`json
{
  "passed": true,
  "score": 92,
  "reason": "回复完整且符合预期"
}
\`\`\``),
    chatStream: vi.fn(),
  }

  const createAiProvider = vi
    .fn()
    .mockReturnValueOnce(testProvider)
    .mockReturnValueOnce(evalProvider)

  vi.doMock("@/lib/ai/provider", () => ({
    createAiProvider,
  }))

  vi.doMock("@/lib/db/repositories/settings", () => ({
    getSettings: () => ({
      provider: "openai",
      apiKey: "eval-key",
      model: "gpt-test",
      baseUrl: "",
    }),
  }))

  vi.doMock("@/lib/db/repositories/test-runs", () => ({
    updateTestRun,
  }))

  vi.doMock("@/lib/db/repositories/test-suites", () => ({
    updateTestSuite,
  }))

  const { runTestSuite } = await import("@/lib/ai/test-runner")

  const suite = {
    id: "suite-1",
    projectId: "project-1",
    sessionId: null,
    name: "Routing Suite",
    description: "",
    promptId: null,
    promptVersionId: null,
    workflowMode: "routing" as const,
    routingConfig: {
      entryPromptId: "prompt-a",
      routes: [{ intent: "refund", promptId: "prompt-b" }],
    },
    config: {
      provider: "openai",
      apiKey: "test-key",
      model: "gpt-test",
      baseUrl: "",
    },
    status: "ready" as const,
    createdAt: "2026-03-20T00:00:00.000Z",
    updatedAt: "2026-03-20T00:00:00.000Z",
  }

  const cases = [
    {
      id: "case-1",
      testSuiteId: "suite-1",
      title: "Refund route",
      context: "用户售后咨询",
      input: "我要退款",
      expectedIntent: "refund",
      expectedOutput: "请提供订单号，我们为您处理退款。",
      sortOrder: 0,
    },
  ]

  const entryPrompt = {
    id: "prompt-a",
    projectId: "project-1",
    title: "Intent Router",
    content: "输出 intent",
    description: "",
    tags: [],
    variables: [],
    version: 1,
    status: "active" as const,
    createdAt: "2026-03-20T00:00:00.000Z",
    updatedAt: "2026-03-20T00:00:00.000Z",
  }

  const replyPrompt = {
    ...entryPrompt,
    id: "prompt-b",
    title: "Refund Reply",
    content: "输出退款回复",
  }

  const events = []
  for await (const event of runTestSuite("run-1", suite, cases, entryPrompt, {
    routePrompts: {
      "prompt-b": replyPrompt,
    },
  })) {
    events.push(event)
  }

  return {
    createAiProvider,
    evalProvider,
    events,
    updateTestRun,
    updateTestSuite,
  }
}

describe("routing test runner", () => {
  it("runs entry prompt first, routes by intent, and stores split routing evaluation data", async () => {
    const { events, updateTestRun } = await collectRoutingRunEvents()

    const executionEvent = events.find((event) => event.type === "test-case-done")
    expect(executionEvent).toMatchObject({
      type: "test-case-done",
      data: {
        caseId: "case-1",
        actualIntent: "refund",
        matchedPromptId: "prompt-b",
        matchedPromptTitle: "Refund Reply",
        actualOutput: "请提供订单号，我们为您处理退款。",
      },
    })

    const evalEvent = events.find((event) => event.type === "eval-case-done")
    expect(evalEvent).toMatchObject({
      type: "eval-case-done",
      data: {
        caseId: "case-1",
        passed: true,
        intentPassed: true,
        intentScore: 100,
        replyPassed: true,
        replyScore: 92,
      },
    })

    expect(updateTestRun).toHaveBeenCalledWith(
      "run-1",
      expect.objectContaining({
        results: [
          expect.objectContaining({
            testCaseId: "case-1",
            actualIntent: "refund",
            matchedPromptId: "prompt-b",
            matchedPromptTitle: "Refund Reply",
            intentPassed: true,
            replyPassed: true,
          }),
        ],
      })
    )
  })

  it("routes each user turn in multi-turn conversations and returns the full assistant transcript", async () => {
    vi.resetModules()

    const updateTestRun = vi.fn()
    const updateTestSuite = vi.fn()

    const testProvider = {
      chat: vi.fn(),
      chatStream: vi
        .fn()
        .mockImplementationOnce(async function* () {
          yield "refund"
        })
        .mockImplementationOnce(async function* () {
          yield "请提供订单号，我来帮您申请退款。"
        })
        .mockImplementationOnce(async function* () {
          yield "refund_progress"
        })
        .mockImplementationOnce(async function* () {
          yield "退款审核通过后，通常 1 到 3 个工作日到账。"
        }),
    }

    const evalProvider = {
      chat: vi.fn(async () => `\`\`\`json
{
  "passed": true,
  "score": 90,
  "reason": "多轮回复符合预期"
}
\`\`\``),
      chatStream: vi.fn(),
    }

    const createAiProvider = vi
      .fn()
      .mockReturnValueOnce(testProvider)
      .mockReturnValueOnce(evalProvider)

    vi.doMock("@/lib/ai/provider", () => ({
      createAiProvider,
    }))

    vi.doMock("@/lib/db/repositories/settings", () => ({
      getSettings: () => ({
        provider: "openai",
        apiKey: "eval-key",
        model: "gpt-test",
        baseUrl: "",
      }),
    }))

    vi.doMock("@/lib/db/repositories/test-runs", () => ({
      updateTestRun,
    }))

    vi.doMock("@/lib/db/repositories/test-suites", () => ({
      updateTestSuite,
    }))

    const { runTestSuite } = await import("@/lib/ai/test-runner")

    const suite = {
      id: "suite-1",
      projectId: "project-1",
      sessionId: null,
      name: "Routing Suite",
      description: "",
      promptId: null,
      promptVersionId: null,
      workflowMode: "routing" as const,
      routingConfig: {
        entryPromptId: "prompt-a",
        routes: [
          { intent: "refund", promptId: "prompt-b" },
          { intent: "refund_progress", promptId: "prompt-c" },
        ],
      },
      config: {
        provider: "openai",
        apiKey: "test-key",
        model: "gpt-test",
        baseUrl: "",
      },
      status: "ready" as const,
      createdAt: "2026-03-20T00:00:00.000Z",
      updatedAt: "2026-03-20T00:00:00.000Z",
    }

    const cases = [
      {
        id: "case-1",
        testSuiteId: "suite-1",
        title: "Refund route multi-turn",
        context: "用户连续追问退款进度",
        input: "User: 我要退款\nAssistant:\nUser: 退款多久能到账？\nAssistant:",
        expectedIntent: "refund",
        expectedOutput:
          "User: 我要退款\nAssistant: 请提供订单号，我来帮您申请退款。\nUser: 退款多久能到账？\nAssistant: 退款审核通过后，通常 1 到 3 个工作日到账。",
        sortOrder: 0,
      },
    ]

    const entryPrompt = {
      id: "prompt-a",
      projectId: "project-1",
      title: "Intent Router",
      content: "输出 intent",
      description: "",
      tags: [],
      variables: [],
      version: 1,
      status: "active" as const,
      createdAt: "2026-03-20T00:00:00.000Z",
      updatedAt: "2026-03-20T00:00:00.000Z",
    }

    const routePromptA = {
      ...entryPrompt,
      id: "prompt-b",
      title: "Refund Reply",
      content: "输出退款处理回复",
    }

    const routePromptB = {
      ...entryPrompt,
      id: "prompt-c",
      title: "Refund Progress Reply",
      content: "输出退款进度回复",
    }

    const events = []
    for await (const event of runTestSuite("run-1", suite, cases, entryPrompt, {
      routePrompts: {
        "prompt-b": routePromptA,
        "prompt-c": routePromptB,
      },
    })) {
      events.push(event)
    }

    const executionEvent = events.find((event) => event.type === "test-case-done")
    expect(executionEvent).toMatchObject({
      type: "test-case-done",
      data: {
        caseId: "case-1",
        actualOutput:
          "User: 我要退款\nAssistant: 请提供订单号，我来帮您申请退款。\nUser: 退款多久能到账？\nAssistant: 退款审核通过后，通常 1 到 3 个工作日到账。",
        actualIntent: "refund\nrefund_progress",
        matchedPromptTitle: "Refund Reply\nRefund Progress Reply",
        routingSteps: [
          {
            turnIndex: 0,
            actualIntent: "refund",
            matchedPromptTitle: "Refund Reply",
            actualReply: "请提供订单号，我来帮您申请退款。",
          },
          {
            turnIndex: 1,
            actualIntent: "refund_progress",
            matchedPromptTitle: "Refund Progress Reply",
            actualReply: "退款审核通过后，通常 1 到 3 个工作日到账。",
          },
        ],
      },
    })

    const evalEvent = events.find((event) => event.type === "eval-case-done")
    expect(evalEvent).toMatchObject({
      type: "eval-case-done",
      data: {
        caseId: "case-1",
        passed: true,
        intentPassed: true,
        intentScore: 100,
        intentReason: "多轮对话暂未配置逐轮期望 intent，跳过路由评估",
        replyPassed: true,
        replyScore: 90,
      },
    })

    expect(testProvider.chatStream).toHaveBeenCalledTimes(4)
    expect(testProvider.chatStream).toHaveBeenNthCalledWith(
      1,
      expect.any(Array),
      { temperature: 0.1, maxTokens: 20 }
    )
    expect(testProvider.chatStream).toHaveBeenNthCalledWith(
      2,
      expect.any(Array),
      { temperature: 0.7 }
    )
    expect(testProvider.chatStream).toHaveBeenNthCalledWith(
      3,
      expect.any(Array),
      { temperature: 0.1, maxTokens: 20 }
    )
    expect(testProvider.chatStream).toHaveBeenNthCalledWith(
      4,
      expect.any(Array),
      { temperature: 0.7 }
    )
  })

  it("treats parenthesized assistant guidance as placeholders instead of replaying them as actual replies", async () => {
    vi.resetModules()

    const updateTestRun = vi.fn()
    const updateTestSuite = vi.fn()

    const testProvider = {
      chat: vi.fn(),
      chatStream: vi
        .fn()
        .mockImplementationOnce(async function* () {
          yield "refund"
        })
        .mockImplementationOnce(async function* () {
          yield "请先提供订单号，我帮您处理退款。"
        })
        .mockImplementationOnce(async function* () {
          yield "refund_progress"
        })
        .mockImplementationOnce(async function* () {
          yield "退款审核通过后，通常 1 到 3 个工作日到账。"
        }),
    }

    const evalProvider = {
      chat: vi.fn(async () => `\`\`\`json
{
  "passed": true,
  "score": 91,
  "reason": "回复内容真实生成"
}
\`\`\``),
      chatStream: vi.fn(),
    }

    const createAiProvider = vi
      .fn()
      .mockReturnValueOnce(testProvider)
      .mockReturnValueOnce(evalProvider)

    vi.doMock("@/lib/ai/provider", () => ({
      createAiProvider,
    }))

    vi.doMock("@/lib/db/repositories/settings", () => ({
      getSettings: () => ({
        provider: "openai",
        apiKey: "eval-key",
        model: "gpt-test",
        baseUrl: "",
      }),
    }))

    vi.doMock("@/lib/db/repositories/test-runs", () => ({
      updateTestRun,
    }))

    vi.doMock("@/lib/db/repositories/test-suites", () => ({
      updateTestSuite,
    }))

    const { runTestSuite } = await import("@/lib/ai/test-runner")

    const suite = {
      id: "suite-1",
      projectId: "project-1",
      sessionId: null,
      name: "Routing Suite",
      description: "",
      promptId: null,
      promptVersionId: null,
      workflowMode: "routing" as const,
      routingConfig: {
        entryPromptId: "prompt-a",
        routes: [
          { intent: "refund", promptId: "prompt-b" },
          { intent: "refund_progress", promptId: "prompt-c" },
        ],
      },
      config: {
        provider: "openai",
        apiKey: "test-key",
        model: "gpt-test",
        baseUrl: "",
      },
      status: "ready" as const,
      createdAt: "2026-03-20T00:00:00.000Z",
      updatedAt: "2026-03-20T00:00:00.000Z",
    }

    const cases = [
      {
        id: "case-1",
        testSuiteId: "suite-1",
        title: "Refund route placeholder guidance",
        context: "用户连续追问退款进度",
        input:
          "User: 我要退款\nAssistant: （应回答退款流程）\nUser: 退款多久能到账？\nAssistant: （应回答到账时间）",
        expectedIntent: "refund",
        expectedOutput:
          "User: 我要退款\nAssistant: 请先提供订单号，我帮您处理退款。\nUser: 退款多久能到账？\nAssistant: 退款审核通过后，通常 1 到 3 个工作日到账。",
        sortOrder: 0,
      },
    ]

    const entryPrompt = {
      id: "prompt-a",
      projectId: "project-1",
      title: "Intent Router",
      content: "输出 intent",
      description: "",
      tags: [],
      variables: [],
      version: 1,
      status: "active" as const,
      createdAt: "2026-03-20T00:00:00.000Z",
      updatedAt: "2026-03-20T00:00:00.000Z",
    }

    const routePromptA = {
      ...entryPrompt,
      id: "prompt-b",
      title: "Refund Reply",
      content: "输出退款处理回复",
    }

    const routePromptB = {
      ...entryPrompt,
      id: "prompt-c",
      title: "Refund Progress Reply",
      content: "输出退款进度回复",
    }

    const events = []
    for await (const event of runTestSuite("run-1", suite, cases, entryPrompt, {
      routePrompts: {
        "prompt-b": routePromptA,
        "prompt-c": routePromptB,
      },
    })) {
      events.push(event)
    }

    const executionEvent = events.find((event) => event.type === "test-case-done")
    expect(executionEvent).toMatchObject({
      type: "test-case-done",
      data: {
        caseId: "case-1",
        actualOutput:
          "User: 我要退款\nAssistant: 请先提供订单号，我帮您处理退款。\nUser: 退款多久能到账？\nAssistant: 退款审核通过后，通常 1 到 3 个工作日到账。",
        routingSteps: [
          expect.objectContaining({ actualIntent: "refund" }),
          expect.objectContaining({ actualIntent: "refund_progress" }),
        ],
      },
    })
  })

  it("supports full-width User/Assistant delimiters and broader assistant guidance phrases", async () => {
    vi.resetModules()

    const updateTestRun = vi.fn()
    const updateTestSuite = vi.fn()

    const testProvider = {
      chat: vi.fn(),
      chatStream: vi
        .fn()
        .mockImplementationOnce(async function* () {
          yield "C"
        })
        .mockImplementationOnce(async function* () {
          yield "你好呀，请问想了解哪款 OPPO 产品？"
        })
        .mockImplementationOnce(async function* () {
          yield "C"
        })
        .mockImplementationOnce(async function* () {
          yield "如果你想听轻松一点的，我可以讲个不涉及产品知识的小笑话。"
        })
        .mockImplementationOnce(async function* () {
          yield "C"
        })
        .mockImplementationOnce(async function* () {
          yield "不客气，如果你还有 OPPO 产品或服务问题，随时告诉我。"
        }),
    }

    const evalProvider = {
      chat: vi.fn(async () => `\`\`\`json
{
  "passed": true,
  "score": 90,
  "reason": "多轮闲聊回复符合预期"
}
\`\`\``),
      chatStream: vi.fn(),
    }

    const createAiProvider = vi
      .fn()
      .mockReturnValueOnce(testProvider)
      .mockReturnValueOnce(evalProvider)

    vi.doMock("@/lib/ai/provider", () => ({
      createAiProvider,
    }))

    vi.doMock("@/lib/db/repositories/settings", () => ({
      getSettings: () => ({
        provider: "openai",
        apiKey: "eval-key",
        model: "gpt-test",
        baseUrl: "",
      }),
    }))

    vi.doMock("@/lib/db/repositories/test-runs", () => ({
      updateTestRun,
    }))

    vi.doMock("@/lib/db/repositories/test-suites", () => ({
      updateTestSuite,
    }))

    const { runTestSuite } = await import("@/lib/ai/test-runner")

    const suite = {
      id: "suite-1",
      projectId: "project-1",
      sessionId: null,
      name: "Routing Suite",
      description: "",
      promptId: null,
      promptVersionId: null,
      workflowMode: "routing" as const,
      routingConfig: {
        entryPromptId: "prompt-a",
        routes: [{ intent: "C", promptId: "prompt-b" }],
      },
      config: {
        provider: "openai",
        apiKey: "test-key",
        model: "gpt-test",
        baseUrl: "",
      },
      status: "ready" as const,
      createdAt: "2026-03-20T00:00:00.000Z",
      updatedAt: "2026-03-20T00:00:00.000Z",
    }

    const cases = [
      {
        id: "case-1",
        testSuiteId: "suite-1",
        title: "Chit-chat full-width delimiters",
        context: "",
        input:
          "User：你好呀\nAssistant：（应简短回应并引导用户说明需求）\nUser：讲个笑话\nAssistant：（应按 C 节点风格处理，避免编造产品知识）\nUser：好吧谢谢\nAssistant：（应礼貌收尾，可引导还有什么 OPPO 产品/服务问题）",
        expectedIntent: "C",
        expectedOutput:
          "User: 你好呀\nAssistant: 你好呀，请问想了解哪款 OPPO 产品？\nUser: 讲个笑话\nAssistant: 如果你想听轻松一点的，我可以讲个不涉及产品知识的小笑话。\nUser: 好吧谢谢\nAssistant: 不客气，如果你还有 OPPO 产品或服务问题，随时告诉我。",
        sortOrder: 0,
      },
    ]

    const entryPrompt = {
      id: "prompt-a",
      projectId: "project-1",
      title: "Intent Router",
      content: "输出 intent",
      description: "",
      tags: [],
      variables: [],
      version: 1,
      status: "active" as const,
      createdAt: "2026-03-20T00:00:00.000Z",
      updatedAt: "2026-03-20T00:00:00.000Z",
    }

    const routePrompt = {
      ...entryPrompt,
      id: "prompt-b",
      title: "Chit Prompt",
      content: "输出闲聊回复",
    }

    const events = []
    for await (const event of runTestSuite("run-1", suite, cases, entryPrompt, {
      routePrompts: {
        "prompt-b": routePrompt,
      },
    })) {
      events.push(event)
    }

    const executionEvent = events.find((event) => event.type === "test-case-done")
    expect(executionEvent).toMatchObject({
      type: "test-case-done",
      data: {
        caseId: "case-1",
        actualOutput:
          "User: 你好呀\nAssistant: 你好呀，请问想了解哪款 OPPO 产品？\nUser: 讲个笑话\nAssistant: 如果你想听轻松一点的，我可以讲个不涉及产品知识的小笑话。\nUser: 好吧谢谢\nAssistant: 不客气，如果你还有 OPPO 产品或服务问题，随时告诉我。",
        routingSteps: [
          expect.objectContaining({ turnIndex: 0, actualIntent: "C" }),
          expect.objectContaining({ turnIndex: 1, actualIntent: "C" }),
          expect.objectContaining({ turnIndex: 2, actualIntent: "C" }),
        ],
      },
    })
  })

  it("treats explanatory router prose as invalid intent and keeps routing errors out of actual output", async () => {
    vi.resetModules()

    const updateTestRun = vi.fn()
    const updateTestSuite = vi.fn()

    const testProvider = {
      chat: vi.fn(),
      chatStream: vi.fn().mockImplementationOnce(async function* () {
        yield "50dB，数据来自实验室 1kHz 单频噪声环境实测。"
      }),
    }

    const evalProvider = {
      chat: vi.fn(async () => `\`\`\`json
{
  "passed": false,
  "score": 0,
  "reason": "未生成最终回复"
}
\`\`\``),
      chatStream: vi.fn(),
    }

    const createAiProvider = vi
      .fn()
      .mockReturnValueOnce(testProvider)
      .mockReturnValueOnce(evalProvider)

    vi.doMock("@/lib/ai/provider", () => ({
      createAiProvider,
    }))

    vi.doMock("@/lib/db/repositories/settings", () => ({
      getSettings: () => ({
        provider: "openai",
        apiKey: "eval-key",
        model: "gpt-test",
        baseUrl: "",
      }),
    }))

    vi.doMock("@/lib/db/repositories/test-runs", () => ({
      updateTestRun,
    }))

    vi.doMock("@/lib/db/repositories/test-suites", () => ({
      updateTestSuite,
    }))

    const { runTestSuite } = await import("@/lib/ai/test-runner")

    const suite = {
      id: "suite-1",
      projectId: "project-1",
      sessionId: null,
      name: "Routing Suite",
      description: "",
      promptId: null,
      promptVersionId: null,
      workflowMode: "routing" as const,
      routingConfig: {
        entryPromptId: "prompt-a",
        routes: [{ intent: "refund", promptId: "prompt-b" }],
      },
      config: {
        provider: "openai",
        apiKey: "test-key",
        model: "gpt-test",
        baseUrl: "",
      },
      status: "ready" as const,
      createdAt: "2026-03-20T00:00:00.000Z",
      updatedAt: "2026-03-20T00:00:00.000Z",
    }

    const cases = [
      {
        id: "case-1",
        testSuiteId: "suite-1",
        title: "Invalid router prose",
        context: "",
        input: "这个手机运行时噪音多大？",
        expectedIntent: "refund",
        expectedOutput: "给出路由后的业务回复",
        sortOrder: 0,
      },
    ]

    const entryPrompt = {
      id: "prompt-a",
      projectId: "project-1",
      title: "Intent Router",
      content: "输出 intent",
      description: "",
      tags: [],
      variables: [],
      version: 1,
      status: "active" as const,
      createdAt: "2026-03-20T00:00:00.000Z",
      updatedAt: "2026-03-20T00:00:00.000Z",
    }

    const events = []
    for await (const event of runTestSuite("run-1", suite, cases, entryPrompt, {
      routePrompts: {},
    })) {
      events.push(event)
    }

    const executionEvent = events.find((event) => event.type === "test-case-done")
    expect(executionEvent).toMatchObject({
      type: "test-case-done",
      data: {
        caseId: "case-1",
        actualIntent: null,
        actualOutput: "",
        routingSteps: [
          expect.objectContaining({
            actualIntent: null,
            actualReply: "",
            routingError: "入口 Prompt 未返回有效的 intent",
          }),
        ],
      },
    })

    const evalEvent = events.find((event) => event.type === "eval-case-done")
    expect(evalEvent).toMatchObject({
      type: "eval-case-done",
      data: {
        caseId: "case-1",
        passed: false,
        replyPassed: false,
        replyReason: "路由未命中目标 Prompt，无法生成最终回复",
      },
    })

    expect(JSON.stringify(executionEvent)).not.toContain("[ROUTING_ERROR]")
  })

  it("stores the raw router output when the entry prompt returns invalid prose", async () => {
    vi.resetModules()

    const updateTestRun = vi.fn()
    const updateTestSuite = vi.fn()

    const invalidRouterOutput = "我不确定，可能要先去查门店信息。"

    const testProvider = {
      chat: vi.fn(),
      chatStream: vi.fn().mockImplementationOnce(async function* () {
        yield invalidRouterOutput
      }),
    }

    const evalProvider = {
      chat: vi.fn(async () => `\`\`\`json
{
  "passed": false,
  "score": 0,
  "reason": "未命中路由"
}
\`\`\``),
      chatStream: vi.fn(),
    }

    const createAiProvider = vi
      .fn()
      .mockReturnValueOnce(testProvider)
      .mockReturnValueOnce(evalProvider)

    vi.doMock("@/lib/ai/provider", () => ({
      createAiProvider,
    }))

    vi.doMock("@/lib/db/repositories/settings", () => ({
      getSettings: () => ({
        provider: "openai",
        apiKey: "eval-key",
        model: "gpt-test",
        baseUrl: "",
      }),
    }))

    vi.doMock("@/lib/db/repositories/test-runs", () => ({
      updateTestRun,
    }))

    vi.doMock("@/lib/db/repositories/test-suites", () => ({
      updateTestSuite,
    }))

    const { runTestSuite } = await import("@/lib/ai/test-runner")

    const suite = {
      id: "suite-1",
      projectId: "project-1",
      sessionId: null,
      name: "Routing Suite",
      description: "",
      promptId: null,
      promptVersionId: null,
      workflowMode: "routing" as const,
      routingConfig: {
        entryPromptId: "prompt-a",
        routes: [{ intent: "refund", promptId: "prompt-b" }],
      },
      config: {
        provider: "openai",
        apiKey: "test-key",
        model: "gpt-test",
        baseUrl: "",
      },
      status: "ready" as const,
      createdAt: "2026-03-20T00:00:00.000Z",
      updatedAt: "2026-03-20T00:00:00.000Z",
    }

    const cases = [
      {
        id: "case-1",
        testSuiteId: "suite-1",
        title: "Invalid router prose",
        context: "",
        input: "营业时间呢？",
        expectedIntent: "refund",
        expectedOutput: "请先提供订单号。",
        sortOrder: 0,
      },
    ]

    const entryPrompt = {
      id: "prompt-a",
      projectId: "project-1",
      title: "Intent Router",
      content: "输出 intent",
      description: "",
      tags: [],
      variables: [],
      version: 1,
      status: "active" as const,
      createdAt: "2026-03-20T00:00:00.000Z",
      updatedAt: "2026-03-20T00:00:00.000Z",
    }

    const events = []
    for await (const event of runTestSuite("run-1", suite, cases, entryPrompt, {
      routePrompts: {},
    })) {
      events.push(event)
    }

    const executionEvent = events.find((event) => event.type === "test-case-done")
    expect(executionEvent).toMatchObject({
      type: "test-case-done",
      data: {
        caseId: "case-1",
        actualIntent: null,
        actualOutput: "",
        routingSteps: [
          expect.objectContaining({
            rawIntent: null,
            rawIntentOutput: invalidRouterOutput,
            actualReply: "",
            routingError: "入口 Prompt 未返回有效的 intent",
          }),
        ],
      },
    })

    expect(updateTestRun).toHaveBeenCalledWith(
      "run-1",
      expect.objectContaining({
        results: [
          expect.objectContaining({
            testCaseId: "case-1",
            routingSteps: [
              expect.objectContaining({
                rawIntentOutput: invalidRouterOutput,
              }),
            ],
          }),
        ],
      })
    )
  })

  it("reuses the previous resolved intent when a later turn returns G", async () => {
    vi.resetModules()

    const updateTestRun = vi.fn()
    const updateTestSuite = vi.fn()

    const testProvider = {
      chat: vi.fn(),
      chatStream: vi
        .fn()
        .mockImplementationOnce(async function* () {
          yield "A"
        })
        .mockImplementationOnce(async function* () {
          yield "这是 A 节点的首轮回复。"
        })
        .mockImplementationOnce(async function* () {
          yield "G"
        })
        .mockImplementationOnce(async function* () {
          yield "这是 A 节点沿用后的第二轮回复。"
        }),
    }

    const evalProvider = {
      chat: vi.fn(async () => `\`\`\`json
{
  "passed": true,
  "score": 93,
  "reason": "G 按上一轮 intent 命中同一子 Prompt"
}
\`\`\``),
      chatStream: vi.fn(),
    }

    const createAiProvider = vi
      .fn()
      .mockReturnValueOnce(testProvider)
      .mockReturnValueOnce(evalProvider)

    vi.doMock("@/lib/ai/provider", () => ({
      createAiProvider,
    }))

    vi.doMock("@/lib/db/repositories/settings", () => ({
      getSettings: () => ({
        provider: "openai",
        apiKey: "eval-key",
        model: "gpt-test",
        baseUrl: "",
      }),
    }))

    vi.doMock("@/lib/db/repositories/test-runs", () => ({
      updateTestRun,
    }))

    vi.doMock("@/lib/db/repositories/test-suites", () => ({
      updateTestSuite,
    }))

    const { runTestSuite } = await import("@/lib/ai/test-runner")

    const suite = {
      id: "suite-1",
      projectId: "project-1",
      sessionId: null,
      name: "Routing Suite",
      description: "",
      promptId: null,
      promptVersionId: null,
      workflowMode: "routing" as const,
      routingConfig: {
        entryPromptId: "prompt-a",
        routes: [
          { intent: "A", promptId: "prompt-b" },
          { intent: "B", promptId: "prompt-c" },
        ],
      },
      config: {
        provider: "openai",
        apiKey: "test-key",
        model: "gpt-test",
        baseUrl: "",
      },
      status: "ready" as const,
      createdAt: "2026-03-20T00:00:00.000Z",
      updatedAt: "2026-03-20T00:00:00.000Z",
    }

    const cases = [
      {
        id: "case-1",
        testSuiteId: "suite-1",
        title: "Reuse previous intent with G",
        context: "第二轮仍应进入同一业务节点",
        input: "User: 第一轮问题\nAssistant:\nUser: 第二轮追问\nAssistant:",
        expectedIntent: "A",
        expectedOutput:
          "User: 第一轮问题\nAssistant: 这是 A 节点的首轮回复。\nUser: 第二轮追问\nAssistant: 这是 A 节点沿用后的第二轮回复。",
        sortOrder: 0,
      },
    ]

    const entryPrompt = {
      id: "prompt-a",
      projectId: "project-1",
      title: "Intent Router",
      content: "输出 intent",
      description: "",
      tags: [],
      variables: [],
      version: 1,
      status: "active" as const,
      createdAt: "2026-03-20T00:00:00.000Z",
      updatedAt: "2026-03-20T00:00:00.000Z",
    }

    const routePromptA = {
      ...entryPrompt,
      id: "prompt-b",
      title: "Reply A",
      content: "输出 A 节点回复",
    }

    const routePromptB = {
      ...entryPrompt,
      id: "prompt-c",
      title: "Reply B",
      content: "输出 B 节点回复",
    }

    const events = []
    for await (const event of runTestSuite("run-1", suite, cases, entryPrompt, {
      routePrompts: {
        "prompt-b": routePromptA,
        "prompt-c": routePromptB,
      },
    })) {
      events.push(event)
    }

    const executionEvent = events.find((event) => event.type === "test-case-done")
    expect(executionEvent).toMatchObject({
      type: "test-case-done",
      data: {
        caseId: "case-1",
        actualIntent: "A\nA",
        matchedPromptId: "prompt-b\nprompt-b",
        matchedPromptTitle: "Reply A\nReply A",
        actualOutput:
          "User: 第一轮问题\nAssistant: 这是 A 节点的首轮回复。\nUser: 第二轮追问\nAssistant: 这是 A 节点沿用后的第二轮回复。",
        routingSteps: [
          {
            turnIndex: 0,
            rawIntent: "A",
            actualIntent: "A",
            matchedPromptId: "prompt-b",
            matchedPromptTitle: "Reply A",
            actualReply: "这是 A 节点的首轮回复。",
          },
          {
            turnIndex: 1,
            rawIntent: "G",
            actualIntent: "A",
            matchedPromptId: "prompt-b",
            matchedPromptTitle: "Reply A",
            actualReply: "这是 A 节点沿用后的第二轮回复。",
          },
        ],
      },
    })
  })

  it("logs routing prompt requests, responses, prompt ids, and model metadata for each generated turn", async () => {
    vi.resetModules()

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {})
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    const updateTestRun = vi.fn()
    const updateTestSuite = vi.fn()

    const testProvider = {
      chat: vi.fn(),
      chatStream: vi
        .fn()
        .mockImplementationOnce(async function* () {
          yield "P-SQ"
        })
        .mockImplementationOnce(async function* () {
          yield "Enco X3 降噪深度 50dB。"
        })
        .mockImplementationOnce(async function* () {
          yield "P-SQ"
        })
        .mockImplementationOnce(async function* () {
          yield "降噪深度具体是 50dB。"
        }),
    }

    const evalProvider = {
      chat: vi.fn(async () => `\`\`\`json
{
  "passed": true,
  "score": 90,
  "reason": "日志测试"
}
\`\`\``),
      chatStream: vi.fn(),
    }

    const createAiProvider = vi
      .fn()
      .mockReturnValueOnce(testProvider)
      .mockReturnValueOnce(evalProvider)

    vi.doMock("@/lib/ai/provider", () => ({
      createAiProvider,
    }))

    vi.doMock("@/lib/db/repositories/settings", () => ({
      getSettings: () => ({
        provider: "openai",
        apiKey: "eval-key",
        model: "gpt-eval",
        baseUrl: "",
      }),
    }))

    vi.doMock("@/lib/db/repositories/test-runs", () => ({
      updateTestRun,
    }))

    vi.doMock("@/lib/db/repositories/test-suites", () => ({
      updateTestSuite,
    }))

    const { runTestSuite } = await import("@/lib/ai/test-runner")

    const suite = {
      id: "suite-1",
      projectId: "project-1",
      sessionId: null,
      name: "Routing Suite",
      description: "",
      promptId: null,
      promptVersionId: null,
      workflowMode: "routing" as const,
      routingConfig: {
        entryPromptId: "prompt-a",
        routes: [{ intent: "P-SQ", promptId: "prompt-b" }],
      },
      config: {
        provider: "deepseek",
        apiKey: "test-key",
        model: "deepseek-chat",
        baseUrl: "https://api.deepseek.com/v1",
      },
      status: "ready" as const,
      createdAt: "2026-03-20T00:00:00.000Z",
      updatedAt: "2026-03-20T00:00:00.000Z",
    }

    const cases = [
      {
        id: "case-1",
        testSuiteId: "suite-1",
        title: "Enco X3 multi-turn route",
        context: "用户咨询耳机参数",
        input:
          "User: 想了解一下Enco X3，降噪怎么样？\nAssistant:\nUser: 那它降噪深度具体多少？\nAssistant:",
        expectedIntent: "P-SQ\nP-SQ",
        expectedOutput:
          "User: 想了解一下Enco X3，降噪怎么样？\nAssistant: Enco X3 降噪深度 50dB。\nUser: 那它降噪深度具体多少？\nAssistant: 降噪深度具体是 50dB。",
        sortOrder: 0,
      },
    ]

    const entryPrompt = {
      id: "prompt-a",
      projectId: "project-1",
      title: "Intent Router",
      content: "只输出 intent",
      description: "",
      tags: [],
      variables: [],
      version: 1,
      status: "active" as const,
      createdAt: "2026-03-20T00:00:00.000Z",
      updatedAt: "2026-03-20T00:00:00.000Z",
    }

    const routePrompt = {
      ...entryPrompt,
      id: "prompt-b",
      title: "P-SQ",
      content: "输出参数答案",
    }

    for await (const _event of runTestSuite("run-1", suite, cases, entryPrompt, {
      routePrompts: {
        "prompt-b": routePrompt,
      },
    })) {
      // consume all events
    }

    const debugCalls = logSpy.mock.calls
      .filter(([label]) => label === "[TestPromptExecution]")
      .map(([, payload]) => payload)

    expect(debugCalls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          workflowMode: "routing",
          stage: "entry",
          caseId: "case-1",
          caseTitle: "Enco X3 multi-turn route",
          turnIndex: 1,
          provider: "deepseek",
          model: "deepseek-chat",
          promptId: "prompt-a",
          promptTitle: "Intent Router",
          rawResponse: "P-SQ",
          resolvedIntent: "P-SQ",
          matchedPromptId: "prompt-b",
          matchedPromptTitle: "P-SQ",
          messages: [
            { role: "system", content: "只输出 intent" },
            { role: "system", content: "Context: 用户咨询耳机参数" },
            { role: "user", content: "想了解一下Enco X3，降噪怎么样？" },
            { role: "assistant", content: "Enco X3 降噪深度 50dB。" },
            { role: "user", content: "那它降噪深度具体多少？" },
          ],
        }),
        expect.objectContaining({
          workflowMode: "routing",
          stage: "target",
          caseId: "case-1",
          caseTitle: "Enco X3 multi-turn route",
          turnIndex: 1,
          provider: "deepseek",
          model: "deepseek-chat",
          promptId: "prompt-b",
          promptTitle: "P-SQ",
          rawResponse: "降噪深度具体是 50dB。",
          messages: [
            { role: "system", content: "输出参数答案" },
            { role: "system", content: "Context: 用户咨询耳机参数" },
            { role: "user", content: "想了解一下Enco X3，降噪怎么样？" },
            { role: "assistant", content: "Enco X3 降噪深度 50dB。" },
            { role: "user", content: "那它降噪深度具体多少？" },
          ],
        }),
      ])
    )

    expect(errorSpy).not.toHaveBeenCalledWith("[TestPromptExecution]", expect.anything())

    logSpy.mockRestore()
    errorSpy.mockRestore()
  })

  it("logs single-prompt requests, responses, prompt ids, and model metadata for multi-turn generations", async () => {
    vi.resetModules()

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {})
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    const updateTestRun = vi.fn()
    const updateTestSuite = vi.fn()

    const testProvider = {
      chat: vi.fn(),
      chatStream: vi
        .fn()
        .mockImplementationOnce(async function* () {
          yield "先回答第一轮。"
        })
        .mockImplementationOnce(async function* () {
          yield "再回答第二轮。"
        }),
    }

    const evalProvider = {
      chat: vi.fn(async () => `\`\`\`json
{
  "passed": true,
  "score": 88,
  "reason": "单 Prompt 日志测试"
}
\`\`\``),
      chatStream: vi.fn(),
    }

    const createAiProvider = vi
      .fn()
      .mockReturnValueOnce(testProvider)
      .mockReturnValueOnce(evalProvider)

    vi.doMock("@/lib/ai/provider", () => ({
      createAiProvider,
    }))

    vi.doMock("@/lib/db/repositories/settings", () => ({
      getSettings: () => ({
        provider: "openai",
        apiKey: "eval-key",
        model: "gpt-eval",
        baseUrl: "",
      }),
    }))

    vi.doMock("@/lib/db/repositories/test-runs", () => ({
      updateTestRun,
    }))

    vi.doMock("@/lib/db/repositories/test-suites", () => ({
      updateTestSuite,
    }))

    const { runTestSuite } = await import("@/lib/ai/test-runner")

    const suite = {
      id: "suite-1",
      projectId: "project-1",
      sessionId: null,
      name: "Single Suite",
      description: "",
      promptId: "prompt-a",
      promptVersionId: null,
      workflowMode: "single" as const,
      routingConfig: null,
      config: {
        provider: "qwen",
        apiKey: "test-key",
        model: "qwen-max",
        baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
      },
      status: "ready" as const,
      createdAt: "2026-03-20T00:00:00.000Z",
      updatedAt: "2026-03-20T00:00:00.000Z",
    }

    const cases = [
      {
        id: "case-1",
        testSuiteId: "suite-1",
        title: "Single prompt multi-turn",
        context: "用户咨询门店信息",
        input: "User: 营业时间呢？\nAssistant:\nUser: 周末开吗？\nAssistant:",
        expectedIntent: null,
        expectedOutput:
          "User: 营业时间呢？\nAssistant: 先回答第一轮。\nUser: 周末开吗？\nAssistant: 再回答第二轮。",
        sortOrder: 0,
      },
    ]

    const prompt = {
      id: "prompt-a",
      projectId: "project-1",
      title: "Single Prompt",
      content: "直接回答用户问题",
      description: "",
      tags: [],
      variables: [],
      version: 1,
      status: "active" as const,
      createdAt: "2026-03-20T00:00:00.000Z",
      updatedAt: "2026-03-20T00:00:00.000Z",
    }

    for await (const _event of runTestSuite("run-1", suite, cases, prompt)) {
      // consume all events
    }

    const debugCalls = logSpy.mock.calls
      .filter(([label]) => label === "[TestPromptExecution]")
      .map(([, payload]) => payload)

    expect(debugCalls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          workflowMode: "single",
          stage: "single",
          caseId: "case-1",
          caseTitle: "Single prompt multi-turn",
          turnIndex: 1,
          provider: "qwen",
          model: "qwen-max",
          promptId: "prompt-a",
          promptTitle: "Single Prompt",
          rawResponse: "再回答第二轮。",
          messages: [
            { role: "system", content: "直接回答用户问题" },
            { role: "system", content: "Context: 用户咨询门店信息" },
            { role: "user", content: "营业时间呢？" },
            { role: "assistant", content: "先回答第一轮。" },
            { role: "user", content: "周末开吗？" },
          ],
        }),
      ])
    )

    expect(errorSpy).not.toHaveBeenCalledWith("[TestPromptExecution]", expect.anything())

    logSpy.mockRestore()
    errorSpy.mockRestore()
  })
})
