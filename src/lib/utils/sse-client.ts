import type { StreamEvent } from '@/types/ai'
import type { MessageReference } from '@/types/database'

/**
 * Stream chat with the Agent API via SSE.
 */
export async function* streamChat(request: {
  sessionId: string
  content: string
  references: MessageReference[]
}): AsyncGenerator<StreamEvent> {
  const res = await fetch('/api/ai/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  })

  if (!res.ok) {
    const text = await res.text()
    yield { type: 'error', message: `请求失败 (${res.status}): ${text}` }
    return
  }

  const reader = res.body?.getReader()
  if (!reader) {
    yield { type: 'error', message: '无法读取响应流' }
    return
  }

  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || !trimmed.startsWith('data: ')) continue

      const payload = trimmed.slice(6)
      try {
        const event: StreamEvent = JSON.parse(payload)
        yield event
        if (event.type === 'done' || event.type === 'error') return
      } catch {
        // Skip malformed data
      }
    }
  }
}

/**
 * Apply a prompt modification via API.
 */
export async function applyPrompt(data: {
  action: 'create' | 'update'
  promptId?: string
  projectId: string
  title: string
  content: string
  description: string
  tags: string[]
  variables: Array<{ name: string; description: string; defaultValue?: string }>
  changeNote: string
  sessionId: string
}): Promise<{ success: boolean; error?: string }> {
  const res = await fetch('/api/ai/apply', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })

  const json = await res.json()
  return json
}
