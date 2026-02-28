# M11: Agent 工作流

> 依赖：M5, M10 | 产出：Agent 的完整工作流（上下文收集→规划→执行→迭代）

## 目标

实现 Agent 的核心逻辑：收集三级业务信息 + 知识库上下文，规划修改方案，执行生成/修改，支持迭代。

## 核心流程

```
用户消息 → API /ai/chat →
  1. 收集上下文（三级业务信息 + 知识库 + 历史）
  2. 判断意图（新建/修改/优化/普通对话）
  3. 如果是 prompt 操作 → 进入规划阶段
  4. 规划完成 → 输出规划卡片 → 等待用户确认
  5. 用户确认 → 执行阶段 → 逐个生成/修改
  6. 输出预览/diff → 等待用户反馈
  7. 用户反馈 → 重新收集上下文 → 二次修改
  8. 用户确认应用 → 保存
```

## 文件清单

### `src/lib/ai/agent.ts` — Agent 主入口

```typescript
export async function* handleAgentChat(
  request: ChatRequest
): AsyncGenerator<StreamEvent>
```

主流程编排：
1. 从数据库加载上下文
2. 调用 LLM 分析意图
3. 根据意图走不同流程
4. 通过 `yield` 逐步输出 SSE 事件

### `src/lib/ai/context-collector.ts` — 上下文收集器

```typescript
export function collectAgentContext(
  sessionId: string,
  references: MessageReference[]
): AgentContext
```

- 读取 GlobalSettings（全局业务信息）
- 读取当前 Session 对应的 Project（项目业务信息）
- 读取 @ 引用的 Prompt（含补充说明）
- 读取 @ 引用的 Document（解析后的文本）
- 读取 Session 的历史消息（最近 N 条）

### `src/lib/ai/planner.ts` — 规划器

```typescript
export async function* generatePlan(
  context: AgentContext,
  provider: AiProvider
): AsyncGenerator<StreamEvent>
```

- 构造规划 prompt（要求 LLM 输出结构化的关键点列表）
- 解析 LLM 输出为 `AgentPlan` 结构
- 输出 `{ type: 'plan', data: plan }` 事件

### `src/lib/ai/executor.ts` — 执行器

```typescript
export async function* executePlan(
  context: AgentContext,
  plan: AgentPlan,
  provider: AiProvider
): AsyncGenerator<StreamEvent>
```

逐个处理 plan 中的关键点：
- **新建 prompt** → 生成完整内容 → 输出 `{ type: 'preview', data }` 事件
- **修改 prompt** → 读取原内容 → 生成修改后内容 → 计算 diff → 输出 `{ type: 'diff', data }` 事件

### `src/lib/ai/agent-prompt.ts` — Agent Prompt 模板（M5 中已定义，此处补充细节）

System Prompt 核心规则：
```
你是一个专业的 Prompt 工程师 Agent。你的职责是根据业务上下文帮用户生成和优化 prompt。

核心规则：
1. 每次修改前必须阅读全部业务信息（全局 + 项目 + Prompt 补充说明）
2. 必须遵守业务说明中标记为"强制"的规则
3. 先规划后执行，规划需用户确认
4. 修改已有 prompt 时保持原有结构，最小化改动
5. 生成的 prompt 应包含必要的变量占位符 {{变量名}}
```

## API Route 实现

### `src/app/api/ai/chat/route.ts`

```typescript
export async function POST(request: Request) {
  // 1. 解析请求
  // 2. 保存用户消息到数据库
  // 3. 调用 handleAgentChat
  // 4. 将 AsyncGenerator 转为 SSE Response
  // 5. Agent 完成后保存 assistant 消息到数据库
}
```

### `src/app/api/ai/apply/route.ts`

```typescript
export async function POST(request: Request) {
  // 接收用户确认的 prompt 修改
  // 写入 prompt 表（更新或新建）
  // 创建 PromptVersion 记录
  // 返回成功
}
```

## 会话状态管理

Agent 需要跟踪当前会话的状态：
- 是否有待确认的规划
- 已确认的规划内容
- 已执行但待用户确认应用的 prompt

这些状态通过消息的 `metadata` 字段存储，不需要额外的状态表。

## 提交

```bash
git add src/lib/ai/ src/app/api/ai/
git commit -m "feat: add agent workflow with context collection, planning and execution"
```
