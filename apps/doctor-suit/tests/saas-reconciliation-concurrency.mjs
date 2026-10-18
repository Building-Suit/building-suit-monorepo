// Owned synthetic financial ledger transactions; never a payment-provider adapter.
import assert from 'node:assert/strict'
import {spawn,spawnSync}from'node:child_process'
import{verifySaasReportSnapshot}from'./saas-report-snapshot.mjs'
export async function verifySaasReconciliationConcurrency(container){
 const args=['exec','-i',container,'psql','-h','127.0.0.1','-U','postgres','-v','ON_ERROR_STOP=1','-At']
 const id=n=>`ae270000-0000-0000-0000-${String(n).padStart(12,'0')}`
 function sql(input){const r=spawnSync('docker',args,{input,encoding:'utf8'});assert.equal(r.status,0,r.stderr);return r.stdout.trim()}
 const claim=n=>`set role authenticated;select set_config('request.jwt.claims','${JSON.stringify({sub:id(n),session_id:id(n+10),role:'authenticated'})}',false);`
  function start(input,open=false) {
    const child = spawn('docker',args,{ stdio: ['pipe','pipe','pipe'] });let output = '';let errors = ''
    child.stdout.on('data',value => { output+=value });child.stderr.on('data',value => { errors+=value })
    const done = new Promise(resolve => child.on('close',status => resolve({ status,output,errors })))
    child.stdin.write(input);if(!open)child.stdin.end();return { child,done,output: () => output }
  }
  async function until(check) { const deadline = Date.now()+10000;while(!check()) { if(Date.now()>deadline)throw new Error('Reconciliation transaction handshake timed out');await new Promise(resolve => setTimeout(resolve,25)) } }
  async function race(number,firstSql,secondSql,blocked=true) {
    const first = start(`begin;${firstSql}\n\\echo reconciliation_transaction_held\n`,true);let second
    try {
      await until(() => first.output().includes('reconciliation_transaction_held'))
      second = start(`set application_name='doctor_reconciliation_wait_${number}';${secondSql}`)
      if(blocked)await until(() => sql(`select count(*)from pg_stat_activity where application_name='doctor_reconciliation_wait_${number}'and wait_event_type='Lock'and wait_event='${blocked===true?'advisory':'transactionid'}';`)==='1')
      else {
        let timer
        try { const result = await Promise.race([second.done,new Promise((_,reject) => { timer = setTimeout(() => reject(new Error('Independent subscriber globally blocked')),10000) })]);assert.equal(result.status,0,result.errors) } finally { clearTimeout(timer) }
      }
      first.child.stdin.end('commit;\n\\q\n');const a = await first.done;const b = await second.done;assert.equal(a.status,0,a.errors);return { a,b }
    } finally { for(const process of [first,second])if(process && !process.child.killed && process.child.exitCode===null)process.child.kill('SIGTERM') }
  }


 sql(`insert into auth.users(id,email,email_confirmed_at)values${[1,2,3,4].map(n=>`('${id(n)}','synthetic-financial-race-${n}@example.test',now())`).join(',')};
 insert into auth.sessions(id,user_id)values${[1,2,3,4].map(n=>`('${id(n+10)}','${id(n)}')`).join(',')};
 insert into public.doctor_saas_terms_versions(id,plan_key,version,status,currency,currency_exponent,monthly_minor,trial_days,staff_limit,staff_unlimited,clinic_limit,clinic_unlimited,over_limit_policy,renewal_policy,grace_days,expiry_policy,cancellation_policy,refund_policy,terms_document_ref,commercial_approval_ref,legal_approval_ref)values
 ('${id(51)}','synthetic-financial-race',1,'approved','USD',2,1234,2,1,false,1,false,'block_new_allocation','manual',0,'historical_read_only','period_end','manual_review','synthetic-financial-race/v1','SYNTHETIC_COMMERCIAL','SYNTHETIC_LEGAL');
 insert into public.doctor_saas_terms_documents(terms_version_id,document_ref,content_en,content_ar)values('${id(51)}','synthetic-financial-race/v1','Synthetic financial transaction document only.','وثيقة اختبار اصطناعية فقط دون موافقة قانونية.');
 update public.doctor_saas_configuration set terms_version_id='${id(51)}',revision=revision+1,change_reason='Owned synthetic financial transactions';`)
 const revision=Number(sql('select revision from public.doctor_saas_configuration;'))
 const intents=[]
 for(const n of[1,2,3,4]){
  sql(`${claim(n)}select public.doctor_create_saas_quote('${id(51)}',${revision},0,'monthly','synthetic-financial-race/v1','${id(n+60)}');`)
  const q=sql(`select id from public.doctor_saas_quotes where subscriber_user_id='${id(n)}';`)
  sql(`${claim(n)}select public.doctor_prepare_saas_payment('${q}','${id(n+70)}');`)
  intents[n]=sql(`select id from public.doctor_saas_payment_intents where subscriber_user_id='${id(n)}';`)
 }
 const evidence=(n,event,sequence,outcome,delivery,amount=1234)=>`select doctor_private.record_saas_synthetic_evidence('${intents[n]}','synthetic-fixture/race-${event}',${sequence},'${outcome}','${id(n)}',${amount},'USD','${id(delivery)}');`
 const state=n=>sql(`select doctor_private.saas_synthetic_reconciliation('${intents[n]}');`)
 try{
  const replay=await race(1,evidence(1,'one',2,'confirmed',81),evidence(1,'one',2,'confirmed',81));assert.equal(replay.b.status,0,replay.b.errors)
  const duplicate=await race(2,evidence(1,'one',2,'confirmed',82),evidence(1,'one',2,'confirmed',83));assert.equal(duplicate.b.status,0,duplicate.b.errors)
  assert.equal(sql(`select count(*)from public.doctor_saas_synthetic_events where intent_id='${intents[1]}';`),'1')
  assert.equal(sql(`select count(*)from public.doctor_saas_synthetic_deliveries where intent_id='${intents[1]}';`),'3')
  const late=await race(3,evidence(2,'newer',2,'confirmed',84),evidence(2,'older',1,'pending',85));assert.equal(late.b.status,0,late.b.errors);assert.equal(state(2),'confirmed_synthetic')
  const conflict=await race(4,evidence(2,'collision',3,'confirmed',86),evidence(2,'changed',3,'confirmed',86));assert.notEqual(conflict.b.status,0);assert.match(conflict.b.errors,/DOCTOR_IDEMPOTENCY_CONFLICT/)
  assert.equal(sql("select count(*)from public.doctor_saas_synthetic_events where event_ref='synthetic-fixture/race-changed';"),'0')
  const reuse=await race(5,evidence(1,'one',2,'confirmed',87),evidence(3,'one',2,'confirmed',88));assert.equal(reuse.b.status,0,reuse.b.errors);assert.equal(state(1),'discrepancy_review');assert.equal(state(3),'discrepancy_review')
  await race(6,evidence(3,'independent-a',1,'pending',89),evidence(4,'independent-b',1,'pending',90),false)
  assert.equal(sql(`select count(*)from public.doctor_saas_periods where subscriber_user_id in('${id(1)}','${id(2)}','${id(3)}','${id(4)}');`),'0')
  assert.equal(sql(`select bool_and(state='awaiting_route_approval')from public.doctor_saas_payment_intents where subscriber_user_id in('${id(1)}','${id(2)}','${id(3)}','${id(4)}');`),'t')
  await verifySaasReportSnapshot({container,id,claim,revision})
  console.log('Six synthetic reconciliation transactions passed: exact request replay, duplicate delivery, out-of-order evidence, conflicting request rollback, global event reuse and independent subscribers; paid activation remains unavailable')
 }finally{sql("update public.doctor_saas_configuration set terms_version_id=null,revision=revision+1,change_reason='Remove owned synthetic financial offer';")}
}
