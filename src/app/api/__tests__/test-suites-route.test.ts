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

  return {
    cleanup() {
      db.close()
      process.chdir(originalCwd)
      fs.rmSync(tempDir, { recursive: true, force: true })
    },
  }
}

describe("test suite routes", () => {
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
