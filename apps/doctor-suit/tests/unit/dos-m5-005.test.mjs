import test from 'node:test'
import assert from 'node:assert/strict'
import { patientPrescriptionPreview, reconcilePatientPrescriptionPreview, refreshPatientPrescriptionPreview } from '../../app/utils/patientPrescriptionPreview.ts'
import { id, released, deferred } from '../clinical-fixtures.mjs'
const now = Date.parse('2026-10-20T10:01:00Z'), expiry = now + 3600000
const scope = () => ({ environment: 'synthetic', portal: 'patient', accountId: id(4), sessionId: id(14), patientId: id(200), validUntil: expiry, relationships: [{ id: id(900), version: 1, doctorId: id(1), practiceId: id(101), locationIds: [id(102)] }] })
const request = () => ({ releaseId: id(700), prescriptionId: id(400) })
function raw() {
  const release = { ...released(), expires_at: new Date(expiry).toISOString() }
  release.prescriptions[0].segments = [{ ...release.prescriptions[0].segments[0], kind: 'weekdays', weekdays: [1, 3, 5], times: ['09:00'], interval_minutes: null }]
  return { timeline_page: { account_id: id(4), patient_id: id(200), page: 0, page_size: 20, total: 1, rows: [{ relationship_id: id(900), relationship_version: 1, doctor_id: id(1), practice_id: id(101), location_id: id(102), revoked: false, release }], data_mode: 'synthetic', clinical_approval: false, live_prescribing: false }, prescription_id: id(400), current: { version_id: release.version_id, revision: release.revision, snapshot_sha256: release.snapshot_sha256, status: 'active', checked_at: now, valid_until: expiry } }
}
const project = value => patientPrescriptionPreview(value, scope(), request(), now)
test('exact long bilingual instructions, medicine identity, decimal dose, dates and segments survive without medical interpretation', () => {
  const value = raw(), source = value.timeline_page.rows[0].release.prescriptions[0]
  source.instructions = 'تعليمات اصطناعية كاملة — Full entered instructions. '.repeat(65)
  const preview = project(value)
  assert.deepEqual(preview.prescription, source); assert.equal(preview.prescription.instructions, source.instructions); assert.equal(preview.prescription.dose.amount, '1.2500'); assert.equal(preview.provenance.doctorName, 'Synthetic test doctor'); assert.equal(preview.source.versionId, id(301))
  assert.equal(preview.professionalSignature, false); assert.equal(preview.clinicalApproval, false); assert.equal(preview.livePrescribing, false); assert.equal(preview.externalNotifications, false)
  source.instructions = 'mutated input'; assert.notEqual(preview.prescription.instructions, source.instructions); assert.throws(() => preview.prescription.segments[0].weekdays.push(2))
})
test('explicit active/future/completed/stopped/unknown states are distinct; uncertain state supplies no reminder preview', () => {
  for (const status of ['active', 'future', 'completed', 'stopped', 'unknown']) {
    const value = raw(); value.current.status = status; const preview = project(value)
    assert.equal(preview.state, status); assert.equal(preview.reminderPreviewSource !== null, ['active', 'future'].includes(status)); assert.equal(preview.currentVersionKnown, status !== 'unknown')
  }
  const value = raw(); value.current = null; assert.equal(project(value).state, 'unknown'); assert.equal(project(value).reminderPreviewSource, null)
})
test('as-needed and mixed instructions remain explicit, never a guessed scheduled event', () => {
  const value = raw(), prescription = value.timeline_page.rows[0].release.prescriptions[0]
  prescription.segments = [{ ...prescription.segments[0], kind: 'as_needed', weekdays: [], times: [] }]
  assert.equal(project(value).instructionKind, 'as_needed'); assert.equal(project(value).reminderPreviewSource, null)
  prescription.segments[0].end_date = '2026-10-20'
  prescription.segments.push({ ...raw().timeline_page.rows[0].release.prescriptions[0].segments[0], start_date: '2026-10-21' })
  assert.equal(project(value).instructionKind, 'mixed'); assert.equal(project(value).reminderPreviewSource, null)
})
test('amended current version marks an old released source superseded while preserving history links', () => {
  const value = raw(); Object.assign(value.current, { version_id: id(302), revision: 2, snapshot_sha256: 'b'.repeat(64) })
  const preview = project(value); assert.equal(preview.state, 'superseded'); assert.equal(preview.source.versionId, id(301)); assert.equal(preview.reminderPreviewSource, null)
  for (const patch of [{ revision: 1 }, { revision: 0 }, { snapshot_sha256: 'invalid' }]) assert.throws(() => project({ ...value, current: { ...value.current, ...patch } }))
})
test('conflicting same-version provenance and invalid/expired current metadata fail closed', () => {
  for (const patch of [{ revision: 2 }, { snapshot_sha256: 'b'.repeat(64) }, { checked_at: now + 1 }, { valid_until: now }, { valid_until: expiry + 1 }, { status: 'take-another-dose' }, { clinical_approval: true }]) {
    const value = raw(); Object.assign(value.current, patch); assert.throws(() => project(value))
  }
})
test('foreign patient/account/relationship, private fields, revoked release and wrong requested source are rejected', () => {
  const value = raw(); value.timeline_page.rows[0].release.note = 'private'; assert.throws(() => project(value))
  const revoked = raw(); revoked.timeline_page.rows[0].revoked = true; assert.throws(() => project(revoked))
  for (const patch of [{ accountId: id(5) }, { patientId: id(201) }, { portal: 'doctor' }, { relationships: [] }]) assert.throws(() => patientPrescriptionPreview(raw(), { ...scope(), ...patch }, request(), now))
  for (const patch of [{ releaseId: id(701) }, { prescriptionId: id(401) }]) assert.throws(() => patientPrescriptionPreview(raw(), scope(), { ...request(), ...patch }, now))
})
test('stop reconciliation cancels the exact old preview source without rewriting historical actions', () => {
  const before = project(raw()), stopped = raw(); stopped.current.status = 'stopped'
  const after = project(stopped), plan = reconcilePatientPrescriptionPreview(before, after, now)
  assert.deepEqual(plan.cancelSource, before.source); assert.equal(plan.nextPreviewSource, null); assert.deepEqual(plan.historicalSource, before.source); assert.equal(before.state, 'active'); assert.equal(plan.externalNotifications, false)
  assert.equal(reconcilePatientPrescriptionPreview(before, project(raw()), now).cancelSource, null)
})
test('fresh-read-before-plan handles an amendment and retains the original source link', async () => {
  const before = project(raw()), pending = deferred(); let calls = 0
  const work = refreshPatientPrescriptionPreview(before, request(), { scope, now: () => now, load: async () => { calls++; return pending.promise } })
  assert.equal(calls, 1)
  const amended = raw(); Object.assign(amended.current, { version_id: id(302), revision: 2, snapshot_sha256: 'b'.repeat(64) }); pending.resolve(amended)
  const result = await work; assert.equal(result.after.state, 'superseded'); assert.deepEqual(result.reconciliation.cancelSource, before.source); assert.equal(result.reconciliation.nextPreviewSource, null)
})
test('fresh reconciliation discards switched-session, denied, withdrawn or expired results with no fallback plan', async () => {
  const before = project(raw()); let selected = scope(), calls = 0; const pending = deferred()
  const work = refreshPatientPrescriptionPreview(before, request(), { scope: () => selected, now: () => now, load: () => pending.promise })
  selected = { ...selected, sessionId: id(15) }; pending.resolve(raw()); assert.equal(await work, null)
  assert.equal(await refreshPatientPrescriptionPreview(before, request(), { scope: () => selected, now: () => now, load: async () => { calls++; return raw() } }), null); assert.equal(calls, 0)
  for (const load of [async () => { throw Error('denied') }, async () => { const value = raw(); value.timeline_page.rows[0].revoked = true; return value }]) assert.equal(await refreshPatientPrescriptionPreview(before, request(), { scope, now: () => now, load }), null)
  assert.equal(await refreshPatientPrescriptionPreview(before, request(), { scope, now: () => expiry, load: async () => raw() }), null)
  assert.equal(await refreshPatientPrescriptionPreview(before, request(), { scope, now: () => now + 1000, load: async () => raw() }), null)
  assert.throws(() => reconcilePatientPrescriptionPreview(before, before, now - 1)); assert.throws(() => reconcilePatientPrescriptionPreview(before, before, expiry))
})
