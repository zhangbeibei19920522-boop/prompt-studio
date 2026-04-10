# Test Report HTML Export Design

## Goal

让测试报告在保留现有 PDF 导出的前提下，额外支持导出为独立的 `.html` 文件。

## Scope

- 保留现有 `exportTestRunPDF(...)` 行为和入口不变。
- 复用现有测试报告导出模板，新增 `exportTestRunHTML(...)`。
- 在测试套件详情和历史记录视图里新增“导出 HTML”按钮。

## Approach

- 将当前 PDF 导出里生成报告 HTML 的逻辑继续作为共享模板来源。
- HTML 导出直接生成完整 HTML 文本，封装为 `Blob`，通过浏览器下载为 `.html` 文件。
- HTML 文件需要自包含基本样式，不依赖应用运行时 CSS。

## Verification

- 单元测试覆盖 HTML 导出下载行为、文件名后缀和导出内容。
- 组件测试覆盖测试报告界面出现“导出 HTML”入口。
- 回归现有 PDF 导出测试，确认不受影响。
