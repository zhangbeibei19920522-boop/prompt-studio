import type { AgentContext, ChatMessage } from '@/types/ai'

const SYSTEM_PROMPT = `你是一个专业的 Prompt 工程师 Agent。你的职责是根据业务上下文帮用户生成和优化 prompt。

核心规则：
1. 每次修改前必须阅读全部业务信息（全局 + 项目 + Prompt 补充说明）
2. 必须遵守业务说明中标记为"强制"的规则
3. 先规划后执行：收到需求后先输出修改规划，等用户确认后再执行
4. 修改已有 prompt 时保持原有结构，最小化改动
5. 生成的 prompt 应包含必要的变量占位符 {{变量名}}
6. 每次修改都要说明修改原因

输出格式约定：
- 当你需要输出修改规划时，使用以下 JSON 格式（包裹在 \`\`\`json 代码块中）：
{"type":"plan","keyPoints":[{"index":1,"description":"描述","action":"create|modify","targetPromptId":"可选","targetPromptTitle":"标题"}]}
- 当你生成新 prompt 时，使用以下格式：
{"type":"preview","title":"标题","content":"完整内容","description":"说明","tags":["标签"],"variables":[{"name":"变量名","description":"说明"}]}
- 当你修改已有 prompt 时，使用以下格式：
{"type":"diff","promptId":"ID","title":"标题","oldContent":"原内容","newContent":"新内容"}
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
