import test from 'node:test'
import assert from 'node:assert/strict'
import { newDoctorRegistrationDraft, readDoctorRegistrationDraft, saveDoctorRegistrationDraft, bindDoctorRegistrationDraft } from '../../app/utils/registrationDraft.ts'
import { doctorRegistrationIdentity } from '../../app/utils/registrationIdentity.ts'
import { doctorAuthBackend } from '../../app/utils/authBackend.ts'
import { authFailure } from '../../app/utils/authController.ts'
const id = '11111111-1111-4111-8111-111111111111', other = '22222222-2222-4222-8222-222222222222', now = 1792330000000
const identity = { userId: id, email: 'synthetic@example.test', name: '', providerNameVerified: false }
function storage() { const values = new Map(); return { values, getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) } }
const draft = () => ({ ...newDoctorRegistrationDraft(now, id), email: identity.email, displayName: 'Synthetic', practiceName: 'Practice', locationName: 'First', timezone: 'Africa/Cairo', stage: 'challenge', challengeAt: now, resendAt: now })
test('registration resume whitelists non-secret values and isolates Doctor environments', () => {
  const store = storage(); saveDoctorRegistrationDraft(store, 'local', { ...draft(), password: 'NEVER', otp: 'NEVER', accessToken: 'NEVER', role: 'owner' })
  assert.equal([...store.values.values()].join('').includes('NEVER'), false)
  assert.deepEqual(readDoctorRegistrationDraft(store, 'local', now), draft())
  assert.equal(readDoctorRegistrationDraft(store, 'staging', now), null)
  assert.equal(readDoctorRegistrationDraft(store, 'local', now + 86400000), null)
  assert.equal(readDoctorRegistrationDraft(store, 'local', now - 1), null)
})
test('corrupt, expired, incomplete OTP and invalid setup drafts fail safely; unavailable storage does not block', () => {
  for (const value of ['{', JSON.stringify({ ...draft(), email: '' }), JSON.stringify({ ...draft(), timezone: '+02:00' }), JSON.stringify({ ...draft(), locationName: 'a'.repeat(161) }), JSON.stringify({ ...draft(), resendAt: now + 1 })]) {
    const store = storage(); store.setItem('doctor-suit.local.registration.v1', value); assert.equal(readDoctorRegistrationDraft(store, 'local', now), null)
  }
  const denied = { getItem() { throw Error('denied') }, setItem() { throw Error('denied') }, removeItem() { throw Error('denied') } }
  assert.doesNotThrow(() => saveDoctorRegistrationDraft(denied, 'local', draft())); assert.equal(readDoctorRegistrationDraft(denied, 'local'), null)
})
test('draft binding uses verified UID and email, never draft authority or matching email across identities', () => {
  assert.equal(bindDoctorRegistrationDraft(draft(), identity).userId, id)
  assert.equal(bindDoctorRegistrationDraft({ ...draft(), userId: other }, identity), null)
  assert.equal(bindDoctorRegistrationDraft({ ...draft(), email: 'other@example.test' }, identity), null)
})
test('a partially completed verified-provider draft survives signed-out recovery and reload', () => {
  const store = storage(), partial = { ...draft(), userId: id, stage: 'recovery', practiceName: '', locationName: '', timezone: '' }
  saveDoctorRegistrationDraft(store, 'local', partial)
  assert.deepEqual(readDoctorRegistrationDraft(store, 'local', now), partial)
  assert.equal(bindDoctorRegistrationDraft(readDoctorRegistrationDraft(store, 'local', now), identity).userId, id)
  saveDoctorRegistrationDraft(store, 'local', { ...partial, userId: null })
  assert.equal(readDoctorRegistrationDraft(store, 'local', now), null)
})
test('only a confirmed getUser identity may skip OTP; metadata does not establish verification or authority', () => {
  const user = { id, email: identity.email, email_confirmed_at: '2026-10-18T00:00:00Z', user_metadata: { email_verified: true, display_name: 'Untrusted', role: 'owner' } }
  assert.equal(doctorRegistrationIdentity({ ...user, email_confirmed_at: null }), null)
  assert.deepEqual(doctorRegistrationIdentity(user), identity)
  const google = { provider: 'google', identity_data: { email: identity.email, email_verified: true, full_name: 'Synthetic Google' } }
  assert.equal(doctorRegistrationIdentity({ ...user, identities: [google] }).providerNameVerified, true)
  assert.equal(doctorRegistrationIdentity({ ...user, identities: [{ ...google, identity_data: { ...google.identity_data, email: 'other@example.test' } }] }).name, '')
  assert.equal('practiceId' in doctorRegistrationIdentity(user), false)
})
test('GoTrue duplicate obfuscation is rejected even after an earlier email check; signup outcomes distinguish verified identity', async () => {
  const user = { id, email: identity.email, email_confirmed_at: '2026-10-18T00:00:00Z', identities: [{ provider: 'email' }] }
  let response = { data: { user: { ...user, identities: [] }, session: null }, error: null }
  const backend = doctorAuthBackend({ auth: { signUp: async () => response, getUser: async () => ({ data: { user }, error: null }) } }, 'https://doctor.example.test')
  await assert.rejects(backend.signUp('Synthetic', identity.email, 'synthetic-only'), error => authFailure(error) === 'exists')
  response = { data: { user, session: null }, error: null }; assert.equal(await backend.signUp('Synthetic', identity.email, 'synthetic-only'), 'challenge')
  response = { data: { user, session: {} }, error: null }; assert.equal(await backend.signUp('Synthetic', identity.email, 'synthetic-only'), 'verified')
})
