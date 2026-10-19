import type { DoctorIdentity } from './authController'
import { doctorUuid } from './locationContext.ts'
export type DoctorSaasQuota = { kind: 'unlimited' } | { kind: 'limited'; limit: number }
export interface DoctorSaasTermsVersion {
  id: string; planKey: string; version: number; currency: string; currencyExponent: number
  monthlyMinor: number | null; yearlyMinor: number | null; trialDays: number; graceDays: number
  staff: DoctorSaasQuota; clinics: DoctorSaasQuota
  overLimitPolicy: 'block_new_allocation' | 'read_only_until_within_limit'
  renewalPolicy: 'manual' | 'automatic_opt_in'; expiryPolicy: 'historical_read_only'
  cancellationPolicy: 'period_end' | 'immediate_read_only'; refundPolicy: 'manual_review' | 'none_where_permitted'
  termsDocumentRef: string
}
export interface DoctorSaasTermsProjection {
  subscriberUserId: string; practiceId: string | null; configurationRevision: number
  configured: boolean; terms: DoctorSaasTermsVersion | null
  dataMode: 'synthetic'; paymentRoute: 'unconfigured'; purchaseAvailable: false; liveActivation: false
}
const record = (value: unknown): value is Record<string,unknown> => Boolean(value && typeof value==='object' && !Array.isArray(value))
const integer = (value: unknown,max = Number.MAX_SAFE_INTEGER): value is number => Number.isSafeInteger(value) && Number(value)>=0 && Number(value)<=max
const positive = (value: unknown): value is number => integer(value,2147483647) && value>0
function invalid(): never { throw new Error('DOCTOR_SAAS_TERMS_RESPONSE_INVALID') }
function choice<T extends string>(value: unknown,allowed: readonly T[]): T { if(typeof value!=='string' || !allowed.includes(value as T))invalid();return value as T }
function quota(value: unknown): DoctorSaasQuota {
  if(!record(value))invalid()
  if(value.kind==='unlimited' && !Object.hasOwn(value,'limit'))return { kind: 'unlimited' }
  if(value.kind==='limited' && integer(value.limit,2147483647))return { kind: 'limited',limit: value.limit }
  return invalid()
}
export function doctorSaasTermsVersion(value: unknown): DoctorSaasTermsVersion {
  if(!record(value) || !doctorUuid(value.terms_id) || typeof value.plan_key!=='string' || !/^[a-z][a-z0-9_-]{2,63}$/.test(value.plan_key)
    || !positive(value.version) || typeof value.currency!=='string' || !/^[A-Z]{3}$/.test(value.currency) || !integer(value.currency_exponent,4)
    || (value.monthly_minor!==null && !integer(value.monthly_minor)) || (value.yearly_minor!==null && !integer(value.yearly_minor))
    || (value.monthly_minor===null && value.yearly_minor===null) || !integer(value.trial_days,2147483647) || !integer(value.grace_days,2147483647)
    || typeof value.terms_document_ref!=='string' || !/^[a-z0-9][a-z0-9._/-]{0,199}$/.test(value.terms_document_ref))invalid()
  return { id: value.terms_id,planKey: value.plan_key,version: value.version,currency: value.currency,currencyExponent: value.currency_exponent,
    monthlyMinor: value.monthly_minor as number | null,yearlyMinor: value.yearly_minor as number | null,trialDays: value.trial_days,graceDays: value.grace_days,
    staff: quota(value.staff),clinics: quota(value.clinics),overLimitPolicy: choice(value.over_limit_policy,['block_new_allocation','read_only_until_within_limit']),renewalPolicy: choice(value.renewal_policy,['manual','automatic_opt_in']),
    expiryPolicy: choice(value.expiry_policy,['historical_read_only']),cancellationPolicy: choice(value.cancellation_policy,['period_end','immediate_read_only']),
    refundPolicy: choice(value.refund_policy,['manual_review','none_where_permitted']),termsDocumentRef: value.terms_document_ref }
}
/** Read-only projection. This decoder cannot configure offers, admission or paid authority. */
export function doctorSaasTerms(value: unknown,identity: DoctorIdentity): DoctorSaasTermsProjection {
  if(!record(value) || value.subscriber_user_id!==identity.userId || value.practice_id!==identity.practiceId
    || !positive(value.configuration_revision) || typeof value.configured!=='boolean'
    || value.data_mode!=='synthetic' || value.payment_route!=='unconfigured' || value.purchase_available!==false || value.live_activation!==false
    || (!value.configured && value.terms!==null) || (value.configured && value.terms===null))invalid()
  return { subscriberUserId: identity.userId,practiceId: identity.practiceId,configurationRevision: value.configuration_revision,
    configured: value.configured,terms: value.configured ? doctorSaasTermsVersion(value.terms) : null,
    dataMode: 'synthetic',paymentRoute: 'unconfigured',purchaseAvailable: false,liveActivation: false }
}
