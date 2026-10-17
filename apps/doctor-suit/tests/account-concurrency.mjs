import assert from 'node:assert/strict'
import { spawn,spawnSync } from 'node:child_process'
export async function verifyAccountConcurrency(container) {
  const args = ['exec','-i',container,'psql','-h','127.0.0.1','-U','postgres','-v','ON_ERROR_STOP=1','-At']
  const id = n => `d1610000-0000-0000-0000-${String(n).padStart(12,'0')}`
  function sql(input) { const result = spawnSync('docker',args,{ input,encoding: 'utf8' });assert.equal(result.status,0,result.stderr);return result.stdout.trim() }
  const claim = n => `set role authenticated;select set_config('request.jwt.claims','${JSON.stringify({ sub: id(n),session_id: id(n+10),role: 'authenticated' })}',false);`
  const command = (n,version,key,name='Synthetic account',phone='') => `${claim(n)}select public.doctor_update_account_settings('${name}','${phone}',false,${version},'${id(key)}');`
  const lock = n => `select pg_advisory_xact_lock(hashtextextended('doctor-account:${id(n)}',1));`
  sql(`insert into auth.users(id,email,email_confirmed_at)values('${id(1)}','synthetic-account-race-a@example.test',now()),('${id(2)}','synthetic-account-race-b@example.test',now());insert into auth.sessions(id,user_id,created_at)values('${id(11)}','${id(1)}',clock_timestamp()),('${id(12)}','${id(2)}',clock_timestamp());`)
  function start(input,open=false) { const child = spawn('docker',args,{ stdio: ['pipe','pipe','pipe'] });let output = '';let errors = '';child.stdout.on('data',value => { output+=value });child.stderr.on('data',value => { errors+=value });const done = new Promise(resolve => child.on('close',status => resolve({ status,output,errors })));child.stdin.write(input);if(!open)child.stdin.end();return { child,done,output: () => output } }
  async function until(check) { const deadline = Date.now()+10000;while(!check()) { if(Date.now()>deadline)throw new Error('Account race handshake timed out');await new Promise(resolve => setTimeout(resolve,25)) } }
  async function race(n,firstSql,secondSql,blocked=true) {
    const first = start(`begin;${firstSql}\n\\echo account_transaction_held\n`,true);let second
    try {
      await until(() => first.output().includes('account_transaction_held'));second = start(`set application_name='doctor_account_race_${n}';${secondSql}`)
      if(blocked)await until(() => sql(`select exists(select 1 from pg_stat_activity where application_name='doctor_account_race_${n}'and wait_event='advisory');`)==='t')
      else { let timer;try { assert.equal((await Promise.race([second.done,new Promise((_,reject) => { timer = setTimeout(() => reject(new Error('Independent account globally blocked')),10000) })])).status,0) } finally { clearTimeout(timer) } }
      first.child.stdin.end('commit;\n\\q\n');const a = await first.done;const b = await second.done;assert.equal(a.status,0,a.errors);return { a,b }
    } finally { for(const process of [first,second])if(process && !process.child.killed && process.child.exitCode===null)process.child.kill('SIGTERM') }
  }
  const replay = await race(1,command(1,0,41),command(1,0,41));assert.equal(replay.b.status,0,replay.b.errors)
  assert.equal(sql(`select count(*)from doctor_private.account_events where actor_user_id='${id(1)}';`),'1')
  const stale = await race(2,command(1,1,42,'Revised synthetic'),command(1,1,43,'Stale synthetic'));assert.notEqual(stale.b.status,0);assert.match(stale.b.errors,/DOCTOR_ACCOUNT_CONFLICT/)
  await race(3,`${lock(1)}update doctor_private.account_security_policy set contact_reauthentication_seconds=1;update auth.sessions set created_at=clock_timestamp()-interval '2 seconds'where id='${id(11)}';`,command(1,2,44,'Synthetic account','+12025550123')).then(result => { assert.notEqual(result.b.status,0);assert.match(result.b.errors,/DOCTOR_REAUTHENTICATION_REQUIRED/) })
  sql('update doctor_private.account_security_policy set contact_reauthentication_seconds=900;')
  const revoked = await race(4,`${lock(1)}delete from auth.sessions where id='${id(11)}';`,command(1,2,45));assert.notEqual(revoked.b.status,0);assert.match(revoked.b.errors,/DOCTOR_AUTH_REQUIRED/)
  sql(`insert into auth.sessions(id,user_id,created_at)values('${id(11)}','${id(1)}',clock_timestamp());`)
  await race(5,`${lock(1)}`,command(2,0,46),false)
  assert.equal(sql(`select count(*)from doctor_private.account_events where actor_user_id='${id(1)}';`),'2')
  assert.equal(sql(`select count(*)from doctor_private.command_receipts where command_key in('${id(43)}','${id(44)}','${id(45)}');`),'0')
  console.log('Five concurrent account scenarios passed: same intent, stale CAS, post-lock freshness, post-lock SID revocation and independent account')
}
