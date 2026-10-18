import{doctorOperationsRepository,type doctorOperationsStatus}from'./operationsReadiness.ts'
import{doctorAdministrationRepository,type doctorAdministrationReadiness}from'./administrationReadiness.ts'
import{doctorSaasTermsDocument}from'./saasTermsDocument.ts'
import type{DoctorSaasTermsVersion}from'./saasTerms'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../types/database.types'
import type { DoctorIdentity } from './authController'
import { doctorSaasTerms } from './saasTerms.ts'
import { doctorSaasStatus,doctorSaasTrialReceipt,type DoctorSaasTrialRequest } from './saasStatus.ts'
export interface DoctorSubscriptionReadiness { operations: ReturnType<typeof doctorOperationsStatus>; administration: ReturnType<typeof doctorAdministrationReadiness> }
export function doctorSaasRepository(client: Pick<SupabaseClient<Database>,'rpc'>) {
  return {
    async readiness(identity: DoctorIdentity,signal: AbortSignal): Promise<DoctorSubscriptionReadiness> {
      const [operations,administration] = await Promise.all([doctorOperationsRepository(client).status(identity,signal),doctorAdministrationRepository(client).readiness(identity,signal)])
      return { operations,administration }
    },
    async document(terms:DoctorSaasTermsVersion,signal:AbortSignal){const{data,error}=await client.rpc('doctor_saas_terms_document',{p_terms:terms.id}).abortSignal(signal);if(error)throw error;return doctorSaasTermsDocument(data,terms)},
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
