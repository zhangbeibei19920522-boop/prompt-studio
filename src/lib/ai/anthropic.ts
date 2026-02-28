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
        stream: true,
      }),
    })

    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Anthropic API error (${res.status}): ${text}`)
    }

    const reader = res.body?.getReader()
    if (!reader) throw new Error('No response body')

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
          const json = JSON.parse(payload)
          if (json.type === 'content_block_delta') {
            const text = json.delta?.text
            if (text) yield text
          }
        } catch {
          // Skip
        }
      }
    }
  }

  return { chat, chatStream }
}
