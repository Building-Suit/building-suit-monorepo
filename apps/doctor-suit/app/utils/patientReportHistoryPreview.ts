import { clinicalUuid } from './clinical.ts'
import { reminderPreviewAlgorithm } from './patientReminderPreview.ts'
import type { createPatientReportPreview, PatientReportedState } from './patientReportPreview.ts'
type ReportView = NonNullable<ReturnType<ReturnType<typeof createPatientReportPreview>['read']>>
type HistoryItem = ReportView['history'][number]
export interface ReportHistoryOwner {
  patientId: string; patientAccountId: string | null; relationshipId: string; relationshipVersion: number
  doctorId: string; practiceId: string; locationId: string; consentVersion: number; releaseVersion: number
}
export interface ReportHistoryViewer {
  environment: 'synthetic'; portal: 'patient' | 'caregiver' | 'doctor' | 'secretary'; accountId: string; sessionId: string
  patientId: string; relationshipId: string; relationshipVersion: number; doctorId: string | null; practiceId: string | null; locationId: string | null
  permissions: readonly string[]; checkedAt: number; validUntil: number; syntheticOnly: true; legalApproval: false
}
/** An unreviewed fixture verdict, never a real consent/identity/legal authorization. */
export interface ReportHistoryGrant {
  id: string; kind: 'caregiver' | 'doctor_share'; grantorAccountId: string; recipientAccountId: string
  patientId: string; relationshipId: string; relationshipVersion: number; doctorId: string; practiceId: string; locationId: string
  purpose: 'report_history.read'; sourceVersionIds: readonly string[]; consentVersion: number; releaseVersion: number
  authorityRef: string; validFrom: number; validUntil: number; revokedAt: number | null; syntheticOnly: true; legalApproval: false
}
export interface ReportHistoryConflict {
  id: string; expectedVersion: number; observedVersion: number; proposedReport: PatientReportedState
  actorAccountId: string; reporterKind: 'patient' | 'caregiver'; deviceReportedAt: number | null; serverRecordedAt: number
}
const instant = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) >= 0
const version = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) >= 1
const claim = (value: unknown): value is PatientReportedState => ['unreported', 'taken', 'skip'].includes(String(value))
function invalid(): never { throw Error('PATIENT_REPORT_HISTORY_PREVIEW_INVALID') }
function sameSource(left: HistoryItem['source'], right: HistoryItem['source']) { return left.releaseId === right.releaseId && left.versionId === right.versionId && left.revision === right.revision && left.snapshotSha256 === right.snapshotSha256 && left.prescriptionId === right.prescriptionId }
function allowed(owner: ReportHistoryOwner, viewer: ReportHistoryViewer, grant: ReportHistoryGrant | null, sourceVersion: string, now: number) {
  if (!instant(now) || !viewer || viewer.environment !== 'synthetic' || viewer.syntheticOnly !== true || viewer.legalApproval !== false || ![viewer.accountId, viewer.sessionId].every(clinicalUuid) || !instant(viewer.checkedAt) || viewer.checkedAt > now || !instant(viewer.validUntil) || now >= viewer.validUntil || !Array.isArray(viewer.permissions) || !viewer.permissions.includes('report_history.read') || viewer.patientId !== owner.patientId || viewer.relationshipId !== owner.relationshipId || viewer.relationshipVersion !== owner.relationshipVersion) return false
  if (viewer.portal === 'patient') return owner.patientAccountId !== null && viewer.accountId === owner.patientAccountId
  if (!['caregiver', 'doctor'].includes(viewer.portal) || !grant || grant.syntheticOnly !== true || grant.legalApproval !== false || ![grant.id, grant.grantorAccountId, grant.recipientAccountId].every(clinicalUuid) || grant.recipientAccountId !== viewer.accountId || grant.patientId !== owner.patientId || grant.relationshipId !== owner.relationshipId || grant.relationshipVersion !== owner.relationshipVersion || grant.doctorId !== owner.doctorId || grant.practiceId !== owner.practiceId || grant.locationId !== owner.locationId || grant.purpose !== 'report_history.read' || !Array.isArray(grant.sourceVersionIds) || grant.sourceVersionIds.length > 100 || !grant.sourceVersionIds.every(clinicalUuid) || !grant.sourceVersionIds.includes(sourceVersion) || grant.consentVersion !== owner.consentVersion || grant.releaseVersion !== owner.releaseVersion || typeof grant.authorityRef !== 'string' || !/^[A-Za-z0-9:_-]{1,128}$/.test(grant.authorityRef) || !instant(grant.validFrom) || grant.validFrom > viewer.checkedAt || !instant(grant.validUntil) || now >= grant.validUntil || grant.revokedAt !== null) return false
  if (viewer.portal === 'caregiver') return grant.kind === 'caregiver' && grant.grantorAccountId !== viewer.accountId && viewer.accountId !== owner.patientAccountId
  return grant.kind === 'doctor_share' && viewer.doctorId === owner.doctorId && viewer.practiceId === owner.practiceId && viewer.locationId === owner.locationId
}
/** Projection/access protocol only. No endpoint, actual patient identity, consent or doctor sharing exists. */
export function patientReportHistoryPreview(owner: ReportHistoryOwner, view: ReportView, conflicts: readonly ReportHistoryConflict[], viewer: ReportHistoryViewer, grant: ReportHistoryGrant | null, now: number) {
  if (!owner || ![owner.patientId, owner.relationshipId, owner.doctorId, owner.practiceId, owner.locationId].every(clinicalUuid) || owner.patientAccountId !== null && !clinicalUuid(owner.patientAccountId) || ![owner.relationshipVersion, owner.consentVersion, owner.releaseVersion].every(version)) return invalid()
  if (!allowed(owner, viewer, grant, view?.event?.source?.versionId, now)) return null
  if (!view || view.syntheticOnly !== true || view.clinicallyVerified !== false || view.externalNotifications !== false || !Number.isSafeInteger(view.version) || view.version < 0 || !claim(view.report) || !Array.isArray(view.history) || view.history.length > 512 || view.version !== view.history.length || !view.event || !instant(Date.parse(view.event.occurrenceUtc)) || ![view.event.source?.releaseId, view.event.source?.versionId, view.event.source?.prescriptionId].every(clinicalUuid) || !version(view.event.source.revision) || !/^[0-9a-f]{64}$/.test(view.event.source.snapshotSha256) || !Array.isArray(conflicts) || conflicts.length > 100 || view.snoozeUntil !== null && !instant(view.snoozeUntil)) return invalid()
  const expectedEventId = [reminderPreviewAlgorithm, view.event.source.releaseId, view.event.source.versionId, view.event.source.snapshotSha256, view.event.source.prescriptionId, view.event.segmentIndex, Date.parse(view.event.occurrenceUtc)].join(':')
  if (!Number.isSafeInteger(view.event.segmentIndex) || view.event.segmentIndex < 0 || view.event.id !== expectedEventId) return invalid()
  let reported: PatientReportedState = 'unreported', priorServerTime: number | null = null, hadReport = false
  const history = view.history as readonly HistoryItem[]
  const entries = history.map((item: HistoryItem, index: number) => {
    if (!item || item.version !== index + 1 || !['taken', 'skip', 'snooze', 'correct'].includes(item.kind) || ![item.actorAccountId, item.actorSessionId].every(clinicalUuid) || !['patient', 'caregiver'].includes(item.reporterKind) || item.patientReported !== true || item.clinicallyVerified !== false || !instant(item.recordedAt) || item.patientTime !== null && !instant(item.patientTime) || !claim(item.report) || !sameSource(item.source, view.event.source) || item.originalOccurrenceUtc !== view.event.occurrenceUtc || item.snoozeUntil !== null && !instant(item.snoozeUntil)) return invalid()
    if (item.kind === 'correct') {
      if (!hadReport || item.correctsVersion !== item.version - 1 || item.version < 2 || typeof item.reason !== 'string' || !item.reason.trim() || item.reason.length > 400) return invalid()
      reported = item.report
    } else {
      if (item.correctsVersion !== null || item.reason !== null) return invalid()
      if (item.kind === 'snooze') { if (item.report !== reported) return invalid() }
      else { if (reported !== 'unreported' || item.report !== item.kind) return invalid(); reported = item.report; hadReport = true }
    }
    const serverClockOutOfOrder = priorServerTime !== null && item.recordedAt < priorServerTime
    priorServerTime = item.recordedAt
    const deviceTimeState = item.patientTime === null ? 'not_provided' as const : item.patientTime > item.recordedAt ? 'reported_after_server' as const : 'reported_unverified' as const
    return Object.freeze({ version: item.version, kind: item.kind, actorAccountId: item.actorAccountId, reporterKind: item.reporterKind, sourceVersionId: item.source.versionId, deviceReportedAt: item.patientTime, serverRecordedAt: item.recordedAt, deviceTimeState, serverClockOutOfOrder, timingUncertain: true, reportedState: item.report, correctsVersion: item.correctsVersion, reason: item.reason, originalOccurrenceUtc: item.originalOccurrenceUtc, patientReported: true, clinicallyVerified: false })
  })
  if (reported !== view.report) return invalid()
  const acceptedReportedState = reported as PatientReportedState
  const conflictIds = new Set<string>()
  const uncertainty = conflicts.map((item: ReportHistoryConflict) => {
    if (!item || !clinicalUuid(item.id) || conflictIds.has(item.id) || !Number.isSafeInteger(item.expectedVersion) || item.expectedVersion < 0 || !version(item.observedVersion) || item.observedVersion <= item.expectedVersion || item.observedVersion > view.version || !claim(item.proposedReport) || !clinicalUuid(item.actorAccountId) || !['patient', 'caregiver'].includes(item.reporterKind) || item.deviceReportedAt !== null && !instant(item.deviceReportedAt) || !instant(item.serverRecordedAt)) return invalid()
    conflictIds.add(item.id)
    return Object.freeze({ id: item.id, expectedVersion: item.expectedVersion, observedVersion: item.observedVersion, proposedReportedState: item.proposedReport, actorAccountId: item.actorAccountId, reporterKind: item.reporterKind, deviceReportedAt: item.deviceReportedAt, serverRecordedAt: item.serverRecordedAt, state: 'unresolved' as const, patientReported: true, clinicallyVerified: false })
  })
  return Object.freeze({ source: Object.freeze({ releaseId: view.event.source.releaseId, versionId: view.event.source.versionId, revision: view.event.source.revision, snapshotSha256: view.event.source.snapshotSha256, prescriptionId: view.event.source.prescriptionId }), originalOccurrenceUtc: view.event.occurrenceUtc, notificationSnoozeUntil: view.snoozeUntil, acceptedReportedState, displayedReportedState: uncertainty.length ? 'uncertain' as const : acceptedReportedState, entries: Object.freeze(entries), conflicts: Object.freeze(uncertainty), timingUncertain: true, patientReported: true, clinicallyVerified: false, syntheticOnly: true, qualifiedSharing: false, clinicalApproval: false, externalNotifications: false, validUntil: Math.min(viewer.validUntil, viewer.portal === 'patient' ? viewer.validUntil : grant!.validUntil) })
}
