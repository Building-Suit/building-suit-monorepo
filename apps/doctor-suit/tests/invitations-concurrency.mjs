// Actual concurrent acceptance/enrollment transactions in the runner's owned database.
import { spawn, spawnSync } from 'node:child_process'
import assert from 'node:assert/strict'
export async function verifyInvitationConcurrency(container) {
  const args = ['exec', '-i', container, 'psql', '-h', '127.0.0.1', '-U', 'postgres', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1']
  function sql(input) {
    const result = spawnSync('docker', args, { input, encoding: 'utf8' })
    assert.equal(result.status, 0, result.stderr)
    return result.stdout.trim()
  }
  const id = (prefix, n) => `${prefix}000000-0000-0000-0000-${String(n).padStart(12, '0')}`
  const user = n => id('31', n); const session = n => id('32', n); const invitation = n => id('35', n); const key = n => id('36', n)
  const practice = id('33', 1); const location = id('34', 1); const token = 'e'.repeat(64)
  const claims = n => `set role authenticated; set request.jwt.claims='{"sub":"${user(n)}","session_id":"${session(n)}","role":"authenticated"}';`
  sql(`insert into auth.users(id,email,email_confirmed_at,is_anonymous)select ('31000000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,'synthetic-invite-race-'||n||'@example.test',now(),false from generate_series(1,6)n;
    insert into auth.sessions(id,user_id,not_after)select ('32000000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,('31000000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,now()+interval '1 hour' from generate_series(1,6)n;
    insert into public.doctor_profiles(user_id,display_name)values('${user(1)}','Synthetic invitation race owner');
    insert into public.practices(id,owner_user_id,name)values('${practice}','${user(1)}','Synthetic invitation race practice');
    insert into public.locations(id,practice_id,name,timezone)values('${location}','${practice}','Synthetic race clinic','Etc/UTC');
    insert into public.secretary_invitations(id,practice_id,recipient_email,token_hash,grants,created_by,expires_at)
      select ('35000000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,'${practice}','synthetic-invite-race-'||(n+1)||'@example.test',encode(sha256(decode('${token}','hex')),'hex'),'[{"location_id":"${location}","capabilities":["locations.read"]}]','${user(1)}',now()+interval '1 day' from generate_series(1,5)n;`)
  function start(input, open = false) {
    const child = spawn('docker', args, { stdio: ['pipe', 'pipe', 'pipe'] }); let output = ''; let errors = ''
    child.stdout.on('data', data => { output += data }); child.stderr.on('data', data => { errors += data })
    const done = new Promise(resolve => child.on('close', status => resolve({ status, output, errors })))
    child.stdin.write(input); if (!open) child.stdin.end()
    return { child, done, output: () => output }
  }
  async function until(check) {
    const deadline = Date.now() + 10000
    while (!check()) { if (Date.now() > deadline) throw new Error('Invitation concurrency handshake timed out'); await new Promise(resolve => setTimeout(resolve, 25)) }
  }
  async function race(n, firstSql, secondSql) {
    const first = start(`begin; ${firstSql}\n\\echo invitation_transaction_held\n`, true); let second
    try {
      await until(() => first.output().includes('invitation_transaction_held'))
      second = start(`set application_name='doctor_invitation_race_${n}'; ${secondSql}`)
      await until(() => sql(`select exists(select 1 from pg_stat_activity where application_name='doctor_invitation_race_${n}' and wait_event='advisory');`) === 't')
      first.child.stdin.end('commit;\n\\q\n')
      const a = await first.done; const b = await second.done
      assert.equal(a.status, 0, a.errors)
      return { a, b }
    } finally {
      for (const process of [first, second]) if (process && !process.child.killed && process.child.exitCode === null) process.child.kill('SIGTERM')
    }
  }
  const accept = (n, command = n) => `${claims(n + 1)} select public.doctor_accept_secretary_invitation('${invitation(n)}','${token}','${key(command)}');`
  const same = await race(1, accept(1), accept(1))
  assert.equal(same.b.status, 0, same.b.errors)
  const json = output => JSON.parse(output.split('\n').find(line => line.startsWith('{')))
  assert.deepEqual(json(same.a.output), json(same.b.output))
  assert.equal(sql(`select count(*)from public.memberships where practice_id='${practice}' and user_id='${user(2)}';`), '1')
  assert.equal(sql(`select count(*)from public.audit_events where practice_id='${practice}' and actor_user_id='${user(2)}' and event_type='secretary.accepted';`), '1')
  const different = await race(2, accept(2), accept(2, 102))
  assert.notEqual(different.b.status, 0); assert.match(different.b.errors, /DOCTOR_INVITATION_UNAVAILABLE/)
  assert.equal(sql(`select count(*)from public.memberships where practice_id='${practice}' and user_id='${user(3)}';`), '1')
  const enrollment = await race(3, accept(3), `${claims(4)} select public.doctor_onboard('Synthetic forbidden owner','Synthetic forbidden clinic','Etc/UTC','${key(103)}');`)
  assert.notEqual(enrollment.b.status, 0); assert.match(enrollment.b.errors, /DOCTOR_OWNER_ENROLLMENT_REQUIRED/)
  assert.equal(sql(`select count(*)from public.practices where owner_user_id='${user(4)}';`), '0')
  const expired = await race(4, `select pg_advisory_xact_lock(hashtextextended('${practice}',1)); update public.secretary_invitations set expires_at=clock_timestamp()-interval '1 second' where id='${invitation(4)}';`, accept(4))
  assert.notEqual(expired.b.status, 0); assert.match(expired.b.errors, /DOCTOR_INVITATION_UNAVAILABLE/)
  assert.equal(sql(`select count(*)from public.memberships where user_id='${user(5)}';`), '0')
  const revoked = await race(5, `${accept(5)} ${claims(1)} select public.doctor_set_membership_status('${practice}',(select id from public.memberships where user_id='${user(6)}' and practice_id='${practice}'),1,'revoked','${key(105)}');`, accept(5))
  assert.notEqual(revoked.b.status, 0); assert.match(revoked.b.errors, /DOCTOR_INVITATION_UNAVAILABLE/)
  assert.equal(sql(`select status from public.memberships where user_id='${user(6)}' and practice_id='${practice}';`), 'revoked')
  console.log('Five concurrent invitation scenarios passed: duplicate intent, reused token, enrollment race, expiry recheck and revoked replay')
}
