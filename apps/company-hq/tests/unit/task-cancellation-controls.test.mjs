/** Actual composable with generated records; no hosted requests or worker actions. */
import test from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { ref, shallowRef, computed, watch, effectScope } from 'vue'
registerHooks({ resolve(specifier, context, next) {
  if (specifier === '@building-suit/ui/utils/hqTaskBrowserSource') return { url: 'data:text/javascript,export const provideHqTaskBrowserSource=source=>globalThis.__cancelSource=source', shortCircuit: true }
  if (specifier.startsWith('#shared/')) return next(new URL(`../../shared/${specifier.slice(8)}.ts`, import.meta.url).href, context)
  if (specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier) && context.parentURL?.includes('/apps/company-hq/')) return next(`${specifier}.ts`, context)
  return next(specifier, context)
} })
const { useHqAgents } = await import('../../app/composables/useHqAgents.ts')
const id = '20000000-0000-4000-8000-000000000001', other = '20000000-0000-4000-8000-000000000002'
const flush = async () => { for (let n = 0; n < 40; n++) await Promise.resolve() }
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b }); return { promise, resolve, reject } }
const record = (status = 'working') => ({ id, title: 'Generated stale trial', brief: 'Original brief', acceptance: 'Original criteria', assigneeId: 'AG-HR-002', status, createdAt: '2026-11-08T00:00:00Z', updatedAt: '2026-11-08T00:00:00Z', completedAt: null, repairCount: 0, deliverable: 'Immutable draft', reviewSummary: 'Original review', error: null })
async function fixture(t, status = 'working') {
  const access = ref({ status: 'founder', user: { displayName: 'Generated founder', detailLabel: 'Fixture' } })
  const mounts = [], disposers = [], posts = [], reads = [], invalidations = [], scope = effectScope(), descriptors = new Map()
  let task = record(status), readFailure = null, hold = null, trialsHold = null
  const snapshot = () => ({ version: 2, conversationId: null, agents: [], messages: [], jobs: [], tasks: task ? [task] : [], lessons: [], runtime: { connected: false, lastSeenAt: null } })
  const globals = { ref, shallowRef, computed, watch, navigator: { onLine: true }, onMounted: fn => mounts.push(fn), onScopeDispose: fn => disposers.push(fn),
    __cancelSource: null,
    useHqLiveEvents: () => ({ subscribe() {}, subscribePresence() {}, invalidate: reason => invalidations.push(reason) }),
    $fetch: (url, options = {}) => {
      if (options.method === 'POST') { const entry = { ...deferred(), url, options }; posts.push(entry); options.signal?.addEventListener('abort', () => entry.reject(options.signal.reason), { once: true }); return entry.promise }
      if (url === '/api/hq/trials') return trialsHold?.promise ?? Promise.resolve([])
      if (url === '/api/hq/agents') return Promise.resolve(snapshot())
      assert.equal(url, '/api/hq/tasks'); reads.push(options)
      if (readFailure) return Promise.reject(readFailure)
      if (hold) { options.signal.addEventListener('abort', () => hold.reject(options.signal.reason), { once: true }); return hold.promise }
      return Promise.resolve({ counts: { running: 1, waiting: 0, done: 0 }, items: task ? [task] : [] })
    } }
  for (const [key, value] of Object.entries(globals)) { descriptors.set(key, Object.getOwnPropertyDescriptor(globalThis, key)); Object.defineProperty(globalThis, key, { configurable: true, writable: true, value }) }
  const result = scope.run(() => useHqAgents(() => access.value)), source = globalThis.__cancelSource
  let disposed = false
  const dispose = () => { if (disposed) return; disposed = true; disposers.forEach(fn => fn()); scope.stop() }
  t.after(async () => { dispose(); await flush(); for (const [key, d] of descriptors) { if (d) Object.defineProperty(globalThis, key, d); else delete globalThis[key] } })
  mounts.forEach(fn => fn()); await result.refresh()
  return { result, source, posts, reads, access, invalidations, dispose, snapshot, set: value => { task = value }, failRead: value => { readFailure = value }, holdTrials: () => { trialsHold = deferred(); return trialsHold }, holdRead: () => { hold = deferred(); return hold } }
}
test('exact-task cancellation reconciles before POST and verifies after it without changing artifacts', async t => {
  const f = await fixture(t), before = record(), call = f.source.cancel(id); await flush()
  assert.equal(f.posts.length, 1); assert.equal(f.result.agents.value.taskCancellationPending, true)
  assert.equal(await f.source.cancel(id), 'unavailable'); assert.equal(await f.source.cancel(other), 'unavailable')
  const post = f.posts[0]; assert.equal(post.url, `/api/hq/tasks/${id}/cancel`)
  assert.equal(post.options.retry, 0); assert.equal(post.options.credentials, 'same-origin'); assert.equal(post.options.cache, 'no-store')
  assert.equal(post.options.headers['X-HQ-Access'], '1'); assert.equal(post.options.headers['X-HQ-Brain'], '1'); assert.equal(post.options.body, undefined)
  f.set({ ...before, status: 'canceled' }); post.resolve(f.snapshot()); assert.equal(await call, 'canceled')
  assert.equal(f.posts.length, 1); assert.equal(f.reads.length, 2); assert.ok(f.reads.every(r => r.query.taskId === id && r.query.limit === 1 && r.signal instanceof AbortSignal && r.retry === 0))
  await flush(); const projected = f.result.agents.value.tasks[0]; assert.equal(projected.canCancel, false); assert.equal(projected.deliverable, before.deliverable); assert.equal(projected.reviews[0].text, before.reviewSummary)
  assert.equal(f.result.agents.value.taskCancellationPending, false)
})
test('uncertain write never retries automatically and explicit retry reads canceled outcome before any POST', async t => {
  const f = await fixture(t), call = f.source.cancel(id); await flush(); f.set(record('canceled')); f.posts[0].reject(Error('response lost'))
  assert.equal(await call, 'unconfirmed'); assert.equal(f.posts.length, 1)
  assert.equal(await f.source.cancel(id), 'canceled'); assert.equal(f.posts.length, 1)
})
for (const status of ['completed', 'blocked', 'canceled']) test(`${status} readback dispatches no cancellation`, async t => {
  const f = await fixture(t, status); assert.equal(await f.source.cancel(id), status === 'canceled' ? 'canceled' : 'unavailable'); assert.equal(f.posts.length, 0)
})
test('failed pre-read never uses the bounded fallback to authorize a write', async t => {
  const f = await fixture(t); f.failRead(Object.assign(Error('missing migration'), { statusCode: 503 }))
  assert.equal(await f.source.cancel(id), 'unavailable'); assert.equal(f.posts.length, 0)
})
test('wrong record, invalid UUID and missing record fail closed', async t => {
  const f = await fixture(t); await f.source.cancel('../cancel'); assert.equal(f.reads.length, 0)
  assert.equal(await f.source.cancel(other), 'unavailable'); f.set(null); assert.equal(await f.source.cancel(id), 'unavailable'); assert.equal(f.posts.length, 0)
})
for (const end of ['logout', 'identity-change', 'dispose']) test(`${end} rejects stale read and late POST results`, async t => {
  const f = await fixture(t), call = f.source.cancel(id); await flush()
  if (end === 'logout') f.access.value = { status: 'anonymous' }
  else if (end === 'identity-change') f.access.value = { status: 'founder', user: { displayName: 'Other identity', detailLabel: 'Other' } }
  else f.dispose()
  assert.equal(f.posts[0].options.signal.aborted, true); f.posts[0].resolve(f.snapshot()); assert.equal(await call, 'unavailable')
  assert.equal(f.result.agents.value.taskCancellationPending, false); assert.equal(f.result.agents.value.tasks.length, 0)
})
test('founder revocation during preflight prevents POST', async t => {
  const f = await fixture(t), held = f.holdRead(), call = f.source.cancel(id); await flush(); f.access.value = { status: 'anonymous' }
  held.resolve({ counts: { running: 1, waiting: 0, done: 0 }, items: [record()] }); assert.equal(await call, 'unavailable'); assert.equal(f.posts.length, 0)
})
test('403 invalidates access; invalid response and non-canceled readback never report success', async t => {
  const f = await fixture(t); let call = f.source.cancel(id); await flush(); f.posts[0].resolve({ accepted: true }); assert.equal(await call, 'unconfirmed')
  call = f.source.cancel(id); await flush(); f.posts[1].resolve(f.snapshot()); assert.equal(await call, 'unconfirmed')
  call = f.source.cancel(id); await flush(); f.posts[2].reject(Object.assign(Error('denied'), { statusCode: 403 })); assert.equal(await call, 'unavailable')
  assert.deepEqual(f.invalidations, ['access']); assert.equal(f.result.agents.value.status, 'unavailable')
})

test('confirmed task readback releases pending without waiting for unrelated trial refresh', async t => {
  const f = await fixture(t), held = f.holdTrials(), call = f.source.cancel(id); await flush()
  f.set(record('canceled')); f.posts[0].resolve(f.snapshot())
  assert.equal(await Promise.race([call, new Promise(resolve => setTimeout(() => resolve('hung'), 100))]), 'canceled')
  assert.equal(f.result.agents.value.taskCancellationPending, false); held.resolve([])
})

for (const stage of ['before-write', 'write', 'readback']) test(`${stage} timeout actually aborts the combined signal and releases pending`, async t => {
  const timeouts = []
  t.mock.method(AbortSignal, 'timeout', ms => { const controller = new AbortController(); timeouts.push({ ms, controller }); return controller.signal })
  const f = await fixture(t)
  if (stage === 'before-write') f.holdRead()
  const call = f.source.cancel(id); await flush()
  if (stage === 'readback') { f.holdRead(); f.posts[0].resolve(f.snapshot()); await flush() }
  const timeout = timeouts.at(-1); assert.equal(timeout.ms, stage === 'write' ? 45_000 : 15_000)
  timeout.controller.abort(new DOMException('Generated deadline', 'TimeoutError'))
  assert.equal(await call, stage === 'before-write' ? 'unavailable' : 'unconfirmed')
  assert.equal(f.result.agents.value.taskCancellationPending, false)
  assert.equal(f.posts.length, stage === 'before-write' ? 0 : 1)
})
