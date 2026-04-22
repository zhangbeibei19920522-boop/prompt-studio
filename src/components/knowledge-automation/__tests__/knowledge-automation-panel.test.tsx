import React from "react"
import { readFileSync } from "fs"
import { join } from "path"
import { renderToStaticMarkup } from "react-dom/server"

import { KnowledgeAutomationPanel } from "@/components/knowledge-automation/knowledge-automation-panel"

function buildInitialData() {
  return {
    knowledgeBase: {
      id: "kb-1",
      projectId: "project-1",
      name: "客服项目 知识库",
      profileKey: "generic_customer_service",
      profileConfig: {
        sourceAdapters: {},
        cleaningRules: {},
        riskRules: {},
        promotionRules: {},
        mergeRules: {},
        conflictRules: {},
        metadataSchema: [],
        entityDictionary: {},
      },
      repairConfig: {},
      currentDraftVersionId: "kv-1",
      currentStgVersionId: "kv-2",
      currentProdVersionId: "kv-3",
      currentStgIndexVersionId: "kiv-2",
      currentProdIndexVersionId: "kiv-3",
      createdAt: "2026-04-22T08:00:00.000Z",
      updatedAt: "2026-04-22T08:00:00.000Z",
    },
    tasks: [
      {
        id: "task-1",
        projectId: "project-1",
        knowledgeBaseId: "kb-1",
        knowledgeVersionId: "kv-1",
        knowledgeIndexVersionId: null,
        name: "Q2 Batch Update",
        taskType: "batch" as const,
        status: "running" as const,
        currentStep: "building_artifacts",
        progress: 40,
        baseVersionId: "kv-3",
        input: { documentIds: ["doc-1"], manualDrafts: [], repairQuestions: [] },
        stageSummary: null,
        errorMessage: null,
        createdAt: "2026-04-22T08:00:00.000Z",
        updatedAt: "2026-04-22T08:10:00.000Z",
        startedAt: "2026-04-22T08:01:00.000Z",
        completedAt: null,
      },
    ],
    versions: [
      {
        id: "kv-1",
        knowledgeBaseId: "kb-1",
        taskId: "task-1",
        name: "草稿版本",
        status: "draft" as const,
        buildProfile: "generic_customer_service",
        sourceSummary: {},
        stageSummary: {
          sourceCount: 1,
          excludedCount: 0,
          rawRecordCount: 1,
          cleanedCount: 1,
          includeCount: 1,
          highRiskCount: 0,
          conflictCount: 0,
          pendingCount: 0,
          blockedCount: 0,
          approvedCount: 1,
          parentCount: 1,
          chunkCount: 1,
          coverage: 100,
          orphanCount: 0,
          ambiguityCount: 0,
          stageCounts: [],
        },
        coverageAudit: {
          coverage: 100,
          auditStatus: "normal" as const,
          reasons: [],
          orphanRecords: [],
          ambiguityRecords: [],
        },
        qaPairCount: 1,
        parentCount: 1,
        chunkCount: 1,
        pendingCount: 0,
        blockedCount: 0,
        parentsFilePath: "/tmp/parents-1.jsonl",
        chunksFilePath: "/tmp/chunks-1.jsonl",
        manifestFilePath: "/tmp/manifest-1.json",
        createdAt: "2026-04-22T08:10:00.000Z",
        updatedAt: "2026-04-22T08:10:00.000Z",
        publishedAt: null,
      },
      {
        id: "kv-2",
        knowledgeBaseId: "kb-1",
        taskId: "task-2",
        name: "STG 版本",
        status: "stg" as const,
        buildProfile: "generic_customer_service",
        sourceSummary: {},
        stageSummary: {
          sourceCount: 1,
          excludedCount: 0,
          rawRecordCount: 1,
          cleanedCount: 1,
          includeCount: 1,
          highRiskCount: 0,
          conflictCount: 0,
          pendingCount: 0,
          blockedCount: 0,
          approvedCount: 1,
          parentCount: 1,
          chunkCount: 1,
          coverage: 100,
          orphanCount: 0,
          ambiguityCount: 0,
          stageCounts: [],
        },
        coverageAudit: {
          coverage: 96,
          auditStatus: "warning" as const,
          reasons: ["存在待归类内容"],
          orphanRecords: ["待补充记录"],
          ambiguityRecords: [],
        },
        qaPairCount: 10,
        parentCount: 10,
        chunkCount: 12,
        pendingCount: 1,
        blockedCount: 0,
        parentsFilePath: "/tmp/parents-2.jsonl",
        chunksFilePath: "/tmp/chunks-2.jsonl",
        manifestFilePath: "/tmp/manifest-2.json",
        createdAt: "2026-04-22T08:00:00.000Z",
        updatedAt: "2026-04-22T08:00:00.000Z",
        publishedAt: "2026-04-22T08:20:00.000Z",
      },
      {
        id: "kv-3",
        knowledgeBaseId: "kb-1",
        taskId: "task-3",
        name: "PROD 版本",
        status: "prod" as const,
        buildProfile: "generic_customer_service",
        sourceSummary: {},
        stageSummary: {
          sourceCount: 1,
          excludedCount: 0,
          rawRecordCount: 1,
          cleanedCount: 1,
          includeCount: 1,
          highRiskCount: 0,
          conflictCount: 0,
          pendingCount: 0,
          blockedCount: 0,
          approvedCount: 1,
          parentCount: 1,
          chunkCount: 1,
          coverage: 100,
          orphanCount: 0,
          ambiguityCount: 0,
          stageCounts: [],
        },
        coverageAudit: {
          coverage: 98,
          auditStatus: "normal" as const,
          reasons: [],
          orphanRecords: [],
          ambiguityRecords: [],
        },
        qaPairCount: 12,
        parentCount: 12,
        chunkCount: 16,
        pendingCount: 0,
        blockedCount: 0,
        parentsFilePath: "/tmp/parents-3.jsonl",
        chunksFilePath: "/tmp/chunks-3.jsonl",
        manifestFilePath: "/tmp/manifest-3.json",
        createdAt: "2026-04-22T07:00:00.000Z",
        updatedAt: "2026-04-22T07:00:00.000Z",
        publishedAt: "2026-04-22T08:30:00.000Z",
      },
      {
        id: "kv-4",
        knowledgeBaseId: "kb-1",
        taskId: "task-4",
        name: "归档版本",
        status: "archived" as const,
        buildProfile: "generic_customer_service",
        sourceSummary: {},
        stageSummary: {
          sourceCount: 1,
          excludedCount: 0,
          rawRecordCount: 1,
          cleanedCount: 1,
          includeCount: 1,
          highRiskCount: 0,
          conflictCount: 0,
          pendingCount: 0,
          blockedCount: 0,
          approvedCount: 1,
          parentCount: 1,
          chunkCount: 1,
          coverage: 100,
          orphanCount: 0,
          ambiguityCount: 0,
          stageCounts: [],
        },
        coverageAudit: {
          coverage: 94,
          auditStatus: "warning" as const,
          reasons: ["覆盖率偏低"],
          orphanRecords: [],
          ambiguityRecords: [],
        },
        qaPairCount: 8,
        parentCount: 8,
        chunkCount: 10,
        pendingCount: 0,
        blockedCount: 0,
        parentsFilePath: "/tmp/parents-4.jsonl",
        chunksFilePath: "/tmp/chunks-4.jsonl",
        manifestFilePath: "/tmp/manifest-4.json",
        createdAt: "2026-04-22T06:00:00.000Z",
        updatedAt: "2026-04-22T06:00:00.000Z",
        publishedAt: "2026-04-22T06:30:00.000Z",
      },
    ],
    indexVersions: [
      {
        id: "kiv-2",
        knowledgeBaseId: "kb-1",
        knowledgeVersionId: "kv-2",
        name: "STG 索引",
        status: "stg" as const,
        profileKey: "generic_customer_service",
        parentCount: 10,
        chunkCount: 12,
        stageSummary: {
          sourceCount: 1,
          excludedCount: 0,
          rawRecordCount: 1,
          cleanedCount: 1,
          includeCount: 1,
          highRiskCount: 0,
          conflictCount: 0,
          pendingCount: 0,
          blockedCount: 0,
          approvedCount: 1,
          parentCount: 1,
          chunkCount: 1,
          coverage: 100,
          orphanCount: 0,
          ambiguityCount: 0,
          stageCounts: [],
        },
        manifestFilePath: "/tmp/index-2.json",
        createdAt: "2026-04-22T08:20:00.000Z",
        updatedAt: "2026-04-22T08:20:00.000Z",
        builtAt: "2026-04-22T08:20:00.000Z",
        publishedAt: "2026-04-22T08:20:00.000Z",
      },
      {
        id: "kiv-3",
        knowledgeBaseId: "kb-1",
        knowledgeVersionId: "kv-3",
        name: "PROD 索引",
        status: "prod" as const,
        profileKey: "generic_customer_service",
        parentCount: 12,
        chunkCount: 16,
        stageSummary: {
          sourceCount: 1,
          excludedCount: 0,
          rawRecordCount: 1,
          cleanedCount: 1,
          includeCount: 1,
          highRiskCount: 0,
          conflictCount: 0,
          pendingCount: 0,
          blockedCount: 0,
          approvedCount: 1,
          parentCount: 1,
          chunkCount: 1,
          coverage: 100,
          orphanCount: 0,
          ambiguityCount: 0,
          stageCounts: [],
        },
        manifestFilePath: "/tmp/index-3.json",
        createdAt: "2026-04-22T08:30:00.000Z",
        updatedAt: "2026-04-22T08:30:00.000Z",
        builtAt: "2026-04-22T08:30:00.000Z",
        publishedAt: "2026-04-22T08:30:00.000Z",
      },
    ],
  }
}

describe("KnowledgeAutomationPanel", () => {
  it("shows version management as a version-only view", () => {
    const html = renderToStaticMarkup(
      <KnowledgeAutomationPanel
        projectId="project-1"
        projectName="客服项目"
        documents={[
          { id: "doc-1", name: "HR-policy-2024.docx", type: "docx" },
          { id: "doc-2", name: "attendance-rules.xlsx", type: "xlsx" },
        ]}
        section="versions"
        initialData={buildInitialData()}
      />
    )

    expect(html).toContain("版本列表")
    expect(html).toContain("回滚")
    expect(html).toContain("PROD")
    expect(html).toContain("STG")
    expect(html).toContain("草稿")
    expect(html).toContain("Push STG")
    expect(html).toContain("Push Prod")
    expect(html).not.toContain("新建任务")
    expect(html).not.toContain("任务记录")
    expect(html).not.toContain("清洗任务")
    expect(html).not.toContain("进行中")
    expect(html).not.toContain("刷新")
    expect(html).not.toContain("继续维护")
    expect(html).not.toContain("当前 PROD 版本")
    expect(html).not.toContain("当前 STG 版本")
    expect(html).not.toContain("进行中的候选版本")
    expect(html).not.toContain("页面已接入当前知识库模块")
    expect(html).not.toContain("选择文档库来源")
    expect(html).not.toContain("上传来源文档")
    expect(html).not.toContain("重新上传")
  })

  it("shows cleaning tasks as a separate task-first view", () => {
    const html = renderToStaticMarkup(
      <KnowledgeAutomationPanel
        projectId="project-1"
        projectName="客服项目"
        documents={[
          { id: "doc-1", name: "HR-policy-2024.docx", type: "docx" },
          { id: "doc-2", name: "attendance-rules.xlsx", type: "xlsx" },
        ]}
        section="tasks"
        initialData={buildInitialData()}
      />
    )

    expect(html).toContain("清洗任务")
    expect(html).toContain("任务列表")
    expect(html).toContain("新建任务")
    expect(html).toContain("进行中")
    expect(html).not.toContain("版本列表")
    expect(html).not.toContain("回滚")
  })

  it("uses the 问答对 wording and exposes content for prototype actions", () => {
    const sourceRoot = join(process.cwd(), "src/components/knowledge-automation")
    const detailSource = readFileSync(join(sourceRoot, "detail-view.tsx"), "utf8")
    const dataSource = readFileSync(join(sourceRoot, "prototype-data.ts"), "utf8")

    expect(detailSource).toContain("清洗结果确认")
    expect(detailSource).toContain("问答对草稿")
    expect(detailSource).toContain("编辑问答对")
    expect(detailSource).toContain("编辑问答对内容")
    expect(detailSource).toContain("问答对已保存")
    expect(detailSource).toContain("字段已锁定")
    expect(detailSource).toContain("锁定字段设置")
    expect(detailSource).toContain("问答对已重新生成")
    expect(detailSource).toContain("重新生成预览")
    expect(detailSource).toContain("应用生成结果")
    expect(detailSource).toContain("已从草稿列表移除")
    expect(detailSource).toContain("删除确认")
    expect(detailSource).toContain("确认删除")
    expect(detailSource).toContain("查看问答对")
    expect(detailSource).toContain("问法别名")
    expect(detailSource).toContain("业务域")
    expect(detailSource).toContain("适用设备")
    expect(detailSource).toContain("产品型号")
    expect(detailSource).toContain("范围词")
    expect(detailSource).toContain("标准 FAQ")
    expect(detailSource).toContain("question_aliases")
    expect(detailSource).toContain("is_exact_faq")
    expect(dataSource).toContain("问答对草稿")
    expect(dataSource).toContain("清洗结果确认")

    expect(detailSource).not.toContain("问答对与 metadata")
    expect(detailSource).not.toContain("metadata 编辑")
    expect(detailSource).not.toContain("Profile：generic_customer_service")
    expect(detailSource).not.toContain("metadata 会参与 alias")
    expect(detailSource).not.toContain("待确认问答对草稿")
    expect(detailSource).not.toContain("Parent 与 metadata")
    expect(detailSource).not.toContain("Parent 草稿")
    expect(detailSource).not.toContain("parents/chunks")
    expect(detailSource).not.toContain("查看 parent")
    expect(detailSource).not.toContain("KnowledgeIndexVersion")
    expect(dataSource).not.toContain("Parent")
    expect(dataSource).not.toContain("Chunk")
  })

  it("keeps risk review as side-by-side comparisons like the reference prototype", () => {
    const detailSource = readFileSync(
      join(process.cwd(), "src/components/knowledge-automation/detail-view.tsx"),
      "utf8"
    )

    expect(detailSource).toContain("待处理事项")
    expect(detailSource).toContain("合并冲突确认")
    expect(detailSource).toContain("高风险内容删除")
    expect(detailSource).toContain("当前知识版本内容")
    expect(detailSource).toContain("本次文档库内容")
    expect(detailSource).toContain("系统建议")
    expect(detailSource).toContain("原始内容")
    expect(detailSource).toContain("系统建议保留的内容")
    expect(detailSource).toContain("为什么需要确认")
    expect(detailSource).not.toContain("处理原则")
    expect(detailSource).not.toContain("审核结论只对当前任务和当前轮次生效")
    expect(detailSource).not.toContain("风险未处理前，不能进入清洗结果确认")
    expect(detailSource).not.toContain("xl:grid-cols-[minmax(0,1fr)_320px]")
  })

  it("keeps the knowledge base homepage concise and version-first", () => {
    const sourceRoot = join(process.cwd(), "src/components/knowledge-automation")
    const detailSource = readFileSync(join(sourceRoot, "detail-view.tsx"), "utf8")
    const listSource = readFileSync(join(sourceRoot, "list-view.tsx"), "utf8")
    const panelSource = readFileSync(join(sourceRoot, "knowledge-automation-panel.tsx"), "utf8")
    const versionDetailSource = readFileSync(join(sourceRoot, "version-detail-view.tsx"), "utf8")
    const dataSource = readFileSync(join(sourceRoot, "prototype-data.ts"), "utf8")

    expect(listSource).toContain("查看版本列表。")
    expect(listSource).toContain("查看当前清洗任务和处理状态。")
    expect(listSource).toContain("版本管理")
    expect(listSource).toContain("清洗任务")
    expect(listSource).toContain("版本列表")
    expect(listSource).toContain("任务列表")
    expect(listSource).toContain("推送记录")
    expect(listSource).toContain("版本推送记录")
    expect(listSource).toContain("查看整个项目的版本推送和回滚记录。")
    expect(listSource).toContain("操作人")
    expect(listSource).toContain("目标环境")
    expect(listSource).toContain('section === "tasks" ? (')
    expect(dataSource).toContain('status: "PROD"')
    expect(dataSource).toContain('status: "STG"')
    expect(dataSource).toContain('status: "草稿"')
    expect(dataSource).toContain("已归档")
    expect(dataSource).toContain('action: "Push STG"')
    expect(dataSource).toContain('action: "Push Prod"')
    expect(dataSource).toContain('action: "回滚"')
    expect(listSource).toContain("确认回滚")
    expect(listSource).toContain("回滚后，当前环境会切换到所选版本。")
    expect(listSource).toContain("确认 Push STG")
    expect(listSource).toContain("确认 Push Prod")
    expect(listSource).toContain("Push 后，当前环境会切换到所选版本。")
    expect(listSource).toContain('row.status === "已归档" ? (')
    expect(listSource).toContain('row.status === "草稿" ? (')
    expect(listSource).toContain('row.status === "STG" ? (')
    expect(listSource).toContain("Push STG")
    expect(listSource).toContain("Push Prod")
    expect(listSource).not.toContain("刷新")
    expect(listSource).not.toContain("新建维护")
    expect(listSource).not.toContain("继续维护")
    expect(listSource).not.toContain("已选择回滚版本：")
    expect(listSource).not.toContain("查看版本列表和任务记录。")
    expect(listSource).not.toContain("只保留过程追踪和排查用途，不再作为运营主入口。")
    expect(listSource).not.toContain("查看当前 PROD、STG、候选版本和历史版本。")
    expect(listSource).not.toContain("当前 PROD 版本")
    expect(listSource).not.toContain("当前 STG 版本")
    expect(listSource).not.toContain("进行中的候选版本")
    expect(listSource).not.toContain("历史上发布或归档过的内容版本。可查看内容、覆盖率和索引版本。")
    expect(listSource).not.toContain('label="当前已发布版本"')
    expect(listSource).not.toContain('label="进行中的版本"')
    expect(listSource).not.toContain('label="历史版本"')
    expect(listSource).not.toContain("grid gap-2 md:grid-cols-2 xl:grid-cols-4")
    expect(listSource).not.toContain("任务名称")
    expect(listSource).not.toContain("任务类型")
    expect(panelSource).toContain("projectId")
    expect(panelSource).toContain("knowledgeApi")
    expect(panelSource).toContain("loadKnowledgeData")
    expect(panelSource).toContain("VersionDetailView")
    expect(panelSource).toContain('view === "version-detail"')
    expect(panelSource).toContain('setView("version-detail")')
    expect(versionDetailSource).toContain("返回版本列表")
    expect(versionDetailSource).toContain("基础信息")
    expect(versionDetailSource).toContain("问答对详情")
    expect(versionDetailSource).toContain("version")
    expect(versionDetailSource).not.toContain("const rounds = [")
    expect(detailSource).toContain("返回版本首页")
    expect(detailSource).toContain("生成索引并发布到 STG")
    expect(detailSource).toContain("索引会在发布到 STG 时同步生成")
    expect(detailSource).toContain("发布到 STG")
    expect(detailSource).toContain("发布到 PROD")
    expect(detailSource).toContain("已发布到 STG，可继续验证后发布到 PROD")
    expect(detailSource).toContain("已发布到 PROD，当前线上版本已更新")
  })

  it("moves processing progress into the task header card instead of keeping it as a tab", () => {
    const sourceRoot = join(process.cwd(), "src/components/knowledge-automation")
    const detailSource = readFileSync(join(sourceRoot, "detail-view.tsx"), "utf8")
    const panelSource = readFileSync(join(sourceRoot, "knowledge-automation-panel.tsx"), "utf8")
    const prototypeSource = readFileSync(join(sourceRoot, "knowledge-automation-prototype.tsx"), "utf8")
    const dataSource = readFileSync(join(sourceRoot, "prototype-data.ts"), "utf8")

    expect(detailSource).toContain("处理进度")
    expect(detailSource).toContain("<PipelineView detailState={detailState} />")
    expect(detailSource).toContain("border-t border-slate-100 pt-4")
    expect(detailSource).toContain("relative grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-7")
    expect(detailSource).toContain("absolute left-4 right-4 top-3 hidden h-px bg-slate-200 xl:block")
    expect(detailSource).toContain("relative z-10 inline-flex min-h-7 w-full items-center justify-center gap-1.5 rounded-md border px-2 text-xs whitespace-nowrap")
    expect(detailSource).not.toContain('<section className="flex flex-wrap gap-2">')
    expect(detailSource).not.toContain("rounded-lg border bg-white p-4")
    expect(detailSource).not.toContain('TabsTrigger value="pipeline"')
    expect(detailSource).not.toContain('TabsContent value="pipeline"')
    expect(dataSource).not.toContain('"pipeline"')
    expect(panelSource).not.toContain('useState<DetailTab>("pipeline")')
    expect(prototypeSource).not.toContain('useState<DetailTab>("pipeline")')
  })

  it("lets risk cards edit current-round content without the high-risk deletion table", () => {
    const detailSource = readFileSync(
      join(process.cwd(), "src/components/knowledge-automation/detail-view.tsx"),
      "utf8"
    )

    expect(detailSource).toContain("编辑本次内容")
    expect(detailSource).toContain("保存本次内容")
    expect(detailSource).toContain("取消编辑")
    expect(detailSource).toContain("updateEditableContent")
    expect(detailSource).not.toContain("清洗后保留的文本")
    expect(detailSource).not.toContain("来源文件 / 记录")
    expect(detailSource).not.toContain("拦截阶段")
  })

  it("matches the reference cleaning round viewer for knowledge versions", () => {
    const detailSource = readFileSync(
      join(process.cwd(), "src/components/knowledge-automation/detail-view.tsx"),
      "utf8"
    )

    expect(detailSource).toContain("清洗轮次记录")
    expect(detailSource).toContain("点击查看每一轮清洗后生成的索引内容")
    expect(detailSource).toContain("本轮内容")
    expect(detailSource).toContain("本轮清洗策略")
    expect(detailSource).toContain("基础信息")
    expect(detailSource).toContain("问答对详情")
    expect(detailSource).toContain("全部索引内容（1,204）")
    expect(detailSource).toContain("已修改内容（6）")
    expect(detailSource).toContain("已删除内容（20）")
    expect(detailSource).toContain("高风险处理内容（8）")
    expect(detailSource).toContain("人工新增内容（1）")
    expect(detailSource).toContain("搜索索引内容")
    expect(detailSource).toContain("设备保修期说明")
    expect(detailSource).toContain("已入索引")
    expect(detailSource).toContain("人工补充：延保申请入口")
    expect(detailSource).toContain("来源文件数")
    expect(detailSource).toContain("原始记录数")
    expect(detailSource).toContain("覆盖率")
    expect(detailSource).toContain("审计状态")
    expect(detailSource).toContain("需关注：存在待归类内容")
    expect(detailSource).toContain("border-rose-200 bg-rose-50")
    expect(detailSource).toContain("本轮未纳入内容")
    expect(detailSource).toContain("待归类内容")
    expect(detailSource).toContain("这些内容已识别到，但还没有归入任何问答对，需要确认归类方式。")
    expect(detailSource).toContain("可能重复的内容")
    expect(detailSource).toContain("本轮未进入知识版本的内容")
    expect(detailSource).toContain("fixed inset-0 z-40")
    expect(detailSource).toContain("fixed inset-y-0 right-0 z-50")
    expect(detailSource).toContain("role=\"dialog\"")
    expect(detailSource).toContain("aria-modal=\"true\"")
    expect(detailSource).not.toContain("各 Stage 数量汇总")
    expect(detailSource).not.toContain("后续动作")
    expect(detailSource).not.toContain("查看内容")
    expect(detailSource).not.toContain("按当前范围查看本轮进入知识版本的问答对内容")
    expect(detailSource).not.toContain("问答对范围")
    expect(detailSource).not.toContain("excluded / high risk / pending / blocked 分布")
    expect(detailSource).not.toContain("孤儿记录")
    expect(detailSource).not.toContain("raw_2024_0288")
    expect(detailSource).not.toContain("amb_01")
    expect(detailSource).not.toContain("去归类")
    expect(detailSource).not.toContain("新建问答对")
    expect(detailSource).not.toContain("去确认")
    expect(detailSource).not.toContain("查看原因")
    expect(detailSource).not.toContain("继续处理风险")
    expect(detailSource).not.toContain("重新清洗异常来源")
    expect(detailSource).not.toContain("问答对快照")
    expect(detailSource).not.toContain("样例问答对")
  })

  it("keeps knowledge versions operator-facing and shows parent chunks in index version drawer", () => {
    const detailSource = readFileSync(
      join(process.cwd(), "src/components/knowledge-automation/detail-view.tsx"),
      "utf8"
    )

    expect(detailSource).toContain("索引版本列表")
    expect(detailSource).toContain("每个知识版本对应一个索引版本")
    expect(detailSource).toContain("Stage 1-9 清洗摘要")
    expect(detailSource).toContain("Stage 10 产物")
    expect(detailSource).toContain("Stage 11 覆盖率审计")
    expect(detailSource).toContain("构建摘要")
    expect(detailSource).toContain("索引版本详情")
    expect(detailSource).toContain("索引版本信息")
    expect(detailSource).toContain("Stage 10 产物规模")
    expect(detailSource).toContain("approved for stage10")
    expect(detailSource).toContain("覆盖率结果")
    expect(detailSource).toContain("异常原因")
    expect(detailSource).toContain("待归类内容（orphan）")
    expect(detailSource).toContain("可能重复内容（ambiguity）")
    expect(detailSource).toContain("知识版本")
    expect(detailSource).toContain("索引版本")
    expect(detailSource).toContain("Profile")
    expect(detailSource).toContain("Embedding")
    expect(detailSource).toContain("知识版本 ID")
    expect(detailSource).toContain("索引版本 ID")
    expect(detailSource).toContain("Parent 数")
    expect(detailSource).toContain("Chunk 数")
    expect(detailSource).toContain("查看")
    expect(detailSource).toContain("Parent / Chunks")
    expect(detailSource).toContain("搜索 parent / chunk")
    expect(detailSource).toContain("md:grid-cols-[280px_minmax(0,1fr)]")
    expect(detailSource).toContain("KnowledgeParent")
    expect(detailSource).toContain("KnowledgeChunk")
    expect(detailSource).toContain("Parent 信息")
    expect(detailSource).toContain("Chunks 信息")
    expect(detailSource).toContain("片段基础字段")
    expect(detailSource).toContain("内容与检索文本")
    expect(detailSource).toContain("parentId")
    expect(detailSource).toContain("chunkKind")
    expect(detailSource).toContain("embeddingText")
    expect(detailSource).toContain("recordKind")
    expect(detailSource).toContain("isHighRisk")
    expect(detailSource).toContain("inheritedRiskReason")
    expect(detailSource).toContain("isTimeSensitive")
    expect(detailSource).toContain("tags")
    expect(detailSource).toContain("versionTags")
    expect(detailSource).not.toContain("Parent 内容")
    expect(detailSource).not.toContain("Parent 字段信息")
    expect(detailSource).not.toContain("Chunk 列表")
    expect(detailSource).not.toContain("已进入本轮试查视图")
    expect(detailSource).not.toContain("发布确认将在索引版本页完成")
    expect(detailSource).not.toContain("重新构建索引")
    expect(detailSource).not.toContain("查看构建参数")
    expect(detailSource).not.toContain("查看 Parent / Chunks")
    expect(detailSource).not.toContain("R 节点绑定条件")
    expect(detailSource).not.toContain("标记为可绑定 R 节点")
    expect(detailSource).not.toContain("索引基础信息")
    expect(detailSource).not.toContain("一个 Parent 下可以生成多个 KnowledgeChunk，每条记录是一条索引片段。")
    expect(detailSource).not.toContain("Chunk 字段")
    expect(detailSource).not.toContain("lg:grid-cols-[260px_minmax(0,1fr)]")
    expect(detailSource).not.toContain("当前索引版本包含的 Parent 与 Chunks 内容。")
  })

  it("keeps index version generation internal and publishes through STG to PROD", () => {
    const detailSource = readFileSync(
      join(process.cwd(), "src/components/knowledge-automation/detail-view.tsx"),
      "utf8"
    )

    expect(detailSource).toContain("publishToStg")
    expect(detailSource).toContain("publishToProd")
    expect(detailSource).toContain("generatedIndexVersions")
    expect(detailSource).toContain("indexVersionName")
    expect(detailSource).toContain("运营确认完成后，系统会在发布到 STG 时同步生成索引版本。")
    expect(detailSource).toContain("待发布到 STG")
    expect(detailSource).toContain("已发布到 STG")
    expect(detailSource).not.toContain("配置索引版本")
    expect(detailSource).not.toContain("确认生成索引")
  })

  it("removes the R node configuration tab and entry buttons", () => {
    const sourceRoot = join(process.cwd(), "src/components/knowledge-automation")
    const detailSource = readFileSync(join(sourceRoot, "detail-view.tsx"), "utf8")
    const listSource = readFileSync(join(sourceRoot, "list-view.tsx"), "utf8")
    const panelSource = readFileSync(join(sourceRoot, "knowledge-automation-panel.tsx"), "utf8")
    const prototypeSource = readFileSync(join(sourceRoot, "knowledge-automation-prototype.tsx"), "utf8")
    const dataSource = readFileSync(join(sourceRoot, "prototype-data.ts"), "utf8")

    expect(detailSource).not.toContain("R 节点配置")
    expect(detailSource).not.toContain("RagConfigView")
    expect(detailSource).not.toContain('value="rag"')
    expect(listSource).not.toContain("查看 R 配置")
    expect(dataSource).not.toContain("查看 R 节点配置")
    expect(dataSource).not.toContain("配置 R 节点")
    expect(dataSource).not.toContain('"rag"')
    expect(panelSource).not.toContain('"rag"')
    expect(prototypeSource).not.toContain('"rag"')
  })

  it("keeps advanced chunk fields behind an expandable details action", () => {
    const detailSource = readFileSync(
      join(process.cwd(), "src/components/knowledge-automation/detail-view.tsx"),
      "utf8"
    )

    expect(detailSource).toContain("expandedChunkIds")
    expect(detailSource).toContain("toggleChunkDetails")
    expect(detailSource).toContain("详情")
    expect(detailSource).toContain("收起详情")
    expect(detailSource).toContain("Chunk 详情字段")
    expect(detailSource).toContain("grid gap-x-6 gap-y-2 text-sm md:grid-cols-2")
    expect(detailSource).toContain("来源信息")
    expect(detailSource).toContain("向量与索引信息")
    expect(detailSource).toContain("构建信息")
    expect(detailSource).toContain("font-bold text-slate-950 md:col-span-2")
    expect(detailSource).toContain("knowledgeVersionId")
    expect(detailSource).toContain("indexVersionId")
    expect(detailSource).toContain("sourceDocumentIds")
    expect(detailSource).toContain("sourceLocation")
    expect(detailSource).toContain("embeddingModel")
    expect(detailSource).toContain("embeddingHash")
    expect(detailSource).toContain("vectorId")
    expect(detailSource).toContain("lexicalDocId")
    expect(detailSource).toContain("tokenCount")
    expect(detailSource).toContain("charCount")
    expect(detailSource).toContain("chunkRuleVersion")
    expect(detailSource).toContain("buildStatus")
    expect(detailSource).toContain("createdAt")
    expect(detailSource).toContain("updatedAt")
    expect(detailSource).not.toContain("grid gap-3 border-t border-slate-100 p-4 md:grid-cols-3")
  })
})
