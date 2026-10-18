import test from 'node:test'
import assert from 'node:assert/strict'
import { reactive, ref, nextTick } from 'vue'
import { doctorAuthState, createDoctorAuthController } from '../../app/utils/authController.ts'
import { doctorPracticeState, createDoctorPracticeController } from '../../app/utils/practiceController.ts'
import { useDoctorOnboardingDraft } from '../../app/composables/useDoctorOnboardingDraft.ts'

const actor = { userId: 'synthetic-owner-a', sessionId: 'synthetic-session-a', practiceId: null }
const setup = name => ({ enrollment: 'owner', profile: null, practice: null, location: null, draft: { displayName: name, practiceName: 'Synthetic practice', locationName: 'Synthetic location', timezone: 'Etc/UTC', commandKey: 'synthetic-command', version: 1 } })
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done }); return { promise, resolve } }
const flush = async () => { for (let n = 0; n < 8; n++) { await nextTick(); await new Promise(done => setImmediate(done)) } }
function fixture(load, repository = {}) {
  const authState = reactive({ ...doctorAuthState(), phase: 'authenticated', providerReady: true, identity: actor })
  const state = reactive(doctorPracticeState())
  let reads = 0
  const practice = createDoctorPracticeController({ load: signal => { reads++; return load(signal, reads) }, ...repository }, state, () => authState.identity)
  const identity = deferred()
  const auth = createDoctorAuthController({ marker: async () => true, identity: () => identity.promise }, authState, { clear: practice.clear, locked: () => false, lock() {}, unlock() {} })
  const form = ref({ name: '', workspaceName: '', locationName: '', timezone: '' })
  const stop = useDoctorOnboardingDraft(authState, practice, form)
  return { auth, authState, practice, state, identity, form, stop, reads: () => reads }
}

test('provider recheck clears the form and reloads the same verified owner server draft', async () => {
  const value = fixture(async () => setup('Synthetic saved draft'))
  try {
    await flush(); assert.equal(value.form.value.name, 'Synthetic saved draft')
    value.form.value.name = 'Unsaved private draft'
    value.auth.providerChanged(); await flush()
    assert.equal(value.authState.phase, 'checking'); assert.equal(value.form.value.name, ''); assert.equal(value.state.setup, null)
    value.identity.resolve(actor); await flush()
    assert.equal(value.authState.phase, 'authenticated'); assert.equal(value.state.phase, 'ready')
    assert.equal(value.form.value.name, 'Synthetic saved draft'); assert.equal(value.reads(), 2)
    value.stop(); value.practice.clear(); await flush(); assert.equal(value.reads(), 2)
  } finally { value.stop() }
})

test('late prior-session setup cannot replace a newly verified owner draft', async () => {
  const old = deferred(); let oldSignal
  const value = fixture((signal, reads) => { if (reads === 1) { oldSignal = signal; return old.promise }; return Promise.resolve(setup('Independent owner draft')) })
  try {
    await flush(); value.auth.providerChanged(); await flush()
    assert.equal(oldSignal.aborted, true); assert.equal(value.form.value.name, '')
    value.identity.resolve({ ...actor, userId: 'synthetic-owner-b', sessionId: 'synthetic-session-b' }); await flush()
    assert.equal(value.form.value.name, 'Independent owner draft')
    old.resolve(setup('Prior owner draft')); await flush()
    assert.equal(value.form.value.name, 'Independent owner draft'); assert.equal(value.state.setup.draft.displayName, 'Independent owner draft')
  } finally { value.stop() }
})

test('a scoped failed save retains the pending local draft for an explicit retry', async () => {
  const value = fixture(async () => setup('Synthetic saved draft'), { save: async () => { throw Error('Synthetic unavailable') } })
  try {
    await flush(); value.form.value.name = 'Unsaved local draft'
    assert.equal(await value.practice.saveDraft({ displayName: 'Unsaved local draft', practiceName: 'Synthetic practice', locationName: 'Synthetic location', timezone: 'Etc/UTC' }), false)
    await flush(); assert.equal(value.state.phase, 'error'); assert.equal(value.form.value.name, 'Unsaved local draft'); assert.equal(value.reads(), 1)
  } finally { value.stop() }
})

for (const mode of ['delegated', 'subscription', 'network']) test(`${mode} setup remains empty and does not retry indefinitely`, async () => {
  const value = fixture(async () => {
    if (mode === 'network') throw Error('Synthetic unavailable')
    return mode === 'delegated' ? { enrollment: 'delegated-only', profile: null, practice: null, location: null, draft: null } : { ...setup('Gated draft'), subscriptionRequired: true }
  })
  try {
    await flush(); assert.equal(value.form.value.name, ''); assert.equal(value.reads(), 1)
    assert.equal(value.state.phase, mode === 'network' ? 'error' : mode === 'delegated' ? 'denied' : 'ready')
    await flush(); assert.equal(value.reads(), 1)
  } finally { value.stop() }
})
