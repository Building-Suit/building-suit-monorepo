import test from 'node:test'
import assert from 'node:assert/strict'
import { doctorPracticeSetup, doctorSetupForm, validDoctorSetupForm } from '../../app/utils/practiceSetup.ts'
import { createDoctorPracticeController, doctorPracticeState } from '../../app/utils/practiceController.ts'
const key = '74000000-0000-0000-0000-000000000001'
const practiceId = '73000000-0000-0000-0000-000000000001'
const form = { displayName: 'Synthetic doctor', practiceName: 'Synthetic practice', locationName: 'Main', timezone: 'Africa/Cairo' }
const empty = () => ({ enrollment: 'owner', profile: null, practice: null, location: null, draft: null })
const draft = (values = form, version = 1) => ({ ...values, commandKey: key, version })
const owned = () => ({ ...empty(), profile: { displayName: form.displayName, professionalVerification: 'unverified' }, practice: { id: practiceId, name: form.practiceName, version: 1 }, location: { id: '75000000-0000-0000-0000-000000000001', name: 'Main', timezone: 'Africa/Cairo', version: 1 } })
function fixture(overrides = {}) {
  let actor = { userId: 'actor-a', sessionId: 'session-a', practiceId: null }
  const repository = { load: async () => empty(), save: async values => draft(values), complete: async () => {}, update: async () => {}, ...overrides }
  const state = doctorPracticeState()
  const controller = createDoctorPracticeController(repository, state, () => actor, () => key)
  return { controller, state, repository, session: value => { actor = value } }
}
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done }); return { promise, resolve } }

test('DOS-M1-007: setup projections whitelist approved fields and never establish professional credentials', () => {
  const payload = { enrollment: 'owner', profile: { display_name: form.displayName, professional_verification: 'unverified', email: 'private@example.test' }, practice: { id: practiceId, name: form.practiceName, version: 1 }, location: null, draft: null, metadata: { role: 'doctor' } }
  const result = doctorPracticeSetup(payload)
  assert.equal(result.profile.professionalVerification, 'unverified')
  assert.equal(JSON.stringify(result).includes('private@example.test'), false)
  assert.equal(JSON.stringify(result).includes('metadata'), false)
  assert.throws(() => doctorPracticeSetup({ ...payload, profile: { ...payload.profile, professional_verification: 'verified' } }), /RESPONSE_INVALID/)
  assert.throws(() => doctorPracticeSetup({ ...payload, enrollment: 'delegated-only' }), /RESPONSE_INVALID/)
})
test('DOS-M1-007: incomplete drafts resume without guessing names, timezone, paid access or professional status', () => {
  const values = { displayName: 'Synthetic', practiceName: '', locationName: '', timezone: '' }
  assert.equal(validDoctorSetupForm(values), true)
  assert.equal(validDoctorSetupForm(values, true), false)
  assert.equal(validDoctorSetupForm(form, true), true)
  assert.equal(validDoctorSetupForm({ ...form, timezone: 'UTC+fake' }), false)
  assert.equal(validDoctorSetupForm({ ...form, timezone: 'server-only-timezone' }, true, true), true, 'editing names does not validate uneditable location fields')
  assert.equal(validDoctorSetupForm({ ...form, displayName: 'x'.repeat(121) }), false)
  assert.deepEqual(doctorSetupForm({ ...empty(), draft: draft(values) }), values)
  assert.deepEqual(doctorSetupForm(empty()), { displayName: '', practiceName: '', locationName: '', timezone: '' })
})
test('DOS-M1-007: double-submit creates one command and uses the persisted draft revision', async () => {
  const wait = deferred(); let saves = 0; const completions = []
  const { controller, state } = fixture({ save: async values => { saves++; await wait.promise; return draft(values, 3) }, complete: async (...args) => { completions.push(args) } })
  await controller.load()
  const first = controller.complete({ ...form })
  assert.equal(state.pending, true)
  assert.equal(await controller.complete({ ...form }), false)
  wait.resolve()
  assert.equal(await first, true)
  assert.equal(saves, 1)
  assert.equal(completions.length, 1)
  assert.deepEqual(completions[0].slice(0, 2), [key, 3])
})
test('DOS-M1-007: uncertain draft save retries retain the same actor-bound request identity', async () => {
  const calls = []; let failed = false
  const { controller, state } = fixture({ save: async (values, commandKey, expectedVersion) => {
    calls.push({ values, commandKey, expectedVersion })
    if (!failed) { failed = true; throw new Error('Synthetic transport failure after commit') }
    return draft(values)
  } })
  await controller.load()
  assert.equal(await controller.saveDraft(form), false)
  assert.equal(state.error, 'network')
  assert.equal(await controller.saveDraft(form), true)
  assert.deepEqual(calls[0], calls[1])
  assert.equal(state.saved, true)
})
test('DOS-M1-007: a new verified session loads the persisted draft rather than another session draft cache', async () => {
  const { controller, state, session } = fixture({ load: async () => ({ ...empty(), draft: draft() }) })
  await controller.load()
  controller.clear()
  session({ userId: 'actor-a', sessionId: 'session-b', practiceId: null })
  assert.equal(state.setup, null)
  await controller.load()
  assert.deepEqual(doctorSetupForm(state.setup), form)
})
test('DOS-M1-007: logout aborts private reads and late responses cannot repopulate setup state', async () => {
  const wait = deferred(); let signal
  const { controller, state, session } = fixture({ load: value => { signal = value; return wait.promise } })
  const load = controller.load()
  controller.clear(); session(null)
  assert.equal(signal.aborted, true)
  wait.resolve(owned())
  assert.equal(await load, false)
  assert.equal(state.setup, null)
  assert.equal(state.phase, 'idle')
})
test('DOS-M1-007: even an unannounced session change rejects stale private data', async () => {
  const wait = deferred()
  const { controller, state, session } = fixture({ load: () => wait.promise })
  const load = controller.load()
  session({ userId: 'actor-b', sessionId: 'session-b', practiceId: null })
  wait.resolve(owned())
  assert.equal(await load, false)
  assert.equal(state.setup, null)
})
test('DOS-M1-007: delegated-only identity cannot call owner commands through the controller', async () => {
  let writes = 0
  const { controller, state } = fixture({ load: async () => ({ ...empty(), enrollment: 'delegated-only' }), save: async () => { writes++; return draft() } })
  await controller.load()
  assert.equal(state.phase, 'denied')
  assert.equal(await controller.complete(form), false)
  assert.equal(writes, 0)
  assert.equal(state.error, 'denied')
})
test('DOS-M1-007: optimistic profile retries retain the reviewed request and safe error classification', async () => {
  const calls = []
  const { controller, state, repository } = fixture({ load: async () => owned(), update: async (...args) => { calls.push(args); throw { code: '40001', message: 'Do not render raw database details' } } })
  await controller.load()
  assert.equal(await controller.updateProfile(form), false)
  assert.equal(state.error, 'conflict')
  assert.equal(JSON.stringify(state).includes('raw database details'), false)
  repository.update = async (...args) => { calls.push(args) }
  assert.equal(await controller.updateProfile(form), true)
  assert.deepEqual(calls[0].slice(0, 3), calls[1].slice(0, 3))
  assert.equal(calls[0][0].id, practiceId)
})
