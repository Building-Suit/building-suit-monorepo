/** Actual composable + live hub; generated data, no HTTP or hosted access. */
import test from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { ref, shallowRef, computed, watch, effectScope } from 'vue'

registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier === '@building-suit/ui/utils/hqTaskBrowserSource') return {
    url: 'data:text/javascript,export const provideHqTaskBrowserSource = () => {}', shortCircuit: true,
  }
  if (specifier.startsWith('#shared/')) return nextResolve(new URL(`../../shared/${specifier.slice(8)}.ts`, import.meta.url).href, context)
  if (specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier) && context.parentURL?.includes('/apps/company-hq/')) return nextResolve(`${specifier}.ts`, context)
  return nextResolve(specifier, context)
} })
const { useHqAgents } = await import('../../app/composables/useHqAgents.ts')
const { useHqLiveEvents } = await import('../../app/composables/useHqLiveEvents.ts')
const flush = async () => { for (let n = 0; n < 60; n++) await Promise.resolve() }
const deferred = () => {
  let resolve, reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
const snapshot = () => ({ version: 2, conversationId: null, agents: [], messages: [], jobs: [], tasks: [], lessons: [], runtime: { connected: false, lastSeenAt: null } })
const trial = agentId => ({ agentId, eligible: true, qualified: false, receiptIssued: false, reviewComplete: false, skillFileId: null, trialId: null, status: null })
const founder = name => ({ status: 'founder', user: { displayName: name, detailLabel: 'Synthetic founder' } })

async function fixture(t) {
  const access = ref(founder('First'))
  const document = Object.assign(new EventTarget(), { hidden: false })
  const window = new EventTarget(), navigator = { onLine: true }, app = {}
  const mounts = [], disposers = [], requests = { agents: [], trials: [] }
  let stream, live
  const scope = effectScope()
  const globals = { ref, shallowRef, computed, watch, document, window, navigator,
    useNuxtApp: () => app, onMounted: callback => mounts.push(callback), onScopeDispose: callback => disposers.push(callback),
    useHqLiveEvents: () => (live = useHqLiveEvents()),
    $fetch: (url, options) => {
      const kind = url === '/api/hq/trials' ? 'trials' : 'agents'
      assert.equal(url, kind === 'trials' ? '/api/hq/trials' : '/api/hq/agents')
      const request = { ...deferred(), options }
      requests[kind].push(request)
      return request.promise
    },
    fetch: async (url, options) => {
      assert.equal(url, '/api/hq/events')
      return new Response(new ReadableStream({ start(controller) {
        stream = controller
        options.signal.addEventListener('abort', () => controller.error(new DOMException('Aborted', 'AbortError')), { once: true })
      } }), { headers: { 'content-type': 'text/event-stream' } })
    },
  }
  const descriptors = new Map()
  for (const [key, value] of Object.entries(globals)) {
    descriptors.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
  }
  const result = scope.run(() => useHqAgents(() => access.value))
  let disposed = false
  const dispose = () => {
    if (disposed) return
    disposed = true
    for (const callback of disposers) callback()
    scope.stop()
  }
  t.after(async () => {
    dispose()
    await flush()
    for (const [key, descriptor] of descriptors) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor)
      else delete globalThis[key]
    }
  })
  live.setFounder(true)
  for (const callback of mounts) callback()
  await flush()
  assert.equal(requests.trials.length, 1)
  requests.trials[0].resolve([])
  await flush()
  const event = name => stream.enqueue(new TextEncoder().encode(`event: ${name}\ndata: {}\n\n`))
  event('ready'); await flush()
  requests.agents[0].resolve(snapshot()); requests.trials[1].resolve([])
  await flush()
  requests.agents.length = 0; requests.trials.length = 0
  return { access, document, window, navigator, requests, result, dispose, event }
}

test('slow trial refresh coalesces a burst into one active pass and one fresh follow-up', async t => {
  const f = await fixture(t)
  f.event('agents'); await flush()
  f.requests.agents[0].resolve(snapshot()); await flush()
  for (let n = 0; n < 20; n++) { f.event('agents'); await flush() }
  assert.equal(f.requests.trials.length, 1)
  assert.equal(f.requests.agents.length, 1)
  f.requests.trials[0].resolve([trial('AG-RES-001')]); await flush()
  assert.equal(f.requests.trials.length, 2)
  assert.equal(f.requests.agents.length, 2)
  f.requests.agents[1].resolve(snapshot()); f.requests.trials[1].resolve([trial('AG-RES-002')]); await flush()
  assert.equal(f.requests.trials.length, 2)
  assert.deepEqual(f.result.agents.value.trials, [trial('AG-RES-002')])
})

test('slow agent read also holds the queue, and a failed trial read releases its dirty follow-up', async t => {
  const f = await fixture(t)
  f.event('agents'); await flush()
  f.requests.trials[0].reject(Error('synthetic read failure')); await flush()
  for (let n = 0; n < 10; n++) { f.event('agents'); await flush() }
  assert.equal(f.requests.trials.length, 1)
  f.requests.agents[0].resolve(snapshot()); await flush()
  assert.equal(f.requests.trials.length, 2)
  f.requests.agents[1].resolve(snapshot()); f.requests.trials[1].resolve([trial('AG-RES-002')]); await flush()
  assert.deepEqual(f.result.agents.value.trials, [trial('AG-RES-002')])
})

test('late failure from a logged-out founder cannot clear a new founder snapshot', async t => {
  const f = await fixture(t)
  const old = f.result.refresh(); await flush()
  f.access.value = { status: 'anonymous' }
  f.access.value = founder('Second')
  const current = f.result.refresh(); await flush()
  f.requests.agents[1].resolve(snapshot()); f.requests.trials[1].resolve([trial('AG-RES-002')]); await current
  f.requests.agents[0].resolve(snapshot()); f.requests.trials[0].reject(Error('old read failed')); await old
  assert.deepEqual(f.result.agents.value.trials, [trial('AG-RES-002')])
})

for (const end of ['dispose', 'offline', 'hidden', 'logout']) test(`${end} suppresses dirty follow-up and preserves scope handling`, async t => {
  const f = await fixture(t)
  f.event('agents'); await flush()
  f.event('agents'); await flush()
  if (end === 'dispose') f.dispose()
  if (end === 'logout') f.access.value = { status: 'anonymous' }
  if (end === 'offline') { f.navigator.onLine = false; f.window.dispatchEvent(new Event('offline')) }
  if (end === 'hidden') { f.document.hidden = true; f.document.dispatchEvent(new Event('visibilitychange')) }
  f.requests.agents[0].resolve(snapshot()); f.requests.trials[0].resolve([trial('AG-RES-002')]); await flush()
  // Hiding only stops the stream; valid reads in the same scope remain valid.
  assert.deepEqual(f.result.agents.value.trials, end === 'hidden' ? [trial('AG-RES-002')] : [])
  if (end !== 'hidden') assert.equal(f.requests.agents[0].options.signal.aborted, true)
  assert.equal(f.requests.trials.length, 1)
  assert.equal(f.requests.agents.length, 1)
})
