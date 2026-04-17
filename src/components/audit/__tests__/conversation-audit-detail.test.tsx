import React from "react"
import fs from "node:fs"
import path from "node:path"
import { renderToStaticMarkup } from "react-dom/server"

import * as ConversationAuditDetailModule from "@/components/audit/conversation-audit-detail"
import { ConversationAuditDetail } from "@/components/audit/conversation-audit-detail"

function renderParsingDetail() {
  return renderToStaticMarkup(
    <ConversationAuditDetail
      projectId="project-1"
      createMode={false}
      data={{
        job: {
          id: "job-1",
          projectId: "project-1",
          name: "Audit Job",
          status: "parsing" as never,
          parseSummary: {
            knowledgeFileCount: 0,
            conversationCount: 0,
            turnCount: 0,
            invalidRowCount: 0,
          },
          issueCount: 0,
          totalTurns: 0,
          errorMessage: null,
          createdAt: "2026-03-19T00:00:00.000Z",
          updatedAt: "2026-03-19T00:00:00.000Z",
          completedAt: null,
        },
        parseSummary: {
          knowledgeFileCount: 0,
          conversationCount: 0,
          turnCount: 0,
          invalidRowCount: 0,
        },
        conversations: [],
        turns: [],
      }}
      onCreated={() => {}}
      onRefresh={async () => {
        throw new Error("unused in detail mode")
      }}
      onDeleted={async () => {}}
    />
  )
}

describe("ConversationAuditDetail create mode", () => {
  it("merges multiple knowledge-file selections and replaces same-name files with the latest upload", () => {
    const mergeKnowledgeFiles = (
      ConversationAuditDetailModule as Record<string, unknown>
    ).mergeKnowledgeFiles as ((existing: File[], incoming: File[]) => File[]) | undefined

    expect(typeof mergeKnowledgeFiles).toBe("function")

    const firstFaq = new File(["old faq"], "faq.docx", { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" })
    const guide = new File(["guide"], "guide.html", { type: "text/html" })
    const latestFaq = new File(["new faq"], "faq.docx", { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" })
    const pricing = new File(["pricing"], "pricing.xls", { type: "application/vnd.ms-excel" })

    const firstSelection = mergeKnowledgeFiles?.([], [firstFaq, guide]) ?? []
    expect(firstSelection.map((file) => file.name)).toEqual(["faq.docx", "guide.html"])

    const secondSelection = mergeKnowledgeFiles?.(firstSelection, [latestFaq, pricing]) ?? []
    expect(secondSelection).toHaveLength(3)
    expect(secondSelection.map((file) => file.name)).toEqual(["faq.docx", "guide.html", "pricing.xls"])
    expect(secondSelection[0]).toBe(latestFaq)
  })

  it("renders prominent upload cards and only allows mixed Word/HTML/Excel knowledge files", () => {
    const html = renderToStaticMarkup(
      <ConversationAuditDetail
        projectId="project-1"
        data={null}
        createMode
        onCreated={() => {}}
        onRefresh={async () => {
          throw new Error("unused in create mode")
        }}
        onDeleted={async () => {}}
      />
    )

    expect(html).toContain("点击上传或拖拽文件到此处")
    expect(html).toContain("支持混合上传 Word、HTML、Excel")
    expect(html).toContain("仅支持 Excel，对话按 Conversation ID 解析")
    expect(html).toContain('accept=".doc,.docx,.html,.htm,.xls,.xlsx"')
    expect(html).toContain('accept=".xls,.xlsx"')
    expect(html).not.toContain(".csv")
    expect(html).not.toContain(".txt")
    expect(html).not.toContain(".md")
  })

  it("reserves fixed upload-card height and internal scroll space for selected files", () => {
    const html = renderToStaticMarkup(
      <ConversationAuditDetail
        projectId="project-1"
        data={null}
        createMode
        onCreated={() => {}}
        onRefresh={async () => {
          throw new Error("unused in create mode")
        }}
        onDeleted={async () => {}}
      />
    )

    expect(html).toContain("尚未选择文件")
    expect(html).toContain("h-[18rem]")
    expect(html).not.toContain("h-[22rem]")
    expect(html).toContain("overflow-y-auto")
  })

  it("makes the create form independently scrollable so the submit action stays reachable", () => {
    const html = renderToStaticMarkup(
      <ConversationAuditDetail
        projectId="project-1"
        data={null}
        createMode
        onCreated={() => {}}
        onRefresh={async () => {
          throw new Error("unused in create mode")
        }}
        onDeleted={async () => {}}
      />
    )

    expect(html).toContain("flex h-full flex-1 overflow-hidden bg-muted/20")
    expect(html).toContain('class="mx-auto flex min-h-0 w-full max-w-4xl flex-1 flex-col gap-6 overflow-y-auto p-6"')
    expect(html).toContain("创建任务")
  })

  it("shows parsing progress and disables audit actions while uploaded files are being parsed", () => {
    const html = renderParsingDetail()

    expect(html).toContain("解析中")
    expect(html).toContain("正在解析上传文件")
    expect(html).toContain("开始检查")
    expect(html).toContain("导出 Excel")
    expect((html.match(/disabled/g) ?? []).length).toBeGreaterThanOrEqual(3)
  })

  it("captures the parsing job id before polling refreshes", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "src/components/audit/conversation-audit-detail.tsx"),
      "utf8"
    )

    expect(source).toContain("const parsingJobId = localData.job.id")
    expect(source).toContain("onRefresh(parsingJobId)")
    expect(source).not.toContain("const refreshed = await onRefresh(localData.job.id)")
  })

  it("disables the start action and shows running progress when the selected job is already running", () => {
    const html = renderToStaticMarkup(
      <ConversationAuditDetail
        projectId="project-1"
        createMode={false}
        data={{
          job: {
            id: "job-running",
            projectId: "project-1",
            name: "Running Audit Job",
            status: "running" as never,
            parseSummary: {
              knowledgeFileCount: 1,
              conversationCount: 1,
              turnCount: 2,
              invalidRowCount: 0,
            },
            issueCount: 0,
            totalTurns: 2,
            errorMessage: null,
            createdAt: "2026-03-19T00:00:00.000Z",
            updatedAt: "2026-03-19T00:00:00.000Z",
            completedAt: null,
          },
          parseSummary: {
            knowledgeFileCount: 1,
            conversationCount: 1,
            turnCount: 2,
            invalidRowCount: 0,
          },
          conversations: [],
          turns: [],
        }}
        onCreated={() => {}}
        onRefresh={async () => {
          throw new Error("unused in detail mode")
        }}
        onDeleted={async () => {}}
      />
    )

    expect(html).toContain("运行中")
    expect(html).toContain("正在执行会话质检")
    expect(html).toMatch(/<button[^>]*disabled[^>]*>.*开始检查<\/button>/s)
  })

  it("scopes running progress to the current job so other draft jobs stay idle", () => {
    const getConversationAuditJobViewState = (
      ConversationAuditDetailModule as Record<string, unknown>
    ).getConversationAuditJobViewState as ((job: {
      id: string
      status: string
      errorMessage: string | null
    }, runProgressByJobId?: Record<string, string>) => {
      isParsing: boolean
      isRunning: boolean
      progressMessage: string
    }) | undefined

    expect(typeof getConversationAuditJobViewState).toBe("function")

    const otherDraftJobState = getConversationAuditJobViewState?.({
      id: "job-2",
      status: "draft",
      errorMessage: null,
    }, {
      "job-1": "正在检查第 1 轮",
    })

    expect(otherDraftJobState).toMatchObject({
      isParsing: false,
      isRunning: false,
      progressMessage: "上传完成后可直接运行会话质检",
    })
  })

  it("renders expandable conversation cards with overall, process, and knowledge results", () => {
    const html = renderToStaticMarkup(
      <ConversationAuditDetail
        projectId="project-1"
        createMode={false}
        data={{
          job: {
            id: "job-1",
            projectId: "project-1",
            name: "Audit Job",
            status: "completed" as never,
            parseSummary: {
              knowledgeFileCount: 1,
              conversationCount: 1,
              turnCount: 2,
              invalidRowCount: 0,
            },
            issueCount: 1,
            totalTurns: 2,
            errorMessage: null,
            createdAt: "2026-03-19T00:00:00.000Z",
            updatedAt: "2026-03-19T00:00:00.000Z",
            completedAt: "2026-03-19T00:00:00.000Z",
          },
          parseSummary: {
            knowledgeFileCount: 1,
            conversationCount: 1,
            turnCount: 2,
            invalidRowCount: 0,
          },
          conversations: [
            {
              id: "conv-1",
              jobId: "job-1",
              externalConversationId: "COV-001",
              turnCount: 2,
              overallStatus: "failed",
              processStatus: "failed",
              knowledgeStatus: "failed",
              riskLevel: "high",
              summary: "缺少订单核验，退款时效回答错误",
              processSteps: [
                {
                  name: "核验订单信息",
                  status: "out_of_order",
                  reason: "未执行订单核验",
                  sourceNames: ["退款处理流程.html"],
                },
              ],
              createdAt: "2026-03-19T00:00:00.000Z",
            } as never,
            {
              id: "conv-2",
              jobId: "job-1",
              externalConversationId: "COV-002",
              turnCount: 1,
              overallStatus: "passed",
              processStatus: "passed",
              knowledgeStatus: "passed",
              riskLevel: "low",
              summary: "",
              processSteps: [],
              createdAt: "2026-03-19T00:00:00.000Z",
            } as never,
          ],
          turns: [
            {
              id: "turn-1",
              jobId: "job-1",
              conversationId: "conv-1",
              turnIndex: 0,
              userMessage: "我想退款",
              botReply: "24 小时到账",
              hasIssue: true,
              knowledgeAnswer: "3-7 个工作日到账",
              retrievedSources: [{ chunkId: "faq:0", sourceName: "退款规则说明.docx", score: 10 }],
              createdAt: "2026-03-19T00:00:00.000Z",
              updatedAt: "2026-03-19T00:00:00.000Z",
            },
            {
              id: "turn-2",
              jobId: "job-1",
              conversationId: "conv-1",
              turnIndex: 1,
              userMessage: "运费呢",
              botReply: "",
              hasIssue: true,
              knowledgeAnswer: "需区分质量问题与非质量问题",
              retrievedSources: [{ chunkId: "faq:1", sourceName: "售后政策.docx", score: 9 }],
              createdAt: "2026-03-19T00:00:00.000Z",
              updatedAt: "2026-03-19T00:00:00.000Z",
            },
            {
              id: "turn-3",
              jobId: "job-1",
              conversationId: "conv-2",
              turnIndex: 0,
              userMessage: "你好",
              botReply: "你好，请问需要什么帮助？",
              hasIssue: false,
              knowledgeAnswer: null,
              retrievedSources: [],
              createdAt: "2026-03-19T00:00:00.000Z",
              updatedAt: "2026-03-19T00:00:00.000Z",
            },
          ],
        }}
        onCreated={() => {}}
        onRefresh={async () => {
          throw new Error("unused in detail mode")
        }}
        onDeleted={async () => {}}
      />
    )

    expect(html).toContain("整体未通过")
    expect(html).toContain("流程异常")
    expect(html).toContain("知识错误")
    expect(html).toContain("对话内容")
    expect(html).toContain("流程规范检查")
    expect(html).toContain("知识问答问题")
    expect(html).toContain("顺序异常")
    expect(html).toContain("退款处理流程.html")
    expect(html).toContain("rounded border bg-muted/20 divide-y")
    expect(html).toContain(">用户<")
    expect(html).toContain(">助手<")
    expect(html).toContain("24 小时到账")
    expect(html).toContain("无回复")
    expect(html).not.toContain("机器人")
    expect(html).toContain("点击卡片查看对话内容与详细评估。")
    expect((html.match(/点击卡片查看对话内容与详细评估。/g) ?? [])).toHaveLength(1)
    expect(html).not.toContain("展开查看会话内容与详细评估结果。")
    expect(html).toContain("grid grid-cols-4 gap-3")
    expect(html).not.toContain("grid grid-cols-4 gap-4")
    expect(html).toContain("space-y-3 px-5 py-4 sm:px-6")
    expect(html).toContain("min-w-0 max-w-[42rem] flex-1 space-y-1")
    expect(html).toContain("flex shrink-0 flex-nowrap justify-end gap-2")
    expect(html).not.toContain("flex flex-wrap justify-end gap-2")
  })

  it("keeps prototype-style risk, score, and two-column assessment shell", () => {
    const html = renderToStaticMarkup(
      <ConversationAuditDetail
        projectId="project-1"
        createMode={false}
        data={{
          job: {
            id: "job-1",
            projectId: "project-1",
            name: "Audit Job",
            status: "completed" as never,
            parseSummary: {
              knowledgeFileCount: 1,
              conversationCount: 1,
              turnCount: 2,
              invalidRowCount: 0,
            },
            issueCount: 1,
            totalTurns: 2,
            errorMessage: null,
            createdAt: "2026-03-19T00:00:00.000Z",
            updatedAt: "2026-03-19T00:00:00.000Z",
            completedAt: "2026-03-19T00:00:00.000Z",
          },
          parseSummary: {
            knowledgeFileCount: 1,
            conversationCount: 1,
            turnCount: 2,
            invalidRowCount: 0,
          },
          conversations: [
            {
              id: "conv-1",
              jobId: "job-1",
              externalConversationId: "1042",
              turnCount: 2,
              overallStatus: "failed",
              processStatus: "failed",
              knowledgeStatus: "failed",
              riskLevel: "high",
              summary: "未按退款政策回复，遗漏关键时限信息",
              processSteps: [
                {
                  name: "问候规范",
                  status: "passed",
                  reason: "已完成",
                  sourceNames: [],
                },
              ],
              createdAt: "2026-03-19T00:00:00.000Z",
            } as never,
          ],
          turns: [
            {
              id: "turn-1",
              jobId: "job-1",
              conversationId: "conv-1",
              turnIndex: 0,
              userMessage: "退款什么时候到账？",
              botReply: "请再等等。",
              hasIssue: true,
              knowledgeAnswer: "审核通过后通常 1 到 3 个工作日到账。",
              retrievedSources: [{ chunkId: "faq:0", sourceName: "退款规则说明.docx", score: 10 }],
              createdAt: "2026-03-19T00:00:00.000Z",
              updatedAt: "2026-03-19T00:00:00.000Z",
            },
          ],
        }}
        onCreated={() => {}}
        onRefresh={async () => {
          throw new Error("unused in detail mode")
        }}
        onDeleted={async () => {}}
      />
    )

    expect(html).toContain("高风险")
    expect(html).toContain("45分")
    expect(html).toContain("问题摘要")
    expect(html).toContain("grid gap-4 lg:grid-cols-[1.1fr_0.9fr]")
    expect(html).toContain("对话记录")
  })
})
