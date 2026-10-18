import{verifyManualPaymentBrowser}from'./manual-payments-browser.mjs'
// Actual bytes/Auth/Storage acceptance in services owned by the CI provider runner.
import{randomUUID,createHash}from'node:crypto'
import{createClient}from'@supabase/supabase-js'
export async function verifyDoctorManualPaymentProvider({root,api,origin,key,serviceKey,a,b,rpc,sql,expect,setStage}){
 const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}},service=createClient(api,serviceKey,options),anonymous=createClient(api,key,options),bucket='doctor-payment-evidence'
 const recipient=randomUUID(),account=randomUUID(),terms=randomUUID(),approval='SYNTHETIC_ACTUAL_PROVIDER_ONLY'
 const original=JSON.parse(sql("select row_to_json(c)from public.doctor_saas_configuration c where singleton;"))
 function literal(value){return "'"+String(value).replaceAll("'","''")+"'"}
 const bytes=new TextEncoder().encode('%PDF-1.7\nSynthetic transfer evidence only\n%%EOF\n')
 async function endpoint(actor,op,notice,extra={},content){return fetch(`${api}/functions/v1/doctor-payment-evidence?op=${op}`,{method:'POST',headers:{apikey:key,authorization:`Bearer ${actor.session.access_token}`,origin,'content-type':'application/pdf','x-doctor-payment-evidence':encodeURIComponent(JSON.stringify({noticeId:notice,key:randomUUID(),...extra}))},body:content??'{}',signal:AbortSignal.timeout(30000)})}
 try{
  setStage('actual manual-payment synthetic configuration')
  const found=await service.storage.getBucket(bucket);if(found.error)expect(!(await service.storage.createBucket(bucket,{public:false,fileSizeLimit:5242880,allowedMimeTypes:['application/pdf','image/png','image/jpeg']})).error,'Private payment bucket creation failed')
  sql(`insert into public.doctor_saas_terms_versions(id,plan_key,version,status,currency,currency_exponent,monthly_minor,yearly_minor,trial_days,staff_limit,staff_unlimited,clinic_limit,clinic_unlimited,over_limit_policy,renewal_policy,grace_days,expiry_policy,cancellation_policy,refund_policy,terms_document_ref,commercial_approval_ref,legal_approval_ref)values('${terms}','starter',1,'approved','EGP',2,29900,299000,0,4,false,1,false,'block_new_allocation','manual',0,'historical_read_only','period_end','manual_review','synthetic-provider-manual/v1','${approval}','${approval}');
   insert into public.doctor_saas_terms_documents(terms_version_id,document_ref,content_en,content_ar)values('${terms}','synthetic-provider-manual/v1','Synthetic fixture only, no commercial or legal approval.','اختبار اصطناعي فقط دون اعتماد تجاري أو قانوني.');
   update public.doctor_saas_configuration set terms_version_id='${terms}',revision=revision+1,change_reason='Owned actual-provider payment fixture';
   update public.doctor_manual_plan_bindings set terms_version_id='${terms}',enabled=true,price_approval_ref='${approval}',change_reason='Owned actual provider starter binding',revision=revision+1 where plan_key='starter';
   insert into public.doctor_manual_payment_recipients(id,account_key,address_kind,address,beneficiary_name,instructions_en,instructions_ar,currency,currency_exponent,merchant_approval_ref)values('${recipient}','${account}','ipa','synthetic-only@instapay','Synthetic recipient','Do not send real funds.','لا تحول أموالاً حقيقية.','EGP',2,'${approval}');
   update public.doctor_manual_payment_configuration set recipient_id='${recipient}',enabled=true,acceptance_mode='synthetic',activation_policy='inactive_account_on_review',activation_approval_ref='${approval}',revision=revision+1,change_reason='Owned synthetic payment fixture';
   insert into public.doctor_manual_payment_reviewers(user_id,enabled,revision,approval_ref,valid_until)values('${b.user.id}',true,1,'${approval}',clock_timestamp()+interval'1 hour');`)
  const configuration=await rpc(a.client,'doctor_manual_payment_configuration'),saas=await rpc(a.client,'doctor_saas_status'),global=JSON.parse(sql('select row_to_json(c)from public.doctor_saas_configuration c where singleton;'))
  const quote=await rpc(a.client,'doctor_create_saas_quote',{p_terms:terms,p_configuration_revision:global.revision,p_account_revision:saas.revision,p_interval:'monthly',p_document_ref:'synthetic-provider-manual/v1',p_key:randomUUID()})
  const intent=await rpc(a.client,'doctor_prepare_saas_payment',{p_quote:quote.quote_id,p_key:randomUUID()})
  await rpc(a.client,'doctor_prepare_manual_payment',{p_intent:intent.intent_id,p_configuration_revision:configuration.configuration_revision,p_key:randomUUID()})
  const notice=await rpc(a.client,'doctor_submit_manual_payment',{p_intent:intent.intent_id,p_reference:'SYNTHETIC-CUSTOMER-CLAIM',p_transferred_at:new Date(Date.now()-1000).toISOString(),p_configuration_revision:configuration.configuration_revision,p_key:randomUUID()})
  expect(notice.status==='submitted'&&(await rpc(a.client,'doctor_saas_status')).state==='unconfigured','Customer claim granted entitlement')
  setStage('actual manual receipt validated private bytes and exact retry')
  let ready=false
  for(let count=0;count<30;count++){const r=await endpoint(a,'upload',notice.id,{filename:'synthetic-receipt.pdf'},bytes).catch(()=>null);if(r?.status===200){ready=await r.json();break}await new Promise(resolve=>setTimeout(resolve,500))}
  expect(ready,'Actual receipt upload unavailable');const evidence=ready
  const locator=JSON.parse(sql(`select json_build_object('path',object_path)from public.doctor_manual_payment_evidence where id='${evidence.id}';`)).path
  expect(evidence.sha256===createHash('sha256').update(bytes).digest('hex')&&evidence.byte_size===bytes.length,'Receipt byte witness differs')
  const repeated=await endpoint(a,'upload',notice.id,{filename:'synthetic-receipt.pdf'},bytes);expect(repeated.status===200&&(await repeated.json()).id===evidence.id,'One receipt retry changed immutable identity')
  expect((await anonymous.storage.from(bucket).download(locator)).error,'Anonymous payment receipt readable')
  expect((await a.client.storage.from(bucket).download(locator)).error,'Direct authenticated receipt bypass')
  expect((await a.client.storage.from(bucket).createSignedUrl(locator,60)).error,'Client signed receipt bypass')
  expect(!(await fetch(`${api}/storage/v1/object/public/${bucket}/${locator}`)).ok,'Public receipt URL readable')
  expect((await endpoint(b,'download',notice.id,{evidenceId:evidence.id})).status===200,'Trusted reviewer cannot read receipt')
  const downloaded=await endpoint(a,'download',notice.id,{evidenceId:evidence.id});expect(downloaded.status===200&&Buffer.from(await downloaded.arrayBuffer()).equals(Buffer.from(bytes)),'Downloaded receipt bytes differ')
  expect((await rpc(a.client,'doctor_manual_payments',{p_notice:notice.id})).status==='submitted','Receipt upload verified funds')
  expect((await a.client.rpc('doctor_review_manual_payment',{p_notice:notice.id,p_revision:0,p_action:'funds_verified',p_reason:'forged customer approval',p_received_reference:'SYNTHETIC-FORGED',p_received_minor:'29900',p_currency:'EGP',p_received_at:new Date(Date.now()-1000).toISOString(),p_verification_ref:approval,p_independently_verified:true,p_key:randomUUID()})).error?.code==='42501','Customer self verification admitted')
  setStage('actual independent bank review and separate paid activation')
  const common={p_notice:notice.id,p_revision:0,p_action:'funds_verified',p_reason:'Synthetic independently checked bank entry',p_received_reference:'SYNTHETIC-BANK-'+randomUUID(),p_received_minor:'29900',p_currency:'EGP',p_received_at:new Date(Date.now()-1000).toISOString(),p_verification_ref:approval,p_independently_verified:true,p_key:randomUUID()}
  const verified=await rpc(b.client,'doctor_review_manual_payment',common);expect(verified.status==='funds_verified'&&(await rpc(a.client,'doctor_saas_status')).state==='unconfigured','Funds verification activated account')
  const activated=await rpc(b.client,'doctor_activate_manual_payment',{p_notice:notice.id,p_revision:1,p_key:randomUUID()});const paid=await rpc(a.client,'doctor_saas_status')
  expect(activated.status==='activated'&&paid.state==='paid'&&paid.period.kind==='manual_paid'&&paid.period_active===true,'Separate actual activation missing server period')
  expect(paid.live_activation===false&&paid.paid_activation_available===false,'Synthetic acceptance asserted live availability')
  await verifyManualPaymentBrowser({root,api,origin,key,a,b,expect,rpc,setStage})
  sql(`update public.doctor_manual_payment_reviewers set enabled=false,revision=revision+1,approval_ref='${approval}-REVOKED'where user_id='${b.user.id}';`)
  expect((await endpoint(b,'download',notice.id,{evidenceId:evidence.id})).status===403,'Revoked reviewer retained receipt access')
  expect((await endpoint(a,'download',notice.id,{evidenceId:evidence.id})).status===200,'Reviewer revocation changed independent subscriber access')
  console.log('Actual manual payments: private receipt bytes/hash, immutable retry, anonymous/direct/public/signed denials, trusted reviewer delivery, self-review denial, separate funds verification and synthetic paid activation, and post-revocation denial passed; live acceptance remains disabled.')
 }finally{
  sql(`update public.doctor_manual_payment_configuration set enabled=false,recipient_id=null,acceptance_mode='disabled',revision=revision+1,change_reason='Complete owned actual-provider fixture';update public.doctor_manual_payment_reviewers set enabled=false,revision=revision+1,approval_ref='${approval}-COMPLETE'where user_id='${b.user.id}';update public.doctor_manual_plan_bindings set enabled=false,revision=revision+1,change_reason='Complete owned provider payment fixture'where plan_key='starter';update public.doctor_saas_configuration set terms_version_id=${original.terms_version_id?literal(original.terms_version_id):'null'},revision=revision+1,change_reason='Complete owned actual-provider payment fixture';`)
 }
}
