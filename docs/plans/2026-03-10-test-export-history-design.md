# 测试记录导出 PDF + 历史记录查看 设计文档

日期：2026-03-10

## 需求

1. 测试运行结果可导出为 PDF
2. 查看某个测试集的历史测试记录

## 决策

- PDF 范围：单次运行报告
- PDF 生成：浏览器端，html2canvas + jsPDF
- 历史记录入口：测试集详情页内嵌 Tab

## 架构

```
测试集详情页 (test-suite-detail.tsx)
├── Tab: 当前结果 (现有功能 + 导出PDF按钮)
├── Tab: 历史记录 (新增)
│   ├── 历史运行列表 (test-run-history.tsx)
│   │   └── 每行: 时间 | 得分 | 通过率 | 状态 | [查看] [导出PDF]
│   └── 点击「查看」→ 展示该次运行详细结果
└── PDF 导出
    ├── 工具函数: lib/utils/pdf-export.ts
    ├── html2canvas 截图 → jsPDF 输出
    └── 触发入口: 列表「导出PDF」+ 当前结果「导出PDF」
```

## 新增文件

- `src/components/test/test-run-history.tsx` — 历史记录列表组件
- `src/lib/utils/pdf-export.ts` — PDF 导出工具函数

## 修改文件

- `src/components/test/test-suite-detail.tsx` — 加 Tabs 切换 + 导出按钮

## 新增依赖

- `html2canvas`
- `jspdf`

## PDF 导出详细设计

### 工具函数 `exportTestRunPDF(testRun, testCases, suiteName)`

流程：
1. 动态创建隐藏 DOM 容器（固定 A4 宽度，白色背景，内联样式）
2. 渲染报告 HTML：
   - 标题：测试集名称 + 运行时间
   - 概览卡片：总分、通过数/总数、通过率
   - 用例结果表格：标题、输入、期望输出、实际输出、得分、通过/失败、评估理由
   - 整体评估：summary + improvements + details
3. html2canvas 截图为 canvas
4. jsPDF 按 A4 高度分页输出 PDF
5. 触发下载，清理 DOM

文件名格式：`{测试集名称}_运行报告_{YYYY-MM-DD_HHmm}.pdf`

## 历史记录详细设计

### 组件 `TestRunHistory`

Props：`testSuiteId`, `testCases`

状态：
- 列表视图：展示所有历史运行
- 详情视图：展示某次运行的完整结果

列表视图每行：运行时间 | 得分 | 通过/总数 | 状态 | [查看] [导出PDF]

详情视图：
- 顶部「返回列表」按钮
- 复用现有得分卡片 + 用例结果列表 + 评估报告
- 右上角「导出 PDF」按钮

### test-suite-detail.tsx 改动

- 用 shadcn Tabs 包裹，两个 Tab：「测试结果」和「历史记录」
- 当前结果区域加「导出 PDF」按钮

## 后端

无需改动。已有 `GET /api/test-suites/[id]/runs` 接口返回历史运行列表。
