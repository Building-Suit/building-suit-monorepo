import test from'node:test'
import assert from'node:assert/strict'
import{manualCatalog,manualNotice,manualQueue}from'../../app/utils/manualPayments.ts'
const id=n=>`aa410000-0000-0000-0000-${String(n).padStart(12,'0')}`,actor={userId:id(1),sessionId:id(2),practiceId:null}
const notice=()=>({id:id(3),subscriber_user_id:actor.userId,intent_id:id(4),quote_id:id(5),terms_id:id(6),billing_interval:'monthly',amount_minor:'29900',currency:'EGP',currency_exponent:2,beneficiary_name:'Synthetic recipient',recipient_address:'synthetic@instapay',recipient_kind:'ipa',transfer_reference:'SYNTHETIC-CLAIM',transferred_at:'2026-10-18T08:00:00Z',created_at:'2026-10-18T08:00:01Z',status:'submitted',revision:0,review_reason:null,period_id:null,requires_attention:false,independent_verification_required:true,automatic_verification:false,live_acceptance_enabled:false,evidence:[],history:[]})
test('notice/queue decoding fences subscriber, queue capability, immutable history and authority claims',()=>{
 assert.equal(manualNotice(notice(),actor).status,'submitted');assert.throws(()=>manualNotice({...notice(),subscriber_user_id:id(9)},actor))
 for(const patch of[{automatic_verification:true},{live_acceptance_enabled:true},{amount_minor:29900},{status:'activated'},{period_id:id(9)},{history:[{revision:1,action:'funds_verified'}]}])assert.throws(()=>manualNotice({...notice(),...patch},actor))
 const queue={actor_user_id:actor.userId,review_queue:false,total:1,page:1,activation_configured:false,items:[notice()]};assert.equal(manualQueue(queue,actor,false).items.length,1)
 assert.throws(()=>manualQueue({...queue,review_queue:true},actor,false));assert.throws(()=>manualQueue({...queue,actor_user_id:id(9)},actor,false));assert.throws(()=>manualQueue({...queue,items:[notice(),notice()],total:2},actor,false))
})
test('configured offer text cannot silently change owner-inclusive capacity or annual economics',()=>{
 const plans=[['starter','29900','299000',1,5],['clinic','59900','599000',3,10],['group','99900','999000',5,25]].map(([key,monthly,yearly,clinics,total])=>({key,name_en:key,name_ar:'خطة',monthly_minor:monthly,yearly_minor:yearly,clinic_limit:clinics,total_named_users:total,staff_limit_excluding_owner:total-1,configured:false,terms:null}))
 const catalog={version:1,publication_state:'approved_prices',currency:'EGP',currency_exponent:2,annual_calendar_months:12,annual_monthly_payments:10,self_service_setup_fee_minor:'0',live_acceptance_enabled:false,configuration_revision:1,plans}
 assert.equal(manualCatalog(catalog).plans[0].totalUsers,5)
 assert.throws(()=>manualCatalog({...catalog,plans:plans.map((p,i)=>i? p:{...p,staff_limit_excluding_owner:5})}))
 assert.throws(()=>manualCatalog({...catalog,plans:plans.map((p,i)=>i? p:{...p,yearly_minor:'29900'})}))
 assert.throws(()=>manualCatalog({...catalog,live_acceptance_enabled:true}))
})
