import type { AiProvider, ChatMessage, ChatOptions } from '@/types/ai'

/**
 * OpenAI-compatible provider.
 * Works with: OpenAI, Kimi, GLM, DeepSeek, Qwen, and any OpenAI-compatible API.
 */
export function createOpenAiCompatibleProvider(config: {
  apiKey: string
  model: string
  baseUrl: string
}): AiProvider {
  const { apiKey, model, baseUrl } = config

  async function chat(
    messages: ChatMessage[],
    options?: ChatOptions
  ): Promise<string> {
    const url = `${baseUrl.replace(/\/+$/, '')}/chat/completions`

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.maxTokens ?? 4096,
        stream: false,
      }),
    })

    if (!res.ok) {
      const text = await res.text()
      throw new Error(`AI API error (${res.status}): ${text}`)
    }

    const data = await res.json()
    return data.choices?.[0]?.message?.content ?? ''
  }

  async function* chatStream(
    messages: ChatMessage[],
    options?: ChatOptions
  ): AsyncGenerator<string> {
    const url = `${baseUrl.replace(/\/+$/, '')}/chat/completions`

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.maxTokens ?? 4096,
        stream: true,
      }),
    })

    if (!res.ok) {
      const text = await res.text()
      throw new Error(`AI API error (${res.status}): ${text}`)
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
        if (payload === '[DONE]') return

        try {
          const json = JSON.parse(payload)
          const content = json.choices?.[0]?.delta?.content
          if (content) yield content
        } catch {
          // Skip malformed JSON
        }
      }
    }
  }

  return { chat, chatStream }
}
