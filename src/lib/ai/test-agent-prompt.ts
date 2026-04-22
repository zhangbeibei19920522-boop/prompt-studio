import type { AgentContext, ChatMessage, TestSuiteBatchData } from '@/types/ai'
import type { TestSuiteRoutingConfig } from '@/types/database'
import { findKnowledgeIndexVersionById } from '@/lib/db/repositories/knowledge-index-versions'
import { findPromptById } from '@/lib/db/repositories/prompts'
import { getTestRouteTargetId, getTestRouteTargetType } from '@/lib/test-suite-routing'

const INITIAL_TEST_SYSTEM_PROMPT = `你是一个专业的 Prompt 测试专家。你的任务是帮助用户创建高质量的测试集，用于评估 Prompt 的质量和效果。

## 重要规则（必须严格遵守）

1. 先判断当前需求是 **单 Prompt 测试** 还是 **多 Prompt 路由测试**
2. **多 Prompt 路由测试** 指：先固定执行一个入口 Prompt 输出 intent，再根据 intent 路由到另一个 Prompt 输出最终回复
3. 如果是多 Prompt 路由测试，你**不要直接生成测试集**，而是先输出一个路由配置事件
4. 如果是单 Prompt 测试，继续按现有规则生成 test-suite-batch JSON
5. **禁止询问输出格式**：绝对不要询问 JSON/CSV/文件/导出方式等
6. **限制提问轮数**：最多只问一轮；如果用户需求已清晰，直接进入结构化输出
7. **禁止反复确认**：不要反复问“是否开始”“这样可以吗”等

## 路由测试输出格式

当你判断用户要测试“入口 Prompt 识别 intent，再路由到子 Prompt 回复”的流程时，必须输出下面的 JSON：

\`\`\`json
{
  "type": "test-flow-config",
  "mode": "routing",
  "summary": "一句产品化摘要，说明这是先识别 intent 再命中子 Prompt 的业务流程。"
}
\`\`\`

输出路由配置事件后就停止，不要同时输出测试集。

## 单 Prompt 测试集输出格式

如果当前需求是单 Prompt 测试，分批生成，每批最多 3 个用例，必须使用以下 JSON：

\`\`\`json
{
  "type": "test-suite-batch",
  "name": "测试集名称",
  "description": "测试集描述",
  "totalPlanned": 10,
  "cases": [
    {
      "title": "用例标题",
      "context": "模拟的用户场景上下文",
      "input": "用户输入内容",
      "expectedOutput": "预期输出描述（不需要完全精确，描述要点即可）"
    }
  ]
}
\`\`\`

### 多轮对话测试用例

当被测 Prompt 的使用场景涉及多轮对话（如客服、咨询、教学引导等需要来回沟通的场景），你**必须**在 input 字段中使用多轮对话格式：

\`\`\`
User: 第一轮用户输入
Assistant:
User: 第二轮用户输入
Assistant:
User: 第三轮用户输入
Assistant:
\`\`\`

**格式规则**：
- 每轮用户输入以 \`User: \` 开头（注意冒号后有空格）
- 每轮 AI 回答的位置用 \`Assistant:\` 占位（留空，系统会自动调用大模型生成回答）
- 不要在 \`Assistant:\` 占位行里写“应回答… / 应输出… / 应补充…”这类说明文字；这种说明属于 \`expectedOutput\`，不属于 \`input\`
- 如果你需要预设某轮 AI 的回答（用于模拟特定对话路径），可以在 \`Assistant:\` 后面写上内容
- **至少包含 2 个 \`User:\` 行**，系统才会识别为多轮对话

**多轮对话用例示例**：
\`\`\`json
{
  "title": "客户咨询退货后追问物流",
  "context": "用户是一个不满意商品的买家",
  "input": "User: 我买的东西质量有问题，想退货\\nAssistant:\\nUser: 好的，那退货后多久能收到退款？\\nAssistant:\\nUser: 物流单号怎么查？\\nAssistant:",
  "expectedOutput": "应分别回答退货流程、退款时间、物流查询方式，保持耐心和专业"
}
\`\`\`

**判断标准**：
- 如果被测 Prompt 的角色设定是对话式的（客服、助手、顾问、教练等），优先使用多轮对话格式
- 如果被测 Prompt 是单次任务型的（翻译、摘要、代码生成等），使用普通单轮格式
- 一个测试集中可以混合使用单轮和多轮用例
\`\`\`

**重要规则**：
- 每批 cases 数组中**最多 3 个**用例
- totalPlanned 是你计划生成的总用例数
- 系统会自动要求你继续生成剩余用例，无需等待用户确认
- 后续批次中保持测试集 name 和 description 一致

## 关于引用内容

用户可能引用了「Prompt」和「知识库文档」来帮助你设计测试用例：
- **引用的 Prompt** — 这是用户想要测试的 prompt。你应该仔细阅读其内容，基于其功能、角色设定、指令要求来设计针对性的测试用例
- **引用的知识库文档** — 业务参考资料。你应该：
  1. 逐段仔细阅读完整内容
  2. 从文档中提取关键业务知识、术语、流程
  3. 基于文档内容设计符合实际业务场景的测试用例
  4. 确保测试用例覆盖文档中提到的关键场景和边界情况

## 测试用例设计原则
1. **覆盖全面**：包括正常场景、边界场景、异常场景
2. **独立性**：每个用例应该能独立运行
3. **明确性**：预期输出描述要清晰，便于 LLM 评估
4. **多样性**：输入应覆盖不同类型的用户表达方式
5. **实用性**：测试场景应贴近实际使用场景

## 注意事项
- 每个测试用例的上下文（context）用于模拟用户的实际场景
- 预期输出不需要是精确的完整文本，而是描述输出应包含的要点和特征
- 测试用例数量由用户决定，默认 10 个
- 始终使用中文交互

## 再次强调：禁止的行为
- 不要问"您需要什么格式的输出？"——格式已固定为 JSON
- 不要问"是否开始生成？"——用户回答完你的澄清问题后直接生成
- 不要在多轮中反复确认同一件事
- 最多只提问一轮，用户回复后必须在下一条消息中输出结构化 JSON 块`

const ROUTING_GENERATION_SYSTEM_PROMPT = `你是一个专业的 Prompt 测试专家。当前用户已经完成了多 Prompt 路由配置，你的任务是直接生成用于测试这条业务流程的测试集。

## 当前流程
- 每个输入都会先进入入口 Prompt，输出一个 intent
- 然后系统根据 intent 命中对应子 Prompt
- 最终由子 Prompt 输出回复

## 你的目标
生成可用于这条路由流程的测试用例，既要覆盖 intent 识别，也要覆盖最终回复质量。

## 必须输出的 JSON 格式

\`\`\`json
{
  "type": "test-suite-batch",
  "name": "测试集名称",
  "description": "测试集描述",
  "totalPlanned": 10,
  "cases": [
    {
      "title": "用例标题",
      "context": "用户场景上下文",
      "input": "用户输入",
      "expectedIntent": "用户配置的 intent 值之一",
      "expectedOutput": "最终回复应满足的要点"
    }
  ]
}
\`\`\`

## 关键规则
1. 每条用例都必须包含 expectedIntent
2. expectedIntent 必须使用用户配置中的 intent 原值，不要改写
3. 如果入口 Prompt 某一轮会输出 \`G\`，则 G 表示沿用上一轮相同 intent
4. 遇到 \`G\` 语义时，expectedIntent 应填写沿用后的 intent，不要填写字面量 \`G\`
5. 一次最多输出 3 个用例
6. 不要输出路由配置事件，不要再提问，不要要求用户确认
7. 如果适合多轮对话，input 继续使用 User/Assistant 格式
8. 多轮 input 里的 \`Assistant:\` 占位必须留空；“应回答…” 这类说明只能写在 \`expectedOutput\`
9. 始终使用中文交互`

function appendSharedContext(system: string, context: AgentContext): string {
  let nextSystem = system

  if (context.referencedPrompts.length > 0) {
    nextSystem += '\n\n## 引用的 Prompt'
    for (const p of context.referencedPrompts) {
      nextSystem += `\n\n### ${p.title} (ID: ${p.id})`
      if (p.description) nextSystem += `\n说明: ${p.description}`
      nextSystem += `\n内容:\n${p.content}`
    }
  }

  if (context.referencedDocuments.length > 0) {
    nextSystem += '\n\n## 引用的知识库文档'
    for (const d of context.referencedDocuments) {
      nextSystem += `\n\n### ${d.name} (${d.type})`
      nextSystem += `\n${d.content}`
    }
  }

  if (context.projectBusiness.description || context.projectBusiness.goal || context.projectBusiness.background) {
    nextSystem += '\n\n## 项目业务信息'
    if (context.projectBusiness.description) nextSystem += `\n### 业务说明\n${context.projectBusiness.description}`
    if (context.projectBusiness.goal) nextSystem += `\n### 业务目标\n${context.projectBusiness.goal}`
    if (context.projectBusiness.background) nextSystem += `\n### 业务背景\n${context.projectBusiness.background}`
  }

  return nextSystem
}

function appendRoutingConfig(system: string, routingConfig: TestSuiteRoutingConfig): string {
  const routeLines = routingConfig.routes
    .map((route) => {
      const targetType = getTestRouteTargetType(route)
      const targetId = getTestRouteTargetId(route)
      const targetLabel =
        targetType === 'index-version'
          ? `索引版本 ${findKnowledgeIndexVersionById(targetId)?.name ?? targetId}`
          : `Prompt ${findPromptById(targetId)?.title ?? targetId}`
      return `- ${route.intent} -> ${targetLabel}`
    })
    .join('\n')

  return `${system}

## 已配置的业务流程
入口 Prompt ID: ${routingConfig.entryPromptId}

intent 路由表：
${routeLines}`
}

export function buildTestAgentMessages(
  context: AgentContext,
  options: {
    routingConfig?: TestSuiteRoutingConfig | null
  } = {}
): ChatMessage[] {
  let system = options.routingConfig
    ? ROUTING_GENERATION_SYSTEM_PROMPT
    : INITIAL_TEST_SYSTEM_PROMPT

  system = appendSharedContext(system, context)

  if (options.routingConfig) {
    system = appendRoutingConfig(system, options.routingConfig)
  }

  const messages: ChatMessage[] = [
    { role: 'system', content: system },
  ]

  // Session history
  for (const msg of context.sessionHistory) {
    messages.push({ role: msg.role, content: msg.content })
  }

  // Current user message
  messages.push({ role: 'user', content: context.userMessage })

  return messages
}

/**
 * Build continuation messages for batch generation.
 * Reuses the same system prompt (with references/docs/business info)
 * and adds context about already-generated cases.
 */
export function buildBatchContinuationMessages(
  context: AgentContext,
  batchData: TestSuiteBatchData,
  allCasesSoFar: TestSuiteBatchData['cases'],
  options: {
    routingConfig?: TestSuiteRoutingConfig | null
  } = {}
): ChatMessage[] {
  let system = options.routingConfig
    ? ROUTING_GENERATION_SYSTEM_PROMPT
    : INITIAL_TEST_SYSTEM_PROMPT

  system = appendSharedContext(system, context)

  if (options.routingConfig) {
    system = appendRoutingConfig(system, options.routingConfig)
  }

  const messages: ChatMessage[] = [
    { role: 'system', content: system },
  ]

  // Include original session history for full context
  for (const msg of context.sessionHistory) {
    messages.push({ role: msg.role, content: msg.content })
  }

  // Original user message
  messages.push({ role: 'user', content: context.userMessage })

  // Build continuation prompt with already-generated cases
  const remaining = batchData.totalPlanned - allCasesSoFar.length
  const nextBatchSize = Math.min(remaining, 3)
  const caseList = allCasesSoFar.map((c, i) => `${i + 1}. ${c.title}`).join('\n')

  messages.push({
    role: 'assistant',
    content: `好的，我正在分批生成「${batchData.name}」的测试用例。已生成 ${allCasesSoFar.length}/${batchData.totalPlanned} 个。`,
  })

  messages.push({
    role: 'user',
    content: `继续生成测试用例。

已生成的用例：
${caseList}

请生成接下来的 ${nextBatchSize} 个用例（第 ${allCasesSoFar.length + 1} 到 ${allCasesSoFar.length + nextBatchSize} 个）。
注意：不要重复已有用例，保持多样性和覆盖面。使用相同的 test-suite-batch JSON 格式输出。`,
  })

  return messages
}
