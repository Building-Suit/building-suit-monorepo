import { clinicalReleased, clinicalUuid } from './clinical.ts'
import { doctorAppointmentStates, type DoctorAppointmentState } from '@building-suit/contracts'
/** Proposed fixture admission, not patient identity, legal authority or a server authorization adapter. */
export interface PatientResourceAdmission {
  accountId: string; sessionId: string; patientId: string; relationshipId: string; relationshipVersion: number
  doctorId: string; practiceId: string; locationId: string; kind: 'appointment' | 'released_results'; resourceId: string
  resourceVersion: number; sourceVersionId: string | null; sourceSha256: string | null
  subjectAccountId: string | null; viewer: 'patient' | 'caregiver'; caregiverGrant: { id: string; version: number; recipientAccountId: string; patientId: string; relationshipId: string; purpose: 'appointment' | 'released_results'; validUntil: number; revoked: boolean } | null
  checkedAt: number; validUntil: number; online: boolean; foreground: boolean; revoked: boolean; syntheticOnly: true; legalApproval: false
}
const integer = (n: unknown): n is number => Number.isSafeInteger(n) && Number(n) >= 0
function invalid(): never { throw Error('PATIENT_RESOURCE_PREVIEW_UNAVAILABLE') }
function object(v: unknown): v is Record<string, unknown> { return !!v && typeof v === 'object' && !Array.isArray(v) }
function shape(v: unknown, keys: string[]): v is Record<string, unknown> { return object(v) && Object.keys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k)) }
function timezone(v: unknown) { try { return typeof v === 'string' && !!new Intl.DateTimeFormat('en', { timeZone: v }) } catch { return false } }
function text(v: unknown): v is string { return typeof v === 'string' && v.length > 0 && v.length <= 160 }
function valid(a: PatientResourceAdmission, now: number) {
  if (!a || ![a.accountId, a.sessionId, a.patientId, a.relationshipId, a.doctorId, a.practiceId, a.locationId, a.resourceId].every(clinicalUuid) || !Number.isSafeInteger(a.relationshipVersion) || a.relationshipVersion < 1 || !Number.isSafeInteger(a.resourceVersion) || a.resourceVersion < 1 || !['appointment', 'released_results'].includes(a.kind) || !integer(now) || !integer(a.checkedAt) || a.checkedAt > now || !integer(a.validUntil) || now >= a.validUntil || a.online !== true || a.foreground !== true || a.revoked !== false || a.syntheticOnly !== true || a.legalApproval !== false) return false
  if (a.kind === 'appointment' ? a.sourceVersionId !== null || a.sourceSha256 !== null : !clinicalUuid(a.sourceVersionId) || typeof a.sourceSha256 !== 'string' || !/^[0-9a-f]{64}$/.test(a.sourceSha256)) return false
  if (a.viewer === 'patient') return a.subjectAccountId === a.accountId && a.caregiverGrant === null
  const grant = a.caregiverGrant
  return a.viewer === 'caregiver' && !!grant && clinicalUuid(grant.id) && Number.isSafeInteger(grant.version) && grant.version >= 1 && grant.recipientAccountId === a.accountId && grant.patientId === a.patientId && grant.relationshipId === a.relationshipId && grant.purpose === a.kind && grant.revoked === false && integer(grant.validUntil) && now < grant.validUntil
}
/** Explicit field projection; operations never imply result interpretation or a clinical finding. */
export function patientAppointmentsResultsPreview(raw: unknown, a: PatientResourceAdmission, now: number) {
  if (!valid(a, now) || !shape(raw, ['kind', 'resource_id', 'account_id', 'patient_id', 'relationship_id', 'relationship_version', 'doctor_id', 'practice_id', 'location_id', 'checked_at', 'data_mode', 'clinical_approval', 'payload']) || raw.kind !== a.kind || raw.resource_id !== a.resourceId || raw.account_id !== a.accountId || raw.patient_id !== a.patientId || raw.relationship_id !== a.relationshipId || raw.relationship_version !== a.relationshipVersion || raw.doctor_id !== a.doctorId || raw.practice_id !== a.practiceId || raw.location_id !== a.locationId || raw.checked_at !== a.checkedAt || raw.data_mode !== 'synthetic' || raw.clinical_approval !== false) return invalid()
  const provenance = Object.freeze({ doctorId: a.doctorId, practiceId: a.practiceId, locationId: a.locationId, relationshipId: a.relationshipId, relationshipVersion: a.relationshipVersion })
  const until = Math.min(a.validUntil, a.caregiverGrant?.validUntil ?? a.validUntil)
  if (a.kind === 'appointment') {
    const p = raw.payload
    if (!shape(p, ['id', 'version', 'state', 'starts_at', 'ends_at', 'timezone', 'doctor_name', 'location_name']) || p.id !== a.resourceId || p.version !== a.resourceVersion || !doctorAppointmentStates.includes(p.state as DoctorAppointmentState) || typeof p.starts_at !== 'string' || typeof p.ends_at !== 'string' || !integer(Date.parse(p.starts_at)) || !integer(Date.parse(p.ends_at)) || Date.parse(p.ends_at) <= Date.parse(p.starts_at) || !timezone(p.timezone) || !text(p.doctor_name) || !text(p.location_name)) return invalid()
    return Object.freeze({ kind: 'appointment' as const, id: a.resourceId, version: a.resourceVersion, state: p.state as DoctorAppointmentState, startsAt: p.starts_at, endsAt: p.ends_at, timezone: p.timezone as string, doctorName: p.doctor_name, locationName: p.location_name, provenance, checkedAt: a.checkedAt, validUntil: until, operationalOnly: true, clinicalApproval: false })
  }
  const release = clinicalReleased(raw.payload, a.resourceId)
  if (release.patient_id !== a.patientId || release.responsible_doctor !== a.doctorId || release.revision !== a.resourceVersion || release.version_id !== a.sourceVersionId || release.snapshot_sha256 !== a.sourceSha256 || Date.parse(release.finalized_at) > now || Date.parse(release.expires_at) <= now) return invalid()
  return Object.freeze({ kind: 'released_results' as const, id: release.release_id, version: release.revision, sourceVersionId: release.version_id, sourceSha256: release.snapshot_sha256, finalizedAt: release.finalized_at, doctorName: release.doctor_name, locationName: release.location_name, timezone: release.timezone, provenance, results: Object.freeze(release.results.map(r => Object.freeze({ id: r.id, orderId: r.order_id, documentVersionId: r.document_version_id, annotation: r.annotation, stage: 'released' as const }))), followUp: Object.freeze(release.orders.filter(o => o.kind === 'follow_up').map(o => Object.freeze({ id: o.id, request: o.request, dueAt: o.due_at, operationalState: o.state, reason: o.reason }))), checkedAt: a.checkedAt, validUntil: Math.min(until, Date.parse(release.expires_at)), clinicalApproval: false, professionalSignature: false })
}
/** Memory-only fixture reader. Future integration must wire clear() to withdrawal/offline/background events. */
export function createPatientResourcePreview(dependencies: { admission: () => PatientResourceAdmission | null; read: (admission: PatientResourceAdmission) => Promise<unknown>; now: () => number }) {
  let generation = 0, key: string | null = null, value: ReturnType<typeof patientAppointmentsResultsPreview> | null = null, lastClock = 0
  function clear() { generation++; key = null; value = null }
  function clock() { const at = dependencies.now(); if (!integer(at) || at < lastClock) { clear(); return null } lastClock = at; return at }
  const signature = (a: PatientResourceAdmission | null) => a ? JSON.stringify(a) : null
  function current() { const a = dependencies.admission(), at = clock(); if (value && (!a || at === null || !valid(a, at) || at >= value.validUntil || key !== signature(a))) clear(); return value }
  async function load() {
    clear()
    const original = dependencies.admission(), at = clock(), version = generation
    if (!original || at === null || !valid(original, at)) return false
    const captured = structuredClone(original), requestedKey = signature(captured)
    try {
      const raw = await dependencies.read(captured), checkedAt = clock(), fresh = dependencies.admission()
      if (generation !== version || checkedAt === null || !fresh || !valid(fresh, checkedAt) || signature(fresh) !== requestedKey) return false
      const projected = patientAppointmentsResultsPreview(raw, fresh, checkedAt)
      value = projected; key = requestedKey; return true
    } catch { if (generation === version) clear(); return false }
  }
  return { load, current, clear }
}
