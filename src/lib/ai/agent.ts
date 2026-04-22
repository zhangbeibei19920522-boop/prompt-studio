import type { StreamEvent, MemoryCommandData, TestSuiteGenerationData, TestSuiteBatchData } from '@/types/ai'
import type { MessageReference, TestSuiteRoutingConfig } from '@/types/database'
import { findKnowledgeIndexVersionById } from '@/lib/db/repositories/knowledge-index-versions'
import { findPromptById } from '@/lib/db/repositories/prompts'
import { getTestRouteTargetId, getTestRouteTargetType } from '@/lib/test-suite-routing'
import { collectAgentContext } from './context-collector'
import { createAiProvider } from './provider'
import { getSettings } from '@/lib/db/repositories/settings'
import { buildPlanMessages } from './agent-prompt'
import { buildTestAgentMessages, buildBatchContinuationMessages } from './test-agent-prompt'
import { parseAgentOutput, detectTruncatedJson } from './stream-handler'
import { createMessage } from '@/lib/db/repositories/messages'
import { createMemory, deleteMemory } from '@/lib/db/repositories/memories'
import { findSessionById, updateSession } from '@/lib/db/repositories/sessions'

/**
 * Generate a short session title from the user message using LLM.
 * Returns null if the session already has a custom title.
 */
async function generateSessionTitle(
  sessionId: string,
  userMessage: string,
  provider: ReturnType<typeof createAiProvider>
): Promise<string | null> {
  const session = findSessionById(sessionId)
  if (!session || session.title !== '新对话') return null

  try {
    const title = await provider.chat([
      {
        role: 'system',
        content: '根据用户的第一条消息，生成一个简短的会话标题（不超过 15 个字）。只输出标题文本，不要加引号、标点或解释。',
      },
      { role: 'user', content: userMessage },
    ])
    const trimmed = title.trim().replace(/^["'""'']+|["'""'']+$/g, '')
    if (trimmed) {
      updateSession(sessionId, { title: trimmed })
      return trimmed
    }
  } catch (e) {
    console.error('[Agent] Title generation failed:', e)
  }
  return null
}

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

    // 5.5 Continuation: detect truncated JSON and auto-continue
    const MAX_CONTINUATIONS = 3
    let continuationCount = 0

    while (detectTruncatedJson(accumulated) && continuationCount < MAX_CONTINUATIONS) {
      continuationCount++
      console.log('[Agent] Truncated JSON detected, continuation', continuationCount, '/', MAX_CONTINUATIONS)

      yield {
        type: 'continuation',
        data: { iteration: continuationCount, maxIterations: MAX_CONTINUATIONS },
      }

      // Build continuation messages: original messages + assistant output so far + continue instruction
      const continuationMessages: import('@/types/ai').ChatMessage[] = [
        ...messages,
        { role: 'assistant' as const, content: accumulated },
        { role: 'user' as const, content: '你的输出被截断了，请从断点处继续，只输出剩余内容，不要重复已输出的部分。' },
      ]

      for await (const chunk of provider.chatStream(continuationMessages)) {
        accumulated += chunk
        yield { type: 'text', content: chunk }
      }

      console.log('[Agent] Continuation', continuationCount, 'complete. Total length:', accumulated.length)
    }

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

    // Auto-generate session title after first exchange
    const newTitle = await generateSessionTitle(sessionId, content, provider)
    if (newTitle) {
      yield { type: 'session-title', data: { sessionId, title: newTitle } }
    }

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

/**
 * Test Agent entry point — supports batch generation for test suites.
 * Supports references (prompts + knowledge base documents) for context-aware test generation.
 *
 * Batch generation flow:
 * 1. First LLM call streams normally → if response contains a test-suite-batch block
 * 2. Check if all cases are generated (cases.length >= totalPlanned)
 * 3. If not, loop: yield progress → build continuation prompt → call LLM → parse batch
 * 4. Merge all batches into a single test-suite event
 */
export async function* handleTestAgentChat(
  sessionId: string,
  content: string,
  references: MessageReference[] = [],
  options: {
    routingConfig?: TestSuiteRoutingConfig | null
    persistUserMessage?: boolean
  } = {}
): AsyncGenerator<StreamEvent> {
  try {
    console.log('[TestAgent] === Chat started ===', { sessionId, refCount: references.length })

    const shouldPersistUserMessage = options.persistUserMessage ?? content.trim().length > 0
    const effectiveUserMessage = options.routingConfig
      ? `用户已完成多 Prompt 路由配置。请基于已有需求继续生成测试集。\n入口 Prompt: ${options.routingConfig.entryPromptId}\n路由规则:\n${options.routingConfig.routes
          .map((route) => {
            const targetType = getTestRouteTargetType(route)
            const targetId = getTestRouteTargetId(route)
            const targetLabel =
              targetType === 'index-version'
                ? `索引版本 ${findKnowledgeIndexVersionById(targetId)?.name ?? targetId}`
                : `Prompt ${findPromptById(targetId)?.title ?? targetId}`
            return `- ${route.intent} -> ${targetLabel}`
          })
          .join('\n')}`
      : content

    if (shouldPersistUserMessage && content.trim().length > 0) {
      createMessage({
        sessionId,
        role: 'user',
        content,
        references,
        metadata: null,
      })
    }

    // 2. Prepare AI provider (use global settings)
    const settings = getSettings()
    const provider = createAiProvider(settings)

    // 3. Collect context (references, business info) and build messages
    const context = collectAgentContext(sessionId, effectiveUserMessage, references)
    const messages = buildTestAgentMessages(context, {
      routingConfig: options.routingConfig,
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

    // 5. Stream first response
    let accumulated = ''
    for await (const chunk of provider.chatStream(messages)) {
      accumulated += chunk
      yield { type: 'text', content: chunk }
    }

    // 6. Parse structured blocks
    const { jsonBlocks, plainText } = parseAgentOutput(accumulated)

    // Check for plan and batch blocks separately
    const planBlocks = jsonBlocks.filter(b => b.type === 'plan')
    const flowConfigBlock = jsonBlocks.find(b => b.type === 'test-flow-config')
    const batchBlock = jsonBlocks.find(b => b.type === 'test-suite-batch') as unknown as TestSuiteBatchData | undefined
    let assistantContent = plainText || accumulated

    if (planBlocks.length > 0) {
      // --- Plan mode: always yield plan first ---
      // If LLM outputs both plan and batch in the same response, only process plan.
      // The batch will be generated in the next turn after user confirms the plan.
      for (const block of planBlocks) {
        yield {
          type: 'plan',
          data: {
            keyPoints: block.keyPoints as import('@/types/database').PlanData['keyPoints'],
            status: 'pending',
          },
        }
      }
      console.log('[TestAgent] Plan yielded, batch generation deferred to next turn')
      assistantContent = plainText || '已整理测试方案，请确认后继续生成测试集。'
    } else if (flowConfigBlock) {
      yield {
        type: 'test-flow-config',
        data: flowConfigBlock as unknown as import('@/types/ai').TestFlowConfigRequestData,
      }
      assistantContent = plainText || '已识别为多 Prompt 业务流程，请先配置入口 Prompt 和 intent 路由。'
    } else if (batchBlock) {
      // --- Batch generation mode ---
      const allCases = [...batchBlock.cases]
      const totalPlanned = batchBlock.totalPlanned || allCases.length

      console.log('[TestAgent] Batch mode: got', allCases.length, '/', totalPlanned, 'cases')

      yield {
        type: 'test-suite-progress',
        data: { generated: allCases.length, total: totalPlanned },
      }

      // Loop to generate remaining batches
      const MAX_BATCH_ITERATIONS = 20 // safety limit
      let iteration = 0
      while (allCases.length < totalPlanned && iteration < MAX_BATCH_ITERATIONS) {
        iteration++
        console.log('[TestAgent] Batch iteration', iteration, '- generating more cases...')

        const continuationMessages = buildBatchContinuationMessages(context, batchBlock, allCases, {
          routingConfig: options.routingConfig,
        })

        let batchAccumulated = ''
        for await (const chunk of provider.chatStream(continuationMessages)) {
          batchAccumulated += chunk
          // Don't yield text chunks for continuation calls — only show progress
        }

        const { jsonBlocks: batchBlocks } = parseAgentOutput(batchAccumulated)
        const nextBatch = batchBlocks.find(b => b.type === 'test-suite-batch') as unknown as TestSuiteBatchData | undefined

        if (nextBatch && nextBatch.cases.length > 0) {
          allCases.push(...nextBatch.cases)
          console.log('[TestAgent] Batch', iteration, '- got', nextBatch.cases.length, 'new cases, total:', allCases.length)
        } else {
          // No more cases returned, stop looping
          console.log('[TestAgent] Batch', iteration, '- no new cases, stopping')
          break
        }

        yield {
          type: 'test-suite-progress',
          data: { generated: Math.min(allCases.length, totalPlanned), total: totalPlanned },
        }
      }

      // Merge into final test-suite event
      const mergedData: TestSuiteGenerationData = {
        name: batchBlock.name,
        description: batchBlock.description,
        workflowMode: options.routingConfig ? 'routing' : (batchBlock.workflowMode ?? 'single'),
        routingConfig: options.routingConfig ?? batchBlock.routingConfig ?? null,
        cases: allCases.slice(0, totalPlanned), // trim to planned count
      }

      console.log('[TestAgent] Batch complete:', mergedData.cases.length, 'total cases')

      yield {
        type: 'test-suite',
        data: mergedData,
      }
      assistantContent = plainText || '已生成测试集草案，请确认后创建。'
    } else {
      // --- Non-batch mode (old-style test-suite, etc.) ---
      for (const block of jsonBlocks) {
        if (block.type === 'test-suite') {
          yield {
            type: 'test-suite',
            data: block as unknown as TestSuiteGenerationData,
          }
        }
      }
    }

    // 7. Persist assistant message
    createMessage({
      sessionId,
      role: 'assistant',
      content: assistantContent,
      references: [],
      metadata: null,
    })

    // Auto-generate session title after first exchange
    const newTitle = content.trim().length > 0
      ? await generateSessionTitle(sessionId, content, provider)
      : null
    if (newTitle) {
      yield { type: 'session-title', data: { sessionId, title: newTitle } }
    }

    console.log('[TestAgent] === Chat complete ===')
  } catch (error) {
    const message = error instanceof Error ? error.message : '未知错误'
    console.error('[TestAgent] === Chat FAILED ===', message)
    yield { type: 'error', message }
  }
}
