import test from 'node:test'
import assert from 'node:assert/strict'
import { createDoctorPracticeController, doctorPracticeState } from '../../app/utils/practiceController.ts'
import { completeDoctorRegistration } from '../../app/utils/registrationCompletion.ts'
import { doctorWorkspaceEntry } from '../../app/utils/workspaceEntry.ts'
const form = { displayName: 'Synthetic doctor', practiceName: 'Synthetic practice', locationName: 'Synthetic clinic', timezone: 'Africa/Cairo' }
const setup = { enrollment: 'owner', profile: null, practice: null, location: null, draft: null }
const actor = { userId: 'synthetic-user', sessionId: 'synthetic-session', practiceId: null }
function fixture(overrides = {}) {
  const calls = []
  const repository = {
    load: async () => ({ ...setup }),
    save: async (values, key) => { calls.push(['save', values]); return { ...values, commandKey: key, version: 1 } },
    complete: async () => { calls.push(['complete']) }, ...overrides,
  }
  const state = doctorPracticeState()
  return { calls, state, practice: createDoctorPracticeController(repository, state, () => actor, () => 'synthetic-intent') }
}
test('explicit verified signup persists the submitted practice once before dashboard entry', async () => {
  const f = fixture()
  assert.equal(await completeDoctorRegistration(f.practice, form, () => true), '/workspace')
  assert.deepEqual(f.calls, [['save', form], ['complete']])
})
test('existing practice and delegated membership never create another practice', async () => {
  for (const existing of [{ ...setup, practice: { id: 'existing' } }, { ...setup, enrollment: 'delegated-only' }]) {
    const f = fixture({ load: async () => existing })
    assert.equal(await completeDoctorRegistration(f.practice, form, () => true), '/workspace')
    assert.deepEqual(f.calls, [])
    assert.equal(doctorWorkspaceEntry(existing), null)
  }
})
test('subscription gate, failed read and failed completion retain an explicit continuation', async () => {
  const gate = fixture({ load: async () => ({ ...setup, subscriptionRequired: true }) })
  assert.equal(await completeDoctorRegistration(gate.practice, form, () => true), '/subscription')
  assert.deepEqual(gate.calls, [])
  const read = fixture({ load: async () => { throw Error('offline') } })
  assert.equal(await completeDoctorRegistration(read.practice, form, () => true), '/onboarding')
  assert.deepEqual(read.calls, [])
  const write = fixture({ complete: async () => { throw Error('uncertain') } })
  assert.equal(await completeDoctorRegistration(write.practice, form, () => true), '/onboarding')
  assert.equal(write.state.setup.draft.practiceName, form.practiceName)
})
test('session changes during enrollment read suppress the pending write and navigation', async () => {
  let current = true
  const f = fixture({ load: async () => { current = false; return setup } })
  assert.equal(await completeDoctorRegistration(f.practice, form, () => current), null)
  assert.deepEqual(f.calls, [])
})
test('workspace routes only incomplete admitted owners to setup; missing access is not ownership', () => {
  assert.equal(doctorWorkspaceEntry(setup), '/onboarding')
  assert.equal(doctorWorkspaceEntry({ ...setup, subscriptionRequired: true }), '/subscription')
  assert.equal(doctorWorkspaceEntry(null), null)
})
