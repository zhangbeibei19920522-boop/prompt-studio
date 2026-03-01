import type { AiProvider, AiProviderConfig } from '@/types/ai'
import { createOpenAiCompatibleProvider } from './openai-compatible'
import { createAnthropicProvider } from './anthropic'

/**
 * Known provider base URLs.
 */
const PROVIDER_DEFAULTS: Record<string, string> = {
  openai: 'https://api.openai.com/v1',
  kimi: 'https://api.moonshot.cn/v1',
  glm: 'https://open.bigmodel.cn/api/paas/v4',
  deepseek: 'https://api.deepseek.com/v1',
  qwen: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  claude: 'https://api.anthropic.com',
}

/**
 * Create an AI provider based on the configuration.
 * Claude uses the Anthropic API format, all others use OpenAI-compatible format.
 */
export function createAiProvider(config: AiProviderConfig): AiProvider {
  const provider = config.provider.toLowerCase()
  const baseUrl = config.baseUrl || PROVIDER_DEFAULTS[provider] || config.baseUrl

  console.log('[AI Provider] Creating provider:', {
    provider,
    model: config.model,
    baseUrl: baseUrl || '(default)',
    hasApiKey: !!config.apiKey,
    apiKeyPrefix: config.apiKey ? config.apiKey.slice(0, 8) + '...' : '(none)',
  })

  if (!config.apiKey) {
    console.error('[AI Provider] API Key 未配置')
    throw new Error('API Key 未配置')
  }

  if (provider === 'claude') {
    console.log('[AI Provider] Using Anthropic provider')
    return createAnthropicProvider({
      apiKey: config.apiKey,
      model: config.model,
      baseUrl,
    })
  }

  const finalBaseUrl = baseUrl || 'https://api.openai.com/v1'
  console.log('[AI Provider] Using OpenAI-compatible provider, baseUrl:', finalBaseUrl)
  return createOpenAiCompatibleProvider({
    apiKey: config.apiKey,
    model: config.model,
    baseUrl: finalBaseUrl,
  })
}

export { PROVIDER_DEFAULTS }
