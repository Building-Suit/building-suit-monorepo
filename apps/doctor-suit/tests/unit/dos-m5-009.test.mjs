import test from 'node:test'
import assert from 'node:assert/strict'
import { emptyReminderLifecycle, reconcileReminderLifecycle } from '../../app/utils/patientReminderLifecycle.ts'
import { reminderPreviewAlgorithm } from '../../app/utils/patientReminderPreview.ts'
import { id } from '../clinical-fixtures.mjs'
const now = Date.parse('2026-10-25T10:00:00Z'), binding = 'synthetic-patient-relationship-one'
function event(revision = 1, offset = 600000) {
  const source = { releaseId: id(699 + revision), versionId: id(300 + revision), revision, snapshotSha256: String(revision).repeat(64), prescriptionId: id(400) }, at = now + offset
  return { id: [reminderPreviewAlgorithm, source.releaseId, source.versionId, source.snapshotSha256, source.prescriptionId, 0, at].join(':'), source, segmentIndex: 0, occurrenceUtc: new Date(at).toISOString(), localDay: '2026-10-25', localTime: '10:10', timezone: 'Etc/UTC' }
}
const row = (value = event()) => ({ event: value, notAfter: Date.parse(value.occurrenceUtc) + 300000 })
const snapshot = (patch = {}) => ({ binding, revision: 1, observedAt: now, validUntil: now + 10800000, sourceState: 'active', schedulingPreviewAllowed: true, rows: [row()], reports: [], observations: [], syntheticOnly: true, clinicalApproval: false, externalNotifications: false, ...patch })
const initial = () => emptyReminderLifecycle(binding)
const first = () => reconcileReminderLifecycle(initial(), snapshot(), now)
const observe = (entry, status, at, version = 1) => ({ eventId: entry.event.id, attemptKey: entry.attemptKey, status, at, version })
const report = (version, claim, reference = 'synthetic-report-' + version) => ({ eventId: event().id, version, claim, reference, patientReported: true, clinicallyVerified: false })
test('missing/failed notification stays separate from occurrence and unreported adherence, with no compensating advice', () => {
  const seeded = first(), entry = seeded.next.entries[0]
  const result = reconcileReminderLifecycle(seeded.next, snapshot({ observations: [observe(entry, 'failed', now + 1000)] }), now + 1000)
  assert.equal(result.next.entries[0].notificationEvidence, 'failed'); assert.equal(result.next.entries[0].reportedState, 'unreported'); assert.equal(result.createIntents.length, 0); assert.equal(result.inspectKeys.length, 1); assert.equal(result.clinicalApproval, false); assert.equal(result.externalNotifications, false)
  for (const key of ['missedDose', 'compensatingDose', 'takeExtra', 'medicalAdvice']) assert.equal(key in result.next.entries[0], false)
  assert.equal(result.next.entries[0].event.occurrenceUtc, event().occurrenceUtc)
})
test('repeated reconciliation and a Node fixture checkpoint roundtrip inspect the same intent rather than blindly resending', () => {
  const seeded = first(); assert.equal(seeded.createIntents.length, 1)
  const checkpoint = JSON.parse(JSON.stringify(seeded.next)), again = reconcileReminderLifecycle(checkpoint, snapshot(), now + 1000)
  assert.equal(again.createIntents.length, 0); assert.equal(again.next.entries.length, 1); assert.deepEqual(again.inspectKeys, seeded.inspectKeys)
  const unknown = reconcileReminderLifecycle(again.next, snapshot({ observations: [observe(again.next.entries[0], 'unknown', now + 2000)] }), now + 2000)
  assert.equal(unknown.createIntents.length, 0); assert.equal(unknown.next.entries[0].reportedState, 'unreported')
})
test('stop tombstone suppresses a delayed old notification/action and preserves its original source', () => {
  const seeded = first(), stoppedSnapshot = snapshot({ revision: 2, sourceState: 'stopped' })
  const stopped = reconcileReminderLifecycle(seeded.next, stoppedSnapshot, now + 1000)
  assert.equal(stopped.cancelKeys.length, 1); assert.equal(stopped.next.entries[0].disposition, 'stopped')
  const late = reconcileReminderLifecycle(stopped.next, { ...stoppedSnapshot, observations: [observe(stopped.next.entries[0], 'presented_preview', now + 601000)] }, now + 601000)
  assert.equal(late.next.entries[0].notificationEvidence, 'late_or_invalid_presentation'); assert.equal(late.next.entries[0].canActForPreview, false); assert.equal(late.createIntents.length, 0); assert.equal(late.next.entries[0].event.source.versionId, id(301)); assert.equal(late.next.entries[0].reportedState, 'unreported')
  const staleReactivation = reconcileReminderLifecycle(late.next, snapshot({ revision: 3 }), now + 602000)
  assert.equal(staleReactivation.createIntents.length, 0); assert.equal(staleReactivation.next.entries[0].disposition, 'stopped')
})
test('amendment creates only a new future version, cancels the obsolete intent and rejects older source responses', () => {
  const seeded = first(), amendedSnapshot = snapshot({ revision: 2, rows: [row(event(2, 1200000))] })
  const amended = reconcileReminderLifecycle(seeded.next, amendedSnapshot, now + 1000)
  assert.equal(amended.cancelKeys.length, 1); assert.equal(amended.createIntents.length, 1); assert.equal(amended.createIntents[0].event.source.versionId, id(302))
  assert.equal(amended.next.entries.find(e => e.event.id === event().id).disposition, 'superseded')
  assert.throws(() => reconcileReminderLifecycle(amended.next, snapshot(), now + 2000))
  assert.equal(reconcileReminderLifecycle(amended.next, amendedSnapshot, now + 2000).createIntents.length, 0)
})
test('expiry is terminal and idempotent, with no inference of a missed dose or late catch-up notification', () => {
  const seeded = first(), at = row().notAfter
  const expired = reconcileReminderLifecycle(seeded.next, snapshot(), at)
  assert.equal(expired.cancelKeys.length, 1); assert.equal(expired.next.entries[0].disposition, 'expired'); assert.equal(expired.next.entries[0].reportedState, 'unreported')
  const repeat = reconcileReminderLifecycle(expired.next, snapshot(), at + 1000); assert.equal(repeat.cancelKeys.length, 0); assert.equal(repeat.createIntents.length, 0)
  const lateFirst = reconcileReminderLifecycle(initial(), snapshot(), now + 601000)
  assert.equal(lateFirst.next.entries[0].disposition, 'elapsed'); assert.equal(lateFirst.createIntents.length, 0)
})
test('source unknown/offline and reconnect cannot duplicate a previously issued event', () => {
  const seeded = first(), blocked = reconcileReminderLifecycle(seeded.next, snapshot({ revision: 2, sourceState: 'unknown', schedulingPreviewAllowed: false, rows: [] }), now + 1000)
  assert.equal(blocked.createIntents.length, 0); assert.equal(blocked.next.entries[0].canActForPreview, false)
  const reconnect = reconcileReminderLifecycle(blocked.next, snapshot({ revision: 3 }), now + 2000)
  assert.equal(reconnect.createIntents.length, 0); assert.equal(reconnect.inspectKeys.length, 1); assert.equal(reconnect.next.entries[0].reportedState, 'unreported')
})
test('report correction retains both patient-report references and does not resurrect the old reminder', () => {
  const seeded = first(), taken = reconcileReminderLifecycle(seeded.next, snapshot({ reports: [report(1, 'taken')] }), now + 1000)
  assert.equal(taken.next.entries[0].reportedState, 'taken'); assert.equal(taken.cancelKeys.length, 1); assert.equal(taken.next.entries[0].reportHistory[0].clinicallyVerified, false)
  const corrected = reconcileReminderLifecycle(taken.next, snapshot({ reports: [report(2, 'unreported')] }), now + 2000)
  assert.equal(corrected.next.entries[0].reportedState, 'unreported'); assert.equal(corrected.next.entries[0].reportHistory.length, 2); assert.equal(corrected.next.entries[0].disposition, 'retired_by_report'); assert.equal(corrected.createIntents.length, 0)
  assert.equal(taken.next.entries[0].reportedState, 'taken'); assert.equal(taken.next.entries[0].reportHistory.length, 1)
})
test('replaying an earlier presentation after a stop retains historical observation but never restores action eligibility', () => {
  const seeded = first(), observation = observe(seeded.next.entries[0], 'presented_preview', now + 601000)
  const shown = reconcileReminderLifecycle(seeded.next, snapshot({ observations: [observation] }), now + 601000)
  assert.equal(shown.next.entries[0].canActForPreview, true); assert.equal(shown.next.entries[0].reportedState, 'unreported')
  const stopped = reconcileReminderLifecycle(shown.next, snapshot({ revision: 2, sourceState: 'stopped', observations: [observation] }), now + 602000)
  assert.equal(stopped.next.entries[0].notificationEvidence, 'presentation_observed'); assert.equal(stopped.next.entries[0].canActForPreview, false)
  assert.equal(reconcileReminderLifecycle(stopped.next, snapshot({ revision: 2, sourceState: 'stopped', observations: [observation] }), now + 603000).createIntents.length, 0)
})
test('conflicting report/source/observation versions and missing provenance fail closed without rewriting history', () => {
  const seeded = first(), taken = reconcileReminderLifecycle(seeded.next, snapshot({ reports: [report(1, 'taken')] }), now + 1000)
  assert.throws(() => reconcileReminderLifecycle(taken.next, snapshot({ reports: [report(1, 'skip')] }), now + 2000))
  assert.throws(() => reconcileReminderLifecycle(seeded.next, snapshot({ reports: [report(2, 'taken')] }), now + 2000))
  assert.throws(() => reconcileReminderLifecycle(seeded.next, snapshot({ sourceState: 'stopped' }), now + 2000))
  assert.throws(() => reconcileReminderLifecycle(seeded.next, snapshot({ observations: [{ ...observe(seeded.next.entries[0], 'failed', now + 1000), attemptKey: 'foreign' }] }), now + 2000))
  assert.equal(taken.next.entries[0].reportedState, 'taken')
})
test('foreign scope, stale/invalid clock/lease, fabricated authority or absent expiry never yields a guessed action', () => {
  const seeded = first()
  for (const patch of [{ binding: 'foreign-patient' }, { clinicalApproval: true }, { externalNotifications: true }, { validUntil: now }, { rows: [{ ...row(), notAfter: null }] }]) assert.throws(() => reconcileReminderLifecycle(seeded.next, snapshot(patch), now + 1000))
  assert.throws(() => reconcileReminderLifecycle(seeded.next, snapshot(), now - 1))
  assert.throws(() => reconcileReminderLifecycle({ ...seeded.next, lastClock: NaN }, snapshot(), now + 1000))
  const bad = JSON.parse(JSON.stringify(seeded.next)); bad.entries[0].issuedAt = null; bad.entries[0].observationVersion = 1
  assert.throws(() => reconcileReminderLifecycle(bad, snapshot(), now + 1000))
})
test('terminal checkpoint capacity never evicts old IDs into restart rescheduling', () => {
  const rows = Array.from({ length: 512 }, (_, i) => row(event(1, 600000 + i * 60000)))
  const stopped = reconcileReminderLifecycle(initial(), snapshot({ sourceState: 'stopped', rows }), now)
  assert.equal(stopped.next.entries.length, 512)
  assert.throws(() => reconcileReminderLifecycle(stopped.next, snapshot({ revision: 2, rows: [row(event(2))] }), now + 1000))
  assert.equal(stopped.next.entries.length, 512); assert.equal(stopped.createIntents.length, 0)
  const reports = Array.from({ length: 512 }, (_, i) => report(i + 1, 'taken'))
  const history = reconcileReminderLifecycle(first().next, snapshot({ reports }), now + 1000)
  assert.throws(() => reconcileReminderLifecycle(history.next, snapshot({ reports: [report(513, 'unreported')] }), now + 2000))
  assert.equal(history.next.entries[0].reportHistory.length, 512)
})
