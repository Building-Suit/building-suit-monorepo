import test from 'node:test'
import assert from 'node:assert/strict'
import { patientReleasedTimeline, createPatientTimelinePreview } from '../../app/utils/patientReleasedTimeline.ts'
import { id, released, deferred } from '../clinical-fixtures.mjs'

const now = Date.parse('2026-10-25T10:00:00Z'), expiry = now + 3600000
const relationship = () => ({ id: id(900), version: 3, doctorId: id(1), practiceId: id(101), locationIds: [id(102)] })
const scope = () => ({ environment: 'synthetic', portal: 'patient', accountId: id(4), sessionId: id(14), patientId: id(200), validUntil: expiry, relationships: [relationship()] })
const row = () => ({ relationship_id: id(900), relationship_version: 3, doctor_id: id(1), practice_id: id(101), location_id: id(102), revoked: false, release: { ...released(), expires_at: new Date(expiry + 60000).toISOString() } })
const page = () => ({ account_id: id(4), patient_id: id(200), page: 0, page_size: 20, total: 1, rows: [row()], data_mode: 'synthetic', clinical_approval: false, live_prescribing: false })
test('released-only timeline retains exact doctor/location/source provenance without chart payload or clinical authority', () => {
  const projected = patientReleasedTimeline(page(), scope(), 0, now), group = projected.groups[0], item = group.items[0]
  assert.equal(projected.clinicalApproval, false); assert.equal(projected.dataMode, 'synthetic'); assert.equal(group.relationshipId, id(900)); assert.equal(group.locationId, id(102)); assert.equal(item.versionId, id(301)); assert.equal(item.revision, 1); assert.equal(item.prescriptionCount, 1)
  assert.equal(item.snapshotSha256, page().rows[0].release.snapshot_sha256)
  for (const key of ['note', 'intake', 'patientName', 'patient_id', 'prescriptions', 'results', 'orders', 'documents', 'object_path']) assert.equal(key in item, false)
  assert.throws(() => { item.revision = 999 }); assert.throws(() => { group.items.push(item) })
})
test('patient cannot combine records from matching contacts or foreign recipients/relationships, and doctors gain no reciprocal portal access', () => {
  for (const patch of [{ account_id: id(9) }, { patient_id: id(201) }, { clinical_approval: true }, { live_prescribing: true }, { contact_email: 'same@example.test' }]) assert.throws(() => patientReleasedTimeline({ ...page(), ...patch }, scope(), 0, now))
  for (const patch of [{ patientId: id(201) }, { accountId: id(9) }, { portal: 'doctor' }, { environment: 'production' }, { relationships: [] }]) assert.throws(() => patientReleasedTimeline(page(), { ...scope(), ...patch }, 0, now))
  for (const patch of [{ relationship_id: id(901) }, { relationship_version: 2 }, { doctor_id: id(2) }, { practice_id: id(103) }, { location_id: id(104) }]) assert.throws(() => patientReleasedTimeline({ ...page(), rows: [{ ...row(), ...patch }] }, scope(), 0, now))
})
test('complete page is rejected rather than silently filtering contaminated private or unreleased content', () => {
  for (const key of ['note', 'intake', 'url', 'object_path']) {
    const raw = page(); raw.rows[0].release[key] = 'private'; assert.throws(() => patientReleasedTimeline(raw, scope(), 0, now))
  }
  for (const patch of [{ patient_id: id(201) }, { responsible_doctor: id(2) }, { professional_signature: true }, { results: [{ stage: 'uploaded' }] }]) {
    const raw = page(); Object.assign(raw.rows[0].release, patch); assert.throws(() => patientReleasedTimeline(raw, scope(), 0, now))
  }
})
test('independently released doctors and locations form distinct groups without joining underlying records', () => {
  const s = scope(), raw = page(); s.relationships.push({ id: id(901), version: 1, doctorId: id(2), practiceId: id(103), locationIds: [id(104)] })
  raw.rows.push({ ...row(), relationship_id: id(901), relationship_version: 1, doctor_id: id(2), practice_id: id(103), location_id: id(104), release: { ...row().release, release_id: id(701), version_id: id(302), responsible_doctor: id(2), doctor_name: 'Synthetic second doctor', location_name: 'Synthetic second clinic' } }); raw.total = 2
  const result = patientReleasedTimeline(raw, s, 0, now)
  assert.equal(result.groups.length, 2); assert.equal(result.groups[0].items[0].versionId, id(301)); assert.equal(result.groups[1].items[0].versionId, id(302)); assert.notEqual(result.groups[0].doctorId, result.groups[1].doctorId)
})
test('empty and out-of-range pages stay explicit; page size, completeness and duplicate/ordering errors are rejected', () => {
  assert.deepEqual(patientReleasedTimeline({ ...page(), total: 0, rows: [] }, { ...scope(), relationships: [] }, 0, now).groups, [])
  assert.deepEqual(patientReleasedTimeline({ ...page(), page: 1, rows: [] }, scope(), 1, now).groups, [])
  for (const patch of [{ page_size: 100 }, { page: 1 }, { total: 2 }, { total: -1 }, { total: 2, rows: [row(), row()] }]) assert.throws(() => patientReleasedTimeline({ ...page(), ...patch }, scope(), 0, now))
  for (const p of [-1, NaN, 0.5, Number.MAX_SAFE_INTEGER]) assert.throws(() => patientReleasedTimeline(page(), scope(), p, now))
  const raw = page(); raw.total = 2; raw.rows.push({ ...row(), release: { ...row().release, release_id: id(701), finalized_at: '2026-10-21T10:00:00Z' } }); assert.throws(() => patientReleasedTimeline(raw, scope(), 0, now))
})
test('withdrawn/expired releases and expired relationship scope cannot leave actionable timeline links', () => {
  const raw = page(); raw.rows[0].revoked = true; assert.throws(() => patientReleasedTimeline(raw, scope(), 0, now))
  for (const expires_at of [new Date(now).toISOString(), 'invalid', '2026-10-19T10:00:00Z']) {
    const raw = page(); raw.rows[0].release.expires_at = expires_at; assert.throws(() => patientReleasedTimeline(raw, scope(), 0, now))
  }
  assert.throws(() => patientReleasedTimeline(page(), { ...scope(), validUntil: now }, 0, now))
})
test('bounded pagination reports the next page without accumulating or merging clinical versions', () => {
  const rows = Array.from({ length: 20 }, (_, index) => ({ ...row(), release: { ...row().release, release_id: id(700 + index), version_id: id(301 + index) } }))
  const first = patientReleasedTimeline({ ...page(), total: 21, rows }, scope(), 0, now)
  assert.equal(first.groups[0].items.length, 20); assert.equal(first.hasMore, true)
  const last = patientReleasedTimeline({ ...page(), page: 1, total: 21, rows: [{ ...row(), release: { ...row().release, release_id: id(720), version_id: id(321) } }] }, scope(), 1, now)
  assert.equal(last.groups[0].items.length, 1); assert.equal(last.hasMore, false); assert.equal(last.groups[0].items[0].releaseId, id(720))
})
test('corrected provenance replaces the page and never combines an old release into the corrected source', async () => {
  let response = page(); const preview = createPatientTimelinePreview({ scope, load: async () => response, now: () => now })
  assert.equal(await preview.load(), true); assert.equal(preview.current().groups[0].items[0].revision, 1)
  response = page(); Object.assign(response.rows[0].release, { revision: 2, version_id: id(302), snapshot_sha256: 'a'.repeat(64) })
  assert.equal(await preview.load(), true); assert.equal(preview.current().groups[0].items.length, 1); assert.equal(preview.current().groups[0].items[0].revision, 2); assert.equal(preview.current().groups[0].items[0].snapshotSha256, 'a'.repeat(64))
  response = { ...page(), total: 0, rows: [] }; assert.equal(await preview.load(), true); assert.deepEqual(preview.current().groups, [])
})
test('relationship withdrawal or account/session/dependent change fences late reads and clears retained projection', async () => {
  for (const patch of [{ relationships: [] }, { sessionId: id(15) }, { accountId: id(5) }, { patientId: id(201) }]) {
    let s = scope(); const pending = deferred(), preview = createPatientTimelinePreview({ scope: () => s, load: () => pending.promise, now: () => now })
    const reading = preview.load(); s = { ...s, ...patch }; pending.resolve(page()); assert.equal(await reading, false); assert.equal(preview.current(), null)
  }
  let s = scope(); const preview = createPatientTimelinePreview({ scope: () => s, load: async () => page(), now: () => now })
  await preview.load(); s.relationships[0].version++; assert.equal(preview.current(), null)
})
test('clear, expiry and clock rollback reject cached projection; failed refresh retains no old page', async () => {
  let clock = now, denied = false
  const preview = createPatientTimelinePreview({ scope, now: () => clock, load: async () => { if (denied) throw Error('denied'); return page() } })
  await preview.load(); preview.clear(); assert.equal(preview.current(), null)
  await preview.load(); clock = expiry; assert.equal(preview.current(), null)
  clock = now - 1; assert.equal(await preview.load(), false); assert.equal(preview.current(), null)
  clock = expiry + 1; denied = true; assert.equal(await preview.load(), false); assert.equal(preview.current(), null)
})
test('older page completion cannot replace a newer page and invalid scopes never reach the adapter', async () => {
  const pending = deferred(); let calls = 0
  const preview = createPatientTimelinePreview({ scope, now: () => now, load: async () => ++calls === 1 ? pending.promise : { ...page(), total: 0, rows: [] } })
  const first = preview.load(); assert.equal(await preview.load(), true); pending.resolve(page()); assert.equal(await first, false); assert.deepEqual(preview.current().groups, [])
  let reached = false; const denied = createPatientTimelinePreview({ scope: () => ({ ...scope(), portal: 'doctor' }), now: () => now, load: async () => { reached = true; return page() } })
  assert.equal(await denied.load(), false); assert.equal(reached, false)
})
