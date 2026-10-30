import type { DoctorSetupForm } from './practiceSetup.ts'
import { validDoctorSetupForm } from './practiceSetup.ts'
import type { DoctorRegistrationIdentity } from './authController'
export interface DoctorRegistrationDraft extends DoctorSetupForm {
  flowId: string; email: string; userId: string | null; stage: 'account' | 'practice' | 'challenge' | 'recovery'
  createdAt: number; challengeAt: number; resendAt: number
}
type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
const key = (environment: string) => `doctor-suit.${environment}.registration.v1`
const record = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value))
export function newDoctorRegistrationDraft(now = Date.now(), id = crypto.randomUUID()): DoctorRegistrationDraft {
  return { flowId: id, email: '', userId: null, stage: 'account', createdAt: now, challengeAt: 0, resendAt: 0, displayName: '', practiceName: '', locationName: '', timezone: '' }
}
export function readDoctorRegistrationDraft(storage: StorageLike | null, environment: string, now = Date.now()): DoctorRegistrationDraft | null {
  try {
    const value: unknown = JSON.parse(storage?.getItem(key(environment)) || 'null')
    if (!record(value) || !/^[0-9a-f-]{36}$/i.test(String(value.flowId)) || !['account', 'practice', 'challenge', 'recovery'].includes(String(value.stage))
      || !Number.isSafeInteger(value.createdAt) || Number(value.createdAt) > now || now - Number(value.createdAt) >= 86400000
      || !['displayName','practiceName','locationName','timezone','email'].every(field => typeof value[field] === 'string')
      || !(value.userId === null || typeof value.userId === 'string' && /^[0-9a-f-]{36}$/i.test(value.userId))
      || ![value.challengeAt,value.resendAt].every(time => Number.isSafeInteger(time) && Number(time) >= 0 && Number(time) <= now)) return null
    const form = { displayName: String(value.displayName), practiceName: String(value.practiceName), locationName: String(value.locationName), timezone: String(value.timezone) }
    const email = String(value.email).trim().toLowerCase()
    if (!validDoctorSetupForm(form) || email.length > 254 || email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null
    if (value.stage === 'challenge' && (!email || !validDoctorSetupForm(form, true))) return null
    if (value.stage === 'recovery' && (!email || !value.userId && !validDoctorSetupForm(form, true))) return null
    return { ...form, flowId: String(value.flowId), email, userId: value.userId as string | null, stage: value.stage as DoctorRegistrationDraft['stage'], createdAt: Number(value.createdAt), challengeAt: Number(value.challengeAt), resendAt: Number(value.resendAt) }
  } catch { return null }
}
export function saveDoctorRegistrationDraft(storage: StorageLike | null, environment: string, draft: DoctorRegistrationDraft | null) {
  try {
    if (!draft) { storage?.removeItem(key(environment)); return }
    // Explicit whitelist: never persist passwords, OTPs, tokens, sessions or authority.
    const { flowId,email,userId,stage,createdAt,challengeAt,resendAt,displayName,practiceName,locationName,timezone } = draft
    storage?.setItem(key(environment), JSON.stringify({ flowId,email,userId,stage,createdAt,challengeAt,resendAt,displayName,practiceName,locationName,timezone }))
  } catch { /* Storage denial must not prevent registration. */ }
}
export function bindDoctorRegistrationDraft(draft: DoctorRegistrationDraft, identity: DoctorRegistrationIdentity): DoctorRegistrationDraft | null {
  if (draft.email !== identity.email || draft.userId && draft.userId !== identity.userId) return null
  return { ...draft, userId: identity.userId }
}
