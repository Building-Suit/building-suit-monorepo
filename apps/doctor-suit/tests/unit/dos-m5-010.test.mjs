import test from 'node:test'
import assert from 'node:assert/strict'
import { createPatientReportPreview } from '../../app/utils/patientReportPreview.ts'
import { patientReportHistoryPreview } from '../../app/utils/patientReportHistoryPreview.ts'
import { reminderPreviewAlgorithm } from '../../app/utils/patientReminderPreview.ts'
import { id } from '../clinical-fixtures.mjs'
const now = Date.parse('2026-10-25T10:00:00Z')
function fixture() {
  const source = { releaseId: id(700), versionId: id(301), revision: 1, snapshotSha256: 'a'.repeat(64), prescriptionId: id(400) }
  const event = { id: [reminderPreviewAlgorithm, source.releaseId, source.versionId, source.snapshotSha256, source.prescriptionId, 0, now].join(':'), source, segmentIndex: 0, occurrenceUtc: new Date(now).toISOString(), localDay: '2026-10-25', localTime: '10:00', timezone: 'Etc/UTC' }
  let admission = { accountId: id(4), sessionId: id(14), patientId: id(200), relationshipId: id(900), relationshipVersion: 2, reporterKind: 'patient', actions: ['read', 'report', 'correct', 'snooze'], validUntil: now + 3600000, syntheticOnly: true, legalApproval: false }
  const ledger = createPatientReportPreview({ admission: () => admission, now: () => now, policy: () => ({ sourceState: 'active', reportingAllowed: true, notificationPreviewAllowed: true, snoozeNotAfter: now + 2700000, nextKind: 'known_next', nextOccurrenceAt: now + 1800000, qualifiedInterpretation: false }) })
  ledger.register({ patientId: id(200), relationshipId: id(900), relationshipVersion: 2 }, event)
  const input = (key, kind, expectedVersion = 0) => ({ key: id(key), eventId: event.id, expectedVersion, patientTime: now, kind })
  return { ledger, event, input, view: () => ledger.read(event.id), setAdmission: value => { admission = value }, admission: () => admission }
}
const owner = () => ({ patientId: id(200), patientAccountId: id(4), relationshipId: id(900), relationshipVersion: 2, doctorId: id(1), practiceId: id(101), locationId: id(102), consentVersion: 4, releaseVersion: 2 })
const viewer = () => ({ environment: 'synthetic', portal: 'patient', accountId: id(4), sessionId: id(14), patientId: id(200), relationshipId: id(900), relationshipVersion: 2, doctorId: null, practiceId: null, locationId: null, permissions: ['report_history.read'], checkedAt: now, validUntil: now + 3600000, syntheticOnly: true, legalApproval: false })
const doctor = () => ({ ...viewer(), portal: 'doctor', accountId: id(1), sessionId: id(11), doctorId: id(1), practiceId: id(101), locationId: id(102) })
const grant = (recipient = id(1), kind = 'doctor_share') => ({ id: id(970), kind, grantorAccountId: id(4), recipientAccountId: recipient, patientId: id(200), relationshipId: id(900), relationshipVersion: 2, doctorId: id(1), practiceId: id(101), locationId: id(102), purpose: 'report_history.read', sourceVersionIds: [id(301)], consentVersion: 4, releaseVersion: 2, authorityRef: 'synthetic-history-review', validFrom: now - 1000, validUntil: now + 3600000, revokedAt: null, syntheticOnly: true, legalApproval: false })
const project = (view, conflicts = []) => patientReportHistoryPreview(owner(), view, conflicts, viewer(), null, now)
test('taken and correction retain actor/source/version/reason provenance without deleting the original claim', () => {
  const f = fixture(); f.ledger.command(f.input(901, 'taken'))
  const before = project(f.view()); f.ledger.command({ ...f.input(902, 'correct', 1), report: 'skip', reason: 'Synthetic mistaken-taken correction' })
  const result = project(f.view()); assert.equal(result.entries.length, 2); assert.equal(result.entries[0].reportedState, 'taken'); assert.equal(result.entries[1].reportedState, 'skip'); assert.equal(result.entries[1].correctsVersion, 1); assert.equal(result.entries[1].reason, 'Synthetic mistaken-taken correction'); assert.equal(result.entries[0].actorAccountId, id(4)); assert.equal(result.entries[0].sourceVersionId, id(301)); assert.equal(before.entries.length, 1); assert.equal(before.acceptedReportedState, 'taken'); assert.equal(result.clinicallyVerified, false); assert.equal(result.qualifiedSharing, false)
  assert.throws(() => result.entries.push({}))
})
test('independent caregiver reports preserve their named actor and explicit limited history grant', () => {
  const f = fixture(); f.setAdmission({ ...f.admission(), accountId: id(5), sessionId: id(15), reporterKind: 'caregiver' }); f.ledger.command(f.input(901, 'taken'))
  const caregiver = { ...viewer(), portal: 'caregiver', accountId: id(5), sessionId: id(15) }
  assert.equal(patientReportHistoryPreview(owner(), f.view(), [], caregiver, null, now), null)
  const result = patientReportHistoryPreview(owner(), f.view(), [], caregiver, grant(id(5), 'caregiver'), now)
  assert.equal(result.entries[0].reporterKind, 'caregiver'); assert.equal(result.entries[0].actorAccountId, id(5)); assert.equal(result.entries[0].patientReported, true); assert.equal(result.entries[0].clinicallyVerified, false)
  assert.equal(patientReportHistoryPreview(owner(), f.view(), [], { ...caregiver, patientId: id(201) }, grant(id(5), 'caregiver'), now), null)
  assert.equal(patientReportHistoryPreview({ ...owner(), patientAccountId: null }, f.view(), [], viewer(), null, now), null)
  assert.equal(patientReportHistoryPreview({ ...owner(), patientAccountId: null }, f.view(), [], caregiver, grant(id(5), 'caregiver'), now).qualifiedSharing, false)
})
test('unverified device clock and server ordering remain separate from authoritative version order', () => {
  const f = fixture(); f.ledger.command(f.input(901, 'taken')); f.ledger.command({ ...f.input(902, 'correct', 1), report: 'skip', reason: 'Synthetic correction' })
  const raw = structuredClone(f.view()); raw.history[0].patientTime = null; raw.history[1].patientTime = now + 86400000; raw.history[1].recordedAt = now - 1000
  const result = project(raw); assert.deepEqual(result.entries.map(e => e.version), [1, 2]); assert.equal(result.entries[0].deviceTimeState, 'not_provided'); assert.equal(result.entries[1].deviceTimeState, 'reported_after_server'); assert.equal(result.entries[1].serverClockOutOfOrder, true); assert.equal(result.entries[1].deviceReportedAt, now + 86400000); assert.equal(result.entries[1].serverRecordedAt, now - 1000); assert.equal(result.entries[1].timingUncertain, true); assert.equal(result.clinicallyVerified, false)
})
test('unresolved report conflicts stay visible instead of becoming a conclusive adherence score', () => {
  const f = fixture(); f.ledger.command(f.input(901, 'taken'))
  const conflict = { id: id(980), expectedVersion: 0, observedVersion: 1, proposedReport: 'skip', actorAccountId: id(5), reporterKind: 'caregiver', deviceReportedAt: now - 10000, serverRecordedAt: now }
  const result = project(f.view(), [conflict]); assert.equal(result.acceptedReportedState, 'taken'); assert.equal(result.displayedReportedState, 'uncertain'); assert.equal(result.conflicts[0].state, 'unresolved'); assert.equal(result.conflicts[0].clinicallyVerified, false)
  for (const key of ['adherenceScore', 'diagnosis', 'doseAdvice', 'treatmentChange', 'verifiedAdministration']) assert.equal(key in result, false)
})
test('doctor role/contact metadata alone cannot read history; another doctor or source version is denied', () => {
  const f = fixture(); f.ledger.command(f.input(901, 'taken'))
  assert.equal(patientReportHistoryPreview(owner(), f.view(), [], doctor(), null, now), null)
  assert.equal(patientReportHistoryPreview(owner(), f.view(), [], { ...doctor(), email: 'same@example.test', clinician: true }, null, now), null)
  for (const patch of [{ doctorId: id(2) }, { accountId: id(2) }, { practiceId: id(103) }, { locationId: id(104) }, { portal: 'secretary' }]) assert.equal(patientReportHistoryPreview(owner(), f.view(), [], { ...doctor(), ...patch }, grant(), now), null)
  assert.equal(patientReportHistoryPreview(owner(), f.view(), [], doctor(), { ...grant(), sourceVersionIds: [id(302)] }, now), null)
})
test('matching synthetic purpose/recipient/source consent-release scope projects minimum history and omits Auth session identifiers', () => {
  const f = fixture(); f.ledger.command(f.input(901, 'taken'))
  const result = patientReportHistoryPreview(owner(), f.view(), [], doctor(), grant(), now)
  assert.equal(result.entries.length, 1); assert.equal(result.entries[0].actorAccountId, id(4)); assert.equal('actorSessionId' in result.entries[0], false); assert.equal(result.qualifiedSharing, false); assert.equal(result.syntheticOnly, true); assert.equal(result.clinicalApproval, false); assert.equal(result.externalNotifications, false)
  const raw = structuredClone(f.view()); raw.event.source.privateNote = 'private'; assert.equal('privateNote' in project(raw).source, false)
})
test('revocation, changed consent/release/relationship, expiry and unavailable permission suppress the next projection', () => {
  const f = fixture(); f.ledger.command(f.input(901, 'taken'))
  for (const patch of [{ revokedAt: now }, { consentVersion: 3 }, { releaseVersion: 1 }, { relationshipVersion: 1 }, { purpose: 'marketing' }, { validUntil: now }, { legalApproval: true }]) assert.equal(patientReportHistoryPreview(owner(), f.view(), [], doctor(), { ...grant(), ...patch }, now), null)
  for (const patch of [{ permissions: [] }, { accountId: id(99) }, { validUntil: now }, { checkedAt: now + 1 }, { environment: 'production' }]) assert.equal(patientReportHistoryPreview(owner(), f.view(), [], { ...viewer(), ...patch }, null, now), null)
})
test('unknown administration remains unreported; snooze is separate from regimen/adherence and correction cannot invent a first report', () => {
  const f = fixture(); f.ledger.command({ ...f.input(901, 'snooze'), until: now + 600000 })
  const result = project(f.view()); assert.equal(result.acceptedReportedState, 'unreported'); assert.equal(result.notificationSnoozeUntil, now + 600000); assert.equal(result.originalOccurrenceUtc, f.event.occurrenceUtc)
  const raw = structuredClone(f.view()); raw.history.push({ ...raw.history[0], version: 2, kind: 'correct', report: 'taken', snoozeUntil: null, correctsVersion: 1, reason: 'Fabricated initial correction' }); raw.version = 2; raw.report = 'taken'
  assert.throws(() => project(raw))
})
test('gaps, forged clinical verification, foreign provenance and conflicting duplicate conflicts fail closed', () => {
  const f = fixture(); f.ledger.command(f.input(901, 'taken'))
  for (const change of [v => { v.history[0].version = 2 }, v => { v.history[0].clinicallyVerified = true }, v => { v.clinicallyVerified = true }, v => { v.history[0].source.versionId = id(302) }, v => { v.history[0].originalOccurrenceUtc = new Date(now + 60000).toISOString() }]) { const raw = structuredClone(f.view()); change(raw); assert.throws(() => project(raw)) }
  const conflict = { id: id(980), expectedVersion: 0, observedVersion: 1, proposedReport: 'skip', actorAccountId: id(5), reporterKind: 'caregiver', deviceReportedAt: now, serverRecordedAt: now }
  assert.throws(() => project(f.view(), [conflict, conflict]))
})
