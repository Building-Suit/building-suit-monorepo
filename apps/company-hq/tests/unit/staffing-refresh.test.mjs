/** Actual staffing projection and live hub; synthetic HTTP only, no hosted work. */
import test from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { ref, shallowRef, computed, watch, effectScope } from 'vue'
import { useHqLiveEvents } from '../../app/composables/useHqLiveEvents.ts'
registerHooks({ resolve(specifier, context, next) {
  if (specifier.startsWith('#shared/')) return next(new URL(`../../shared/${specifier.slice(8)}.ts`, import.meta.url).href, context)
  return next(specifier, context)
} })
const { useHqStaffing } = await import('../../app/composables/useHqStaffing.ts')
const flush = async () => { for (let i = 0; i < 80; i++) await Promise.resolve() }
const snapshot = { version: 1, canonicalWriter: 'unavailable', totalCount: 0, workflows: [] }
const frame = event => `event: ${event}\ndata: {}\n\n`
function fixture(t, { founder = true, held = false } = {}) {
  const access = ref({ status: founder ? 'founder' : 'loading', user: { displayName: 'Synthetic founder', detailLabel: 'Fixture' } })
  const mounts = [], disposers = [], reads = [], streams = [], app = {}, scope = effectScope()
  const document = Object.assign(new EventTarget(), { hidden: false }), window = new EventTarget(), navigator = { onLine: true }
  let hold = held
  const globals = { ref, shallowRef, computed, watch, document, window, navigator, useHqLiveEvents, useNuxtApp: () => app,
    onMounted: fn => mounts.push(fn), onScopeDispose: fn => disposers.push(fn),
    $fetch: (url, options) => {
      assert.equal(url, '/api/hq/staffing'); assert.equal(options.headers['X-HQ-Access'], '1'); assert.equal(options.cache, 'no-store')
      let resolve, reject
      const promise = new Promise((a, b) => { resolve = a; reject = b })
      reads.push({ options, resolve: () => resolve(snapshot), reject })
      if (!hold) resolve(snapshot)
      return promise
    },
    fetch: async (url, options) => {
      assert.equal(url, '/api/hq/events')
      let controller
      const body = new ReadableStream({ start(value) { controller = value } })
      options.signal.addEventListener('abort', () => { try { controller.close() } catch { /* Already closed by fixture teardown. */ } }, { once: true })
      streams.push({ close: () => controller.close(), send: events => controller.enqueue(new TextEncoder().encode(events.map(frame).join(''))) })
      return new Response(body, { headers: { 'content-type': 'text/event-stream' } })
    },
  }
  const descriptors = new Map()
  for (const [key, value] of Object.entries(globals)) {
    descriptors.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
  }
  let live
  const result = scope.run(() => { live = useHqLiveEvents(); return useHqStaffing(() => access.value) })
  let disposed = false
  const dispose = () => { if (disposed) return; disposed = true; disposers.forEach(fn => fn()); scope.stop() }
  t.after(async () => { dispose(); await flush(); for (const [key, descriptor] of descriptors) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]
  } })
  return { access, reads, streams, result, live, document, window, navigator, dispose,
    mount() { mounts.forEach(fn => fn()); live.setFounder(access.value.status === 'founder') },
    hold(value) { hold = value },
  }
}
test('same-turn startup reads coalesce without waiting for stream readiness', async t => {
  const f = fixture(t); f.mount(); await flush()
  assert.equal(f.reads.length, 1)
  assert.equal(f.result.staffing.value.status, 'ready')
  f.streams[0].send(['ready']); await flush()
  assert.equal(f.reads.length, 2, 'post-join recovery is still fresh')
})
test('mixed company and agents burst reads once, but in-flight events retain one follow-up', async t => {
  const f = fixture(t); f.mount(); await flush(); f.streams[0].send(['ready']); await flush()
  const before = f.reads.length
  f.streams[0].send(['company', 'agents']); await flush()
  assert.equal(f.reads.length - before, 1)
  f.hold(true); f.streams[0].send(['company', 'agents']); await flush()
  const active = f.reads.at(-1), count = f.reads.length
  f.streams[0].send(['company', 'agents', 'company']); await flush()
  assert.equal(f.reads.length, count)
  f.hold(false); active.resolve(); await flush()
  assert.equal(f.reads.length, count + 1, 'events after dispatch require a fresh read')
})
test('delayed founder access retains eager fallback and stream recovery', async t => {
  const f = fixture(t, { founder: false }); f.mount(); await flush(); assert.equal(f.reads.length, 0)
  f.access.value = { ...f.access.value, status: 'founder' }; f.live.setFounder(true); await flush()
  assert.equal(f.reads.length, 1, 'initial data does not depend on handshake success')
  f.streams[0].send(['ready']); await flush(); assert.equal(f.reads.length, 2)
})
test('hidden/offline live invalidations do not fetch; resumed ready recovers', async t => {
  const f = fixture(t); f.mount(); await flush(); f.streams[0].send(['ready']); await flush()
  const before = f.reads.length
  f.document.hidden = true; f.document.dispatchEvent(new Event('visibilitychange')); await flush()
  f.live.invalidate('company'); f.live.invalidate('agents'); await flush(); assert.equal(f.reads.length, before)
  f.document.hidden = false; f.document.dispatchEvent(new Event('visibilitychange')); await flush()
  f.streams.at(-1).send(['ready']); await flush(); assert.equal(f.reads.length, before + 1)
  f.navigator.onLine = false; f.window.dispatchEvent(new Event('offline')); await flush()
  f.live.invalidate('company'); await flush(); assert.equal(f.reads.length, before + 1)
})
for (const end of ['denied', 'dispose']) test(`${end} before dispatch suppresses queued reads`, async t => {
  const f = fixture(t)
  if (end === 'denied') f.access.value = { status: 'denied' }; else f.dispose()
  await flush(); assert.equal(f.reads.length, 0)
})
test('failed read remains unavailable and a later event retries normally', async t => {
  const f = fixture(t, { held: true }); f.mount(); await flush()
  f.reads[0].reject(Error('synthetic transport failure')); await flush()
  assert.equal(f.result.staffing.value.status, 'unavailable')
  f.hold(false); f.streams[0].send(['ready']); await flush()
  assert.equal(f.result.staffing.value.status, 'ready')
  assert.equal(f.reads.length, 2)
})
test('100 separate mixed-topic bursts dispatch 100 staffing snapshots', async t => {
  const f = fixture(t); f.mount(); await flush(); f.streams[0].send(['ready']); await flush()
  const before = f.reads.length
  for (let i = 0; i < 100; i++) { f.streams[0].send(['company', 'agents']); await flush() }
  t.diagnostic(`staffing requests for 100 mixed-topic bursts: ${f.reads.length - before}`)
  assert.equal(f.reads.length - before, 100)
})
test('an earlier eager snapshot does not suppress later mount or ready recovery', async t => {
  const f = fixture(t); await flush(); assert.equal(f.reads.length, 1)
  f.mount(); await flush(); assert.equal(f.reads.length, 2)
  f.streams[0].send(['ready']); await flush(); assert.equal(f.reads.length, 3)
})
for (const end of ['denied', 'dispose']) test(`${end} during read suppresses late snapshot`, async t => {
  const f = fixture(t, { held: true }); f.mount(); await flush()
  if (end === 'denied') { f.access.value = { status: 'denied' }; f.live.setFounder(false) } else f.dispose()
  f.reads[0].resolve(); await flush()
  assert.equal(f.result.staffing.value.status, 'unavailable')
  assert.equal(f.result.staffing.value.workflows.length, 0)
  assert.equal(f.reads.length, 1)
})
test('same-turn refresh callers await the same dispatched result', async t => {
  const f = fixture(t, { held: true }); f.mount()
  const first = f.result.refreshStaffing(), second = f.result.refreshStaffing()
  assert.equal(first, second)
  let completed = false
  void first.then(() => { completed = true })
  await flush(); assert.equal(completed, false); assert.equal(f.reads.length, 1)
  f.reads[0].resolve(); await first
  assert.equal(f.result.staffing.value.status, 'ready')
})

test('settled transport reconnect keeps exactly one required recovery snapshot', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const f = fixture(t); f.mount(); await flush(); f.streams[0].send(['ready']); await flush()
  const before = f.reads.length
  f.streams[0].close(); await flush(); t.mock.timers.tick(1000); await flush()
  assert.equal(f.streams.length, 2)
  f.streams[1].send(['ready']); await flush()
  t.diagnostic(`staffing requests for settled reconnect: ${f.reads.length - before}`)
  assert.equal(f.reads.length - before, 1)
})
