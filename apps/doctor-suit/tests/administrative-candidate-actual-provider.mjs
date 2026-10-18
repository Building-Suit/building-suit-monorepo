import {verifyDoctorSaasFinancialProvider}from'./saas-reconciliation-actual-provider.mjs'
import {verifyDoctorSaasQuoteProvider}from'./saas-quotes-actual-provider.mjs'
// Actual owned administrative-candidate acceptance; every fixture value is synthetic.
import {randomUUID,randomBytes,createHash}from'node:crypto'
export async function verifyDoctorAdministrativeCandidateProvider({publicKey,bootstrap,confirmedActor,sql,rpc,endpoint,verifyQueue,verifyAccount,setStage,expect,legacyLocator}){
 const uuid=value=>{expect(typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(value),'Owned candidate fixture identity rejected');return value}
 const terms=uuid(randomUUID()),reference='synthetic-candidate-actual/v1',clients=[];let queue
 const base=actor=>({p_practice:actor.scope.practiceId,p_location:actor.scope.locationId})
 const denied=async(actor,name,args,code='42501')=>expect((await actor.client.rpc(name,args)).error?.code===code,`Candidate ${name} denial missing`)
 function admit(user){const id=uuid(user.id);sql(`insert into public.doctor_candidate_admissions(user_id,purpose,evidence_ref,valid_until)values('${id}','synthetic_fixture','owned-actual-candidate',clock_timestamp()+interval'2 hours');`)}
 async function trial({client,user}){
  admit(user);const offer=await rpc(client,'doctor_saas_terms');expect(offer.configured&&offer.terms?.terms_id===terms&&!offer.live_activation&&!offer.purchase_available,'Candidate synthetic terms mismatch')
  const document=await rpc(client,'doctor_saas_terms_document',{p_terms:terms});expect(document?.document_ref===reference&&document.content_en&&document.content_ar,'Candidate version document unavailable')
  const command={p_terms:terms,p_configuration_revision:offer.configuration_revision,p_document_ref:reference,p_key:randomUUID()}
  const first=await rpc(client,'doctor_start_saas_trial',command),retry=await rpc(client,'doctor_start_saas_trial',command);expect(first.period_id===retry.period_id,'Candidate trial replay allocated twice')
  const state=await rpc(client,'doctor_saas_status');expect(state.state==='trial'&&state.business_writes_allowed&&!state.paid_activation_available&&!state.live_activation,'Candidate trial grants invalid authority')
 }
 async function invite(owner,recipient,capabilities){
  const token=randomBytes(32).toString('hex'),hash=createHash('sha256').update(Buffer.from(token,'hex')).digest('hex')
  const invitation=await rpc(owner.client,'doctor_invite_secretary',{p_practice:owner.scope.practiceId,p_email:recipient.user.email,p_grants:[{location_id:owner.scope.locationId,capabilities}],p_token_hash:hash,p_key:randomUUID()})
  const args={p_invitation:invitation.invitation_id,p_token:token,p_key:randomUUID()}
  await rpc(recipient.client,'doctor_accept_secretary_invitation',args);await rpc(recipient.client,'doctor_accept_secretary_invitation',args)
 }
 try{
  setStage('actual candidate configuration and synthetic immutable terms')
  sql(`insert into public.doctor_saas_terms_versions(id,plan_key,version,status,currency,currency_exponent,monthly_minor,trial_days,staff_limit,staff_unlimited,clinic_limit,clinic_unlimited,over_limit_policy,renewal_policy,grace_days,expiry_policy,cancellation_policy,refund_policy,terms_document_ref,commercial_approval_ref,legal_approval_ref)values('${terms}','synthetic-actual-candidate',1,'approved','USD',2,1234,2,1,false,1,false,'read_only_until_within_limit','manual',0,'historical_read_only','period_end','manual_review','${reference}','SYNTHETIC_FIXTURE_ONLY','SYNTHETIC_FIXTURE_ONLY');
   insert into public.doctor_saas_terms_documents(terms_version_id,document_ref,content_en,content_ar)values('${terms}','${reference}','Synthetic actual-provider test document only. No legal approval or live-sale authority.','وثيقة اختبار مزود اصطناعية فقط. لا تمنح موافقة قانونية أو صلاحية بيع حي.');
   update public.doctor_saas_configuration set terms_version_id='${terms}',revision=revision+1,change_reason='Owned actual-candidate fixture';
   update public.doctor_edition_policy set mode='administrative_candidate',revision=revision+1,change_reason='Owned actual-candidate acceptance';`)
  setStage('actual candidate GoTrue admission, explicit trial and owner onboarding')
  const a=await bootstrap(publicKey,'candidate-a',trial),b=await bootstrap(publicKey,'candidate-b',trial);clients.push(a.client,b.client)
  const staff=await confirmedActor(publicKey,'candidate-staff',({user})=>admit(user));clients.push(staff.client)
  const ownerContexts=await rpc(a.client,'doctor_contexts');expect(ownerContexts.length===1&&ownerContexts[0].edition==='administrative_candidate'&&ownerContexts[0].entitlement.writes_allowed&&!ownerContexts[0].capabilities.some(value=>value.startsWith('documents.')||value.startsWith('clinical.')),'Candidate owner context projection invalid')
  setStage('actual candidate quota and reserved-seat acceptance')
  const deniedClinic=randomUUID();await denied(a,'doctor_write_location',{p_practice:a.scope.practiceId,p_name:'Synthetic blocked extra clinic',p_timezone:'Etc/UTC',p_phone:'',p_address:'',p_key:deniedClinic},'DS003')
  await invite(a,staff,['patients.read','patients.write','appointments.read','queue.manage']);await invite(b,staff,['patients.read','appointments.read'])
  const contexts=await rpc(staff.client,'doctor_contexts');expect(contexts.length===2&&contexts.every(value=>value.portal==='secretary'&&value.edition==='administrative_candidate'&&value.entitlement.state==='trial')&&!contexts.find(value=>value.practice_id===b.scope.practiceId).capabilities.includes('patients.write'),'Candidate independent grants widened')
  expect((await rpc(staff.client,'doctor_session_context')).practice_id===null,'Candidate staff acquired ownership')
  setStage('actual candidate SaaS quote and held-intent transport')
  const heldQuote=await verifyDoctorSaasQuoteProvider({a,b,staff,rpc})
  setStage('actual candidate synthetic financial reconciliation and owner report')
  await verifyDoctorSaasFinancialProvider({a,b,staff,quoteId:heldQuote,sql,rpc})
  const administration=await rpc(a.client,'doctor_administration_readiness');expect(administration.subscriber_user_id===a.user.id&&administration.state==='unavailable'&&administration.target_binding==='unconfigured'&&administration.signing==='unconfigured'&&administration.capabilities.length===0&&!administration.operator_grant_available&&!administration.payment_confirmed&&!administration.live_activation,'Unconfigured Doctor administration acquired authority')
  const team=await rpc(a.client,'doctor_team',{p_practice:a.scope.practiceId});expect(team.member_total===1&&team.invitation_total===1&&team.invitations.every(value=>value.status==='accepted')&&team.entitlement.state==='trial'&&!team.entitlement.can_add_staff,'Candidate reserved-seat conversion or team authority invalid')
  const deniedInvite=randomUUID();await denied(a,'doctor_invite_secretary',{p_practice:a.scope.practiceId,p_email:`synthetic-denied-${randomUUID()}@example.test`,p_grants:[{location_id:a.scope.locationId,capabilities:['patients.read']}],p_token_hash:'a'.repeat(64),p_key:deniedInvite},'DS002')
  const usage=await rpc(a.client,'doctor_saas_status');expect(usage.usage.staff_members===1&&usage.usage.staff_invitations===0&&usage.usage.staff_total===1,'Candidate reserved seat counted twice')
  expect(sql(`select count(*)from doctor_private.command_receipts where command_key in('${deniedClinic}','${deniedInvite}');`)==='0','Candidate quota denial retained a receipt')
  setStage('actual candidate private Realtime and attributed appointment history')
  queue=await verifyQueue(a,b,'admin.schedule_change')
  setStage('actual candidate direct and Edge document denial')
  await denied(a,'doctor_patient_documents',{...base(a),p_patient:a.scope.patientId})
  const pdf=new TextEncoder().encode('%PDF-1.7\nSynthetic denied candidate file\n%%EOF\n')
  expect((await endpoint(a,'upload',{filename:'synthetic-candidate.pdf'},pdf)).status===403,'Candidate Edge upload admitted')
  expect((await endpoint(a,'download',{documentId:randomUUID()})).status===403,'Candidate Edge download admitted')
  expect((await a.client.storage.from('doctor-private-documents').download(legacyLocator)).error,'Candidate direct Storage download admitted')
  expect((await a.client.storage.from('doctor-private-documents').upload(`candidate-denied-${randomUUID()}.pdf`,pdf,{contentType:'application/pdf'})).error,'Candidate direct Storage upload admitted')
  expect((await rpc(a.client,'doctor_administrative_edition')).clinical_records===false,'Candidate clinical boundary opened')
  setStage('actual candidate operator hold, staff funding and independent owner')
  const before=await rpc(a.client,'doctor_saas_status');sql(`update public.doctor_saas_accounts set state='suspended',revision=revision+1,reason_code='operator_hold'where subscriber_user_id='${uuid(a.user.id)}';`)
  const write={...base(a),p_input:{name:'Synthetic held write',phone:'',email:'',date_of_birth:null},p_key:randomUUID()}
  await denied(a,'doctor_write_patient',write,'DS006');await denied(staff,'doctor_write_patient',{...write,p_key:randomUUID()},'DS006')
  const heldProfile=await rpc(a.client,'doctor_patient_profile',{...base(a),p_patient:a.scope.patientId});expect(!heldProfile.can_write&&heldProfile.patient.id===a.scope.patientId,'Candidate held history/read projection invalid')
  await denied(a,'doctor_prepare_saas_payment',{p_quote:heldQuote,p_key:randomUUID()},'40001')
  const heldTeam=await rpc(a.client,'doctor_team',{p_practice:a.scope.practiceId});expect(heldTeam.entitlement.state==='suspended'&&!heldTeam.entitlement.writes_allowed,'Candidate held team authority invalid')
  const heldContexts=await rpc(staff.client,'doctor_contexts');expect(heldContexts.find(value=>value.practice_id===a.scope.practiceId).entitlement.state==='suspended'&&heldContexts.find(value=>value.practice_id===b.scope.practiceId).entitlement.state==='trial','Candidate funding leaked across owners')
  await rpc(b.client,'doctor_write_patient',{...base(b),p_input:{name:'Synthetic independent candidate patient',phone:'',email:'',date_of_birth:null},p_key:randomUUID()})
  const requestKey=randomUUID();const request=await rpc(a.client,'doctor_submit_privacy_request',{p_kind:'access_review',p_key:requestKey});expect((await rpc(a.client,'doctor_submit_privacy_request',{p_kind:'access_review',p_key:requestKey})).id===request.id&&(await rpc(b.client,'doctor_privacy_requests')).items.length===0,'Candidate held privacy intake is not account-local')
  expect((await rpc(a.client,'doctor_account_settings')).in_app_confirmations===false,'Candidate held account recovery settings unavailable')
  sql(`update public.doctor_saas_accounts set state='enabled',revision=revision+1,reason_code='operator_resume'where subscriber_user_id='${uuid(a.user.id)}';`)
  const resumed=await rpc(a.client,'doctor_saas_status');expect(resumed.state==='trial'&&resumed.period.id===before.period.id&&resumed.period.ends_at===before.period.ends_at,'Candidate resume changed the bound period')
  const history=await rpc(a.client,'doctor_appointment_history',{...base(a),p_appointment:queue.sample.appointmentId});expect(history.total===4,'Candidate hold/resume lost attributed history')
  setStage('actual candidate database-clock expiry and retained recovery/rights')
  const expiring=await bootstrap(publicKey,'candidate-expiring',({user})=>{
   admit(user);const userId=uuid(user.id),period=uuid(randomUUID())
   sql(`with stamp as(select(clock_timestamp()at time zone'UTC')+interval'12 seconds'as ending)insert into public.doctor_saas_periods(id,subscriber_user_id,terms_version_id,kind,started_at,ends_at,accepted_document_ref)select'${period}','${userId}','${terms}','trial',(ending-interval'2 days')at time zone'UTC',ending at time zone'UTC','${reference}'from stamp;
    insert into public.doctor_saas_accounts(subscriber_user_id,current_period_id,state,reason_code)values('${userId}','${period}','enabled','trial_started');insert into public.doctor_saas_period_events(subscriber_user_id,revision,period_id,reason_code,next_state)values('${userId}',1,'${period}','trial_started','enabled');`)
  });clients.push(expiring.client)
  const expiryBefore=await rpc(expiring.client,'doctor_saas_status');expect(expiryBefore.state==='trial','Candidate historical-period fixture was not active initially')
  const expiryOffer=await rpc(expiring.client,'doctor_saas_terms')
  const expiryQuote=await rpc(expiring.client,'doctor_create_saas_quote',{p_terms:terms,p_configuration_revision:expiryOffer.configuration_revision,p_account_revision:expiryBefore.revision,p_interval:'monthly',p_document_ref:reference,p_key:randomUUID()})
  let expired;const deadline=Date.now()+30000
  do{expired=await rpc(expiring.client,'doctor_saas_status');if(expired.state==='expired')break;expect(Date.now()<deadline,'Candidate real expiry deadline exceeded');await new Promise(resolve=>setTimeout(resolve,250))}while(expired.state!=='expired')
  expect(!expired.business_writes_allowed&&expired.period.id===expiryBefore.period.id&&expired.period.ends_at===expiryBefore.period.ends_at,'Candidate expiry changed history or retained write authority')
  await denied(expiring,'doctor_prepare_saas_payment',{p_quote:expiryQuote.quote_id,p_key:randomUUID()},'40001')
  await denied(expiring,'doctor_write_patient',{...base(expiring),p_input:{name:'Synthetic expired denial',phone:'',email:'',date_of_birth:null},p_key:randomUUID()},'DS006')
  expect((await rpc(expiring.client,'doctor_patient_profile',{...base(expiring),p_patient:expiring.scope.patientId})).patient.id===expiring.scope.patientId,'Candidate expiry removed history')
  await rpc(expiring.client,'doctor_submit_privacy_request',{p_kind:'erasure_review',p_key:randomUUID()});expect((await rpc(expiring.client,'doctor_privacy_requests')).fulfillment_available===false,'Candidate expiry created fulfillment authority')
  await rpc(expiring.client,'doctor_account_settings');expect((await rpc(expiring.client,'doctor_contexts'))[0].entitlement.state==='expired','Candidate expiry context projection stale')
  setStage('actual candidate browser confirmation, settings and account recovery')
  await verifyAccount(email=>{expect(/^synthetic-web-[a-z0-9-]+@example\.test$/.test(email),'Owned browser fixture email rejected');sql(`insert into public.doctor_candidate_admissions(user_id,purpose,evidence_ref,valid_until)select id,'synthetic_fixture','owned-actual-candidate-browser',clock_timestamp()+interval'2 hours'from auth.users where email='${email}';`)})
  setStage('actual candidate frozen-session Realtime revocation');expect(!(await a.client.auth.signOut({scope:'local'})).error,'Candidate owner signout failed');await queue.verifyRevocation()
  console.log('Actual administrative_candidate acceptance passed: real GoTrue admission and versioned trial; atomic clinic/staff quotas and reserved conversion; exact context/team flags; private revision-only Realtime and history; hold/resume and database-clock expiry; independent funding; own-account rights/settings/recovery; direct Storage/RPC and actual Edge document denial. Paid/live and clinical authority remain unavailable.')
 }finally{await queue?.cleanup();await Promise.allSettled(clients.map(client=>client.removeAllChannels()))}
}
