const doctorUuid = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
import { doctorPatientRow,type DoctorPatientRow } from './doctorPatients.ts'
export interface DoctorPatientActivity { id: number; type: string; version: number; actorId: string; actorLabel: string; locationId: string; locationName: string; happenedAt: string }
export interface DoctorPatientProfile { patient: DoctorPatientRow; activity: DoctorPatientActivity[]; activityTotal: number; source: { locationId: string; locationName: string; actorLabel: string }; documentsRead: boolean; documentsWrite: boolean }
export interface DoctorDocumentVersion { id: string; documentId: string; revision: number; filename: string; mime: 'application/pdf' | 'image/png' | 'image/jpeg'; size: number; uploadedBy: string; uploaderLabel: string; uploadedAt: string; locationId: string; locationName: string; timezone: string; provenance: 'uploaded_unreviewed' }
export interface DoctorDocumentRow { id: string; version: number; archivedAt: string | null; current: DoctorDocumentVersion }
export interface DoctorDocumentDirectory { rows: DoctorDocumentRow[]; total: number; canWrite: boolean }
export interface DoctorDocumentEvent { id: number; type: string; versionId: string; actorId: string; actorLabel: string; locationName: string; timezone: string; happenedAt: string }
export interface DoctorDocumentHistory { versions: DoctorDocumentVersion[]; total: number; events: DoctorDocumentEvent[] }
export const doctorProfileRecord = (value: unknown): value is Record<string,unknown> => Boolean(value && typeof value==='object' && !Array.isArray(value))
const text = (value: unknown,max = 160): value is string => typeof value==='string' && value.length<=max
const count = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value)>=0
const stamp = (value: unknown): value is string => typeof value==='string' && Number.isFinite(Date.parse(value))
function invalid(): never { throw new Error('DOCTOR_PROFILE_RESPONSE_INVALID') }
export function doctorPatientProfile(value: unknown,practiceId: string,patientId: string): DoctorPatientProfile {
  if (!doctorProfileRecord(value) || !Array.isArray(value.activity) || value.activity.length>100 || !count(value.activity_total) || value.activity_total<value.activity.length || !doctorProfileRecord(value.source_context)
    || !doctorUuid(value.source_context.location_id) || !text(value.source_context.location_name) || !text(value.source_context.actor_label)
    || typeof value.documents_read!=='boolean' || typeof value.documents_write!=='boolean' || (value.documents_write && !value.documents_read)) invalid()
  const patient = doctorPatientRow(value.patient,practiceId); if (patient.id!==patientId || patient.createdLocationId!==value.source_context.location_id || (patient.archivedAt && value.documents_write)) invalid()
  const activity = value.activity.map(item => {
    if (!doctorProfileRecord(item) || !count(item.id) || !['patient.created','patient.corrected','patient.archived'].includes(String(item.event_type)) || !count(item.record_version) || item.record_version<1 || !doctorUuid(item.actor_user_id) || !text(item.actor_label) || !doctorUuid(item.location_id) || !text(item.location_name) || !stamp(item.happened_at) || item.provenance!=='entered_unverified') invalid()
    return { id: item.id,type: String(item.event_type),version: item.record_version,actorId: item.actor_user_id,actorLabel: item.actor_label,locationId: item.location_id,locationName: item.location_name,happenedAt: item.happened_at }
  })
  if (new Set(activity.map(item => item.id)).size!==activity.length) invalid()
  return { patient,activity,activityTotal: value.activity_total,source: { locationId: value.source_context.location_id,locationName: value.source_context.location_name,actorLabel: value.source_context.actor_label },documentsRead: value.documents_read,documentsWrite: value.documents_write }
}
export function doctorDocumentVersion(value: unknown,documentId: string): DoctorDocumentVersion {
  if (!doctorProfileRecord(value) || !doctorUuid(value.id) || value.document_id!==documentId || !count(value.revision) || value.revision<1 || !text(value.filename) || !value.filename
    || !['application/pdf','image/png','image/jpeg'].includes(String(value.mime_type)) || !count(value.byte_size) || value.byte_size<1 || value.byte_size>5242880 || !doctorUuid(value.uploaded_by) || !text(value.uploaded_by_label)
    || !stamp(value.uploaded_at) || !doctorUuid(value.location_id) || !text(value.location_name) || !text(value.timezone,100) || value.provenance!=='uploaded_unreviewed') invalid()
  try { new Intl.DateTimeFormat('en',{ timeZone: value.timezone }) } catch { invalid() }
  return { id: value.id,documentId,revision: value.revision,filename: value.filename,mime: value.mime_type as DoctorDocumentVersion['mime'],size: value.byte_size,uploadedBy: value.uploaded_by,uploaderLabel: value.uploaded_by_label,uploadedAt: value.uploaded_at,locationId: value.location_id,locationName: value.location_name,timezone: value.timezone,provenance: 'uploaded_unreviewed' }
}
export function doctorDocumentDirectory(value: unknown,practiceId: string,patientId: string): DoctorDocumentDirectory {
  if (!doctorProfileRecord(value) || !Array.isArray(value.rows) || value.rows.length>50 || !count(value.total) || value.total<value.rows.length || typeof value.can_write!=='boolean') invalid()
  const rows = value.rows.map(item => {
    if (!doctorProfileRecord(item) || !doctorUuid(item.id) || item.practice_id!==practiceId || item.patient_id!==patientId || !count(item.version) || item.version<1 || !(item.archived_at===null || stamp(item.archived_at))) invalid()
    return { id: item.id,version: item.version,archivedAt: item.archived_at,current: doctorDocumentVersion(item.current,item.id) }
  })
  if (new Set(rows.map(item => item.id)).size!==rows.length) invalid()
  return { rows,total: value.total,canWrite: value.can_write }
}
export function doctorDocumentHistory(value: unknown,documentId: string): DoctorDocumentHistory {
  if (!doctorProfileRecord(value) || !Array.isArray(value.versions) || value.versions.length>50 || !count(value.total) || value.total<value.versions.length || !Array.isArray(value.events) || value.events.length>100) invalid()
  const versions = value.versions.map(item => doctorDocumentVersion(item,documentId))
  const events = value.events.map(item => {
    if (!doctorProfileRecord(item) || !count(item.id) || !['document.uploaded','document.replaced','document.archived','document.download_requested'].includes(String(item.event_type)) || !doctorUuid(item.version_id) || !doctorUuid(item.actor_user_id) || !text(item.actor_label) || !text(item.location_name) || !text(item.timezone,100) || !stamp(item.happened_at)) invalid()
    try { new Intl.DateTimeFormat('en',{ timeZone: item.timezone }) } catch { invalid() }
    return { id: item.id,type: String(item.event_type),versionId: item.version_id,actorId: item.actor_user_id,actorLabel: item.actor_label,locationName: item.location_name,timezone: item.timezone,happenedAt: item.happened_at }
  })
  if (new Set(versions.map(item => item.id)).size!==versions.length || new Set(events.map(item => item.id)).size!==events.length) invalid()
  return { versions,total: value.total,events }
}
