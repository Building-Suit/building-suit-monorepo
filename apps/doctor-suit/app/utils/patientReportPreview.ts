import { clinicalUuid } from './clinical.ts'
import { reminderPreviewAlgorithm, type ReminderPreviewEvent } from './patientReminderPreview.ts'

export interface ReportPreviewAdmission {
  accountId: string; sessionId: string; patientId: string; relationshipId: string; relationshipVersion: number
  reporterKind: 'patient' | 'caregiver'; actions: readonly ('read' | 'report' | 'correct' | 'snooze')[]
  validUntil: number; syntheticOnly: true; legalApproval: false
}
export interface ReportPreviewPolicy {
  sourceState: 'active' | 'stopped' | 'unknown'; reportingAllowed: boolean; notificationPreviewAllowed: boolean
  snoozeNotAfter: number | null; nextKind: 'known_next' | 'explicit_none' | 'unknown'; nextOccurrenceAt: number | null
  qualifiedInterpretation: false
}
export type PatientReportedState = 'unreported' | 'taken' | 'skip'
interface CommandBase { key: string; eventId: string; expectedVersion: number; patientTime: number | null }
export type ReportPreviewCommand = CommandBase & ({ kind: 'taken' | 'skip' } | { kind: 'snooze'; until: number } | { kind: 'correct'; report: PatientReportedState; reason: string })
interface ReportPreviewHistory {
  version: number; kind: ReportPreviewCommand['kind']; actorAccountId: string; actorSessionId: string; reporterKind: 'patient' | 'caregiver'
  recordedAt: number; patientTime: number | null; report: PatientReportedState; snoozeUntil: number | null; reason: string | null
  correctsVersion: number | null
  source: ReminderPreviewEvent['source']; originalOccurrenceUtc: string; patientReported: true; clinicallyVerified: false
}
type ReportPreviewStatus = 'recorded' | 'conflict' | 'denied' | 'invalid' | 'key_reused' | 'policy_unavailable' | 'correction_required' | 'capacity'
interface ReportPreviewReceipt { status: ReportPreviewStatus; eventId: string | null; version: number | null; replayed: boolean; syntheticOnly: true; clinicallyVerified: false; externalNotifications: false }
interface Entry { owner: { patientId: string; relationshipId: string; relationshipVersion: number }; event: ReminderPreviewEvent; version: number; report: PatientReportedState; snoozeUntil: number | null; history: ReportPreviewHistory[] }
const instant = (n: unknown): n is number => Number.isSafeInteger(n) && Number(n) >= 0
const shape = (value: object, keys: string[]) => !!value && Object.keys(value).length === keys.length && Object.keys(value).every(key => keys.includes(key))
function receipt(status: ReportPreviewStatus, entry?: Entry, replayed = false): ReportPreviewReceipt { return Object.freeze({ status, eventId: entry?.event.id ?? null, version: entry?.version ?? null, replayed, syntheticOnly: true, clinicallyVerified: false, externalNotifications: false }) }
function validAdmission(a: ReportPreviewAdmission | null, now: number): a is ReportPreviewAdmission {
  return !!a && [a.accountId, a.sessionId, a.patientId, a.relationshipId].every(clinicalUuid) && Number.isSafeInteger(a.relationshipVersion) && a.relationshipVersion > 0 && ['patient', 'caregiver'].includes(a.reporterKind) && Array.isArray(a.actions) && a.actions.length <= 4 && a.actions.every(action => ['read', 'report', 'correct', 'snooze'].includes(action)) && new Set(a.actions).size === a.actions.length && instant(a.validUntil) && now < a.validUntil && a.syntheticOnly === true && a.legalApproval === false
}
function stamp(a: ReportPreviewAdmission) { return JSON.stringify([a.accountId, a.sessionId, a.patientId, a.relationshipId, a.relationshipVersion, a.reporterKind, a.actions, a.validUntil]) }
function shapeCommand(command: ReportPreviewCommand, now: number) {
  if (!command || !clinicalUuid(command.key) || typeof command.eventId !== 'string' || command.eventId.length > 512 || !Number.isSafeInteger(command.expectedVersion) || command.expectedVersion < 0 || command.patientTime !== null && (!instant(command.patientTime) || command.patientTime > now)) return false
  const keys = ['key', 'eventId', 'expectedVersion', 'patientTime', 'kind', ...(command.kind === 'snooze' ? ['until'] : command.kind === 'correct' ? ['report', 'reason'] : [])]
  if (Object.keys(command).length !== keys.length || !Object.keys(command).every(key => keys.includes(key))) return false
  if (command.kind === 'snooze') return instant(command.until) && command.until > now
  if (command.kind === 'correct') return ['unreported', 'taken', 'skip'].includes(command.report) && typeof command.reason === 'string' && command.reason.trim().length > 0 && command.reason.length <= 400
  return command.kind === 'taken' || command.kind === 'skip'
}
/** Isolated synchronous fixture transactions. Not a database, Auth gateway, native client or clinical record. */
export function createPatientReportPreview(dependencies: { admission: () => ReportPreviewAdmission | null; policy: (event: ReminderPreviewEvent) => ReportPreviewPolicy | null; now: () => number }) {
  const entries = new Map<string, Entry>(), receipts = new Map<string, { intent: string; receipt: ReportPreviewReceipt }>()
  let lastClock = 0
  function clock() { const now = dependencies.now(); if (!instant(now) || now < lastClock) return null; lastClock = now; return now }
  function permitted(entry: Entry, admission: ReportPreviewAdmission, action: ReportPreviewAdmission['actions'][number]) { return admission.patientId === entry.owner.patientId && admission.relationshipId === entry.owner.relationshipId && admission.relationshipVersion === entry.owner.relationshipVersion && admission.actions.includes(action) }
  function register(owner: Entry['owner'], event: ReminderPreviewEvent) {
    const at = Date.parse(event.occurrenceUtc), source = event.source
    const expectedId = [reminderPreviewAlgorithm, source.releaseId, source.versionId, source.snapshotSha256, source.prescriptionId, event.segmentIndex, at].join(':')
    if (!shape(owner, ['patientId', 'relationshipId', 'relationshipVersion']) || !shape(event, ['id', 'source', 'segmentIndex', 'occurrenceUtc', 'localDay', 'localTime', 'timezone']) || !shape(source, ['releaseId', 'versionId', 'revision', 'snapshotSha256', 'prescriptionId']) || entries.size >= 128 || entries.has(event.id) || ![owner.patientId, owner.relationshipId, source.releaseId, source.versionId, source.prescriptionId].every(clinicalUuid) || !Number.isSafeInteger(owner.relationshipVersion) || owner.relationshipVersion < 1 || !Number.isSafeInteger(source.revision) || source.revision < 1 || !/^[0-9a-f]{64}$/.test(source.snapshotSha256) || !instant(at) || new Date(at).toISOString() !== event.occurrenceUtc || !Number.isSafeInteger(event.segmentIndex) || event.segmentIndex < 0 || event.id !== expectedId || typeof event.localDay !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(event.localDay) || typeof event.localTime !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(event.localTime) || typeof event.timezone !== 'string' || !event.timezone || event.timezone.length > 100) throw Error('REPORT_PREVIEW_INVALID')
    const copy = Object.freeze({ ...event, source: Object.freeze({ ...source }) })
    entries.set(event.id, { owner: Object.freeze({ ...owner }), event: copy, version: 0, report: 'unreported', snoozeUntil: null, history: [] })
  }
  function read(eventId: string) {
    const now = clock(), admission = dependencies.admission(), entry = entries.get(eventId)
    if (now === null || !validAdmission(admission, now) || !entry || !permitted(entry, admission, 'read')) return null
    return Object.freeze({ event: entry.event, version: entry.version, report: entry.report, snoozeUntil: entry.snoozeUntil, history: Object.freeze([...entry.history]), syntheticOnly: true, clinicallyVerified: false, externalNotifications: false })
  }
  function command(input: ReportPreviewCommand): ReportPreviewReceipt {
    const started = clock()
    if (started === null || !shapeCommand(input, started)) return receipt('invalid')
    input = Object.freeze({ ...input })
    const admission = dependencies.admission(), entry = entries.get(input.eventId)
    const required = input.kind === 'correct' ? 'correct' : input.kind === 'snooze' ? 'snooze' : 'report'
    if (!validAdmission(admission, started) || !entry || !permitted(entry, admission, required)) return receipt('denied')
    const captured = stamp(admission), namespace = JSON.stringify([admission.accountId, admission.patientId, admission.relationshipId, input.key])
    const intent = JSON.stringify([input.eventId, input.expectedVersion, input.kind, input.patientTime, input.kind === 'snooze' ? input.until : null, input.kind === 'correct' ? [input.report, input.reason] : null])
    const saved = receipts.get(namespace)
    if (saved) return saved.intent === intent ? Object.freeze({ ...saved.receipt, replayed: true }) : receipt('key_reused')
    if (receipts.size >= 512) return receipt('capacity')
    function finish(status: ReportPreviewStatus) { const result = receipt(status, entry); receipts.set(namespace, { intent, receipt: result }); return result }
    if (entry.version !== input.expectedVersion) return finish('conflict')
    let policy: ReportPreviewPolicy | null
    try { policy = dependencies.policy(entry.event) } catch { policy = null }
    const now = clock(), fresh = dependencies.admission()
    if (now === null || !validAdmission(fresh, now) || stamp(fresh) !== captured || !permitted(entry, fresh, required)) return receipt('denied')
    const committedWhileChecking = receipts.get(namespace)
    if (committedWhileChecking) return committedWhileChecking.intent === intent ? Object.freeze({ ...committedWhileChecking.receipt, replayed: true }) : receipt('key_reused')
    if (entry.version !== input.expectedVersion) return finish('conflict')
    if (receipts.size >= 512) return receipt('capacity')
    if (!policy || policy.qualifiedInterpretation !== false || !policy.reportingAllowed || !['active', 'stopped', 'unknown'].includes(policy.sourceState)) return finish('policy_unavailable')
    if (!Number.isSafeInteger(entry.version + 1)) return finish('capacity')
    if (input.kind === 'snooze') {
      if (entry.report !== 'unreported') return finish('correction_required')
      if (policy.sourceState !== 'active' || !policy.notificationPreviewAllowed || !instant(policy.snoozeNotAfter) || input.until <= now || input.until > policy.snoozeNotAfter || policy.nextKind === 'unknown' || !['known_next', 'explicit_none'].includes(policy.nextKind) || policy.nextKind === 'known_next' && (!instant(policy.nextOccurrenceAt) || input.until >= policy.nextOccurrenceAt) || policy.nextKind === 'explicit_none' && policy.nextOccurrenceAt !== null) return finish('policy_unavailable')
      entry.snoozeUntil = input.until
    } else if (input.kind === 'correct') { if (!entry.history.some(item => item.kind !== 'snooze')) return finish('correction_required'); entry.report = input.report; entry.snoozeUntil = null }
    else { if (entry.report !== 'unreported') return finish('correction_required'); entry.report = input.kind; entry.snoozeUntil = null }
    entry.version++
    entry.history.push(Object.freeze({ version: entry.version, kind: input.kind, actorAccountId: fresh.accountId, actorSessionId: fresh.sessionId, reporterKind: fresh.reporterKind, recordedAt: now, patientTime: input.patientTime, report: entry.report, snoozeUntil: entry.snoozeUntil, reason: input.kind === 'correct' ? input.reason : null, correctsVersion: input.kind === 'correct' ? input.expectedVersion : null, source: entry.event.source, originalOccurrenceUtc: entry.event.occurrenceUtc, patientReported: true, clinicallyVerified: false }))
    return finish('recorded')
  }
  return { register, read, command }
}
