export interface DoctorAccountForm { personalName: string; contactPhone: string; inAppConfirmations: boolean }
export interface DoctorAccountSettings extends DoctorAccountForm { version: number; canChangeContact: boolean }
export function validDoctorAccountForm(value: DoctorAccountForm) {
  return typeof value.personalName==='string' && value.personalName===value.personalName.trim() && value.personalName.length<=120 && !Array.from(value.personalName).some(character => character.charCodeAt(0)<32 || character.charCodeAt(0)===127)
    && typeof value.contactPhone==='string' && (value.contactPhone==='' || /^\+[1-9][0-9]{6,14}$/.test(value.contactPhone)) && typeof value.inAppConfirmations==='boolean'
}
export function doctorAccountSettings(value: unknown): DoctorAccountSettings {
  if (!value || typeof value!=='object') throw { code: '22023' }
  const row = value as Record<string,unknown>
  const form = { personalName: row.personal_name,contactPhone: row.contact_phone,inAppConfirmations: row.in_app_confirmations } as DoctorAccountForm
  if (!validDoctorAccountForm(form) || !Number.isSafeInteger(row.version) || Number(row.version)<0 || typeof row.can_change_contact!=='boolean') throw { code: '22023' }
  return { ...form,version: Number(row.version),canChangeContact: row.can_change_contact }
}
