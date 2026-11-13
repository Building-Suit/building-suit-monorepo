import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../types/database.types'
import type { DoctorIdentity } from './authController'
import { manualCatalog,manualConfiguration,manualInstructions,manualNotice,manualQueue,manualEvidence,manualRecord,type ManualInstructions,type ManualPaymentNotice } from './manualPayments.ts'
import { doctorSaasQuoteRepository, type DoctorSaasQuote } from './saasQuoteRepository.ts'
import { doctorSaasRepository } from './saasRepository.ts'
export interface ManualReviewInput{action:'under_review'|'rejected'|'funds_verified';reason:string;reference:string|null;amount:string|null;currency:string|null;at:string|null;verification:string|null;independent:boolean}
function quoteBinding(quote: DoctorSaasQuote) {
 return JSON.stringify([quote.id,quote.subscriberUserId,quote.practiceId,quote.termsId,quote.configurationRevision,quote.accountRevision,quote.accountState,quote.currentPeriodId,quote.interval,quote.currency,quote.currencyExponent,quote.amountMinor,quote.documentRef,quote.createdAt,quote.paymentRoute,quote.purchaseAvailable,quote.liveActivation])
}
function requireQuote(quote: DoctorSaasQuote,actor: DoctorIdentity,id: string) {
 if(!manualRecord(quote)||quote.id!==id||quote.subscriberUserId!==actor.userId||quote.practiceId!==actor.practiceId||quote.paymentRoute!=='unconfigured'||quote.purchaseAvailable!==false||quote.liveActivation!==false)throw Error('DOCTOR_MANUAL_PAYMENT_CONTRACT_INVALID')
}
function noticeBinding(notice: ManualPaymentNotice) {
 return JSON.stringify([notice.id,notice.subscriberId,notice.intentId,notice.quoteId,notice.termsId,notice.interval,notice.amountMinor,notice.currency,notice.exponent,notice.beneficiary,notice.recipientAddress,notice.recipientKind,notice.reference,Date.parse(notice.transferredAt),Date.parse(notice.createdAt)])
}
const historyBinding=(item:ManualPaymentNotice['history'][number])=>JSON.stringify([item.revision,item.action,item.actor,item.reason,Date.parse(item.at)])
const evidenceBinding=(item:ManualPaymentNotice['evidence'][number])=>JSON.stringify([item.id,item.noticeId,item.filename,item.mime,item.size,item.sha256])
function noticeSnapshot(notice:ManualPaymentNotice){return Object.freeze({id:notice.id,revision:notice.revision,binding:noticeBinding(notice),history:Object.freeze(notice.history.map(historyBinding)),evidence:Object.freeze(notice.evidence.map(evidenceBinding))})}
function unchangedNotice(row:ManualPaymentNotice,expected:ReturnType<typeof noticeSnapshot>,actorId:string){
 return noticeBinding(row)===expected.binding&&row.history.at(-1)?.actor===actorId&&row.history.length>=expected.history.length&&expected.history.every((item,index)=>historyBinding(row.history[index]!)===item)&&expected.evidence.every(item=>row.evidence.some(value=>evidenceBinding(value)===item))
}
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
  quote:quotes.create,
  async intent(actor:DoctorIdentity,id:string,commandKey:string,signal:AbortSignal,quote:DoctorSaasQuote){requireQuote(quote,actor,id);const expected=Object.freeze({...quote});const intent=await quotes.prepare(actor,id,commandKey,signal);if(quoteBinding(intent.quote)!==quoteBinding(expected))throw Error('DOCTOR_MANUAL_PAYMENT_CONTRACT_INVALID');return intent},
  async instructions(actor:DoctorIdentity,intent:string,revision:number,commandKey:string,signal:AbortSignal,quote:DoctorSaasQuote){requireQuote(quote,actor,quote?.id);const expected=Object.freeze({...quote});const{data,error}=await client.rpc('doctor_prepare_manual_payment',{p_intent:intent,p_configuration_revision:revision,p_key:commandKey}).abortSignal(signal);if(error)throw error;const result=manualInstructions(data,actor,intent);if(result.configurationRevision!==revision||result.quoteId!==expected.id||result.amountMinor!==expected.amountMinor||result.currency!==expected.currency||result.exponent!==expected.currencyExponent)throw Error('DOCTOR_MANUAL_PAYMENT_CONTRACT_INVALID');return result},
  async submit(actor:DoctorIdentity,instructions:ManualInstructions,reference:string,at:string,commandKey:string,signal:AbortSignal){const expected=Object.freeze({...instructions,recipient:Object.freeze({...instructions.recipient})}),identity=Object.freeze({...actor}),expectedReference=reference.trim(),expectedAt=Date.parse(at);const{data,error}=await client.rpc('doctor_submit_manual_payment',{p_intent:expected.intentId,p_reference:reference,p_transferred_at:at,p_configuration_revision:expected.configurationRevision,p_key:commandKey}).abortSignal(signal);if(error)throw error;const row=manualNotice(data,identity);if(row.status!=='submitted'||row.revision!==0||row.periodId!==null||row.intentId!==expected.intentId||row.quoteId!==expected.quoteId||row.amountMinor!==expected.amountMinor||row.currency!==expected.currency||row.exponent!==expected.exponent||row.beneficiary!==expected.recipient.beneficiary||row.recipientAddress!==expected.recipient.address||row.recipientKind!==expected.recipient.kind||row.reference!==expectedReference||Date.parse(row.transferredAt)!==expectedAt)throw Error('DOCTOR_MANUAL_PAYMENT_CONTRACT_INVALID');return row},
  async review(actor:DoctorIdentity,notice:ManualPaymentNotice,input:ManualReviewInput,commandKey:string,signal:AbortSignal){// PostgreSQL text/timestamptz input arguments accept NULL; generated Meta types omit argument nullability.
   const expected=noticeSnapshot(notice),identity=Object.freeze({...actor}),action=input.action,reason=input.reason.trim()
   const args={p_notice:expected.id,p_revision:expected.revision,p_action:action,p_reason:input.reason,p_received_reference:input.reference,p_received_minor:input.amount,p_currency:input.currency,p_received_at:input.at,p_verification_ref:input.verification,p_independently_verified:input.independent,p_key:commandKey}
   const{data,error}=await client.rpc('doctor_review_manual_payment',args as unknown as Database['public']['Functions']['doctor_review_manual_payment']['Args']).abortSignal(signal);if(error)throw error;const row=manualNotice(data,identity,true);if(row.id!==expected.id||row.revision!==expected.revision+1||row.status!==action||row.reason!==reason||row.history.at(-1)?.reason!==reason||!unchangedNotice(row,expected,identity.userId))throw Error('DOCTOR_MANUAL_PAYMENT_CONTRACT_INVALID');return row},
  async activate(actor:DoctorIdentity,notice:ManualPaymentNotice,commandKey:string,signal:AbortSignal){const expected=noticeSnapshot(notice),identity=Object.freeze({...actor});const{data,error}=await client.rpc('doctor_activate_manual_payment',{p_notice:expected.id,p_revision:expected.revision,p_key:commandKey}).abortSignal(signal);if(error)throw error;const row=manualNotice(data,identity,true);if(row.id!==expected.id||row.status!=='activated'||row.revision!==expected.revision+1||!unchangedNotice(row,expected,identity.userId))throw Error('DOCTOR_MANUAL_PAYMENT_CONTRACT_INVALID');return row},
  async upload(notice:string,file:File,commandKey:string,signal:AbortSignal){if(file.size<1||file.size>5242880||!['application/pdf','image/png','image/jpeg'].includes(file.type))throw{code:'22023'};return manualEvidence(await(await fileRequest(notice,'upload',commandKey,signal,file)).json(),notice)},
  async download(notice:string,evidence:string,commandKey:string,signal:AbortSignal){const response=await fileRequest(notice,'download',commandKey,signal,undefined,evidence);return response.blob()},
 }
}
export type ManualPaymentRepository=ReturnType<typeof doctorManualPaymentRepository>
