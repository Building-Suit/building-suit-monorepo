// Real concurrent transactions in the runner's owned, network-isolated PostgreSQL.
import { spawn, spawnSync } from 'node:child_process'
import assert from 'node:assert/strict'
export async function verifyOnboardingConcurrency(container) {
  const args = ['exec', '-i', container, 'psql', '-h', '127.0.0.1', '-U', 'postgres', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1']
  const sql = input => {
    const result = spawnSync('docker', args, { input, encoding: 'utf8' })
    if (result.status !== 0) throw new Error(result.stderr || 'Concurrency fixture SQL failed')
    return result.stdout.trim()
  }
  const user = n => `81000000-0000-0000-0000-${String(n).padStart(12, '0')}`
  const session = n => `82000000-0000-0000-0000-${String(n).padStart(12, '0')}`
  const command = n => `84000000-0000-0000-0000-${String(n).padStart(12, '0')}`
  const claims = n => `set role authenticated; set request.jwt.claims='{"sub":"${user(n)}","session_id":"${session(n)}","role":"authenticated"}';`
  sql(`insert into auth.users(id,email,email_confirmed_at,is_anonymous) select ('81000000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,'synthetic-race-'||n||'@example.test',now(),false from generate_series(1,5)n;
    insert into auth.sessions(id,user_id,not_after) select ('82000000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,('81000000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,now()+interval '1 hour' from generate_series(1,5)n;
    insert into public.doctor_profiles(user_id,display_name)values('${user(5)}','Synthetic fixture owner');
    insert into public.practices(id,owner_user_id,name)values('83000000-0000-0000-0000-000000000005','${user(5)}','Synthetic fixture practice');`)
  function startSql(input, keepOpen = false) {
    const child = spawn('docker', args, { stdio: ['pipe', 'pipe', 'pipe'] })
    let output = ''; let errors = ''
    child.stdout.on('data', chunk => { output += chunk })
    child.stderr.on('data', chunk => { errors += chunk })
    const done = new Promise(resolve => child.on('close', status => resolve({ status, output, errors })))
    child.stdin.write(input)
    if (!keepOpen) child.stdin.end()
    return { child, done, output: () => output }
  }
  async function until(assertion) {
    const deadline = Date.now() + 10000
    while (!assertion()) {
      if (Date.now() > deadline) throw new Error('Concurrent transaction handshake timed out')
      await new Promise(resolve => setTimeout(resolve, 30))
    }
  }
  async function race(n, blockerSql, contenderSql) {
    const first = startSql(`begin; select pg_advisory_xact_lock(hashtextextended('${user(n)}',0)); ${blockerSql}\n\\echo doctor_lock_held\n`, true)
    let second
    try {
      await until(() => first.output().includes('doctor_lock_held'))
      second = startSql(`set application_name='doctor_setup_race_${n}'; ${claims(n)} ${contenderSql}`)
      await until(() => sql(`select exists(select 1 from pg_stat_activity where application_name='doctor_setup_race_${n}' and wait_event='advisory');`) === 't')
      first.child.stdin.end('commit;\n\\q\n')
      const a = await first.done
      const b = await second.done
      assert.equal(a.status, 0, a.errors)
      return { first: a.output, second: b }
    } finally {
      if (!first.child.killed && first.child.exitCode === null) first.child.kill('SIGTERM')
      if (second && !second.child.killed && second.child.exitCode === null) second.child.kill('SIGTERM')
    }
  }
  const draft = n => `select public.doctor_save_onboarding_draft('${command(n)}',0,'Synthetic race owner','Synthetic race practice','Synthetic first location','Etc/UTC');`
  sql(`${claims(2)} ${draft(2)}`)
  const commands = [
    `select public.doctor_onboard('Synthetic race owner','Synthetic first location','Etc/UTC','${command(1)}');`,
    `select public.doctor_complete_onboarding('${command(2)}',1);`,
    draft(3),
  ]
  for (const n of [1, 2, 3]) {
    const result = await race(n, `insert into public.memberships(practice_id,user_id)values('83000000-0000-0000-0000-000000000005','${user(n)}');`, commands[n - 1])
    assert.notEqual(result.second.status, 0, 'New delegated membership must deny enrollment after the actor lock releases')
    assert.match(result.second.errors, /DOCTOR_OWNER_ENROLLMENT_REQUIRED/)
    assert.equal(sql(`select count(*)from public.practices where owner_user_id='${user(n)}';`), '0')
  }
  sql(`${claims(4)} ${draft(4)}`)
  const complete = `select public.doctor_complete_onboarding('${command(4)}',1);`
  const result = await race(4, `${claims(4)} ${complete}`, complete)
  assert.equal(result.second.status, 0, result.second.errors)
  const original = result.first.split('\n').find(line => line.startsWith('{'))
  const retry = result.second.output.split('\n').find(line => line.startsWith('{'))
  assert.deepEqual(JSON.parse(retry), JSON.parse(original))
  assert.equal(sql(`select jsonb_build_array((select count(*)from public.practices where owner_user_id='${user(4)}'),(select count(*)from public.locations where practice_id=(select id from public.practices where owner_user_id='${user(4)}')),(select count(*)from public.audit_events where actor_user_id='${user(4)}'));`), '[1, 1, 1]')
  console.log('Four concurrent PostgreSQL scenarios passed: delegated enrollment races and duplicate completion')
}
