// Owned CI PostgreSQL transactions only. Review intake never executes billing policy.
import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
export async function verifySaasLifecycleRequestConcurrency(container) {
 const args = ['exec', '-i', container, 'psql', '-h', '127.0.0.1', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-At']
 const id = n => `d2061500-0000-4000-8000-${String(n).padStart(12,'0')}`
 function sql(input) { const r = spawnSync('docker', args, { input, encoding: 'utf8' }); assert.equal(r.status, 0, 'Owned lifecycle SQL command failed'); return r.stdout.trim() }
 const claim = n => `set role authenticated;select set_config('request.jwt.claims','${JSON.stringify({ sub: id(n), session_id: id(n+10), role: 'authenticated' })}',false);`
 const request = (n, action, key) => `${claim(n)}select public.doctor_request_saas_lifecycle('${action}',1,'${id(n+60)}','${id(51)}','synthetic-lifecycle-race/v1',true,'${id(key)}');`
 const lock = n => `select doctor_private.saas_lock_subscriber('${id(n)}');`
 function start(input, open = false) {
  const child = spawn('docker', args, { stdio: ['pipe', 'pipe', 'pipe'] }); let output = '', errors = ''
  child.stdout.on('data', v => { output += v }); child.stderr.on('data', v => { errors += v })
  const done = new Promise(resolve => child.once('close', status => resolve({ status, output, errors })))
  child.stdin.write(input); if (!open) child.stdin.end(); return { child, done, output: () => output }
 }
 async function until(check) { const deadline = Date.now()+10000; while (!check()) { if (Date.now()>deadline) throw Error('Lifecycle transaction handshake timed out'); await new Promise(r => setTimeout(r,25)) } }
 async function race(number, firstSql, secondSql) {
  const first = start(`begin;${firstSql}\n\\echo lifecycle_transaction_held\n`, true); let second
  try {
   await until(() => first.output().includes('lifecycle_transaction_held'))
   second = start(`set application_name='doctor_lifecycle_wait_${number}';${secondSql}`)
   await until(() => sql(`select count(*)from pg_stat_activity where application_name='doctor_lifecycle_wait_${number}'and wait_event_type='Lock'and wait_event='advisory';`)==='1')
   first.child.stdin.end('commit;\n\\q\n'); const a = await first.done, b = await second.done
   assert.equal(a.status,0,'First owned lifecycle transaction failed'); return b
  } finally { for (const p of [first,second]) if (p && !p.child.killed && p.child.exitCode===null) p.child.kill('SIGTERM') }
 }
 const users = [1,2,3,4,5,6]
 sql(`insert into auth.users(id,email,email_confirmed_at)values${users.map(n=>`('${id(n)}','synthetic-lifecycle-race-${n}@example.test',now())`).join(',')};
 insert into auth.sessions(id,user_id)values${users.map(n=>`('${id(n+10)}','${id(n)}')`).join(',')};
 insert into public.doctor_candidate_admissions(id,user_id,purpose,evidence_ref,valid_until)values${users.map(n=>`('${id(n+20)}','${id(n)}','synthetic_fixture','disposable-lifecycle-race:${n}',clock_timestamp()+interval'2 hours')`).join(',')};
 insert into public.doctor_saas_terms_versions(id,plan_key,version,status,currency,currency_exponent,monthly_minor,trial_days,staff_limit,staff_unlimited,clinic_limit,clinic_unlimited,over_limit_policy,renewal_policy,grace_days,expiry_policy,cancellation_policy,refund_policy,terms_document_ref,commercial_approval_ref,legal_approval_ref)values
 ('${id(51)}','synthetic-lifecycle-race',1,'approved','EGP',2,29900,7,4,false,1,false,'block_new_allocation','manual',0,'historical_read_only','period_end','manual_review','synthetic-lifecycle-race/v1','SYNTHETIC_NOT_COMMERCIAL_APPROVAL','SYNTHETIC_NOT_LEGAL_APPROVAL');
 with moment as(select clock_timestamp()at time zone'UTC'as stamp),actors as(select generate_series(1,6)n)
 insert into public.doctor_saas_periods(id,subscriber_user_id,terms_version_id,kind,started_at,ends_at,accepted_document_ref)
 select('d2061500-0000-4000-8000-'||lpad((n+60)::text,12,'0'))::uuid,('d2061500-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'${id(51)}','trial',(stamp-interval'1 day')at time zone'UTC',(stamp+interval'6 days')at time zone'UTC','synthetic-lifecycle-race/v1'from moment cross join actors;
 insert into public.doctor_saas_accounts(subscriber_user_id,current_period_id,state,reason_code)values${users.map(n=>`('${id(n)}','${id(n+60)}','enabled','trial_started')`).join(',')};
 update public.doctor_edition_policy set mode='administrative_candidate',revision=revision+1,change_reason='Owned synthetic lifecycle transaction review';`)
 try {
  assert.equal((await race(1,request(1,'cancellation',101),request(1,'cancellation',101))).status,0,'Exact request replay failed')
  assert.equal(sql(`select count(*)from public.doctor_saas_lifecycle_requests where subscriber_user_id='${id(1)}';`),'1')
  assert.equal((await race(2,request(2,'cancellation',102),request(2,'cancellation',103))).status,0,'Same action duplicate reconciliation failed')
  assert.equal(sql(`select count(*)from public.doctor_saas_lifecycle_requests where subscriber_user_id='${id(2)}';`),'1')
  assert.equal((await race(3,request(3,'renewal',104),request(3,'cancellation',105))).status,0,'Opposite requests were lost')
  assert.equal(sql(`select count(*)from public.doctor_saas_lifecycle_requests where subscriber_user_id='${id(3)}';`),'2')
  const changed = await race(4,`update public.doctor_saas_accounts set state='suspended',reason_code='operator_hold',revision=2 where subscriber_user_id='${id(4)}';`,request(4,'reactivation',106))
  assert.notEqual(changed.status,0); assert.equal(changed.errors.includes('DOCTOR_LIFECYCLE_REQUEST_CONFLICT'),true,'Stale request did not see current revision')
  sql(request(5,'cancellation',107))
  const revoked = await race(5,`${lock(5)}delete from auth.sessions where id='${id(15)}';`,request(5,'cancellation',107))
  assert.notEqual(revoked.status,0); assert.equal(revoked.errors.includes('DOCTOR_AUTH_REQUIRED'),true,'Historical receipt bypassed fresh SID')
  const admission = await race(6,`${lock(6)}insert into public.doctor_candidate_revocations(admission_id,reason)values('${id(26)}','operator_revoke');`,request(6,'renewal',108))
  assert.notEqual(admission.status,0); assert.equal(admission.errors.includes('DOCTOR_SYNTHETIC_ADMISSION_REQUIRED'),true,'Request bypassed post-lock admission revocation')
  assert.equal(sql(`select count(*)from public.doctor_saas_lifecycle_requests where subscriber_user_id in('${id(4)}','${id(6)}');`),'0')
  assert.equal(sql(`select count(*)from doctor_private.command_receipts where command_key in('${id(106)}','${id(108)}');`),'0')
  assert.equal(sql(`select count(*)from public.doctor_saas_periods where terms_version_id='${id(51)}';`),'6')
  assert.equal(sql(`select count(*)from public.doctor_saas_payment_intents i join public.doctor_saas_quotes q on q.id=i.quote_id where q.terms_version_id='${id(51)}';`),'0')
  console.log('Six SaaS lifecycle review-request transactions passed: exact replay, one request per binding/action, opposite requests retained, account revision change, post-lock SID/admission revocation; no period or charge execution.')
 } finally { sql("update public.doctor_edition_policy set mode='synthetic_preview',revision=revision+1,change_reason='Restore preview after lifecycle request transactions';") }
}
