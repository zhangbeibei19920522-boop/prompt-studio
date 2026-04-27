describe("test runner progress persistence", () => {
  it("persists execution progress immediately after each case finishes", async () => {
    vi.resetModules()

    const updateTestRun = vi.fn()
    const updateTestSuite = vi.fn()

    const testProvider = {
      chat: vi.fn(),
      chatStream: vi.fn(async function* () {
        yield "first reply"
      }),
    }

    const createAiProvider = vi.fn().mockReturnValue(testProvider)

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
      section: "full-flow" as const,
      name: "Single Suite",
      description: "",
      promptId: "prompt-a",
      promptVersionId: null,
      workflowMode: "single" as const,
      routingConfig: null,
      config: {
        provider: "openai",
        apiKey: "test-key",
        model: "gpt-test",
        baseUrl: "",
      },
      status: "ready" as const,
      createdAt: "2026-04-10T00:00:00.000Z",
      updatedAt: "2026-04-10T00:00:00.000Z",
    }

    const cases = [
      {
        id: "case-1",
        testSuiteId: "suite-1",
        title: "Case 1",
        context: "",
        input: "hello",
        expectedIntent: null,
        expectedOutput: "first reply",
        sortOrder: 0,
      },
    ]

    const prompt = {
      id: "prompt-a",
      projectId: "project-1",
      title: "Prompt A",
      content: "reply",
      description: "",
      tags: [],
      variables: [],
      version: 1,
      status: "active" as const,
      createdAt: "2026-04-10T00:00:00.000Z",
      updatedAt: "2026-04-10T00:00:00.000Z",
    }

    const generator = runTestSuite("run-1", suite, cases, prompt)

    await expect(generator.next()).resolves.toMatchObject({
      value: { type: "test-start" },
      done: false,
    })
    await expect(generator.next()).resolves.toMatchObject({
      value: { type: "test-case-start" },
      done: false,
    })
    await expect(generator.next()).resolves.toMatchObject({
      value: {
        type: "test-case-done",
        data: {
          caseId: "case-1",
          actualOutput: "first reply",
        },
      },
      done: false,
    })

    expect(updateTestRun).toHaveBeenCalledWith(
      "run-1",
      expect.objectContaining({
        status: "running",
        results: [
          expect.objectContaining({
            testCaseId: "case-1",
            actualOutput: "first reply",
            passed: false,
          }),
        ],
      })
    )

    await generator.return(undefined)
  })

  it("persists partial eval progress while a suite is still running", async () => {
    vi.resetModules()

    const updateTestRun = vi.fn()
    const updateTestSuite = vi.fn()

    const testProvider = {
      chat: vi.fn(),
      chatStream: vi
        .fn()
        .mockImplementationOnce(async function* () {
          yield "first reply"
        })
        .mockImplementationOnce(async function* () {
          yield "second reply"
        }),
    }

    const evalProvider = {
      chat: vi
        .fn()
        .mockResolvedValueOnce(`\`\`\`json
{
  "passed": true,
  "score": 90,
  "reason": "第一条通过"
}
\`\`\``)
        .mockResolvedValueOnce(`\`\`\`json
{
  "passed": true,
  "score": 95,
  "reason": "第二条通过"
}
\`\`\``)
        .mockResolvedValueOnce(`\`\`\`json
{
  "summary": "完成",
  "totalCases": 2,
  "passedCases": 2,
  "score": 93,
  "improvements": [],
  "details": "完成"
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
      section: "full-flow" as const,
      name: "Single Suite",
      description: "",
      promptId: "prompt-a",
      promptVersionId: null,
      workflowMode: "single" as const,
      routingConfig: null,
      config: {
        provider: "openai",
        apiKey: "test-key",
        model: "gpt-test",
        baseUrl: "",
      },
      status: "ready" as const,
      createdAt: "2026-04-10T00:00:00.000Z",
      updatedAt: "2026-04-10T00:00:00.000Z",
    }

    const cases = [
      {
        id: "case-1",
        testSuiteId: "suite-1",
        title: "Case 1",
        context: "",
        input: "hello",
        expectedIntent: null,
        expectedOutput: "first reply",
        sortOrder: 0,
      },
      {
        id: "case-2",
        testSuiteId: "suite-1",
        title: "Case 2",
        context: "",
        input: "hi again",
        expectedIntent: null,
        expectedOutput: "second reply",
        sortOrder: 1,
      },
    ]

    const prompt = {
      id: "prompt-a",
      projectId: "project-1",
      title: "Prompt A",
      content: "reply",
      description: "",
      tags: [],
      variables: [],
      version: 1,
      status: "active" as const,
      createdAt: "2026-04-10T00:00:00.000Z",
      updatedAt: "2026-04-10T00:00:00.000Z",
    }

    for await (const event of runTestSuite("run-1", suite, cases, prompt)) {
      expect(event).toBeDefined()
    }

    const runningUpdates = updateTestRun.mock.calls
      .filter(([id, update]) => id === "run-1" && update.status === "running")
      .map(([, update]) => update)

    expect(runningUpdates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          results: [
            expect.objectContaining({
              testCaseId: "case-1",
              passed: true,
              score: 90,
            }),
            expect.objectContaining({
              testCaseId: "case-2",
              actualOutput: "second reply",
              passed: false,
              score: 0,
            }),
          ],
        }),
      ]),
    )
  })
})
