import type { AgentContext, ChatMessage, TestSuiteBatchData } from '@/types/ai'

const TEST_SYSTEM_PROMPT = `你是一个专业的 Prompt 测试专家。你的任务是帮助用户创建高质量的测试集，用于评估 Prompt 的质量和效果。

## 重要：你的交付物

你的交付物是平台内的**测试用例界面**，不是文件。用户确认后系统会自动跳转到测试用例管理页面。
**绝对不要询问用户需要什么输出格式（JSON/CSV/文件等），你唯一的输出方式就是下面定义的 JSON 结构块，系统会自动处理。**

## 你的工作流程

**严格按照以下两个阶段执行。尽量减少不必要的提问，快速进入生成阶段。**

### 第一阶段：快速理解需求
- 如果用户引用了 Prompt 并说明了测试需求（或数量），**直接进入第二阶段生成测试用例**，不需要额外提问
- 如果用户没有引用 Prompt，请简短地确认要测试哪个 Prompt 和需要多少条用例即可
- **不要问**：输出格式、文件类型、导出方式等——这些与你无关

### 第二阶段：分批生成测试集
分批生成，每批**最多生成 3 个**用例。必须使用以下 JSON 格式输出：

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
- 如果你需要预设某轮 AI 的回答（用于模拟特定对话路径），可以在 \`Assistant:\` 后面写上内容
- **至少包含 2 个 \`User:\` 行**，系统才会识别为多轮对话

**多轮对话用例示例**：
\`\`\`json
{
  "title": "客户咨询退货后追问物流",
  "context": "用户是一个不满意商品的买家",
  "input": "User: 我买的东西质量有问题，想退货\\nAssistant:\\nUser: 好的，那退货后多久能收到退款？\\nAssistant:\\nUser: 物流单号怎么查？",
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
- 测试用例数量由用户决定，默认建议 10 个
- 始终使用中文交互`

export function buildTestAgentMessages(
  context: AgentContext
): ChatMessage[] {
  let system = TEST_SYSTEM_PROMPT

  // Inject referenced prompts
  if (context.referencedPrompts.length > 0) {
    system += '\n\n## 引用的 Prompt'
    for (const p of context.referencedPrompts) {
      system += `\n\n### ${p.title} (ID: ${p.id})`
      if (p.description) system += `\n说明: ${p.description}`
      system += `\n内容:\n${p.content}`
    }
  }

  // Inject referenced documents
  if (context.referencedDocuments.length > 0) {
    system += '\n\n## 引用的知识库文档'
    for (const d of context.referencedDocuments) {
      system += `\n\n### ${d.name} (${d.type})`
      system += `\n${d.content}`
    }
  }

  // Inject project business info for domain context
  if (context.projectBusiness.description || context.projectBusiness.goal || context.projectBusiness.background) {
    system += '\n\n## 项目业务信息'
    if (context.projectBusiness.description) system += `\n### 业务说明\n${context.projectBusiness.description}`
    if (context.projectBusiness.goal) system += `\n### 业务目标\n${context.projectBusiness.goal}`
    if (context.projectBusiness.background) system += `\n### 业务背景\n${context.projectBusiness.background}`
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
  allCasesSoFar: TestSuiteBatchData['cases']
): ChatMessage[] {
  let system = TEST_SYSTEM_PROMPT

  // Inject same context as initial call
  if (context.referencedPrompts.length > 0) {
    system += '\n\n## 引用的 Prompt'
    for (const p of context.referencedPrompts) {
      system += `\n\n### ${p.title} (ID: ${p.id})`
      if (p.description) system += `\n说明: ${p.description}`
      system += `\n内容:\n${p.content}`
    }
  }

  if (context.referencedDocuments.length > 0) {
    system += '\n\n## 引用的知识库文档'
    for (const d of context.referencedDocuments) {
      system += `\n\n### ${d.name} (${d.type})`
      system += `\n${d.content}`
    }
  }

  if (context.projectBusiness.description || context.projectBusiness.goal || context.projectBusiness.background) {
    system += '\n\n## 项目业务信息'
    if (context.projectBusiness.description) system += `\n### 业务说明\n${context.projectBusiness.description}`
    if (context.projectBusiness.goal) system += `\n### 业务目标\n${context.projectBusiness.goal}`
    if (context.projectBusiness.background) system += `\n### 业务背景\n${context.projectBusiness.background}`
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
