import { buildPlanMessages } from "@/lib/ai/agent-prompt"
import { buildTestAgentMessages } from "@/lib/ai/test-agent-prompt"
import type { AgentContext } from "@/types/ai"

function createContext(overrides: Partial<AgentContext> = {}): AgentContext {
  return {
    globalBusiness: { description: "", goal: "", background: "" },
    projectBusiness: { description: "", goal: "", background: "" },
    globalMemories: [],
    projectMemories: [],
    referencedPrompts: [],
    referencedDocuments: [],
    sessionHistory: [],
    userMessage: "帮我处理这个问题",
    ...overrides,
  }
}

describe("agent context window guards", () => {
  it("bounds prompt builder context by truncating long references and limiting history", () => {
    const longText = "A".repeat(12000)
    const messages = buildPlanMessages(
      createContext({
        referencedPrompts: [
          {
            id: "prompt-1",
            projectId: "project-1",
            title: "Prompt A",
            description: "A",
            content: longText,
            tags: [],
            variables: [],
            version: 1,
            status: "active",
            createdAt: "2026-04-22T00:00:00.000Z",
            updatedAt: "2026-04-22T00:00:00.000Z",
          },
          {
            id: "prompt-2",
            projectId: "project-1",
            title: "Prompt B",
            description: "B",
            content: longText,
            tags: [],
            variables: [],
            version: 1,
            status: "active",
            createdAt: "2026-04-22T00:00:00.000Z",
            updatedAt: "2026-04-22T00:00:00.000Z",
          },
          {
            id: "prompt-3",
            projectId: "project-1",
            title: "Prompt C",
            description: "C",
            content: longText,
            tags: [],
            variables: [],
            version: 1,
            status: "active",
            createdAt: "2026-04-22T00:00:00.000Z",
            updatedAt: "2026-04-22T00:00:00.000Z",
          },
        ],
        referencedDocuments: [
          {
            id: "doc-1",
            projectId: "project-1",
            name: "FAQ-1.xlsx",
            type: "xlsx",
            content: longText,
            createdAt: "2026-04-22T00:00:00.000Z",
          },
          {
            id: "doc-2",
            projectId: "project-1",
            name: "FAQ-2.xlsx",
            type: "xlsx",
            content: longText,
            createdAt: "2026-04-22T00:00:00.000Z",
          },
          {
            id: "doc-3",
            projectId: "project-1",
            name: "FAQ-3.xlsx",
            type: "xlsx",
            content: longText,
            createdAt: "2026-04-22T00:00:00.000Z",
          },
        ],
        sessionHistory: Array.from({ length: 12 }, (_, index) => ({
          id: `msg-${index}`,
          sessionId: "session-1",
          role: index % 2 === 0 ? "user" : "assistant",
          content: `history-${index}-${"B".repeat(5000)}`,
          references: [],
          metadata: null,
          createdAt: "2026-04-22T00:00:00.000Z",
        })),
      })
    )

    expect(messages[0]?.role).toBe("system")
    expect(messages[0]?.content).toContain("另有 1 个 Prompt 未注入本轮上下文")
    expect(messages[0]?.content).toContain("另有 1 个知识库文档未注入本轮上下文")
    expect(messages[0]?.content).toContain("[内容已截断")
    expect(messages).toHaveLength(10)
  })

  it("applies the same bounds to test agent messages", () => {
    const longText = "知识".repeat(8000)
    const messages = buildTestAgentMessages(
      createContext({
        referencedDocuments: [
          {
            id: "doc-1",
            projectId: "project-1",
            name: "大型表格.xlsx",
            type: "xlsx",
            content: longText,
            createdAt: "2026-04-22T00:00:00.000Z",
          },
        ],
        sessionHistory: Array.from({ length: 10 }, (_, index) => ({
          id: `test-msg-${index}`,
          sessionId: "session-1",
          role: index % 2 === 0 ? "user" : "assistant",
          content: `history-${index}-${"C".repeat(5000)}`,
          references: [],
          metadata: null,
          createdAt: "2026-04-22T00:00:00.000Z",
        })),
      })
    )

    expect(messages[0]?.content).toContain("[内容已截断")
    expect(messages).toHaveLength(10)
  })
})
