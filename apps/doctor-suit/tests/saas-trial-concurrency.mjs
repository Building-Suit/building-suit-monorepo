// Owned disposable transactions. No payment, live admission or hosted target.
import assert from 'node:assert/strict'
import { spawn,spawnSync } from 'node:child_process'
export async function verifySaasTrialConcurrency(container) {
  const args = ['exec','-i',container,'psql','-h','127.0.0.1','-U','postgres','-v','ON_ERROR_STOP=1','-At']
  const id = n => `ae070000-0000-0000-0000-${String(n).padStart(12,'0')}`
  function sql(input) { const r = spawnSync('docker',args,{ input,encoding: 'utf8' });assert.equal(r.status,0,r.stderr);return r.stdout.trim() }
  const claim = n => `set role authenticated;select set_config('request.jwt.claims','${JSON.stringify({ sub: id(n),session_id: id(n+10),role: 'authenticated',user_metadata: { paid: true } })}',false);`
  const command = (n,key,revision=2,terms=51,doc='synthetic-races/v1') => `${claim(n)}select public.doctor_start_saas_trial('${id(terms)}',${revision},'${doc}','${id(key)}');`
  const lock = n => `select doctor_private.saas_lock_subscriber('${id(n)}');`
  function start(input,open=false) {
    const child = spawn('docker',args,{ stdio: ['pipe','pipe','pipe'] });let output = '';let errors = ''
    child.stdout.on('data',value => { output+=value });child.stderr.on('data',value => { errors+=value })
    const done = new Promise(resolve => child.on('close',status => resolve({ status,output,errors })))
    child.stdin.write(input);if(!open)child.stdin.end();return { child,done,output: () => output }
  }
  async function until(check) { const deadline = Date.now()+10000;while(!check()) { if(Date.now()>deadline)throw new Error('Trial transaction handshake timed out');await new Promise(resolve => setTimeout(resolve,25)) } }
  async function race(number,firstSql,secondSql,blocked=true) {
    const first = start(`begin;${firstSql}\n\\echo trial_transaction_held\n`,true);let second
    try {
      await until(() => first.output().includes('trial_transaction_held'))
      second = start(`set application_name='doctor_trial_wait_${number}';${secondSql}`)
      if(blocked)await until(() => sql(`select count(*)from pg_stat_activity where application_name='doctor_trial_wait_${number}'and wait_event='advisory';`)==='1')
      else {
        let timer
        try { const result = await Promise.race([second.done,new Promise((_,reject) => { timer = setTimeout(() => reject(new Error('Independent subscriber globally blocked')),10000) })]);assert.equal(result.status,0,result.errors) } finally { clearTimeout(timer) }
      }
      first.child.stdin.end('commit;\n\\q\n');const a = await first.done;const b = await second.done;assert.equal(a.status,0,a.errors);return { a,b }
    } finally { for(const process of [first,second])if(process && !process.child.killed && process.child.exitCode===null)process.child.kill('SIGTERM') }
  }
  sql(`insert into auth.users(id,email,email_confirmed_at)values${[1,2,3,4,5].map(n=>`('${id(n)}','synthetic-trial-race-${n}@example.test',now())`).join(',')};
   insert into auth.sessions(id,user_id)values${[1,2,3,4,5].map(n=>`('${id(n+10)}','${id(n)}')`).join(',')};
   insert into public.doctor_candidate_admissions(id,user_id,purpose,evidence_ref,valid_until)values${[1,2,3,4,5].map(n=>`('${id(n+20)}','${id(n)}','synthetic_fixture','disposable-transaction:trial-${n}',clock_timestamp()+interval'2 hours')`).join(',')};
   insert into public.doctor_saas_terms_versions(id,plan_key,version,status,currency,currency_exponent,monthly_minor,trial_days,staff_limit,staff_unlimited,clinic_limit,clinic_unlimited,over_limit_policy,renewal_policy,grace_days,expiry_policy,cancellation_policy,refund_policy,terms_document_ref,commercial_approval_ref,legal_approval_ref)values
   ('${id(51)}','synthetic-races',1,'approved','USD',2,1234,2,1,false,1,false,'block_new_allocation','manual',0,'historical_read_only','period_end','manual_review','synthetic-races/v1','SYNTHETIC_COMMERCIAL','SYNTHETIC_LEGAL'),
   ('${id(52)}','synthetic-races',2,'approved','USD',2,2345,3,1,false,1,false,'block_new_allocation','manual',0,'historical_read_only','period_end','manual_review','synthetic-races/v2','SYNTHETIC_COMMERCIAL','SYNTHETIC_LEGAL');
   update public.doctor_saas_configuration set terms_version_id='${id(51)}',revision=revision+1,change_reason='Owned synthetic trial race fixture';
   update public.doctor_edition_policy set mode='administrative_candidate',revision=revision+1,change_reason='Owned synthetic trial race verification';`)
  try {
    const replay = await race(1,command(1,71),command(1,71));assert.equal(replay.b.status,0,replay.b.errors)
    assert.equal(sql(`select count(*)from public.doctor_saas_periods where subscriber_user_id='${id(1)}';`),'1')
    const duplicate = await race(2,command(2,72),command(2,73));assert.notEqual(duplicate.b.status,0);assert.match(duplicate.b.errors,/DOCTOR_SAAS_TRIAL_ALREADY_USED/)
    const stale = await race(3,`${lock(3)}update public.doctor_saas_configuration set terms_version_id='${id(52)}',revision=revision+1,change_reason='Owned synthetic offer replacement';`,command(3,74));assert.notEqual(stale.b.status,0);assert.match(stale.b.errors,/DOCTOR_SAAS_TERMS_CONFLICT/)
    sql(`update public.doctor_saas_configuration set terms_version_id='${id(51)}',revision=revision+1,change_reason='Owned synthetic offer restored';`)
    const revoked = await race(4,`${lock(3)}insert into public.doctor_candidate_revocations(admission_id,reason)values('${id(23)}','operator_revoke');`,command(3,75,4));assert.notEqual(revoked.b.status,0);assert.match(revoked.b.errors,/DOCTOR_SYNTHETIC_ADMISSION_REQUIRED/)
    await race(5,command(4,76,4),command(5,77,4),false)
    assert.equal(sql(`select count(*)from public.doctor_saas_periods where subscriber_user_id in('${id(1)}','${id(2)}','${id(4)}','${id(5)}');`),'4')
    assert.equal(sql(`select count(*)from public.doctor_saas_period_events where subscriber_user_id='${id(1)}';`),'1')
    assert.equal(sql(`select count(*)from doctor_private.command_receipts where actor_user_id='${id(3)}'or(actor_user_id='${id(2)}'and command_key='${id(73)}');`),'0')
    console.log('Five SaaS trial transaction scenarios passed: exact replay, one-time allocation, stale terms, post-lock admission revocation and independent subscribers')
  } finally {
    sql("update public.doctor_saas_configuration set terms_version_id=null,revision=revision+1,change_reason='Remove owned synthetic race offer';update public.doctor_edition_policy set mode='synthetic_preview',revision=revision+1,change_reason='Return owned fixture after synthetic trial races';")
  }
}
