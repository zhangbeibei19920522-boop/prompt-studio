# 测试 Agent 会话内路由配置设计

## 背景

当前自动测试创建链路只支持单 Prompt：

- 用户进入测试 Agent 会话
- Agent 澄清测试重点后直接生成测试集
- 测试集绑定单个 `promptId`
- 运行时所有用例都只对这一个 Prompt 执行和评估

这和当前真实业务场景不一致。现有业务是固定先执行一个意图识别 Prompt，再根据输出的 intent 值进入不同回复 Prompt。测试创建和测试运行都需要理解这条链路，而不是继续把整个流程伪装成单 Prompt。

## 目标

- 让测试 Agent 在会话中先判断当前需求是单 Prompt 还是多 Prompt 路由
- 单 Prompt 场景完全保持现有创建流程
- 多 Prompt 场景在会话里插入“配置业务流程”节点，由用户配置入口 Prompt 和 `intent -> Prompt` 映射
- 路由配置完成后，测试 Agent 继续在当前会话里生成测试集
- 测试用例支持记录 `expectedIntent`
- 测试运行结果支持展示期望 intent、实际 intent、命中 Prompt
- 兼容已有单 Prompt 测试集，不要求用户迁移

## 非目标

- 不实现通用工作流引擎
- 不支持多入口 Prompt
- 不支持多层分支、回环、重试、人工节点等复杂流程
- 不新增独立的测试配置页面
- 不把路由规则交给 Agent 自动猜测并自动落库

## 设计

### 1. 会话内测试方式判断

测试 Agent 在规划阶段新增一个明确判断：

- `single`：单 Prompt 测试
- `routing`：多 Prompt 路由测试

交互规则：

- 如果用户描述的是单 Prompt 测试，沿用当前流程，不出现额外配置 UI
- 如果用户明确提到多 Prompt、意图识别后分流、路由到子 Prompt 等流程，Agent 进入 `routing` 模式
- 当 Agent 识别为 `routing` 模式时，不直接输出测试集 JSON，而是在消息流里插入一张“配置业务流程”卡片

### 2. 会话内路由配置器

路由配置器通过会话消息卡片触发，以弹层形式出现，不新增独立页面。

配置器只包含以下字段：

- 流程类型：固定为“多 Prompt 路由”
- 入口 Prompt：从当前项目已创建 Prompt 中选择一个
- intent 到 Prompt 映射：支持用户维护多条 `intent值 -> Prompt` 配置

交互约束：

- Prompt 只能从当前项目已有 Prompt 列表中下拉选择
- intent 值由用户手工输入，平台不内置枚举
- 保存后关闭弹层，回到当前会话
- 路由配置保存后，测试 Agent 继续生成测试集

### 3. 测试集生成

多 Prompt 场景下，测试 Agent 生成测试集时需要带上已保存的路由配置上下文。

测试集生成要求：

- 仍然通过当前会话里的测试集卡片确认创建
- 现有测试集卡片结构尽量保持不变
- 多 Prompt 场景下每条用例新增 `expectedIntent`

因此多 Prompt 测试用例字段变为：

- `title`
- `context`
- `input`
- `expectedIntent`
- `expectedOutput`

单 Prompt 测试用例仍可不使用 `expectedIntent`。

### 4. 数据模型

#### TestSuite

测试集从“绑定单个 Prompt”升级为“支持两种测试模式”：

- `workflowMode: 'single' | 'routing'`
- `promptId`: 单 Prompt 模式继续使用
- `routingConfig`: 路由模式使用

`routingConfig` 结构：

```json
{
  "entryPromptId": "prompt-a",
  "routes": [
    { "intent": "pre_sale", "promptId": "prompt-b" },
    { "intent": "refund", "promptId": "prompt-c" }
  ]
}
```

兼容策略：

- 旧测试集默认为 `workflowMode = 'single'`
- 旧数据继续使用已有 `promptId`
- 路由模式下 `promptId` 可为空，由 `routingConfig.entryPromptId` 作为主入口

#### TestCase

新增：

- `expectedIntent: string`

兼容策略：

- 单 Prompt 用例默认存空字符串

#### TestCaseResult

新增：

- `actualIntent: string`
- `matchedPromptId: string | null`
- `matchedPromptTitle: string | null`
- `intentPassed: boolean`
- `intentScore: number`
- `intentReason: string`
- `replyPassed: boolean`
- `replyScore: number`
- `replyReason: string`

综合 `passed` 和 `score` 仍保留，供历史结果和总报告复用。

### 5. 测试运行语义

#### 单 Prompt

保持现状：

- 直接使用测试集绑定的 Prompt 执行
- 只评估最终回复

#### 多 Prompt 路由

执行流程固定为：

1. 将用户输入送入入口 Prompt
2. 解析入口 Prompt 输出的 intent 值
3. 在 `routingConfig.routes` 中查找目标 Prompt
4. 用目标 Prompt 生成最终回复
5. 分别评估：
   - intent 是否符合 `expectedIntent`
   - 最终回复是否符合 `expectedOutput`
6. 生成综合结果和整体报告

这里不要求平台强制某种 intent 枚举，但要求：

- 入口 Prompt 输出必须能稳定提取出一个 intent 值
- 路由匹配使用精确匹配
- 未匹配到路由时，本条用例直接记为失败，并写清失败原因

### 6. 结果展示

测试集详情页不重做，只在现有结果结构上补充路由信息。

每条用例结果新增展示：

- 期望 intent
- 实际 intent
- 命中 Prompt

评估展示规则：

- 保留现有总分和整体报告
- 增加 intent 评估与回复评估的拆分信息
- 让用户能快速区分“路由错了”还是“回复错了”

### 7. Agent 与前端职责边界

#### Agent 负责

- 判断当前测试需求属于 `single` 还是 `routing`
- 在 `routing` 模式下暂停直接生成测试集，先触发配置业务流程卡片
- 使用用户保存的路由配置继续生成测试用例

#### 前端负责

- 展示会话中的“配置业务流程”卡片
- 弹出配置器并提供真实 Prompt 下拉
- 保存用户配置
- 将已保存路由配置回填到测试 Agent 后续生成链路和最终测试集创建链路

这样可以避免让 Agent 猜测 Prompt 映射，确保路由配置始终基于真实项目数据。

## 验证

- 单 Prompt 会话不出现路由配置卡片，仍按原流程生成测试集
- 多 Prompt 会话中，只有用户明确选择/确认多 Prompt 后才出现路由配置器
- 路由配置器中的 Prompt 选项全部来自当前项目已创建 Prompt
- 路由配置保存后，测试 Agent 在当前会话中继续生成测试集
- 多 Prompt 测试集中的用例包含 `expectedIntent`
- 多 Prompt 测试运行后，结果页可看到期望 intent、实际 intent 和命中 Prompt
- 旧的单 Prompt 测试集仍可正常打开、运行和查看历史结果
