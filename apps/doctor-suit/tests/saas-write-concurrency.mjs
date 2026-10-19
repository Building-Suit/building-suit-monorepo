// Owned disposable commits: financial changes cannot admit stale business writes.
import assert from 'node:assert/strict'
import { spawn,spawnSync } from 'node:child_process'
export async function verifySaasWriteConcurrency(container) {
  const args = ['exec','-i',container,'psql','-X','-h','127.0.0.1','-U','postgres','-v','ON_ERROR_STOP=1','-At']
  const id = n => `ae110000-0000-0000-0000-${String(n).padStart(12,'0')}`
  const attempt = input => spawnSync('docker',args,{ input,encoding: 'utf8',timeout: 30000 })
  function sql(input) { const r = attempt(input);assert.equal(r.status,0,r.stderr);return r.stdout.trim() }
  const claim = n => `set role authenticated;select set_config('request.jwt.claims','${JSON.stringify({ sub: id(n),session_id: id(n+10),role: 'authenticated',user_metadata: { paid: true,unlimited: true } })}',false);`
  const patient = (actor,owner,key,prior=null) => `${claim(actor)}select public.doctor_write_patient('${id(owner+20)}','${id(owner+30)}','${JSON.stringify({ name: `Synthetic business race ${key}`,phone: '',email: '',date_of_birth: null })}'::jsonb,'${id(key)}'${prior?`,'${prior}',1`:''});`
  const lock = n => `select doctor_private.saas_lock_subscriber('${id(n)}');`
  const hold = (n,suspended) => `update public.doctor_saas_accounts set state='${suspended?'suspended':'enabled'}',revision=revision+1,reason_code='${suspended?'operator_hold':'operator_resume'}'where subscriber_user_id='${id(n)}';`
  const children = new Set()
  function start(input,open=false) {
    const child = spawn('docker',args,{ stdio: ['pipe','pipe','pipe'] });children.add(child);let output = '';let errors = ''
    child.stdout.on('data',value => { output+=value });child.stderr.on('data',value => { errors+=value })
    const done = new Promise(resolve => child.on('close',status => { children.delete(child);resolve({ status,output,errors }) }))
    child.stdin.write(input);if(!open)child.stdin.end();return { child,done,output: () => output }
  }
  async function until(check,timeout=10000) { const deadline = Date.now()+timeout;while(!check()) { if(Date.now()>deadline)throw new Error('Business-write transaction handshake timed out');await new Promise(resolve => setTimeout(resolve,30)) } }
  async function race(number,firstSql,secondSql,beforeRelease=async()=>{}) {
    const first = start(`begin;${firstSql}\n\\echo business_transaction_held\n`,true)
    await until(() => first.output().includes('business_transaction_held'))
    const second = start(`set application_name='doctor_business_wait_${number}';${secondSql}`)
    await until(() => sql(`select count(*)from pg_stat_activity where application_name='doctor_business_wait_${number}'and wait_event='advisory';`)==='1')
    await beforeRelease();first.child.stdin.end('commit;\n\\q\n')
    const a = await first.done;const b = await second.done;assert.equal(a.status,0,a.errors);return b
  }
  const fails = (r,message) => { assert.notEqual(r.status,0);assert.match(r.errors??r.stderr,message) }
  sql(`insert into auth.users(id,email,email_confirmed_at)values${[1,2,3,4].map(n=>`('${id(n)}','synthetic-business-race-${n}@example.test',now())`).join(',')};
   insert into auth.sessions(id,user_id)values${[1,2,3,4].map(n=>`('${id(n+10)}','${id(n)}')`).join(',')};
   insert into public.doctor_candidate_admissions(id,user_id,purpose,evidence_ref,valid_until)values${[1,2,3,4].map(n=>`('${id(n+40)}','${id(n)}','synthetic_fixture','disposable-business-race:${n}',clock_timestamp()+interval'2 hours')`).join(',')};
   insert into public.doctor_profiles(user_id,display_name)values${[1,2,3,4].map(n=>`('${id(n)}','Synthetic business owner ${n}')`).join(',')};
   insert into public.practices(id,owner_user_id,name)values${[1,2,3,4].map(n=>`('${id(n+20)}','${id(n)}','Synthetic business practice ${n}')`).join(',')};
   insert into public.locations(id,practice_id,name,timezone)values${[1,2,3,4].map(n=>`('${id(n+30)}','${id(n+20)}','Synthetic business clinic ${n}','Etc/UTC')`).join(',')};
   insert into public.memberships(id,practice_id,user_id,capabilities)values('${id(55)}','${id(21)}','${id(2)}',array['patients.read','patients.write']);
   insert into public.membership_locations(practice_id,membership_id,location_id)values('${id(21)}','${id(55)}','${id(31)}');
   insert into public.doctor_saas_terms_versions(id,plan_key,version,status,currency,currency_exponent,monthly_minor,trial_days,staff_limit,staff_unlimited,clinic_limit,clinic_unlimited,over_limit_policy,renewal_policy,grace_days,expiry_policy,cancellation_policy,refund_policy,terms_document_ref,commercial_approval_ref,legal_approval_ref)values
   ('${id(51)}','synthetic-business-race',1,'approved','USD',2,1234,2,1,false,1,false,'block_new_allocation','manual',0,'historical_read_only','period_end','manual_review','synthetic-business-race/v1','SYNTHETIC_COMMERCIAL','SYNTHETIC_LEGAL');
   update public.doctor_saas_configuration set terms_version_id='${id(51)}',revision=revision+1,change_reason='Owned synthetic business fixture';
   update public.doctor_edition_policy set mode='administrative_candidate',revision=revision+1,change_reason='Owned synthetic business transaction verification';`)
  try {
    const revision = sql('select revision from public.doctor_saas_configuration where singleton;')
    for(const n of [1,2,4])sql(`${claim(n)}select public.doctor_start_saas_trial('${id(51)}',${revision},'synthetic-business-race/v1','${id(60+n)}');`)
    const newPatient = await race(1,`${lock(1)}${hold(1,true)}`,patient(1,1,71));fails(newPatient,/DOCTOR_SAAS_PERIOD_INACTIVE/)
    assert.equal(sql(`select count(*)from public.practice_patients where practice_id='${id(21)}';`),'0')
    sql(hold(1,false));sql(patient(1,1,72))
    const retained = sql(`select id from public.practice_patients where practice_id='${id(21)}';`)
    const correction = await race(2,`${lock(1)}${hold(1,true)}`,patient(1,1,73,retained));fails(correction,/DOCTOR_SAAS_PERIOD_INACTIVE/)
    assert.equal(sql(`select version from public.practice_patients where id='${retained}';`),'1')
    fails(attempt(patient(2,1,74,retained)),/DOCTOR_SAAS_PERIOD_INACTIVE/)
    // Subscriber D progresses even while A's financial state is locked.
    const held = start(`begin;${lock(1)}\n\\echo business_independent_held\n`,true)
    await until(() => held.output().includes('business_independent_held'))
    const independent = start(patient(4,4,75));let timer
    try { const r = await Promise.race([independent.done,new Promise((_,reject)=>{ timer=setTimeout(()=>reject(new Error('Unrelated business subscriber globally blocked')),10000) })]);assert.equal(r.status,0,r.errors) } finally { clearTimeout(timer);held.child.stdin.end('commit;\n\\q\n');assert.equal((await held.done).status,0) }
    sql(hold(1,false))
    const revoked = await race(3,`${lock(1)}insert into public.doctor_candidate_revocations(admission_id,reason)values('${id(41)}','operator_revoke');`,patient(1,1,76));fails(revoked,/DOCTOR_SYNTHETIC_ADMISSION_REQUIRED/)
    const signedOut = await race(4,`${lock(2)}update auth.sessions set not_after=clock_timestamp()-interval'1 second'where id='${id(12)}';`,patient(2,2,77));fails(signedOut,/DOCTOR_AUTH_REQUIRED/)
    sql(`with stamp as(select(clock_timestamp()at time zone'UTC')+interval'15 seconds'as ending)
     insert into public.doctor_saas_periods(id,subscriber_user_id,terms_version_id,kind,started_at,ends_at,accepted_document_ref)
     select '${id(63)}','${id(3)}','${id(51)}','trial',(ending-interval'2 days')at time zone'UTC',ending at time zone'UTC','synthetic-business-race/v1'from stamp;
     insert into public.doctor_saas_accounts(subscriber_user_id,current_period_id,state,reason_code)values('${id(3)}','${id(63)}','enabled','trial_started');
     insert into public.doctor_saas_period_events(subscriber_user_id,revision,period_id,reason_code,next_state)values('${id(3)}',1,'${id(63)}','trial_started','enabled');`)
    const expired = await race(5,lock(3),patient(3,3,78),()=>until(()=>sql(`select clock_timestamp()>=ends_at from public.doctor_saas_periods where id='${id(63)}';`)==='t',20000));fails(expired,/DOCTOR_SAAS_PERIOD_INACTIVE/)
    assert.equal(sql(`select count(*)from public.practice_patients where practice_id in(${[1,2,3,4].map(n=>`'${id(n+20)}'`).join(',')});`),'2')
    assert.equal(sql(`select count(*)from public.patient_identities pi join public.practice_patients pp on pp.patient_identity_id=pi.id where pp.practice_id in(${[1,2,3,4].map(n=>`'${id(n+20)}'`).join(',')});`),'2')
    assert.equal(sql('select count(*)from public.patient_identities pi where not exists(select 1 from public.practice_patients pp where pp.patient_identity_id=pi.id);'),'0')
    assert.equal(sql(`select count(*)from doctor_private.command_receipts where command_key in(${[71,73,74,76,77,78].map(n=>`'${id(n)}'`).join(',')});`),'0')
    assert.equal(sql(`select count(*)from public.patient_administrative_activity where practice_id='${id(21)}';`),'1')
    console.log('Seven SaaS business-write transaction scenarios passed: creation/correction rollback after owner hold, independent subscriber funding denial/progress, post-lock admission/session revocation and expiry; failed writes retain no orphan identity, receipt or activity')
  } finally {
    for(const child of children)if(!child.killed && child.exitCode===null)child.kill('SIGTERM')
    sql("update public.doctor_saas_configuration set terms_version_id=null,revision=revision+1,change_reason='Remove owned synthetic business offer';update public.doctor_edition_policy set mode='synthetic_preview',revision=revision+1,change_reason='Return owned fixture after business-write verification';")
  }
}
