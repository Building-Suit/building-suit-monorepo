import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../types/database.types'
import type { DoctorIdentity } from './authController'
import { doctorUuid } from './locationContext.ts'
export type DoctorSaasReconciliation = 'awaiting_evidence' | 'pending_synthetic' | 'unknown_review' | 'confirmed_synthetic' | 'failed_synthetic' | 'discrepancy_review'
export interface DoctorSaasFinancialStatus {
  total: number
  currencies: { currency: string; currencyExponent: number; heldIntents: number; quotedMinor: string; settledMinor: null }[]
  items: { intentId: string; quoteId: string; createdAt: string; state: 'awaiting_route_approval'; reconciliation: DoctorSaasReconciliation; syntheticEventIds: string[] }[]
  scope: 'saas_only'; paymentRoute: 'unconfigured'; settlementAvailable: false; lifecycleAvailable: false; invoicesAvailable: false
  paidActivationAvailable: false; liveActivation: false
}
const record = (v: unknown): v is Record<string,unknown> => Boolean(v && typeof v==='object' && !Array.isArray(v))
const integer = (v: unknown): v is number => Number.isSafeInteger(v) && Number(v)>=0
function invalid(): never { throw new Error('DOCTOR_SAAS_FINANCIAL_CONTRACT_INVALID') }
export function doctorSaasFinancialStatus(value: unknown,identity: DoctorIdentity): DoctorSaasFinancialStatus {
  if(!record(value) || value.subscriber_user_id!==identity.userId || value.scope!=='saas_only' || value.data_mode!=='synthetic'
    || value.payment_route!=='unconfigured' || value.invoices_available!==false || value.settlement_available!==false || value.lifecycle_available!==false
    || value.independent_financial_review!=='pending' || value.patient_revenue_included!==false || value.totals_scope!=='full_population'
    || value.paid_activation_available!==false || value.live_activation!==false || !integer(value.total)
    || !Array.isArray(value.currencies) || !Array.isArray(value.items) || value.items.length>value.total)invalid()
  const currencies = value.currencies.map(raw => {
    if(!record(raw) || typeof raw.currency!=='string' || !/^[A-Z]{3}$/.test(raw.currency) || !integer(raw.currency_exponent) || raw.currency_exponent>4
      || !integer(raw.held_intents) || raw.held_intents<1 || typeof raw.quoted_minor!=='string' || !/^(0|[1-9][0-9]{0,38})$/.test(raw.quoted_minor) || raw.settled_minor!==null)invalid()
    return { currency: raw.currency,currencyExponent: raw.currency_exponent,heldIntents: raw.held_intents,quotedMinor: raw.quoted_minor,settledMinor: null }
  })
  if(new Set(currencies.map(row => `${row.currency}:${row.currencyExponent}`)).size!==currencies.length
    || currencies.reduce((sum,row) => sum+row.heldIntents,0)!==value.total)invalid()
  const items = value.items.map(raw => {
    if(!record(raw) || !doctorUuid(raw.intent_id) || !doctorUuid(raw.quote_id) || raw.state!=='awaiting_route_approval'
      || typeof raw.created_at!=='string' || !Number.isFinite(Date.parse(raw.created_at))
      || typeof raw.reconciliation!=='string' || !['awaiting_evidence','pending_synthetic','unknown_review','confirmed_synthetic','failed_synthetic','discrepancy_review'].includes(raw.reconciliation)
      || !Array.isArray(raw.synthetic_event_ids) || !raw.synthetic_event_ids.every(doctorUuid) || new Set(raw.synthetic_event_ids).size!==raw.synthetic_event_ids.length)invalid()
    return { intentId: raw.intent_id,quoteId: raw.quote_id,createdAt: raw.created_at,state: 'awaiting_route_approval' as const,
      reconciliation: raw.reconciliation as DoctorSaasReconciliation,syntheticEventIds: raw.synthetic_event_ids as string[] }
  })
  if(new Set(items.map(row => row.intentId)).size!==items.length)invalid()
  return { total: value.total,currencies,items,scope: 'saas_only',paymentRoute: 'unconfigured',settlementAvailable: false,lifecycleAvailable: false,
    invoicesAvailable: false,paidActivationAvailable: false,liveActivation: false }
}
export function doctorSaasFinancialRepository(client: Pick<SupabaseClient<Database>,'rpc'>) {
  return {
    async status(identity: DoctorIdentity,page: number,size: number,signal: AbortSignal) {
      if(!integer(page) || page>2147483647 || !integer(size) || size<1 || size>100)invalid()
      const { data,error } = await client.rpc('doctor_saas_financial_status',{ p_page: page,p_size: size }).abortSignal(signal)
      if(error)throw error
      const result = doctorSaasFinancialStatus(data,identity);if(result.items.length>size)invalid();return result
    },
  }
}
