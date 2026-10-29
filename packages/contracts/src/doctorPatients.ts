const doctorUuid = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
export interface DoctorPatientForm { name: string; phone: string; email: string; dateOfBirth: string }
export interface DoctorPatientQuery { page: number; size: number; search: string; status: 'active' | 'archived' | 'all' }
export interface DoctorPatientRow extends DoctorPatientForm {
  id: string; practiceId: string; identityId: string; createdLocationId: string; createdBy: string
  createdAt: string; updatedAt: string; archivedAt: string | null; version: number; provenance: 'entered_unverified'
}
export interface DoctorPatientDirectory { rows: DoctorPatientRow[]; total: number; canWrite: boolean }
export interface DoctorPatientDuplicates { rows: DoctorPatientRow[]; total: number; reviewKey: string | null }
const record = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value==='object' && !Array.isArray(value))
const count = (value: unknown): value is number => typeof value==='number' && Number.isSafeInteger(value) && value>=0
const stamp = (value: unknown): value is string => typeof value==='string' && Number.isFinite(Date.parse(value))
const text = (value: unknown,max: number): value is string => typeof value==='string' && value.length<=max
function invalid(): never { throw new Error('DOCTOR_PATIENT_RESPONSE_INVALID') }
export function doctorPatientDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000')) return false
  const date = new Date(`${value}T00:00:00Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0,10)===value
}
export function doctorPatientToday(timezone: string,now = new Date()) {
  const parts = new Intl.DateTimeFormat('en',{ timeZone: timezone,year: 'numeric',month: '2-digit',day: '2-digit' }).formatToParts(now)
  return ['year','month','day'].map(type => parts.find(item => item.type===type)?.value || '').join('-')
}
export function doctorPatientForm(form: DoctorPatientForm): DoctorPatientForm {
  return { name: form.name.trim(),phone: form.phone.trim(),email: form.email.trim(),dateOfBirth: form.dateOfBirth.trim() }
}
export function validDoctorPatientForm(value: DoctorPatientForm,today: string) {
  const form = doctorPatientForm(value)
  return form.name.length>=1 && form.name.length<=160 && form.phone.length<=50 && form.email.length<=254
    && (!form.email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
    && (!form.dateOfBirth || (doctorPatientDate(form.dateOfBirth) && form.dateOfBirth<=today))
}
export function doctorPatientRow(value: unknown,practiceId: string): DoctorPatientRow {
  if (!record(value) || !doctorUuid(value.id) || value.practice_id!==practiceId || !doctorUuid(value.patient_identity_id)
    || !text(value.name,160) || !value.name.trim() || !text(value.phone,50) || !text(value.email,254)
    || !(value.date_of_birth===null || (typeof value.date_of_birth==='string' && doctorPatientDate(value.date_of_birth)))
    || !doctorUuid(value.created_location_id) || !doctorUuid(value.created_by) || !stamp(value.created_at) || !stamp(value.updated_at)
    || !(value.archived_at===null || stamp(value.archived_at)) || !count(value.version) || value.version<1 || value.provenance!=='entered_unverified') invalid()
  return { id: value.id,practiceId,identityId: value.patient_identity_id,name: value.name,phone: value.phone,email: value.email,dateOfBirth: value.date_of_birth || '',createdLocationId: value.created_location_id,createdBy: value.created_by,createdAt: value.created_at,updatedAt: value.updated_at,archivedAt: value.archived_at,version: value.version,provenance: 'entered_unverified' }
}
export function doctorPatientDirectory(value: unknown,practiceId: string): DoctorPatientDirectory {
  if (!record(value) || !Array.isArray(value.rows) || value.rows.length>100 || !count(value.total) || value.total<value.rows.length || typeof value.can_write!=='boolean') invalid()
  const rows = value.rows.map(item => doctorPatientRow(item,practiceId))
  if (new Set(rows.map(item => item.id)).size!==rows.length) invalid()
  return { rows,total: value.total,canWrite: value.can_write }
}
export function doctorPatientDuplicates(value: unknown,practiceId: string): DoctorPatientDuplicates {
  if (!record(value) || !Array.isArray(value.rows) || value.rows.length>10 || !count(value.total) || value.total<value.rows.length
    || (value.total===0 ? value.review_key!==null : typeof value.review_key!=='string' || !/^[0-9a-f]{64}$/.test(value.review_key))) invalid()
  const rows = value.rows.map(item => doctorPatientRow(item,practiceId))
  if (new Set(rows.map(item => item.id)).size!==rows.length) invalid()
  return { rows,total: value.total,reviewKey: value.review_key as string | null }
}
export function doctorPatientResult(value: unknown): { patientId: string; version: number } {
  if (!record(value) || !doctorUuid(value.patient_id) || !count(value.version) || value.version<1) invalid()
  return { patientId: value.patient_id,version: value.version }
}
