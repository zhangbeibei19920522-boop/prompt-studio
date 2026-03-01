/**
 * Proxy-aware fetch for server-side AI API calls.
 * Reads HTTP_PROXY / HTTPS_PROXY / ALL_PROXY from environment.
 * Falls back to global fetch when no proxy is configured.
 */

let _proxyFetch: typeof globalThis.fetch | null = null
let _proxyUrl: string | null = null

function getProxyUrl(): string | null {
  return (
    process.env.HTTPS_PROXY ||
    process.env.HTTP_PROXY ||
    process.env.https_proxy ||
    process.env.http_proxy ||
    process.env.ALL_PROXY ||
    process.env.all_proxy ||
    null
  )
}

export async function proxyFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const proxyUrl = getProxyUrl()

  // No proxy configured — use global fetch
  if (!proxyUrl) {
    return globalThis.fetch(input, init)
  }

  // Reuse cached dispatcher if proxy URL hasn't changed
  if (_proxyFetch && _proxyUrl === proxyUrl) {
    return _proxyFetch(input, init)
  }

  // Create proxy dispatcher via undici
  try {
    const { ProxyAgent, fetch: undiciFetch } = await import('undici')
    const dispatcher = new ProxyAgent(proxyUrl)

    // undici fetch with proxy dispatcher
    const pf = (i: RequestInfo | URL, o?: RequestInit) =>
      undiciFetch(i as Parameters<typeof undiciFetch>[0], {
        ...(o as Parameters<typeof undiciFetch>[1]),
        dispatcher,
      } as Parameters<typeof undiciFetch>[1])

    _proxyFetch = pf as unknown as typeof globalThis.fetch
    _proxyUrl = proxyUrl

    console.log('[ProxyFetch] Using proxy:', proxyUrl)
    return pf(input, init) as unknown as Response
  } catch (err) {
    console.warn('[ProxyFetch] Failed to create proxy agent, falling back to global fetch:', err)
    return globalThis.fetch(input, init)
  }
}
