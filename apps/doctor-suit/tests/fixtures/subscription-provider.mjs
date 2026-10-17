// Owned synthetic browser protocol; real periods/admission/locking are verified in SQL/provider suites.
import{randomUUID}from'node:crypto'
export function subscriptionProtocol({state,data,actor,ownPractice,rpc,input,send}){
 if(!['doctor_saas_terms','doctor_saas_status','doctor_start_saas_trial','doctor_saas_terms_document'].includes(rpc))return false
 const reject=code=>{send({code},400);return true},fixture=state.subscription??(state.subscription={}),current=fixture.configured===true,account=fixture.accounts?.[actor.id]
 if(!ownPractice&&data.memberships.some(item=>item.user_id===actor.id)&&!account?.trial)return reject('42501')
 const terms={terms_id:'ae190000-0000-0000-0000-000000000051',plan_key:'synthetic-browser-subscription',version:1,currency:'USD',currency_exponent:2,monthly_minor:1234,yearly_minor:null,trial_days:2,grace_days:0,staff:{kind:'limited',limit:2},clinics:{kind:'limited',limit:3},over_limit_policy:'block_new_allocation',renewal_policy:'manual',expiry_policy:'historical_read_only',cancellation_policy:'period_end',refund_policy:'manual_review',terms_document_ref:'synthetic-browser-subscription/v1'}
 if(rpc==='doctor_saas_terms_document'){send(fixture.documentAvailable===true&&input.p_terms===terms.terms_id?{terms_id:terms.terms_id,document_ref:terms.terms_document_ref,data_mode:'synthetic',content_en:'Synthetic test document only. This fixture does not grant legal approval or live-sale authority.',content_ar:'وثيقة اختبار اصطناعية فقط. لا تمنح هذه البيانات موافقة قانونية أو صلاحية بيع حي.'}:null);return true}
 const base={subscriber_user_id:actor.id,practice_id:ownPractice?.id??null,data_mode:'synthetic',live_activation:false}
 if(rpc==='doctor_saas_terms'){send({...base,configuration_revision:fixture.revision??1,configured:current,terms:current?terms:null,payment_route:'unconfigured',purchase_available:false});return true}
 if(rpc==='doctor_saas_status'){
  const trial=account?.trial,expired=trial&&Date.parse(trial.ends_at)<=Date.now(),kind=!trial?'unconfigured':account?.suspended?'suspended':expired?'expired':'trial'
  const clinics=data.locations.filter(row=>row.practice_id===ownPractice?.id&&!row.archived_at).length,staff=data.memberships.filter(row=>row.practice_id===ownPractice?.id&&row.status==='active').length,pending=data.invitations.filter(row=>row.practice_id===ownPractice?.id&&row.status==='pending'&&Date.parse(row.expires_at)>Date.now()).length
  send({...base,usage:{clinics,staff_members:staff,staff_invitations:pending,staff_total:staff+pending},state:kind,revision:trial?1:0,period_active:kind==='trial',business_writes_allowed:kind==='trial',observed_at:new Date().toISOString(),period:trial??null,terms:trial?account.boundTerms:null,paid_activation_available:false});return true
 }
 fixture.commands??={};const command=`${actor.id}:${input.p_key}`
 if(fixture.commands[command]){send(fixture.commands[command]);return true}
 if(!current)return reject('DS001')
 if(input.p_terms!==terms.terms_id||input.p_configuration_revision!==(fixture.revision??1)||input.p_document_ref!==terms.terms_document_ref)return reject('40001')
 if(account?.trial)return reject('DS004')
 const started=new Date(),ending=new Date(started.getTime()+2*86400000),period={id:randomUUID(),kind:'trial',terms_id:terms.terms_id,started_at:started.toISOString(),ends_at:ending.toISOString(),accepted_document_ref:terms.terms_document_ref}
 fixture.accounts??={};fixture.accounts[actor.id]={trial:period,boundTerms:structuredClone(terms)};fixture.trial=period;fixture.starts=(fixture.starts??0)+1
 if(ownPractice){state.entitlements??={};state.entitlements[ownPractice.id]={state:'trial',revision:1,writes_allowed:true,can_add_staff:true,can_add_clinic:true,over_limit:false,valid_until:period.ends_at}}
 const receipt={period_id:period.id,terms_id:period.terms_id,started_at:period.started_at,ends_at:period.ends_at,revision:1};fixture.commands[command]=receipt;send(receipt);return true
}
