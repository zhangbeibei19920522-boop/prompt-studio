import {
  buildKnowledgeTaskRows,
  buildKnowledgeVersionRows,
  getKnowledgeAuditStatusLabel,
  getKnowledgeVersionStatusLabel,
} from "@/components/knowledge-automation/model"

describe("knowledge automation model", () => {
  it("maps backend knowledge versions and index versions into operator-facing rows", () => {
    const rows = buildKnowledgeVersionRows(
      [
        {
          id: "kv-1",
          knowledgeBaseId: "kb-1",
          taskId: "task-1",
          name: "第一轮",
          status: "draft",
          buildProfile: "generic_customer_service",
          sourceSummary: {},
          stageSummary: {
            sourceCount: 2,
            excludedCount: 0,
            rawRecordCount: 2,
            cleanedCount: 2,
            includeCount: 2,
            highRiskCount: 1,
            conflictCount: 0,
            pendingCount: 1,
            blockedCount: 0,
            approvedCount: 1,
            parentCount: 1,
            chunkCount: 2,
            coverage: 50,
            orphanCount: 1,
            ambiguityCount: 0,
            stageCounts: [],
          },
          coverageAudit: {
            coverage: 50,
            auditStatus: "warning",
            reasons: ["High-risk records require manual review before release"],
            orphanRecords: ["How to restore factory settings?"],
            ambiguityRecords: [],
          },
          qaPairCount: 1,
          parentCount: 1,
          chunkCount: 2,
          pendingCount: 1,
          blockedCount: 0,
          parentsFilePath: "/tmp/parents.jsonl",
          chunksFilePath: "/tmp/chunks.jsonl",
          manifestFilePath: "/tmp/manifest.json",
          createdAt: "2026-04-22T10:00:00.000Z",
          updatedAt: "2026-04-22T10:00:00.000Z",
          publishedAt: null,
        },
      ],
      [],
    )

    expect(rows).toEqual([
      expect.objectContaining({
        knowledgeVersionId: "kv-1",
        indexVersionId: "待生成",
        status: "草稿",
        coverage: "50%",
        auditStatus: "需关注：High-risk records require manual review before release",
        qaPairCount: "1",
      }),
    ])
  })

  it("maps backend tasks into operator-facing task rows", () => {
    const rows = buildKnowledgeTaskRows([
      {
        id: "task-1",
        projectId: "project-1",
        knowledgeBaseId: "kb-1",
        knowledgeVersionId: "kv-1",
        knowledgeIndexVersionId: null,
        name: "Q2 Batch Update",
        taskType: "batch",
        status: "running",
        currentStep: "building_artifacts",
        progress: 45,
        baseVersionId: null,
        input: {
          documentIds: ["doc-1"],
          manualDrafts: [],
          repairQuestions: [],
        },
        stageSummary: null,
        errorMessage: null,
        createdAt: "2026-04-22T09:00:00.000Z",
        updatedAt: "2026-04-22T10:00:00.000Z",
        startedAt: "2026-04-22T09:05:00.000Z",
        completedAt: null,
      },
    ])

    expect(rows).toEqual([
      expect.objectContaining({
        name: "Q2 Batch Update",
        type: "批量文件更新",
        stage: "构建产物",
        status: "进行中",
      }),
    ])
  })

  it("formats status and audit labels from backend states", () => {
    expect(getKnowledgeVersionStatusLabel("draft")).toBe("草稿")
    expect(getKnowledgeVersionStatusLabel("archived")).toBe("已归档")
    expect(getKnowledgeAuditStatusLabel({ auditStatus: "normal", reasons: [] })).toBe("正常")
    expect(
      getKnowledgeAuditStatusLabel({
        auditStatus: "warning",
        reasons: ["Conflicting records were blocked from publication"],
      }),
    ).toBe("需关注：Conflicting records were blocked from publication")
  })
})
