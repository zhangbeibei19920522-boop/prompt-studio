# 自动化测试功能设计文档

## 概述

为 Prompt Manager 新增针对项目的自动化测试功能。用户通过对话与 Agent 交互创建测试集，逐条运行测试用例，由 LLM 评估结果并生成测试报告。

## 核心功能

1. **自动创建测试集** — 通过对话与 Agent 交互，确认测试需求后自动生成测试用例及预期结果
2. **自动测试** — 逐条调用 LLM 运行测试用例，支持配置独立的 model/key
3. **测试报告** — 逐条评分 + 整体评估，展示通过率、总分、改进建议

## 设计决策

| 决策项 | 方案 | 理由 |
|--------|------|------|
| UI 入口 | 侧边栏独立模块 | 与会话、Prompt、知识库平级，便于管理 |
| 创建交互 | 复用主对话区 | 最大程度复用现有 Agent 代码，体验一致 |
| 上下文 | 测试用例自带 | 每条用例包含模拟场景，由 LLM 生成 |
| 评分机制 | 混合模式 | 逐条判断通过/不通过 + 整体评估改进建议 |
| Model 配置 | 测试集级别 | 运行用测试集配置，评估用全局配置 |
| 架构 | 复用现有 Agent | 新增测试专用提示词和事件类型，开发量小 |

## 数据模型

### test_suites（测试集）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT PK | nanoid |
| projectId | TEXT FK → projects | 所属项目 |
| sessionId | TEXT FK → sessions | 创建时的对话会话 |
| name | TEXT NOT NULL | 测试集名称 |
| description | TEXT | 测试集描述 |
| promptId | TEXT FK → prompts | 被测试的 Prompt |
| promptVersionId | TEXT FK → prompt_versions | 被测试的具体版本（锁定） |
| config | TEXT (JSON) | `{provider, model, apiKey, baseUrl}` |
| status | TEXT | `draft` / `ready` / `running` / `completed` |
| createdAt | TEXT | 创建时间 |
| updatedAt | TEXT | 更新时间 |

### test_cases（测试用例）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT PK | nanoid |
| testSuiteId | TEXT FK → test_suites | 所属测试集 |
| title | TEXT NOT NULL | 用例标题 |
| context | TEXT | 用例上下文（模拟用户场景） |
| input | TEXT NOT NULL | 用户输入 |
| expectedOutput | TEXT NOT NULL | 预期输出描述 |
| sortOrder | INTEGER | 排序序号 |

### test_runs（测试运行记录）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT PK | nanoid |
| testSuiteId | TEXT FK → test_suites | 所属测试集 |
| status | TEXT | `running` / `completed` / `failed` |
| results | TEXT (JSON) | 每条用例的结果数组 |
| report | TEXT (JSON) | 评估报告 |
| score | REAL | 总分 (0-100) |
| startedAt | TEXT | 开始时间 |
| completedAt | TEXT | 完成时间 |

**results JSON 结构：**

```json
[{
  "testCaseId": "xxx",
  "actualOutput": "LLM 实际输出",
  "passed": true,
  "score": 85,
  "reason": "评估理由"
}]
```

**report JSON 结构：**

```json
{
  "summary": "整体评估摘要",
  "totalCases": 10,
  "passedCases": 8,
  "score": 82,
  "improvements": ["改进点1", "改进点2"],
  "details": "详细分析..."
}
```

## 工作流

### 创建测试集

```
用户点击侧边栏「新建测试集」
  → 创建专用会话（type: 'test'）
  → Agent 使用测试专用提示词（test-agent-prompt.ts）
  → 对话流程：
      1. Agent 询问测试目标、场景、用例数量等
      2. 用户描述需求
      3. Agent 输出规划（plan 块），用户确认
      4. Agent 生成测试集（test-suite 块 + test-cases 块）
      5. 用户在对话中预览测试用例
      6. 确认后保存到数据库，状态为 draft
```

### 确认测试用例

```
用户点击侧边栏中的测试集进入详情页
  → 查看所有测试用例
  → 可编辑/新增/删除测试用例
  → 确认无误后，状态从 draft → ready
  → 只有 ready 状态的测试集可运行
```

### 运行测试

```
用户在测试集详情页点击「运行测试」
  → 选择要测试的 Prompt（锁定当前版本）
  → 确认 model/key 配置
  → 创建 test_run 记录，状态 running
  → 逐条执行：
      for each test_case:
          请求 = system(prompt.content) + user(case.context + case.input)
          调用 LLM（测试集配置的 model）
          保存 actualOutput
  → 逐条评估：
      for each result:
          调用 LLM（全局 model）
          输入 = { expectedOutput, actualOutput, context }
          输出 = { passed, score, reason }
  → 整体评估：
      调用 LLM（全局 model）
      输入 = { 所有用例结果, prompt 内容 }
      输出 = { summary, score, improvements }
  → 更新 test_run 状态为 completed
```

### 查看结果

```
用户点击侧边栏测试集
  → 主内容区显示测试集详情：
      顶部：测试集信息 + 运行按钮
      中部：测试用例列表（可展开查看详情）
      底部：最新运行的测试报告
  → 可查看历史运行记录
```

## UI 设计

### 侧边栏 — 测试集分组

在现有分组下方新增「测试」分组，展示测试集列表，支持新建。

### 主内容区 — 两种视图

**视图 A：创建测试集（对话模式）**

复用现有对话区组件，Agent 使用测试专用提示词。生成的测试集以卡片形式展示在对话中，支持确认/修改。

**视图 B：测试集详情（管理模式）**

- 顶部：测试集名称、被测 Prompt 选择器、model 配置、运行按钮
- 中部：测试用例列表，每条可展开查看上下文/输入/预期/实际/评估
- 底部：测试报告（总分、通过率、改进建议）

### 测试用例展开详情

展开后显示：上下文、输入、预期输出、实际输出、评估理由、分数。通过/不通过用颜色区分。

## API 设计

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/projects/[id]/test-suites` | 获取项目下所有测试集 |
| POST | `/api/projects/[id]/test-suites` | 创建测试集 |
| GET | `/api/test-suites/[id]` | 获取测试集详情（含用例） |
| PUT | `/api/test-suites/[id]` | 更新测试集 |
| DELETE | `/api/test-suites/[id]` | 删除测试集 |
| POST | `/api/test-suites/[id]/cases` | 添加测试用例 |
| PUT | `/api/test-cases/[id]` | 更新测试用例 |
| DELETE | `/api/test-cases/[id]` | 删除测试用例 |
| POST | `/api/test-suites/[id]/run` | 运行测试（SSE 流式） |
| GET | `/api/test-suites/[id]/runs` | 获取运行历史 |
| GET | `/api/test-runs/[id]` | 获取运行详情 |

## 文件结构

### 新增文件

```
src/
├── lib/
│   ├── ai/
│   │   ├── test-agent-prompt.ts    # 测试集创建专用提示词
│   │   ├── test-runner.ts          # 测试执行引擎（逐条调用 LLM）
│   │   └── test-evaluator.ts       # 评估引擎（逐条 + 整体）
│   └── db/repositories/
│       ├── test-suites.ts          # 测试集 CRUD
│       ├── test-cases.ts           # 测试用例 CRUD
│       └── test-runs.ts            # 运行记录 CRUD
├── components/
│   └── test/
│       ├── test-suite-list.tsx     # 侧边栏测试集列表
│       ├── test-suite-detail.tsx   # 测试集详情页
│       ├── test-case-item.tsx      # 测试用例行
│       ├── test-case-editor.tsx    # 用例编辑
│       ├── test-run-config.tsx     # 运行配置弹窗
│       ├── test-report.tsx         # 测试报告展示
│       └── test-suite-card.tsx     # 对话中的预览卡片
├── app/api/
│   ├── projects/[id]/test-suites/route.ts
│   ├── test-suites/[id]/route.ts
│   ├── test-suites/[id]/cases/route.ts
│   ├── test-suites/[id]/run/route.ts
│   ├── test-suites/[id]/runs/route.ts
│   ├── test-cases/[id]/route.ts
│   └── test-runs/[id]/route.ts
└── types/
    └── (修改现有类型文件)
```

### 修改现有文件

| 文件 | 修改内容 |
|------|---------|
| `src/lib/db/schema.sql` | 新增 3 张表 + 索引 |
| `src/components/layout/sidebar.tsx` | 新增测试分组 |
| `src/lib/store/app-context.tsx` | 新增测试集相关状态 |
| `src/lib/utils/api-client.ts` | 新增 testSuitesApi |
| `src/lib/ai/agent.ts` | 支持测试模式分支 |
| `src/lib/ai/stream-handler.ts` | 新增 test-suite 事件类型 |
| `src/types/database.ts` | 新增 TestSuite/TestCase/TestRun 类型 |
| `src/types/api.ts` | 新增请求/响应类型 |
| `src/app/(main)/page.tsx` | 新增测试详情视图切换 |

## 测试运行的 SSE 事件

运行测试时通过 SSE 实时推送进度：

```
event: test-start       data: { totalCases: 10 }
event: test-case-start  data: { caseId, index, title }
event: test-case-done   data: { caseId, actualOutput }
event: eval-start       data: { }
event: eval-case-done   data: { caseId, passed, score, reason }
event: eval-report      data: { report }
event: test-complete    data: { runId, score }
event: test-error       data: { error }
```
