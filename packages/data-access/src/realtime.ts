import type { RealtimeFilter, RealtimeRefreshRequest, RealtimeScope } from '@building-suit/contracts'

/** Structural subset of the Supabase client; no global client or product schema. */
export interface RealtimeChannel {
  on(type: 'postgres_changes', filter: RealtimeFilter, callback: () => void): unknown
  subscribe(callback: (status: string) => void): unknown
}
export interface RealtimeClient<C extends RealtimeChannel> {
  channel(name: string): C
  removeChannel(channel: C): Promise<string>
}
export interface RealtimeBinding {
  scope: RealtimeScope
  filters: readonly RealtimeFilter[]
  dataKeys: readonly string[]
  refresh(request: RealtimeRefreshRequest): void | Promise<void>
  onError?(kind: 'subscription' | 'refresh' | 'cleanup' | 'setup'): void
}

/** One controller per mounted feature. Call update(null) on logout and dispose on unmount. */
export function createScopedRealtime<C extends RealtimeChannel>(
  client: RealtimeClient<C>,
  options: { refreshIntervalMs?: number } = {},
) {
  const interval = options.refreshIntervalMs ?? 250
  if (!Number.isFinite(interval) || interval < 1) throw new Error('refreshIntervalMs must be positive')
  // Opaque names keep session/context details out of channel names and logs.
  const owner = globalThis.crypto.randomUUID()
  let revision = 0
  let disposed = false
  let identity: string | null = null
  let binding: RealtimeBinding | null = null
  let channel: C | null = null
  let queue: Promise<void> = Promise.resolve()
  let abort = new AbortController()
  let timer: ReturnType<typeof setTimeout> | undefined
  let running = false
  let pending = false
  let connected = false
  let subscriptionError = false

  function report(target: RealtimeBinding | null, kind: Parameters<NonNullable<RealtimeBinding['onError']>>[0]) {
    // Observers must not break cleanup or cause unhandled callback rejections.
    try { target?.onError?.(kind) } catch { /* observer owns its error */ }
  }

  function schedule(expected: number) {
    if (expected !== revision || !binding || disposed) return
    pending = true
    if (timer !== undefined || running) return
    timer = setTimeout(async () => {
      timer = undefined
      if (expected !== revision || !binding || disposed) return
      pending = false
      running = true
      const target = binding
      const signal = abort.signal
      const isCurrent = () => expected === revision && !signal.aborted && !disposed
      try {
        await target.refresh({ scope: target.scope, dataKeys: target.dataKeys, signal, isCurrent })
      } catch {
        if (isCurrent()) report(target, 'refresh')
      } finally {
        // An obsolete refresh cannot change the next context's scheduler.
        if (isCurrent()) {
          running = false
          if (pending) schedule(expected)
        }
      }
    }, interval)
  }

  function update(next: RealtimeBinding | null): Promise<void> {
    if (disposed) return Promise.reject(new Error('Realtime controller is disposed'))
    // Snapshot inputs: callers may reuse and mutate their reactive scope/filter objects.
    const snapshot = next && {
      ...next, scope: Object.freeze({ ...next.scope }),
      filters: next.filters.map(filter => ({ ...filter })),
      dataKeys: Object.freeze([...new Set(next.dataKeys)]),
    }
    if (snapshot && (!snapshot.filters.length ||
      snapshot.filters.some(f => !f.schema || !f.table || !['*', 'INSERT', 'UPDATE', 'DELETE'].includes(f.event)) ||
      (snapshot.scope.locationId !== null && typeof snapshot.scope.locationId !== 'string') ||
      ['environment', 'portal', 'userId', 'tenantId', 'sessionId', 'contextKey'].some(key =>
        !snapshot.scope[key as keyof RealtimeScope]))) {
      return Promise.reject(new Error('Realtime requires an authenticated scope and explicit filters'))
    }
    const key = snapshot && JSON.stringify([
      snapshot.scope.environment, snapshot.scope.portal, snapshot.scope.userId, snapshot.scope.tenantId,
      snapshot.scope.sessionId, snapshot.scope.locationId, snapshot.scope.contextKey,
      snapshot.filters.map(f => [f.schema, f.table, f.event, f.filter ?? null]), snapshot.dataKeys,
    ])
    if (key === identity && (key !== null || channel === null)) {
      binding = snapshot
      return queue
    }
    const previous = binding
    binding = snapshot
    identity = key
    const expected = ++revision
    abort.abort()
    abort = new AbortController()
    if (timer !== undefined) clearTimeout(timer)
    timer = undefined
    pending = running = connected = subscriptionError = false
    queue = queue.catch(() => {}).then(async () => {
      if (channel) {
        try {
          const result = await client.removeChannel(channel)
          if (result !== 'ok') throw new Error('Realtime cleanup failed')
          channel = null
        } catch (error) {
          report(previous, 'cleanup')
          identity = null // permit explicit retry; never create a replacement before cleanup
          throw error
        }
      }
      if (expected !== revision || !snapshot || disposed) return
      try {
        channel = client.channel(`bs-realtime:${owner}:${expected}`)
        const unique = new Set<string>()
        for (const filter of snapshot.filters) {
          const filterKey = JSON.stringify([filter.schema, filter.table, filter.event, filter.filter ?? null])
          if (unique.has(filterKey)) continue
          unique.add(filterKey)
          channel.on('postgres_changes', filter, () => schedule(expected))
        }
        channel.subscribe(status => {
          if (expected !== revision || disposed) return
          if (status === 'SUBSCRIBED') {
            connected = true
            // Initial join and SDK reconnects reconcile any missed changes through the same throttle.
            schedule(expected)
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
            connected = false
            if (!subscriptionError) report(binding, 'subscription')
            subscriptionError = true
          }
        })
      } catch (error) {
        identity = null
        ++revision
        abort.abort()
        if (timer !== undefined) clearTimeout(timer)
        timer = undefined
        pending = running = connected = false
        report(snapshot, 'setup')
        throw error
      }
    })
    return queue
  }

  async function dispose() {
    if (disposed) return queue
    const cleanup = update(null)
    disposed = true
    await cleanup
  }

  return { update, dispose, get connected() { return connected } }
}
