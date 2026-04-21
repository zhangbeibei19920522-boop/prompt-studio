# 统一平台 Agent 设计

## 背景

当前项目已经具备多类分散的 Agent 和自动化能力：

- 主对话 Agent：围绕 Prompt 创建、修改、规划和记忆操作。
- Test Agent：围绕测试集创建、routing 配置、测试运行和结果评估。
- Conversation Audit：围绕会话质检任务创建、运行和结果查看。
- Knowledge Automation：围绕知识清洗任务、风险确认、清洗结果确认、索引生成和版本查看。
- Memory：围绕跨会话偏好和业务事实管理。

这些能力已经存在于同一产品内，但当前仍然以多个入口、多个专用交互链路、多个局部协议存在。用户目标是把它们统一到单一 Agent 入口下，由一个主 Agent 理解需求、补配置、生成配置卡、确认执行，并在内部调度不同子能力。

当前实现的主要问题：

- 主 Agent 仍然偏向“单次 LLM 调用 + 结构化 JSON 输出”的模式，缺少统一任务协议。
- 规划、确认、执行、追改的完整闭环没有产品级状态机支撑。
- 不同模块没有统一的配置收集、校验、确认和执行协议。
- 用户补一句参数时，系统缺少“更新当前任务”与“开启新任务”的明确判断。
- `cleaning` 和 `R` 节点相关能力都围绕知识资产，但用途不同，当前没有统一的边界定义。

## 目标

- 对外提供一个统一入口 Agent，承担平台内主要任务的自然语言入口。
- 统一 Agent 先识别任务，再补齐配置，再生成可编辑配置卡，最后在用户确认后执行。
- 支持用户通过两种方式修改任务参数：
  - 直接编辑配置卡。
  - 在对话里补充一句新参数，由 Agent 自动回写到当前配置卡。
- 支持主 Agent 调度多个领域执行器，但用户界面上始终只有一个 Agent。
- 支持的任务域至少包含：
  - `prompt`
  - `test`
  - `cleaning`
  - `audit`
  - `memory`
  - `project_settings`
  - `knowledge_r`
- 明确禁止 Agent 执行发布、回滚和线上版本切换类动作。

## 非目标

- 不把整个系统做成通用工作流平台。
- 不引入独立的多 Agent 用户界面。
- 不把 `cleaning` 和 `knowledge_r` 合并成单一知识域任务。
- 不让 Agent 直接执行发布、回滚、上线切换或类似高风险版本动作。
- 不重做现有聊天 UI、知识自动化 UI 或测试 UI 的整体布局。
- 不要求一期引入 LangGraph、CrewAI、AutoGen、LlamaIndex 等通用 Agent 框架。

## 设计原则

### 1. 单一入口，内部多执行器

用户看到的永远是一个 Agent。内部可以有多个领域执行器，但不能让用户显式面对多个 Agent 入口。

### 2. 先任务化，再 Agent 化

统一 Agent 不直接把用户输入交给模型“自由发挥”。任何平台操作先归一为结构化任务，再由模型辅助理解和补参数。

### 3. 写操作必须显式确认

任何带配置的写操作都必须经历：

`识别任务 -> 补配置 -> 配置卡确认 -> 执行`

不能跳过配置卡直接执行。

### 4. 参数是产品协议，不是 prompt 协议

参数 schema、校验规则、覆盖优先级、禁止动作、可执行边界都由系统逻辑控制，而不是只靠 prompt 约束。

### 5. 对话是配置输入，不只是聊天内容

当会话中存在进行中的任务时，用户新输入优先被解释为对当前任务的参数补丁，而不是默认开启新任务。

### 6. `cleaning` 与 `knowledge_r` 隔离

二者都围绕知识资产，但任务目标不同：

- `cleaning` 负责清洗任务、草稿确认、索引生成前的维护工作。
- `knowledge_r` 负责 R 节点绑定、索引版本引用和 R 节点运行配置。

二者不能合并成同一任务域，也不能共享同一张配置卡。

## 总体架构

统一 Agent 采用“主编排内核 + 领域执行器”的结构。

```text
用户输入
  -> Unified Chat API
  -> Conversation Orchestrator
     -> Task Identification
     -> Task State Machine
     -> Config Resolver / Patcher
     -> TaskConfigCard / TaskStatus / TaskResult
     -> Domain Executor
        -> PromptExecutor
        -> TestExecutor
        -> CleaningExecutor
        -> AuditExecutor
        -> MemoryExecutor
        -> ProjectSettingsExecutor
        -> KnowledgeRExecutor
  -> SSE Events
  -> Chat UI / Card UI
```

### 核心分层

#### 1. Conversation Orchestrator

职责：

- 从自然语言请求识别任务域和操作类型。
- 决定当前输入是新任务还是参数补丁。
- 维护当前会话中的进行中任务状态。
- 在参数完整后进入确认和执行阶段。
- 把领域执行结果翻译成统一消息和卡片。

#### 2. Task Registry

职责：

- 注册每个 `domain + operation` 的任务定义。
- 定义任务参数 schema、默认值策略、禁止动作和确认策略。
- 决定由哪个执行器处理当前任务。

#### 3. Config Resolver / Task Patcher

职责：

- 根据当前上下文自动补全参数。
- 根据用户对话更新进行中任务的字段。
- 重新计算缺失字段、冲突字段和校验状态。

#### 4. Domain Executor

职责：

- 接收已经过确认和校验的结构化参数。
- 执行真实业务动作。
- 返回标准化执行结果。

#### 5. Result Translator

职责：

- 把执行器输出转换为统一卡片和简要自然语言说明。
- 为后续追改保留足够的结构化上下文。

## 任务域划分

### `prompt`

负责：

- 创建 Prompt 草案
- 修改 Prompt
- 比较差异
- 应用前预览
- 基于测试或质检结果生成修改建议

不负责：

- 测试集创建
- 发布知识版本

### `test`

负责：

- 创建测试集
- 配置 routing 测试
- 运行测试
- 解释失败结果
- 基于失败结果给出 Prompt 修改建议

### `cleaning`

负责：

- 创建清洗维护任务
- 选择来源文档
- 增加 repair question
- 保存清洗结果草稿
- 触发索引生成
- 发起试查

不负责：

- 发布知识版本
- 回滚知识版本
- 绑定 R 节点索引版本

### `audit`

负责：

- 创建会话质检任务
- 运行质检
- 总结风险和问题
- 给出修复建议

### `memory`

负责：

- 列出记忆
- 创建记忆
- 删除记忆
- 从会话中提取记忆

### `project_settings`

负责：

- 查看模型配置
- 更新项目业务信息
- 更新全局业务信息

### `knowledge_r`

负责：

- 绑定 R 节点使用的索引版本
- 查看当前绑定关系
- 解释当前 R 节点配置
- 为测试或路由任务准备 R 节点引用配置

不负责：

- 创建清洗任务
- 编辑清洗结果草稿
- 任何发布动作

## 统一任务模型

统一 Agent 内部首先把请求归一为任务对象。

```ts
interface UnifiedAgentTask {
  taskId: string
  domain: string
  operation: string
  mode: "read" | "write" | "run"
  target: Record<string, unknown>
  params: Record<string, unknown>
  missingFields: string[]
  status:
    | "draft"
    | "collecting_config"
    | "ready_to_confirm"
    | "confirmed"
    | "executing"
    | "completed"
    | "failed"
  executionPolicy: {
    requiresConfirmation: boolean
    editableConfig: boolean
    forbiddenOperations: string[]
  }
}
```

任务对象的作用：

- 把自然语言问题转换成产品可执行的协议。
- 允许配置卡和对话更新共享同一份任务状态。
- 让执行器完全脱离聊天协议，只接结构化输入。

## 主 Agent 状态机

统一 Agent 的状态机固定为：

```text
识别任务
-> 建立任务草稿
-> 自动补默认参数
-> 发现缺失参数
-> 进入配置收集
-> 生成/更新配置卡
-> 用户补参数或编辑卡片
-> 参数完整
-> 等待确认
-> 执行
-> 返回结果
-> 接受追改或关闭任务
```

### 状态定义

- `draft`
  刚识别出任务，还未形成完整配置卡。

- `collecting_config`
  任务已建立，正在补齐参数。

- `ready_to_confirm`
  参数完整且通过校验，等待用户确认。

- `confirmed`
  用户已确认，准备执行。

- `executing`
  执行器正在运行。

- `completed`
  执行完成，允许用户继续追改或衍生新任务。

- `failed`
  执行失败，保留配置卡和错误信息，允许修正后重试。

## LLM 与系统逻辑的职责分工

统一 Agent 背后仍然以 LLM 为核心理解能力，但不允许 LLM 独占控制整个任务流程。

### LLM 负责

- 意图识别
- 参数抽取
- 参数补丁解析
- 配置缺口追问生成
- 结果说明和建议生成
- 局部领域推理

### 系统逻辑负责

- 任务状态机
- 参数优先级
- 配置卡持久化
- 校验和禁用动作
- 执行器调度
- 落库和真实业务动作

## 参数 Schema 设计

每个 `domain + operation` 都必须注册参数 schema，而不是只依赖模型输出自由 JSON。

```ts
type ConfigFieldType =
  | "text"
  | "textarea"
  | "number"
  | "boolean"
  | "enum"
  | "prompt_ref"
  | "document_refs"
  | "test_suite_ref"
  | "knowledge_version_ref"
  | "index_version_ref"
  | "route_table"
  | "qa_pair_list"
  | "repair_question_list"

interface TaskConfigField<T = unknown> {
  key: string
  label: string
  type: ConfigFieldType
  required: boolean
  editable: boolean
  value?: T
  options?: Array<{ label: string; value: string }>
  placeholder?: string
  description?: string
  source?: "system" | "user_card" | "user_chat" | "inferred" | "default"
  confidence?: "high" | "medium" | "low"
  derived?: boolean
  validationError?: string | null
}
```

### 参数优先级

字段覆盖顺序固定为：

1. `system`
2. `user_card`
3. `user_chat`
4. `inferred`
5. `default`

规则：

- 用户在卡片里改过的字段，不允许再被自动推断覆盖。
- 用户在对话里明确说“改成 X”，允许覆盖旧值，并在卡片中记录来源。
- 系统强限制字段不能被任何用户输入覆盖。

## 配置卡机制

统一 Agent 采用统一配置卡 `TaskConfigCard`，不同领域只变字段，不变协议。

```ts
interface TaskConfigCardData {
  taskId: string
  domain: string
  operation: string
  title: string
  summary: string
  status: "collecting" | "ready" | "invalid" | "confirmed" | "executing"
  fields: TaskConfigField[]
  missingKeys: string[]
  warnings: string[]
  forbiddenActions?: string[]
  lastUpdatedAt: string
  lastUpdateSource: "agent" | "user_card" | "user_chat"
}
```

### 配置卡必须支持

- 展示任务类型、目标对象和当前参数。
- 展示缺失字段和校验错误。
- 支持用户直接编辑字段。
- 支持后端接收“用户对话参数补丁”后回写字段。
- 在参数完整后切换为“可确认执行”状态。
- 在执行中展示只读状态和进度摘要。

## 对话补丁机制

当会话中存在 `collecting_config`、`ready_to_confirm` 或 `invalid` 状态的任务时，用户新输入默认优先尝试解释为当前任务的参数补丁。

### 补丁流程

1. 检查当前是否有活动任务。
2. 尝试把用户新消息解析为参数补丁。
3. 若补丁成功：
   - 更新任务参数。
   - 重新计算缺失字段。
   - 回发新的配置卡。
4. 若补丁失败：
   - 再尝试识别为新任务。

### 补丁结果结构

```ts
interface TaskParamPatchResult {
  matched: boolean
  updatedKeys: string[]
  unchangedKeys: string[]
  conflicts: Array<{
    key: string
    oldValue: unknown
    newValue: unknown
    reason: string
  }>
  needsUserConfirmation: boolean
}
```

## 缺失参数追问策略

统一 Agent 的追问必须遵守以下规则：

- 一次只问一个真正阻塞执行的问题。
- 优先问高影响、低可推断的字段。
- 能推断的字段先推断，再请用户确认。
- 问题应带候选默认值，而不是只给开放问题。
- 参数不完整前，不允许执行。

### 示例

#### 创建 routing 测试集

如果用户说“给这个 Prompt 建一个 20 条的路由测试集”，Agent 可先推断：

- `domain = test`
- `operation = create_test_suite`
- `workflowMode = routing`
- `caseCount = 20`
- `targetPrompt = 当前引用 Prompt`

然后只追问真正阻塞的配置，例如入口 Prompt 或 intent routes。

#### 创建清洗任务

如果用户说“帮我新建一个内容修复任务，把这两个文档加进去”，Agent 可先推断：

- `domain = cleaning`
- `operation = create_cleaning_task`
- `taskType = repair`
- `sourceDocumentIds = 当前引用文档`

然后继续问缺失的 repair question 或运行配置。

## 执行器设计

统一 Agent 内部通过领域执行器落地能力，而不是通过多个对话型子 Agent 相互聊天。

统一执行接口建议为：

```ts
interface AgentTaskExecutor<P, R> {
  domain: string
  operation: string
  inferDefaults(context: AgentRuntimeContext): Partial<P>
  validate(params: Partial<P>, context: AgentRuntimeContext): ValidationResult
  patchParamsFromMessage(
    currentParams: Partial<P>,
    message: string,
    context: AgentRuntimeContext
  ): Promise<ParamPatchResult<P>>
  execute(params: P, context: AgentRuntimeContext): Promise<R>
  summarize(result: R, context: AgentRuntimeContext): TaskResultSummary
}
```

### 领域执行器列表

- `PromptExecutor`
- `TestExecutor`
- `CleaningExecutor`
- `AuditExecutor`
- `MemoryExecutor`
- `ProjectSettingsExecutor`
- `KnowledgeRExecutor`

### 复用现有代码的原则

- `PromptExecutor`
  复用现有 `collectAgentContext()`、`agent-prompt.ts`、`parseAgentOutput()` 和 `/api/ai/apply` 相关能力。

- `TestExecutor`
  复用现有 `handleTestAgentChat()`、`test-agent-prompt.ts`、`test-runner.ts`、`test-evaluator.ts` 和 `routing-executor.ts`。

- `CleaningExecutor`
  第一版主要落任务协议和前端配置交互，真实清洗执行链路后续再对接后端 API。

- `AuditExecutor`
  复用现有 `src/lib/audit/*` 能力和会话质检数据层。

- `MemoryExecutor`
  复用现有 memory repository 和 `memory-extraction.ts`。

- `ProjectSettingsExecutor`
  复用 settings / projects repository。

- `KnowledgeRExecutor`
  单独负责 R 节点索引绑定，不接清洗任务。

## 禁止动作边界

统一 Agent 必须内建禁止执行动作集。

### 永久禁止

- 发布知识版本
- 回滚知识版本
- 切换线上版本
- 执行任何显式上线动作

### 可分析但不可执行

- 给出发布建议
- 给出回滚建议
- 总结发布前检查项

### 可执行但必须配置确认

- 创建测试集
- 运行测试
- 修改 Prompt
- 创建清洗任务
- 保存清洗结果草稿
- 新增 repair question
- 创建和运行 audit 任务

## 前后端交互协议

当前主聊天链路基于 SSE 流式事件。统一 Agent 继续沿用同一机制，但扩展事件类型。

### 新增 SSE 事件

- `task-config`
  发送配置卡数据。

- `task-validation`
  发送配置校验错误和阻塞原因。

- `task-status`
  发送执行中、等待输入、失败、完成等状态。

- `task-result`
  发送执行结果摘要。

### 保留现有事件

- `plan`
- `preview`
- `diff`
- `memory`
- `test-flow-config`
- `test-suite`
- `continuation`

这些现有事件后续逐步收敛到统一任务协议下，但一期不要求全部重构完成。

## 与现有 UI 的结合方式

不重做现有聊天 UI，只在现有卡片系统上扩展。

### 保持不变

- ChatArea 作为统一入口聊天区。
- MessageBubble 作为消息与卡片容器。
- 现有 `plan / preview / diff` 卡片继续保留。

### 新增卡片类型

- `TaskConfigCard`
  用于配置收集、字段编辑、参数来源展示、确认执行。

- `TaskValidationCard`
  用于展示参数冲突和校验失败原因。

- `TaskStatusCard`
  用于展示执行进度和运行状态。

- `TaskResultCard`
  用于展示统一执行结果和下一步建议。

## 实施阶段建议

### 第一阶段：统一骨架

- 建立统一任务模型
- 建立配置卡协议
- 建立状态机
- 支持 `prompt / test / memory`

### 第二阶段：扩展受控任务

- 接入 `audit`
- 接入 `project_settings`
- 补充统一参数补丁逻辑

### 第三阶段：知识相关整合

- 接入 `cleaning`
- 接入 `knowledge_r`
- 保持两者边界隔离

### 第四阶段：增强可观测性

- 增加任务追踪
- 增加任务回放和错误定位
- 增加统一评测和回归链路

## 风险与权衡

### 1. 一次性引入通用 Agent 框架

风险：

- 会先增加通用运行时复杂度。
- 仍然需要自定义本项目自己的任务协议、配置卡协议和权限边界。
- 对当前 Next.js + TypeScript 产品代码的整合成本较高。

结论：

一期不引入外部 Agent 框架，优先把产品协议层补齐。

### 2. 继续依赖大 system prompt

风险：

- 参数不稳定。
- 状态难维护。
- 禁止动作边界不可靠。
- 多模块能力互相污染。

结论：

不适合作为统一平台 Agent 的长期架构。

### 3. `cleaning` 与 `knowledge_r` 混用

风险：

- 用户目标混乱。
- 配置卡字段过载。
- 模块职责不清。

结论：

必须保持隔离。

## 结论

统一平台 Agent 一期应采用“主编排内核 + 领域执行器”的架构：

- 外部只有一个 Agent 入口。
- 内部先任务化，再补配置，再生成可编辑配置卡，再确认执行。
- 用户既可以在卡片里改参数，也可以在对话里补参数，系统自动回写。
- `cleaning` 和 `knowledge_r` 分为独立任务域。
- 发布、回滚、上线切换永远不在 Agent 可执行范围内。

这个架构既能复用当前已有的 Prompt、Test、Audit、Memory 能力，也能为后续 `cleaning` 和 `knowledge_r` 的统一接入留出明确边界，而不必把整个平台重新做成通用工作流系统。
