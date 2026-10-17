// Actual patient write/permission races in the runner's owned PostgreSQL container.
import { spawn,spawnSync } from 'node:child_process'
import assert from 'node:assert/strict'
export async function verifyPatientConcurrency(container) {
  const args = ['exec','-i',container,'psql','-h','127.0.0.1','-U','postgres','-X','-qAt','-v','ON_ERROR_STOP=1']
  function sql(input) {
    const result = spawnSync('docker',args,{ input,encoding: 'utf8' })
    assert.equal(result.status,0,result.stderr); return result.stdout.trim()
  }
  const id = (prefix,n) => `${prefix}000000-0000-0000-0000-${String(n).padStart(12,'0')}`
  const user = n => id('41',n); const session = n => id('42',n); const practice = id('43',1); const location = id('44',1); const key = n => id('46',n); const member = id('45',1)
  const claim = n => `set role authenticated; set request.jwt.claims='{"sub":"${user(n)}","session_id":"${session(n)}","role":"authenticated"}';`
  const form = name => `jsonb_build_object('name','${name}','phone','','email','','date_of_birth',null)`
  const write = (name,intent,patient = null,version = null,actor = 1) => `${claim(actor)} select public.doctor_write_patient('${practice}','${location}',${form(name)},'${key(intent)}',${patient ? `'${patient}'` : 'null'},${version ?? 'null'});`
  sql(`insert into auth.users(id,email,email_confirmed_at,is_anonymous)select ('41000000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,'synthetic-patient-race-'||n||'@example.test',now(),false from generate_series(1,2)n;
    insert into auth.sessions(id,user_id,not_after)select ('42000000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,('41000000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,now()+interval '1 hour' from generate_series(1,2)n;
    insert into public.doctor_profiles(user_id,display_name)values('${user(1)}','Synthetic patient race owner');
    insert into public.practices(id,owner_user_id,name)values('${practice}','${user(1)}','Synthetic patient race practice');
    insert into public.locations(id,practice_id,name,timezone)values('${location}','${practice}','Synthetic race clinic','Etc/UTC');
    insert into public.memberships(id,practice_id,user_id,capabilities)values('${member}','${practice}','${user(2)}',array['patients.read','patients.write']);
    insert into public.membership_locations(practice_id,membership_id,location_id,capabilities)values('${practice}','${member}','${location}',array['patients.read','patients.write']);`)
  function start(input,open = false) {
    const child = spawn('docker',args,{ stdio: ['pipe','pipe','pipe'] }); let output = ''; let errors = ''
    child.stdout.on('data',value => { output+=value }); child.stderr.on('data',value => { errors+=value })
    const done = new Promise(resolve => child.on('close',status => resolve({ status,output,errors })))
    child.stdin.write(input); if (!open) child.stdin.end()
    return { child,done,output: () => output }
  }
  async function until(check) {
    const deadline = Date.now()+10000
    while (!check()) { if (Date.now()>deadline) throw new Error('Patient concurrency handshake timed out'); await new Promise(resolve => setTimeout(resolve,25)) }
  }
  async function race(n,firstSql,secondSql) {
    const first = start(`begin; ${firstSql}\n\\echo patient_transaction_held\n`,true); let second
    try {
      await until(() => first.output().includes('patient_transaction_held'))
      second = start(`set application_name='doctor_patient_race_${n}'; ${secondSql}`)
      await until(() => sql(`select exists(select 1 from pg_stat_activity where application_name='doctor_patient_race_${n}' and wait_event='advisory');`)==='t')
      first.child.stdin.end('commit;\n\\q\n')
      const a = await first.done; const b = await second.done; assert.equal(a.status,0,a.errors)
      return { a,b }
    } finally {
      for (const process of [first,second]) if (process && !process.child.killed && process.child.exitCode===null) process.child.kill('SIGTERM')
    }
  }
  const json = output => JSON.parse(output.split('\n').find(line => line.startsWith('{')))
  const initial = json(sql(write('Synthetic initial',1))).patient_id
  const conflict = await race(1,write('Synthetic first editor',2,initial,1),write('Synthetic losing editor',3,initial,1))
  assert.notEqual(conflict.b.status,0); assert.match(conflict.b.errors,/DOCTOR_PATIENT_CONFLICT/)
  assert.equal(sql(`select display_name||':'||version from public.practice_patients where id='${initial}';`),'Synthetic first editor:2')
  const retry = await race(2,write('Synthetic retry intent',4),write('Synthetic retry intent',4))
  assert.equal(retry.b.status,0,retry.b.errors); assert.deepEqual(json(retry.a.output),json(retry.b.output))
  assert.equal(sql(`select count(*) from public.practice_patients where practice_id='${practice}' and display_name='Synthetic retry intent';`),'1')
  const duplicate = await race(3,write('Synthetic shared household',5),write('Synthetic shared household',6))
  assert.notEqual(duplicate.b.status,0); assert.match(duplicate.b.errors,/DOCTOR_PATIENT_DUPLICATE_REVIEW/)
  assert.equal(sql(`select count(*) from public.practice_patients where practice_id='${practice}' and display_name='Synthetic shared household';`),'1')
  const archive = await race(4,`${claim(1)} select public.doctor_archive_patient('${practice}','${location}','${initial}',2,'${key(7)}');`,write('Synthetic stale correction',8,initial,2))
  assert.notEqual(archive.b.status,0); assert.match(archive.b.errors,/DOCTOR_PATIENT_CONFLICT/)
  assert.equal(sql(`select count(*) from public.patient_administrative_activity where patient_id='${initial}';`),'3')
  const revoked = await race(5,`${claim(1)} select public.doctor_set_membership_status('${practice}','${member}',1,'revoked','${key(9)}');`,write('Synthetic revoked save',10,null,null,2))
  assert.notEqual(revoked.b.status,0); assert.match(revoked.b.errors,/DOCTOR_ACCESS_DENIED/)
  assert.equal(sql(`select count(*) from public.practice_patients where display_name='Synthetic revoked save';`),'0')
  assert.equal(sql(`select count(*) from public.audit_events where practice_id='${practice}' and event_type='patient.created';`),'3')
  console.log('Five concurrent patient scenarios passed: correction CAS, duplicate intent, fresh duplicate review, archive race and permission revocation after lock wait')
}
