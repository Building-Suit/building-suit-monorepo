import { doctorEntitlement,type DoctorEntitlement } from './entitlement.ts'
import { doctorEditionMode,type DoctorEditionMode } from './administrativeEdition.ts'
import { doctorUuid } from './locationContext.ts'
export interface DoctorLocationForm { name: string; timezone: string; phone: string; address: string }
export interface DoctorLocationRow extends DoctorLocationForm { id: string; practiceId: string; archivedAt: string | null; version: number; canManage: boolean; canEdit: boolean }
export interface DoctorLocationDirectory { practiceName: string; rows: DoctorLocationRow[]; total: number; canCreate: boolean; edition?: DoctorEditionMode; entitlement?: DoctorEntitlement }
export interface DoctorLocationQuery { page: number; size: number; search: string }
const record = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value))
function invalid(): never { throw new Error('DOCTOR_LOCATION_RESPONSE_INVALID') }
export function doctorLocationDirectory(value: unknown, practiceId: string): DoctorLocationDirectory {
  if (!record(value) || !Array.isArray(value.rows) || !Number.isSafeInteger(value.total) || Number(value.total)<0 || typeof value.can_create !== 'boolean' || typeof value.practice_name !== 'string') invalid()
  if(value.edition!==undefined && !doctorEditionMode(value.edition))invalid()
  const edition=value.edition as DoctorEditionMode|undefined;const entitlement=doctorEntitlement(value.entitlement,edition)
  if(entitlement && value.can_create && !entitlement.canAddClinic)invalid()
  const rows = value.rows.map((row): DoctorLocationRow => {
    if (!record(row) || !doctorUuid(row.id) || row.practice_id !== practiceId || typeof row.name !== 'string' || typeof row.timezone !== 'string'
      || typeof row.contact_phone !== 'string' || typeof row.contact_address !== 'string' || !(row.archived_at === null || typeof row.archived_at === 'string')
      || !Number.isSafeInteger(row.version) || Number(row.version)<1 || typeof row.can_manage !== 'boolean') invalid()
    if((edition==='administrative_candidate' || row.can_edit!==undefined) && typeof row.can_edit!=='boolean')invalid()
    const canEdit=row.can_edit===undefined ? row.can_manage && row.archived_at===null : row.can_edit
    if(canEdit && (!row.can_manage || row.archived_at!==null || entitlement?.writesAllowed===false))invalid()
    return { id: row.id, practiceId, name: row.name, timezone: row.timezone, phone: row.contact_phone, address: row.contact_address, archivedAt: row.archived_at, version: Number(row.version), canManage: row.can_manage,canEdit: Boolean(canEdit) }
  })
  return { practiceName: value.practice_name, rows, total: Number(value.total), canCreate: value.can_create,...(edition?{edition}:{}),...(entitlement?{entitlement}:{}) }
}
export function validDoctorLocationForm(form: DoctorLocationForm): boolean {
  if (!form.name.trim() || form.name.length>160 || !form.timezone || form.timezone.length>100 || /^[+-]/.test(form.timezone) || form.phone.length>60 || form.address.length>500) return false
  try { new Intl.DateTimeFormat('en', { timeZone: form.timezone }).format(0); return true } catch { return false }
}
