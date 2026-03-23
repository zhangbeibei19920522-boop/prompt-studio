import type { StreamEvent } from '@/types/ai'

/**
 * Encode a StreamEvent as an SSE data line.
 */
export function encodeSSE(event: StreamEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`
}

/**
 * Create a ReadableStream that sends SSE events from an async generator.
 */
export function createSSEStream(
  generator: AsyncGenerator<StreamEvent>
): ReadableStream {
  const encoder = new TextEncoder()

  return new ReadableStream({
    async start(controller) {
      try {
        let eventCount = 0
        for await (const event of generator) {
          eventCount++
          controller.enqueue(encoder.encode(encodeSSE(event)))
        }
        console.log('[SSE Stream] Generator finished. Events sent:', eventCount)
        controller.enqueue(encoder.encode(encodeSSE({ type: 'done' })))
      } catch (error) {
        const message = error instanceof Error ? error.message : '未知错误'
        console.error('[SSE Stream] Generator threw error:', {
          message,
          stack: error instanceof Error ? error.stack : undefined,
        })
        controller.enqueue(
          encoder.encode(encodeSSE({ type: 'error', message }))
        )
      } finally {
        controller.close()
      }
    },
  })
}

/**
 * Parse raw AI text output for structured JSON blocks.
 * Returns extracted JSON objects and remaining text.
 */
export function parseAgentOutput(text: string): {
  jsonBlocks: Array<Record<string, unknown>>
  plainText: string
} {
  const jsonBlocks: Array<Record<string, unknown>> = []
  let plainText = text

  // Match ```json ... ``` blocks
  const jsonRegex = /```json\s*\n?([\s\S]*?)\n?\s*```/g
  let match: RegExpExecArray | null

  while ((match = jsonRegex.exec(text)) !== null) {
    try {
      const parsed = JSON.parse(match[1])
      jsonBlocks.push(parsed)
      plainText = plainText.replace(match[0], '').trim()
    } catch {
      // Not valid JSON, skip
    }
  }

  // Fallback: if no ```json blocks found, try to find bare JSON objects with "type" field
  if (jsonBlocks.length === 0) {
    const bareJsonRegex = /\{[\s\n]*"type"\s*:\s*"(?:plan|preview|diff|memory|test-flow-config|test-suite|test-suite-batch)"[\s\S]*?\}(?:\s*\})?/g
    let bareMatch: RegExpExecArray | null
    while ((bareMatch = bareJsonRegex.exec(text)) !== null) {
      try {
        const parsed = JSON.parse(bareMatch[0])
        if (
          parsed.type === 'plan' ||
          parsed.type === 'preview' ||
          parsed.type === 'diff' ||
          parsed.type === 'memory' ||
          parsed.type === 'test-flow-config' ||
          parsed.type === 'test-suite' ||
          parsed.type === 'test-suite-batch'
        ) {
          jsonBlocks.push(parsed)
          plainText = plainText.replace(bareMatch[0], '').trim()
        }
      } catch {
        // Not valid JSON, skip
      }
    }
  }

  return { jsonBlocks, plainText }
}

/**
 * Detect whether streamed AI output contains a truncated JSON code block.
 * A truncated block has an opening ```json fence but no corresponding closing ```.
 */
export function detectTruncatedJson(text: string): boolean {
  const openRegex = /```json\b/g
  const closeRegex = /```(?!json)/g

  const opens: number[] = []
  const closes: number[] = []

  let m: RegExpExecArray | null
  while ((m = openRegex.exec(text)) !== null) opens.push(m.index)
  while ((m = closeRegex.exec(text)) !== null) closes.push(m.index)

  for (const openIdx of opens) {
    const hasClose = closes.some(closeIdx => closeIdx > openIdx)
    if (!hasClose) return true
  }

  return false
}
