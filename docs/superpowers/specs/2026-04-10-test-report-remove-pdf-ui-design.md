# Test Report Remove PDF UI Design

## Goal

从测试报告界面移除 PDF 导出入口，只保留 HTML 导出入口。

## Scope

- 移除测试套件详情页里的“导出 PDF”按钮。
- 移除测试历史记录页详情态和列表态里的 PDF 导出入口。
- 保留 `exportTestRunPDF(...)` 底层实现和现有 PDF 导出测试，不做删除。

## Non-Goals

- 不删除 `src/lib/utils/pdf-export.ts` 里的 PDF 导出逻辑。
- 不修改旧的 PDF 设计文档或更广泛的历史文档。
- 不更改 HTML 导出行为。

## Verification

- 组件测试确认测试报告界面只暴露 HTML 导出入口。
- 目标文件的 ESLint 检查通过。
