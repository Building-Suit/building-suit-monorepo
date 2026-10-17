import test from'node:test'
import assert from'node:assert/strict'
import{reactive}from'vue'
import{doctorSaasStatus}from'../../app/utils/saasStatus.ts'
import{doctorSaasTerms}from'../../app/utils/saasTerms.ts'
import{createDoctorSubscriptionController,doctorSubscriptionState}from'../../app/utils/saasController.ts'
import{doctorSubscriptionView}from'../../app/utils/subscriptionPresentation.ts'
const id=n=>`ae180000-0000-0000-0000-${String(n).padStart(12,'0')}`
const actor={userId:id(1),sessionId:id(11),practiceId:null},epoch=Date.parse('2026-10-17T00:00:00Z')
const terms=(n=51)=>({terms_id:id(n),plan_key:'synthetic-ui-trial',version:1,currency:'USD',currency_exponent:2,monthly_minor:1234,yearly_minor:null,trial_days:2,grace_days:0,staff:{kind:'limited',limit:1},clinics:{kind:'limited',limit:1},over_limit_policy:'block_new_allocation',renewal_policy:'manual',expiry_policy:'historical_read_only',cancellation_policy:'period_end',refund_policy:'manual_review',terms_document_ref:`synthetic-ui/v${n}`})
const offer=(configured=true,n=51)=>doctorSaasTerms({subscriber_user_id:actor.userId,practice_id:null,configuration_revision:n,configured,terms:configured?terms(n):null,data_mode:'synthetic',payment_route:'unconfigured',purchase_available:false,live_activation:false},actor)
const status=(kind='unconfigured')=>doctorSaasStatus({subscriber_user_id:actor.userId,practice_id:null,state:kind,revision:kind==='unconfigured'?0:1,period_active:kind==='trial',business_writes_allowed:kind==='trial',observed_at:new Date(epoch+(kind==='expired'?10000:0)).toISOString(),period:kind==='unconfigured'?null:{id:id(61),kind:'trial',terms_id:id(51),started_at:new Date(epoch-2*86400000+10000).toISOString(),ends_at:new Date(epoch+10000).toISOString(),accepted_document_ref:'synthetic-ui/v51'},terms:kind==='unconfigured'?null:terms(),data_mode:'synthetic',paid_activation_available:false,live_activation:false},actor)
const flush=async()=>{for(let n=0;n<12;n++)await new Promise(r=>setImmediate(r))}
function setup(repository,changed=async()=>{},timers){const state=reactive(doctorSubscriptionState());let current=actor;const value=createDoctorSubscriptionController(repository,state,()=>current,changed,timers,()=>id(71));return{state,value,identity:value=>{current=value}}}
test('unconfigured owner has no fabricated offer, price, trial or live purchase',async()=>{
 const{state,value}=setup({terms:async()=>offer(false),status:async()=>status()});await value.load();assert.equal(value.canStart(),false);assert.equal(state.offer.terms,null)
 for(const ar of[false,true]){const view=doctorSubscriptionView(state,ar);assert.equal(view.termsFields.length,0);assert.equal(view.canContinue,false);assert.ok(view.copy.paymentUnavailable)}
})
test('explicit acceptance is bound to server terms, duplicate submission is excluded and receipt alone grants nothing',async()=>{
 let release,active=false,changes=0;const calls=[]
 const{state,value}=setup({terms:async()=>offer(),status:async()=>status(active?'trial':'unconfigured'),startTrial:async(input,key)=>{calls.push({input,key});await new Promise(r=>{release=r});active=true}},async()=>{changes++})
 await value.load();assert.equal(await value.start(),false);assert.equal(calls.length,0);state.accepted=true;const pending=value.start();assert.equal(await value.start(),false);assert.equal(state.status.state,'unconfigured');release();assert.equal(await pending,true)
 assert.deepEqual(calls,[{input:{termsId:id(51),configurationRevision:51,documentRef:'synthetic-ui/v51'},key:id(71)}]);assert.equal(state.status.state,'trial');assert.equal(value.canStart(),false);assert.equal(changes,1)
})
test('uncertain committed trial retries retain the exact command key and acceptance material',async()=>{
 let active=false;const keys=[];const{state,value}=setup({terms:async()=>offer(),status:async()=>status(active?'trial':'unconfigured'),startTrial:async(input,key)=>{keys.push(key);active=true;if(keys.length===1)throw Error('Synthetic disconnected response')}})
 await value.load();state.accepted=true;assert.equal(await value.start(),false);assert.equal(state.error,'network');assert.equal(state.accepted,true);assert.equal(await value.start(),true);assert.deepEqual(keys,[id(71),id(71)]);assert.equal(state.status.period.id,id(61))
})
test('configuration conflicts remove acceptance and cannot silently bind a newer offer',async()=>{
 const{state,value}=setup({terms:async()=>offer(),status:async()=>status(),startTrial:async()=>{throw{code:'40001'}}})
 await value.load();state.accepted=true;assert.equal(await value.start(),false);assert.equal(state.accepted,false);assert.equal(state.error,'conflict');assert.equal(value.canStart(),false);await value.load();assert.equal(state.accepted,false)
})
test('identity replacement rejects late private subscription results',async()=>{
 let release;const{state,value,identity}=setup({terms:async()=>new Promise(r=>{release=r}),status:async()=>status()});const pending=value.load();await flush();value.clear();identity({...actor,userId:id(2)});release(offer());assert.equal(await pending,false);assert.equal(state.offer,null);assert.equal(state.status,null)
})
test('reactive subscription expiry removes state before refresh and an explicit clear cancels delayed work',async()=>{
 let now=0,next=0;const jobs=new Map(),timers={now:()=>now,set(callback,delay){const key=++next;jobs.set(key,{callback,due:now+delay});return key},clear:key=>jobs.delete(key)}
 let release,reads=0;const{state,value}=setup({terms:async()=>offer(),status:async()=>{reads++;return status('trial')}},()=>new Promise(r=>{release=r}),timers)
 await value.load();now=10000;for(const job of jobs.values())if(job.due<=now)job.callback();assert.equal(state.status,null);await flush();value.clear();release();await flush();assert.equal(state.status,null);assert.equal(reads,1)
})
test('a prior subscriber delegated elsewhere retains own period history without owner offers',async()=>{
 const{state,value}=setup({terms:async()=>{throw{code:'42501'}},status:async()=>status('expired')});assert.equal(await value.load(),true);assert.equal(state.offer,null);assert.equal(value.canStart(),false);assert.equal(doctorSubscriptionView(state,false).canContinue,false);assert.equal(state.status.period.id,id(61))
})
test('missing current authority observations cannot enable the new owner UI',async()=>{
 const incomplete=status();delete incomplete.observedAt;const{state,value}=setup({terms:async()=>offer(),status:async()=>incomplete});assert.equal(await value.load(),false);assert.equal(state.error,'configuration');assert.equal(value.canStart(),false)
})
test('cached acceptance cannot be submitted by a replaced identity before lifecycle cleanup',async()=>{
 let writes=0;const{state,value,identity}=setup({terms:async()=>offer(),status:async()=>status(),startTrial:async()=>{writes++}})
 await value.load();state.accepted=true;identity({...actor,userId:id(2)});assert.equal(value.canStart(),false);assert.equal(await value.start(),false);assert.equal(writes,0)
})
