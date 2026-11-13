type Selection = { shopId: string; locationId: string }
type Message = { role: 'user' | 'assistant'; content: string }
type Access = { enabled: boolean; agentName: string }
type Clarification =
  | { kind: 'customer_missing' | 'customer_ambiguous' | 'service_missing' | 'service_ambiguous'; query: string }
  | { kind: 'cash_shift_required' | 'sale_unavailable' | 'sale_details_required' }
  | { kind: 'payment_missing'; total?: number; currency?: string }
  | { kind: 'amount_mismatch'; total: number; currency: string }
type Update =
  | { sequence: number; kind: 'reply'; text: string }
  | { sequence: number; kind: 'receipt'; invoiceId: string }
  | { sequence: number; kind: 'clarification'; outcome: Clarification }
type Result = {
  state: 'queued' | 'working' | 'completed' | 'failed' | 'expired' | 'revoked'
  reviewPending: boolean
  updates: Update[]
}
type Turn = Result & { jobId: string; requestId: string; ownerMessage: string | null }
type Client = ReturnType<typeof useSupabaseClient>
type Channel = ReturnType<Client['channel']>

const encode = new TextEncoder()
const needsUpdates = (turn: Result) => turn.state === 'queued' || turn.state === 'working' || turn.reviewPending

export function useShopHqAssistant() {
  const client = useSupabaseClient()
  const turns = shallowRef<Turn[]>([])
  const waiting = computed(() => turns.value.some(turn => turn.state === 'queued' || turn.state === 'working'))
  let retry: { payload: string; requestId: string } | undefined
  let active: { scope: Selection; controller: AbortController } | undefined
  const subscriptions = new Map<string, { channel: Channel; refresh: () => void; timer?: ReturnType<typeof setTimeout> }>()

  function access(scope: Selection, signal: AbortSignal, enabled?: boolean) {
    return $fetch<Access>('/api/assistant/hq/access', {
      method: 'POST', body: { ...scope, enabled }, signal, timeout: 10_000,
    })
  }

  function remove(jobId: string) {
    const entry = subscriptions.get(jobId)
    if (!entry) return
    subscriptions.delete(jobId)
    clearTimeout(entry.timer)
    void client.removeChannel(entry.channel).catch(() => {})
  }

  function apply(turn: Turn) {
    const existing = turns.value.findIndex(item => item.jobId === turn.jobId)
    if (existing === -1) {
      const items = [...turns.value, turn]
      for (const discarded of items.slice(0, -24)) remove(discarded.jobId)
      turns.value = items.slice(-24)
    }
    else turns.value = turns.value.map(item => item.jobId === turn.jobId ? turn : item)
    if (!needsUpdates(turn)) remove(turn.jobId)
  }

  function follow(turn: Turn) {
    if (!active || subscriptions.has(turn.jobId) || !needsUpdates(turn)) return
    const binding = active
    const channel = client.channel(`shop-hq-assistant-owner:${turn.jobId}`, { config: { private: true } })
    let inFlight = false
    let dirty = false
    let ready = false
    const fallbackUntil = Date.now() + 425_000
    const entry = { channel, refresh, timer: undefined as ReturnType<typeof setTimeout> | undefined }
    subscriptions.set(turn.jobId, entry)

    function fallback() {
      clearTimeout(entry.timer)
      if (!ready && Date.now() < fallbackUntil && subscriptions.get(turn.jobId) === entry) {
        entry.timer = setTimeout(refresh, 5_000)
      }
    }

    async function read() {
      if (active !== binding || subscriptions.get(turn.jobId) !== entry || inFlight) return
      inFlight = true
      try {
        do {
          dirty = false
          const result = await $fetch<Result>('/api/assistant/hq/result', {
            method: 'POST', body: { ...binding.scope, jobId: turn.jobId },
            signal: binding.controller.signal, timeout: 10_000,
          })
          if (active === binding && subscriptions.get(turn.jobId) === entry) apply({ ...turn, ...result })
        } while (dirty && active === binding && subscriptions.get(turn.jobId) === entry)
      } catch (error) {
        if ((error as { statusCode?: number })?.statusCode === 403 && active === binding) {
          apply({ ...turn, ownerMessage: null, state: 'revoked', updates: [], reviewPending: false })
        }
      } finally {
        inFlight = false
        fallback()
      }
    }

    function refresh() {
      dirty = true
      void read()
    }

    channel.on('broadcast', { event: 'reply' }, refresh).subscribe(status => {
      if (subscriptions.get(turn.jobId) !== entry) return
      ready = status === 'SUBSCRIBED'
      refresh()
    })
    // Read once even if the socket cannot connect. A successful join reads
    // again, covering a reply committed between this read and channel join.
    refresh()
  }

  async function bind(scope: Selection, restore: boolean) {
    if (!import.meta.client) return
    reset()
    const binding = { scope, controller: new AbortController() }
    active = binding
    if (!restore) return
    const history = await $fetch<Turn[]>('/api/assistant/hq/recent', {
      method: 'POST', body: scope, signal: binding.controller.signal, timeout: 10_000,
    })
    if (active !== binding) return
    for (const turn of history) {
      if (turns.value.some(item => item.jobId === turn.jobId)) continue
      apply(turn)
      follow(turn)
    }
  }

  async function send(scope: Selection, messages: Message[], signal: AbortSignal) {
    const binding = active
    if (!binding || binding.scope.shopId !== scope.shopId || binding.scope.locationId !== scope.locationId) return
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
    const { jobId } = await $fetch<{ jobId: string }>('/api/assistant/hq/requests', {
      method: 'POST', body: { ...body, requestId: request.requestId }, signal, timeout: 10_000,
    })
    if (active !== binding || signal.aborted) return
    retry = undefined
    const turn: Turn = {
      jobId, requestId: request.requestId, ownerMessage: bounded.at(-1)!.content,
      state: 'queued', reviewPending: false, updates: [],
    }
    if (!turns.value.some(item => item.jobId === jobId)) {
      apply(turn)
      follow(turn)
    }
  }

  function reset() {
    active?.controller.abort()
    active = undefined
    for (const jobId of subscriptions.keys()) remove(jobId)
    turns.value = []
    retry = undefined
  }

  function refresh() {
    for (const entry of subscriptions.values()) entry.refresh()
  }

  onMounted(() => {
    window.addEventListener('online', refresh)
    window.addEventListener('focus', refresh)
  })
  onScopeDispose(() => {
    if (import.meta.client) {
      window.removeEventListener('online', refresh)
      window.removeEventListener('focus', refresh)
    }
    reset()
  })

  return { access, bind, send, reset, turns, waiting }
}
