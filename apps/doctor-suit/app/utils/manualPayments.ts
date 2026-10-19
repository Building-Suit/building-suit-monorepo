import type{DoctorIdentity}from'./authController'
import{doctorUuid}from'./locationContext.ts'
import{doctorSaasTermsVersion,type DoctorSaasTermsVersion}from'./saasTerms.ts'
export type ManualPaymentStatus='submitted'|'under_review'|'rejected'|'funds_verified'|'activated'
export interface ManualEvidence{id:string;noticeId:string;filename:string;mime:string;size:number;sha256:string}
export interface ManualPaymentNotice{id:string;subscriberId:string;intentId:string;quoteId:string;termsId:string;interval:'monthly'|'yearly';amountMinor:string;currency:string;exponent:number;beneficiary:string;recipientAddress:string;recipientKind:'ipa'|'mobile';reference:string;transferredAt:string;createdAt:string;status:ManualPaymentStatus;revision:number;reason:string|null;periodId:string|null;requiresAttention:boolean;evidence:ManualEvidence[];history:{revision:number;action:string;actor:string;reason:string;at:string}[]}
export interface ManualPlan{key:string;nameEn:string;nameAr:string;monthlyMinor:string;yearlyMinor:string;clinicLimit:number;totalUsers:number;staffLimit:number;terms:DoctorSaasTermsVersion|null}
export interface ManualCatalog{revision:number;plans:ManualPlan[]}
export interface ManualConfiguration{revision:number;configured:boolean;mode:'disabled'|'synthetic'}
export interface ManualInstructions{requestId:string;intentId:string;quoteId:string;configurationRevision:number;amountMinor:string;currency:string;exponent:number;recipient:{id:string;kind:'ipa'|'mobile';address:string;beneficiary:string;english:string;arabic:string}}
export const manualRecord=(v:unknown):v is Record<string,unknown>=>Boolean(v&&typeof v==='object'&&!Array.isArray(v))
function fail():never{throw new Error('DOCTOR_MANUAL_PAYMENT_CONTRACT_INVALID')}
const integer=(v:unknown,min=0,max=2147483647):v is number=>Number.isSafeInteger(v)&&Number(v)>=min&&Number(v)<=max
const stamp=(v:unknown):v is string=>typeof v==='string'&&Number.isFinite(Date.parse(v))
const text=(v:unknown,max=200):v is string=>typeof v==='string'&&v.trim().length>0&&v.length<=max&&!/[<>]/.test(v)&&!Array.from(v).some(c=>c.charCodeAt(0)<32)
const minor=(v:unknown):v is string=>typeof v==='string'&&/^(0|[1-9][0-9]{0,15})$/.test(v)&&BigInt(v)<=9007199254740991n
export function manualAmount(v:string,exponent:number){if(!minor(v)||!integer(exponent,0,4))return fail();const factor=10n**BigInt(exponent),amount=BigInt(v);return`${amount/factor}${exponent?'.'+String(amount%factor).padStart(exponent,'0'):''}`}
export function manualMinor(input:string,exponent:number){if(!integer(exponent,0,4)||!/^\d{1,16}(?:\.\d{1,4})?$/.test(input))return fail();const[whole,fraction='']=input.split('.');if(fraction.length>exponent)return fail();const amount=BigInt(whole!)*10n**BigInt(exponent)+BigInt(fraction.padEnd(exponent,'0')||'0');if(amount<1n||amount>9007199254740991n)return fail();return String(amount)}
export function manualCatalog(v:unknown):ManualCatalog{
 if(!manualRecord(v)||v.version!==1||v.publication_state!=='approved_prices'||v.currency!=='EGP'||v.currency_exponent!==2||v.annual_calendar_months!==12||v.annual_monthly_payments!==10||v.self_service_setup_fee_minor!=='0'||v.live_acceptance_enabled!==false||!integer(v.configuration_revision,1)||!Array.isArray(v.plans)||v.plans.length!==3)fail()
 const plans=v.plans.map((p):ManualPlan=>{if(!manualRecord(p)||!['starter','clinic','group'].includes(String(p.key))||!text(p.name_en)||!text(p.name_ar)||!minor(p.monthly_minor)||!minor(p.yearly_minor)||BigInt(p.yearly_minor)!==BigInt(p.monthly_minor)*10n||!integer(p.clinic_limit,1)||!integer(p.total_named_users,2)||!integer(p.staff_limit_excluding_owner,1)||p.staff_limit_excluding_owner+1!==p.total_named_users||typeof p.configured!=='boolean')return fail()
  const terms=p.configured?doctorSaasTermsVersion(p.terms):null
  if(!p.configured&&p.terms!==null)return fail()
  if(terms&&(terms.planKey!==p.key||String(terms.monthlyMinor)!==p.monthly_minor||String(terms.yearlyMinor)!==p.yearly_minor||terms.currency!=='EGP'||terms.currencyExponent!==2||terms.staff.kind!=='limited'||terms.staff.limit!==p.staff_limit_excluding_owner||terms.clinics.kind!=='limited'||terms.clinics.limit!==p.clinic_limit))return fail()
  return{key:String(p.key),nameEn:p.name_en,nameAr:p.name_ar,monthlyMinor:p.monthly_minor,yearlyMinor:p.yearly_minor,clinicLimit:p.clinic_limit,totalUsers:p.total_named_users,staffLimit:p.staff_limit_excluding_owner,terms}})
 if(new Set(plans.map(p=>p.key)).size!==3)return fail();return{revision:v.configuration_revision,plans}
}
export function manualConfiguration(v:unknown,actor:DoctorIdentity):ManualConfiguration{
 if(!manualRecord(v)||v.subscriber_user_id!==actor.userId||v.selected_route!=='instapay_manual'||!integer(v.configuration_revision,1)||typeof v.configured!=='boolean'||v.acceptance_mode!==(v.configured?'synthetic':'disabled')||v.live_acceptance_enabled!==false||v.automatic_verification!==false||v.customer_submission_activates!==false)fail()
 return{revision:v.configuration_revision,configured:v.configured,mode:v.configured?'synthetic':'disabled'}
}
export function manualInstructions(v:unknown,actor:DoctorIdentity,intent:string):ManualInstructions{
 if(!manualRecord(v)||!doctorUuid(v.request_id)||v.subscriber_user_id!==actor.userId||v.intent_id!==intent||!doctorUuid(v.quote_id)||!integer(v.configuration_revision,1)||!minor(v.amount_minor)||!text(v.currency,3)||!/^[A-Z]{3}$/.test(v.currency)||!integer(v.currency_exponent,0,4)||v.acceptance_mode!=='synthetic'||v.live_acceptance_enabled!==false||!manualRecord(v.recipient))fail()
 const r=v.recipient;if(!doctorUuid(r.id)||!['ipa','mobile'].includes(String(r.kind))||!text(r.address)||r.address.includes('://')||!text(r.beneficiary_name)||!text(r.instructions_en,2000)||!text(r.instructions_ar,2000))fail()
 return{requestId:v.request_id,intentId:intent,quoteId:v.quote_id,configurationRevision:v.configuration_revision,amountMinor:v.amount_minor,currency:v.currency,exponent:v.currency_exponent,recipient:{id:r.id,kind:r.kind as 'ipa'|'mobile',address:r.address,beneficiary:r.beneficiary_name,english:r.instructions_en,arabic:r.instructions_ar}}
}
export function manualEvidence(v:unknown,noticeId:string):ManualEvidence{
 if(!manualRecord(v)||!doctorUuid(v.id)||(v.notice_id!==undefined&&v.notice_id!==noticeId)||!text(v.filename,160)||(v.filename.includes('/')||v.filename.includes('\\')||/[\u202a-\u202e\u2066-\u2069]/u.test(v.filename))||!['application/pdf','image/png','image/jpeg'].includes(String(v.mime_type))||!integer(v.byte_size,1,5242880)||typeof v.sha256!=='string'||!/^[a-f0-9]{64}$/.test(v.sha256))fail()
 return{id:v.id,noticeId,filename:v.filename,mime:String(v.mime_type),size:v.byte_size,sha256:v.sha256}
}
export function manualNotice(v:unknown,actor:DoctorIdentity,review=false):ManualPaymentNotice{
 if(!manualRecord(v)||!doctorUuid(v.id)||!doctorUuid(v.subscriber_user_id)||(!review&&v.subscriber_user_id!==actor.userId)||!doctorUuid(v.intent_id)||!doctorUuid(v.quote_id)||!doctorUuid(v.terms_id)||!['monthly','yearly'].includes(String(v.billing_interval))||!minor(v.amount_minor)||!text(v.currency,3)||!/^[A-Z]{3}$/.test(v.currency)||!integer(v.currency_exponent,0,4)||!text(v.beneficiary_name)||!text(v.recipient_address)||!['ipa','mobile'].includes(String(v.recipient_kind))||!text(v.transfer_reference)||!stamp(v.transferred_at)||!stamp(v.created_at)||!['submitted','under_review','rejected','funds_verified','activated'].includes(String(v.status))||!integer(v.revision)||!(v.review_reason===null||text(v.review_reason,500))||!(v.period_id===null||doctorUuid(v.period_id))||v.independent_verification_required!==true||v.automatic_verification!==false||v.live_acceptance_enabled!==false||typeof v.requires_attention!=='boolean'||!Array.isArray(v.evidence)||v.evidence.length>1||!Array.isArray(v.history)||v.history.length>4)fail()
 if((v.status==='activated')!==(v.period_id!==null)||(v.status==='submitted')!==(v.revision===0))fail()
 const history=v.history.map(e=>{if(!manualRecord(e)||!integer(e.revision,1)||!text(e.action)||!doctorUuid(e.actor)||!text(e.reason,500)||!stamp(e.at))return fail();return{revision:e.revision,action:e.action,actor:e.actor,reason:e.reason,at:e.at}})
 if(history.length!==v.revision||history.some((h,i)=>h.revision!==i+1)||history.at(-1)?.action!==v.status&&v.status!=='submitted')fail()
 return{id:v.id,subscriberId:v.subscriber_user_id,intentId:v.intent_id,quoteId:v.quote_id,termsId:v.terms_id,interval:v.billing_interval as 'monthly'|'yearly',amountMinor:v.amount_minor,currency:v.currency,exponent:v.currency_exponent,beneficiary:v.beneficiary_name,recipientAddress:v.recipient_address,recipientKind:v.recipient_kind as 'ipa'|'mobile',reference:v.transfer_reference,transferredAt:v.transferred_at,createdAt:v.created_at,status:v.status as ManualPaymentStatus,revision:v.revision,reason:v.review_reason,periodId:v.period_id,requiresAttention:v.requires_attention,evidence:v.evidence.map(e=>manualEvidence(e,v.id as string)),history}
}
export function manualQueue(v:unknown,actor:DoctorIdentity,review:boolean){
 if(!manualRecord(v)||v.actor_user_id!==actor.userId||v.review_queue!==review||!integer(v.total)||!integer(v.page,1,1000000)||!Array.isArray(v.items)||v.items.length>25||v.items.length>v.total||typeof v.activation_configured!=='boolean')fail()
 const items=v.items.map(n=>manualNotice(n,actor,review));if(new Set(items.map(n=>n.id)).size!==items.length)fail()
 return{items,total:v.total,page:v.page,activationConfigured:v.activation_configured}
}
