import React from "react"
import { renderToStaticMarkup } from "react-dom/server"

import { DetailView } from "@/components/knowledge-automation/detail-view"
import type { KnowledgeBuildTask, KnowledgeIndexVersion, KnowledgeVersion } from "@/types/database"

function buildTask(): KnowledgeBuildTask {
  return {
    id: "task-1",
    projectId: "project-1",
    knowledgeBaseId: "kb-1",
    knowledgeVersionId: "kv-router-2026-04-23",
    knowledgeIndexVersionId: "kiv-router-2026-04-23",
    name: "路由器问题批量清洗",
    taskType: "batch",
    status: "pending",
    currentStep: "risk_review",
    progress: 75,
    baseVersionId: "kv-router-2026-04-18",
    input: { documentIds: ["doc-1"], manualDrafts: [], repairQuestions: [] },
    stageSummary: {
      sourceCount: 6,
      excludedCount: 1,
      rawRecordCount: 20,
      cleanedCount: 18,
      includeCount: 17,
      highRiskCount: 1,
      conflictCount: 1,
      pendingCount: 2,
      blockedCount: 1,
      approvedCount: 14,
      parentCount: 14,
      chunkCount: 28,
      coverage: 70,
      orphanCount: 2,
      ambiguityCount: 1,
      stageCounts: [
        { stage: "stage1_source_manifest", value: "6" },
        { stage: "stage10_parents", value: "14" },
      ],
    },
    errorMessage: null,
    createdAt: "2026-04-23T08:00:00.000Z",
    updatedAt: "2026-04-23T08:10:00.000Z",
    startedAt: "2026-04-23T08:00:00.000Z",
    completedAt: null,
  }
}

function buildVersion(): KnowledgeVersion {
  return {
    id: "kv-router-2026-04-23",
    knowledgeBaseId: "kb-1",
    taskId: "task-1",
    name: "路由器 4 月 23 日草稿",
    status: "draft",
    buildProfile: "generic_customer_service",
    sourceSummary: {
      projectName: "客服项目",
      sourceCount: 6,
    },
    stageSummary: {
      sourceCount: 6,
      excludedCount: 1,
      rawRecordCount: 20,
      cleanedCount: 18,
      includeCount: 17,
      highRiskCount: 1,
      conflictCount: 1,
      pendingCount: 2,
      blockedCount: 1,
      approvedCount: 14,
      parentCount: 14,
      chunkCount: 28,
      coverage: 70,
      orphanCount: 2,
      ambiguityCount: 1,
      stageCounts: [
        { stage: "stage1_source_manifest", value: "6" },
        { stage: "stage2_raw_records", value: "20" },
        { stage: "stage10_parents", value: "14" },
        { stage: "stage11_coverage_audit", value: "70" },
      ],
    },
    coverageAudit: {
      coverage: 70,
      auditStatus: "warning",
      reasons: ["High-risk records require manual review before release"],
      orphanRecords: ["Agent Assist.xlsx 的平台说明尚未归入问答对"],
      ambiguityRecords: ["设备保修期多久？"],
    },
    qaPairCount: 14,
    parentCount: 14,
    chunkCount: 28,
    pendingCount: 2,
    blockedCount: 1,
    parentsFilePath: "/tmp/parents.jsonl",
    chunksFilePath: "/tmp/chunks.jsonl",
    manifestFilePath: "/tmp/manifest.json",
    createdAt: "2026-04-23T08:08:00.000Z",
    updatedAt: "2026-04-23T08:10:00.000Z",
    publishedAt: null,
    manifest: {
      generatedAt: "2026-04-23T08:08:00.000Z",
      profileKey: "generic_customer_service",
      projectName: "客服项目",
      sourceSummary: {
        sourceCount: 6,
      },
      stageSummary: {
        sourceCount: 6,
        excludedCount: 1,
        rawRecordCount: 20,
        cleanedCount: 18,
        includeCount: 17,
        highRiskCount: 1,
        conflictCount: 1,
        pendingCount: 2,
        blockedCount: 1,
        approvedCount: 14,
        parentCount: 14,
        chunkCount: 28,
        coverage: 70,
        orphanCount: 2,
        ambiguityCount: 1,
        stageCounts: [
          { stage: "stage1_source_manifest", value: "6" },
          { stage: "stage2_raw_records", value: "20" },
          { stage: "stage10_parents", value: "14" },
          { stage: "stage11_coverage_audit", value: "70" },
        ],
      },
      coverageAudit: {
        coverage: 70,
        auditStatus: "warning",
        reasons: ["High-risk records require manual review before release"],
        orphanRecords: ["Agent Assist.xlsx 的平台说明尚未归入问答对"],
        ambiguityRecords: ["设备保修期多久？"],
      },
      pendingRecords: [
        {
          id: "pending-1",
          question: "Agent Assist 平台说明",
          reason: "Repair requests remain pending because they have no approved answer yet",
          sourceFiles: ["Agent Assist.xlsx"],
        },
      ],
      blockedRecords: [
        {
          id: "blocked-1",
          question: "设备保修期多久？",
          reason: "Conflicting answers were detected for the same normalized question",
          sourceFiles: ["Hisense RV Fridge Policy 062722.docx"],
        },
      ],
      highRiskRecords: [
        {
          id: "risk-1",
          question: "退款政策说明",
          reason: "Matched generic high-risk policy keywords",
          sourceFiles: ["$20 Large TV Panel Destroy eGift Card Policy.docx"],
        },
      ],
      stageArtifacts: {
        conflictRecords: [
          {
            id: "blocked-1",
            question: "设备保修期多久？",
            answerPreview: "标准保修期为 24 个月，延保服务以销售订单中的服务条款为准。",
            sourceDocumentName: "Hisense RV Fridge Policy 062722.docx",
            sourceFiles: ["Hisense RV Fridge Policy 062722.docx"],
            blockedReason: "Conflicting answers were detected for the same normalized question",
          },
        ],
        promotedRecords: [
          {
            id: "risk-1",
            question: "退款政策说明",
            answerPreview: "退款需在 7 天内发起，并由财务二次确认。",
            sourceDocumentName: "$20 Large TV Panel Destroy eGift Card Policy.docx",
            sourceFiles: ["$20 Large TV Panel Destroy eGift Card Policy.docx"],
            riskReason: "Matched generic high-risk policy keywords",
          },
        ],
        parents: [
          {
            id: "parent-1",
            question: "路由器密码如何重置？",
            recordKind: "explicit_spreadsheet_faq",
            sourceFiles: ["Agent Assist.xlsx"],
            metadata: {
              questionSignature: "router_password_reset",
              intent: "how_to",
              domain: "设备支持",
              subject: "密码重置",
              device: "路由器",
              product_model: "通用",
              scope_terms: ["密码", "Reset"],
              is_exact_faq: true,
            },
          },
        ],
        chunks: [
          {
            id: "chunk-1",
            parentId: "parent-1",
            chunkOrder: 1,
            sectionTitle: "概述",
            chunkType: "answer",
            metadata: {},
          },
        ],
      },
      snapshotHash: "hash-1",
    },
    parents: [
      {
        id: "parent-1",
        knowledgeVersionId: "kv-router-2026-04-23",
        question: "路由器密码如何重置？",
        answer: "找到设备背面的 Reset 按钮，按住 10 秒钟后等待设备重启，再使用默认管理员账号登录。",
        questionAliases: ["路由器忘记密码怎么办"],
        metadata: {
          questionSignature: "router_password_reset",
          intent: "how_to",
          domain: "设备支持",
          subject: "密码重置",
          device: "路由器",
          product_model: "通用",
          scope_terms: ["密码", "Reset"],
          is_exact_faq: true,
        },
        sourceFiles: ["Agent Assist.xlsx"],
        sourceRecordIds: ["doc-1:sheet:FAQ:2"],
        reviewStatus: "approved",
        recordKind: "explicit_spreadsheet_faq",
        isHighRisk: false,
        inheritedRiskReason: "",
        createdAt: "2026-04-23T08:08:00.000Z",
        updatedAt: "2026-04-23T08:08:00.000Z",
      },
    ],
    chunks: [
      {
        id: "chunk-1",
        knowledgeVersionId: "kv-router-2026-04-23",
        parentId: "parent-1",
        chunkOrder: 1,
        sectionTitle: "概述",
        chunkText: "找到设备背面的 Reset 按钮，按住 10 秒钟后等待设备重启。",
        embeddingText: "主问题：路由器密码如何重置？",
        chunkType: "answer",
        metadata: {
          sourceFile: "Agent Assist.xlsx",
        },
        createdAt: "2026-04-23T08:08:00.000Z",
        updatedAt: "2026-04-23T08:08:00.000Z",
      },
    ],
  }
}

function buildBaseVersion(): KnowledgeVersion {
  return {
    id: "kv-router-2026-04-18",
    knowledgeBaseId: "kb-1",
    taskId: "task-0",
    name: "路由器 4 月 18 日已确认版本",
    status: "archived",
    buildProfile: "generic_customer_service",
    sourceSummary: {
      projectName: "客服项目",
      sourceCount: 4,
    },
    stageSummary: {
      sourceCount: 4,
      excludedCount: 0,
      rawRecordCount: 12,
      cleanedCount: 12,
      includeCount: 12,
      highRiskCount: 0,
      conflictCount: 0,
      pendingCount: 0,
      blockedCount: 0,
      approvedCount: 12,
      parentCount: 12,
      chunkCount: 20,
      coverage: 100,
      orphanCount: 0,
      ambiguityCount: 0,
      stageCounts: [],
    },
    coverageAudit: {
      coverage: 100,
      auditStatus: "normal",
      reasons: [],
      orphanRecords: [],
      ambiguityRecords: [],
    },
    qaPairCount: 12,
    parentCount: 12,
    chunkCount: 20,
    pendingCount: 0,
    blockedCount: 0,
    parentsFilePath: "/tmp/base-parents.jsonl",
    chunksFilePath: "/tmp/base-chunks.jsonl",
    manifestFilePath: "/tmp/base-manifest.json",
    createdAt: "2026-04-18T08:08:00.000Z",
    updatedAt: "2026-04-18T08:10:00.000Z",
    publishedAt: "2026-04-18T09:00:00.000Z",
    parents: [
      {
        id: "parent-base-1",
        knowledgeVersionId: "kv-router-2026-04-18",
        question: "设备保修期多久？",
        answer: "当前知识版本提供 18 个月标准保修，延保服务需要单独购买。",
        questionAliases: ["设备质保多久"],
        metadata: {},
        sourceFiles: ["历史 FAQ.xlsx"],
        sourceRecordIds: ["base:1"],
        reviewStatus: "approved",
        recordKind: "explicit_spreadsheet_faq",
        isHighRisk: false,
        inheritedRiskReason: "",
        createdAt: "2026-04-18T08:08:00.000Z",
        updatedAt: "2026-04-18T08:08:00.000Z",
      },
    ],
    chunks: [],
  }
}

function buildIndexVersion(): KnowledgeIndexVersion {
  return {
    id: "kiv-router-2026-04-23",
    knowledgeBaseId: "kb-1",
    knowledgeVersionId: "kv-router-2026-04-23",
    name: "路由器索引 v1",
    status: "ready",
    profileKey: "generic_customer_service",
    parentCount: 14,
    chunkCount: 28,
    stageSummary: {
      sourceCount: 6,
      excludedCount: 1,
      rawRecordCount: 20,
      cleanedCount: 18,
      includeCount: 17,
      highRiskCount: 1,
      conflictCount: 1,
      pendingCount: 2,
      blockedCount: 1,
      approvedCount: 14,
      parentCount: 14,
      chunkCount: 28,
      coverage: 70,
      orphanCount: 2,
      ambiguityCount: 1,
      stageCounts: [],
    },
    manifestFilePath: "/tmp/index-manifest.json",
    createdAt: "2026-04-23T08:10:00.000Z",
    updatedAt: "2026-04-23T08:10:00.000Z",
    builtAt: "2026-04-23T08:10:00.000Z",
    publishedAt: null,
  }
}

const customer = {
  id: "acme" as const,
  name: "客服项目",
  hasKnowledgeBase: true,
  knowledgeBaseName: "客服项目 知识库",
  currentVersion: "kv-router-2026-04-23",
}

describe("DetailView", () => {
  it("shows loading before full task version detail is ready", () => {
    const task = buildTask()
    const summaryVersion = {
      ...buildVersion(),
      manifest: undefined,
      parents: undefined,
      chunks: undefined,
    }

    const html = renderToStaticMarkup(
      <DetailView
        customer={customer}
        detailState="risk"
        detailMode="candidate"
        activeTab="risk"
        task={task}
        version={summaryVersion}
        isVersionLoading
        hasVersionDetailLoaded={false}
        versions={[summaryVersion]}
        indexVersions={[buildIndexVersion()]}
        versionDetails={{}}
        onTabChange={() => undefined}
        onBack={() => undefined}
        onSetState={() => undefined}
        onLoadVersionDetail={() => Promise.resolve()}
      />,
    )

    expect(html).toContain("正在加载任务详情")
    expect(html).not.toContain("设备保修期多久？")
  })

  it("renders risk and cleaned tabs from real task and manifest data instead of prototype drafts", () => {
    const task = buildTask()
    const version = buildVersion()
    const baseVersion = buildBaseVersion()

    const riskHtml = renderToStaticMarkup(
      <DetailView
        customer={customer}
        detailState="risk"
        detailMode="candidate"
        activeTab="risk"
        task={task}
        version={version}
        versions={[version, baseVersion]}
        indexVersions={[buildIndexVersion()]}
        versionDetails={{ [version.id]: version, [baseVersion.id]: baseVersion }}
        onTabChange={() => undefined}
        onBack={() => undefined}
        onSetState={() => undefined}
        onLoadVersionDetail={() => Promise.resolve()}
      />,
    )

    expect(riskHtml).toContain("设备保修期多久？")
    expect(riskHtml).toContain("退款政策说明")
    expect(riskHtml).toContain("Agent Assist.xlsx 的平台说明尚未归入问答对")
    expect(riskHtml).toContain("待归类与待补充")
    expect(riskHtml).toContain("合并冲突（1）")
    expect(riskHtml).toContain("高风险删除（1）")
    expect(riskHtml).toContain("待归类与待补充（2）")
    expect(riskHtml).not.toContain("待归类与待补充摘要")
    expect(riskHtml).not.toContain("当前知识版本中存在同题内容，请结合本次内容确认最终口径。")
    expect(riskHtml).not.toContain("系统建议保留的内容")
    expect(riskHtml).not.toContain("化学品泄漏事故")

    const cleanedHtml = renderToStaticMarkup(
      <DetailView
        customer={customer}
        detailState="review"
        detailMode="candidate"
        activeTab="cleaned"
        task={task}
        version={version}
        versions={[version, baseVersion]}
        indexVersions={[buildIndexVersion()]}
        versionDetails={{ [version.id]: version, [baseVersion.id]: baseVersion }}
        onTabChange={() => undefined}
        onBack={() => undefined}
        onSetState={() => undefined}
        onLoadVersionDetail={() => Promise.resolve()}
      />,
    )

    expect(cleanedHtml).toContain("路由器密码如何重置？")
    expect(cleanedHtml).toContain("Agent Assist.xlsx")
    expect(cleanedHtml).toContain("router_password_reset")
    expect(cleanedHtml).not.toContain("年假申请规则")
  })

  it("renders rounds and index tabs from real versions and index versions", () => {
    const task = buildTask()
    const version = buildVersion()
    const indexVersion = buildIndexVersion()

    const roundsHtml = renderToStaticMarkup(
      <DetailView
        customer={customer}
        detailState="review"
        detailMode="candidate"
        activeTab="rounds"
        task={task}
        version={version}
        versions={[version]}
        indexVersions={[indexVersion]}
        versionDetails={{ [version.id]: version }}
        onTabChange={() => undefined}
        onBack={() => undefined}
        onSetState={() => undefined}
        onLoadVersionDetail={() => Promise.resolve()}
      />,
    )

    expect(roundsHtml).toContain("kv-router-2026-04-23")
    expect(roundsHtml).toContain("路由器 4 月 23 日草稿")
    expect(roundsHtml).not.toContain("Q4 第 2 轮内容草稿")

    const recallHtml = renderToStaticMarkup(
      <DetailView
        customer={customer}
        detailState="indexed"
        detailMode="stg"
        activeTab="recall"
        task={task}
        version={version}
        versions={[version]}
        indexVersions={[indexVersion]}
        versionDetails={{ [version.id]: version }}
        onTabChange={() => undefined}
        onBack={() => undefined}
        onSetState={() => undefined}
        onLoadVersionDetail={() => Promise.resolve()}
      />,
    )

    expect(recallHtml).toContain("kiv-router-2026-04-23")
    expect(recallHtml).toContain("路由器索引 v1")
    expect(recallHtml).not.toContain("Q4 政策批量更新索引 v2")
  })

  it("deduplicates repeated conflict items from the same source and answer in risk review", () => {
    const task = buildTask()
    const version = buildVersion()
    const baseVersion = buildBaseVersion()

    version.manifest.blockedRecords = [
      {
        id: "blocked-1",
        question: "设备保修期多久？",
        reason: "Conflicting answers were detected for the same normalized question",
        sourceFiles: ["Hisense RV Fridge Policy 062722.docx"],
      },
      {
        id: "blocked-2",
        question: "设备保修期多久？",
        reason: "Conflicting answers were detected for the same normalized question",
        sourceFiles: ["Hisense RV Fridge Policy 062722.docx"],
      },
    ]
    version.manifest.stageArtifacts.conflictRecords = [
      {
        id: "blocked-1",
        question: "设备保修期多久？",
        answerPreview: "标准保修期为 24 个月，延保服务以销售订单中的服务条款为准。",
        sourceDocumentName: "Hisense RV Fridge Policy 062722.docx",
        sourceFiles: ["Hisense RV Fridge Policy 062722.docx"],
        blockedReason: "Conflicting answers were detected for the same normalized question",
      },
      {
        id: "blocked-2",
        question: "设备保修期多久？",
        answerPreview: "标准保修期为 24 个月，延保服务以销售订单中的服务条款为准。",
        sourceDocumentName: "Hisense RV Fridge Policy 062722.docx",
        sourceFiles: ["Hisense RV Fridge Policy 062722.docx"],
        blockedReason: "Conflicting answers were detected for the same normalized question",
      },
    ]

    const riskHtml = renderToStaticMarkup(
      <DetailView
        customer={customer}
        detailState="risk"
        detailMode="candidate"
        activeTab="risk"
        task={task}
        version={version}
        versions={[version, baseVersion]}
        indexVersions={[buildIndexVersion()]}
        versionDetails={{ [version.id]: version, [baseVersion.id]: baseVersion }}
        onTabChange={() => undefined}
        onBack={() => undefined}
        onSetState={() => undefined}
        onLoadVersionDetail={() => Promise.resolve()}
      />,
    )

    expect(riskHtml).toContain("合并冲突（1）")
  })
})
