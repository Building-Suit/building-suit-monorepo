// DOS-AE-004 owned, disposable synthetic quote/intent transactions only.
import assert from 'node:assert/strict'
import { spawn,spawnSync } from 'node:child_process'
export async function verifySaasQuoteConcurrency(container) {
 const args=['exec','-i',container,'psql','-h','127.0.0.1','-U','postgres','-v','ON_ERROR_STOP=1','-At']
 const id=n=>`ae250000-0000-0000-0000-${String(n).padStart(12,'0')}`
 function sql(input){const r=spawnSync('docker',args,{input,encoding:'utf8'});assert.equal(r.status,0,r.stderr);return r.stdout.trim()}
 const claim=n=>`set role authenticated;select set_config('request.jwt.claims','${JSON.stringify({sub:id(n),session_id:id(n+10),role:'authenticated'})}',false);`
 const revision=()=>Number(sql('select revision from public.doctor_saas_configuration;'))
 const quote=(n,key,rev=revision())=>`${claim(n)}select public.doctor_create_saas_quote('${id(51)}',${rev},0,'monthly','synthetic-quote-race/v1','${id(key)}');`
 const lock=n=>`select doctor_private.saas_lock_subscriber('${id(n)}');`
  function start(input,open=false) {
    const child = spawn('docker',args,{ stdio: ['pipe','pipe','pipe'] });let output = '';let errors = ''
    child.stdout.on('data',value => { output+=value });child.stderr.on('data',value => { errors+=value })
    const done = new Promise(resolve => child.on('close',status => resolve({ status,output,errors })))
    child.stdin.write(input);if(!open)child.stdin.end();return { child,done,output: () => output }
  }
  async function until(check) { const deadline = Date.now()+10000;while(!check()) { if(Date.now()>deadline)throw new Error('Quote transaction handshake timed out');await new Promise(resolve => setTimeout(resolve,25)) } }
  async function race(number,firstSql,secondSql,blocked=true) {
    const first = start(`begin;${firstSql}\n\\echo quote_transaction_held\n`,true);let second
    try {
      await until(() => first.output().includes('quote_transaction_held'))
      second = start(`set application_name='doctor_quote_wait_${number}';${secondSql}`)
      if(blocked)await until(() => sql(`select count(*)from pg_stat_activity where application_name='doctor_quote_wait_${number}'and wait_event_type='Lock'and wait_event='${blocked===true?'advisory':'transactionid'}';`)==='1')
      else {
        let timer
        try { const result = await Promise.race([second.done,new Promise((_,reject) => { timer = setTimeout(() => reject(new Error('Independent subscriber globally blocked')),10000) })]);assert.equal(result.status,0,result.errors) } finally { clearTimeout(timer) }
      }
      first.child.stdin.end('commit;\n\\q\n');const a = await first.done;const b = await second.done;assert.equal(a.status,0,a.errors);return { a,b }
    } finally { for(const process of [first,second])if(process && !process.child.killed && process.child.exitCode===null)process.child.kill('SIGTERM') }
  }

 sql(`insert into auth.users(id,email,email_confirmed_at)values${[1,2,3,4,5,6].map(n=>`('${id(n)}','synthetic-quote-race-${n}@example.test',now())`).join(',')};
 insert into auth.sessions(id,user_id)values${[1,2,3,4,5,6].map(n=>`('${id(n+10)}','${id(n)}')`).join(',')};
 insert into public.doctor_candidate_admissions(id,user_id,purpose,evidence_ref,valid_until)values${[1,2,3,4,5,6].map(n=>`('${id(n+20)}','${id(n)}','synthetic_fixture','disposable-quote-race:${n}',clock_timestamp()+interval'2 hours')`).join(',')};
 insert into public.doctor_saas_terms_versions(id,plan_key,version,status,currency,currency_exponent,monthly_minor,trial_days,staff_limit,staff_unlimited,clinic_limit,clinic_unlimited,over_limit_policy,renewal_policy,grace_days,expiry_policy,cancellation_policy,refund_policy,terms_document_ref,commercial_approval_ref,legal_approval_ref)values
 ('${id(51)}','synthetic-quote-race',1,'approved','USD',2,1234,2,1,false,1,false,'block_new_allocation','manual',0,'historical_read_only','period_end','manual_review','synthetic-quote-race/v1','SYNTHETIC_COMMERCIAL','SYNTHETIC_LEGAL');
 insert into public.doctor_saas_terms_documents(terms_version_id,document_ref,content_en,content_ar)values('${id(51)}','synthetic-quote-race/v1','Synthetic concurrency document; no merchant approval.','وثيقة اختبار اصطناعية فقط دون موافقة قانونية.');
 update public.doctor_saas_configuration set terms_version_id='${id(51)}',revision=revision+1,change_reason='Owned synthetic quote transactions';
 update public.doctor_edition_policy set mode='administrative_candidate',revision=revision+1,change_reason='Owned quote synthetic admission';`)
 try {
  const duplicate=await race(1,quote(1,61),quote(1,61));assert.equal(duplicate.b.status,0,duplicate.b.errors)
  assert.equal(sql(`select count(*)from public.doctor_saas_quotes where subscriber_user_id='${id(1)}';`),'1')
  const q=sql(`select id from public.doctor_saas_quotes where subscriber_user_id='${id(1)}';`)
  const prepare=key=>`${claim(1)}select public.doctor_prepare_saas_payment('${q}','${id(key)}');`
  const intents=await race(2,prepare(62),prepare(63));assert.equal(intents.b.status,0,intents.b.errors)
  assert.equal(sql(`select count(*)from public.doctor_saas_payment_intents where quote_id='${q}';`),'1')
  const oldRevision=revision()
  const changed=await race(3,`update public.doctor_saas_configuration set terms_version_id=null,revision=revision+1,change_reason='Owned concurrent quote offer withdrawal';`,quote(2,64,oldRevision),'row')
  // The configuration row lock, rather than a subscriber advisory lock, holds this command.
  assert.notEqual(changed.b.status,0);assert.match(changed.b.errors,/DOCTOR_SAAS_TERMS_UNCONFIGURED/)
  sql(`update public.doctor_saas_configuration set terms_version_id='${id(51)}',revision=revision+1,change_reason='Restore owned quote offer';`)
  const revoked=await race(4,`${lock(3)}delete from auth.sessions where id='${id(13)}';`,quote(3,65));assert.notEqual(revoked.b.status,0);assert.match(revoked.b.errors,/DOCTOR_AUTH_REQUIRED/)
  const admission=await race(5,`${lock(4)}insert into public.doctor_candidate_revocations(admission_id,reason)values('${id(24)}','operator_revoke');`,quote(4,66));assert.notEqual(admission.b.status,0);assert.match(admission.b.errors,/DOCTOR_SYNTHETIC_ADMISSION_REQUIRED/)
  await race(6,quote(5,67),quote(6,68),false)
  assert.equal(sql(`select count(*)from public.doctor_saas_quotes where subscriber_user_id in('${id(2)}','${id(3)}','${id(4)}');`),'0')
  assert.equal(sql(`select count(*)from doctor_private.command_receipts where actor_user_id in('${id(2)}','${id(3)}','${id(4)}');`),'0')
  const snapshot=start(`begin isolation level repeatable read;${quote(5,69)}`);const rejected=await snapshot.done;assert.notEqual(rejected.status,0);assert.match(rejected.errors,/DOCTOR_SAAS_ISOLATION_REQUIRED/)
  console.log('Seven SaaS quote transactions passed: exact replay, one held intent per quote, concurrent offer withdrawal, post-lock SID/admission revocation independent subscribers and snapshot isolation rejection')
 } finally {
  sql("update public.doctor_saas_configuration set terms_version_id=null,revision=revision+1,change_reason='Remove owned synthetic quote offer';update public.doctor_edition_policy set mode='synthetic_preview',revision=revision+1,change_reason='Restore synthetic preview after quote transactions';")
 }
}
