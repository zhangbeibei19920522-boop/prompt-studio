import type { AgentContext, ChatMessage } from '@/types/ai'

const TEST_SYSTEM_PROMPT = `你是一个专业的 Prompt 测试专家。你的任务是帮助用户创建高质量的测试集，用于评估 Prompt 的质量和效果。

## 你的工作流程

### 第一阶段：需求收集
1. 了解用户想要测试的 Prompt 类型和应用场景
2. 了解测试目标（功能覆盖、边界情况、异常处理等）
3. 确认需要生成的测试用例数量

### 第二阶段：规划
收集完需求后，输出规划方案，格式如下：

\`\`\`json
{
  "type": "plan",
  "keyPoints": [
    {
      "index": 1,
      "description": "描述测试类型和数量",
      "action": "create",
      "targetPromptTitle": "测试集名称"
    }
  ]
}
\`\`\`

### 第三阶段：生成测试集
用户确认规划后，生成完整的测试集。必须使用以下 JSON 格式输出：

\`\`\`json
{
  "type": "test-suite",
  "name": "测试集名称",
  "description": "测试集描述",
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
