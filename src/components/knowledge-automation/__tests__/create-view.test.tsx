import React from "react"
import fs from "node:fs"
import path from "node:path"
import { renderToStaticMarkup } from "react-dom/server"

import { CreateView } from "@/components/knowledge-automation/create-view"

describe("CreateView", () => {
  it("shows maintenance task creation as a compact single form", () => {
    const html = renderToStaticMarkup(
      <CreateView
        customer={{
          id: "acme",
          name: "客服项目",
          hasKnowledgeBase: true,
          knowledgeBaseName: "客服项目 知识库",
          currentVersion: "当前演示版本",
        }}
        sourceDocuments={[{ id: "doc-1", name: "HR-policy-2024.docx", type: "docx" }]}
        onBack={() => undefined}
        onStart={() => undefined}
      />
    )

    expect(html).toContain("新建维护任务")
    expect(html).toContain("任务名称")
    expect(html).toContain("任务类型")
    expect(html).toContain("选择版本")
    expect(html).toContain("批量文件更新")
    expect(html).toContain("人工补充")
    expect(html).toContain("内容修复")
    expect(html).toContain("全量重建")
    expect(html).toContain("文档库选择文件")
    expect(html).toContain("已选择：")
    expect(html).toContain("启动任务")
    expect(html).not.toContain("基础信息")
    expect(html).not.toContain("选择来源")
    expect(html).not.toContain("确认启动")
    expect(html).not.toContain("当前知识库")
    expect(html).not.toContain("启动清洗流程")
  })

  it("shows document selection for full rebuild and selects documents by default", () => {
    const html = renderToStaticMarkup(
      <CreateView
        customer={{
          id: "techflow",
          name: "客服项目",
          hasKnowledgeBase: false,
          knowledgeBaseName: "",
          currentVersion: "",
        }}
        sourceDocuments={[{ id: "doc-1", name: "HR-policy-2024.docx", type: "docx" }]}
        onBack={() => undefined}
        onStart={() => undefined}
      />
    )

    expect(html).toContain("创建知识库")
    expect(html).toContain("文档库选择文件")
    expect(html).toContain("已选择：1 个文件")
    expect(html).not.toContain("当前任务类型为全量重建，不需要选择版本。")
  })

  it("keeps manual supplement and repair interactions while hiding version selection for full rebuild", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "src/components/knowledge-automation/create-view.tsx"),
      "utf8"
    )

    expect(source).toContain("versionOptions")
    expect(source).toContain("onSubmit")
    expect(source).toContain("isSubmitting")
    expect(source).toContain("任务名称")
    expect(source).toContain("任务类型")
    expect(source).toContain("选择版本")
    expect(source).toContain('taskType !== "full"')
    expect(source).toContain("当前任务类型为全量重建，不需要选择版本。")
    expect(source).not.toContain("historyVersionRows")
    expect(source).toContain("selectedDocumentIds")
    expect(source).toContain("toggleDocumentSelection")
    expect(source).toContain("SourceDocumentPanel")
    expect(source).toContain("手动新增内容")
    expect(source).toContain("新增一条内容")
    expect(source).toContain("本次已添加内容")
    expect(source).toContain("人工补充不需要选择原文件")
    expect(source).toContain("manualDraftForm")
    expect(source).toContain("EMPTY_MANUAL_DRAFT")
    expect(source).toContain("请至少填写标题和正文摘要")
    expect(source).toContain("repairQuestions")
    expect(source).toContain("RepairQuestionPanel")
    expect(source).toContain("手动新增待修复问题")
    expect(source).toContain("用户问题")
    expect(source).toContain("当前问题描述")
    expect(source).toContain("期望修复方向")
    expect(source).toContain("请完整填写问题、当前问题描述和期望修复方向")
    expect(source).toContain("文档库选择文件")
    expect(source).toContain("内容修复可关联文档库文件")
    expect(source).toContain("Popover")
    expect(source).toContain("PopoverTrigger")
    expect(source).toContain("PopoverContent")
    expect(source).toContain("Command")
    expect(source).toContain("CommandInput")
    expect(source).toContain("CommandItem")
    expect(source).toContain("搜索文件...")
    expect(source).toContain("全选")
    expect(source).toContain("取消全选")
    expect(source).toContain("requiresDocuments")
    expect(source).toContain("启动任务")
    expect(source).not.toContain("参考历史维护")
    expect(source).not.toContain("任务配置确认")
    expect(source).not.toContain("下一步：确认启动")
    expect(source).not.toContain("启动清洗流程")
  })
})
