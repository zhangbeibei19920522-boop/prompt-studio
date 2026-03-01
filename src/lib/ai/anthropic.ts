import type { AiProvider, ChatMessage, ChatOptions } from '@/types/ai'

/**
 * Anthropic Claude provider.
 * Uses the Messages API format.
 */
export function createAnthropicProvider(config: {
  apiKey: string
  model: string
  baseUrl?: string
}): AiProvider {
  const { apiKey, model, baseUrl = 'https://api.anthropic.com' } = config

  function convertMessages(messages: ChatMessage[]): {
    system: string
    messages: Array<{ role: 'user' | 'assistant'; content: string }>
  } {
    let system = ''
    const converted: Array<{ role: 'user' | 'assistant'; content: string }> = []

    for (const msg of messages) {
      if (msg.role === 'system') {
        system += (system ? '\n\n' : '') + msg.content
      } else {
        converted.push({ role: msg.role, content: msg.content })
      }
    }

    return { system, messages: converted }
  }

  async function chat(
    messages: ChatMessage[],
    options?: ChatOptions
  ): Promise<string> {
    const { system, messages: converted } = convertMessages(messages)
    const url = `${baseUrl.replace(/\/+$/, '')}/v1/messages`

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        system: system || undefined,
        messages: converted,
        max_tokens: options?.maxTokens ?? 4096,
        temperature: options?.temperature ?? 0.7,
        stream: false,
      }),
    })

    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Anthropic API error (${res.status}): ${text}`)
    }

    const data = await res.json()
    return data.content?.[0]?.text ?? ''
  }

  async function* chatStream(
    messages: ChatMessage[],
    options?: ChatOptions
  ): AsyncGenerator<string> {
    const { system, messages: converted } = convertMessages(messages)
    const url = `${baseUrl.replace(/\/+$/, '')}/v1/messages`

    console.log('[Anthropic Stream] Request:', {
      url,
      model,
      messageCount: converted.length,
      systemLength: system.length,
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens ?? 4096,
    })

    let res: Response
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model,
          system: system || undefined,
          messages: converted,
          max_tokens: options?.maxTokens ?? 4096,
          temperature: options?.temperature ?? 0.7,
          stream: true,
        }),
      })
    } catch (fetchError) {
      console.error('[Anthropic Stream] fetch() threw:', {
        error: fetchError instanceof Error ? fetchError.message : fetchError,
        stack: fetchError instanceof Error ? fetchError.stack : undefined,
        url,
        cause: fetchError instanceof Error ? (fetchError as NodeJS.ErrnoException).cause : undefined,
      })
      throw new Error(`Anthropic API 连接失败: ${fetchError instanceof Error ? fetchError.message : '未知网络错误'}. URL: ${url}`)
    }

    console.log('[Anthropic Stream] Response:', {
      status: res.status,
      statusText: res.statusText,
      contentType: res.headers.get('content-type'),
    })

    if (!res.ok) {
      const text = await res.text()
      console.error('[Anthropic Stream] API error:', { status: res.status, body: text.slice(0, 500) })
      throw new Error(`Anthropic API error (${res.status}): ${text}`)
    }

    const reader = res.body?.getReader()
    if (!reader) throw new Error('No response body')

    const decoder = new TextDecoder()
    let buffer = ''
    let chunkCount = 0

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
          const json = JSON.parse(payload)
          if (json.type === 'content_block_delta') {
            const text = json.delta?.text
            if (text) {
              chunkCount++
              yield text
            }
          }
        } catch {
          console.warn('[Anthropic Stream] Malformed SSE payload:', payload.slice(0, 200))
        }
      }
    }
    console.log('[Anthropic Stream] Stream ended. Total chunks:', chunkCount)
  }

  return { chat, chatStream }
}
