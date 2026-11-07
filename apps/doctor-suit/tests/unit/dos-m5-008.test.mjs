import test from 'node:test'
import assert from 'node:assert/strict'
import { createPatientReportPreview } from '../../app/utils/patientReportPreview.ts'
import { reminderPreviewAlgorithm } from '../../app/utils/patientReminderPreview.ts'
import { id } from '../clinical-fixtures.mjs'
const now = Date.parse('2026-10-25T10:00:00Z')
function event() {
  const source = { releaseId: id(700), versionId: id(301), revision: 1, snapshotSha256: 'a'.repeat(64), prescriptionId: id(400) }
  return { id: [reminderPreviewAlgorithm, source.releaseId, source.versionId, source.snapshotSha256, source.prescriptionId, 0, now].join(':'), source, segmentIndex: 0, occurrenceUtc: new Date(now).toISOString(), localDay: '2026-10-25', localTime: '10:00', timezone: 'Etc/UTC' }
}
const admission = () => ({ accountId: id(4), sessionId: id(14), patientId: id(200), relationshipId: id(900), relationshipVersion: 2, reporterKind: 'patient', actions: ['read', 'report', 'correct', 'snooze'], validUntil: now + 3600000, syntheticOnly: true, legalApproval: false })
const policy = () => ({ sourceState: 'active', reportingAllowed: true, notificationPreviewAllowed: true, snoozeNotAfter: now + 2700000, nextKind: 'known_next', nextOccurrenceAt: now + 1800000, qualifiedInterpretation: false })
const command = (key = 901, kind = 'taken', expectedVersion = 0) => ({ key: id(key), eventId: event().id, expectedVersion, patientTime: now, kind })
function fixture() {
  let selected = admission(), currentPolicy = policy(), clock = now
  const dependencies = { admission: () => selected, policy: () => currentPolicy, now: () => clock }
  const ledger = createPatientReportPreview(dependencies)
  ledger.register({ patientId: id(200), relationshipId: id(900), relationshipVersion: 2 }, event())
  return { ledger, dependencies, setAdmission: value => { selected = value }, setPolicy: value => { currentPolicy = value }, setClock: value => { clock = value } }
}
test('taken/skip are patient-reported claims with original source/time and immutable provenance, never clinical truth', () => {
  for (const kind of ['taken', 'skip']) {
    const f = fixture(); assert.equal(f.ledger.command(command(901, kind)).status, 'recorded')
    const view = f.ledger.read(event().id); assert.equal(view.report, kind); assert.equal(view.history[0].patientReported, true); assert.equal(view.history[0].clinicallyVerified, false); assert.equal(view.externalNotifications, false); assert.equal(view.history[0].originalOccurrenceUtc, event().occurrenceUtc); assert.deepEqual(view.event.source, event().source)
    assert.throws(() => view.history.push({})); assert.throws(() => { view.event.source.revision = 99 })
  }
})
test('lost acknowledgement and reordered retry intent retain one transition, including a freshly admitted new session', () => {
  const f = fixture(), input = command(), first = f.ledger.command(input)
  const replay = f.ledger.command(Object.fromEntries(Object.entries(input).reverse()))
  assert.equal(first.version, 1); assert.equal(replay.replayed, true); assert.equal(replay.version, 1)
  f.setAdmission({ ...admission(), sessionId: id(15) }); assert.equal(f.ledger.command(input).replayed, true)
  const view = f.ledger.read(event().id); assert.equal(view.history.length, 1); assert.equal(view.history[0].actorSessionId, id(14))
  assert.equal(f.ledger.command({ ...input, kind: 'skip' }).status, 'key_reused'); assert.equal(f.ledger.read(event().id).history.length, 1)
})
test('independent devices conflict on the original version; changing a report requires explicit correction provenance', () => {
  const f = fixture(); f.ledger.command(command(901, 'taken'))
  const conflict = command(902, 'skip'); assert.equal(f.ledger.command(conflict).status, 'conflict'); assert.equal(f.ledger.command(conflict).replayed, true)
  assert.equal(f.ledger.command({ ...conflict, expectedVersion: 1 }).status, 'key_reused')
  assert.equal(f.ledger.command(command(903, 'skip', 1)).status, 'correction_required')
  const correction = { ...command(904, 'correct', 1), report: 'skip', reason: 'Synthetic patient correction' }
  assert.equal(f.ledger.command(correction).status, 'recorded'); assert.equal(f.ledger.command(correction).replayed, true)
  const view = f.ledger.read(event().id); assert.equal(view.report, 'skip'); assert.equal(view.history.length, 2); assert.equal(view.history[0].report, 'taken'); assert.equal(view.history[1].reason, correction.reason); assert.equal(view.history[1].correctsVersion, 1)
})
test('snooze changes only preview time, with original occurrence/source intact and no regimen fields accepted', () => {
  const f = fixture(), snooze = { ...command(901, 'snooze'), until: now + 600000 }
  assert.equal(f.ledger.command(snooze).status, 'recorded'); assert.equal(f.ledger.command(snooze).replayed, true)
  const view = f.ledger.read(event().id); assert.equal(view.report, 'unreported'); assert.equal(view.snoozeUntil, snooze.until); assert.deepEqual(view.event, event()); assert.equal(view.history[0].originalOccurrenceUtc, event().occurrenceUtc)
  assert.equal(f.ledger.command({ ...command(902), dose: 2 }).status, 'invalid'); assert.equal(f.ledger.read(event().id).history.length, 1)
  const other = fixture(), mutable = { ...command(903, 'snooze'), until: now + 600000 }
  other.dependencies.policy = () => { mutable.until = now + 900000; return policy() }
  assert.equal(other.ledger.command(mutable).status, 'recorded'); assert.equal(other.ledger.read(event().id).snoozeUntil, now + 600000)
  assert.equal(other.ledger.command({ ...mutable, until: now + 600000 }).replayed, true); assert.equal(other.ledger.command(mutable).status, 'key_reused')
})
test('snooze at/after next event, unknown bounds or after stop produces no guessed conflict policy or reminder', () => {
  for (const [p, until] of [[policy(), now + 1800000], [policy(), now + 3000000], [{ ...policy(), nextKind: 'unknown', nextOccurrenceAt: null }, now + 600000], [{ ...policy(), sourceState: 'stopped' }, now + 600000], [null, now + 600000]]) {
    const f = fixture(); f.setPolicy(p); assert.equal(f.ledger.command({ ...command(901, 'snooze'), until }).status, 'policy_unavailable'); assert.equal(f.ledger.read(event().id).version, 0)
  }
})
test('patient/caregiver accounts remain separate; foreign patient/relationship or limited permission cannot access the event', () => {
  for (const patch of [{ patientId: id(201) }, { relationshipId: id(901) }, { relationshipVersion: 1 }, { actions: [] }, { legalApproval: true }, { syntheticOnly: false }]) {
    const f = fixture(); f.setAdmission({ ...admission(), ...patch }); assert.equal(f.ledger.read(event().id), null); assert.equal(f.ledger.command(command()).status, 'denied')
  }
  const f = fixture(); f.setAdmission({ ...admission(), accountId: id(5), sessionId: id(16), reporterKind: 'caregiver', actions: ['read', 'report'] })
  assert.equal(f.ledger.command(command()).status, 'recorded'); assert.equal(f.ledger.read(event().id).history[0].reporterKind, 'caregiver'); assert.equal(f.ledger.read(event().id).history[0].actorAccountId, id(5)); assert.equal(f.ledger.command({ ...command(902, 'correct', 1), report: 'skip', reason: 'Synthetic correction' }).status, 'denied')
})
test('revocation/expiry prevents replay acknowledgement and future protected reads', () => {
  for (const kind of ['revoked', 'expired']) {
    const f = fixture(), input = command(); f.ledger.command(input)
    if (kind === 'revoked') f.setAdmission(null); else f.setClock(now + 3600000)
    assert.equal(f.ledger.command(input).status, 'denied'); assert.equal(f.ledger.read(event().id), null)
  }
})
test('fresh admission is rechecked after eligibility and before committing the report', () => {
  const f = fixture(); f.dependencies.policy = () => { f.setAdmission(null); return policy() }
  assert.equal(f.ledger.command(command()).status, 'denied'); f.setAdmission(admission()); assert.equal(f.ledger.read(event().id).version, 0)
  f.dependencies.policy = () => { f.setAdmission(null); throw Error('unavailable after withdrawal') }
  const denied = f.ledger.command(command(903)); assert.equal(denied.status, 'denied'); assert.equal(denied.eventId, null); assert.equal(denied.version, null)
})
test('another transaction during snooze eligibility cannot bypass expected-version conflict checks', () => {
  const f = fixture(); let nested = false
  f.dependencies.policy = () => { if (!nested) { nested = true; assert.equal(f.ledger.command({ ...command(902, 'snooze'), until: now + 300000 }).status, 'recorded') } return policy() }
  assert.equal(f.ledger.command({ ...command(901, 'snooze'), until: now + 600000 }).status, 'conflict')
  const view = f.ledger.read(event().id); assert.equal(view.version, 1); assert.equal(view.snoozeUntil, now + 300000); assert.equal(view.history.length, 1)
})
test('invalid correction/clock inputs fail closed and never add a report', () => {
  for (const patch of [{ expectedVersion: -1 }, { patientTime: now + 1 }, { key: 'invalid' }, { kind: 'correct', report: 'skip', reason: ' ' }]) {
    const f = fixture(); assert.equal(f.ledger.command({ ...command(), ...patch }).status, 'invalid'); assert.equal(f.ledger.read(event().id).version, 0)
  }
  const f = fixture(); f.ledger.read(event().id); f.setClock(now - 1); assert.equal(f.ledger.command(command()).status, 'invalid'); assert.equal(f.ledger.read(event().id), null)
  const first = fixture(); assert.equal(first.ledger.command({ ...command(903, 'correct'), report: 'taken', reason: 'No previous report' }).status, 'correction_required'); assert.equal(first.ledger.read(event().id).version, 0)
})
test('registry rejects private payloads or altered source/occurrence identity rather than making a mutable clinical record', () => {
  const f = fixture(), owner = { patientId: id(200), relationshipId: id(900), relationshipVersion: 2 }
  for (const bad of [{ ...event(), note: 'private' }, { ...event(), occurrenceUtc: new Date(now + 60000).toISOString() }, { ...event(), source: { ...event().source, dose: 2 } }]) {
    const ledger = createPatientReportPreview(f.dependencies); assert.throws(() => ledger.register(owner, bad)); assert.equal(ledger.read(event().id), null)
  }
})
test('unavailable eligibility cannot crash into a fallback write or silently retry a rejected command', () => {
  const f = fixture(); f.dependencies.policy = () => { throw Error('unavailable private policy') }
  const input = command(); assert.equal(f.ledger.command(input).status, 'policy_unavailable'); assert.equal(f.ledger.read(event().id).version, 0)
  f.dependencies.policy = policy; assert.equal(f.ledger.command(input).replayed, true); assert.equal(f.ledger.command(input).status, 'policy_unavailable'); assert.equal(f.ledger.command(command(902)).status, 'recorded')
})
test('bounded receipt capacity retains original acknowledgements and never evicts keys into duplicate transitions', () => {
  const f = fixture()
  for (let i = 0; i < 512; i++) assert.equal(f.ledger.command({ ...command(1000 + i, 'snooze', i), until: now + 60000 }).status, 'recorded')
  assert.equal(f.ledger.command({ ...command(2000, 'snooze', 512), until: now + 120000 }).status, 'capacity')
  const replay = f.ledger.command({ ...command(1000, 'snooze', 0), until: now + 60000 }); assert.equal(replay.replayed, true); assert.equal(replay.version, 1); assert.equal(f.ledger.read(event().id).history.length, 512)
})
