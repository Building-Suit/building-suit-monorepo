import { clinicalReleased, clinicalUuid, type ClinicalPrescription } from './clinical.ts'
import { patientReleasedTimeline, type PatientTimelineScope, type PatientTimelineItem } from './patientReleasedTimeline.ts'

export const patientPrescriptionStates = ['active', 'future', 'completed', 'stopped', 'unknown'] as const
export interface PatientPrescriptionRequest { releaseId: string; prescriptionId: string }
export interface PatientPrescriptionSource { releaseId: string; versionId: string; revision: number; snapshotSha256: string; prescriptionId: string }
export interface PatientPrescriptionPreview {
  binding: string
  scopeKey: string
  observedAt: number
  provenance: PatientTimelineItem
  source: PatientPrescriptionSource
  prescription: ClinicalPrescription
  state: typeof patientPrescriptionStates[number] | 'superseded'
  instructionKind: 'scheduled' | 'as_needed' | 'mixed'
  currentVersionKnown: boolean
  reminderPreviewSource: PatientPrescriptionSource | null
  validUntil: number
  syntheticOnly: true
  professionalSignature: false
  clinicalApproval: false
  livePrescribing: false
  externalNotifications: false
}
function object(value: unknown): value is Record<string, unknown> { return !!value && typeof value === 'object' && !Array.isArray(value) }
function shape(value: unknown, keys: string[]): value is Record<string, unknown> { return object(value) && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key)) }
function invalid(): never { throw Error('PATIENT_PRESCRIPTION_PREVIEW_INVALID') }
function prescriptionCopy(value: ClinicalPrescription): ClinicalPrescription {
  // Preserve decimal strings and full instructions; never normalize/convert a medical dose.
  return Object.freeze({ ...value, medicine: Object.freeze({ ...value.medicine }), dose: Object.freeze({ ...value.dose }), segments: Object.freeze(value.segments.map(segment => Object.freeze({ ...segment, weekdays: Object.freeze([...segment.weekdays]), times: Object.freeze([...segment.times]) }))) }) as unknown as ClinicalPrescription
}
/** Strict fixture projection only. No patient endpoint or qualified clinical source is installed. */
export function patientPrescriptionPreview(raw: unknown, scope: PatientTimelineScope, request: PatientPrescriptionRequest, now: number): PatientPrescriptionPreview {
  if (![request?.releaseId, request?.prescriptionId].every(clinicalUuid) || !shape(raw, ['timeline_page', 'prescription_id', 'current']) || raw.prescription_id !== request.prescriptionId || !object(raw.timeline_page) || raw.timeline_page.total !== 1 || !Array.isArray(raw.timeline_page.rows) || raw.timeline_page.rows.length !== 1) return invalid()
  const timeline = patientReleasedTimeline(raw.timeline_page, scope, 0, now)
  const row = raw.timeline_page.rows[0]
  if (!object(row) || !object(row.release) || row.release.release_id !== request.releaseId) return invalid()
  const released = clinicalReleased(row.release, request.releaseId)
  const prescription = released.prescriptions.find(item => item.id === request.prescriptionId)
  if (!prescription) return invalid()
  const source: PatientPrescriptionSource = Object.freeze({ releaseId: released.release_id, versionId: released.version_id, revision: released.revision, snapshotSha256: released.snapshot_sha256, prescriptionId: prescription.id })
  let state: PatientPrescriptionPreview['state'] = 'unknown', known = false
  if (raw.current !== null) {
    const current = raw.current
    if (!shape(current, ['version_id', 'revision', 'snapshot_sha256', 'status', 'checked_at', 'valid_until']) || !clinicalUuid(current.version_id) || !Number.isSafeInteger(current.revision) || Number(current.revision) < released.revision || typeof current.snapshot_sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(current.snapshot_sha256) || !patientPrescriptionStates.includes(current.status as typeof patientPrescriptionStates[number]) || !Number.isSafeInteger(current.checked_at) || Number(current.checked_at) < 0 || Number(current.checked_at) > now || !Number.isSafeInteger(current.valid_until) || Number(current.valid_until) <= now || Number(current.valid_until) > timeline.validUntil) return invalid()
    if (current.version_id === released.version_id) {
      if (current.revision !== released.revision || current.snapshot_sha256 !== released.snapshot_sha256) return invalid()
      state = current.status as typeof patientPrescriptionStates[number]
      known = state !== 'unknown'
    } else {
      if (Number(current.revision) <= released.revision) return invalid()
      state = 'superseded'; known = true
    }
  }
  const asNeeded = prescription.segments.filter(segment => segment.kind === 'as_needed').length
  const instructionKind = asNeeded === prescription.segments.length ? 'as_needed' : asNeeded ? 'mixed' : 'scheduled'
  const reminderPreviewSource = known && ['active', 'future'].includes(state) && instructionKind === 'scheduled' ? source : null
  const validUntil = raw.current === null ? timeline.validUntil : Number((raw.current as Record<string, unknown>).valid_until)
  const binding = JSON.stringify([scope.environment, scope.portal, scope.accountId, scope.sessionId, scope.patientId, row.relationship_id, row.relationship_version, row.doctor_id, row.practice_id, row.location_id, request.prescriptionId])
  return Object.freeze({ binding, scopeKey: JSON.stringify(scope), observedAt: now, provenance: timeline.groups[0]!.items[0]!, source, prescription: prescriptionCopy(prescription), state, instructionKind, currentVersionKnown: known, reminderPreviewSource, validUntil, syntheticOnly: true, professionalSignature: false, clinicalApproval: false, livePrescribing: false, externalNotifications: false })
}
/** A pure cancellation/replacement plan. No native notification is scheduled or cancelled here. */
export function reconcilePatientPrescriptionPreview(before: PatientPrescriptionPreview, after: PatientPrescriptionPreview, now: number) {
  if (!Number.isSafeInteger(now) || now < before.observedAt || now < after.observedAt || now >= after.validUntil || before.binding !== after.binding) return invalid()
  const previous = before.reminderPreviewSource, next = after.reminderPreviewSource
  const changed = previous !== null && JSON.stringify(previous) !== JSON.stringify(next)
  return Object.freeze({ cancelSource: changed ? previous : null, nextPreviewSource: next, historicalSource: before.source, syntheticOnly: true, externalNotifications: false, clinicalApproval: false })
}
/** Exercise fresh-read-before-plan ordering with fixture callbacks; no production transport exists. */
export async function refreshPatientPrescriptionPreview(before: PatientPrescriptionPreview, request: PatientPrescriptionRequest, dependencies: {
  scope: () => PatientTimelineScope | null
  load: (scope: PatientTimelineScope, request: PatientPrescriptionRequest) => Promise<unknown>
  now: () => number
}) {
  const selected = dependencies.scope()
  if (!selected) return null
  const key = JSON.stringify(selected), capturedRequest = Object.freeze({ ...request })
  if (key !== before.scopeKey) return null
  try {
    const requestedAt = dependencies.now()
    if (!Number.isSafeInteger(requestedAt) || requestedAt < before.observedAt) return null
    const captured = Object.freeze({ ...selected, relationships: Object.freeze(selected.relationships.map(r => Object.freeze({ ...r, locationIds: Object.freeze([...r.locationIds]) }))) })
    // Validate scope/request against the previously selected source before invoking any adapter.
    if (![request.releaseId, request.prescriptionId].every(clinicalUuid) || request.prescriptionId !== before.source.prescriptionId || selected.portal !== 'patient' || selected.environment !== 'synthetic') return null
    const raw = await dependencies.load(captured, capturedRequest)
    if (key !== JSON.stringify(dependencies.scope())) return null
    const now = dependencies.now()
    if (now < requestedAt || object(raw) && object(raw.current) && Number(raw.current.checked_at) < requestedAt) return null
    const after = patientPrescriptionPreview(raw, captured, capturedRequest, now)
    return Object.freeze({ after, reconciliation: reconcilePatientPrescriptionPreview(before, after, now) })
  } catch { return null }
}
