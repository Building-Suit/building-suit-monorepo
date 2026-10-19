import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../types/database.types'
import type { DoctorIdentity } from './authController'
const object = (value: unknown): value is Record<string,unknown> => Boolean(value && typeof value==='object' && !Array.isArray(value))
const count = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value)>=0
export function doctorOperationsStatus(value: unknown,identity: DoctorIdentity) {
  function invalid(): never { throw new Error('DOCTOR_OPERATIONS_CONTRACT_INVALID') }
  if(!object(value) || value.subscriber_user_id!==identity.userId || value.scope!=='own_saas_operations' || value.data_mode!=='synthetic'
    || value.state!=='diagnostics_only' || typeof value.observed_at!=='string' || !Number.isFinite(Date.parse(value.observed_at))
    || !object(value.reconciliation) || !count(value.reconciliation.held_intents) || !count(value.reconciliation.unknown_review) || !count(value.reconciliation.discrepancy_review)
    || value.reconciliation.unknown_review+value.reconciliation.discrepancy_review>value.reconciliation.held_intents
    || !object(value.privacy_intake) || !count(value.privacy_intake.awaiting_review) || value.privacy_intake.fulfillment_available!==false
    || value.payment_configuration!=='unconfigured' || value.administration_configuration!=='unconfigured'
    || value.independent_financial_review!=='pending' || value.independent_security_review!=='pending'
    || !object(value.security_findings) || value.security_findings.assessment!=='not_performed' || value.security_findings.critical!==null || value.security_findings.high!==null
    || !object(value.recovery) || value.recovery.qualification!=='pending' || value.recovery.rpo!==null || value.recovery.rto!==null || value.recovery.whole_provider_qualified!==false
    || !object(value.capacity) || value.capacity.approved_thresholds!==null || value.capacity.accepted_measurement!==null || value.capacity.provider_quota_cost_review!=='pending'
    || value.incident_ownership!=='unconfigured' || value.support_destination!==null || value.hosted_telemetry_available!==false
    || !Array.isArray(value.launch_decisions) || value.launch_decisions.join(',')!=='AE-D02,AE-D03,AE-D04,AE-D05,AE-D06,AE-D07,AE-D08,AE-D09,AE-D10'
    || value.patient_payloads_included!==false || value.paid_activation_available!==false || value.live_activation!==false)invalid()
  return { observedAt: value.observed_at,heldIntents: value.reconciliation.held_intents,unknownReview: value.reconciliation.unknown_review,
    discrepancyReview: value.reconciliation.discrepancy_review,privacyRequestsAwaitingReview: value.privacy_intake.awaiting_review,
    state: 'diagnostics_only' as const,independentFinancialReview: 'pending' as const,independentSecurityReview: 'pending' as const,
    recoveryQualified: false as const,capacityAccepted: false as const,paidActivationAvailable: false as const,liveActivation: false as const }
}
export function doctorOperationsRepository(client: Pick<SupabaseClient<Database>,'rpc'>) {
  return {
    async status(identity: DoctorIdentity,signal: AbortSignal) {
      const { data,error } = await client.rpc('doctor_operations_status').abortSignal(signal)
      if(error)throw error
      return doctorOperationsStatus(data,identity)
    },
  }
}
