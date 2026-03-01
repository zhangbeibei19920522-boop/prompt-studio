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

  return { jsonBlocks, plainText }
}
