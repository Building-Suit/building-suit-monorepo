import test from 'node:test'
import assert from 'node:assert/strict'
import { patientPrescriptionPreview } from '../../app/utils/patientPrescriptionPreview.ts'
import { patientReminderPreview } from '../../app/utils/patientReminderPreview.ts'
import { createPatientReportPreview } from '../../app/utils/patientReportPreview.ts'
import { emptyReminderLifecycle, reconcileReminderLifecycle } from '../../app/utils/patientReminderLifecycle.ts'
import { patientReportHistoryPreview } from '../../app/utils/patientReportHistoryPreview.ts'
import { planPatientActionSync, patientActionPreviewIntent, planPatientNotificationOwner } from '../../app/utils/patientDeviceSyncPreview.ts'
import { patientAccessiblePrescription } from '../../app/utils/patientAccessiblePreview.ts'
import { id, released, snapshot, hash } from '../clinical-fixtures.mjs'
const now = Date.parse('2026-10-25T10:00:00Z'), expiry = now + 7200000
function fixture(revision = 1, times = ['10:10', '10:40'], zone = 'Etc/UTC', day = '2026-10-25') {
 const release = { ...released(), release_id: id(699 + revision), version_id: id(300 + revision), revision, finalized_at: '2026-10-24T10:00:00Z', expires_at: new Date(expiry).toISOString() }
 const p = release.prescriptions[0]; p.start_date = day; p.end_date = day; p.instructions = 'Exact entered instructions / تعليمات مدخلة كاملة'; p.segments = [{ kind: 'weekdays', start_date: day, end_date: day, timezone: zone, interval_minutes: null, weekdays: [1, 2, 3, 4, 5, 6, 7], times, instructions: 'Original entered segment / المقطع المدخل الأصلي' }]
 const canonical = JSON.stringify({ ...snapshot(), prescriptions: release.prescriptions }); release.snapshot_sha256 = hash(canonical)
 const scope = { environment: 'synthetic', portal: 'patient', accountId: id(4), sessionId: id(14), patientId: id(200), validUntil: expiry, relationships: [{ id: id(900), version: 1, doctorId: id(1), practiceId: id(101), locationIds: [id(102)] }] }
 const raw = { timeline_page: { account_id: id(4), patient_id: id(200), page: 0, page_size: 20, total: 1, rows: [{ relationship_id: id(900), relationship_version: 1, doctor_id: id(1), practice_id: id(101), location_id: id(102), revoked: false, release }], data_mode: 'synthetic', clinical_approval: false, live_prescribing: false }, prescription_id: id(400), current: { version_id: release.version_id, revision, snapshot_sha256: release.snapshot_sha256, status: 'active', checked_at: now, valid_until: expiry } }
 const request = { releaseId: release.release_id, prescriptionId: id(400) }, preview = patientPrescriptionPreview(raw, scope, request, now)
 const plan = patientReminderPreview(preview, { fromDay: day, toDay: day }, [], now)
 return { raw, scope, request, preview, plan, canonical }
}
const admission = () => ({ accountId: id(4), sessionId: id(14), patientId: id(200), relationshipId: id(900), relationshipVersion: 1, reporterKind: 'patient', actions: ['read', 'report', 'correct', 'snooze'], validUntil: expiry, syntheticOnly: true, legalApproval: false })
const input = (event, key = 901, kind = 'taken', expectedVersion = 0, at = now) => ({ key: id(key), eventId: event.id, expectedVersion, patientTime: at, kind })
function ledgerFor(event) {
 let selected = admission(), at = now, state = 'active'
 const ledger = createPatientReportPreview({ admission: () => selected, now: () => at, policy: () => ({ sourceState: state, reportingAllowed: true, notificationPreviewAllowed: state === 'active', snoozeNotAfter: expiry, nextKind: 'known_next', nextOccurrenceAt: Date.parse(event.occurrenceUtc) + 1800000, qualifiedInterpretation: false }) })
 ledger.register({ patientId: id(200), relationshipId: id(900), relationshipVersion: 1 }, event)
 return { ledger, clock: v => { at = v }, revoke: () => { selected = null }, stop: () => { state = 'stopped' } }
}
function lifecycleSnapshot(f, revision = 1, state = 'active') { return { binding: f.plan.binding, revision, observedAt: now, validUntil: expiry, sourceState: state, schedulingPreviewAllowed: state === 'active', rows: f.plan.events.map(event => ({ event, notAfter: Date.parse(event.occurrenceUtc) + 300000 })), reports: [], observations: [], syntheticOnly: true, clinicalApproval: false, externalNotifications: false } }
const registry = (binding) => ({ binding, actorAccountId: id(4), revision: 1, minimumRevision: 1, checkedAt: now, validUntil: expiry, installations: [1, 2].map(n => ({ id: id(800 + n), generation: 1, actorAccountId: id(4), binding, registeredRevision: 1, validUntil: expiry, revokedAt: null })), syntheticOnly: true, clinicalApproval: false })
test('synthetic released regimen → generated event → patient report/correction retains exact source and never changes prescription or verifies administration', () => {
 const f = fixture(), event = f.plan.events[0], before = structuredClone(f.raw), tx = ledgerFor(event), at = Date.parse(event.occurrenceUtc)
 assert.equal(f.plan.events.length, 2); assert.equal(event.source.snapshotSha256, hash(f.canonical)); assert.equal(event.source.versionId, f.preview.source.versionId); assert.equal(f.preview.professionalSignature, false)
 tx.clock(at); const first = input(event, 901, 'taken', 0, at); assert.equal(tx.ledger.command(first).status, 'recorded'); assert.equal(tx.ledger.command(first).replayed, true)
 const corrected = { ...input(event, 902, 'correct', 1, at), report: 'skip', reason: 'Synthetic mistaken report correction' }; assert.equal(tx.ledger.command(corrected).status, 'recorded')
 const owner = { patientId: id(200), patientAccountId: id(4), relationshipId: id(900), relationshipVersion: 1, doctorId: id(1), practiceId: id(101), locationId: id(102), consentVersion: 1, releaseVersion: 1 }
 const viewer = { environment: 'synthetic', portal: 'patient', accountId: id(4), sessionId: id(14), patientId: id(200), relationshipId: id(900), relationshipVersion: 1, doctorId: null, practiceId: null, locationId: null, permissions: ['report_history.read'], checkedAt: at, validUntil: expiry, syntheticOnly: true, legalApproval: false }
 const history = patientReportHistoryPreview(owner, tx.ledger.read(event.id), [], viewer, null, at)
 assert.equal(history.entries.length, 2); assert.equal(history.entries[1].correctsVersion, 1); assert.equal(history.entries[1].sourceVersionId, event.source.versionId); assert.equal(history.acceptedReportedState, 'skip'); assert.equal(history.clinicallyVerified, false); assert.equal(history.qualifiedSharing, false); assert.deepEqual(f.raw, before); assert.equal(hash(f.canonical), event.source.snapshotSha256)
})
test('generated source amendment cancels old intents and only proposes new future events; stop remains terminal and notification failure implies no missed dose', () => {
 const f = fixture(), first = reconcileReminderLifecycle(emptyReminderLifecycle(f.plan.binding), lifecycleSnapshot(f), now)
 assert.equal(first.createIntents.length, 2)
 const failed = reconcileReminderLifecycle(first.next, { ...lifecycleSnapshot(f), observations: [{ eventId: f.plan.events[0].id, attemptKey: first.next.entries[0].attemptKey, status: 'failed', at: now + 1, version: 1 }] }, now + 1)
 assert.equal(failed.next.entries[0].reportedState, 'unreported'); assert.equal(failed.createIntents.length, 0)
 const amended = fixture(2, ['11:00']), updated = reconcileReminderLifecycle(failed.next, lifecycleSnapshot(amended, 2), now + 2)
 assert.equal(updated.cancelKeys.length, 2); assert.equal(updated.createIntents.length, 1); assert.equal(updated.createIntents[0].event.source.versionId, id(302)); assert(updated.next.entries.filter(e => e.event.source.versionId === id(301)).every(e => e.disposition === 'superseded'))
 const stopped = reconcileReminderLifecycle(updated.next, lifecycleSnapshot(amended, 3, 'stopped'), now + 3); assert.equal(stopped.cancelKeys.length, 1); assert.equal(stopped.createIntents.length, 0)
 assert.equal(reconcileReminderLifecycle(stopped.next, lifecycleSnapshot(amended, 4), now + 4).createIntents.length, 0); assert.equal(stopped.clinicalApproval, false); assert.equal(stopped.externalNotifications, false)
})
test('actual memory-ledger acknowledgement loss reconciles by the original key and cannot replace a newer correction or submit automatically', () => {
 const f = fixture(), event = f.plan.events[0], tx = ledgerFor(event), at = Date.parse(event.occurrenceUtc); tx.clock(at)
 const command = input(event, 901, 'taken', 0, at); tx.ledger.command(command); tx.ledger.command({ ...input(event, 902, 'correct', 1, at), report: 'skip', reason: 'Synthetic corrected claim' })
 const server = { ...registry(f.plan.binding), events: [{ eventId: event.id, version: tx.ledger.read(event.id).version, reportedState: tx.ledger.read(event.id).report, patientReported: true, clinicallyVerified: false }], receipts: [] }
 const proposal = { installationId: id(801), command, outcome: 'unknown', deviceTimezone: 'Pacific/Auckland' }
 assert.equal(planPatientActionSync(server, [proposal], at).decisions[0].status, 'lookup_receipt')
 server.receipts.push({ key: command.key, intent: patientActionPreviewIntent(command), eventId: event.id, version: 1, status: 'recorded' })
 const result = planPatientActionSync(server, [proposal], at); assert.equal(result.decisions[0].status, 'recorded_on_server'); assert.equal(result.decisions[0].receiptVersion, 1); assert.equal(result.serverEvents[0].version, 2); assert.equal(result.serverEvents[0].reportedState, 'skip'); assert.deepEqual(result.automaticMutations, []); assert.equal(tx.ledger.read(event.id).history.length, 2)
})
test('withdrawal denies report replay and accessible content; absent ownership approval disables actual-notification proposals for the same generated event', () => {
 const f = fixture(), event = f.plan.events[0], tx = ledgerFor(event), command = input(event); assert.equal(tx.ledger.command(command).status, 'recorded'); tx.revoke(); assert.equal(tx.ledger.command(command).status, 'denied'); assert.equal(tx.ledger.read(event.id), null)
 const view = patientAccessiblePrescription(f.raw, f.scope, f.request, { scopeKey: JSON.stringify(f.scope), network: 'online', foreground: true, revoked: true, lastSuccessfulReadAt: now, notification: 'permission_reported' }, 'ar', now); assert.equal(view.privateContent, null); assert.equal(view.deliveryConfirmed, false)
 const ownership = planPatientNotificationOwner(registry(f.plan.binding), event, Date.parse(event.occurrenceUtc) + 300000, true, { mode: 'unknown', ownerInstallationId: null, qualifiedPolicy: false }, null, now); assert.equal(ownership.action, 'disabled_no_policy'); assert.equal(ownership.newAttemptKey, null); assert.equal(ownership.externalNotifications, false)
})
test('travel/DST ambiguity and unreviewed source cannot be promoted into a qualified schedule or real alarm', () => {
 const f = fixture(1, ['01:30'], 'America/New_York', '2026-11-01'); assert.equal(f.plan.blocker, 'dst_fold'); assert.deepEqual(f.plan.events, []); assert.equal(f.plan.qualifiedInterpretation, false); assert.equal(f.plan.clinicalApproval, false); assert.equal(f.plan.externalNotifications, false)
 const regular = fixture(); assert.equal(regular.plan.outcome, 'ready_for_review'); assert.equal(regular.plan.qualifiedInterpretation, false); assert.equal(regular.preview.professionalSignature, false)
})
