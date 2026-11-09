export type HqLiveTopic = 'brain' | 'company' | 'agents' | 'access'
export type HqActivityTopic = Exclude<HqLiveTopic, 'access'>
export interface HqLivePresence { observedAt: string; agentId: string | null; taskId: string | null }
type ResetReason = 'scope' | 'offline'
interface Listener { refresh: () => unknown | Promise<unknown>; reset?: (reason: ResetReason) => void }
interface TopicQueue { listeners: Set<Listener>; running: boolean; dirty: boolean }

function createLiveEvents() {
  const topics: Record<HqLiveTopic, TopicQueue> = {
    brain: { listeners: new Set(), running: false, dirty: false },
    company: { listeners: new Set(), running: false, dirty: false },
    agents: { listeners: new Set(), running: false, dirty: false },
    access: { listeners: new Set(), running: false, dirty: false },
  }
  let founder = false, mounted = false, consumers = 0, generation = 0, failures = 0
  let connection: AbortController | null = null
  let retry: ReturnType<typeof setTimeout> | null = null
  let resuming: Promise<void> | null = null
  const activityListeners = new Set<(topic: HqActivityTopic) => void>()
  const presenceListeners = new Set<(value: HqLivePresence) => void>()

  const visibleOnline = () => mounted && !document.hidden && navigator.onLine
  const allowed = (topic: HqLiveTopic) => visibleOnline() && (topic === 'access' || founder)

  function invalidate(topic: HqLiveTopic) {
    const queue = topics[topic]
    queue.dirty = true
    if (queue.running || !allowed(topic)) return
    queue.running = true
    void Promise.resolve().then(async () => {
      // One active refresh and one dirty bit per topic coalesce bursts while
      // retaining changes arriving during the current snapshot request.
      while (queue.dirty && allowed(topic) && queue.listeners.size) {
        queue.dirty = false
        await Promise.allSettled([...queue.listeners].map(listener => Promise.resolve().then(listener.refresh)))
      }
    }).finally(() => {
      queue.running = false
      if (queue.dirty && allowed(topic) && queue.listeners.size) invalidate(topic)
    })
  }
  function reset(topic: HqLiveTopic, reason: ResetReason) {
    topics[topic].dirty = false
    for (const listener of topics[topic].listeners) listener.reset?.(reason)
  }
  function readySnapshot() {
    const queues = (['brain', 'company', 'agents'] as const).filter(topic => allowed(topic) && topics[topic].listeners.size)
    const selected = queues.filter(topic => !topics[topic].running)
    for (const topic of queues) topics[topic].dirty = true
    for (const topic of selected) topics[topic].running = true
    void Promise.resolve().then(async () => {
      const callbacks = new Set<Listener['refresh']>()
      for (const topic of selected) {
        if (!allowed(topic)) continue
        topics[topic].dirty = false
        for (const listener of topics[topic].listeners) callbacks.add(listener.refresh)
      }
      await Promise.allSettled([...callbacks].map(refresh => Promise.resolve().then(refresh)))
    }).finally(() => {
      for (const topic of selected) {
        topics[topic].running = false
        if (topics[topic].dirty && allowed(topic)) invalidate(topic)
      }
    })
  }
  function notifyPresence(data: string) {
    let value: unknown
    try { value = JSON.parse(data) } catch { return }
    if (!value || typeof value !== 'object' || Array.isArray(value)) return
    const entry = value as Record<string, unknown>
    if (Object.keys(entry).length !== 3 || typeof entry.observedAt !== 'string' || entry.observedAt.length > 64
      || !Number.isFinite(Date.parse(entry.observedAt)) || Date.parse(entry.observedAt) > Date.now() + 300_000
      || Date.parse(entry.observedAt) + 150_000 <= Date.now()
      || !(entry.agentId === null || typeof entry.agentId === 'string' && /^AG-[A-Z]+-[0-9]{3}$/.test(entry.agentId))
      || !(entry.taskId === null || typeof entry.taskId === 'string' && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(entry.taskId))
      || (entry.agentId === null) !== (entry.taskId === null)) return
    for (const listener of presenceListeners) {
      try { listener(entry as unknown as HqLivePresence) } catch { /* A display subscriber cannot restart the transport. */ }
    }
  }
  function stop() {
    generation += 1
    connection?.abort()
    connection = null
    if (retry !== null) clearTimeout(retry)
    retry = null
  }
  function reconnectAfterFailure() {
    if (!founder || !visibleOnline() || retry !== null) return
    // This one-shot timer reconnects a failed transport only. No data reads
    // recur on a timer; snapshots follow stream readiness or invalidations.
    retry = setTimeout(() => {
      retry = null
      void connect()
    }, Math.min(30_000, 1_000 * 2 ** Math.min(failures++, 5)))
  }
  async function connect() {
    if (!founder || !visibleOnline() || connection) return
    const request = new AbortController(), expected = generation
    connection = request
    let reader: ReadableStreamDefaultReader<Uint8Array> | null = null
    let needsAccess = false, receivedAccess = false
    let readyAt: number | null = null
    try {
      const response = await fetch('/api/hq/events', {
        headers: { 'X-HQ-Access': '1', 'X-HQ-Brain': '1', Accept: 'text/event-stream' },
        credentials: 'same-origin', cache: 'no-store', signal: request.signal,
      })
      if (response.status === 401 || response.status === 403) { needsAccess = true; return }
      if (!response.ok || !response.headers.get('content-type')?.toLowerCase().startsWith('text/event-stream') || !response.body) throw new Error('HQ live connection unavailable')
      reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = '', event = '', frameSize = 0, hasData = false, ready = false, data = ''
      while (!request.signal.aborted) {
        const chunk = await reader.read()
        if (chunk.done) throw new Error('HQ live connection ended')
        buffer += decoder.decode(chunk.value, { stream: true })
        if (buffer.length > 65_536) throw new Error('HQ live frame limit')
        let lineEnd: number
        while ((lineEnd = buffer.indexOf('\n')) >= 0) {
          let line = buffer.slice(0, lineEnd)
          buffer = buffer.slice(lineEnd + 1)
          if (line.endsWith('\r')) line = line.slice(0, -1)
          frameSize += line.length
          if (frameSize > 65_536) throw new Error('HQ live frame limit')
          if (!line) {
            if (hasData && expected === generation && founder && visibleOnline()) {
              if (event === 'ready' && !ready) {
                ready = true; readyAt = Date.now()
                // The server has already validated founder access and joined
                // its private channel. This snapshot also covers missed events.
                readySnapshot()
              }
              else if (event === 'presence' && ready) notifyPresence(data)
              else if (event === 'brain' || event === 'company' || event === 'agents') {
                invalidate(event)
                if (ready) {
                  for (const listener of activityListeners) {
                    try { listener(event) } catch { /* Display errors do not restart the stream. */ }
                  }
                }
              }
              else if (event === 'access') { receivedAccess = true; stop(); invalidate('access') }
            }
            event = ''; frameSize = 0; hasData = false; data = ''
          }
          else if (line.startsWith('event:')) event = line.slice(6).trim()
          else if (line.startsWith('data:')) { hasData = true; data += `${data ? '\n' : ''}${line.slice(5).trimStart()}` }
          // Comments/heartbeats carry no invalidation and trigger no fetch.
        }
      }
    }
    catch { /* Transport recovery is separate from product data/error state. */ }
    finally {
      await reader?.cancel().catch(() => undefined)
      if (connection === request) connection = null
      if (!request.signal.aborted && expected === generation) {
        // A server that repeatedly joins then closes must not reset recovery to
        // a one-second loop. Only a sustained connection earns a fresh budget.
        if (readyAt !== null && Date.now() - readyAt >= 30_000) failures = 0
        if (needsAccess) {
          reset('brain', 'scope'); reset('company', 'scope'); reset('agents', 'scope')
          // Repeated transport denial must not create a rapid access/read loop
          // when an upstream configuration error still reports founder access.
          retry = setTimeout(() => {
            retry = null
            invalidate('access')
          }, Math.min(30_000, 1_000 * 2 ** Math.min(failures++, 5)))
        }
        else if (!receivedAccess) reconnectAfterFailure()
      }
    }
  }
  function setFounder(value: boolean) {
    const previous = founder
    founder = value
    if (!value) {
      stop()
      if (previous) { reset('brain', 'scope'); reset('company', 'scope'); reset('agents', 'scope') }
      return
    }
    if (retry === null && !resuming) void connect()
  }
  function resume() {
    if (!visibleOnline()) { stop(); return }
    if (resuming) return
    // Revalidate once before reopening. setFounder must not connect with a
    // previous identity while this check is still in flight.
    const task = Promise.resolve().then(async () => {
      await Promise.allSettled([...topics.access.listeners].map(listener => Promise.resolve().then(listener.refresh)))
    }).finally(() => {
      if (resuming === task) resuming = null
      if (visibleOnline() && founder) void connect()
    })
    resuming = task
  }
  function offline() {
    stop()
    founder = false
    reset('brain', 'offline'); reset('company', 'offline'); reset('agents', 'offline'); reset('access', 'offline')
  }
  function mount() {
    if (mounted) return
    mounted = true
    document.addEventListener('visibilitychange', resume)
    window.addEventListener('online', resume)
    window.addEventListener('offline', offline)
    void connect()
  }
  function acquire() { consumers += 1 }
  function release() {
    consumers -= 1
    if (consumers > 0) return false
    stop(); founder = false
    if (mounted) {
      document.removeEventListener('visibilitychange', resume)
      window.removeEventListener('online', resume)
      window.removeEventListener('offline', offline)
    }
    mounted = false
    return true
  }
  function subscribe(topic: HqLiveTopic, refresh: Listener['refresh'], clear?: Listener['reset']) {
    const listener: Listener = { refresh, reset: clear }
    topics[topic].listeners.add(listener)
    return () => { topics[topic].listeners.delete(listener) }
  }
  function subscribePresence(listener: (value: HqLivePresence) => void) {
    presenceListeners.add(listener)
    return () => { presenceListeners.delete(listener) }
  }
  function subscribeActivity(listener: (topic: HqActivityTopic) => void) {
    activityListeners.add(listener)
    return () => { activityListeners.delete(listener) }
  }
  return { mount, acquire, release, subscribe, subscribePresence, subscribeActivity, setFounder, invalidate }
}

// Nuxt creates one app per SSR request and one per browser tab. Weak keys keep
// transport/identity state isolated to that app and out of hydrated payloads.
const liveApps = new WeakMap<object, ReturnType<typeof createLiveEvents>>()

export function useHqLiveEvents() {
  const app = useNuxtApp()
  let hub = liveApps.get(app)
  if (!hub) { hub = createLiveEvents(); liveApps.set(app, hub) }
  const events = hub
  events.acquire()
  const subscriptions: (() => void)[] = []
  onMounted(events.mount)
  onScopeDispose(() => {
    for (const unsubscribe of subscriptions) unsubscribe()
    if (events.release()) liveApps.delete(app)
  })
  return {
    setFounder: events.setFounder,
    invalidate: events.invalidate,
    subscribe(topic: HqLiveTopic, refresh: Listener['refresh'], clear?: Listener['reset']) {
      const unsubscribe = events.subscribe(topic, refresh, clear)
      subscriptions.push(unsubscribe)
      return unsubscribe
    },
    subscribeActivity(listener: (topic: HqActivityTopic) => void) {
      const unsubscribe = events.subscribeActivity(listener)
      subscriptions.push(unsubscribe)
      return unsubscribe
    },
    subscribePresence(listener: (value: HqLivePresence) => void) {
      const unsubscribe = events.subscribePresence(listener)
      subscriptions.push(unsubscribe)
      return unsubscribe
    },
  }
}
