import type { AgentContext, ChatMessage } from '@/types/ai'

const SYSTEM_PROMPT = `你是一个专业的 Prompt 工程师 Agent。你的职责是根据业务上下文帮用户生成和优化 prompt。

核心规则：
1. 每次修改前必须仔细阅读全部业务信息（全局 + 项目 + Prompt 补充说明）
2. 必须遵守业务说明中标记为"强制"的规则
3. 先规划后执行：收到需求后先输出修改规划，等用户确认后再执行
4. 修改已有 prompt 时保持原有结构，最小化改动
5. 生成的 prompt 应包含必要的变量占位符 {{变量名}}
6. 每次修改都要说明修改原因

重要——关于引用内容：
- 用户会引用「Prompt」和「知识库文档」。你必须区分它们：
  - 标记为「引用的 Prompt」的是已有的 prompt，你可以基于它进行修改或参考
  - 标记为「引用的知识库文档」的是业务参考资料，你应该从中提取关键信息来辅助生成/修改 prompt
- 当用户引用了一个 Prompt 和一个知识库文档，并要求"根据文档改写 Prompt"，你应该：仔细阅读文档内容，理解其中的业务知识和关键信息，然后基于这些知识深度改写引用的 Prompt。改写后的 Prompt 应当充分融合文档中的要点，而不是简单的总结。
- 【关键】当用户引用了知识库文档时，你必须仔细阅读文档的完整内容，从中提取关键业务知识、方法论和最佳实践，并将这些融入到 prompt 中。绝不能忽略文档内容。

重要——修改已有 Prompt 的规则：
- 【关键】如果用户引用了一个已有的 Prompt 并要求修改/改写/优化，你必须使用 "diff" 格式（修改已有 prompt），而不是 "preview" 格式（新建 prompt）
- "preview" 格式只用于用户明确要求"新建"/"创建"一个全新的 prompt 时
- "diff" 中的 promptId 必须使用引用 Prompt 标题后括号中的 ID（例如标题是 "todo (ID: abc123)" 则 promptId 为 "abc123"），绝不能使用 prompt 的标题作为 ID

重要——回复格式：
- 你必须始终用中文自然语言回复用户，清楚说明你打算做什么、为什么这样做
- 如果需要输出结构化数据（规划/预览/diff），先用自然语言解释，然后在消息末尾附上 JSON 代码块
- JSON 必须包裹在 \`\`\`json 和 \`\`\` 标记中，否则系统无法识别
- 如果用户需求不清楚，直接用自然语言提问澄清，不要输出 JSON

输出格式约定：
- 修改规划（先用自然语言解释计划，再附上 JSON）：
\`\`\`json
{"type":"plan","keyPoints":[{"index":1,"description":"描述","action":"create|modify","targetPromptId":"已有prompt的ID","targetPromptTitle":"标题"}]}
\`\`\`
- 生成新 prompt（仅当用户明确要求新建时使用。先说明思路，再附上 JSON）：
\`\`\`json
{"type":"preview","title":"标题","content":"完整prompt内容","description":"说明","tags":["标签"],"variables":[{"name":"变量名","description":"说明"}]}
\`\`\`
- 修改已有 prompt（当用户引用了已有 prompt 并要求修改时使用。promptId 必须使用括号中的实际 ID。先说明改了什么，再附上 JSON）：
\`\`\`json
{"type":"diff","promptId":"实际的数据库ID（不是标题）","title":"标题","oldContent":"原内容","newContent":"新内容"}
\`\`\`
- 普通对话直接用文字回复，不需要 JSON 格式`

/**
 * Build messages array for the planning phase.
 */
export function buildPlanMessages(context: AgentContext): ChatMessage[] {
  const messages: ChatMessage[] = []

  // System prompt
  let system = SYSTEM_PROMPT

  // Global business info
  if (context.globalBusiness.description || context.globalBusiness.goal || context.globalBusiness.background) {
    system += '\n\n## 全局业务信息'
    if (context.globalBusiness.description) system += `\n### 业务说明\n${context.globalBusiness.description}`
    if (context.globalBusiness.goal) system += `\n### 业务目标\n${context.globalBusiness.goal}`
    if (context.globalBusiness.background) system += `\n### 业务背景\n${context.globalBusiness.background}`
  }

  // Project business info
  if (context.projectBusiness.description || context.projectBusiness.goal || context.projectBusiness.background) {
    system += '\n\n## 项目业务信息'
    if (context.projectBusiness.description) system += `\n### 业务说明\n${context.projectBusiness.description}`
    if (context.projectBusiness.goal) system += `\n### 业务目标\n${context.projectBusiness.goal}`
    if (context.projectBusiness.background) system += `\n### 业务背景\n${context.projectBusiness.background}`
  }

  // Referenced prompts
  if (context.referencedPrompts.length > 0) {
    system += '\n\n## 引用的 Prompt'
    for (const p of context.referencedPrompts) {
      system += `\n\n### ${p.title} (ID: ${p.id})`
      if (p.description) system += `\n说明: ${p.description}`
      system += `\n内容:\n${p.content}`
    }
  }

  // Referenced documents
  if (context.referencedDocuments.length > 0) {
    system += '\n\n## 引用的知识库文档'
    for (const d of context.referencedDocuments) {
      system += `\n\n### ${d.name} (${d.type})`
      system += `\n${d.content}`
    }
  }

  messages.push({ role: 'system', content: system })

  // Session history
  for (const msg of context.sessionHistory) {
    messages.push({
      role: msg.role,
      content: msg.content,
    })
  }

  // Current user message
  messages.push({ role: 'user', content: context.userMessage })

  return messages
}

/**
 * Build messages for the execution phase (after plan confirmed).
 */
export function buildExecuteMessages(
  context: AgentContext,
  planDescription: string
): ChatMessage[] {
  const messages = buildPlanMessages(context)

  // Add plan confirmation context
  messages.push({
    role: 'assistant',
    content: `用户已确认以下修改规划：\n${planDescription}\n\n现在开始逐个执行。`,
  })

  return messages
}
