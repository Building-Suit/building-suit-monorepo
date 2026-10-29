import test from 'node:test'
import assert from 'node:assert/strict'
import { reactive, effectScope, nextTick } from 'vue'
import { createManualPaymentController, manualPaymentState } from '../../app/utils/manualPaymentController.ts'
import { watchManualPaymentSession } from '../../app/utils/manualPaymentSession.ts'
const actor = { userId: '11111111-1111-4111-8111-111111111111', sessionId: '22222222-2222-4222-8222-222222222222', practiceId: null }
const deferred = () => { let resolve; const promise = new Promise(yes => { resolve = yes }); return { promise, resolve } }
test('disposing an outgoing payment page cannot clear the current page controller', () => {
  const state = manualPaymentState(), controller = createManualPaymentController(null, state, () => actor, 'local', () => {})
  const outgoing = controller.claimPage(), current = controller.claimPage(); state.ready = true
  outgoing.release(); assert.equal(state.ready, true); assert.equal(current.active(), true); assert.equal(outgoing.active(), false)
  current.release(); assert.equal(state.ready, false); assert.equal(current.active(), false)
})
test('manual payment reads resume once after a fresh verified identity and never while auth is pending', async () => {
  const scope = effectScope(), state = reactive(manualPaymentState()), auth = reactive({ phase: 'checking', pending: true, identity: null })
  let calls = 0
  const stop = scope.run(() => watchManualPaymentSession(auth, state, () => true, async () => { calls++; state.ready = true }))
  try {
    auth.identity = actor; auth.phase = 'authenticated'; await nextTick(); assert.equal(calls, 0)
    auth.pending = false; await nextTick(); await nextTick(); assert.equal(calls, 1); assert.equal(state.ready, true)
    state.ready = false; await nextTick(); await nextTick(); assert.equal(calls, 2)
    auth.phase = 'signed-out'; auth.identity = null; state.ready = false; await nextTick(); assert.equal(calls, 2)
  } finally { stop(); scope.stop() }
})
test('read invalidation during an in-flight load retries only the read and stops on explicit failure', async () => {
  const scope = effectScope(), state = reactive(manualPaymentState()), auth = reactive({ phase: 'authenticated', pending: true, identity: actor }), old = deferred()
  let calls = 0
  const stop = scope.run(() => watchManualPaymentSession(auth, state, () => true, async () => {
    calls++; if (calls === 1) { state.loading = true; await old.promise; return }
    state.error = 'network'
  }))
  try {
    auth.pending = false; await nextTick(); assert.equal(calls, 1)
    state.loading = false; await nextTick(); assert.equal(calls, 1)
    old.resolve(); await new Promise(resolve => setImmediate(resolve)); await nextTick(); assert.equal(calls, 2); assert.equal(state.error, 'network')
    state.pending = true; state.pending = false; await nextTick(); assert.equal(calls, 2)
  } finally { stop(); scope.stop() }
})
test('uncertain writes, an inactive page, and disposed watchers never auto-replay commands or reads', async () => {
  for (const kind of ['uncertain', 'inactive', 'disposed']) {
    const scope = effectScope(), state = reactive(manualPaymentState()), auth = reactive({ phase: 'authenticated', pending: true, identity: actor }); let calls = 0
    state.uncertain = kind === 'uncertain'
    const stop = scope.run(() => watchManualPaymentSession(auth, state, () => kind !== 'inactive', async () => { calls++; state.ready = true }))
    if (kind === 'disposed') stop()
    auth.pending = false; await nextTick(); await nextTick(); assert.equal(calls, 0); stop(); scope.stop()
  }
})
