import test from 'node:test'
import assert from 'node:assert/strict'
import { doctorProviderConfiguration, doctorReturnPath, doctorPkceCallback } from '../../app/utils/authConfiguration.ts'
import { authFailure, createDoctorAuthController, doctorAuthState } from '../../app/utils/authController.ts'
import { assertLocalFixtureEnvironment } from '../e2e/safety.mjs'

const identity = { userId: 'doctor-a', sessionId: 'session-a', practiceId: null }
function fixture(overrides = {}) {
  let locked = false
  let clears = 0
  const backend = { marker: async () => true, identity: async () => identity, signIn: async () => {}, signUp: async () => {}, verify: async () => {}, exchange: async () => {}, resend: async () => {}, recover: async () => {}, password: async () => {}, signOut: async () => {}, ...overrides }
  const state = doctorAuthState()
  const auth = createDoctorAuthController(backend, state, { clear: () => { clears++ }, locked: () => locked, lock: () => { locked = true }, unlock: () => { locked = false } })
  return { auth, backend, state, clears: () => clears, locked: () => locked }
}
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done }); return { promise, resolve } }

test('DOS-M1-006: missing own provider variables never reuse another product connection', () => {
  const config = doctorProviderConfiguration({ SUPABASE_URL: 'https://other-product.example', SUPABASE_KEY: 'sb_publishable_other' })
  assert.equal(config.enabled, false)
  assert.equal(config.key, '')
})
test('DOS-M1-006: browser fixture guards reject both build-time and runtime remote Doctor targets', () => {
  for (const key of ['DOCTOR_SUPABASE_URL', 'NUXT_PUBLIC_DOCTOR_AUTH_URL', 'NUXT_PUBLIC_DOCTOR_AUTH_ORIGIN']) {
    assert.throws(() => assertLocalFixtureEnvironment({ [key]: 'https://remote.example.test' }), /Remote or ambiguous fixture target rejected/)
    assert.doesNotThrow(() => assertLocalFixtureEnvironment({ [key]: 'http://127.0.0.1:4338' }))
  }
})
test('DOS-M1-006: publishable keys, environment-bound cookies and callback origins are explicit', () => {
  const values = { DOCTOR_SUPABASE_URL: 'http://127.0.0.1:65321', DOCTOR_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_synthetic' }
  const local = doctorProviderConfiguration(values)
  const staging = doctorProviderConfiguration({ ...values, APP_ENV: 'staging', APP_URL: 'https://doctor.example.test', DOCTOR_SUPABASE_URL: 'https://provider.example.test' })
  assert.equal(local.cookiePrefix, 'bs-doctor-local-auth-token')
  assert.notEqual(local.cookiePrefix, staging.cookiePrefix)
  assert.notEqual(local.cookiePrefix, 'bs-shop-local-auth-token')
  for (const bad of [
    { DOCTOR_SUPABASE_URL: 'http://provider.example' },
    { DOCTOR_SUPABASE_URL: 'https://secret@example.test' },
    { DOCTOR_SUPABASE_URL: 'https://example.test/path' },
    { DOCTOR_SUPABASE_PUBLISHABLE_KEY: 'sb_secret_never-client' },
    { APP_URL: 'https://example.test/?token=private' },
    { APP_ENV: 'staging', DOCTOR_SUPABASE_URL: 'https://example.test' },
  ]) assert.throws(() => doctorProviderConfiguration({ ...values, ...bad }), /^Error: DOCTOR_/)
})
test('DOS-M1-006: external, encoded, traversal and malformed return destinations fail closed', () => {
  for (const value of [undefined,'https://evil.test', '//evil.test', '/\\evil.test', '%2f%2fevil.test', '/patients/../../evil', '/account\n', '/%00account', '%zz', ['//evil.test'], '/sign-in']) assert.equal(doctorReturnPath(value), '/workspace')
  assert.equal(doctorReturnPath('/patients?phone=synthetic#private'), '/patients')
  assert.equal(doctorReturnPath('/appointments'), '/appointments')
})
test('DOS-M1-006: callback removal preserves the SDK per-flow verifier binding and rejects malformed bindings', async () => {
  const callback = doctorPkceCallback({ code: 'synthetic-code', sb_flow_id: 'synthetic-flow-123' })
  assert.deepEqual(callback, { code: 'synthetic-code', flowId: 'synthetic-flow-123' })
  let exchanged
  const { auth } = fixture({ exchange: async (...args) => { exchanged = args } })
  assert.equal(await auth.exchange(callback.code, callback.flowId), true)
  assert.deepEqual(exchanged, ['synthetic-code', 'synthetic-flow-123'])
  for (const query of [{ code: '' }, { code: ['synthetic-code'] }, { code: 'synthetic-code', sb_flow_id: '../other-flow' }, { code: 'synthetic-code', sb_flow_id: ['synthetic-flow-123'] }]) assert.equal(doctorPkceCallback(query), null)
  assert.deepEqual(doctorPkceCallback({ code: 'legacy-code' }), { code: 'legacy-code' })
})
test('DOS-M1-006: wrong product marker blocks credentials and identity calls', async () => {
  let calls = 0
  const { auth, state } = fixture({ marker: async () => false, signIn: async () => { calls++ }, identity: async () => { calls++ } })
  assert.equal(await auth.signIn('synthetic@example.test', 'synthetic-only'), false)
  assert.equal(calls, 0)
  assert.equal(state.identity, null)
  assert.equal(state.phase, 'unavailable')
})
test('DOS-M1-006: absent provider supports no credential operation', async () => {
  const state = doctorAuthState()
  const auth = createDoctorAuthController(null, state, { clear() {}, locked: () => false, lock() {}, unlock() {} })
  assert.equal(await auth.signUp('Synthetic', 'synthetic@example.test', 'synthetic-only'), false)
  assert.equal(state.phase, 'unavailable')
})
test('DOS-M1-006: double-submit is coalesced and identity comes only from checked backend context', async () => {
  const wait = deferred()
  let writes = 0
  const { auth, state } = fixture({ signIn: async () => { writes++; await wait.promise } })
  const first = auth.signIn('synthetic@example.test', 'synthetic-only')
  assert.equal(await auth.signIn('synthetic@example.test', 'synthetic-only'), false)
  wait.resolve()
  assert.equal(await first, true)
  assert.equal(writes, 1)
  assert.equal(state.identity, identity)
})
test('DOS-M1-006: signup and resend expose verification without claiming authenticated identity', async () => {
  const { auth, state } = fixture()
  assert.equal(await auth.signUp('Synthetic', 'synthetic@example.test', 'synthetic-only'), true)
  assert.equal(state.phase, 'verification')
  assert.equal(state.identity, null)
  assert.equal(await auth.resend('synthetic@example.test'), true)
  assert.equal(state.phase, 'verification')
  assert.equal(await auth.verify('synthetic@example.test', '000000'), true)
  assert.equal(state.phase, 'authenticated')
})
test('DOS-M1-006: expired verification remains retryable and raw provider messages never escape', async () => {
  const { auth, backend, state } = fixture({ verify: async () => { throw { code: 'otp_expired', message: 'private token secret' } } })
  await auth.signUp('Synthetic', 'synthetic@example.test', 'synthetic-only')
  assert.equal(await auth.verify('synthetic@example.test', '000000'), false)
  assert.equal(state.phase, 'verification')
  assert.equal(state.error, 'expired')
  assert.equal(JSON.stringify(state).includes('secret'), false)
  backend.verify = async () => {}
  assert.equal(await auth.verify('synthetic@example.test', '111111'), true)
})
test('DOS-M1-006: failed or revoked refresh clears cached private state and verified identity', async () => {
  const { auth, backend, state, clears } = fixture()
  await auth.refresh()
  backend.identity = async () => { throw { code: 'DOCTOR_SESSION_REQUIRED' } }
  const before = clears()
  const refresh = auth.refresh()
  assert.equal(state.identity, null)
  assert.equal(state.phase, 'checking')
  assert.ok(clears() > before)
  assert.equal(await refresh, false)
  assert.equal(state.phase, 'signed-out')
  assert.equal(state.error, 'session')
})
test('DOS-M1-006: a late pre-logout read cannot restore the authenticated view', async () => {
  const wait = deferred()
  const { auth, state } = fixture({ identity: () => wait.promise })
  const read = auth.refresh()
  await Promise.resolve()
  await auth.signOut()
  wait.resolve(identity)
  assert.equal(await read, false)
  assert.equal(state.phase, 'signed-out')
  assert.equal(state.identity, null)
})
test('DOS-M1-006: failed provider logout locks local view across refresh until explicit verified sign-in', async () => {
  const { auth, state, locked } = fixture({ signOut: async () => { throw new Error('offline') } })
  await auth.refresh()
  assert.equal(await auth.signOut(), false)
  assert.equal(locked(), true)
  assert.equal(state.error, 'sign-out')
  assert.equal(await auth.refresh(), false)
  assert.equal(state.identity, null)
  assert.equal(await auth.signIn('synthetic@example.test', 'synthetic-only'), true)
  assert.equal(locked(), false)
})
test('DOS-M1-006: SDK event callbacks invalidate synchronously without waiting on the SDK lock', async () => {
  const { auth, state } = fixture()
  await auth.refresh()
  assert.equal(auth.providerChanged(), undefined)
  assert.equal(state.identity, null)
  assert.equal(state.phase, 'checking')
  await auth.refresh()
  assert.equal(state.phase, 'authenticated')
})
test('DOS-M1-006: safe classification does not reflect unrecognized server text', () => {
  assert.equal(authFailure({ message: 'credential-that-must-not-render' }), 'network')
  assert.equal(authFailure({ code: 'weak_password' }), 'password')
  assert.equal(authFailure({ code: 'over_request_rate_limit' }), 'rate-limit')
})
