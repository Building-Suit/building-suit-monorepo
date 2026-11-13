import test from 'node:test'
import assert from 'node:assert/strict'
import { createEmailStepController, emailStepState, normalizedAuthEmail, validAuthEmail, emailStepDelay } from '../src/controllers/emailStep.ts'
import { useSignupWizard } from '../src/composables/useSignupWizard.ts'
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no }); return { promise, resolve, reject } }
test('email validation normalizes but rejects invalid and oversized addresses before any lookup', async () => {
  assert.equal(normalizedAuthEmail(' Synthetic@Example.Test '), 'synthetic@example.test')
  for (const email of ['', 'bad', 'bad @example.test', `${'a'.repeat(250)}@example.test`]) {
    let calls = 0; const state = emailStepState()
    assert.equal(validAuthEmail(email), false)
    const flow = createEmailStepController(state, () => email, async () => { calls++; return true })
    assert.equal(await flow.check(), false); assert.equal(calls, 0); assert.equal(state.error, 'invalid')
  }
})
test('a real pending lookup coalesces repeated submits and waits for minimum feedback before approval', async () => {
  const lookup = deferred(), feedback = deferred(), state = emailStepState(); let calls = 0
  const flow = createEmailStepController(state, () => 'Synthetic@example.test', () => { calls++; return lookup.promise }, () => feedback.promise)
  const first = flow.check(); assert.equal(state.pending, true); assert.equal(await flow.check(), false)
  lookup.resolve(true); await Promise.resolve(); assert.equal(state.approved, false)
  feedback.resolve(); assert.equal(await first, true); assert.equal(calls, 1); assert.equal(state.email, 'synthetic@example.test'); assert.equal(state.pending, false)
})
test('editing without cancellation or resetting for back/unmount cannot accept a late success', async () => {
  for (const reset of [false, true]) {
    let email = 'first@example.test'; const lookup = deferred(), state = emailStepState()
    const flow = createEmailStepController(state, () => email, () => lookup.promise)
    const check = flow.check(); email = 'second@example.test'; if (reset) flow.reset()
    lookup.resolve(true); assert.equal(await check, false); assert.equal(state.approved, false); assert.equal(state.pending, false)
  }
})
test('an old failure cannot overwrite a newer approved check', async () => {
  const old = deferred(), state = emailStepState(); let calls = 0
  const flow = createEmailStepController(state, () => 'synthetic@example.test', () => ++calls === 1 ? old.promise : Promise.resolve(true))
  const check = flow.check(); flow.reset(); assert.equal(await flow.check(), true)
  old.reject({ statusCode: 429 }); assert.equal(await check, false); assert.equal(state.approved, true); assert.equal(state.error, null)
})
test('negative, malformed, unavailable and throttled results never reveal the password step', async () => {
  for (const [result, expected] of [[false, 'rejected'], ['yes', 'network'], [new Error('private provider detail'), 'network'], [{ statusCode: 429 }, 'rate-limit']]) {
    const state = emailStepState(), flow = createEmailStepController(state, () => 'synthetic@example.test', async () => { if (result instanceof Error || typeof result === 'object') throw result; return result })
    assert.equal(await flow.check(), false); assert.equal(state.error, expected); assert.equal(state.approved, false); assert.equal(JSON.stringify(state).includes('private'), false)
  }
})
test('aborting feedback cancels its timer and wizard reset fences a stale async advance', async () => {
  const abort = new AbortController(), waiting = emailStepDelay(abort.signal, 10000); abort.abort(); await assert.rejects(waiting)
  const wizard = useSignupWizard(2), validation = deferred(), result = wizard.advance(() => validation.promise)
  wizard.reset(); validation.resolve(true); assert.equal(await result, false); assert.equal(wizard.step.value, 1); assert.equal(wizard.advancing.value, false)
})
