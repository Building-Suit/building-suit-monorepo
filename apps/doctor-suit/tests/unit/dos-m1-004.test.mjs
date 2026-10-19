import test from 'node:test'
import assert from 'node:assert/strict'
import { createDoctorContextLifecycle, doctorScopeKey } from '../../app/utils/contextScope.ts'

const scope = { environment: 'local', portal: 'doctor', userId: 'doctor-a', sessionId: 'session-a', practiceId: 'practice-a', locationId: 'location-a', grantsVersion: 1 }
test('DOS-M1-004: cache keys isolate every product context dimension', () => {
  const base = doctorScopeKey(scope, 'patients', { page: 1 })
  for (const [field, value] of Object.entries({ environment: 'staging', portal: 'secretary', userId: 'secretary', sessionId: 'session-b', practiceId: 'practice-b', locationId: 'location-b', grantsVersion: 2 })) {
    assert.notEqual(doctorScopeKey({ ...scope, [field]: value }, 'patients', { page: 1 }), base, field)
  }
  assert.notEqual(doctorScopeKey(scope, 'appointments', { page: 1 }), base)
  assert.notEqual(doctorScopeKey(scope, 'patients', { page: 2 }), base)
})

test('DOS-M1-004: context switching invalidates pending reads and clears drafts before accepting new context', async () => {
  const lifecycle = createDoctorContextLifecycle()
  await lifecycle.transition(scope)
  const old = lifecycle.capture('patients')
  const state = { privateRows: ['synthetic-private'], draft: 'synthetic-draft', selection: 'patient-a' }
  lifecycle.registerClear(() => { state.privateRows = []; state.draft = ''; state.selection = '' })
  const transition = lifecycle.transition({ ...scope, practiceId: 'practice-b', locationId: 'location-b' })
  assert.equal(lifecycle.scope, null)
  assert.equal(old.signal.aborted, true)
  assert.equal(old.accepts(), false)
  assert.deepEqual(state, { privateRows: [], draft: '', selection: '' })
  await transition
  assert.deepEqual(state, { privateRows: [], draft: '', selection: '' })
  assert.equal(lifecycle.scope.practiceId, 'practice-b')
  const fresh = lifecycle.capture('patients')
  await lifecycle.transition(null)
  assert.equal(fresh.accepts(), false)
  assert.throws(() => lifecycle.capture('patients'), /CONTEXT_REQUIRED/)
})

test('DOS-M1-004: failed cleanup leaves no active context and stale transitions cannot restore access', async () => {
  const lifecycle = createDoctorContextLifecycle()
  await lifecycle.transition(scope)
  const unregister = lifecycle.registerClear(() => { throw new Error('test cleanup failed') })
  await assert.rejects(lifecycle.transition(scope), /CLEANUP_FAILED/)
  assert.equal(lifecycle.scope, null)
  unregister()
  let release
  let calls = 0
  lifecycle.registerClear(() => ++calls === 1 ? new Promise(resolve => { release = resolve }) : undefined)
  const old = lifecycle.transition(scope)
  await Promise.resolve()
  const newest = lifecycle.transition({ ...scope, practiceId: 'practice-b' })
  assert.equal(lifecycle.scope, null)
  release()
  await Promise.all([old, newest])
  assert.equal(lifecycle.scope.practiceId, 'practice-b')
})
