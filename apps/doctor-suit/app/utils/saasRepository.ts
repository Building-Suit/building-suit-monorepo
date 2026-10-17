import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../types/database.types'
import type { DoctorIdentity } from './authController'
import { doctorSaasTerms } from './saasTerms.ts'
import { doctorSaasStatus,doctorSaasTrialReceipt,type DoctorSaasTrialRequest } from './saasStatus.ts'
export function doctorSaasRepository(client: Pick<SupabaseClient<Database>,'rpc'>) {
  return {
    async terms(identity: DoctorIdentity,signal: AbortSignal) {
      const { data,error } = await client.rpc('doctor_saas_terms').abortSignal(signal)
      if(error)throw error
      return doctorSaasTerms(data,identity)
    },
    async status(identity: DoctorIdentity,signal: AbortSignal) {
      const { data,error } = await client.rpc('doctor_saas_status').abortSignal(signal)
      if(error)throw error
      return doctorSaasStatus(data,identity)
    },
    async startTrial(input: DoctorSaasTrialRequest,key: string,signal: AbortSignal) {
      const { data,error } = await client.rpc('doctor_start_saas_trial',{ p_terms: input.termsId,p_configuration_revision: input.configurationRevision,p_document_ref: input.documentRef,p_key: key }).abortSignal(signal)
      if(error)throw error
      return doctorSaasTrialReceipt(data,input.termsId)
    },
  }
}
