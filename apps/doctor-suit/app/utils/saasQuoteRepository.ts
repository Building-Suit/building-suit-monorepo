import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../types/database.types'
import type { DoctorIdentity } from './authController'
import { doctorUuid } from './locationContext.ts'
export interface DoctorSaasQuoteRequest {
  termsId: string; configurationRevision: number; accountRevision: number
  interval: 'monthly' | 'yearly'; documentRef: string
}
export interface DoctorSaasQuote {
  id: string; subscriberUserId: string; practiceId: string | null; termsId: string
  configurationRevision: number; accountRevision: number; accountState: string; currentPeriodId: string | null
  interval: 'monthly' | 'yearly'; currency: string; currencyExponent: number; amountMinor: string; documentRef: string
  createdAt: string; paymentRoute: 'unconfigured'; purchaseAvailable: false; liveActivation: false
}
const object = (v: unknown): v is Record<string,unknown> => Boolean(v && typeof v==='object' && !Array.isArray(v))
const revision = (v: unknown): v is number => Number.isInteger(v) && Number(v)>=0 && Number(v)<=2147483647
const date = (v: unknown): v is string => typeof v==='string' && Number.isFinite(Date.parse(v))
function invalid(): never { throw new Error('DOCTOR_SAAS_QUOTE_CONTRACT_INVALID') }
function closedRoute(v: unknown) {
  if(!object(v) || v.state!=='unconfigured' || v.merchant_eligibility!=='pending' || v.route_approval!=='pending'
    || v.credentials_custody!=='pending' || v.tax_document_applicability!=='pending' || v.provider_acceptance!=='unrun'
    || v.checkout_url!==null || v.purchase_available!==false || v.paid_activation_available!==false || v.live_activation!==false)invalid()
}
/** Historical synthetic offer, never an invoice, tax total or purchasable checkout. */
export function doctorSaasQuote(value: unknown,identity: DoctorIdentity): DoctorSaasQuote {
  if(!object(value) || !doctorUuid(value.quote_id) || value.subscriber_user_id!==identity.userId || value.practice_id!==identity.practiceId
    || !doctorUuid(value.terms_id) || !revision(value.configuration_revision) || value.configuration_revision<1 || !revision(value.account_revision)
    || typeof value.account_state!=='string' || !['unconfigured','trial','scheduled','expired','suspended'].includes(value.account_state)
    || (value.current_period_id!==null && !doctorUuid(value.current_period_id))
    || (value.account_revision===0 ? value.current_period_id!==null || value.account_state!=='unconfigured' : value.current_period_id===null || value.account_state==='unconfigured')
    || (value.billing_interval!=='monthly' && value.billing_interval!=='yearly') || typeof value.currency!=='string' || !/^[A-Z]{3}$/.test(value.currency)
    || !revision(value.currency_exponent) || value.currency_exponent>4 || typeof value.amount_minor!=='string'
    || !/^(0|[1-9][0-9]{0,15})$/.test(value.amount_minor) || BigInt(value.amount_minor)>9007199254740991n
    || typeof value.document_ref!=='string' || !/^[a-z0-9][a-z0-9._/-]{0,199}$/.test(value.document_ref)
    || !date(value.created_at) || value.kind!=='configured_saas_offer' || value.data_mode!=='synthetic')invalid()
  closedRoute(value.payment_route)
  return { id: value.quote_id,subscriberUserId: identity.userId,practiceId: identity.practiceId,termsId: value.terms_id,
    configurationRevision: value.configuration_revision,accountRevision: value.account_revision,accountState: value.account_state as string,
    currentPeriodId: value.current_period_id as string | null,interval: value.billing_interval,currency: value.currency,
    currencyExponent: value.currency_exponent,amountMinor: value.amount_minor,documentRef: value.document_ref,createdAt: value.created_at,
    paymentRoute: 'unconfigured',purchaseAvailable: false,liveActivation: false }
}
function request(input: DoctorSaasQuoteRequest,key: string) {
  if(!object(input) || Object.keys(input).sort().join(',')!=='accountRevision,configurationRevision,documentRef,interval,termsId'
    || !doctorUuid(input.termsId) || !doctorUuid(key) || !revision(input.configurationRevision) || input.configurationRevision<1
    || !revision(input.accountRevision) || !['monthly','yearly'].includes(input.interval)
    || typeof input.documentRef!=='string' || !/^[a-z0-9][a-z0-9._/-]{0,199}$/.test(input.documentRef))invalid()
  return { p_terms: input.termsId,p_configuration_revision: input.configurationRevision,p_account_revision: input.accountRevision,
    p_interval: input.interval,p_document_ref: input.documentRef,p_key: key }
}
export function doctorSaasQuoteRepository(client: Pick<SupabaseClient<Database>,'rpc'>) {
  return {
    async create(identity: DoctorIdentity,input: DoctorSaasQuoteRequest,key: string,signal: AbortSignal) {
      const { data,error } = await client.rpc('doctor_create_saas_quote',request(input,key)).abortSignal(signal)
      if(error)throw error
      const quote = doctorSaasQuote(data,identity)
      if(quote.termsId!==input.termsId || quote.configurationRevision!==input.configurationRevision || quote.accountRevision!==input.accountRevision
        || quote.interval!==input.interval || quote.documentRef!==input.documentRef)invalid()
      return quote
    },
    async read(identity: DoctorIdentity,id: string,signal: AbortSignal) {
      if(!doctorUuid(id))invalid()
      const { data,error } = await client.rpc('doctor_saas_quote',{ p_quote: id }).abortSignal(signal)
      if(error)throw error
      const quote = doctorSaasQuote(data,identity);if(quote.id!==id)invalid();return quote
    },
    async prepare(identity: DoctorIdentity,id: string,key: string,signal: AbortSignal) {
      if(!doctorUuid(id) || !doctorUuid(key))invalid()
      const { data,error } = await client.rpc('doctor_prepare_saas_payment',{ p_quote: id,p_key: key }).abortSignal(signal)
      if(error)throw error
      if(!object(data) || !doctorUuid(data.intent_id) || data.state!=='awaiting_route_approval' || !date(data.created_at))invalid()
      closedRoute(data.payment_route)
      const quote = doctorSaasQuote(data.quote,identity);if(quote.id!==id)invalid()
      return { id: data.intent_id,quote,state: 'awaiting_route_approval' as const,createdAt: data.created_at,paymentRoute: 'unconfigured' as const,purchaseAvailable: false as const,liveActivation: false as const }
    },
  }
}
