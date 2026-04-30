import React from "react"
import fs from "node:fs"
import path from "node:path"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { MappingManagementView } from "@/components/knowledge-automation/mapping-management-view"

describe("MappingManagementView", () => {
  it("renders a first-level mapping relation list with a create dialog entry", () => {
    const html = renderToStaticMarkup(
      <MappingManagementView
        projectId="project-1"
        initialMappings={[
          {
            id: "mapping-1",
            projectId: "project-1",
            name: "TV 型号平台映射",
            sourceFileName: "tv-model-platform.xlsx",
            sourceFileHash: "hash-1",
            keyField: "productModel",
            scopeFields: ["productModel", "platform"],
            rowCount: 2,
            diagnostics: [],
            createdAt: "2026-04-30T00:00:00.000Z",
            updatedAt: "2026-04-30T00:00:00.000Z",
          },
        ]}
        initialSelectedMapping={{
          id: "mapping-1",
          projectId: "project-1",
          name: "TV 型号平台映射",
          sourceFileName: "tv-model-platform.xlsx",
          sourceFileHash: "hash-1",
          keyField: "productModel",
          scopeFields: ["productModel", "platform"],
          rowCount: 1,
          diagnostics: [],
          createdAt: "2026-04-30T00:00:00.000Z",
          updatedAt: "2026-04-30T00:00:00.000Z",
          records: [
            {
              id: "record-1",
              mappingId: "mapping-1",
              lookupKey: "85QD7N",
              scope: {
                productModel: ["85QD7N"],
                platform: ["Google TV"],
              },
            },
          ],
        }}
      />
    )

    expect(html).toContain("映射管理")
    expect(html).toContain("新增映射关系")
    expect(html).toContain("映射关系列表")
    expect(html).toContain("查看详情")
    expect(html).toContain("TV 型号平台映射")
    expect(html).toContain("tv-model-platform.xlsx")
    expect(html).not.toContain("上传映射表")
    expect(html).not.toContain("85QD7N")
    expect(html).not.toContain("Google TV")
  })

  it("separates first-level list, create dialog, and detail-level content editing", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "src/components/knowledge-automation/mapping-management-view.tsx"),
      "utf8",
    )

    expect(source).toContain('viewMode === "list"')
    expect(source).toContain('viewMode === "detail"')
    expect(source).toContain("DialogContent")
    expect(source).toContain("DialogTitle")
    expect(source).toContain("新增映射关系")
    expect(source).toContain("映射关系详情")
    expect(source).toContain("映射内容")
    expect(source).toContain("返回列表")
    expect(source).toContain("openMappingDetail")
    expect(source).toContain("submitRecordForm")
    expect(source).toContain("deleteRecord")
    expect(source).toContain("knowledgeApi.uploadKnowledgeScopeMappings")
    expect(source).toContain("knowledgeApi.listKnowledgeScopeMappings")
    expect(source).toContain("knowledgeApi.getKnowledgeScopeMapping")
    expect(source).toContain("knowledgeApi.updateKnowledgeScopeMapping")
    expect(source).toContain("knowledgeApi.deleteKnowledgeScopeMapping")
    expect(source).toContain("knowledgeApi.createKnowledgeScopeMappingRecord")
    expect(source).toContain("knowledgeApi.updateKnowledgeScopeMappingRecord")
    expect(source).toContain("knowledgeApi.deleteKnowledgeScopeMappingRecord")
    expect(source).not.toContain("KnowledgeScopeMappingVersion")
  })
})
