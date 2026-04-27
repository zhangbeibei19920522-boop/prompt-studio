import fs from "node:fs"
import os from "node:os"
import path from "node:path"

async function setupTestSuiteRouteTest() {
  const originalCwd = process.cwd()
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "test-suites-route-"))

  process.chdir(tempDir)
  vi.resetModules()

  const { getDb } = await import("@/lib/db")
  const db = getDb()
  const now = "2026-03-20T00:00:00.000Z"

  db.prepare(`
    INSERT INTO projects (
      id,
      name,
      description,
      business_description,
      business_goal,
      business_background,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run("project-1", "Project 1", "", "", "", "", now, now)

  db.prepare(`
    INSERT INTO prompts (
      id,
      project_id,
      title,
      content,
      description,
      tags,
      variables,
      version,
      status,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run("prompt-a", "project-1", "Intent Router", "router", "", "[]", "[]", 1, "active", now, now)

  db.prepare(`
    INSERT INTO prompts (
      id,
      project_id,
      title,
      content,
      description,
      tags,
      variables,
      version,
      status,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run("prompt-b", "project-1", "Reply Prompt", "reply", "", "[]", "[]", 1, "active", now, now)

  db.prepare(`
    INSERT INTO prompts (
      id,
      project_id,
      title,
      content,
      description,
      tags,
      variables,
      version,
      status,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run("prompt-c", "project-1", "Repair Reply", "repair reply", "", "[]", "[]", 1, "active", now, now)

  db.prepare(`
    INSERT INTO prompts (
      id,
      project_id,
      title,
      content,
      description,
      tags,
      variables,
      version,
      status,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run("prompt-d", "project-1", "客服主 Prompt", "single prompt", "", "[]", "[]", 1, "active", now, now)

  db.prepare(`
    INSERT INTO documents (
      id,
      project_id,
      name,
      type,
      content,
      created_at
    ) VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    "doc-1",
    "project-1",
    "退款政策.docx",
    "docx",
    "退款政策说明：7 天无理由、退款到账时效、物流要求。",
    now
  )

  return {
    cleanup() {
      db.close()
      process.chdir(originalCwd)
      fs.rmSync(tempDir, { recursive: true, force: true })
    },
  }
}

async function waitFor<T>(
  getter: () => Promise<T>,
  predicate: (value: T) => boolean,
  timeoutMs: number = 1500
) {
  const startedAt = Date.now()

  while (Date.now() - startedAt < timeoutMs) {
    const value = await getter()
    if (predicate(value)) {
      return value
    }
    await new Promise((resolve) => setTimeout(resolve, 20))
  }

  throw new Error("Timed out waiting for async generation state")
}

describe("test suite routes", () => {
  it("resumes queued generation jobs when listing project generation jobs", async () => {
    const testContext = await setupTestSuiteRouteTest()
    vi.resetModules()

    const resumeConfiguredTestSuiteGenerationJobs = vi.fn()

    vi.doMock("@/lib/test-suite-generation/job-scheduler", () => ({
      resumeConfiguredTestSuiteGenerationJobs,
    }))

    try {
      const { getDb } = await import("@/lib/db")
      const db = getDb()
      const now = "2026-03-20T00:10:00.000Z"

      db.prepare(`
        INSERT INTO test_suites (
          id,
          project_id,
          section,
          name,
          description,
          prompt_id,
          workflow_mode,
          config,
          status,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        "suite-queued",
        "project-1",
        "full-flow",
        "待生成测试集",
        "",
        "prompt-d",
        "single",
        "{}",
        "draft",
        now,
        now
      )

      db.prepare(`
        INSERT INTO test_suite_generation_jobs (
          id,
          project_id,
          suite_id,
          status,
          generated_count,
          total_count,
          request_json,
          error_message,
          created_at,
          updated_at,
          completed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        "job-queued",
        "project-1",
        "suite-queued",
        "queued",
        0,
        4,
        JSON.stringify({
          suiteName: "待生成测试集",
          suiteLanguage: "zh",
          section: "full-flow",
          structure: "single",
          promptId: "prompt-d",
          routingConfig: null,
          targetType: "prompt",
          targetId: null,
          caseCount: 4,
          conversationMode: "single-turn",
          minTurns: null,
          maxTurns: null,
          generationSourceIds: ["document:doc-1"],
        }),
        null,
        now,
        now,
        null
      )

      const jobsRoute = await import("@/app/api/projects/[id]/test-suite-generation-jobs/route")
      const response = await jobsRoute.GET(new Request("http://localhost"), {
        params: Promise.resolve({ id: "project-1" }),
      })
      const payload = await response.json()

      expect(response.status).toBe(200)
      expect(payload.success).toBe(true)
      expect(resumeConfiguredTestSuiteGenerationJobs).toHaveBeenCalledWith("project-1")
      expect(payload.data).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: "job-queued",
            status: "queued",
          }),
        ])
      )
    } finally {
      vi.doUnmock("@/lib/test-suite-generation/job-scheduler")
      testContext.cleanup()
    }
  })

  it("creates a configured single-prompt generation job and persists the generated suite", async () => {
    const testContext = await setupTestSuiteRouteTest()
    vi.resetModules()

    const chatStream = vi
      .fn()
      .mockImplementationOnce(async function* () {
        yield "退款通常会在审核通过后 1 到 3 个工作日内到账。"
      })
      .mockImplementationOnce(async function* () {
        yield "退货寄回时需要保留商品完整并按售后指引提供物流信息。"
      })

    const handleTestAgentChat = vi.fn(async function* (_sessionId: string, content: string, references: Array<{ type: string; id: string; title: string }>) {
      expect(content).toContain("单 Prompt")
      expect(content).toContain("客服主 Prompt")
      expect(content).toContain("生成 4 个测试用例")
      expect(content).toContain("多轮对话")
      expect(content).toContain("2-4")
      expect(references).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ type: "prompt", id: "prompt-d", title: "客服主 Prompt" }),
          expect.objectContaining({ type: "document", id: "doc-1", title: "退款政策.docx" }),
        ])
      )

      yield {
        type: "test-suite-progress",
        data: {
          generated: 2,
          total: 4,
        },
      }

      yield {
        type: "test-suite",
        data: {
          name: "客服主 Prompt 全流程测试",
          description: "覆盖退款与售后咨询场景",
          workflowMode: "single",
          cases: [
            {
              title: "退款政策咨询",
              context: "用户想了解退款时效",
              input: "User: 退款多久能到账？\nAssistant:\nUser: 物流寄回有什么要求？\nAssistant:",
              sourceDocumentId: "doc-1",
              expectedOutput: "说明退款到账时效和物流要求",
            },
          ],
        },
      }
    })

    vi.doMock("@/lib/ai/agent", () => ({
      handleTestAgentChat,
    }))

    vi.doMock("@/lib/ai/provider", () => ({
      createAiProvider: () => ({
        chat: vi.fn(),
        chatStream,
      }),
    }))

    vi.doMock("@/lib/db/repositories/settings", () => ({
      getSettings: () => ({
        provider: "openai",
        apiKey: "test-key",
        model: "gpt-test",
        baseUrl: "",
      }),
    }))

    try {
      const generateRoute = await import("@/app/api/projects/[id]/test-suites/generate/route")
      const detailRoute = await import("@/app/api/test-suites/[id]/route")
      const jobsRoute = await import("@/app/api/projects/[id]/test-suite-generation-jobs/route")

      const response = await generateRoute.POST(
        new Request("http://localhost", {
          method: "POST",
          body: JSON.stringify({
            suiteName: "客服主 Prompt 回归测试",
            suiteLanguage: "zh",
            section: "full-flow",
            structure: "single",
            promptId: "prompt-d",
            routingConfig: null,
            targetType: "prompt",
            targetId: null,
            caseCount: 4,
            conversationMode: "multi-turn",
            minTurns: 2,
            maxTurns: 4,
            generationSourceIds: ["document:doc-1"],
            generationDocumentRouteModes: [{ documentId: "doc-1", routeMode: "non-r" }],
          }),
        }),
        { params: Promise.resolve({ id: "project-1" }) }
      )

      const payload = await response.json()

      expect(response.status).toBe(202)
      expect(payload.data.suite).toMatchObject({
        section: "full-flow",
        name: "客服主 Prompt 回归测试",
        workflowMode: "single",
        promptId: "prompt-d",
      })

      expect(payload.data.job).toMatchObject({
        suiteId: payload.data.suite.id,
        status: "queued",
        generatedCount: 0,
        totalCount: 4,
      })

      const completedJobsPayload = await waitFor(
        async () => {
          const jobsResponse = await jobsRoute.GET(new Request("http://localhost"), {
            params: Promise.resolve({ id: "project-1" }),
          })
          return jobsResponse.json()
        },
        (jobsPayload) =>
          Array.isArray(jobsPayload.data) &&
          jobsPayload.data.some(
            (job: { id: string; status: string; generatedCount: number }) =>
              job.id === payload.data.job.id && job.status === "completed" && job.generatedCount === 1
          )
      )

      expect(completedJobsPayload.data).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: payload.data.job.id,
            status: "completed",
            generatedCount: 1,
            totalCount: 1,
          }),
        ])
      )

      const detailResponse = await detailRoute.GET(new Request("http://localhost"), {
        params: Promise.resolve({ id: payload.data.suite.id }),
      })
      const detailPayload = await detailResponse.json()

      expect(detailPayload.data.promptId).toBe("prompt-d")
      expect(detailPayload.data.section).toBe("full-flow")
      expect(detailPayload.data.name).toBe("客服主 Prompt 回归测试")
      expect(detailPayload.data.cases).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            title: "退款政策咨询",
            generationMetadata: {
              sourceDocumentId: "doc-1",
              sourceDocumentName: "退款政策.docx",
              sourceRouteMode: "non-r",
            },
            expectedOutput:
              "User: 退款多久能到账？\nAssistant: 退款通常会在审核通过后 1 到 3 个工作日内到账。\nUser: 物流寄回有什么要求？\nAssistant: 退货寄回时需要保留商品完整并按售后指引提供物流信息。",
          }),
        ])
      )
      expect(handleTestAgentChat).toHaveBeenCalledTimes(1)
    } finally {
      vi.doUnmock("@/lib/ai/agent")
      vi.doUnmock("@/lib/ai/provider")
      vi.doUnmock("@/lib/db/repositories/settings")
      testContext.cleanup()
    }
  })

  it("rejects configured generation when selected documents are missing route modes", async () => {
    const testContext = await setupTestSuiteRouteTest()
    vi.resetModules()

    try {
      const generateRoute = await import("@/app/api/projects/[id]/test-suites/generate/route")

      const response = await generateRoute.POST(
        new Request("http://localhost", {
          method: "POST",
          body: JSON.stringify({
            suiteName: "客服主 Prompt 回归测试",
            suiteLanguage: "zh",
            section: "full-flow",
            structure: "single",
            promptId: "prompt-d",
            routingConfig: null,
            targetType: "prompt",
            targetId: null,
            caseCount: 4,
            conversationMode: "single-turn",
            minTurns: null,
            maxTurns: null,
            generationSourceIds: ["document:doc-1"],
            generationDocumentRouteModes: [],
          }),
        }),
        { params: Promise.resolve({ id: "project-1" }) }
      )

      const payload = await response.json()

      expect(response.status).toBe(400)
      expect(payload.error).toBe("Each selected document must declare a route mode")
    } finally {
      testContext.cleanup()
    }
  })

  it("creates a configured routing generation job and persists the generated suite", async () => {
    const testContext = await setupTestSuiteRouteTest()
    vi.resetModules()

    const handleTestAgentChat = vi.fn(async function* (
      _sessionId: string,
      content: string,
      references: Array<{ type: string; id: string; title: string }>,
      options?: { routingConfig?: { entryPromptId: string; routes: Array<{ intent: string; promptId: string }> } | null }
    ) {
      expect(content).toContain("多 Prompt")
      expect(content).toContain("生成 3 个测试用例")
      expect(options?.routingConfig).toEqual({
        entryPromptId: "prompt-a",
        routes: [
          { intent: "P-SQ", promptId: "prompt-b" },
          { intent: "P-JX", promptId: "prompt-c" },
        ],
      })
      expect(references).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ type: "prompt", id: "prompt-a", title: "Intent Router" }),
          expect.objectContaining({ type: "prompt", id: "prompt-b", title: "Reply Prompt" }),
          expect.objectContaining({ type: "prompt", id: "prompt-c", title: "Repair Reply" }),
          expect.objectContaining({ type: "document", id: "doc-1", title: "退款政策.docx" }),
        ])
      )

      yield {
        type: "test-suite-progress",
        data: {
          generated: 1,
          total: 3,
        },
      }

      yield {
        type: "test-suite",
        data: {
          name: "售后路由测试",
          description: "覆盖咨询和寄修 intent",
          workflowMode: "routing",
          routingConfig: options?.routingConfig ?? null,
          cases: [
            {
              title: "先咨询再寄修",
              context: "用户先问政策再追问寄修",
              input: "User: 退款多久到账？\nAssistant:\nUser: 如果商品坏了怎么寄修？\nAssistant:",
              sourceDocumentId: "doc-1",
              expectedIntent: "P-SQ",
              expectedOutput: "先回答退款时效，再回答寄修流程",
            },
          ],
        },
      }
    })

    vi.doMock("@/lib/ai/agent", () => ({
      handleTestAgentChat,
    }))

    try {
      const generateRoute = await import("@/app/api/projects/[id]/test-suites/generate/route")
      const detailRoute = await import("@/app/api/test-suites/[id]/route")
      const jobsRoute = await import("@/app/api/projects/[id]/test-suite-generation-jobs/route")

      const response = await generateRoute.POST(
        new Request("http://localhost", {
          method: "POST",
          body: JSON.stringify({
            suiteName: "客服路由回归测试",
            suiteLanguage: "zh",
            section: "full-flow",
            structure: "multi",
            promptId: null,
            routingConfig: {
              entryPromptId: "prompt-a",
              routes: [
                { intent: "P-SQ", promptId: "prompt-b" },
                { intent: "P-JX", promptId: "prompt-c" },
              ],
            },
            targetType: "prompt",
            targetId: null,
            caseCount: 3,
            conversationMode: "single-turn",
            minTurns: null,
            maxTurns: null,
            generationSourceIds: ["document:doc-1"],
            generationDocumentRouteModes: [{ documentId: "doc-1", routeMode: "non-r" }],
          }),
        }),
        { params: Promise.resolve({ id: "project-1" }) }
      )

      const payload = await response.json()

      expect(response.status).toBe(202)
      expect(payload.data.suite).toMatchObject({
        section: "full-flow",
        name: "客服路由回归测试",
        workflowMode: "routing",
        promptId: null,
        routingConfig: {
          entryPromptId: "prompt-a",
          routes: [
            { intent: "P-SQ", promptId: "prompt-b" },
            { intent: "P-JX", promptId: "prompt-c" },
          ],
        },
      })

      const completedJobsPayload = await waitFor(
        async () => {
          const jobsResponse = await jobsRoute.GET(new Request("http://localhost"), {
            params: Promise.resolve({ id: "project-1" }),
          })
          return jobsResponse.json()
        },
        (jobsPayload) =>
          Array.isArray(jobsPayload.data) &&
          jobsPayload.data.some(
            (job: { id: string; status: string; generatedCount: number }) =>
              job.id === payload.data.job.id && job.status === "completed" && job.generatedCount === 1
          )
      )

      expect(completedJobsPayload.data).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: payload.data.job.id,
            status: "completed",
          }),
        ])
      )

      const detailResponse = await detailRoute.GET(new Request("http://localhost"), {
        params: Promise.resolve({ id: payload.data.suite.id }),
      })
      const detailPayload = await detailResponse.json()

      expect(detailPayload.data).toMatchObject({
        section: "full-flow",
        name: "客服路由回归测试",
        workflowMode: "routing",
        promptId: null,
        routingConfig: {
          entryPromptId: "prompt-a",
          routes: [
            { intent: "P-SQ", promptId: "prompt-b" },
            { intent: "P-JX", promptId: "prompt-c" },
          ],
        },
      })
      expect(detailPayload.data.cases).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            expectedIntent: "P-SQ",
          }),
        ])
      )
      expect(handleTestAgentChat).toHaveBeenCalledTimes(1)
    } finally {
      vi.doUnmock("@/lib/ai/agent")
      testContext.cleanup()
    }
  })

  it("persists full multi-turn transcripts for generated routing suites", async () => {
    const testContext = await setupTestSuiteRouteTest()
    vi.resetModules()

    const chatStream = vi
      .fn()
      .mockImplementationOnce(async function* () {
        yield '{"intent":"P-SQ"}'
      })
      .mockImplementationOnce(async function* () {
        yield "退款通常会在审核通过后 1 到 3 个工作日内到账。"
      })
      .mockImplementationOnce(async function* () {
        yield '{"intent":"P-JX"}'
      })
      .mockImplementationOnce(async function* () {
        yield "如果商品损坏，可以先提交寄修申请并按指引寄回。"
      })

    const handleTestAgentChat = vi.fn(async function* (
      _sessionId: string,
      content: string,
      _references: Array<{ type: string; id: string; title: string }>,
      options?: { routingConfig?: { entryPromptId: string; routes: Array<{ intent: string; promptId: string }> } | null }
    ) {
      expect(content).toContain("多 Prompt")
      expect(content).toContain("多轮对话")

      yield {
        type: "test-suite",
        data: {
          name: "售后路由测试",
          description: "覆盖咨询和寄修 intent",
          workflowMode: "routing",
          routingConfig: options?.routingConfig ?? null,
          cases: [
            {
              title: "先咨询再寄修",
              context: "用户先问政策再追问寄修",
              input: "User: 退款多久到账？\nAssistant:\nUser: 如果商品坏了怎么寄修？\nAssistant:",
              sourceDocumentId: "doc-1",
              expectedIntent: "P-SQ",
              expectedOutput: "先回答退款时效，再回答寄修流程",
            },
          ],
        },
      }
    })

    vi.doMock("@/lib/ai/agent", () => ({
      handleTestAgentChat,
    }))

    vi.doMock("@/lib/ai/provider", () => ({
      createAiProvider: () => ({
        chat: vi.fn(),
        chatStream,
      }),
    }))

    vi.doMock("@/lib/db/repositories/settings", () => ({
      getSettings: () => ({
        provider: "openai",
        apiKey: "test-key",
        model: "gpt-test",
        baseUrl: "",
      }),
    }))

    try {
      const generateRoute = await import("@/app/api/projects/[id]/test-suites/generate/route")
      const detailRoute = await import("@/app/api/test-suites/[id]/route")
      const jobsRoute = await import("@/app/api/projects/[id]/test-suite-generation-jobs/route")

      const response = await generateRoute.POST(
        new Request("http://localhost", {
          method: "POST",
          body: JSON.stringify({
            suiteName: "客服路由回归测试",
            suiteLanguage: "zh",
            section: "full-flow",
            structure: "multi",
            promptId: null,
            routingConfig: {
              entryPromptId: "prompt-a",
              routes: [
                { intent: "P-SQ", promptId: "prompt-b" },
                { intent: "P-JX", promptId: "prompt-c" },
              ],
            },
            targetType: "prompt",
            targetId: null,
            caseCount: 3,
            conversationMode: "multi-turn",
            minTurns: 2,
            maxTurns: 4,
            generationSourceIds: ["document:doc-1"],
            generationDocumentRouteModes: [{ documentId: "doc-1", routeMode: "non-r" }],
          }),
        }),
        { params: Promise.resolve({ id: "project-1" }) }
      )

      const payload = await response.json()

      expect(response.status).toBe(202)

      await waitFor(
        async () => {
          const jobsResponse = await jobsRoute.GET(new Request("http://localhost"), {
            params: Promise.resolve({ id: "project-1" }),
          })
          return jobsResponse.json()
        },
        (jobsPayload) =>
          Array.isArray(jobsPayload.data) &&
          jobsPayload.data.some(
            (job: { id: string; status: string; generatedCount: number }) =>
              job.id === payload.data.job.id && job.status === "completed" && job.generatedCount === 1
          )
      )

      const detailResponse = await detailRoute.GET(new Request("http://localhost"), {
        params: Promise.resolve({ id: payload.data.suite.id }),
      })
      const detailPayload = await detailResponse.json()

      expect(detailPayload.data.cases).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            title: "先咨询再寄修",
            expectedIntent: "P-SQ",
            expectedOutput:
              "User: 退款多久到账？\nAssistant: P-SQ\n退款通常会在审核通过后 1 到 3 个工作日内到账。\nUser: 如果商品坏了怎么寄修？\nAssistant: P-JX\n如果商品损坏，可以先提交寄修申请并按指引寄回。",
          }),
        ])
      )
    } finally {
      vi.doUnmock("@/lib/ai/agent")
      vi.doUnmock("@/lib/ai/provider")
      vi.doUnmock("@/lib/db/repositories/settings")
      testContext.cleanup()
    }
  })

  it("passes embedding config through configured unit index-version generation", async () => {
    const testContext = await setupTestSuiteRouteTest()
    vi.resetModules()

    const handleTestAgentChat = vi.fn(async function* (
      _sessionId: string,
      content: string
    ) {
      expect(content).toContain("请为索引版本")
      expect(content).toContain("Embedding 请求 URL：https://embedding.example.com/v1/embeddings。")
      expect(content).toContain("Embedding 模型名称：text-embedding-v4。")

      yield {
        type: "test-suite",
        data: {
          name: "索引版本单元测试",
          description: "覆盖索引版本检索能力",
          workflowMode: "single",
          cases: [
            {
              title: "FAQ 检索",
              context: "验证知识问答检索",
              input: "如何申请退款？",
              sourceDocumentId: "doc-1",
              expectedOutput: "命中退款相关知识并返回正确要点",
            },
          ],
        },
      }
    })

    vi.doMock("@/lib/ai/agent", () => ({
      handleTestAgentChat,
    }))

    try {
      const generateRoute = await import("@/app/api/projects/[id]/test-suites/generate/route")
      const detailRoute = await import("@/app/api/test-suites/[id]/route")
      const jobsRoute = await import("@/app/api/projects/[id]/test-suite-generation-jobs/route")

      const response = await generateRoute.POST(
        new Request("http://localhost", {
          method: "POST",
          body: JSON.stringify({
            suiteName: "索引版本单元测试",
            suiteLanguage: "zh",
            section: "unit",
            structure: "single",
            promptId: null,
            routingConfig: null,
            targetType: "index-version",
            targetId: "kb-index-2024-04-20",
            embeddingRequestUrl: "https://embedding.example.com/v1/embeddings",
            embeddingModelName: "text-embedding-v4",
            caseCount: 6,
            conversationMode: "single-turn",
            minTurns: null,
            maxTurns: null,
            generationSourceIds: ["document:doc-1"],
            generationDocumentRouteModes: [{ documentId: "doc-1", routeMode: "non-r" }],
          }),
        }),
        { params: Promise.resolve({ id: "project-1" }) }
      )

      const payload = await response.json()

      expect(response.status).toBe(202)
      expect(payload.data.suite).toMatchObject({
        section: "unit",
        name: "索引版本单元测试",
        promptId: null,
        workflowMode: "single",
      })

      await waitFor(
        async () => {
          const jobsResponse = await jobsRoute.GET(new Request("http://localhost"), {
            params: Promise.resolve({ id: "project-1" }),
          })
          return jobsResponse.json()
        },
        (jobsPayload) =>
          Array.isArray(jobsPayload.data) &&
          jobsPayload.data.some(
            (job: { id: string; status: string; generatedCount: number }) =>
              job.id === payload.data.job.id && job.status === "completed" && job.generatedCount === 1
          )
      )

      const detailResponse = await detailRoute.GET(new Request("http://localhost"), {
        params: Promise.resolve({ id: payload.data.suite.id }),
      })
      const detailPayload = await detailResponse.json()

      expect(detailPayload.data.section).toBe("unit")
      expect(detailPayload.data.name).toBe("索引版本单元测试")
      expect(handleTestAgentChat).toHaveBeenCalledTimes(1)
    } finally {
      vi.doUnmock("@/lib/ai/agent")
      testContext.cleanup()
    }
  })

  it("creates and returns routing suites with expected intents", async () => {
    const testContext = await setupTestSuiteRouteTest()

    try {
      const projectRoute = await import("@/app/api/projects/[id]/test-suites/route")
      const casesRoute = await import("@/app/api/test-suites/[id]/cases/route")
      const detailRoute = await import("@/app/api/test-suites/[id]/route")

      const createResponse = await projectRoute.POST(
        new Request("http://localhost", {
          method: "POST",
          body: JSON.stringify({
            name: "Routing Suite",
            description: "Intent router suite",
            workflowMode: "routing",
            routingConfig: {
              entryPromptId: "prompt-a",
              routes: [{ intent: "refund", promptId: "prompt-b" }],
            },
          }),
        }),
        { params: Promise.resolve({ id: "project-1" }) }
      )

      const createdPayload = await createResponse.json()

      expect(createResponse.status).toBe(201)
      expect(createdPayload.data).toMatchObject({
        section: "full-flow",
        name: "Routing Suite",
        workflowMode: "routing",
        routingConfig: {
          entryPromptId: "prompt-a",
          routes: [{ intent: "refund", promptId: "prompt-b" }],
        },
      })

      const suiteId = createdPayload.data.id as string

      const casesResponse = await casesRoute.POST(
        new Request("http://localhost", {
          method: "POST",
          body: JSON.stringify([
            {
              title: "Refund flow",
              context: "用户发起退款",
              input: "我要退款",
              expectedIntent: "refund",
              expectedOutput: "给出退款处理指引",
            },
          ]),
        }),
        { params: Promise.resolve({ id: suiteId }) }
      )

      const casesPayload = await casesResponse.json()

      expect(casesResponse.status).toBe(201)
      expect(casesPayload.data[0]).toMatchObject({
        title: "Refund flow",
        expectedIntent: "refund",
      })

      const detailResponse = await detailRoute.GET(new Request("http://localhost"), {
        params: Promise.resolve({ id: suiteId }),
      })

      const detailPayload = await detailResponse.json()

      expect(detailPayload.success).toBe(true)
      expect(detailPayload.data).toMatchObject({
        id: suiteId,
        workflowMode: "routing",
        routingConfig: {
          entryPromptId: "prompt-a",
          routes: [{ intent: "refund", promptId: "prompt-b" }],
        },
      })
      expect(detailPayload.data.cases).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            title: "Refund flow",
            expectedIntent: "refund",
          }),
        ])
      )
    } finally {
      testContext.cleanup()
    }
  })

  it("stores unit suites under the unit section", async () => {
    const testContext = await setupTestSuiteRouteTest()

    try {
      const projectRoute = await import("@/app/api/projects/[id]/test-suites/route")
      const detailRoute = await import("@/app/api/test-suites/[id]/route")

      const createResponse = await projectRoute.POST(
        new Request("http://localhost", {
          method: "POST",
          body: JSON.stringify({
            section: "unit",
            name: "索引版本单元测试",
            description: "验证索引版本召回内容",
          }),
        }),
        { params: Promise.resolve({ id: "project-1" }) }
      )

      const createdPayload = await createResponse.json()

      expect(createResponse.status).toBe(201)
      expect(createdPayload.data).toMatchObject({
        section: "unit",
        name: "索引版本单元测试",
      })

      const detailResponse = await detailRoute.GET(new Request("http://localhost"), {
        params: Promise.resolve({ id: createdPayload.data.id }),
      })
      const detailPayload = await detailResponse.json()

      expect(detailPayload.data.section).toBe("unit")
    } finally {
      testContext.cleanup()
    }
  })

  it("enriches routing case expected output into a full conversation transcript before saving", async () => {
    const testContext = await setupTestSuiteRouteTest()
    vi.resetModules()

    const chatStream = vi
      .fn()
      .mockImplementationOnce(async function* () {
        yield '{"intent":"P-SQ"}'
      })
      .mockImplementationOnce(async function* () {
        yield "Enco X3 降噪深度 50dB，公交地铁一键安静。"
      })
      .mockImplementationOnce(async function* () {
        yield '{"intent":"P-JX"}'
      })
      .mockImplementationOnce(async function* () {
        yield "可以，我先帮您判断寄修条件。"
      })
      .mockImplementationOnce(async function* () {
        yield '{"intent":"P-SQ"}'
      })
      .mockImplementationOnce(async function* () {
        yield "Enco X3 降噪深度 50dB，公交地铁一键安静。"
      })
      .mockImplementationOnce(async function* () {
        yield '{"intent":"P-JX"}'
      })
      .mockImplementationOnce(async function* () {
        yield "可以，我先帮您判断寄修条件。"
      })
      .mockImplementationOnce(async function* () {
        yield '{"intent":"P-SQ"}'
      })
      .mockImplementationOnce(async function* () {
        yield "Enco X3 降噪深度 50dB，公交地铁一键安静。"
      })
      .mockImplementationOnce(async function* () {
        yield '{"intent":"P-JX"}'
      })
      .mockImplementationOnce(async function* () {
        yield "可以，我先帮您判断寄修条件。"
      })

    vi.doMock("@/lib/ai/provider", () => ({
      createAiProvider: () => ({
        chat: vi.fn(),
        chatStream,
      }),
    }))

    vi.doMock("@/lib/db/repositories/settings", () => ({
      getSettings: () => ({
        provider: "openai",
        apiKey: "test-key",
        model: "gpt-test",
        baseUrl: "",
      }),
    }))

    try {
      const projectRoute = await import("@/app/api/projects/[id]/test-suites/route")
      const casesRoute = await import("@/app/api/test-suites/[id]/cases/route")
      const detailRoute = await import("@/app/api/test-suites/[id]/route")

      const createResponse = await projectRoute.POST(
        new Request("http://localhost", {
          method: "POST",
          body: JSON.stringify({
            name: "Routing Suite",
            description: "Intent router suite",
            workflowMode: "routing",
            routingConfig: {
              entryPromptId: "prompt-a",
              routes: [
                { intent: "P-SQ", promptId: "prompt-b" },
                { intent: "P-JX", promptId: "prompt-c" },
              ],
            },
          }),
        }),
        { params: Promise.resolve({ id: "project-1" }) }
      )

      const createdPayload = await createResponse.json()
      const suiteId = createdPayload.data.id as string

      const casesResponse = await casesRoute.POST(
        new Request("http://localhost", {
          method: "POST",
          body: JSON.stringify([
            {
              title: "Noise and repair flow",
              context: "用户先问耳机降噪，再追问寄修",
              input:
                "User: 想了解一下 Enco X3，降噪怎么样？\nAssistant:\nUser: 如果坏了还能寄修吗？\nAssistant:",
              expectedIntent: "P-SQ",
              expectedOutput: "回答降噪表现，并继续回答寄修问题",
            },
          ]),
        }),
        { params: Promise.resolve({ id: suiteId }) }
      )

      const casesPayload = await casesResponse.json()

      expect(casesResponse.status).toBe(201)
      expect(casesPayload.data[0]).toMatchObject({
        title: "Noise and repair flow",
        expectedIntent: "P-SQ",
        expectedOutput:
          "User: 想了解一下 Enco X3，降噪怎么样？\nAssistant: P-SQ\nEnco X3 降噪深度 50dB，公交地铁一键安静。\nUser: 如果坏了还能寄修吗？\nAssistant: P-JX\n可以，我先帮您判断寄修条件。",
      })

      const detailResponse = await detailRoute.GET(new Request("http://localhost"), {
        params: Promise.resolve({ id: suiteId }),
      })

      const detailPayload = await detailResponse.json()
      expect(detailPayload.data.cases[0]?.expectedOutput).toBe(
        "User: 想了解一下 Enco X3，降噪怎么样？\nAssistant: P-SQ\nEnco X3 降噪深度 50dB，公交地铁一键安静。\nUser: 如果坏了还能寄修吗？\nAssistant: P-JX\n可以，我先帮您判断寄修条件。"
      )
    } finally {
      vi.doUnmock("@/lib/ai/provider")
      vi.doUnmock("@/lib/db/repositories/settings")
      testContext.cleanup()
    }
  })

  it("keeps the original expected output and stores diagnostics when routing enrichment only partially succeeds", async () => {
    const testContext = await setupTestSuiteRouteTest()
    vi.resetModules()

    const chatStream = vi.fn(async function* (messages: Array<{ role: string; content: string }>) {
      const systemPrompt = messages[0]?.content
      const lastUserMessage = [...messages].reverse().find((message) => message.role === "user")?.content ?? ""

      if (systemPrompt === "router") {
        if (lastUserMessage.includes("Enco X3")) {
          yield '{"intent":"P-SQ"}'
          return
        }
        yield "UNKNOWN_INTENT"
        return
      }

      if (systemPrompt === "reply") {
        yield "Enco X3 降噪深度 50dB，公交地铁一键安静。"
        return
      }
    })

    vi.doMock("@/lib/ai/provider", () => ({
      createAiProvider: () => ({
        chat: vi.fn(),
        chatStream,
      }),
    }))

    vi.doMock("@/lib/db/repositories/settings", () => ({
      getSettings: () => ({
        provider: "openai",
        apiKey: "test-key",
        model: "gpt-test",
        baseUrl: "",
      }),
    }))

    try {
      const projectRoute = await import("@/app/api/projects/[id]/test-suites/route")
      const casesRoute = await import("@/app/api/test-suites/[id]/cases/route")
      const detailRoute = await import("@/app/api/test-suites/[id]/route")

      const createResponse = await projectRoute.POST(
        new Request("http://localhost", {
          method: "POST",
          body: JSON.stringify({
            name: "Routing Suite",
            description: "Intent router suite",
            workflowMode: "routing",
            routingConfig: {
              entryPromptId: "prompt-a",
              routes: [
                { intent: "P-SQ", promptId: "prompt-b" },
                { intent: "P-JX", promptId: "prompt-c" },
              ],
            },
          }),
        }),
        { params: Promise.resolve({ id: "project-1" }) }
      )

      const createdPayload = await createResponse.json()
      const suiteId = createdPayload.data.id as string
      const originalExpectedOutput = "旧的预期结果"

      const casesResponse = await casesRoute.POST(
        new Request("http://localhost", {
          method: "POST",
          body: JSON.stringify([
            {
              title: "Partial routing enrichment",
              context: "第一轮成功，第二轮失败",
              input:
                "User: 想了解一下 Enco X3，降噪怎么样？\nAssistant:\nUser: 如果坏了还能寄修吗？\nAssistant:",
              expectedIntent: "P-SQ",
              expectedOutput: originalExpectedOutput,
            },
          ]),
        }),
        { params: Promise.resolve({ id: suiteId }) }
      )

      const casesPayload = await casesResponse.json()

      expect(casesResponse.status).toBe(201)
      expect(casesPayload.data[0]).toMatchObject({
        title: "Partial routing enrichment",
        expectedOutput: originalExpectedOutput,
        expectedOutputDiagnostics: [
          expect.objectContaining({
            rawIntentOutput: '{"intent":"P-SQ"}',
            actualReply: "Enco X3 降噪深度 50dB，公交地铁一键安静。",
          }),
          expect.objectContaining({
            rawIntent: "UNKNOWN_INTENT",
            rawIntentOutput: "UNKNOWN_INTENT",
            routingError: '未找到 intent "UNKNOWN_INTENT" 对应的 Prompt',
          }),
        ],
      })

      const detailResponse = await detailRoute.GET(new Request("http://localhost"), {
        params: Promise.resolve({ id: suiteId }),
      })
      const detailPayload = await detailResponse.json()

      expect(detailPayload.data.cases[0]?.expectedOutput).toBe(originalExpectedOutput)
      expect(detailPayload.data.cases[0]?.expectedOutputDiagnostics).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            rawIntentOutput: "UNKNOWN_INTENT",
            routingError: '未找到 intent "UNKNOWN_INTENT" 对应的 Prompt',
          }),
        ])
      )
    } finally {
      vi.doUnmock("@/lib/ai/provider")
      vi.doUnmock("@/lib/db/repositories/settings")
      testContext.cleanup()
    }
  })

  it("regenerates expected outputs for an existing routing suite", async () => {
    const testContext = await setupTestSuiteRouteTest()
    vi.resetModules()

    const chatStream = vi.fn(async function* (messages: Array<{ role: string; content: string }>) {
      const systemPrompt = messages[0]?.content
      const lastUserMessage = [...messages].reverse().find((message) => message.role === "user")?.content ?? ""

      if (systemPrompt === "router") {
        if (lastUserMessage.includes("Enco X3")) {
          yield '{"intent":"P-SQ"}'
          return
        }
        yield '{"intent":"P-JX"}'
        return
      }

      if (systemPrompt === "reply") {
        yield "Enco X3 降噪深度 50dB，公交地铁一键安静。"
        return
      }

      if (systemPrompt === "repair reply") {
        yield "可以，我先帮您判断寄修条件。"
        return
      }
    })

    vi.doMock("@/lib/ai/provider", () => ({
      createAiProvider: () => ({
        chat: vi.fn(),
        chatStream,
      }),
    }))

    vi.doMock("@/lib/db/repositories/settings", () => ({
      getSettings: () => ({
        provider: "openai",
        apiKey: "test-key",
        model: "gpt-test",
        baseUrl: "",
      }),
    }))

    try {
      const projectRoute = await import("@/app/api/projects/[id]/test-suites/route")
      const casesRoute = await import("@/app/api/test-suites/[id]/cases/route")
      const detailRoute = await import("@/app/api/test-suites/[id]/route")
      const regenerateRoute = await import("@/app/api/test-suites/[id]/regenerate-expected-outputs/route")
      const { updateTestCase } = await import("@/lib/db/repositories/test-cases")

      const createResponse = await projectRoute.POST(
        new Request("http://localhost", {
          method: "POST",
          body: JSON.stringify({
            name: "Routing Suite",
            description: "Intent router suite",
            workflowMode: "routing",
            routingConfig: {
              entryPromptId: "prompt-a",
              routes: [
                { intent: "P-SQ", promptId: "prompt-b" },
                { intent: "P-JX", promptId: "prompt-c" },
              ],
            },
          }),
        }),
        { params: Promise.resolve({ id: "project-1" }) }
      )

      const createdPayload = await createResponse.json()
      const suiteId = createdPayload.data.id as string

      const casesResponse = await casesRoute.POST(
        new Request("http://localhost", {
          method: "POST",
          body: JSON.stringify([
            {
              title: "Noise and repair flow",
              context: "用户先问耳机降噪，再追问寄修",
              input:
                "User: 想了解一下 Enco X3，降噪怎么样？\nAssistant:\nUser: 如果坏了还能寄修吗？\nAssistant:",
              expectedIntent: "P-SQ",
              expectedOutput: "旧的预期结果",
            },
          ]),
        }),
        { params: Promise.resolve({ id: suiteId }) }
      )

      const casesPayload = await casesResponse.json()
      updateTestCase(casesPayload.data[0].id, { expectedOutput: "旧的预期结果" })

      const regenerateResponse = await regenerateRoute.POST(
        new Request("http://localhost", { method: "POST" }),
        { params: Promise.resolve({ id: suiteId }) }
      )

      const regeneratePayload = await regenerateResponse.json()
      expect(regenerateResponse.status).toBe(200)
      expect(regeneratePayload.data).toMatchObject({
        updatedCount: 1,
        totalCount: 1,
      })

      const detailResponse = await detailRoute.GET(new Request("http://localhost"), {
        params: Promise.resolve({ id: suiteId }),
      })
      const detailPayload = await detailResponse.json()

      expect(detailPayload.data.cases[0]?.expectedOutput).toBe(
        "User: 想了解一下 Enco X3，降噪怎么样？\nAssistant: P-SQ\nEnco X3 降噪深度 50dB，公交地铁一键安静。\nUser: 如果坏了还能寄修吗？\nAssistant: P-JX\n可以，我先帮您判断寄修条件。"
      )
    } finally {
      vi.doUnmock("@/lib/ai/provider")
      vi.doUnmock("@/lib/db/repositories/settings")
      testContext.cleanup()
    }
  })

  it("regenerates the final assistant reply even when the last user turn has no placeholder", async () => {
    const testContext = await setupTestSuiteRouteTest()
    vi.resetModules()

    const chatStream = vi.fn(async function* (messages: Array<{ role: string; content: string }>) {
      const systemPrompt = messages[0]?.content
      const lastUserMessage = [...messages].reverse().find((message) => message.role === "user")?.content ?? ""

      if (systemPrompt === "router") {
        if (lastUserMessage.includes("Enco X3")) {
          yield '{"intent":"P-SQ"}'
          return
        }
        yield '{"intent":"P-JX"}'
        return
      }

      if (systemPrompt === "reply") {
        yield "Enco X3 降噪深度 50dB，公交地铁一键安静。"
        return
      }

      if (systemPrompt === "repair reply") {
        yield "可以，我先帮您判断寄修条件。"
        return
      }
    })

    vi.doMock("@/lib/ai/provider", () => ({
      createAiProvider: () => ({
        chat: vi.fn(),
        chatStream,
      }),
    }))

    vi.doMock("@/lib/db/repositories/settings", () => ({
      getSettings: () => ({
        provider: "openai",
        apiKey: "test-key",
        model: "gpt-test",
        baseUrl: "",
      }),
    }))

    try {
      const projectRoute = await import("@/app/api/projects/[id]/test-suites/route")
      const casesRoute = await import("@/app/api/test-suites/[id]/cases/route")
      const detailRoute = await import("@/app/api/test-suites/[id]/route")
      const regenerateRoute = await import("@/app/api/test-suites/[id]/regenerate-expected-outputs/route")
      const { updateTestCase } = await import("@/lib/db/repositories/test-cases")

      const createResponse = await projectRoute.POST(
        new Request("http://localhost", {
          method: "POST",
          body: JSON.stringify({
            name: "Routing Suite",
            description: "Intent router suite",
            workflowMode: "routing",
            routingConfig: {
              entryPromptId: "prompt-a",
              routes: [
                { intent: "P-SQ", promptId: "prompt-b" },
                { intent: "P-JX", promptId: "prompt-c" },
              ],
            },
          }),
        }),
        { params: Promise.resolve({ id: "project-1" }) }
      )

      const createdPayload = await createResponse.json()
      const suiteId = createdPayload.data.id as string

      const casesResponse = await casesRoute.POST(
        new Request("http://localhost", {
          method: "POST",
          body: JSON.stringify([
            {
              title: "Final turn has no placeholder",
              context: "用户最后一轮没有写 assistant 占位",
              input:
                "User: 想了解一下 Enco X3，降噪怎么样？\nAssistant:\nUser: 如果坏了还能寄修吗？",
              expectedIntent: "P-SQ",
              expectedOutput: "旧的预期结果",
            },
          ]),
        }),
        { params: Promise.resolve({ id: suiteId }) }
      )

      const casesPayload = await casesResponse.json()
      updateTestCase(casesPayload.data[0].id, { expectedOutput: "旧的预期结果" })

      await regenerateRoute.POST(
        new Request("http://localhost", { method: "POST" }),
        { params: Promise.resolve({ id: suiteId }) }
      )

      const detailResponse = await detailRoute.GET(new Request("http://localhost"), {
        params: Promise.resolve({ id: suiteId }),
      })
      const detailPayload = await detailResponse.json()

      expect(detailPayload.data.cases[0]?.expectedOutput).toBe(
        "User: 想了解一下 Enco X3，降噪怎么样？\nAssistant: P-SQ\nEnco X3 降噪深度 50dB，公交地铁一键安静。\nUser: 如果坏了还能寄修吗？\nAssistant: P-JX\n可以，我先帮您判断寄修条件。"
      )
    } finally {
      vi.doUnmock("@/lib/ai/provider")
      vi.doUnmock("@/lib/db/repositories/settings")
      testContext.cleanup()
    }
  })

  it("keeps the original expected output and stores diagnostics when regenerating only partially succeeds", async () => {
    const testContext = await setupTestSuiteRouteTest()
    vi.resetModules()

    const chatStream = vi.fn(async function* (messages: Array<{ role: string; content: string }>) {
      const systemPrompt = messages[0]?.content
      const lastUserMessage = [...messages].reverse().find((message) => message.role === "user")?.content ?? ""

      if (systemPrompt === "router") {
        if (lastUserMessage.includes("Enco X3")) {
          yield '{"intent":"P-SQ"}'
          return
        }
        yield "UNKNOWN_INTENT"
        return
      }

      if (systemPrompt === "reply") {
        yield "Enco X3 降噪深度 50dB，公交地铁一键安静。"
        return
      }
    })

    vi.doMock("@/lib/ai/provider", () => ({
      createAiProvider: () => ({
        chat: vi.fn(),
        chatStream,
      }),
    }))

    vi.doMock("@/lib/db/repositories/settings", () => ({
      getSettings: () => ({
        provider: "openai",
        apiKey: "test-key",
        model: "gpt-test",
        baseUrl: "",
      }),
    }))

    try {
      const projectRoute = await import("@/app/api/projects/[id]/test-suites/route")
      const casesRoute = await import("@/app/api/test-suites/[id]/cases/route")
      const detailRoute = await import("@/app/api/test-suites/[id]/route")
      const regenerateRoute = await import("@/app/api/test-suites/[id]/regenerate-expected-outputs/route")
      const { updateTestCase } = await import("@/lib/db/repositories/test-cases")

      const createResponse = await projectRoute.POST(
        new Request("http://localhost", {
          method: "POST",
          body: JSON.stringify({
            name: "Routing Suite",
            description: "Intent router suite",
            workflowMode: "routing",
            routingConfig: {
              entryPromptId: "prompt-a",
              routes: [
                { intent: "P-SQ", promptId: "prompt-b" },
                { intent: "P-JX", promptId: "prompt-c" },
              ],
            },
          }),
        }),
        { params: Promise.resolve({ id: "project-1" }) }
      )

      const createdPayload = await createResponse.json()
      const suiteId = createdPayload.data.id as string

      const casesResponse = await casesRoute.POST(
        new Request("http://localhost", {
          method: "POST",
          body: JSON.stringify([
            {
              title: "Partial success flow",
              context: "第一轮成功，第二轮路由失败",
              input:
                "User: 想了解一下 Enco X3，降噪怎么样？\nAssistant:\nUser: 如果坏了还能寄修吗？\nAssistant:",
              expectedIntent: "P-SQ",
              expectedOutput: "旧的预期结果",
            },
          ]),
        }),
        { params: Promise.resolve({ id: suiteId }) }
      )

      const casesPayload = await casesResponse.json()
      updateTestCase(casesPayload.data[0].id, { expectedOutput: "旧的预期结果" })

      const regenerateResponse = await regenerateRoute.POST(
        new Request("http://localhost", { method: "POST" }),
        { params: Promise.resolve({ id: suiteId }) }
      )
      const regeneratePayload = await regenerateResponse.json()

      expect(regeneratePayload.data).toMatchObject({
        updatedCount: 0,
        totalCount: 1,
      })

      const detailResponse = await detailRoute.GET(new Request("http://localhost"), {
        params: Promise.resolve({ id: suiteId }),
      })
      const detailPayload = await detailResponse.json()

      expect(detailPayload.data.cases[0]?.expectedOutput).toBe("旧的预期结果")
      expect(detailPayload.data.cases[0]?.expectedOutputDiagnostics).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            rawIntentOutput: "UNKNOWN_INTENT",
            routingError: '未找到 intent "UNKNOWN_INTENT" 对应的 Prompt',
          }),
        ])
      )
    } finally {
      vi.doUnmock("@/lib/ai/provider")
      vi.doUnmock("@/lib/db/repositories/settings")
      testContext.cleanup()
    }
  })
})
