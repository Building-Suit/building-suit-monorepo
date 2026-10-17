// Real transactions: reception races must serialize with current permissions.
import { spawn,spawnSync } from 'node:child_process'
import assert from 'node:assert/strict'
export async function verifyAppointmentConcurrency(container) {
  const args = ['exec','-i',container,'psql','-h','127.0.0.1','-U','postgres','-X','-qAt','-v','ON_ERROR_STOP=1']
  const sql = input => { const result = spawnSync('docker',args,{ input,encoding: 'utf8' });assert.equal(result.status,0,result.stderr);return result.stdout.trim() }
  const id = (prefix,n) => `${prefix}000000-0000-0000-0000-${String(n).padStart(12,'0')}`
  const user = n => id('b1',n);const sid = n => id('b2',n);const practice = n => id('b3',n);const place = n => id('b4',n);const patient = n => id('b8',n);const appointment = n => id('b9',n);const key = n => id('ba',n)
  const claim = n => `set role authenticated;set request.jwt.claims='{"sub":"${user(n)}","session_id":"${sid(n)}","role":"authenticated"}';`
  const command = (n,state,version,k,actor=1,location=1,reason='') => `${claim(actor)}select public.doctor_transition_appointment('${practice(location===3 ? 2 : 1)}','${place(location)}','${appointment(n)}',${version},'${state}','${reason}','${key(k)}');`
  sql(`insert into auth.users(id,email,email_confirmed_at,is_anonymous)select ('b1000000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,'synthetic-queue-race-'||n||'@example.test',now(),false from generate_series(1,3)n;
    insert into auth.sessions(id,user_id,not_after)select ('b2000000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,('b1000000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,now()+interval'1 hour'from generate_series(1,3)n;
    insert into public.doctor_profiles(user_id,display_name)values('${user(1)}','Synthetic queue race A'),('${user(2)}','Synthetic queue race B');
    insert into public.practices(id,owner_user_id,name)values('${practice(1)}','${user(1)}','Synthetic queue race A'),('${practice(2)}','${user(2)}','Synthetic queue race B');
    insert into public.locations(id,practice_id,name,timezone)values('${place(1)}','${practice(1)}','Queue race A1','Etc/UTC'),('${place(2)}','${practice(1)}','Queue race A2','Etc/UTC'),('${place(3)}','${practice(2)}','Queue race B1','Etc/UTC');
    insert into public.patient_identities(id)values('${id('b7',1)}'),('${id('b7',2)}');
    insert into public.practice_patients(id,practice_id,patient_identity_id,display_name,created_location_id,created_by)values('${patient(1)}','${practice(1)}','${id('b7',1)}','Synthetic queue race patient A','${place(1)}','${user(1)}'),('${patient(2)}','${practice(2)}','${id('b7',2)}','Synthetic queue race patient B','${place(3)}','${user(2)}');
    insert into public.memberships(id,practice_id,user_id,capabilities)values('${id('b5',1)}','${practice(1)}','${user(3)}',array['appointments.read','appointments.write','queue.manage','patients.read']),('${id('b5',2)}','${practice(2)}','${user(3)}',array['appointments.read']);
    insert into public.membership_locations(practice_id,membership_id,location_id,capabilities)values('${practice(1)}','${id('b5',1)}','${place(1)}',array['appointments.read','appointments.write','queue.manage','patients.read']),('${practice(1)}','${id('b5',1)}','${place(2)}',array['appointments.read','appointments.write','queue.manage','patients.read']),('${practice(2)}','${id('b5',2)}','${place(3)}',array['appointments.read']);`)
  for(const [n,location] of [[1,1],[2,2],[3,1],[4,1],[5,3]])sql(`insert into public.appointments(id,practice_id,doctor_user_id,location_id,patient_id,starts_at,ends_at,timezone,location_name,created_by)values('${appointment(n)}','${practice(location===3 ? 2 : 1)}','${user(location===3 ? 2 : 1)}','${place(location)}','${patient(location===3 ? 2 : 1)}',date_trunc('day',now())+interval'${n} hour',date_trunc('day',now())+interval'${n} hour 20 minutes','Etc/UTC','Synthetic queue race','${user(location===3 ? 2 : 1)}');`)
  function start(input,open=false) { const child = spawn('docker',args,{ stdio: ['pipe','pipe','pipe'] });let output = '';let errors = '';child.stdout.on('data',value => { output+=value });child.stderr.on('data',value => { errors+=value });const done = new Promise(resolve => child.on('close',status => resolve({ status,output,errors })));child.stdin.write(input);if(!open)child.stdin.end();return { child,done,output: () => output } }
  async function until(check) { const deadline = Date.now()+10000;while(!check()) { if(Date.now()>deadline)throw new Error('Queue race handshake timed out');await new Promise(resolve => setTimeout(resolve,25)) } }
  async function race(n,firstSql,secondSql) { const first = start(`begin;${firstSql}\n\\echo queue_transaction_held\n`,true);let second
    try { await until(() => first.output().includes('queue_transaction_held'));second = start(`set application_name='doctor_queue_race_${n}';${secondSql}`);await until(() => sql(`select exists(select 1 from pg_stat_activity where application_name='doctor_queue_race_${n}'and wait_event='advisory');`)==='t');first.child.stdin.end('commit;\n\\q\n');const a = await first.done;const b = await second.done;assert.equal(a.status,0,a.errors);return { a,b } }
    finally { for(const process of [first,second])if(process && !process.child.killed && process.child.exitCode===null)process.child.kill('SIGTERM') }
  }
  const replay = await race(1,command(1,'checked_in',1,1,3),command(1,'checked_in',1,1,3));assert.equal(replay.b.status,0,replay.b.errors);assert.equal(replay.a.output.split('\n').find(line => line.startsWith('{')),replay.b.output.split('\n').find(line => line.startsWith('{')))
  const duplicate = await race(2,command(2,'checked_in',1,2,1,2),command(2,'checked_in',1,3,3,2));assert.notEqual(duplicate.b.status,0);assert.match(duplicate.b.errors,/DOCTOR_APPOINTMENT_CONFLICT/)
  const startBoth = await race(3,command(1,'in_progress',2,4),command(2,'in_progress',2,5,3,2));assert.notEqual(startBoth.b.status,0);assert.match(startBoth.b.errors,/DOCTOR_QUEUE_ALREADY_IN_PROGRESS/)
  sql(command(1,'completed',3,6))
  const cancelStart = await race(4,command(2,'cancelled',2,7,1,2,'Synthetic check-in cancellation'),command(2,'in_progress',2,8,3,2));assert.notEqual(cancelStart.b.status,0);assert.match(cancelStart.b.errors,/DOCTOR_APPOINTMENT_CONFLICT/)
  sql(`${claim(1)}select public.doctor_write_schedule('${practice(1)}','${place(1)}',0,jsonb_build_object('slot_minutes',20,'weekly',(select jsonb_agg(jsonb_build_object('weekday',n,'start',540,'end',1020))from generate_series(0,6)n),'exceptions','[]'::jsonb),'${key(15)}',1);`)
  const moved = await race(7,`${claim(1)}select public.doctor_reschedule_appointment('${practice(1)}','${place(1)}','${appointment(3)}',1,'${place(1)}',current_date+7,600,1,1,'Synthetic concurrent move','${key(16)}');`,`${claim(3)}select public.doctor_book_appointment('${practice(1)}','${place(1)}','${patient(1)}',current_date+7,600,1,1,'${key(17)}');`)
  assert.notEqual(moved.b.status,0);assert.match(moved.b.errors,/DOCTOR_APPOINTMENT_CONFLICT/)
  assert.equal(sql(`select count(*)from public.appointment_events where appointment_id='${appointment(3)}'and event_type='appointment.rescheduled';`),'1')
  const revoke = await race(5,`${claim(1)}select public.doctor_set_membership_status('${practice(1)}','${id('b5',1)}',1,'revoked','${key(9)}');`,command(3,'cancelled',1,10,3,1,'Synthetic revoked cancellation'));assert.notEqual(revoke.b.status,0);assert.match(revoke.b.errors,/DOCTOR_ACCESS_DENIED/)
  assert.ok(sql(`${claim(3)}select public.doctor_appointment_board('${practice(2)}','${place(3)}',current_date);`).includes('items'))
  sql(command(4,'checked_in',1,11));sql(command(5,'checked_in',1,12,2,3))
  const first = start(`begin;${command(4,'in_progress',2,13)}\n\\echo independent_queue_held\n`,true);let second
  try { await until(() => first.output().includes('independent_queue_held'));second = start(command(5,'in_progress',2,14,2,3));let timer
    try { const result = await Promise.race([second.done,new Promise((_,reject) => { timer = setTimeout(() => reject(new Error('Independent queue globally blocked')),10000) })]);assert.equal(result.status,0,result.errors) } finally { clearTimeout(timer) }
    first.child.stdin.end('commit;\n\\q\n');assert.equal((await first.done).status,0)
  } finally { for(const process of [first,second])if(process && !process.child.killed && process.child.exitCode===null)process.child.kill('SIGTERM') }
  assert.equal(sql(`select count(*)from public.appointments where practice_id='${practice(1)}'and state in('checked_in','in_progress');`),'1')
  assert.equal(sql(`select count(*)from public.appointment_events where appointment_id='${appointment(2)}'and event_type='appointment.cancelled';`),'1')
  assert.equal(sql(`select count(*)from public.appointment_events where appointment_id='${appointment(1)}'and event_type='appointment.checked_in';`),'1')
  console.log('Seven concurrent appointment scenarios passed: check-in receipt, duplicate reception, cross-clinic active visit, checked-in cancellation, reschedule collision, post-lock revocation and independent doctors')
}
