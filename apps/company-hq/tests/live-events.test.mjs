/** Per-tab live hub fixtures: no HTTP, hosted writes or inference. */
import test from 'node:test'
import assert from 'node:assert/strict'
import { useHqLiveEvents } from '../app/composables/useHqLiveEvents.ts'

const flush = async () => {
  for (let index = 0; index < 30; index++) await Promise.resolve()
}
const deferred = () => {
  let resolve
  const promise = new Promise(done => { resolve = done })
  return { promise, resolve }
}
const frame = (event, data = {}) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`

class BrowserTarget extends EventTarget {
  listeners = new Map()
  addEventListener(type, callback, options) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set())
    this.listeners.get(type).add(callback)
    super.addEventListener(type, callback, options)
  }
  removeEventListener(type, callback, options) {
    this.listeners.get(type)?.delete(callback)
    super.removeEventListener(type, callback, options)
  }
  get listenerCount() {
    return [...this.listeners.values()].reduce((sum, callbacks) => sum + callbacks.size, 0)
  }
}

function fixture(t, { abortTransport = true } = {}) {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: Date.parse('2026-11-05T19:00:00Z') })
  const document = Object.assign(new BrowserTarget(), { hidden: false })
  const window = new BrowserTarget()
  const navigator = { onLine: true }
  const app = {}, scopes = [], requests = []
  let activeScope
  const globals = {
    document, window, navigator,
    useNuxtApp: () => app,
    onMounted: callback => activeScope.mounts.push(callback),
    onScopeDispose: callback => activeScope.disposers.push(callback),
    fetch: async (url, options) => {
      assert.equal(url, '/api/hq/events')
      let controller, ended = false
      const stream = new ReadableStream({
        start(value) { controller = value },
        cancel() { ended = true },
      })
      const request = {
        url, options,
        send(value) {
          assert.equal(ended, false, 'fixture stream is still readable')
          controller.enqueue(new TextEncoder().encode(value))
        },
        close() {
          if (ended) return
          ended = true
          controller.close()
        },
      }
      if (abortTransport) options.signal.addEventListener('abort', () => {
        if (ended) return
        ended = true
        controller.error(new DOMException('Aborted', 'AbortError'))
      }, { once: true })
      requests.push(request)
      return new Response(stream, { headers: { 'content-type': 'text/event-stream' } })
    },
  }
  const descriptors = new Map()
  for (const [key, value] of Object.entries(globals)) {
    descriptors.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
  }
  function client() {
    const scope = { mounts: [], disposers: [], disposed: false }
    scopes.push(scope)
    activeScope = scope
    const live = useHqLiveEvents()
    activeScope = undefined
    return {
      live,
      mount() { for (const callback of scope.mounts) callback() },
      dispose() {
        if (scope.disposed) return
        scope.disposed = true
        for (const callback of scope.disposers) callback()
      },
    }
  }
  t.after(async () => {
    for (const scope of scopes) {
      if (scope.disposed) continue
      scope.disposed = true
      for (const callback of scope.disposers) callback()
    }
    for (const request of requests) request.close()
    await flush()
    for (const [key, descriptor] of descriptors) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor)
      else delete globalThis[key]
    }
  })
  return {
    client, document, window, navigator, requests,
    async tick(ms) { t.mock.timers.tick(ms); await flush() },
    async open() {
      const consumer = client()
      consumer.live.setFounder(true)
      consumer.mount()
      await flush()
      assert.equal(requests.length, 1)
      return consumer
    },
  }
}

test('one shared ready snapshot coalesces the same refresh across topics and ignores repeated ready', async t => {
  const browser = fixture(t)
  const { live } = await browser.open()
  let sharedReads = 0, agentReads = 0
  const refresh = () => { sharedReads++ }
  live.subscribe('brain', refresh)
  live.subscribe('company', refresh)
  live.subscribe('agents', refresh)
  live.subscribe('agents', () => { agentReads++ })
  browser.requests[0].send(frame('ready') + frame('ready'))
  await flush()
  assert.equal(sharedReads, 1)
  assert.equal(agentReads, 1)
  assert.equal(browser.requests[0].options.credentials, 'same-origin')
  assert.equal(browser.requests[0].options.headers['X-HQ-Access'], '1')
  assert.equal(browser.requests[0].options.headers['X-HQ-Brain'], '1')
  browser.requests[0].send(frame('agents'))
  await flush()
  assert.equal(sharedReads, 2)
  assert.equal(agentReads, 2)
})

test('comments and presence update observers without snapshot reads or timer polling', async t => {
  const browser = fixture(t)
  const { live } = await browser.open()
  let reads = 0
  const observations = []
  for (const topic of ['brain', 'company', 'agents']) live.subscribe(topic, () => { reads++ })
  live.subscribePresence(value => observations.push(value))
  browser.requests[0].send(frame('ready'))
  await flush()
  assert.equal(reads, 3)
  const observation = { observedAt: new Date().toISOString(), agentId: null, taskId: null }
  for (let index = 0; index < 4; index++) {
    browser.requests[0].send(': keepalive\n\n' + frame('presence', observation))
    await browser.tick(20_000)
  }
  assert.deepEqual(observations, Array(4).fill(observation))
  assert.equal(reads, 3)
  assert.equal(browser.requests.length, 1)
  browser.requests[0].send(frame('presence', { ...observation, extra: true }) + frame('presence', { ...observation, observedAt: 'invalid' }))
  await flush()
  assert.equal(observations.length, 4)
  assert.equal(reads, 3)
})

test('short ready connections back off to the cap and only a healthy connection resets recovery', async t => {
  const browser = fixture(t)
  await browser.open()
  for (const delay of [1_000, 2_000, 4_000, 8_000, 16_000, 30_000, 30_000]) {
    const count = browser.requests.length
    browser.requests.at(-1).send(frame('ready'))
    await flush()
    browser.requests.at(-1).close()
    await flush()
    await browser.tick(delay - 1)
    assert.equal(browser.requests.length, count, `no reconnect before ${delay} ms`)
    await browser.tick(1)
    assert.equal(browser.requests.length, count + 1)
  }
  browser.requests.at(-1).send(frame('ready'))
  await flush()
  await browser.tick(30_000)
  browser.requests.at(-1).close()
  await flush()
  const count = browser.requests.length
  await browser.tick(999)
  assert.equal(browser.requests.length, count)
  await browser.tick(1)
  assert.equal(browser.requests.length, count + 1)
})

test('visibility recovery awaits one access check before reopening with validated identity', async t => {
  const browser = fixture(t)
  const { live } = await browser.open()
  const check = deferred()
  let accessReads = 0
  live.subscribe('access', async () => {
    accessReads++
    await check.promise
    live.setFounder(true)
  })
  browser.document.hidden = true
  browser.document.dispatchEvent(new Event('visibilitychange'))
  await flush()
  assert.equal(browser.requests[0].options.signal.aborted, true)
  browser.document.hidden = false
  browser.document.dispatchEvent(new Event('visibilitychange'))
  browser.window.dispatchEvent(new Event('online'))
  await flush()
  assert.equal(accessReads, 1)
  assert.equal(browser.requests.length, 1)
  live.setFounder(true)
  await flush()
  assert.equal(browser.requests.length, 1, 'prior founder status cannot skip revalidation')
  check.resolve()
  await flush()
  assert.equal(browser.requests.length, 2)
})

test('revoked access and stale transport generations cannot refresh snapshots or presence', async t => {
  const browser = fixture(t, { abortTransport: false })
  const { live } = await browser.open()
  let reads = 0, presence = 0
  const resets = []
  live.subscribe('agents', () => { reads++ }, reason => resets.push(reason))
  live.subscribePresence(() => { presence++ })
  let accessReads = 0
  live.subscribe('access', () => { live.setFounder(++accessReads === 1) })
  const old = browser.requests[0]
  browser.document.hidden = true
  browser.document.dispatchEvent(new Event('visibilitychange'))
  browser.document.hidden = false
  browser.document.dispatchEvent(new Event('visibilitychange'))
  await flush()
  assert.equal(browser.requests.length, 2)
  assert.equal(accessReads, 1)
  assert.deepEqual(resets, [])
  old.send(frame('ready') + frame('agents') + frame('presence', { observedAt: new Date().toISOString(), agentId: null, taskId: null }))
  await flush()
  assert.equal(reads, 0)
  assert.equal(presence, 0)
  const current = browser.requests[1]
  current.send(frame('ready'))
  await flush()
  assert.equal(reads, 1)
  current.send(frame('access') + frame('agents') + frame('presence', { observedAt: new Date().toISOString(), agentId: null, taskId: null }))
  await flush()
  assert.equal(current.options.signal.aborted, true)
  assert.equal(accessReads, 2)
  assert.deepEqual(resets, ['scope'])
  assert.equal(reads, 1)
  assert.equal(presence, 0)
  await browser.tick(60_000)
  assert.equal(browser.requests.length, 2)
})

test('consumers share one connection and final disposal clears subscriptions, listeners and retries', async t => {
  const browser = fixture(t)
  const first = browser.client(), second = browser.client()
  let firstReads = 0, secondReads = 0, firstPresence = 0
  first.live.subscribe('agents', () => { firstReads++ })
  first.live.subscribePresence(() => { firstPresence++ })
  second.live.subscribe('agents', () => { secondReads++ })
  first.live.setFounder(true)
  first.mount(); second.mount()
  await flush()
  assert.equal(browser.requests.length, 1)
  assert.equal(browser.document.listenerCount, 1)
  assert.equal(browser.window.listenerCount, 2)
  first.dispose()
  assert.equal(browser.requests[0].options.signal.aborted, false)
  browser.requests[0].send(frame('ready') + frame('presence', { observedAt: new Date().toISOString(), agentId: null, taskId: null }))
  await flush()
  assert.equal(firstReads, 0)
  assert.equal(firstPresence, 0)
  assert.equal(secondReads, 1)
  browser.requests[0].close()
  await flush()
  second.dispose()
  assert.equal(browser.document.listenerCount, 0)
  assert.equal(browser.window.listenerCount, 0)
  await browser.tick(60_000)
  browser.window.dispatchEvent(new Event('online'))
  browser.document.dispatchEvent(new Event('visibilitychange'))
  await flush()
  assert.equal(browser.requests.length, 1)
  const fresh = browser.client()
  fresh.live.setFounder(true)
  fresh.mount()
  await flush()
  assert.equal(browser.requests.length, 2, 'a new consumer receives a new hub after disposal')
  browser.requests[1].send(frame('ready'))
  await flush()
  assert.equal(secondReads, 1, 'disposed subscriptions do not survive into the next hub')
  fresh.dispose()
  assert.equal(browser.requests[1].options.signal.aborted, true)
  assert.equal(browser.document.listenerCount, 0)
  assert.equal(browser.window.listenerCount, 0)
})
