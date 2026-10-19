// Real COMMIT failures in the runner's owned, network-isolated PostgreSQL.
import assert from 'node:assert/strict'
import { spawn,spawnSync } from 'node:child_process'
export async function verifySaasQuotaConcurrency(container) {
  const args = ['exec','-i',container,'psql','-X','-h','127.0.0.1','-U','postgres','-v','ON_ERROR_STOP=1','-At']
  const id = n => `ae090000-0000-0000-0000-${String(n).padStart(12,'0')}`
  const attempt = input => spawnSync('docker',args,{ input,encoding: 'utf8',timeout: 30000 })
  function sql(input) { const r = attempt(input);assert.equal(r.status,0,r.stderr);return r.stdout.trim() }
  const claim = n => `set role authenticated;select set_config('request.jwt.claims','${JSON.stringify({ sub: id(n),session_id: id(n+10),role: 'authenticated',user_metadata: { paid: true,clinic_limit: 9999 } })}',false);`
  const clinic = (n,key) => `${claim(n)}select public.doctor_write_location('${id(n+20)}','Synthetic quota race','Etc/UTC','','','${id(key)}');`
  const invite = (recipient,key) => `${claim(1)}select public.doctor_invite_secretary('${id(21)}','synthetic-quota-race-${recipient}@example.test',encode(sha256(decode(repeat('cd',32),'hex')),'hex'),jsonb_build_array(jsonb_build_object('location_id',(select id from public.locations where practice_id='${id(21)}'),'capabilities',jsonb_build_array('patients.read'))),'${id(key)}');`
  const lock = n => `select doctor_private.saas_lock_subscriber('${id(n)}');`
  const children = new Set()
  function start(input,open=false) {
    const child = spawn('docker',args,{ stdio: ['pipe','pipe','pipe'] });children.add(child);let output = '';let errors = ''
    child.stdout.on('data',value => { output+=value });child.stderr.on('data',value => { errors+=value })
    const done = new Promise(resolve => child.on('close',status => { children.delete(child);resolve({ status,output,errors }) }))
    child.stdin.write(input);if(!open)child.stdin.end();return { child,done,output: () => output }
  }
  async function until(check,timeout=10000) { const deadline = Date.now()+timeout;while(!check()) { if(Date.now()>deadline)throw new Error('Quota transaction handshake timed out');await new Promise(resolve => setTimeout(resolve,30)) } }
  async function race(number,firstSql,secondSql,beforeRelease=async()=>{}) {
    const first = start(`begin;${firstSql}\n\\echo quota_transaction_held\n`,true)
    await until(() => first.output().includes('quota_transaction_held'))
    const second = start(`set application_name='doctor_quota_wait_${number}';${secondSql}`)
    await until(() => sql(`select count(*)from pg_stat_activity where application_name='doctor_quota_wait_${number}'and wait_event='advisory';`)==='1')
    await beforeRelease()
    first.child.stdin.end('commit;\n\\q\n');const a = await first.done;const b = await second.done;assert.equal(a.status,0,a.errors);return b
  }
  const fails = (result,message) => { assert.notEqual(result.status,0);assert.match(result.errors??result.stderr,message) }
  sql(`insert into auth.users(id,email,email_confirmed_at)values${[1,2,3,4].map(n=>`('${id(n)}','synthetic-quota-race-${n}@example.test',now())`).join(',')};
   insert into auth.sessions(id,user_id)values${[1,2,3,4].map(n=>`('${id(n+10)}','${id(n)}')`).join(',')};
   insert into public.doctor_candidate_admissions(id,user_id,purpose,evidence_ref,valid_until)values${[1,2,3,4].map(n=>`('${id(n+30)}','${id(n)}','synthetic_fixture','disposable-quota-race:${n}',clock_timestamp()+interval'2 hours')`).join(',')};
   insert into public.doctor_profiles(user_id,display_name)values${[1,2,3,4].map(n=>`('${id(n)}','Synthetic quota owner ${n}')`).join(',')};
   insert into public.practices(id,owner_user_id,name)values${[1,2,3,4].map(n=>`('${id(n+20)}','${id(n)}','Synthetic quota practice ${n}')`).join(',')};
   insert into public.doctor_saas_terms_versions(id,plan_key,version,status,currency,currency_exponent,monthly_minor,trial_days,staff_limit,staff_unlimited,clinic_limit,clinic_unlimited,over_limit_policy,renewal_policy,grace_days,expiry_policy,cancellation_policy,refund_policy,terms_document_ref,commercial_approval_ref,legal_approval_ref)values
   ('${id(51)}','synthetic-quota-race',1,'approved','USD',2,1234,2,1,false,1,false,'block_new_allocation','manual',0,'historical_read_only','period_end','manual_review','synthetic-quota-race/v1','SYNTHETIC_COMMERCIAL','SYNTHETIC_LEGAL');
   update public.doctor_saas_configuration set terms_version_id='${id(51)}',revision=revision+1,change_reason='Owned synthetic quota fixture';
   update public.doctor_edition_policy set mode='administrative_candidate',revision=revision+1,change_reason='Owned synthetic quota transaction verification';`)
  try {
    const revision = sql('select revision from public.doctor_saas_configuration where singleton;')
    for(const n of [1,2,4])sql(`${claim(n)}select public.doctor_start_saas_trial('${id(51)}',${revision},'synthetic-quota-race/v1','${id(60+n)}');`)
    const lastClinic = await race(1,clinic(1,71),clinic(1,72));fails(lastClinic,/DOCTOR_SAAS_CLINIC_LIMIT/)
    assert.equal(sql(`select count(*)from public.locations where practice_id='${id(21)}';`),'1')
    const lastStaff = await race(2,invite(2,73),invite(4,74));fails(lastStaff,/DOCTOR_SAAS_STAFF_LIMIT/)
    assert.equal(sql(`select count(*)from public.secretary_invitations where practice_id='${id(21)}';`),'1')
    const invitation = sql(`select id from public.secretary_invitations where practice_id='${id(21)}';`)
    const accept = `${claim(2)}select public.doctor_accept_secretary_invitation('${invitation}',repeat('cd',32),'${id(75)}');`
    sql(`update public.doctor_saas_accounts set state='suspended',revision=revision+1,reason_code='operator_hold'where subscriber_user_id='${id(1)}';`)
    fails(attempt(accept),/DOCTOR_SAAS_PERIOD_INACTIVE/)
    sql(`update public.doctor_saas_accounts set state='enabled',revision=revision+1,reason_code='operator_resume'where subscriber_user_id='${id(1)}';`)
    sql(accept)
    assert.equal(sql(`select doctor_private.saas_usage('${id(21)}')->>'staff_total';`),'1')
    assert.equal(sql(`select status from public.secretary_invitations where id='${invitation}';`),'accepted')
    // The second Doctor's own clinic must progress while the first owner is held.
    const held = start(`begin;${lock(1)}\n\\echo quota_independent_held\n`,true)
    await until(() => held.output().includes('quota_independent_held'))
    const independent = start(clinic(2,76));let timer
    try { const r = await Promise.race([independent.done,new Promise((_,reject)=>{ timer=setTimeout(()=>reject(new Error('Unrelated subscriber quota globally blocked')),10000) })]);assert.equal(r.status,0,r.errors) } finally { clearTimeout(timer);held.child.stdin.end('commit;\n\\q\n');assert.equal((await held.done).status,0) }
    // A valid, explicitly synthetic historical period reaches its immutable end
    // while COMMIT waits. Poll the database clock; do not alter a granted end.
    sql(`with stamp as(select(clock_timestamp()at time zone'UTC')+interval'15 seconds'as ending)
     insert into public.doctor_saas_periods(id,subscriber_user_id,terms_version_id,kind,started_at,ends_at,accepted_document_ref)
     select '${id(63)}','${id(3)}','${id(51)}','trial',(ending-interval'2 days')at time zone'UTC',ending at time zone'UTC','synthetic-quota-race/v1'from stamp;
     insert into public.doctor_saas_accounts(subscriber_user_id,current_period_id,state,reason_code)values('${id(3)}','${id(63)}','enabled','trial_started');
     insert into public.doctor_saas_period_events(subscriber_user_id,revision,period_id,reason_code,next_state)values('${id(3)}',1,'${id(63)}','trial_started','enabled');`)
    const expired = await race(3,lock(3),clinic(3,77),()=>until(()=>sql(`select clock_timestamp()>=ends_at from public.doctor_saas_periods where id='${id(63)}';`)==='t',20000));fails(expired,/DOCTOR_SAAS_PERIOD_INACTIVE/)
    const revoked = await race(4,`${lock(1)}insert into public.doctor_candidate_revocations(admission_id,reason)values('${id(31)}','operator_revoke');`,clinic(1,78));fails(revoked,/DOCTOR_SYNTHETIC_ADMISSION_REQUIRED/)
    const signedOut = await race(5,`${lock(4)}update auth.sessions set not_after=clock_timestamp()-interval'1 second'where id='${id(14)}';`,clinic(4,79));fails(signedOut,/DOCTOR_AUTH_REQUIRED/)
    fails(attempt(`begin isolation level repeatable read;${clinic(2,80)}commit;`),/DOCTOR_SAAS_ISOLATION_REQUIRED/)
    // A committed receipt remains replayable at the cap; it creates no new row.
    sql(clinic(2,76))
    assert.equal(sql(`select count(*)from public.locations where practice_id in('${id(23)}','${id(24)}');`),'0')
    assert.equal(sql(`select count(*)from doctor_private.command_receipts where command_key in(${[72,74,77,78,79,80].map(n=>`'${id(n)}'`).join(',')});`),'0')
    assert.equal(sql(`select count(*)from public.audit_events where actor_user_id in('${id(3)}','${id(4)}');`),'0')
    console.log('Nine SaaS quota transaction scenarios passed: last clinic, reserved staff seat, owner funding isolation, invitation consumption, independent subscribers, post-lock expiry/admission/session revocation and snapshot isolation rejection; committed receipt replay also passed')
  } finally {
    for(const child of children)if(!child.killed && child.exitCode===null)child.kill('SIGTERM')
    sql("update public.doctor_saas_configuration set terms_version_id=null,revision=revision+1,change_reason='Remove owned synthetic quota offer';update public.doctor_edition_policy set mode='synthetic_preview',revision=revision+1,change_reason='Return owned fixture after quota verification';")
  }
}
