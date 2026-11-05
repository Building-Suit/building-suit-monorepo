export type HqLiveTopic = 'brain' | 'company' | 'access'
type ResetReason = 'scope' | 'offline'
interface Listener { refresh: () => unknown | Promise<unknown>; reset?: (reason: ResetReason) => void }
interface TopicQueue { listeners: Set<Listener>; running: boolean; dirty: boolean }

function createLiveEvents() {
  const topics: Record<HqLiveTopic, TopicQueue> = {
    brain: { listeners: new Set(), running: false, dirty: false },
    company: { listeners: new Set(), running: false, dirty: false },
    access: { listeners: new Set(), running: false, dirty: false },
  }
  let founder = false, mounted = false, consumers = 0, generation = 0, failures = 0
  let connection: AbortController | null = null
  let retry: ReturnType<typeof setTimeout> | null = null

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
    try {
      const response = await fetch('/api/hq/events', {
        headers: { 'X-HQ-Access': '1', 'X-HQ-Brain': '1', Accept: 'text/event-stream' },
        credentials: 'same-origin', cache: 'no-store', signal: request.signal,
      })
      if (response.status === 401 || response.status === 403) { needsAccess = true; return }
      if (!response.ok || !response.headers.get('content-type')?.toLowerCase().startsWith('text/event-stream') || !response.body) throw new Error('HQ live connection unavailable')
      reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = '', event = '', frameSize = 0, hasData = false, ready = false
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
                ready = true; failures = 0
                // The server has already validated founder access and joined
                // its private channel. This snapshot also covers missed events.
                invalidate('brain'); invalidate('company')
              }
              else if (event === 'brain' || event === 'company') invalidate(event)
              else if (event === 'access') { receivedAccess = true; stop(); invalidate('access') }
            }
            event = ''; frameSize = 0; hasData = false
          }
          else if (line.startsWith('event:')) event = line.slice(6).trim()
          else if (line.startsWith('data:')) hasData = true
          // Comments/heartbeats carry no invalidation and trigger no fetch.
        }
      }
    }
    catch { /* Transport recovery is separate from product data/error state. */ }
    finally {
      await reader?.cancel().catch(() => undefined)
      if (connection === request) connection = null
      if (request.signal.aborted || expected !== generation) return
      if (needsAccess) {
        reset('brain', 'scope'); reset('company', 'scope')
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
  function setFounder(value: boolean) {
    const previous = founder
    founder = value
    if (!value) {
      stop()
      if (previous) { reset('brain', 'scope'); reset('company', 'scope') }
      return
    }
    if (retry === null) void connect()
  }
  function resume() {
    if (!visibleOnline()) { stop(); return }
    // Visibility/online recovery revalidates identity once. A successfully
    // reopened stream then supplies one ready snapshot, without a fetch loop.
    invalidate('access')
    void connect()
  }
  function offline() {
    stop()
    founder = false
    reset('brain', 'offline'); reset('company', 'offline'); reset('access', 'offline')
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
  return { mount, acquire, release, subscribe, setFounder, invalidate }
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
  }
}
