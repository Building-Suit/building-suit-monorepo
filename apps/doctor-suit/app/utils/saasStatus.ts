import type { DoctorIdentity } from './authController'
import { doctorUuid } from './locationContext.ts'
import { doctorSaasTermsVersion,type DoctorSaasTermsVersion } from './saasTerms.ts'
export type DoctorSaasState = 'unconfigured' | 'trial' | 'expired' | 'scheduled' | 'suspended'
export interface DoctorSaasPeriod { id: string; kind: 'trial'; termsId: string; startedAt: string; endsAt: string; acceptedDocumentRef: string }
export interface DoctorSaasStatus {
  subscriberUserId: string; practiceId: string | null; state: DoctorSaasState; revision: number; periodActive: boolean
  period: DoctorSaasPeriod | null; terms: DoctorSaasTermsVersion | null
  usage?:{clinics:number;staffMembers:number;staffInvitations:number;staffTotal:number}
  writesAllowed?: boolean
  observedAt?: string
  dataMode: 'synthetic'; paidActivationAvailable: false; liveActivation: false
}
const record = (value: unknown): value is Record<string,unknown> => Boolean(value && typeof value==='object' && !Array.isArray(value))
function invalid(): never { throw new Error('DOCTOR_SAAS_STATUS_RESPONSE_INVALID') }
function timestamp(value: unknown): string {
  if(typeof value!=='string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(value) || !Number.isFinite(Date.parse(value)))invalid()
  return new Date(value).toISOString()
}
/** Period state is a server projection, not client authorization or paid evidence. */
export function doctorSaasStatus(value: unknown,identity: DoctorIdentity): DoctorSaasStatus {
  if(!record(value) || value.subscriber_user_id!==identity.userId || value.practice_id!==identity.practiceId
    || !['unconfigured','trial','expired','scheduled','suspended'].includes(String(value.state)) || !Number.isSafeInteger(value.revision) || Number(value.revision)<0
    || value.period_active!==(value.state==='trial') || value.data_mode!=='synthetic' || value.paid_activation_available!==false || value.live_activation!==false)invalid()
  if(value.business_writes_allowed!==undefined && (typeof value.business_writes_allowed!=='boolean' || (value.business_writes_allowed && !value.period_active)))invalid()
  let usage:DoctorSaasStatus['usage']
  if(value.usage!==undefined){const row=value.usage;if(!record(row)||['clinics','staff_members','staff_invitations','staff_total'].some(key=>!Number.isSafeInteger(row[key])||Number(row[key])<0)||row.staff_total!==Number(row.staff_members)+Number(row.staff_invitations))invalid();usage={clinics:Number(row.clinics),staffMembers:Number(row.staff_members),staffInvitations:Number(row.staff_invitations),staffTotal:Number(row.staff_total)}}
  const observation=value.observed_at===undefined?undefined:timestamp(value.observed_at)
  const base = { ...(usage?{usage}:{}), ...(value.business_writes_allowed===undefined?{}:{writesAllowed:value.business_writes_allowed as boolean}),...(observation?{observedAt:observation}:{}), subscriberUserId: identity.userId,practiceId: identity.practiceId,state: value.state as DoctorSaasState,revision: Number(value.revision),periodActive: value.period_active as boolean,dataMode: 'synthetic' as const,paidActivationAvailable: false as const,liveActivation: false as const }
  if(value.state==='unconfigured') { if(value.revision!==0 || value.period!==null || value.terms!==null)invalid();return { ...base,period: null,terms: null } }
  if(value.revision===0 || !record(value.period) || !doctorUuid(value.period.id) || value.period.kind!=='trial')invalid()
  const terms = doctorSaasTermsVersion(value.terms)
  if(value.period.terms_id!==terms.id || terms.trialDays<1 || value.period.accepted_document_ref!==terms.termsDocumentRef)invalid()
  const startedAt = timestamp(value.period.started_at);const endsAt = timestamp(value.period.ends_at)
  if(startedAt>=endsAt || (observation && ((value.state==='trial' && (observation<startedAt || observation>=endsAt)) || (value.state==='expired' && observation<endsAt) || (value.state==='scheduled' && observation>=startedAt))))invalid()
  return { ...base,terms,period: { id: value.period.id,kind: 'trial',termsId: terms.id,startedAt,endsAt,acceptedDocumentRef: terms.termsDocumentRef } }
}
export type DoctorSaasError = 'configuration' | 'conflict' | 'trial-used' | 'trial-unavailable' | 'staff-limit' | 'clinic-limit' | 'inactive' | 'over-limit-read-only' | 'denied' | 'invalid' | 'network'
export function doctorSaasFailure(error: unknown): DoctorSaasError {
  const code = record(error) ? error.code : null
  if(code==='DS001')return 'configuration'
  if(code==='DS002')return 'staff-limit'
  if(code==='DS003')return 'clinic-limit'
  if(code==='DS006')return 'inactive'
  if(code==='DS007')return 'over-limit-read-only'
  if(code==='DS004')return 'trial-used'
  if(code==='DS005')return 'trial-unavailable'
  if(code==='40001')return 'conflict'
  if(code==='42501')return 'denied'
  if(['22023','23514'].includes(String(code)))return 'invalid'
  return 'network'
}
export interface DoctorSaasTrialRequest { termsId: string; configurationRevision: number; documentRef: string }
export interface DoctorSaasTrialReceipt { periodId: string; termsId: string; startedAt: string; endsAt: string; revision: 1 }
/** A creation receipt never supplies current entitlement or paid state. */
export function doctorSaasTrialReceipt(value: unknown,termsId: string): DoctorSaasTrialReceipt {
  if(!record(value) || !doctorUuid(value.period_id) || value.terms_id!==termsId || value.revision!==1)invalid()
  const startedAt = timestamp(value.started_at);const endsAt = timestamp(value.ends_at)
  if(startedAt>=endsAt)invalid()
  return { periodId: value.period_id,termsId,startedAt,endsAt,revision: 1 }
}
