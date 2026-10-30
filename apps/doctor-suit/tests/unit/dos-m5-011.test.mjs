import test from 'node:test'
import assert from 'node:assert/strict'
import { planPatientActionSync, planPatientNotificationOwner, patientActionPreviewIntent } from '../../app/utils/patientDeviceSyncPreview.ts'
import { reminderPreviewAlgorithm } from '../../app/utils/patientReminderPreview.ts'
import { id } from '../clinical-fixtures.mjs'
const now = Date.parse('2026-10-25T10:00:00Z'), binding = 'synthetic-patient-relationship-one'
function event() { const source = { releaseId: id(700), versionId: id(301), revision: 1, snapshotSha256: 'a'.repeat(64), prescriptionId: id(400) }, at = now + 600000; return { id: [reminderPreviewAlgorithm, source.releaseId, source.versionId, source.snapshotSha256, source.prescriptionId, 0, at].join(':'), source, segmentIndex: 0, occurrenceUtc: new Date(at).toISOString(), localDay: '2026-10-25', localTime: '10:10', timezone: 'Etc/UTC' } }
const installation = (n = 1) => ({ id: id(800 + n), generation: 1, actorAccountId: id(4), binding, registeredRevision: 1, validUntil: now + 3600000, revokedAt: null })
const context = () => ({ binding, actorAccountId: id(4), revision: 3, minimumRevision: 2, checkedAt: now, validUntil: now + 3600000, installations: [installation(1), installation(2)], syntheticOnly: true, clinicalApproval: false })
const server = () => ({ ...context(), events: [{ eventId: event().id, version: 0, reportedState: 'unreported', patientReported: true, clinicallyVerified: false }], receipts: [] })
const proposal = (key = 901, kind = 'taken', device = 1) => ({ installationId: id(800 + device), command: { key: id(key), eventId: event().id, expectedVersion: 0, patientTime: now, kind }, outcome: 'unsubmitted', deviceTimezone: 'Etc/UTC' })
const policy = (device = 1) => ({ mode: 'single_owner', ownerInstallationId: id(800 + device), qualifiedPolicy: false })
const lease = (status = 'issued') => ({ binding, actorAccountId: id(4), eventId: event().id, ownerInstallationId: id(801), generation: 1, registryRevision: 2, attemptKey: event().id + ':installation:' + id(801) + ':1', status })
const ownership = (ctx = context(), p = policy(), l = null, at = now, active = true) => planPatientNotificationOwner(ctx, event(), now + 900000, active, p, l, at)
test('conflicting staged reports reconcile identically in opposite orders without choosing by device clock or mutating anything', () => {
  const a = proposal(), b = proposal(902, 'skip', 2); a.command.patientTime = now - 1000; b.command.patientTime = now - 86400000
  const first = planPatientActionSync(server(), [a, b], now), reverse = planPatientActionSync(server(), [b, a], now)
  assert.deepEqual(first, reverse); assert.equal(first.conflicts.length, 1); assert.equal(first.conflicts[0].winner, null); assert.equal(first.conflicts[0].state, 'unresolved'); assert(first.decisions.every(d => d.status === 'needs_explicit_resolution')); assert.deepEqual(first.automaticMutations, []); assert.equal(first.clinicallyVerified, false)
})
test('lost acknowledgement is inspected before retry, while known exact receipts never overwrite a newer correction', () => {
  const p = { ...proposal(), outcome: 'unknown' }, s = server(); s.events[0].version = 2; s.events[0].reportedState = 'skip'
  assert.equal(planPatientActionSync(s, [p], now).decisions[0].status, 'lookup_receipt')
  s.receipts = [{ key: p.command.key, intent: patientActionPreviewIntent(p.command), eventId: event().id, version: 1, status: 'recorded' }]
  const result = planPatientActionSync(s, [p], now); assert.equal(result.decisions[0].status, 'recorded_on_server'); assert.equal(result.decisions[0].receiptVersion, 1); assert.equal(result.serverEvents[0].version, 2); assert.equal(result.serverEvents[0].reportedState, 'skip'); assert.deepEqual(result.automaticMutations, [])
  assert.equal(planPatientActionSync(s, [{ ...p, command: { ...p.command, kind: 'skip' } }], now).decisions[0].status, 'key_reused')
})
test('one logical request copied between devices has one stable key; changed payload cannot share that key', () => {
  const p = proposal(), repeated = { ...proposal(), installationId: id(802), deviceTimezone: 'Asia/Tokyo' }
  const result = planPatientActionSync(server(), [repeated, p], now); assert.deepEqual(result.decisions.map(d => d.status), ['ready_for_explicit_submit', 'duplicate_logical_request']); assert.equal(result.requiresServerValidation, true)
  const changed = { ...repeated, command: { ...repeated.command, kind: 'skip' } }
  assert(planPatientActionSync(server(), [p, changed], now).decisions.every(d => d.status === 'key_reused'))
  const revoked = server(); revoked.installations[0].revokedAt = now
  assert.deepEqual(planPatientActionSync(revoked, [p, repeated], now).decisions.map(d => d.status), ['device_unavailable', 'ready_for_explicit_submit'])
})
test('revoked, expired, unrelated or reinstalled old registrations cannot submit/reclaim ownership', () => {
  for (const patch of [{ revokedAt: now }, { validUntil: now }, { actorAccountId: id(5) }, { binding: 'other-patient' }]) {
    const ctx = context(); Object.assign(ctx.installations[0], patch)
    assert.equal(planPatientActionSync({ ...server(), ...ctx }, [proposal()], now).decisions[0].status, 'device_unavailable'); assert.equal(ownership(ctx).action, 'owner_unavailable')
  }
  const ctx = context(); ctx.installations[0].revokedAt = now
  assert.equal(ownership(ctx, policy(2), lease('unknown')).action, 'cancel_then_inspect')
})
test('unknown ownership policy disables proposals and no permission/result invents real notification delivery', () => {
  const result = ownership(context(), { mode: 'unknown', ownerInstallationId: null, qualifiedPolicy: false })
  assert.equal(result.action, 'disabled_no_policy'); assert.equal(result.newAttemptKey, null); assert.equal(result.externalNotifications, false); assert.equal(result.qualifiedDevicePolicy, false)
  for (const field of ['delivered', 'taken', 'clinicalAdvice']) assert.equal(field in result, false)
})
test('single-owner attempt key is stable across device timezone/clock changes and an issued attempt is only inspected', () => {
  const first = ownership(), again = ownership(); assert.deepEqual(first, again); assert.equal(first.action, 'propose_once'); assert.equal(first.requiresAtomicServerClaim, true)
  const held = ownership(context(), policy(), lease('unknown')); assert.equal(held.action, 'already_owned'); assert.equal(held.newAttemptKey, null); assert.equal(held.inspectAttemptKey, first.newAttemptKey)
  const s = server(); const p = proposal(); p.deviceTimezone = 'Pacific/Auckland'; assert.equal(planPatientActionSync(s, [p], now).decisions[0].key, proposal().command.key)
})
test('ownership handoff waits for actual old cancellation confirmation, keeping one logical event ID', () => {
  const pending = ownership(context(), policy(2), lease('scheduled')); assert.equal(pending.action, 'cancel_then_inspect'); assert.equal(pending.newAttemptKey, null); assert.equal(pending.cancelAttemptKey, lease().attemptKey)
  const confirmed = ownership(context(), policy(2), lease('cancel_confirmed')); assert.equal(confirmed.action, 'propose_once'); assert.notEqual(confirmed.newAttemptKey, lease().attemptKey); assert.equal(confirmed.eventId, lease().eventId); assert.equal(confirmed.expectedRegistryRevision, context().revision)
})
test('source stop, expired/elapsed window and stale registry prevent resurrection or late compensating events', () => {
  const stopped = ownership(context(), policy(), lease(), now, false); assert.equal(stopped.action, 'retire'); assert.equal(stopped.newAttemptKey, null)
  assert.equal(ownership(context(), policy(), null, now + 600001).action, 'elapsed_no_catchup')
  assert.equal(ownership(context(), policy(), lease(), now + 900000).action, 'retire')
  assert.equal(ownership(context(), policy(), lease('retired')).action, 'retire')
  assert.equal(ownership(context(), policy(), lease('cancel_confirmed')).newAttemptKey, null)
  assert.throws(() => ownership({ ...context(), revision: 1 })); assert.throws(() => planPatientActionSync({ ...server(), revision: 1 }, [proposal()], now))
})
test('stale action versions, invalid intent fields and future device time remain explicit without automatic mutation', () => {
  const s = server(); s.events[0].version = 2; s.events[0].reportedState = 'skip'
  assert.equal(planPatientActionSync(s, [proposal()], now).decisions[0].status, 'version_conflict')
  const future = proposal(); future.command.patientTime = now + 86400000; assert.equal(planPatientActionSync(server(), [future], now).decisions[0].status, 'device_clock_uncertain')
  assert.throws(() => planPatientActionSync(server(), [{ ...proposal(), command: { ...proposal().command, dose: 2 } }], now))
  assert.throws(() => ownership(context(), policy(2), { ...lease(), attemptKey: 'foreign-notification' }))
  assert.throws(() => ownership({ ...context(), clinicalApproval: true }))
})

test('an unknown outcome on any copy of one logical request takes precedence over a new submission', () => {
  const fresh = proposal(), unknown = { ...proposal(), installationId: id(802), outcome: 'unknown' }
  const result = planPatientActionSync(server(), [fresh, unknown], now)
  assert(result.decisions.every(d => d.status === 'lookup_receipt')); assert.deepEqual(result.automaticMutations, [])
})
