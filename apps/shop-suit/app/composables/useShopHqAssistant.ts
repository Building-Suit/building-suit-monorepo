import type { ShopHqSaleSelection } from '#shared/shopHqSale'

type Selection = { shopId: string; locationId: string }
type Message = { role: 'user' | 'assistant'; content: string }
type Access = { enabled: boolean; agentName: string }
type Sale =
  | { kind: 'ready'; selection: ShopHqSaleSelection }
  | { kind: 'customer_missing' | 'customer_ambiguous' | 'service_missing' | 'service_ambiguous'; query: string; options: string[] }
type Result =
  | { state: 'queued' | 'working' | 'failed' | 'expired' | 'revoked' }
  | { state: 'completed'; text: string }
  | { state: 'completed'; sale: Sale }

const encode = new TextEncoder()

function waitForJob(signal: AbortSignal) {
  signal.throwIfAborted()
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', abort)
      resolve()
    }, 1_250)
    function abort() {
      clearTimeout(timer)
      reject(signal.reason)
    }
    signal.addEventListener('abort', abort, { once: true })
  })
}

export function useShopHqAssistant() {
  let retry: { payload: string; requestId: string; jobId?: string } | undefined

  function access(scope: Selection, signal: AbortSignal, enabled?: boolean) {
    return $fetch<Access>('/api/assistant/hq/access', {
      method: 'POST', body: { ...scope, enabled }, signal,
    })
  }

  async function send(scope: Selection, messages: Message[], signal: AbortSignal) {
    // Keep a contiguous recent window, with room for Unicode within the queue's byte limit.
    const bounded: Message[] = []
    for (const message of [...messages].reverse()) {
      if (encode.encode(message.content).length > 2_000) break
      bounded.unshift(message)
    }
    if (!bounded.length) throw new Error('Shop agent message is too large')
    const body = { ...scope, messages: bounded }
    const payload = JSON.stringify(body)
    if (retry?.payload !== payload) retry = { payload, requestId: crypto.randomUUID() }
    const request = retry

    if (!request.jobId) {
      const result = await $fetch<{ jobId: string }>('/api/assistant/hq/requests', {
        method: 'POST', body: { ...body, requestId: request.requestId }, signal,
      })
      request.jobId = result.jobId
    }

    const deadline = Date.now() + 125_000
    while (Date.now() < deadline) {
      const result = await $fetch<Result>('/api/assistant/hq/result', {
        method: 'POST', body: { ...scope, jobId: request.jobId }, signal,
      })
      if (result.state !== 'queued' && result.state !== 'working') {
        if (retry === request) retry = undefined
        return result
      }
      await waitForJob(signal)
    }
    throw new Error('Shop agent reply timed out')
  }

  function reset() {
    retry = undefined
  }

  return { access, send, reset }
}
