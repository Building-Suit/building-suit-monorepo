export interface DoctorSetupForm { displayName: string; practiceName: string; locationName: string; timezone: string }
export interface DoctorSetupDraft extends DoctorSetupForm { commandKey: string; version: number }
export interface DoctorPracticeSetup {
  enrollment: 'owner' | 'delegated-only'
  profile: { displayName: string; professionalVerification: 'unverified' } | null
  practice: { id: string; name: string; version: number } | null
  location: { id: string; name: string; timezone: string; version: number } | null
  draft: DoctorSetupDraft | null
}
const record = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value))
const uuid = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
const text = (value: unknown): value is string => typeof value === 'string'
const version = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) > 0
function invalid(): never { throw new Error('DOCTOR_SETUP_RESPONSE_INVALID') }
export function doctorSetupDraft(value: unknown): DoctorSetupDraft {
  if (!record(value) || !uuid(value.command_key) || !version(value.version) || !text(value.display_name) || !text(value.practice_name) || !text(value.location_name) || !text(value.timezone)) invalid()
  return { commandKey: value.command_key, version: value.version, displayName: value.display_name, practiceName: value.practice_name, locationName: value.location_name, timezone: value.timezone }
}
export function doctorPracticeSetup(value: unknown): DoctorPracticeSetup {
  if (!record(value) || !['owner', 'delegated-only'].includes(String(value.enrollment))) invalid()
  const p = value.profile; const w = value.practice; const l = value.location
  if (p !== null && (!record(p) || !text(p.display_name) || p.professional_verification !== 'unverified')) invalid()
  if (w !== null && (!record(w) || !uuid(w.id) || !text(w.name) || !version(w.version))) invalid()
  if (l !== null && (!record(l) || !uuid(l.id) || !text(l.name) || !text(l.timezone) || !version(l.version))) invalid()
  if (Boolean(w) !== Boolean(p) || (l && !w) || (value.enrollment === 'delegated-only' && (w || p))) invalid()
  return {
    enrollment: value.enrollment as DoctorPracticeSetup['enrollment'],
    profile: p ? { displayName: p.display_name as string, professionalVerification: 'unverified' } : null,
    practice: w ? { id: w.id as string, name: w.name as string, version: w.version as number } : null,
    location: l ? { id: l.id as string, name: l.name as string, timezone: l.timezone as string, version: l.version as number } : null,
    draft: value.draft === null ? null : doctorSetupDraft(value.draft),
  }
}
export function doctorSetupForm(setup: DoctorPracticeSetup): DoctorSetupForm {
  return setup.practice ? { displayName: setup.profile?.displayName || '', practiceName: setup.practice.name, locationName: setup.location?.name || '', timezone: setup.location?.timezone || '' }
    : { displayName: setup.draft?.displayName || '', practiceName: setup.draft?.practiceName || '', locationName: setup.draft?.locationName || '', timezone: setup.draft?.timezone || '' }
}
export function validDoctorSetupForm(form: DoctorSetupForm, complete = false, profileOnly = false): boolean {
  if (form.displayName.length > 120 || form.practiceName.length > 160 || (!profileOnly && (form.locationName.length > 160 || form.timezone.length > 100))) return false
  if (complete && (!form.displayName.trim() || !form.practiceName.trim() || (!profileOnly && (!form.locationName.trim() || !form.timezone)))) return false
  if (!profileOnly && form.timezone) { if (/^[+-]/.test(form.timezone)) return false; try { new Intl.DateTimeFormat('en', { timeZone: form.timezone }).format(0) } catch { return false } }
  return true
}
