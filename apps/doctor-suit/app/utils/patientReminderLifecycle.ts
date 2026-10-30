import { clinicalUuid } from './clinical.ts'
import { reminderPreviewAlgorithm, type ReminderPreviewEvent } from './patientReminderPreview.ts'

export const reminderLifecycleAlgorithm = 'doctor-reminder-lifecycle-preview-v1' as const
type Disposition = 'pending' | 'stopped' | 'superseded' | 'expired' | 'elapsed' | 'retired_by_report'
type NotificationEvidence = 'none' | 'intent_issued' | 'schedule_acknowledged' | 'unknown' | 'failed' | 'presentation_observed' | 'late_or_invalid_presentation'
interface ReportReference { version: number; claim: 'unreported' | 'taken' | 'skip'; reference: string; patientReported: true; clinicallyVerified: false }
export interface ReminderLifecycleEntry {
  event: ReminderPreviewEvent; notAfter: number; disposition: Disposition; attemptKey: string; issuedAt: number | null
  notificationEvidence: NotificationEvidence; observationVersion: number; observationAt: number | null
  observationStatus: ReminderLifecycleSnapshot['observations'][number]['status'] | null
  reportedState: ReportReference['claim']; reportHistory: readonly ReportReference[]; canActForPreview: boolean
}
export interface ReminderLifecycleState {
  algorithm: typeof reminderLifecycleAlgorithm; binding: string; sourceRevision: number; fingerprint: string; lastClock: number
  observedAt: number; entries: readonly ReminderLifecycleEntry[]; syntheticOnly: true; clinicalApproval: false; externalNotifications: false
}
export interface ReminderLifecycleSnapshot {
  binding: string; revision: number; observedAt: number; validUntil: number; sourceState: 'active' | 'stopped' | 'unknown'; schedulingPreviewAllowed: boolean
  rows: readonly { event: ReminderPreviewEvent; notAfter: number }[]
  reports: readonly (ReportReference & { eventId: string; patientReported: true; clinicallyVerified: false })[]
  observations: readonly { eventId: string; attemptKey: string; version: number; at: number; status: 'schedule_acknowledged' | 'unknown' | 'failed' | 'presented_preview' }[]
  syntheticOnly: true; clinicalApproval: false; externalNotifications: false
}
const instant = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) >= 0
const keys = (value: object, allowed: string[]) => !!value && !Array.isArray(value) && Object.keys(value).length === allowed.length && Object.keys(value).every(key => allowed.includes(key))
const reference = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9:_#-]{1,512}$/.test(value)
function invalid(): never { throw Error('REMINDER_LIFECYCLE_PREVIEW_INVALID') }
function eventFrame(event: ReminderPreviewEvent) { return [event.id, event.source.releaseId, event.source.versionId, event.source.revision, event.source.snapshotSha256, event.source.prescriptionId, event.segmentIndex, event.occurrenceUtc, event.localDay, event.localTime, event.timezone] }
function validEvent(event: ReminderPreviewEvent) {
  const at = Date.parse(event?.occurrenceUtc), source = event?.source
  return !!source && Object.keys(event).length === 7 && Object.keys(source).length === 5 && [source.releaseId, source.versionId, source.prescriptionId].every(clinicalUuid) && Number.isSafeInteger(source.revision) && source.revision > 0 && /^[0-9a-f]{64}$/.test(source.snapshotSha256) && instant(at) && Number.isSafeInteger(event.segmentIndex) && event.segmentIndex >= 0 && event.id === [reminderPreviewAlgorithm, source.releaseId, source.versionId, source.snapshotSha256, source.prescriptionId, event.segmentIndex, at].join(':') && typeof event.localDay === 'string' && typeof event.localTime === 'string' && typeof event.timezone === 'string'
}
function copyEvent(event: ReminderPreviewEvent): ReminderPreviewEvent { return Object.freeze({ id: event.id, source: Object.freeze({ ...event.source }), segmentIndex: event.segmentIndex, occurrenceUtc: event.occurrenceUtc, localDay: event.localDay, localTime: event.localTime, timezone: event.timezone }) }
function freezeEntry(entry: ReminderLifecycleEntry): ReminderLifecycleEntry { return Object.freeze({ ...entry, event: copyEvent(entry.event), reportHistory: Object.freeze(entry.reportHistory.map(reference => Object.freeze({ ...reference }))) }) }
/** A fixture checkpoint is plain memory data, not approved private device persistence. */
export function emptyReminderLifecycle(binding: string): ReminderLifecycleState {
  if (typeof binding !== 'string' || !binding || binding.length > 8192) return invalid()
  return Object.freeze({ algorithm: reminderLifecycleAlgorithm, binding, sourceRevision: 0, fingerprint: '', lastClock: 0, observedAt: 0, entries: Object.freeze([]), syntheticOnly: true, clinicalApproval: false, externalNotifications: false })
}
/** Independent unreviewed state transition. No notification/native/server/provider adapter exists. */
export function reconcileReminderLifecycle(previous: ReminderLifecycleState, snapshot: ReminderLifecycleSnapshot, now: number) {
  if (!previous || typeof previous.binding !== 'string' || !previous.binding || previous.binding.length > 8192 || !instant(previous.lastClock) || !instant(previous.observedAt) || !Number.isSafeInteger(previous.sourceRevision) || previous.sourceRevision < 0 || typeof previous.fingerprint !== 'string') return invalid()
  if (!previous || previous.algorithm !== reminderLifecycleAlgorithm || previous.syntheticOnly !== true || previous.clinicalApproval !== false || previous.externalNotifications !== false || !snapshot || snapshot.binding !== previous.binding || snapshot.syntheticOnly !== true || snapshot.clinicalApproval !== false || snapshot.externalNotifications !== false || !instant(now) || now < previous.lastClock || !instant(snapshot.observedAt) || snapshot.observedAt > now || snapshot.observedAt < previous.observedAt || !instant(snapshot.validUntil) || now >= snapshot.validUntil || !Number.isSafeInteger(snapshot.revision) || snapshot.revision < 1 || snapshot.revision < previous.sourceRevision || !['active', 'stopped', 'unknown'].includes(snapshot.sourceState) || typeof snapshot.schedulingPreviewAllowed !== 'boolean' || !Array.isArray(previous.entries) || previous.entries.length > 512 || !Array.isArray(snapshot.rows) || snapshot.rows.length > 512 || !Array.isArray(snapshot.reports) || snapshot.reports.length > 512 || !Array.isArray(snapshot.observations) || snapshot.observations.length > 512) return invalid()
  const rows = [...snapshot.rows].sort((a, b) => a.event.id.localeCompare(b.event.id))
  if (new Set(rows.map(row => row.event.id)).size !== rows.length || rows.some(row => !validEvent(row.event) || !instant(row.notAfter) || row.notAfter <= Date.parse(row.event.occurrenceUtc))) return invalid()
  const fingerprint = JSON.stringify([snapshot.sourceState, snapshot.schedulingPreviewAllowed, rows.map(row => [eventFrame(row.event), row.notAfter])])
  if (previous.sourceRevision === snapshot.revision && previous.fingerprint !== fingerprint) return invalid()
  const entries = new Map<string, ReminderLifecycleEntry>(), cancelKeys: string[] = [], createIntents: { attemptKey: string; event: ReminderPreviewEvent }[] = []
  for (const entry of previous.entries) {
    if (!keys(entry, ['event', 'notAfter', 'disposition', 'attemptKey', 'issuedAt', 'notificationEvidence', 'observationVersion', 'observationAt', 'observationStatus', 'reportedState', 'reportHistory', 'canActForPreview']) || !validEvent(entry.event) || entries.has(entry.event.id) || !instant(entry.notAfter) || !['pending', 'stopped', 'superseded', 'expired', 'elapsed', 'retired_by_report'].includes(entry.disposition) || entry.attemptKey !== entry.event.id + ':notification-preview-v1' || entry.issuedAt !== null && (!instant(entry.issuedAt) || entry.issuedAt > previous.lastClock) || !Number.isSafeInteger(entry.observationVersion) || entry.observationVersion < 0 || entry.observationVersion === 0 && (entry.observationAt !== null || entry.observationStatus !== null) || entry.observationVersion > 0 && (!instant(entry.observationAt) || entry.observationAt > previous.lastClock || entry.issuedAt === null) || !Array.isArray(entry.reportHistory) || entry.reportHistory.length > 512 || entry.reportHistory.some((item: ReportReference, index: number) => !keys(item, ['version', 'claim', 'reference', 'patientReported', 'clinicallyVerified']) || item.version !== index + 1 || item.patientReported !== true || item.clinicallyVerified !== false || !['unreported', 'taken', 'skip'].includes(item.claim) || !reference(item.reference)) || entry.reportedState !== (entry.reportHistory.at(-1)?.claim ?? 'unreported')) return invalid()
    entries.set(entry.event.id, { ...entry, event: copyEvent(entry.event), reportHistory: [...entry.reportHistory] })
  }
  for (const row of rows) {
    const existing = entries.get(row.event.id)
    if (existing) { if (JSON.stringify(eventFrame(existing.event)) !== JSON.stringify(eventFrame(row.event)) || existing.notAfter !== row.notAfter) return invalid() }
    else if (snapshot.sourceState !== 'unknown') entries.set(row.event.id, { event: copyEvent(row.event), notAfter: row.notAfter, disposition: 'pending', attemptKey: row.event.id + ':notification-preview-v1', issuedAt: null, notificationEvidence: 'none', observationVersion: 0, observationAt: null, observationStatus: null, reportedState: 'unreported', reportHistory: [], canActForPreview: false })
  }
  if (entries.size > 512) return invalid() // Never evict tombstones into rescheduled old events.
  const currentIds = new Set(rows.map(row => row.event.id))
  function retire(entry: ReminderLifecycleEntry, reason: Disposition) {
    if (entry.disposition === 'pending') { if (entry.issuedAt !== null) cancelKeys.push(entry.attemptKey); entry.disposition = reason }
    entry.canActForPreview = false
  }
  for (const entry of entries.values()) {
    if (snapshot.sourceState === 'stopped') retire(entry, 'stopped')
    else if (snapshot.sourceState === 'active' && !currentIds.has(entry.event.id)) retire(entry, 'superseded')
    if (now >= entry.notAfter) retire(entry, 'expired')
  }
  const reports = [...snapshot.reports].sort((a, b) => a.eventId.localeCompare(b.eventId) || a.version - b.version)
  for (const report of reports) {
    const entry = entries.get(report.eventId), history = entry?.reportHistory ?? [], last = history.at(-1)
    if (!entry || !keys(report, ['eventId', 'version', 'claim', 'reference', 'patientReported', 'clinicallyVerified']) || report.patientReported !== true || report.clinicallyVerified !== false || !Number.isSafeInteger(report.version) || report.version < 1 || !['unreported', 'taken', 'skip'].includes(report.claim) || !reference(report.reference)) return invalid()
    const existing = history.find(item => item.version === report.version)
    if (existing) { if (existing.claim !== report.claim || existing.reference !== report.reference) return invalid(); continue }
    if (report.version !== (last?.version ?? 0) + 1 || history.length >= 512) return invalid()
    entry.reportHistory = [...history, { version: report.version, claim: report.claim, reference: report.reference, patientReported: true, clinicallyVerified: false }]
    entry.reportedState = report.claim
    if (report.claim !== 'unreported') retire(entry, 'retired_by_report')
  }
  for (const observation of [...snapshot.observations].sort((a, b) => a.eventId.localeCompare(b.eventId) || a.version - b.version)) {
    const entry = entries.get(observation.eventId)
    if (!entry || entry.issuedAt === null || entry.attemptKey !== observation.attemptKey || !Number.isSafeInteger(observation.version) || observation.version < 1 || !instant(observation.at) || observation.at < entry.issuedAt || observation.at > now || !['schedule_acknowledged', 'unknown', 'failed', 'presented_preview'].includes(observation.status)) return invalid()
    if (observation.version < entry.observationVersion) continue
    if (observation.version === entry.observationVersion) { if (entry.observationAt !== observation.at || entry.observationStatus !== observation.status) return invalid(); continue }
    const evidence: NotificationEvidence = observation.status === 'presented_preview' ? entry.disposition !== 'pending' || observation.at < Date.parse(entry.event.occurrenceUtc) || observation.at >= entry.notAfter ? 'late_or_invalid_presentation' : 'presentation_observed' : observation.status
    entry.observationVersion = observation.version; entry.observationAt = observation.at; entry.observationStatus = observation.status; entry.notificationEvidence = evidence
  }
  for (const entry of entries.values()) {
    const due = Date.parse(entry.event.occurrenceUtc)
    if (entry.disposition === 'pending' && entry.issuedAt === null && now >= due) retire(entry, 'elapsed')
    if (entry.disposition === 'pending' && snapshot.sourceState === 'active' && snapshot.schedulingPreviewAllowed && entry.issuedAt === null && now < due) {
      entry.issuedAt = now; entry.notificationEvidence = 'intent_issued'
      createIntents.push(Object.freeze({ attemptKey: entry.attemptKey, event: entry.event }))
    }
    entry.canActForPreview = entry.disposition === 'pending' && snapshot.sourceState === 'active' && entry.notificationEvidence === 'presentation_observed' && now >= due && now < entry.notAfter
  }
  const inspectKeys = [...entries.values()].filter(entry => entry.disposition === 'pending' && entry.issuedAt !== null && ['intent_issued', 'schedule_acknowledged', 'failed', 'unknown'].includes(entry.notificationEvidence)).map(entry => entry.attemptKey).sort()
  const next: ReminderLifecycleState = Object.freeze({ algorithm: reminderLifecycleAlgorithm, binding: previous.binding, sourceRevision: snapshot.revision, fingerprint, lastClock: now, observedAt: snapshot.observedAt, entries: Object.freeze([...entries.values()].sort((a, b) => a.event.id.localeCompare(b.event.id)).map(freezeEntry)), syntheticOnly: true, clinicalApproval: false, externalNotifications: false })
  return Object.freeze({ next, createIntents: Object.freeze(createIntents), cancelKeys: Object.freeze([...new Set(cancelKeys)].sort()), inspectKeys: Object.freeze(inspectKeys), syntheticOnly: true, clinicalApproval: false, externalNotifications: false })
}
