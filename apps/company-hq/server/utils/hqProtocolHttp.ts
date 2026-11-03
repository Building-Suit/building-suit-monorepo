import { HqProblem } from './hqDomain'
import { requireWorkflow } from './hqWorkflow'

/** Injected transport only: no credentials, fetch default, retries or fallback host. */
export type ProtocolTransport = (url: string, init: RequestInit) => Promise<Response>
export async function protocolDeadline<T>(parent: AbortSignal, ms: number, operation: (signal: AbortSignal, check: () => void) => Promise<T>): Promise<T> {
  requireWorkflow(Number.isSafeInteger(ms) && ms >= 50 && ms <= 180_000, 'PROTOCOL_DEADLINE_INVALID')
  const controller = new AbortController(), until = performance.now() + ms
  const abort = () => controller.abort(new HqProblem(409, 'PROTOCOL_CANCELLED', 'Protocol cancelled.'))
  const check = () => { controller.signal.throwIfAborted(); requireWorkflow(performance.now() < until, 'PROTOCOL_TIMEOUT') }
  parent.addEventListener('abort', abort, { once: true }); if (parent.aborted) abort()
  const timer = setTimeout(() => controller.abort(new HqProblem(409, 'PROTOCOL_TIMEOUT', 'Protocol timed out.')), ms)
  let listener: (() => void) | undefined
  try {
    check()
    const aborted = new Promise<never>((_, reject) => {
      listener = () => reject(controller.signal.reason)
      controller.signal.addEventListener('abort', listener, { once: true })
    })
    const result = await Promise.race([aborted, Promise.resolve().then(() => { check(); return operation(controller.signal, check) })])
    check(); return result
  } finally {
    if (listener) controller.signal.removeEventListener('abort', listener)
    clearTimeout(timer); parent.removeEventListener('abort', abort); controller.abort()
  }
}
export async function protocolText(transport: ProtocolTransport, url: string, init: RequestInit, maxBytes: number, check: () => void) {
  check()
  const response = await transport(url, { ...init, redirect: 'error', cache: 'no-store', credentials: 'omit' })
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined
  const chunks: Uint8Array[] = []; let bytes = 0, done = false, cancelled = false
  // Own cleanup immediately after transport, including late or rejected responses.
  // Never await cancellation: an uncooperative body must not delay rejection.
  const cancel = () => {
    if (done || cancelled) return
    cancelled = true
    try { void (reader ? reader.cancel() : response.body?.cancel())?.catch(() => {}) }
    catch { /* Cleanup must not replace the original protocol failure. */ }
  }
  try {
    check()
    requireWorkflow(!response.redirected && (!response.url || response.url === url), 'PROTOCOL_REDIRECT')
    if (!response.ok) throw new HqProblem(409, `PROTOCOL_HTTP_${response.status}`, 'Protocol request refused.')
    const length = response.headers.get('content-length')
    if (length !== null && (!/^\d+$/.test(length) || Number(length) > maxBytes)) {
      throw new HqProblem(409, 'PROTOCOL_BODY_LIMIT', 'Protocol body exceeds its bound.')
    }
    requireWorkflow(response.body, 'PROTOCOL_BODY_MISSING')
    reader = response.body.getReader()
    init.signal?.addEventListener('abort', cancel, { once: true })
    while (true) {
      check()
      const item = await reader.read(); check()
      if (item.done) { done = true; break }
      bytes += item.value.byteLength
      requireWorkflow(bytes <= maxBytes, 'PROTOCOL_BODY_LIMIT'); chunks.push(item.value)
    }
    return new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks))
  } finally {
    init.signal?.removeEventListener('abort', cancel)
    cancel()
  }
}
