// Real COMMIT failures in the runner's owned, network-isolated PostgreSQL.
import assert from 'node:assert/strict'
import { spawn,spawnSync } from 'node:child_process'
export async function verifySaasReservationConcurrency(container) {
  const args = ['exec','-i',container,'psql','-X','-h','127.0.0.1','-U','postgres','-v','ON_ERROR_STOP=1','-At']
  const id = n => `ae140000-0000-0000-0000-${String(n).padStart(12,'0')}`
  const attempt = input => spawnSync('docker',args,{ input,encoding: 'utf8',timeout: 30000 })
  function sql(input) { const r = attempt(input);assert.equal(r.status,0,r.stderr);return r.stdout.trim() }
  const claim = n => `set role authenticated;select set_config('request.jwt.claims','${JSON.stringify({ sub: id(n),session_id: id(n+10),role: 'authenticated',user_metadata: { paid: true,clinic_limit: 9999 } })}',false);`
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
    const second = start(`set application_name='doctor_reservation_wait_${number}';${secondSql}`)
    await until(() => sql(`select count(*)from pg_stat_activity where application_name='doctor_reservation_wait_${number}'and wait_event='advisory';`)==='1')
    await beforeRelease()
    first.child.stdin.end('commit;\n\\q\n');const a = await first.done;const b = await second.done;assert.equal(a.status,0,a.errors);return b
  }
  const fails = (result,message) => { assert.notEqual(result.status,0);assert.match(result.errors??result.stderr,message) }
  sql(`insert into auth.users(id,email,email_confirmed_at)values${[1,2,3,4,5,6,7].map(n=>`('${id(n)}','synthetic-reservation-race-${n}@example.test',now())`).join(',')};
   insert into auth.sessions(id,user_id)values${[1,2,3,4,5,6,7].map(n=>`('${id(n+10)}','${id(n)}')`).join(',')};
   insert into public.doctor_candidate_admissions(id,user_id,purpose,evidence_ref,valid_until)values${[1,2,3,4,5,6,7].map(n=>`('${id(n+40)}','${id(n)}','synthetic_fixture','disposable-reservation-race:${n}',clock_timestamp()+interval'2 hours')`).join(',')};
   insert into public.doctor_profiles(user_id,display_name)values${[1,2,5].map(n=>`('${id(n)}','Synthetic reservation owner ${n}')`).join(',')};
   insert into public.practices(id,owner_user_id,name)values${[1,2,5].map(n=>`('${id(n+20)}','${id(n)}','Synthetic reservation practice ${n}')`).join(',')};
   insert into public.locations(id,practice_id,name,timezone)values${[1,2,5].map(n=>`('${id(n+30)}','${id(n+20)}','Synthetic reservation clinic ${n}','Etc/UTC')`).join(',')};
   insert into public.doctor_saas_terms_versions(id,plan_key,version,status,currency,currency_exponent,monthly_minor,trial_days,staff_limit,staff_unlimited,clinic_limit,clinic_unlimited,over_limit_policy,renewal_policy,grace_days,expiry_policy,cancellation_policy,refund_policy,terms_document_ref,commercial_approval_ref,legal_approval_ref)values
   ${[1,2].map(n=>`('${id(50+n)}','synthetic-reservation-${n}',1,'approved','USD',2,1234,2,${n},false,1,false,'read_only_until_within_limit','manual',0,'historical_read_only','period_end','manual_review','synthetic-reservation/v1','SYNTHETIC_COMMERCIAL','SYNTHETIC_LEGAL')`).join(',')};
   insert into public.secretary_invitations(id,practice_id,recipient_email,token_hash,grants,created_by,expires_at)values
   ${[[1,3],[2,4],[2,6],[5,7]].map(([owner,recipient])=>`('${id(80+recipient)}','${id(20+owner)}','synthetic-reservation-race-${recipient}@example.test',encode(sha256(decode(repeat('cd',32),'hex')),'hex'),jsonb_build_array(jsonb_build_object('location_id','${id(30+owner)}','capabilities',jsonb_build_array('patients.read'))),'${id(owner)}',clock_timestamp()+interval'1 day')`).join(',')};
   update public.doctor_edition_policy set mode='administrative_candidate',revision=revision+1,change_reason='Owned read-only reservation races';`)
  try {
    for(const [owner,plan]of [[1,51],[2,52],[5,51]]) {
      const revision=sql(`update public.doctor_saas_configuration set terms_version_id='${id(plan)}',revision=revision+1,change_reason='Owned synthetic reservation offer' returning revision;`).split('\n')[0]
      sql(`${claim(owner)}select public.doctor_start_saas_trial('${id(plan)}',${revision},'synthetic-reservation/v1','${id(60+owner)}');`)
    }
    const accept=(recipient,key)=>`${claim(recipient)}select public.doctor_accept_secretary_invitation('${id(80+recipient)}',repeat('cd',32),'${id(key)}');`
    const retry=await race(11,accept(3,91),accept(3,91));assert.equal(retry.status,0,retry.errors)
    assert.equal(sql(`select count(*)from public.memberships where practice_id='${id(21)}'and status='active';`),'1')
    const distinct=await race(12,accept(4,92),accept(6,93));assert.equal(distinct.status,0,distinct.errors)
    assert.equal(sql(`select doctor_private.saas_usage('${id(22)}')->>'staff_total';`),'2')
    assert.equal(sql(`select count(*)from public.secretary_invitations where practice_id='${id(22)}'and status='pending';`),'0')
    const fresh=`${claim(5)}select public.doctor_invite_secretary('${id(25)}','synthetic-reservation-race-3@example.test',encode(sha256(decode(repeat('cd',32),'hex')),'hex'),jsonb_build_array(jsonb_build_object('location_id','${id(35)}','capabilities',jsonb_build_array('patients.read'))),'${id(99)}');`
    const competing=await race(13,accept(7,94),fresh);fails(competing,/DOCTOR_SAAS_STAFF_LIMIT/)
    assert.equal(sql(`select doctor_private.saas_usage('${id(25)}')->>'staff_total';`),'1')
    assert.equal(sql(`select count(*)from public.secretary_invitations where practice_id='${id(25)}';`),'1')
    assert.equal(sql(`select count(*)from doctor_private.command_receipts where command_key='${id(99)}';`),'0')
    assert.equal(sql(`select count(*)from public.audit_events where practice_id='${id(25)}'and event_type='secretary.invited';`),'0')
    assert.equal(sql(`select count(*)from public.audit_events where practice_id='${id(25)}'and event_type='secretary.accepted';`),'1')
    assert.equal(sql(`select count(*)from public.secretary_invitations where id in('${id(83)}','${id(84)}','${id(86)}','${id(87)}')and status='accepted';`),'4')
    console.log('Three read-only reservation transaction scenarios passed: concurrent idempotent acceptance at cap, two reserved acceptances at cap, and reserved conversion versus rejected fresh allocation')
  }finally{
    for(const child of children)if(!child.killed&&child.exitCode===null)child.kill('SIGTERM')
    sql("update public.doctor_saas_configuration set terms_version_id=null,revision=revision+1,change_reason='Remove owned reservation offer';update public.doctor_edition_policy set mode='synthetic_preview',revision=revision+1,change_reason='Return fixture after reservation races';")
  }
}
