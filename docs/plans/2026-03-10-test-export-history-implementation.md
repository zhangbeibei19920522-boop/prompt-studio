# 测试记录导出 PDF + 历史记录查看 实现计划

日期：2026-03-10
设计文档：`docs/plans/2026-03-10-test-export-history-design.md`

## 步骤

### Step 1: 安装依赖

安装 `html2canvas` 和 `jspdf`。

```bash
npm install html2canvas jspdf
```

文件：`package.json`

### Step 2: 创建 PDF 导出工具函数

新建 `src/lib/utils/pdf-export.ts`。

核心函数 `exportTestRunPDF(params)`：
- 参数：`{ suiteName, testRun (TestRun), testCases (TestCase[]) }`
- 流程：
  1. 创建隐藏 div 容器（position:absolute, left:-9999px, width:794px 即 A4 宽度）
  2. 渲染报告 HTML（内联样式）：
     - 标题区：测试集名称 + 运行时间（format with date-fns）
     - 概览卡片：总分、通过数/总数、通过率
     - 用例结果表格：遍历 testRun.results，匹配 testCases 获取标题/输入/期望输出
     - 每个用例：标题、输入（截断前200字）、期望输出（截断前200字）、实际输出（截断前200字）、得分、通过/失败、评估理由
     - 整体评估：report.summary + report.improvements + report.details
  3. document.body.appendChild(container)
  4. html2canvas(container, { scale: 2, useCORS: true })
  5. 计算分页：canvas 高度 / A4 页面高度，循环 addImage
  6. jsPDF 保存，文件名：`{suiteName}_运行报告_{YYYY-MM-DD_HHmm}.pdf`
  7. document.body.removeChild(container)

依赖：`html2canvas`, `jspdf`, `date-fns`（已有）

验证：在浏览器中调用函数，确认 PDF 正确生成并下载。

### Step 3: 创建历史记录组件

新建 `src/components/test/test-run-history.tsx`。

Props：
- `testSuiteId: string`
- `testCases: TestCase[]`
- `suiteName: string`

State：
- `runs: TestRun[]` — 从 API 获取
- `loading: boolean`
- `selectedRunId: string | null` — null 时显示列表，有值时显示详情

列表视图：
- useEffect 调用 `testRunsApi.listBySuite(testSuiteId)` 获取数据
- 表格列：运行时间（date-fns format）、得分、通过/总数、状态 badge、操作按钮
- 操作：「查看详情」按钮 → setSelectedRunId、「导出 PDF」按钮 → 调用 exportTestRunPDF
- 空状态：「暂无历史记录」

详情视图（selectedRunId 非空时）：
- 顶部：「← 返回列表」按钮 + 运行时间 + 「导出 PDF」按钮
- 得分概览卡片（复用 test-suite-detail.tsx 中的渲染逻辑，提取为内联渲染）
- 用例结果列表（同现有展开逻辑）
- 测试报告（复用 TestReport 组件）

依赖：`TestRun`, `TestCase` 类型，`testRunsApi`，`exportTestRunPDF`，`TestReport` 组件

验证：组件能正确加载历史记录列表，点击查看能展示详情，导出按钮能生成 PDF。

### Step 4: 改造 test-suite-detail.tsx

改动内容：

1. 引入 shadcn Tabs 组件（`Tabs, TabsList, TabsTrigger, TabsContent`）
2. 引入 `TestRunHistory` 组件和 `exportTestRunPDF` 函数
3. 将现有的结果展示区域包裹在 `TabsContent value="current"` 中
4. 新增 `TabsContent value="history"` 渲染 `TestRunHistory`
5. 在当前结果区域的得分卡片旁添加「导出 PDF」按钮
6. 导出按钮调用 `exportTestRunPDF({ suiteName: suite.name, testRun: latestRun, testCases: cases })`

注意：
- Tabs 只在有 latestRun 或 suite.status === 'completed' 时显示
- 导出按钮只在 latestRun 存在且 status === 'completed' 时可用
- 保持现有功能完全不变，只是用 Tabs 包裹

验证：Tab 切换正常，当前结果展示不受影响，导出按钮可用。

### Step 5: 集成测试与样式调整

1. 完整流程测试：运行测试 → 查看结果 → 导出 PDF → 切换历史记录 Tab → 查看历史详情 → 导出历史 PDF
2. PDF 样式检查：中英文显示、表格对齐、分页正确
3. 空状态处理：无历史记录时的提示
4. 响应式检查：确保在不同宽度下 Tab 和列表正常显示

## 文件变更汇总

| 文件 | 操作 | 说明 |
|------|------|------|
| `package.json` | 修改 | 添加 html2canvas, jspdf 依赖 |
| `src/lib/utils/pdf-export.ts` | 新建 | PDF 导出工具函数 |
| `src/components/test/test-run-history.tsx` | 新建 | 历史记录列表+详情组件 |
| `src/components/test/test-suite-detail.tsx` | 修改 | 添加 Tabs + 导出按钮 |

## 风险点

- html2canvas 对复杂 CSS 的兼容性：使用内联样式规避
- 长内容 PDF 分页：按 A4 高度切割 canvas
- 大量历史记录的性能：API 已按时间倒序返回，前端按需加载即可
