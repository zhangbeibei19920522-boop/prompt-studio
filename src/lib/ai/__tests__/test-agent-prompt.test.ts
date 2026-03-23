import { buildTestAgentMessages } from "@/lib/ai/test-agent-prompt"

describe("test agent prompt rules", () => {
  it("forbids descriptive guidance inside assistant placeholders for multi-turn cases", () => {
    const messages = buildTestAgentMessages({
      globalBusiness: {
        description: "",
        goal: "",
        background: "",
      },
      projectBusiness: {
        description: "",
        goal: "",
        background: "",
      },
      globalMemories: [],
      projectMemories: [],
      referencedPrompts: [],
      referencedDocuments: [],
      sessionHistory: [],
      userMessage: "帮我生成一个多轮对话测试集",
    })

    expect(messages[0]?.role).toBe("system")
    expect(messages[0]?.content).toContain("不要在 `Assistant:` 占位行里写")
    expect(messages[0]?.content).toContain("这种说明属于 `expectedOutput`")
  })

  it("documents that G means reusing the previous turn intent for routing suites", () => {
    const messages = buildTestAgentMessages(
      {
        globalBusiness: {
          description: "",
          goal: "",
          background: "",
        },
        projectBusiness: {
          description: "",
          goal: "",
          background: "",
        },
        globalMemories: [],
        projectMemories: [],
        referencedPrompts: [],
        referencedDocuments: [],
        sessionHistory: [],
        userMessage: "帮我生成一个多 Prompt 路由测试集",
      },
      {
        routingConfig: {
          entryPromptId: "prompt-a",
          routes: [
            { intent: "A", promptId: "prompt-b" },
            { intent: "B", promptId: "prompt-c" },
          ],
        },
      }
    )

    expect(messages[0]?.role).toBe("system")
    expect(messages[0]?.content).toContain("G 表示沿用上一轮相同 intent")
    expect(messages[0]?.content).toContain("expectedIntent 应填写沿用后的 intent")
  })
})
