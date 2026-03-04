import type { StreamEvent, MemoryCommandData } from '@/types/ai'
import type { MessageReference } from '@/types/database'
import { collectAgentContext } from './context-collector'
import { createAiProvider } from './provider'
import { getSettings } from '@/lib/db/repositories/settings'
import { buildPlanMessages } from './agent-prompt'
import { parseAgentOutput } from './stream-handler'
import { createMessage } from '@/lib/db/repositories/messages'
import { createMemory, deleteMemory } from '@/lib/db/repositories/memories'
import { findSessionById } from '@/lib/db/repositories/sessions'

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
    console.log('[Agent] === Chat started ===', { sessionId, contentLength: content.length, refCount: references.length })

    // 1. Save user message
    createMessage({
      sessionId,
      role: 'user',
      content,
      references,
      metadata: null,
    })
    console.log('[Agent] User message saved')

    // 2. Prepare AI provider
    const settings = getSettings()
    console.log('[Agent] Settings loaded:', {
      provider: settings.provider,
      model: settings.model,
      baseUrl: settings.baseUrl || '(empty)',
      hasApiKey: !!settings.apiKey,
    })

    const provider = createAiProvider(settings)
    console.log('[Agent] Provider created')

    // 3. Collect context and build messages
    const context = collectAgentContext(sessionId, content, references)
    const messages = buildPlanMessages(context)
    console.log('[Agent] Messages built:', {
      messageCount: messages.length,
      systemLength: messages.find(m => m.role === 'system')?.content.length ?? 0,
      historyCount: context.sessionHistory.length,
      refPrompts: context.referencedPrompts.length,
      refDocs: context.referencedDocuments.length,
    })

    // 4. Yield context summary for thinking-chain display
    yield {
      type: 'context' as const,
      data: {
        referencedPrompts: context.referencedPrompts.map((p) => ({ id: p.id, title: p.title })),
        referencedDocuments: context.referencedDocuments.map((d) => ({ id: d.id, name: d.name })),
        hasGlobalBusiness: !!(context.globalBusiness.description || context.globalBusiness.goal || context.globalBusiness.background),
        hasProjectBusiness: !!(context.projectBusiness.description || context.projectBusiness.goal || context.projectBusiness.background),
        historyMessageCount: context.sessionHistory.length,
        globalMemoryCount: context.globalMemories.length,
        projectMemoryCount: context.projectMemories.length,
      },
    }

    // 5. Stream response and accumulate text
    let accumulated = ''
    let chunkCount = 0

    console.log('[Agent] Starting stream...')
    for await (const chunk of provider.chatStream(messages)) {
      accumulated += chunk
      chunkCount++
      yield { type: 'text', content: chunk }
    }
    console.log('[Agent] Stream complete. Chunks:', chunkCount, 'Total length:', accumulated.length)

    // 6. Parse structured blocks from accumulated response
    const { jsonBlocks, plainText } = parseAgentOutput(accumulated)
    console.log('[Agent] Parsed JSON blocks:', jsonBlocks.length)

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
      } else if (block.type === 'memory') {
        const memoryData = block.data as unknown as MemoryCommandData | undefined
        const memoryCommand = memoryData ?? (block as unknown as MemoryCommandData)

        if (memoryCommand.command === 'create' && memoryCommand.content) {
          // Determine projectId for project-scoped memories
          let projectId: string | null = null
          if (memoryCommand.scope === 'project') {
            const currentSession = findSessionById(sessionId)
            projectId = currentSession?.projectId ?? null
          }

          const created = createMemory({
            scope: memoryCommand.scope,
            projectId,
            category: 'preference',
            content: memoryCommand.content,
            source: 'manual',
            sourceSessionId: sessionId,
          })
          console.log('[Agent] Memory created:', { id: created.id, scope: created.scope, content: created.content })
        } else if (memoryCommand.command === 'delete' && memoryCommand.memoryId) {
          const deleted = deleteMemory(memoryCommand.memoryId)
          console.log('[Agent] Memory deleted:', { memoryId: memoryCommand.memoryId, success: deleted })
        } else if (memoryCommand.command === 'list') {
          // list is handled client-side, just log
          console.log('[Agent] Memory list requested:', { scope: memoryCommand.scope })
        }

        yield {
          type: 'memory',
          data: memoryCommand,
        }
      }
    }

    // 7. Persist assistant message
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
      content: plainText || accumulated,
      references: [],
      metadata,
    })
    console.log('[Agent] === Chat complete ===')
  } catch (error) {
    const message = error instanceof Error ? error.message : '未知错误'
    console.error('[Agent] === Chat FAILED ===', {
      error: message,
      stack: error instanceof Error ? error.stack : undefined,
    })
    yield { type: 'error', message }
  }
}
