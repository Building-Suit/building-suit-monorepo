import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../types/database.types'
import type { DoctorIdentity } from './authController'
/** Target configuration is not supplied by a browser, shared session or another Suit. */
export function doctorAdministrationReadiness(value: unknown,identity: DoctorIdentity) {
  if(!value || typeof value!=='object' || Array.isArray(value))throw new Error('DOCTOR_ADMIN_READINESS_INVALID')
  const result = value as Record<string,unknown>
  if(result.subscriber_user_id!==identity.userId || result.suit!=='doctor-suit' || result.state!=='unavailable'
    || result.target_binding!=='unconfigured' || result.signing!=='unconfigured' || result.live_policy!=='pending' || result.operator_approval!=='pending'
    || !Array.isArray(result.capabilities) || result.capabilities.length!==0 || result.operator_grant_available!==false
    || result.payment_confirmed!==false || result.live_activation!==false)throw new Error('DOCTOR_ADMIN_READINESS_INVALID')
  return { state: 'unavailable' as const,targetBinding: 'unconfigured' as const,signing: 'unconfigured' as const,
    operatorGrantAvailable: false as const,paymentConfirmed: false as const,liveActivation: false as const }
}
export function doctorAdministrationRepository(client: Pick<SupabaseClient<Database>,'rpc'>) {
  return {
    async readiness(identity: DoctorIdentity,signal: AbortSignal) {
      const { data,error } = await client.rpc('doctor_administration_readiness').abortSignal(signal)
      if(error)throw error
      return doctorAdministrationReadiness(data,identity)
    },
  }
}
