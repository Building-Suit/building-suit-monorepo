import test from 'node:test'
import assert from 'node:assert/strict'
import { patientReminderPreview, reconcileReminderPreviews, reminderPreviewAlgorithm } from '../../app/utils/patientReminderPreview.ts'
import { patientPrescriptionPreview } from '../../app/utils/patientPrescriptionPreview.ts'
import { id, released } from '../clinical-fixtures.mjs'
const asOf = Date.parse('2025-12-31T12:00:00Z'), expiry = asOf + 3600000
const weekly = (start, end = start, timezone = 'Etc/UTC', times = ['09:00'], weekdays = [1, 2, 3, 4, 5, 6, 7]) => ({ kind: 'weekdays', start_date: start, end_date: end, timezone, interval_minutes: null, weekdays, times, instructions: 'Synthetic entered schedule; interpretation unreviewed' })
function fixture(segments, revision = 1, status = 'future') {
  const release = { ...released(), release_id: id(699 + revision), version_id: id(300 + revision), revision, snapshot_sha256: String(revision).repeat(64), finalized_at: '2025-12-30T12:00:00Z', expires_at: new Date(expiry).toISOString() }
  release.prescriptions[0] = { ...release.prescriptions[0], start_date: segments[0].start_date, end_date: segments.at(-1).end_date, segments }
  const scope = { environment: 'synthetic', portal: 'patient', accountId: id(4), sessionId: id(14), patientId: id(200), validUntil: expiry, relationships: [{ id: id(900), version: 1, doctorId: id(1), practiceId: id(101), locationIds: [id(102)] }] }
  const raw = { timeline_page: { account_id: id(4), patient_id: id(200), page: 0, page_size: 20, total: 1, rows: [{ relationship_id: id(900), relationship_version: 1, doctor_id: id(1), practice_id: id(101), location_id: id(102), revoked: false, release }], data_mode: 'synthetic', clinical_approval: false, live_prescribing: false }, prescription_id: id(400), current: { version_id: release.version_id, revision, snapshot_sha256: release.snapshot_sha256, status, checked_at: asOf, valid_until: expiry } }
  return patientPrescriptionPreview(raw, scope, { releaseId: release.release_id, prescriptionId: id(400) }, asOf)
}
const generate = (preview, fromDay, toDay = fromDay, anchors = []) => patientReminderPreview(preview, { fromDay, toDay }, anchors, asOf)
test('repeat calculation preserves algorithm/source/segment/occurrence IDs and never produces dose advice or delivery authority', () => {
  const preview = fixture([weekly('2026-01-01')]), first = generate(preview, '2026-01-01'), second = generate(preview, '2026-01-01')
  assert.deepEqual(first, second); assert.equal(first.algorithm, reminderPreviewAlgorithm); assert.equal(first.outcome, 'ready_for_review'); assert.equal(first.events.length, 1)
  assert.equal(first.qualifiedInterpretation, false); assert.equal(first.clinicalApproval, false); assert.equal(first.externalNotifications, false)
  assert.equal(first.events[0].source.versionId, id(301)); assert.equal(first.events[0].segmentIndex, 0); assert.equal(first.events[0].occurrenceUtc, '2026-01-01T09:00:00.000Z')
  for (const key of ['dose', 'amount', 'compensation', 'takeNow', 'delivered']) assert.equal(key in first.events[0], false)
  assert.throws(() => first.events.push({}))
})
test('midnight, selected weekdays and both start/end days are explicit inclusive civil dates', () => {
  const preview = fixture([weekly('2026-01-01', '2026-01-04', 'Etc/UTC', ['23:59', '00:00'], [4, 7])]), result = generate(preview, '2026-01-01', '2026-01-04')
  assert.deepEqual(result.events.map(e => e.occurrenceUtc), ['2026-01-01T00:00:00.000Z', '2026-01-01T23:59:00.000Z', '2026-01-04T00:00:00.000Z', '2026-01-04T23:59:00.000Z'])
  assert.equal(generate(preview, '2026-01-05').events.length, 0)
})
test('DST gaps and folds produce unsupported state with zero guessed or partial events', () => {
  const gap = generate(fixture([weekly('2026-03-07', '2026-03-08', 'America/New_York', ['02:30'])]), '2026-03-07', '2026-03-08')
  assert.equal(gap.blocker, 'dst_gap'); assert.deepEqual(gap.events, [])
  const fold = generate(fixture([weekly('2026-11-01', '2026-11-01', 'America/New_York', ['01:30'])]), '2026-11-01')
  assert.equal(fold.blocker, 'dst_fold'); assert.deepEqual(fold.events, [])
})
test('non-hour offsets and half-hour DST folds are detected without assuming a one-hour transition', () => {
  const nepal = generate(fixture([weekly('2026-01-06', '2026-01-06', 'Asia/Kathmandu')]), '2026-01-06')
  assert.equal(nepal.events[0].occurrenceUtc, '2026-01-06T03:15:00.000Z')
  const fold = generate(fixture([weekly('2026-04-05', '2026-04-05', 'Australia/Lord_Howe', ['01:45'])]), '2026-04-05')
  assert.equal(fold.blocker, 'dst_fold'); assert.equal(fold.events.length, 0)
  const historical = generate(fixture([weekly('1900-01-01', '1900-01-01', 'Asia/Kathmandu')]), '1900-01-01')
  assert.equal(historical.blocker, 'unsupported_clock_precision'); assert.deepEqual(historical.events, [])
})
test('host timezone/travel does not silently retime the prescribed zone', () => {
  const preview = fixture([weekly('2026-01-01', '2026-01-01', 'Africa/Cairo')]), first = generate(preview, '2026-01-01'), saved = process.env.TZ
  try { process.env.TZ = 'Pacific/Auckland'; assert.deepEqual(generate(preview, '2026-01-01'), first) }
  finally { if (saved === undefined) delete process.env.TZ; else process.env.TZ = saved }
  assert.equal(first.events[0].occurrenceUtc, '2026-01-01T07:00:00.000Z')
})
test('interval schedules need an explicit matching absolute anchor and elapsed basis; none is guessed', () => {
  const segment = { ...weekly('2026-01-01', '2026-01-02', 'Etc/UTC', ['00:30']), kind: 'interval', weekdays: [], interval_minutes: 90 }, preview = fixture([segment])
  assert.equal(generate(preview, '2026-01-01', '2026-01-02').blocker, 'missing_anchor')
  const anchor = { segmentIndex: 0, instant: '2026-01-01T00:30:00Z', basis: 'elapsed_utc' }
  const result = generate(preview, '2026-01-01', '2026-01-02', [anchor]); assert.equal(result.events.length, 32)
  for (let i = 1; i < result.events.length; i++) assert.equal(Date.parse(result.events[i].occurrenceUtc) - Date.parse(result.events[i - 1].occurrenceUtc), 90 * 60000)
  assert.equal(generate(preview, '2026-01-01', '2026-01-02', [{ ...anchor, instant: '2026-01-01T00:00:00Z' }]).blocker, 'anchor_mismatch')
  assert.equal(generate(preview, '2026-01-01', '2026-01-02', [{ ...anchor, basis: 'guessed-wall-clock' }]).blocker, 'unsupported_interval_basis')
})
test('explicit elapsed interval proposal retains UTC spacing across a DST jump without calculating a dose', () => {
  const segment = { ...weekly('2026-03-08', '2026-03-08', 'America/New_York', ['00:30']), kind: 'interval', weekdays: [], interval_minutes: 60 }
  const result = generate(fixture([segment]), '2026-03-08', '2026-03-08', [{ segmentIndex: 0, instant: '2026-03-08T05:30:00Z', basis: 'elapsed_utc' }])
  assert.deepEqual(result.events.slice(0, 3).map(e => e.localTime), ['00:30', '01:30', '03:30']); assert.equal(result.qualifiedInterpretation, false)
  assert.equal(Date.parse(result.events[2].occurrenceUtc) - Date.parse(result.events[1].occurrenceUtc), 3600000)
})
test('as-needed, unknown/stopped source, stale admission and invalid inputs produce no event', () => {
  const segment = { ...weekly('2026-01-01'), kind: 'as_needed', weekdays: [], times: [] }
  assert.equal(generate(fixture([segment]), '2026-01-01').blocker, 'as_needed_requires_review')
  for (const status of ['unknown', 'stopped', 'completed']) assert.equal(generate(fixture([weekly('2026-01-01')], 1, status), '2026-01-01').blocker, 'prescription_not_current')
  const preview = fixture([weekly('2026-01-01')])
  for (const clock of [asOf - 1, expiry, NaN]) assert.deepEqual(patientReminderPreview(preview, { fromDay: '2026-01-01', toDay: '2026-01-01' }, [], clock).events, [])
  assert.equal(generate(preview, '2026-02-30').blocker, 'invalid_input')
})
test('date and event limits reject the entire plan rather than silently truncating', () => {
  const preview = fixture([weekly('2026-01-01', '2026-03-01')])
  assert.equal(generate(preview, '2026-01-01', '2026-02-01').blocker, 'window_too_large')
  const times = Array.from({ length: 24 }, (_, hour) => String(hour).padStart(2, '0') + ':00')
  const crowded = generate(fixture([weekly('2026-01-01', '2026-01-31', 'Etc/UTC', times)]), '2026-01-01', '2026-01-31')
  assert.equal(crowded.blocker, 'event_limit'); assert.deepEqual(crowded.events, [])
})
test('successive structured segments retain separate version-bound occurrence identity without changing entered amounts', () => {
  const preview = fixture([weekly('2026-01-01'), weekly('2026-01-02', '2026-01-02', 'Etc/UTC', ['10:00'])])
  const result = generate(preview, '2026-01-01', '2026-01-02')
  assert.deepEqual(result.events.map(e => e.segmentIndex), [0, 1]); assert.equal(new Set(result.events.map(e => e.id)).size, 2); assert.equal(preview.prescription.dose.amount, '1.2500')
})
test('invalid source envelopes cannot inflate live authority or bypass finite admission', () => {
  const preview = fixture([weekly('2026-01-01')])
  for (const patch of [{ syntheticOnly: false }, { clinicalApproval: true }, { professionalSignature: true }, { livePrescribing: true }, { externalNotifications: true }, { validUntil: NaN }, { observedAt: NaN }, { source: { ...preview.source, revision: 0 } }]) {
    const result = generate({ ...preview, ...patch }, '2026-01-01'); assert.equal(result.blocker, 'invalid_input'); assert.deepEqual(result.events, []); assert.equal(result.externalNotifications, false)
  }
})
test('idempotent preview diff cancels obsolete IDs on amendment/stop and creates none for another scope', () => {
  const segments = [weekly('2026-01-01')], original = generate(fixture(segments), '2026-01-01'), amended = generate(fixture(segments, 2), '2026-01-01')
  assert.deepEqual(reconcileReminderPreviews(original, original).cancelIds, []); assert.deepEqual(reconcileReminderPreviews(original, original).create, [])
  const delta = reconcileReminderPreviews(original, amended); assert.deepEqual(delta.cancelIds, original.events.map(e => e.id)); assert.deepEqual(delta.create, amended.events)
  const stopped = generate(fixture(segments, 1, 'stopped'), '2026-01-01'); assert.deepEqual(reconcileReminderPreviews(original, stopped).cancelIds, original.events.map(e => e.id)); assert.deepEqual(reconcileReminderPreviews(original, stopped).create, [])
  assert.deepEqual(reconcileReminderPreviews(original, { ...amended, binding: 'another-account' }).create, []); assert.equal(original.events.length, 1)
})
