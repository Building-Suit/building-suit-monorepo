import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../types/database.types'
import type { DoctorIdentity } from './authController'
import { manualCatalog,manualConfiguration,manualInstructions,manualNotice,manualQueue,manualEvidence,manualRecord,type ManualInstructions,type ManualPaymentNotice } from './manualPayments.ts'
import { doctorSaasQuoteRepository } from './saasQuoteRepository.ts'
import { doctorSaasRepository } from './saasRepository.ts'
export interface ManualReviewInput{action:'under_review'|'rejected'|'funds_verified';reason:string;reference:string|null;amount:string|null;currency:string|null;at:string|null;verification:string|null;independent:boolean}
export function doctorManualPaymentRepository(client:SupabaseClient<Database>,url:string,key:string,request:typeof fetch=fetch){
 const quotes=doctorSaasQuoteRepository(client),subscription=doctorSaasRepository(client)
 async function fileRequest(notice:string,operation:'upload'|'download',commandKey:string,signal:AbortSignal,file?:File,evidence?:string){
  const{data,error}=await client.auth.getSession();if(error||!data.session)throw{code:'42501'}
  const response=await request(`${url}/functions/v1/doctor-payment-evidence?op=${operation}`,{method:'POST',redirect:'error',credentials:'omit',cache:'no-store',signal,headers:{apikey:key,Authorization:`Bearer ${data.session.access_token}`,'Content-Type':file?.type||'application/json','x-doctor-payment-evidence':encodeURIComponent(JSON.stringify({noticeId:notice,key:commandKey,...(file?{filename:file.name}:{evidenceId:evidence})}))},body:file??'{}'})
  if(!response.ok)throw{code:response.status===403||response.status===401?'42501':response.status===400?'22023':response.status===409?'40001':'unavailable'}
  return response
 }
 return{
  document:subscription.document,status:subscription.status,
  async capability(actor:DoctorIdentity,signal:AbortSignal){const{data,error}=await client.rpc('doctor_manual_review_capability').abortSignal(signal);if(error)throw error;if(!manualRecord(data)||data.actor_user_id!==actor.userId||typeof data.can_review!=='boolean')throw Error('DOCTOR_MANUAL_PAYMENT_CONTRACT_INVALID');return data.can_review},
  async catalog(signal:AbortSignal){const{data,error}=await client.rpc('doctor_saas_plan_catalog').abortSignal(signal);if(error)throw error;return manualCatalog(data)},
  async configuration(actor:DoctorIdentity,signal:AbortSignal){const{data,error}=await client.rpc('doctor_manual_payment_configuration').abortSignal(signal);if(error)throw error;return manualConfiguration(data,actor)},
  async queue(actor:DoctorIdentity,review:boolean,page:number,signal:AbortSignal){const{data,error}=await client.rpc('doctor_manual_payments',{p_review_queue:review,p_page:page}).abortSignal(signal);if(error)throw error;return manualQueue(data,actor,review)},
  async read(actor:DoctorIdentity,review:boolean,id:string,signal:AbortSignal){const{data,error}=await client.rpc('doctor_manual_payments',{p_notice:id,p_review_queue:review}).abortSignal(signal);if(error)throw error;const row=manualNotice(data,actor,review);if(row.id!==id)throw Error('DOCTOR_MANUAL_PAYMENT_CONTRACT_INVALID');return row},
  quote:quotes.create,intent:quotes.prepare,
  async instructions(actor:DoctorIdentity,intent:string,revision:number,commandKey:string,signal:AbortSignal){const{data,error}=await client.rpc('doctor_prepare_manual_payment',{p_intent:intent,p_configuration_revision:revision,p_key:commandKey}).abortSignal(signal);if(error)throw error;return manualInstructions(data,actor,intent)},
  async submit(actor:DoctorIdentity,instructions:ManualInstructions,reference:string,at:string,commandKey:string,signal:AbortSignal){const{data,error}=await client.rpc('doctor_submit_manual_payment',{p_intent:instructions.intentId,p_reference:reference,p_transferred_at:at,p_configuration_revision:instructions.configurationRevision,p_key:commandKey}).abortSignal(signal);if(error)throw error;const row=manualNotice(data,actor);if(row.intentId!==instructions.intentId||row.quoteId!==instructions.quoteId||row.amountMinor!==instructions.amountMinor||row.currency!==instructions.currency)throw Error('DOCTOR_MANUAL_PAYMENT_CONTRACT_INVALID');return row},
  async review(actor:DoctorIdentity,notice:ManualPaymentNotice,input:ManualReviewInput,commandKey:string,signal:AbortSignal){// PostgreSQL text/timestamptz input arguments accept NULL; generated Meta types omit argument nullability.
   const args={p_notice:notice.id,p_revision:notice.revision,p_action:input.action,p_reason:input.reason,p_received_reference:input.reference,p_received_minor:input.amount,p_currency:input.currency,p_received_at:input.at,p_verification_ref:input.verification,p_independently_verified:input.independent,p_key:commandKey}
   const{data,error}=await client.rpc('doctor_review_manual_payment',args as unknown as Database['public']['Functions']['doctor_review_manual_payment']['Args']).abortSignal(signal);if(error)throw error;const row=manualNotice(data,actor,true);if(row.id!==notice.id||row.revision!==notice.revision+1||row.status!==input.action)throw Error('DOCTOR_MANUAL_PAYMENT_CONTRACT_INVALID');return row},
  async activate(actor:DoctorIdentity,notice:ManualPaymentNotice,commandKey:string,signal:AbortSignal){const{data,error}=await client.rpc('doctor_activate_manual_payment',{p_notice:notice.id,p_revision:notice.revision,p_key:commandKey}).abortSignal(signal);if(error)throw error;const row=manualNotice(data,actor,true);if(row.id!==notice.id||row.status!=='activated'||row.revision!==notice.revision+1)throw Error('DOCTOR_MANUAL_PAYMENT_CONTRACT_INVALID');return row},
  async upload(notice:string,file:File,commandKey:string,signal:AbortSignal){if(file.size<1||file.size>5242880||!['application/pdf','image/png','image/jpeg'].includes(file.type))throw{code:'22023'};return manualEvidence(await(await fileRequest(notice,'upload',commandKey,signal,file)).json(),notice)},
  async download(notice:string,evidence:string,commandKey:string,signal:AbortSignal){const response=await fileRequest(notice,'download',commandKey,signal,undefined,evidence);return response.blob()},
 }
}
export type ManualPaymentRepository=ReturnType<typeof doctorManualPaymentRepository>
