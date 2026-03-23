import type { ChatMessage } from "@/types/ai"

async function collectTestAgentEvents(responseText: string, userMessage = "帮我生成测试用例") {
  vi.resetModules()
  const createMessage = vi.fn()

  const chatStreamMock = vi.fn(async function* (_messages: ChatMessage[]) {
    yield responseText
  })

  vi.doMock("@/lib/ai/provider", () => ({
    createAiProvider: () => ({
      chat: vi.fn(async () => "已有标题"),
      chatStream: chatStreamMock,
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

  vi.doMock("@/lib/ai/context-collector", () => ({
    collectAgentContext: () => ({
      globalBusiness: { description: "", goal: "", background: "" },
      projectBusiness: { description: "", goal: "", background: "" },
      globalMemories: [],
      projectMemories: [],
      referencedPrompts: [],
      referencedDocuments: [],
      sessionHistory: [],
      userMessage,
    }),
  }))

  vi.doMock("@/lib/db/repositories/messages", () => ({
    createMessage,
  }))

  vi.doMock("@/lib/db/repositories/sessions", () => ({
    findSessionById: () => ({
      id: "session-1",
      projectId: "project-1",
      title: "测试会话",
    }),
    updateSession: vi.fn(),
  }))

  const { handleTestAgentChat } = await import("@/lib/ai/agent")
  const events = []

  for await (const event of handleTestAgentChat("session-1", userMessage, [])) {
    events.push(event)
  }

  return {
    chatStreamMock,
    createMessage,
    events,
  }
}

describe("test chat agent routing flow", () => {
  it("keeps the existing single-prompt batch flow unchanged", async () => {
    const { createMessage, events } = await collectTestAgentEvents(`\`\`\`json
{
  "type": "test-suite-batch",
  "name": "单 Prompt 测试集",
  "description": "标准单 Prompt 用例",
  "totalPlanned": 1,
  "cases": [
    {
      "title": "基础问答",
      "context": "普通用户咨询",
      "input": "今天天气怎么样？",
      "expectedOutput": "回答天气，并保持自然语气"
    }
  ]
}
\`\`\``)

    expect(events.some((event) => event.type === "test-flow-config")).toBe(false)
    expect(events.some((event) => event.type === "test-suite-progress")).toBe(true)

    const suiteEvent = events.find((event) => event.type === "test-suite")
    expect(suiteEvent).toMatchObject({
      type: "test-suite",
      data: {
        name: "单 Prompt 测试集",
        cases: [{ title: "基础问答" }],
      },
    })

    expect(createMessage).toHaveBeenLastCalledWith(
      expect.objectContaining({
        role: "assistant",
        content: "已生成测试集草案，请确认后创建。",
      })
    )
  })

  it("emits a routing configuration event before generating a suite for multi-prompt requests", async () => {
    const { createMessage, events } = await collectTestAgentEvents(`\`\`\`json
{
  "type": "test-flow-config",
  "mode": "routing",
  "summary": "先使用入口 Prompt 识别 intent，再根据 intent 路由到目标 Prompt 输出回复。"
}
\`\`\``, "我要测一个先识别 intent 再回复的多 Prompt 流程")

    const flowEvent = events.find((event) => event.type === "test-flow-config")
    expect(flowEvent).toMatchObject({
      type: "test-flow-config",
      data: {
        mode: "routing",
        summary: "先使用入口 Prompt 识别 intent，再根据 intent 路由到目标 Prompt 输出回复。",
      },
    })

    expect(events.some((event) => event.type === "test-suite")).toBe(false)
    expect(createMessage).toHaveBeenLastCalledWith(
      expect.objectContaining({
        role: "assistant",
        content: "已识别为多 Prompt 业务流程，请先配置入口 Prompt 和 intent 路由。",
      })
    )
  })
})
