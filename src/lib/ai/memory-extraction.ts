import type { ChatMessage } from '@/types/ai'
import type { MemoryExtractionAction, MemoryExtractionResult } from '@/types/ai'
import type { Memory, Message } from '@/types/database'
import { findMessagesBySession } from '@/lib/db/repositories/messages'
import { findSessionById } from '@/lib/db/repositories/sessions'
import {
  findGlobalMemories,
  findProjectMemories,
  createMemory,
  updateMemory,
} from '@/lib/db/repositories/memories'
import {
  getExtractionProgress,
  upsertExtractionProgress,
} from '@/lib/db/repositories/extraction-progress'
import { getSettings } from '@/lib/db/repositories/settings'
import { createAiProvider } from './provider'

/**
 * System prompt that instructs the LLM to extract memories from conversation.
 */
const EXTRACTION_PROMPT = `你是一个记忆提取助手。你的任务是从用户和 AI 的对话中提取值得长期记住的信息。

以下是用户新增的对话消息，以及已有的记忆列表。
请提取值得记住的新信息，每条标注分类：
- preference：用户的偏好、习惯、风格要求（如"我喜欢简洁的 prompt"、"输出格式用 markdown"）
- fact：业务事实、领域知识、项目约定（如"我们的 API 用 REST 风格"、"目标用户是开发者"）

对每条提取的信息，判断操作类型：
- insert：全新的记忆条目，提供 content 和 category
- update：应覆盖已有记忆（内容更新或更精确），提供目标记忆 id（targetId）和新 content
- skip：与已有记忆重复或无需记录，无需操作

注意：
1. 只提取有长期价值的信息，忽略一次性的对话内容
2. 不要提取过于笼统或模糊的信息
3. 每条记忆应当简洁明确，一句话概括
4. 如果对话中没有值得提取的信息，返回空数组

请严格输出 JSON 数组格式，不要输出其他内容：
[
  { "action": "insert", "content": "记忆内容", "category": "preference" },
  { "action": "update", "targetId": "已有记忆id", "content": "更新后的内容" },
  { "action": "skip" }
]`

/**
 * Build chat messages for the extraction LLM call.
 */
export function buildExtractionMessages(
  newMessages: Message[],
  existingMemories: Memory[]
): ChatMessage[] {
  const conversationLines = newMessages.map((m) => {
    const role = m.role === 'user' ? '用户' : 'AI'
    return `[${role}]: ${m.content}`
  })

  const memoryLines =
    existingMemories.length > 0
      ? existingMemories.map(
          (m) => `- [id=${m.id}] [${m.category}] [${m.scope}] ${m.content}`
        )
      : ['（暂无已有记忆）']

  const userContent = `## 新增对话消息
${conversationLines.join('\n')}

## 已有记忆列表
${memoryLines.join('\n')}

请从新增对话中提取记忆，输出 JSON 数组。`

  return [
    { role: 'system', content: EXTRACTION_PROMPT },
    { role: 'user', content: userContent },
  ]
}

/**
 * Parse the LLM response text into extraction actions.
 * Handles both raw JSON and ```json code blocks.
 */
export function parseExtractionResult(text: string): MemoryExtractionAction[] {
  const trimmed = text.trim()

  // Try to extract from ```json code block
  const codeBlockMatch = trimmed.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/)
  const jsonStr = codeBlockMatch ? codeBlockMatch[1].trim() : trimmed

  try {
    const parsed = JSON.parse(jsonStr)

    if (!Array.isArray(parsed)) {
      console.warn('[MemoryExtraction] LLM returned non-array JSON, returning empty')
      return []
    }

    // Validate and normalize each action
    return parsed
      .map((item: Record<string, unknown>): MemoryExtractionAction | null => {
        if (!item || typeof item !== 'object') return null

        const action = item.action as string
        if (!['insert', 'update', 'skip'].includes(action)) return null

        if (action === 'insert') {
          if (!item.content || typeof item.content !== 'string') return null
          const category = item.category === 'preference' ? 'preference' : 'fact'
          return { action: 'insert', content: item.content, category }
        }

        if (action === 'update') {
          if (!item.targetId || typeof item.targetId !== 'string') return null
          if (!item.content || typeof item.content !== 'string') return null
          return { action: 'update', targetId: item.targetId, content: item.content }
        }

        return { action: 'skip' }
      })
      .filter((a): a is MemoryExtractionAction => a !== null)
  } catch (err) {
    console.error('[MemoryExtraction] Failed to parse LLM response:', err)
    console.error('[MemoryExtraction] Raw text:', trimmed.slice(0, 500))
    return []
  }
}

/**
 * Main extraction pipeline for a session.
 *
 * 1. Read incremental messages since last extraction
 * 2. Load existing memories (project + global)
 * 3. Single LLM call for extraction + deduplication
 * 4. Execute insert/update operations
 * 5. Update extraction progress
 */
export async function extractMemoriesFromSession(
  sessionId: string
): Promise<MemoryExtractionResult> {
  console.log('[MemoryExtraction] Starting extraction for session:', sessionId)

  // 1. Validate session and get project context
  const session = findSessionById(sessionId)
  if (!session) {
    throw new Error(`Session not found: ${sessionId}`)
  }

  // 2. Read all messages and determine incremental range
  const allMessages = findMessagesBySession(sessionId)
  const progress = getExtractionProgress(sessionId)
  const lastIndex = progress?.lastExtractedMessageIndex ?? -1
  const newMessages = allMessages.slice(lastIndex + 1)

  console.log('[MemoryExtraction] Messages:', {
    total: allMessages.length,
    lastExtractedIndex: lastIndex,
    newCount: newMessages.length,
  })

  // Nothing new to extract
  if (newMessages.length === 0) {
    console.log('[MemoryExtraction] No new messages, skipping')
    return { actions: [], sessionId }
  }

  // 3. Load existing memories for deduplication context
  const projectMemories = findProjectMemories(session.projectId)
  const globalMemories = findGlobalMemories()
  const existingMemories = [...projectMemories, ...globalMemories]

  console.log('[MemoryExtraction] Existing memories:', {
    project: projectMemories.length,
    global: globalMemories.length,
  })

  // 4. Build messages and call LLM
  const settings = getSettings()
  const provider = createAiProvider(settings)
  const messages = buildExtractionMessages(newMessages, existingMemories)

  console.log('[MemoryExtraction] Calling LLM...')
  const responseText = await provider.chat(messages, {
    temperature: 0.1,
    maxTokens: 2000,
  })

  console.log('[MemoryExtraction] LLM response length:', responseText.length)

  // 5. Parse extraction result
  const actions = parseExtractionResult(responseText)
  console.log('[MemoryExtraction] Parsed actions:', actions.length)

  // 6. Execute actions
  let insertCount = 0
  let updateCount = 0

  for (const action of actions) {
    if (action.action === 'insert' && action.content && action.category) {
      createMemory({
        scope: 'project',
        projectId: session.projectId,
        category: action.category,
        content: action.content,
        source: 'auto',
        sourceSessionId: sessionId,
      })
      insertCount++
    } else if (action.action === 'update' && action.targetId && action.content) {
      const updated = updateMemory(action.targetId, { content: action.content })
      if (updated) {
        updateCount++
      } else {
        console.warn('[MemoryExtraction] Target memory not found for update:', action.targetId)
      }
    }
    // skip actions need no processing
  }

  // 7. Update extraction progress
  const newLastIndex = allMessages.length - 1
  upsertExtractionProgress(sessionId, newLastIndex)

  console.log('[MemoryExtraction] Extraction complete:', {
    inserted: insertCount,
    updated: updateCount,
    skipped: actions.filter((a) => a.action === 'skip').length,
    newLastIndex,
  })

  return { actions, sessionId }
}
