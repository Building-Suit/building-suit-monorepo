// Actual SQL transactions prove one doctor's shared calendar across clinics.
import { spawn,spawnSync } from 'node:child_process'
import assert from 'node:assert/strict'
export async function verifyAvailabilityConcurrency(container) {
  const args = ['exec','-i',container,'psql','-h','127.0.0.1','-U','postgres','-X','-qAt','-v','ON_ERROR_STOP=1']
  function sql(input) { const result = spawnSync('docker',args,{ input,encoding: 'utf8' }); assert.equal(result.status,0,result.stderr); return result.stdout.trim() }
  const id = (prefix,n) => `${prefix}000000-0000-0000-0000-${String(n).padStart(12,'0')}`
  const user = n => id('91',n); const sid = n => id('92',n); const practice = n => id('93',n); const location = n => id('94',n); const patient = n => id('98',n); const member = n => id('95',n); const key = n => id('96',n)
  const claim = actor => `set role authenticated; set request.jwt.claims='{"sub":"${user(actor)}","session_id":"${sid(actor)}","role":"authenticated"}';`
  const day = "((clock_timestamp() at time zone 'Africa/Cairo')::date+7)"
  const hours = minutes => `jsonb_build_object('slot_minutes',${minutes},'weekly',(select jsonb_agg(jsonb_build_object('weekday',n,'start',540,'end',1020)) from generate_series(0,6)n),'exceptions','[]'::jsonb)`
  const book = (n,loc = 1,minute = 780,version = 1,actor = 1,locVersion = 1) => `${claim(actor)} select public.doctor_book_appointment('${practice(loc===3 ? 2 : 1)}','${location(loc)}','${patient(loc===3 ? 2 : 1)}',${day},${minute},${version},${locVersion},'${key(n)}');`
  sql(`insert into auth.users(id,email,email_confirmed_at,is_anonymous)select ('91000000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,'synthetic-availability-race-'||n||'@example.test',now(),false from generate_series(1,3)n;
    insert into auth.sessions(id,user_id,not_after)select ('92000000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,('91000000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,now()+interval '1 hour' from generate_series(1,3)n;
    insert into public.doctor_profiles(user_id,display_name)values('${user(1)}','Synthetic schedule race A'),('${user(2)}','Synthetic schedule race B');
    insert into public.practices(id,owner_user_id,name)values('${practice(1)}','${user(1)}','Synthetic schedule race A'),('${practice(2)}','${user(2)}','Synthetic schedule race B');
    insert into public.locations(id,practice_id,name,timezone)values('${location(1)}','${practice(1)}','Schedule race A1','Africa/Cairo'),('${location(2)}','${practice(1)}','Schedule race A2','Europe/London'),('${location(3)}','${practice(2)}','Schedule race B1','Africa/Cairo');
    insert into public.patient_identities(id)values('${id('97',1)}'),('${id('97',2)}');
    insert into public.practice_patients(id,practice_id,patient_identity_id,display_name,created_location_id,created_by)values('${patient(1)}','${practice(1)}','${id('97',1)}','Synthetic schedule race patient A','${location(1)}','${user(1)}'),('${patient(2)}','${practice(2)}','${id('97',2)}','Synthetic schedule race patient B','${location(3)}','${user(2)}');
    insert into public.memberships(id,practice_id,user_id,capabilities)values('${member(1)}','${practice(1)}','${user(3)}',array['patients.read','appointments.read','appointments.write']),('${member(2)}','${practice(2)}','${user(3)}',array['appointments.read']);
    insert into public.membership_locations(practice_id,membership_id,location_id,capabilities)values('${practice(1)}','${member(1)}','${location(1)}',array['patients.read','appointments.read','appointments.write']),('${practice(2)}','${member(2)}','${location(3)}',array['appointments.read']);`)
  for (const loc of [1,2,3]) sql(`${claim(loc===3 ? 2 : 1)} select public.doctor_write_schedule('${practice(loc===3 ? 2 : 1)}','${location(loc)}',0,${hours(20)},'${key(100+loc)}',1);`)
  const otherMinute = Number(sql(`select extract(epoch from(doctor_private.schedule_instant(${day},780,'Africa/Cairo')at time zone'Europe/London')::time)::integer/60;`))
  assert.equal(sql(`${claim(1)} select value->>'available' from jsonb_array_elements(public.doctor_availability('${practice(1)}','${location(2)}',${day})->'slots') where(value->>'minute')::integer=${otherMinute};`),'true')
  function start(input,open = false) {
    const child = spawn('docker',args,{ stdio: ['pipe','pipe','pipe'] }); let output = ''; let errors = ''
    child.stdout.on('data',value => { output+=value }); child.stderr.on('data',value => { errors+=value })
    const done = new Promise(resolve => child.on('close',status => resolve({ status,output,errors })))
    child.stdin.write(input); if (!open) child.stdin.end(); return { child,done,output: () => output }
  }
  async function until(check) { const deadline = Date.now()+10000; while (!check()) { if (Date.now()>deadline) throw new Error('Availability race handshake timed out'); await new Promise(resolve => setTimeout(resolve,25)) } }
  async function race(n,firstSql,secondSql) {
    const first = start(`begin; ${firstSql}\n\\echo availability_transaction_held\n`,true); let second
    try {
      await until(() => first.output().includes('availability_transaction_held')); second = start(`set application_name='doctor_availability_race_${n}'; ${secondSql}`)
      await until(() => sql(`select exists(select 1 from pg_stat_activity where application_name='doctor_availability_race_${n}' and wait_event='advisory');`)==='t')
      first.child.stdin.end('commit;\n\\q\n'); const a = await first.done; const b = await second.done; assert.equal(a.status,0,a.errors); return { a,b }
    } finally { for (const process of [first,second]) if (process && !process.child.killed && process.child.exitCode===null) process.child.kill('SIGTERM') }
  }
  const json = output => JSON.parse(output.split('\n').find(line => line.startsWith('{')))
  const overlap = await race(1,book(1),book(2,2,otherMinute)); assert.notEqual(overlap.b.status,0); assert.match(overlap.b.errors,/DOCTOR_APPOINTMENT_CONFLICT/)
  const appointment = json(overlap.a.output).appointment_id
  const before = sql(`select to_jsonb(a) from public.appointments a where id='${appointment}';`)
  const changed = await race(2,`${claim(1)} select public.doctor_write_schedule('${practice(1)}','${location(1)}',1,${hours(30)},'${key(110)}',1);`,book(3,1,820))
  assert.notEqual(changed.b.status,0); assert.match(changed.b.errors,/DOCTOR_AVAILABILITY_CONFLICT/); assert.equal(sql(`select to_jsonb(a) from public.appointments a where id='${appointment}';`),before)
  const retry = await race(3,book(4,1,840,2),book(4,1,840,2)); assert.equal(retry.b.status,0,retry.b.errors); assert.deepEqual(json(retry.a.output),json(retry.b.output))
  const revoke = await race(4,`${claim(1)} select public.doctor_set_membership_status('${practice(1)}','${member(1)}',1,'revoked','${key(111)}');`,book(5,1,900,2,3))
  assert.notEqual(revoke.b.status,0); assert.match(revoke.b.errors,/DOCTOR_ACCESS_DENIED/)
  assert.ok(sql(`${claim(3)} select public.doctor_availability('${practice(2)}','${location(3)}',${day});`).includes('slots'))
  const zone = await race(5,`${claim(1)} select public.doctor_write_location('${practice(1)}','Schedule race A2','Etc/UTC','','','${key(112)}','${location(2)}',1);`,book(6,2,900,1,1))
  assert.notEqual(zone.b.status,0); assert.match(zone.b.errors,/DOCTOR_AVAILABILITY_CONFLICT/)
  const first = start(`begin; ${book(7,1,930,2)}\n\\echo independent_doctor_held\n`,true); let second
  try {
    await until(() => first.output().includes('independent_doctor_held')); second = start(book(8,3,940,1,2))
    let deadline
    try { const independent = await Promise.race([second.done,new Promise((_,reject) => { deadline = setTimeout(() => reject(new Error('Independent doctor blocked by another doctor')),10000) })]); assert.equal(independent.status,0,independent.errors) } finally { clearTimeout(deadline) }
    first.child.stdin.end('commit;\n\\q\n'); assert.equal((await first.done).status,0)
  } finally { for (const process of [first,second]) if (process && !process.child.killed && process.child.exitCode===null) process.child.kill('SIGTERM') }
  const hoursBeforeZone = sql(`select to_jsonb(s) from public.location_schedules s where location_id='${location(2)}';`)
  const zoneHours = await race(6,`${claim(1)} select public.doctor_write_location('${practice(1)}','Schedule race A2','America/New_York','','','${key(113)}','${location(2)}',2);`,`${claim(1)} select public.doctor_write_schedule('${practice(1)}','${location(2)}',1,${hours(30)},'${key(114)}',2);`)
  assert.notEqual(zoneHours.b.status,0,'Stale timezone editor must fail before committing hours')
  assert.match(zoneHours.b.errors,/DOCTOR_AVAILABILITY_CONFLICT/)
  assert.equal(sql(`select to_jsonb(s) from public.location_schedules s where location_id='${location(2)}';`),hoursBeforeZone,'stale local-hour edits cannot mutate schedule')
  assert.equal(sql(`select count(*) from public.audit_events where practice_id='${practice(1)}' and entity_id='${location(2)}' and event_type='availability.updated';`),'1','rejected stale edit appends no schedule audit')
  assert.equal(sql(`select count(*) from doctor_private.command_receipts where actor_user_id='${user(1)}' and command_key='${key(114)}';`),'0','rejected stale edit stores no successful receipt')
  assert.ok(sql(`${claim(1)} select public.doctor_write_schedule('${practice(1)}','${location(2)}',1,${hours(30)},'${key(115)}',3);`).includes('America/New_York'),'fresh explicit editor context succeeds')
  assert.equal(sql(`select count(*) from public.appointments where practice_id='${practice(1)}';`),'3')
  assert.equal(sql(`select count(*) from public.appointment_events where practice_id='${practice(1)}';`),'3')
  console.log('Seven concurrent availability scenarios passed: cross-clinic overlap, rule/zone changes, stale hours editor, idempotent booking, grant revocation and independent doctors')
}
