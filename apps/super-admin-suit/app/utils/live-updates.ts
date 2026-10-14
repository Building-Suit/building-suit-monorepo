export const adminUpdateKinds = ['registry', 'activity', 'billing', 'offers', 'configuration'] as const
export type AdminUpdateKind = typeof adminUpdateKinds[number]
export interface AdminLiveScope { userId: string; authorityEnvironmentId: string; topic?: string }
export interface AdminLiveChannel {
  onInvalidate(callback: (payload: unknown) => void): void
  subscribe(callback: (status: string) => void): void
  close(): Promise<unknown>
}

/** Notifications invalidate authorized projections; they never carry record data. */
export function createAdminLiveUpdates(options: {
  channel(scope: AdminLiveScope): AdminLiveChannel
  authorize(): Promise<boolean>
  paused(): boolean
  refresh(kinds: readonly AdminUpdateKind[], isCurrent: () => boolean): Promise<void>
  delay?: number
}) {
  let scope: AdminLiveScope | null = null
  let revision = 0, disposed = false, running = false, connected = false
  let channel: AdminLiveChannel | null = null
  let setup = Promise.resolve()
  let timer: ReturnType<typeof setTimeout> | undefined
  const pending = new Set<AdminUpdateKind>()
  const seen = new Set<string>()
  const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i

  function schedule() {
    if (!scope || disposed || running || timer || !pending.size) return
    const expected = revision
    timer = setTimeout(async () => {
      timer = undefined
      const isCurrent = () => expected === revision && !disposed && !!scope
      if (!isCurrent()) return
      running = true
      let completed = false
      let batch: AdminUpdateKind[] = []
      try {
        // Recheck authority even when a dirty review defers data updates.
        if (!await options.authorize() || !isCurrent() || options.paused()) return
        batch = [...pending]
        pending.clear()
        await options.refresh(batch, isCurrent)
        completed = true
      } catch {
        if (isCurrent()) batch.forEach(kind => pending.add(kind))
      } finally {
        if (isCurrent()) {
          running = false
          // Failures/paused edits await a new event or explicit recovery; no loop.
          if (completed && pending.size) schedule()
        }
      }
    }, options.delay ?? 250)
  }
  function recover() {
    if (!scope || disposed) return
    adminUpdateKinds.forEach(kind => pending.add(kind))
    schedule()
  }
  function update(next: AdminLiveScope | null) {
    if (disposed) return setup
    if (next?.userId === scope?.userId && next?.authorityEnvironmentId === scope?.authorityEnvironmentId && next?.topic === scope?.topic) return setup
    scope = next ? { ...next } : null
    const expected = ++revision, previous = channel
    channel = null; connected = false; running = false
    clearTimeout(timer); timer = undefined; pending.clear(); seen.clear()
    setup = setup.catch(() => {}).then(async () => {
      if (previous) await previous.close().catch(() => {})
      if (expected !== revision || !scope || disposed) return
      const current = options.channel(scope)
      channel = current
      current.onInvalidate(value => {
        if (expected !== revision || !scope || disposed || !value || typeof value !== 'object') return
        const event = value as Record<string, unknown>
        if (event.authorityEnvironmentId !== scope.authorityEnvironmentId || typeof event.id !== 'string'
          || !uuid.test(event.id) || seen.has(event.id) || !Array.isArray(event.kinds)
          || !event.kinds.length || event.kinds.length > adminUpdateKinds.length
          || event.kinds.some(kind => !adminUpdateKinds.includes(kind as AdminUpdateKind))) return
        seen.add(event.id)
        if (seen.size > 512) seen.delete(seen.values().next().value!)
        event.kinds.forEach(kind => pending.add(kind as AdminUpdateKind))
        schedule()
      })
      current.subscribe(status => {
        if (expected !== revision || disposed) return
        if (status === 'SUBSCRIBED') {
          if (!connected) { connected = true; recover() }
        } else if (['CLOSED', 'CHANNEL_ERROR', 'TIMED_OUT'].includes(status)) connected = false
      })
    })
    return setup
  }
  async function dispose() {
    const cleanup = update(null)
    disposed = true
    await cleanup
  }
  return { update, recover, resume: schedule, dispose }
}
