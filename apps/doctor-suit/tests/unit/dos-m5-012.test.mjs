import test from 'node:test'
import assert from 'node:assert/strict'
import { patientAppointmentsResultsPreview, createPatientResourcePreview } from '../../app/utils/patientAppointmentsResultsPreview.ts'
import { id, released, deferred } from '../clinical-fixtures.mjs'
const now = Date.parse('2026-10-25T10:00:00Z')
function admission(kind = 'appointment') { return { accountId: id(4), sessionId: id(14), patientId: id(200), relationshipId: id(900), relationshipVersion: 3, doctorId: id(1), practiceId: id(101), locationId: id(102), kind, resourceId: kind === 'appointment' ? id(500) : id(700), resourceVersion: 1, sourceVersionId: kind === 'appointment' ? null : id(301), sourceSha256: kind === 'appointment' ? null : released().snapshot_sha256, subjectAccountId: id(4), viewer: 'patient', caregiverGrant: null, checkedAt: now, validUntil: now + 60000, online: true, foreground: true, revoked: false, syntheticOnly: true, legalApproval: false } }
function payload() { return { id: id(500), version: 1, state: 'booked', starts_at: '2026-10-26T10:00:00Z', ends_at: '2026-10-26T10:30:00Z', timezone: 'Etc/UTC', doctor_name: 'Synthetic doctor', location_name: 'Synthetic clinic' } }
function response(a = admission()) { const p = a.kind === 'appointment' ? payload() : { ...released(), expires_at: new Date(now + 120000).toISOString(), prescriptions: [], orders: [{ id: id(600), kind: 'follow_up', request: 'Entered follow-up / تعليمات متابعة مدخلة', due_at: null, state: 'requested', reason: '' }], results: [] }; return { kind: a.kind, resource_id: a.resourceId, account_id: a.accountId, patient_id: a.patientId, relationship_id: a.relationshipId, relationship_version: a.relationshipVersion, doctor_id: a.doctorId, practice_id: a.practiceId, location_id: a.locationId, checked_at: a.checkedAt, data_mode: 'synthetic', clinical_approval: false, payload: p } }
function resultResponse(a) { const raw = response(a); raw.payload.orders.push({ id: id(601), kind: 'lab', request: 'Entered lab request', due_at: null, state: 'tracking', reason: '' }); raw.payload.results.push({ id: id(602), order_id: id(601), document_version_id: id(603), stage: 'released', annotation: 'Entered annotation / تعليق مدخل' }); raw.payload.documents.push({ id: id(603), filename: 'synthetic.pdf', mime: 'application/pdf', size: 10, sha256: 'a'.repeat(64) }); return raw }
test('appointment projection preserves versioned operational state/provenance without inventing result interpretation', () => {
 const a = admission(), p = patientAppointmentsResultsPreview(response(a), a, now); assert.equal(p.state, 'booked'); assert.equal(p.operationalOnly, true); assert.equal(p.provenance.doctorId, id(1)); assert.equal(p.clinicalApproval, false); for (const key of ['results', 'diagnosis', 'patientName', 'sessionId']) assert.equal(key in p, false); assert.throws(() => { p.state = 'completed' })
})
test('released results and entered follow-up retain exact text/version/hash but no prescriptions, bytes or signature claim', () => {
 const a = admission('released_results'), raw = resultResponse(a), p = patientAppointmentsResultsPreview(raw, a, now); assert.equal(p.results[0].annotation, raw.payload.results[0].annotation); assert.equal(p.followUp[0].request, raw.payload.orders[0].request); assert.equal(p.followUp[0].operationalState, 'requested'); assert.equal(p.sourceVersionId, id(301)); assert.equal(p.professionalSignature, false); for (const key of ['prescriptions', 'patient_name', 'documents', 'bytes', 'sessionId']) assert.equal(key in p, false); assert.throws(() => p.results.push({})); assert.throws(() => { p.followUp[0].request = 'changed' })
})
test('received/uploaded/reviewed result is unavailable until explicit release; private contaminated payload is rejected', () => {
 const a = admission('released_results'); for (const stage of ['received', 'uploaded', 'reviewed']) { const raw = resultResponse(a); raw.payload.results[0].stage = stage; assert.throws(() => patientAppointmentsResultsPreview(raw, a, now)) }
 const raw = resultResponse(a); raw.payload.private_note = 'secret'; assert.throws(() => patientAppointmentsResultsPreview(raw, a, now))
})
test('direct links bind patient, doctor, practice, location, relationship and exact current source version', () => {
 for (const kind of ['appointment', 'released_results']) { const a = admission(kind); for (const field of ['resource_id', 'account_id', 'patient_id', 'relationship_id', 'doctor_id', 'practice_id', 'location_id']) assert.throws(() => patientAppointmentsResultsPreview({ ...response(a), [field]: id(999) }, a, now)); assert.throws(() => patientAppointmentsResultsPreview({ ...response(a), relationship_version: 2 }, a, now)); assert.throws(() => patientAppointmentsResultsPreview(response(a), { ...a, resourceVersion: 2 }, now)) }
 const a = admission('released_results'); for (const patch of [{ sourceVersionId: id(302) }, { sourceSha256: 'b'.repeat(64) }]) assert.throws(() => patientAppointmentsResultsPreview(response(a), { ...a, ...patch }, now))
})
test('caregiver purpose/dependent scope is explicit, separate from account contact and patient self mapping', () => {
 const a = admission(); a.viewer = 'caregiver'; a.accountId = id(8); a.caregiverGrant = { id: id(800), version: 1, recipientAccountId: id(8), patientId: a.patientId, relationshipId: a.relationshipId, purpose: 'appointment', validUntil: now + 30000, revoked: false }; assert.equal(patientAppointmentsResultsPreview(response(a), a, now).validUntil, now + 30000)
 for (const patch of [{ patientId: id(201) }, { recipientAccountId: id(9) }, { relationshipId: id(901) }, { purpose: 'released_results' }, { revoked: true }, { validUntil: now }]) assert.throws(() => patientAppointmentsResultsPreview(response(a), { ...a, caregiverGrant: { ...a.caregiverGrant, ...patch } }, now))
 assert.throws(() => patientAppointmentsResultsPreview(response(), { ...admission(), subjectAccountId: id(9) }, now))
})
test('offline/expiry/background/revocation clears retained preview; reconnect requires new appointment version and status', async () => {
 let a = admission(), raw = response(), at = now
 const reader = createPatientResourcePreview({ admission: () => a, read: async () => raw, now: () => at }); assert.equal(await reader.load(), true)
 a.online = false; assert.equal(reader.current(), null); assert.equal(await reader.load(), false)
 a = { ...admission(), resourceVersion: 2 }; raw = response(a); raw.payload = { ...payload(), version: 2, state: 'cancelled' }; assert.equal(await reader.load(), true); assert.equal(reader.current().state, 'cancelled')
 a = { ...a, resourceVersion: 3 }; raw = response(a); raw.payload = { ...payload(), version: 3, starts_at: '2026-10-27T11:00:00Z', ends_at: '2026-10-27T11:30:00Z' }; assert.equal(await reader.load(), true); assert.equal(reader.current().startsAt, raw.payload.starts_at)
 for (const patch of [{ foreground: false }, { revoked: true }, { validUntil: now }]) { a = { ...a, ...patch }; assert.equal(reader.current(), null) }
 at = now - 1; assert.equal(await reader.load(), false)
})
test('withdrawal, dependent/session switch or source update while reading discards late response', async () => {
 for (const patch of [{ revoked: true }, { patientId: id(201) }, { sessionId: id(15) }, { resourceVersion: 2 }, { relationshipVersion: 4 }, { online: false }]) { let a = admission(); const pending = deferred(); const reader = createPatientResourcePreview({ admission: () => a, read: () => pending.promise, now: () => now }); const load = reader.load(); a = { ...a, ...patch }; pending.resolve(response()); assert.equal(await load, false); assert.equal(reader.current(), null) }
})
test('newer read wins and explicit clear/failure never falls back to older private data', async () => {
 const pending = deferred(); let calls = 0; const reader = createPatientResourcePreview({ admission, read: () => ++calls === 1 ? pending.promise : Promise.resolve(response()), now: () => now }); const old = reader.load(); assert.equal(await reader.load(), true); pending.resolve(response()); assert.equal(await old, false); assert(reader.current()); reader.clear(); assert.equal(reader.current(), null)
 const failed = createPatientResourcePreview({ admission, read: async () => { throw Error('private transport body') }, now: () => now }); assert.equal(await failed.load(), false); assert.equal(failed.current(), null)
})
test('malformed status/time/private appointment field or expired release fails closed with no partial projection', () => {
 const a = admission(); for (const patch of [{ state: 'confirmed_by_doctor' }, { ends_at: payload().starts_at }, { timezone: 'unknown-zone' }, { phone: 'same contact' }]) { const raw = response(a); Object.assign(raw.payload, patch); assert.throws(() => patientAppointmentsResultsPreview(raw, a, now)) }
 const r = admission('released_results'), raw = response(r); raw.payload.expires_at = new Date(now).toISOString(); assert.throws(() => patientAppointmentsResultsPreview(raw, r, now))
})
