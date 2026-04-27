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

  it("describes document route-mode constraints for generated routing cases", () => {
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
        referencedDocuments: [
          { id: "doc-rag", name: "退款政策.docx", type: "docx", content: "退款到账时效说明" },
          { id: "doc-non-r", name: "客服话术规范.docx", type: "docx", content: "客服开场白说明" },
        ],
        sessionHistory: [],
        userMessage: "帮我生成一个多 Prompt 路由测试集",
      },
      {
        routingConfig: {
          entryPromptId: "prompt-a",
          routes: [
            { intent: "R", promptId: "", ragPromptId: "prompt-rag", ragIndexVersionId: "index-rag" },
            { intent: "P-SQ", promptId: "prompt-b" },
          ],
        },
        documentRouteModes: [
          { documentId: "doc-rag", routeMode: "rag" },
          { documentId: "doc-non-r", routeMode: "non-r" },
        ],
      } as never
    )

    expect(messages[0]?.content).toContain("sourceDocumentId")
    expect(messages[0]?.content).toContain("每条用例必须标注一个 sourceDocumentId")
    expect(messages[0]?.content).toContain("doc-rag")
    expect(messages[0]?.content).toContain("rag 文档必须输出 expectedIntent = R")
    expect(messages[0]?.content).toContain("non-r 文档不得输出 expectedIntent = R")
  })

  it("includes sourceDocumentId in the non-routing case schema when document route modes are configured", () => {
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
        referencedDocuments: [
          { id: "doc-a", name: "退款政策.docx", type: "docx", content: "退款到账时效说明" },
        ],
        sessionHistory: [],
        userMessage: "帮我生成一个单 Prompt 测试集",
      },
      {
        documentRouteModes: [{ documentId: "doc-a", routeMode: "non-r" }],
      }
    )

    expect(messages[0]?.content).toContain('"sourceDocumentId": "主文档 ID（如果本次生成选择了文档来源，则必填）"')
    expect(messages[0]?.content).toContain("每条用例必须标注一个 sourceDocumentId")
  })
})
