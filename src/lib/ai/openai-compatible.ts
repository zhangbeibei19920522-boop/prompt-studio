import type { AiProvider, ChatMessage, ChatOptions } from '@/types/ai'
import { proxyFetch } from './proxy-fetch'

/**
 * Determine which token limit parameter to use.
 * Newer OpenAI models (gpt-4o, gpt-5, o1, o3, etc.) require max_completion_tokens.
 * Older/third-party models use max_tokens.
 */
function buildTokenLimit(model: string, maxTokens: number): Record<string, number> {
  const needsCompletionTokens = /^(gpt-4o|gpt-5|o1|o3|o4)/i.test(model)
  return needsCompletionTokens
    ? { max_completion_tokens: maxTokens }
    : { max_tokens: maxTokens }
}

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

    const res = await proxyFetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: options?.temperature ?? 0.7,
        ...buildTokenLimit(model, options?.maxTokens ?? 4096),
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

    console.log('[OpenAI Stream] Request:', {
      url,
      model,
      messageCount: messages.length,
      firstMsgRole: messages[0]?.role,
      temperature: options?.temperature ?? 0.7,
      ...buildTokenLimit(model, options?.maxTokens ?? 4096),
    })

    let res: Response
    try {
      res = await proxyFetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: options?.temperature ?? 0.7,
          ...buildTokenLimit(model, options?.maxTokens ?? 4096),
          stream: true,
        }),
      }) as Response
    } catch (fetchError) {
      console.error('[OpenAI Stream] fetch() threw:', {
        error: fetchError instanceof Error ? fetchError.message : fetchError,
        stack: fetchError instanceof Error ? fetchError.stack : undefined,
        url,
        cause: fetchError instanceof Error ? (fetchError as NodeJS.ErrnoException).cause : undefined,
      })
      throw new Error(`AI API 连接失败: ${fetchError instanceof Error ? fetchError.message : '未知网络错误'}. URL: ${url}`)
    }

    console.log('[OpenAI Stream] Response:', {
      status: res.status,
      statusText: res.statusText,
      contentType: res.headers.get('content-type'),
    })

    if (!res.ok) {
      const text = await res.text()
      console.error('[OpenAI Stream] API error:', { status: res.status, body: text.slice(0, 500) })
      throw new Error(`AI API error (${res.status}): ${text}`)
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
        if (payload === '[DONE]') {
          console.log('[OpenAI Stream] Done. Total chunks:', chunkCount)
          return
        }

        try {
          const json = JSON.parse(payload)
          const content = json.choices?.[0]?.delta?.content
          if (content) {
            chunkCount++
            yield content
          }
        } catch {
          console.warn('[OpenAI Stream] Malformed SSE payload:', payload.slice(0, 200))
        }
      }
    }
    console.log('[OpenAI Stream] Stream ended. Total chunks:', chunkCount)
  }

  return { chat, chatStream }
}
