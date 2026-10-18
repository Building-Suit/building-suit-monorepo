import test from 'node:test'
import assert from 'node:assert/strict'
import { ref, reactive, computed, watch, effectScope, nextTick } from 'vue'
import { useDoctorRegistration } from '../../app/composables/useDoctorRegistration.ts'
import { doctorAuthCopy } from '../../app/utils/authPresentation.ts'
import { newDoctorRegistrationDraft, saveDoctorRegistrationDraft, readDoctorRegistrationDraft } from '../../app/utils/registrationDraft.ts'
const id = '11111111-1111-4111-8111-111111111111', other = '22222222-2222-4222-8222-222222222222'
const verified = { userId: id, email: 'synthetic@example.test', name: 'Synthetic provider', providerNameVerified: true }
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no }); return { promise, resolve, reject } }
function fixture({ lookup = async () => null, denied = false, draft = null, refresh = async () => false, phase = 'signed-out' } = {}) {
  const scope = effectScope(), mounted = [], unmounted = [], values = new Map(), routes = []
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) }
  if (draft) saveDoctorRegistrationDraft(storage, 'local', draft)
  const handoff = ref(null), route = reactive({ query: {} }), state = reactive({ phase, identity: phase === 'authenticated' ? { userId: id } : null, error: null, providerReady: true, pending: false, signupOutcome: null })
  let creates = 0
  const auth = { state, refresh, registrationIdentity: (...args) => lookup(...args), signUp: async () => { creates++; return true }, verify: async () => true, resend: async () => true }
  const windowMock = {}; Object.defineProperty(windowMock, 'sessionStorage', { get() { if (denied) throw Error('denied'); return storage } })
  Object.assign(globalThis, { ref, reactive, computed, watch, nextTick, window: windowMock,
    onMounted: callback => mounted.push(callback), onBeforeUnmount: callback => unmounted.push(callback), usePolling: () => {},
    useRuntimeConfig: () => ({ public: { doctorAuth: { environment: 'local' } } }), useRoute: () => route,
    useDoctorRegistrationHandoff: () => handoff,
    useDoctorAuthPresentation: () => ({ auth, copy: ref(doctorAuthCopy(false)), error: computed(() => state.error ? doctorAuthCopy(false).errors[state.error] : null) }),
    navigateTo: async target => { routes.push(target); route.query = typeof target === 'string' ? {} : target.query || {} },
    $fetch: async () => ({ canContinue: true }),
  })
  const flow = scope.run(() => useDoctorRegistration())
  return { flow, auth, handoff, storage, routes, creates: () => creates, mount: () => mounted[0](), async close() { unmounted.forEach(callback => callback()); await nextTick(); scope.stop() } }
}
const saved = (partial = false) => ({ ...newDoctorRegistrationDraft(), email: verified.email, userId: id, displayName: verified.name, practiceName: partial ? '' : 'Synthetic practice', locationName: partial ? '' : 'Synthetic location', timezone: partial ? '' : 'Africa/Cairo', stage: 'practice' })
test('registration initialization blocks submissions until the trusted identity check settles', async () => {
  const check = deferred(), f = fixture({ lookup: () => check.promise })
  try {
    const mount = f.mount(); assert.equal(f.flow.view.value.pending, true)
    Object.assign(f.flow.form.value, { name: 'Synthetic', email: verified.email, password: 'synthetic-password-only' })
    await f.flow.submit(); assert.equal(f.creates(), 0)
    check.resolve(null); await mount; assert.equal(f.flow.view.value.pending, false)
  } finally { await f.close() }
})
test('a late initial identity response after navigation cannot restore the disposed form', async () => {
  const check = deferred(), f = fixture({ lookup: () => check.promise })
  const mounting = f.mount(); await f.close(); check.resolve(verified); await mounting
  assert.equal(f.flow.hydrated.value, false); assert.equal(f.flow.form.value.email, ''); assert.equal(f.routes.length, 0)
})
test('transient identity failure preserves a bound draft and retry is one flight under double click', async () => {
  const check = deferred(); let calls = 0
  const f = fixture({ draft: saved(), lookup: () => ++calls === 1 ? Promise.reject(Error('network')) : check.promise })
  try {
    await f.mount(); assert.equal(f.flow.availability.value.state, 'error'); assert.equal(readDoctorRegistrationDraft(f.storage, 'local').practiceName, 'Synthetic practice')
    const first = f.flow.retryIdentity(), second = f.flow.retryIdentity(); assert.equal(calls, 2); assert.equal(f.flow.view.value.pending, true)
    check.resolve(verified); await Promise.all([first, second]); assert.equal(f.flow.view.value.existingAccount, true); assert.equal(f.flow.view.value.stage, 'workspace'); assert.equal(f.flow.availability.value, undefined)
  } finally { await f.close() }
})
test('partial verified-account recovery survives reload and resumes after explicit verified sign-in', async () => {
  let actor = null; const f = fixture({ draft: saved(true), lookup: async () => actor })
  try {
    await f.mount(); assert.equal(f.flow.view.value.stage, 'recovery')
    assert.equal(readDoctorRegistrationDraft(f.storage, 'local').userId, id)
    actor = verified; await f.flow.retryIdentity(); assert.equal(f.flow.view.value.stage, 'workspace'); assert.equal(f.flow.form.value.email, verified.email)
    assert.equal(f.flow.form.value.workspaceName, ''); assert.equal(f.creates(), 0)
  } finally { await f.close() }
})
test('account mismatch during completion resets locked fields and retry establishes only the new identity', async () => {
  let actor = verified; const f = fixture({ draft: saved(), lookup: async () => actor })
  try {
    await f.mount(); actor = { ...verified, userId: other, email: 'other@example.test', name: 'Other provider' }
    await f.flow.submit(); assert.equal(f.flow.view.value.existingAccount, false); assert.equal(f.flow.view.value.step, 1); assert.equal(f.flow.form.value.email, '')
    assert.equal(readDoctorRegistrationDraft(f.storage, 'local').practiceName, '')
    await f.flow.retryIdentity(); assert.equal(f.flow.form.value.email, actor.email); assert.equal(f.flow.form.value.workspaceName, ''); assert.equal(f.flow.view.value.existingAccount, true)
  } finally { await f.close() }
})
test('a provider change during failed completion queues fresh identity validation before further editing', async () => {
  const check = deferred(); let calls = 0
  const next = { ...verified, userId: other, email: 'other@example.test', name: 'Other provider' }
  const f = fixture({ draft: saved(), lookup: () => ++calls === 1 ? Promise.resolve(verified) : calls === 2 ? check.promise : Promise.resolve(next), refresh: async () => { f.auth.state.phase = 'signed-out'; return false } })
  try {
    await f.mount(); const completion = f.flow.submit(); await nextTick(); f.auth.state.phase = 'checking'
    check.resolve(verified); await completion; await nextTick(); await nextTick()
    assert.ok(calls >= 3); assert.equal(f.flow.form.value.email, next.email); assert.equal(f.flow.form.value.workspaceName, '')
  } finally { await f.close() }
})
test('storage denial preserves collected setup in the app handoff after verified completion', async () => {
  const f = fixture({ denied: true, lookup: async () => verified, refresh: async () => true })
  try {
    await f.mount(); Object.assign(f.flow.form.value, { workspaceName: 'Synthetic practice', locationName: 'Synthetic location', timezone: 'Africa/Cairo' })
    await f.flow.submit(); assert.equal(f.handoff.value.userId, id); assert.equal(f.handoff.value.practiceName, 'Synthetic practice'); assert.equal(f.routes.at(-1), '/onboarding')
    assert.equal('password' in f.handoff.value, false)
  } finally { await f.close() }
})
test('sign-out completing with only pending=false drains the queued identity recheck', async () => {
  let actor = verified, calls = 0
  const f = fixture({ draft: saved(true), phase: 'authenticated', lookup: async () => { calls++; return actor } })
  try {
    await f.mount(); f.auth.state.pending = true; f.auth.state.identity = null; f.auth.state.phase = 'signed-out'; actor = null
    assert.equal(calls, 1); f.auth.state.pending = false; await nextTick(); await nextTick()
    assert.equal(calls, 2); assert.equal(f.flow.view.value.existingAccount, false); assert.equal(f.flow.view.value.stage, 'recovery')
  } finally { await f.close() }
})
