// Real transactions against the owned disposable PostgreSQL container only.
import assert from 'node:assert/strict'
import { spawn,spawnSync } from 'node:child_process'
export async function verifyCandidateAdmissionConcurrency(container) {
  const args = ['exec','-i',container,'psql','-h','127.0.0.1','-U','postgres','-v','ON_ERROR_STOP=1','-At']
  const id = n => `ae040000-0000-0000-0000-${String(n).padStart(12,'0')}`
  const attempt = input => spawnSync('docker',args,{ input,encoding: 'utf8' })
  function sql(input) { const result = attempt(input);assert.equal(result.status,0,result.stderr);return result.stdout.trim() }
  const claim = n => `set role authenticated;select set_config('request.jwt.claims','${JSON.stringify({ sub: id(n),session_id: id(n+10),role: 'authenticated',user_metadata: { approved: true,synthetic_fixture: true } })}',false);`
  const command = (n,version,key,name) => `${claim(n)}select public.doctor_update_account_settings('${name}','',false,${version},'${id(key)}');`
  function start(input,open=false) {
    const child = spawn('docker',args,{ stdio: ['pipe','pipe','pipe'] });let output = '';let errors = ''
    child.stdout.on('data',value => { output+=value });child.stderr.on('data',value => { errors+=value })
    const done = new Promise(resolve => child.on('close',status => resolve({ status,output,errors })))
    child.stdin.write(input);if(!open)child.stdin.end();return { child,done,output: () => output }
  }
  async function until(check) { const deadline = Date.now()+10000;while(!check()) { if(Date.now()>deadline)throw new Error('Candidate admission race handshake timed out');await new Promise(resolve => setTimeout(resolve,25)) } }
  sql(`insert into auth.users(id,email,email_confirmed_at)values('${id(1)}','synthetic-admission-race-a@example.test',now()),('${id(2)}','synthetic-admission-race-b@example.test',now());insert into auth.sessions(id,user_id,created_at)values('${id(11)}','${id(1)}',clock_timestamp()),('${id(12)}','${id(2)}',clock_timestamp());
    insert into public.doctor_candidate_admissions(id,user_id,purpose,evidence_ref,valid_until)values('${id(21)}','${id(1)}','synthetic_fixture','disposable-transaction:actor-a',clock_timestamp()+interval'2 hours'),('${id(22)}','${id(2)}','synthetic_fixture','disposable-transaction:actor-b',clock_timestamp()+interval'2 hours');
    update public.doctor_edition_policy set mode='administrative_candidate',revision=revision+1,change_reason='Explicit synthetic candidate transaction acceptance';`)
  let held;let waiting;let independent
  try {
    sql(command(1,0,41,'Synthetic retained account'))
    held = start(`begin;select pg_advisory_xact_lock(hashtextextended('doctor-account:${id(1)}',1));insert into public.doctor_candidate_revocations(admission_id,reason)values('${id(21)}','operator_revoke');\n\\echo candidate_revocation_held\n`,true)
    await until(() => held.output().includes('candidate_revocation_held'))
    waiting = start(`set application_name='doctor_candidate_revocation_wait';${command(1,1,42,'Synthetic denied replacement')}`)
    await until(() => sql("select count(*)from pg_stat_activity where application_name='doctor_candidate_revocation_wait'and wait_event='advisory';")==='1')
    independent = start(command(2,0,43,'Synthetic independent account'))
    let timer
    try { const result = await Promise.race([independent.done,new Promise((_,reject) => { timer = setTimeout(() => reject(new Error('Candidate admission globally blocked another actor')),10000) })]);assert.equal(result.status,0,result.errors) } finally { clearTimeout(timer) }
    held.child.stdin.end('commit;\n\\q\n');const first = await held.done;assert.equal(first.status,0,first.errors)
    const second = await waiting.done;assert.notEqual(second.status,0);assert.match(second.errors,/DOCTOR_SYNTHETIC_ADMISSION_REQUIRED/)
    const replay = attempt(command(1,0,41,'Synthetic retained account'));assert.notEqual(replay.status,0);assert.match(replay.stderr,/DOCTOR_SYNTHETIC_ADMISSION_REQUIRED/)
    assert.equal(sql(`select count(*)from doctor_private.account_events where actor_user_id='${id(1)}';`),'1')
    assert.equal(sql(`select count(*)from doctor_private.command_receipts where command_key='${id(42)}';`),'0')
    console.log('Three candidate admission transaction scenarios passed: post-lock revocation, revoked receipt replay and independent actor')
  } finally {
    for(const process of [held,waiting,independent])if(process && !process.child.killed && process.child.exitCode===null)process.child.kill('SIGTERM')
    sql("update public.doctor_edition_policy set mode='synthetic_preview',revision=revision+1,change_reason='Return owned fixture to synthetic preview after candidate transaction acceptance';")
  }
}
