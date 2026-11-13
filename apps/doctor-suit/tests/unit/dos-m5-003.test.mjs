import test from 'node:test'
import assert from 'node:assert/strict'
import { caregiverPreviewAllows, createSyntheticCaregiverLedger, createCaregiverPreviewReader } from '../../app/utils/patientCaregiverProtocol.ts'

const scope = () => ({ environment: 'synthetic', accountId: 'caregiver-account', sessionId: 'caregiver-session', patientId: 'dependent-one', doctorId: 'doctor-one', practiceId: 'practice-one', relationshipId: 'relationship-one' })
const grant = () => ({ id: 'grant-one', version: 1, grantorAccountId: 'grantor-account', recipientAccountId: 'caregiver-account', patientId: 'dependent-one', doctorId: 'doctor-one', practiceId: 'practice-one', relationshipId: 'relationship-one', authorityEvidenceRef: 'synthetic-evidence-only', policyRef: 'synthetic-policy-only', actions: ['released_prescription', 'reminder_preview'], validFrom: 100, validUntil: 200, revokedAt: null, syntheticOnly: true, legalApproval: false })
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r }); return { promise, resolve } }
function fixture() {
  const ledger = createSyntheticCaregiverLedger(); ledger.record(grant())
  let selected = scope(), now = 120, reads = 0
  const dependencies = { scope: () => selected, now: () => now, action: 'released_prescription', grant: async s => ledger.lookup('grant-one', s, 'released_prescription', now), read: async () => { reads++; return { releasedVersion: 7 } } }
  const reader = createCaregiverPreviewReader(dependencies)
  return { ledger, reader, dependencies, setScope: s => { selected = s }, setClock: n => { now = n }, reads: () => reads }
}
test('synthetic grant explicitly names authority reference, distinct accounts, scope and validity without legal age inference', () => {
  const ledger = createSyntheticCaregiverLedger(), source = grant(), recorded = ledger.record(source)
  assert.equal(recorded.syntheticOnly, true); assert.equal(recorded.legalApproval, false)
  source.actions.push('patient_report'); assert.deepEqual(recorded.actions, ['released_prescription', 'reminder_preview'])
  for (const patch of [{ grantorAccountId: 'caregiver-account' }, { authorityEvidenceRef: '' }, { policyRef: '' }, { syntheticOnly: false }, { legalApproval: true }, { clinicalApproval: true }, { contactEmail: 'same@example.test' }, { actions: ['sign_prescription'] }, { actions: [] }, { actions: ['patient_report', 'patient_report'] }, { validFrom: 200 }, { validUntil: Infinity }, { version: 0 }]) assert.throws(() => createSyntheticCaregiverLedger().record({ ...grant(), ...patch }))
  assert.equal('age' in recorded, false); assert.equal('guardianVerified' in recorded, false)
})
test('a known grant cannot enumerate a sibling, other relationship, doctor, practice, account or environment', () => {
  const ledger = createSyntheticCaregiverLedger(); ledger.record(grant())
  for (const patch of [{ patientId: 'sibling' }, { relationshipId: 'relationship-two' }, { doctorId: 'doctor-two' }, { practiceId: 'practice-two' }, { accountId: 'email-matches-grantor' }, { sessionId: '' }, { environment: 'production' }]) assert.equal(ledger.lookup('grant-one', { ...scope(), ...patch }, 'released_prescription', 120), null)
  assert.equal(ledger.lookup('unknown', scope(), 'released_prescription', 120), null)
  assert.equal(ledger.lookup('grant-one', scope(), 'patient_report', 120), null)
  assert.equal(caregiverPreviewAllows(grant(), scope(), 'released_prescription', 100), true)
  for (const time of [99, 200, Infinity, NaN, 120.5]) assert.equal(caregiverPreviewAllows(grant(), scope(), 'released_prescription', time), false)
})
test('revocation is version-bound, cannot expand permissions and retains immutable grant/withdrawal provenance', () => {
  const ledger = createSyntheticCaregiverLedger(), original = ledger.record(grant()), history = ledger.audit()
  for (const args of [['grant-one', 0, 'grantor-account', 'withdrawal-ref', 130], ['grant-one', 1, 'caregiver-account', 'withdrawal-ref', 130], ['grant-one', 1, 'grantor-account', '', 130], ['grant-one', 1, 'grantor-account', 'withdrawal-ref', 99]]) assert.throws(() => ledger.revoke(...args))
  const revoked = ledger.revoke('grant-one', 1, 'grantor-account', 'withdrawal-ref', 130)
  assert.equal(revoked.version, 2); assert.equal(revoked.revokedAt, 130); assert.equal(original.revokedAt, null)
  assert.throws(() => ledger.record(grant())); assert.throws(() => ledger.revoke('grant-one', 1, 'grantor-account', 'another-ref', 131))
  assert.equal(history.length, 1); assert.equal(ledger.audit().length, 2); assert.equal(ledger.audit()[1].actorAccountId, 'grantor-account'); assert.equal(ledger.audit()[1].evidenceRef, 'withdrawal-ref')
  assert.throws(() => ledger.audit().push({})); assert.throws(() => { revoked.actions.push('patient_report') })
})
test('open synthetic prescription is cleared on revalidation after revocation; pending reminder preview is suppressed', async () => {
  const f = fixture(); assert.equal(await f.reader.refresh(), true); assert.deepEqual(f.reader.current(), { releasedVersion: 7 })
  const pending = { grantId: 'grant-one', grantVersion: 1, scope: scope(), action: 'reminder_preview' }
  assert.equal(caregiverPreviewAllows(f.ledger.lookup(pending.grantId, pending.scope, pending.action, 120), pending.scope, pending.action, 120, pending.grantVersion), true)
  f.ledger.revoke('grant-one', 1, 'grantor-account', 'withdrawal-ref', 130); f.setClock(130)
  assert.equal(await f.reader.refresh(), false); assert.equal(f.reader.current(), null); assert.equal(f.reads(), 1)
  assert.equal(caregiverPreviewAllows(f.ledger.lookup(pending.grantId, pending.scope, pending.action, 130), pending.scope, pending.action, 130, pending.grantVersion), false)
  assert.equal(f.ledger.audit().length, 2)
})
test('revocation while a protected read is in flight discards the response and performs a fresh grant check', async () => {
  const f = fixture(), pending = deferred(); f.dependencies.read = () => pending.promise
  const loading = f.reader.refresh(); await Promise.resolve(); assert.equal(f.reader.current(), null)
  f.ledger.revoke('grant-one', 1, 'grantor-account', 'withdrawal-ref', 130); f.setClock(130); pending.resolve({ releasedVersion: 7 })
  assert.equal(await loading, false); assert.equal(f.reader.current(), null)
})
test('expiry, clock rollback and invalid clock fail closed without renewing a preview lease', async () => {
  for (const now of [200, 119, NaN]) {
    const f = fixture(); assert.equal(await f.reader.refresh(), true); f.setClock(now); assert.equal(f.reader.current(), null)
  }
  const f = fixture(), pending = deferred(); f.dependencies.read = () => pending.promise
  const loading = f.reader.refresh(); await Promise.resolve(); f.setClock(200); pending.resolve({ releasedVersion: 7 })
  assert.equal(await loading, false); assert.equal(f.reader.current(), null)
})
test('account/session/dependent switches and background clear prevent stale private state', async () => {
  for (const patch of [{ accountId: 'other-account' }, { sessionId: 'other-session' }, { patientId: 'sibling' }, { relationshipId: 'relationship-two' }]) {
    const f = fixture(); await f.reader.refresh(); f.setScope({ ...scope(), ...patch }); assert.equal(f.reader.current(), null)
  }
  const f = fixture(), pending = deferred(); f.dependencies.read = () => pending.promise
  const loading = f.reader.refresh(); await Promise.resolve(); f.reader.clear(); pending.resolve({ releasedVersion: 7 })
  assert.equal(await loading, false); assert.equal(f.reader.current(), null)
})
test('older concurrent response cannot replace a newer valid projection; failed refresh clears retained data', async () => {
  const f = fixture(), pending = deferred(); let calls = 0
  f.dependencies.read = async () => ++calls === 1 ? pending.promise : { releasedVersion: 8 }
  const old = f.reader.refresh(); await Promise.resolve(); assert.equal(await f.reader.refresh(), true)
  pending.resolve({ releasedVersion: 7 }); assert.equal(await old, false); assert.deepEqual(f.reader.current(), { releasedVersion: 8 })
  f.dependencies.grant = async () => { throw Error('unavailable') }
  assert.equal(await f.reader.refresh(), false); assert.equal(f.reader.current(), null)
})
test('fresh grant cannot silently replace the original id, version or expiry after a read', async () => {
  for (const patch of [{ id: 'another-grant' }, { version: 2 }, { validUntil: 300 }]) {
    const f = fixture(); let calls = 0
    f.dependencies.grant = async () => ++calls === 1 ? grant() : { ...grant(), ...patch }
    assert.equal(await f.reader.refresh(), false); assert.equal(f.reader.current(), null)
  }
})
