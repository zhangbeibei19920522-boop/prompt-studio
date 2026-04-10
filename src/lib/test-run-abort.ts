export const TEST_RUN_ABORT_MESSAGE = '用户已停止测试'

export function createAbortError(message = TEST_RUN_ABORT_MESSAGE): Error {
  const error = new Error(message)
  error.name = 'AbortError'
  return error
}

function getAbortReason(signal?: AbortSignal): string {
  const reason = signal?.reason
  if (reason instanceof Error && reason.message) {
    return reason.message
  }
  if (typeof reason === 'string' && reason.trim()) {
    return reason
  }
  return TEST_RUN_ABORT_MESSAGE
}

export function throwIfAborted(signal?: AbortSignal): void {
  if (!signal?.aborted) return
  throw createAbortError(getAbortReason(signal))
}

export function isAbortError(error: unknown): boolean {
  if (typeof DOMException !== 'undefined' && error instanceof DOMException) {
    return error.name === 'AbortError'
  }
  if (error instanceof Error) {
    return error.name === 'AbortError'
  }
  return (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    (error as { name?: string }).name === 'AbortError'
  )
}
