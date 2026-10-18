// Executed only by the maintained disposable GitHub CI PostgreSQL runner.
import assert from 'node:assert/strict'
import {spawn,spawnSync}from'node:child_process'
export async function verifyManualPaymentConcurrency(container){
 const args=['exec','-i',container,'psql','-h','127.0.0.1','-U','postgres','-v','ON_ERROR_STOP=1','-At']
 const id=n=>`ae320000-0000-0000-0000-${String(n).padStart(12,'0')}`
 const sql=input=>{const r=spawnSync('docker',args,{input,encoding:'utf8'});assert.equal(r.status,0,r.stderr);return r.stdout.trim()}
 const claim=n=>`set role authenticated;set request.jwt.claims='${JSON.stringify({sub:id(n),session_id:id(n+10),role:'authenticated'})}';`
 const start=(input,open=false)=>{const child=spawn('docker',args,{stdio:['pipe','pipe','pipe']});let output='',errors='';child.stdout.on('data',v=>output+=v);child.stderr.on('data',v=>errors+=v);const done=new Promise(resolve=>child.on('close',status=>resolve({status,output,errors})));child.stdin.write(input);if(!open)child.stdin.end();return{child,done,output:()=>output}}
 const until=async check=>{const end=Date.now()+10000;while(!check()){if(Date.now()>end)throw new Error('Manual payment transaction handshake timed out');await new Promise(r=>setTimeout(r,25))}}
 async function race(number,firstSql,secondSql,event='advisory'){
  const first=start(`begin;${firstSql}\n\\echo manual_transaction_held\n`,true);let second
  try{await until(()=>first.output().includes('manual_transaction_held'));second=start(`set application_name='doctor_manual_wait_${number}';${secondSql}`)
   await until(()=>sql(`select count(*)from pg_stat_activity where application_name='doctor_manual_wait_${number}'and wait_event_type='Lock'and wait_event='${event}';`)==='1')
   first.child.stdin.end('commit;\n\\q\n');const a=await first.done,b=await second.done;assert.equal(a.status,0,a.errors);return b
  }finally{for(const p of[first,second])if(p&&p.child.exitCode===null)p.child.kill('SIGTERM')}
 }
 sql(`insert into auth.users(id,email,email_confirmed_at)values${[1,2,3,4,5,6,7].map(n=>`('${id(n)}','synthetic-manual-race-${n}@example.test',now())`).join(',')};
 insert into auth.sessions(id,user_id)values${[1,2,3,4,5,6,7].map(n=>`('${id(n+10)}','${id(n)}')`).join(',')};
 insert into public.doctor_candidate_admissions(id,user_id,purpose,evidence_ref,valid_until)values${[1,2,3,4,5,6,7].map(n=>`('${id(n+20)}','${id(n)}','synthetic_fixture','manual-race:${n}',clock_timestamp()+interval'2 hours')`).join(',')};
 insert into public.doctor_saas_terms_versions(id,plan_key,version,status,currency,currency_exponent,monthly_minor,trial_days,staff_limit,staff_unlimited,clinic_limit,clinic_unlimited,over_limit_policy,renewal_policy,grace_days,expiry_policy,cancellation_policy,refund_policy,terms_document_ref,commercial_approval_ref,legal_approval_ref)
 values('${id(51)}','synthetic-manual-race',1,'approved','EGP',2,19900,0,4,false,1,false,'block_new_allocation','manual',0,'historical_read_only','period_end','manual_review','synthetic-manual-race/v1','SYNTHETIC_ONLY','SYNTHETIC_ONLY');
 insert into public.doctor_saas_terms_documents(terms_version_id,document_ref,content_en,content_ar)values('${id(51)}','synthetic-manual-race/v1','Synthetic fixture only.','اختبار اصطناعي فقط.');
 update public.doctor_saas_configuration set terms_version_id='${id(51)}',revision=revision+1,change_reason='Disposable manual races';
 update public.doctor_edition_policy set mode='administrative_candidate',revision=revision+1,change_reason='Disposable manual races';
 insert into public.doctor_manual_payment_recipients(id,account_key,address_kind,address,beneficiary_name,instructions_en,instructions_ar,currency,currency_exponent,merchant_approval_ref)
 values('${id(71)}','${id(72)}','ipa','synthetic-race-only@instapay','Synthetic fixture recipient','Never transfer funds.','لا تحول أموالاً.','EGP',2,'SYNTHETIC_ONLY');
 update public.doctor_manual_payment_configuration set recipient_id='${id(71)}',enabled=true,acceptance_mode='synthetic',revision=revision+1,change_reason='Disposable manual races';
 insert into public.doctor_manual_payment_reviewers(user_id,enabled,revision,approval_ref,valid_until)values${[5,6].map(n=>`('${id(n)}',true,1,'SYNTHETIC_ONLY',clock_timestamp()+interval'1 hour')`).join(',')};`)
 try{
  const config=Number(sql('select revision from public.doctor_manual_payment_configuration'))
  const terms=Number(sql('select revision from public.doctor_saas_configuration'))
  const intents={}
  for(const n of[1,2,3,4,7]){
   sql(`${claim(n)}select public.doctor_create_saas_quote('${id(51)}',${terms},0,'monthly','synthetic-manual-race/v1','${id(100+n)}');`)
   const q=sql(`select id from public.doctor_saas_quotes where subscriber_user_id='${id(n)}'`)
   sql(`${claim(n)}select public.doctor_prepare_saas_payment('${q}','${id(120+n)}');`)
   intents[n]=sql(`select id from public.doctor_saas_payment_intents where quote_id='${q}'`)
  }
  const moment=sql('select clock_timestamp()')
  const submit=(n,key=140+n)=>`${claim(n)}select public.doctor_submit_manual_payment('${intents[n]}','SYNTHETIC-${n}','${moment}',${config},'${id(key)}');`
  const duplicate=await race(1,submit(1),submit(1));assert.equal(duplicate.status,0,duplicate.errors)
  assert.equal(sql(`select count(*)from public.doctor_manual_payment_notices where intent_id='${intents[1]}'`),'1')
  for(const n of[2,3])sql(submit(n))
  const notices=Object.fromEntries([1,2,3].map(n=>[n,sql(`select id from public.doctor_manual_payment_notices where intent_id='${intents[n]}'`)]))
  const verify=(reviewer,n,key=160+n)=>`${claim(reviewer)}select public.doctor_review_manual_payment('${notices[n]}',0,'funds_verified','Independent beneficiary record','SAME-BANK-REFERENCE','19900','EGP','${moment}','SYNTHETIC_BANK_RECORD',true,'${id(key)}');`
  const reused=await race(2,verify(5,1),verify(6,2),'transactionid');assert.notEqual(reused.status,0);assert.match(reused.errors,/unique constraint/)
  assert.equal(sql(`select count(*)from public.doctor_manual_received_funds where recipient_account_key='${id(72)}'`),'1')
  const revoked=await race(3,`update public.doctor_manual_payment_reviewers set enabled=false,revision=revision+1,approval_ref='SYNTHETIC_REVOKED'where user_id='${id(5)}';`,`${claim(5)}select public.doctor_review_manual_payment('${notices[3]}',0,'under_review','Check record',null,null,null,null,null,false,'${id(181)}');`)
  assert.notEqual(revoked.status,0);assert.match(revoked.errors,/DOCTOR_MANUAL_REVIEW_AUTHORITY_REQUIRED/)
  const admission=await race(4,`select doctor_private.saas_lock_subscriber('${id(4)}');insert into public.doctor_candidate_revocations(admission_id,reason)values('${id(24)}','operator_revoke');`,submit(4))
  assert.notEqual(admission.status,0);assert.match(admission.errors,/DOCTOR_SYNTHETIC_ADMISSION_REQUIRED/)
  const disabled=await race(5,`update public.doctor_manual_payment_configuration set enabled=false,revision=revision+1,change_reason='Disable while submission waits';`,submit(7),'transactionid')
  assert.notEqual(disabled.status,0);assert.match(disabled.errors,/DOCTOR_MANUAL_PAYMENT_UNCONFIGURED/)
  assert.equal(sql(`select count(*)from doctor_private.command_receipts where (actor_user_id,command_key)in(('${id(5)}','${id(181)}'),('${id(4)}','${id(144)}'),('${id(7)}','${id(147)}'))`),'0')
  assert.equal(sql(`select count(*)from public.doctor_saas_accounts where subscriber_user_id in('${id(1)}','${id(2)}','${id(3)}','${id(4)}','${id(7)}')`),'0')
  console.log('Five manual-payment transaction scenarios passed: duplicate notice retry, concurrent bank-reference reuse, reviewer revocation after wait, subscriber admission revocation after wait and configuration withdrawal after wait; no entitlement created')
 }finally{
  sql("update public.doctor_manual_payment_configuration set enabled=false,recipient_id=null,acceptance_mode='disabled',revision=revision+1,change_reason='Complete owned manual fixture';")
  sql(`update public.doctor_manual_payment_reviewers set enabled=false,revision=revision+1,approval_ref='SYNTHETIC_FIXTURE_COMPLETE'where user_id in('${id(5)}','${id(6)}');`)
 }
}
