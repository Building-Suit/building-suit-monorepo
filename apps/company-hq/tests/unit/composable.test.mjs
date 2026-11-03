import test from 'node:test'
import assert from 'node:assert/strict'
import { computed, effectScope, nextTick, onScopeDispose, ref, watch } from 'vue'
import { load } from '../../scripts/load-test-module.mjs'

const { useCompanyHq } = await load('../app/composables/useCompanyHq.ts')
const signedIn = () => ({
  configured: true, authenticated: true,
  state: {
    agents: [], tasks: [], events: [], brain: { notes: [] },
    messages: [{ id: 'private-message', role: 'founder', text: 'Synthetic private conversation', createdAt: '2026-11-03T12:00:00Z', status: 'queued' }],
  },
})
const signedOut = () => ({ configured: true, authenticated: false, state: null })
const deferred = () => {
  let resolve
  const promise = new Promise(accept => { resolve = accept })
  return { promise, resolve }
}

function fixture(t) {
  let fetch = async () => signedIn()
  const globals = {
    ref, computed, watch, onScopeDispose,
    // Tests invoke load explicitly; no real mounted polling timer is started.
    onMounted: () => {},
    useI18n: () => ({ t: key => key, tm: () => ({}), locale: ref('en'), setLocale: async () => {} }),
    useConfirmation: () => ({ ask: async () => true }),
    // Deliberately ignore AbortSignal so an uncooperative/settled transport cannot bypass the stale-response guard.
    $fetch: (...args) => fetch(...args),
  }
  const previous = new Map(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
  const scope = effectScope()
  const hq = scope.run(useCompanyHq)
  t.after(() => {
    scope.stop()
    for (const [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor)
      else delete globalThis[key]
    }
  })
  return { hq, scope, transport: value => { fetch = value } }
}

test('a transient background failure preserves drafts and signed-in records, blocks writes, and a verified sign-out clears them', async t => {
  const { hq, transport } = fixture(t)
  await hq.load()
  const draft = { title: 'Unsaved plan', brief: 'Synthetic outcome', acceptance: 'Review evidence', allowedActions: 'Read only' }
  hq.messageDraft.value = 'Unsaved founder message'
  hq.taskDraft.value = { ...draft }
  hq.conversationOpen.value = true
  hq.taskOpen.value = true
  const requests = []
  transport(async url => { requests.push(url); throw new Error('Synthetic network failure') })
  await hq.load(true)
  await nextTick()
  assert.equal(hq.authenticated.value, true)
  assert.equal(hq.messages.value[0].text, 'Synthetic private conversation')
  assert.equal(hq.messageDraft.value, 'Unsaved founder message')
  assert.deepEqual(hq.taskDraft.value, draft)
  assert.equal(hq.conversationOpen.value, true)
  assert.equal(hq.taskOpen.value, true)
  assert.equal(hq.error.value, 'hq.error')
  assert.equal(hq.readOnly.value, true)
  await hq.sendMessage('Must not be submitted while disconnected')
  assert.deepEqual(requests, ['/api/hq/state'])

  transport(async () => signedOut())
  await hq.load(true)
  await nextTick()
  assert.equal(hq.authenticated.value, false)
  assert.deepEqual(hq.messages.value, [])
  assert.equal(hq.messageDraft.value, '')
  assert.deepEqual(hq.taskDraft.value, { title: '', brief: '', acceptance: '', allowedActions: '' })
  assert.equal(hq.conversationOpen.value, false)
  assert.equal(hq.taskOpen.value, false)
})

test('an authenticated response started before logout cannot restore private records after logout succeeds', async t => {
  const { hq, transport } = fixture(t)
  await hq.load()
  const oldResponse = deferred()
  let stateReads = 0
  transport(async url => {
    if (url === '/api/hq/auth/logout') return { ok: true }
    assert.equal(url, '/api/hq/state')
    return ++stateReads === 1 ? oldResponse.promise : signedOut()
  })
  const olderLoad = hq.load(true)
  await hq.signOut()
  await nextTick()
  assert.equal(hq.authenticated.value, false)
  assert.deepEqual(hq.messages.value, [])

  oldResponse.resolve(signedIn())
  await olderLoad
  await nextTick()
  assert.equal(hq.authenticated.value, false)
  assert.deepEqual(hq.messages.value, [])
  assert.equal(hq.readOnly.value, true)
})

test('a newer session-denial response wins over an older authenticated refresh', async t => {
  const { hq, transport } = fixture(t)
  await hq.load()
  const oldResponse = deferred()
  let reads = 0
  transport(async () => ++reads === 1 ? oldResponse.promise : signedOut())
  const olderLoad = hq.load(true)
  await hq.load(true)
  oldResponse.resolve(signedIn())
  await olderLoad
  await nextTick()
  assert.equal(hq.authenticated.value, false)
  assert.deepEqual(hq.messages.value, [])
})

test('disposing the composable invalidates a pending authenticated response', async t => {
  const { hq, scope, transport } = fixture(t)
  transport(async () => signedOut())
  await hq.load()
  const response = deferred()
  transport(async () => response.promise)
  const pendingLoad = hq.load(true)
  scope.stop()
  response.resolve(signedIn())
  await pendingLoad
  await nextTick()
  assert.equal(hq.authenticated.value, false)
  assert.deepEqual(hq.messages.value, [])
})
