import type { StreamEvent } from '@/types/ai'
import type { MessageReference } from '@/types/database'
import { collectAgentContext } from './context-collector'
import { createAiProvider } from './provider'
import { getSettings } from '@/lib/db/repositories/settings'
import { buildPlanMessages } from './agent-prompt'
import { parseAgentOutput } from './stream-handler'
import { createMessage } from '@/lib/db/repositories/messages'

/**
 * Main Agent entry point that orchestrates the full chat workflow.
 *
 * Workflow:
 * 1. Persist the user message to DB.
 * 2. Collect all context (business info, references, history).
 * 3. Build prompt messages and stream from the AI provider.
 * 4. Yield text chunks to the caller in real time.
 * 5. After stream ends, parse structured JSON blocks and yield plan/preview/diff events.
 * 6. Persist the assistant message with optional metadata.
 */
export async function* handleAgentChat(
  sessionId: string,
  content: string,
  references: MessageReference[]
): AsyncGenerator<StreamEvent> {
  try {
    // 1. Save user message
    createMessage({
      sessionId,
      role: 'user',
      content,
      references,
      metadata: null,
    })

    // 2. Prepare AI provider
    const settings = getSettings()
    const provider = createAiProvider(settings)

    // 3. Collect context and build messages
    const context = collectAgentContext(sessionId, content, references)
    const messages = buildPlanMessages(context)

    // 4. Stream response and accumulate text
    let accumulated = ''

    for await (const chunk of provider.chatStream(messages)) {
      accumulated += chunk
      yield { type: 'text', content: chunk }
    }

    // 5. Parse structured blocks from accumulated response
    const { jsonBlocks } = parseAgentOutput(accumulated)

    for (const block of jsonBlocks) {
      if (block.type === 'plan') {
        yield {
          type: 'plan',
          data: {
            keyPoints: block.keyPoints as import('@/types/database').PlanData['keyPoints'],
            status: 'pending',
          },
        }
      } else if (block.type === 'preview') {
        yield {
          type: 'preview',
          data: block as unknown as import('@/types/database').PreviewData,
        }
      } else if (block.type === 'diff') {
        yield {
          type: 'diff',
          data: block as unknown as import('@/types/database').DiffData,
        }
      }
    }

    // 6. Persist assistant message
    const firstBlock = jsonBlocks[0] ?? null
    const metadata = firstBlock
      ? ({
          type: firstBlock.type as 'plan' | 'preview' | 'diff',
          data: firstBlock as unknown as import('@/types/database').PlanData | import('@/types/database').PreviewData | import('@/types/database').DiffData,
        } as import('@/types/database').MessageMetadata)
      : null

    createMessage({
      sessionId,
      role: 'assistant',
      content: accumulated,
      references: [],
      metadata,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : '未知错误'
    yield { type: 'error', message }
  }
}
