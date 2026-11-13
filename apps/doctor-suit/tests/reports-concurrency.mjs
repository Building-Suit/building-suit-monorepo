import{spawn,spawnSync}from'node:child_process'
import{once}from'node:events'
import{readFile}from'node:fs/promises'
import assert from'node:assert/strict'
export async function verifyReportsConcurrency(container){
 const args=['exec','-i',container,'psql','-h','127.0.0.1','-U','postgres','-X','-qAt','-v','ON_ERROR_STOP=1'],id=n=>`d310a000-0000-4000-8000-${String(n).padStart(12,'0')}`
 const sql=input=>{const r=spawnSync('docker',args,{input,encoding:'utf8'});assert.equal(r.status,0,r.stderr);return r.stdout.trim()}
 const fixture=(await readFile(new URL('../supabase/tests/fixtures/clinical.sql',import.meta.url),'utf8')).replaceAll('d2020000','d310a000')
 const setup=sql(`begin;${fixture}reset role;
 insert into public.appointments(id,practice_id,doctor_user_id,location_id,patient_id,starts_at,ends_at,timezone,location_name,state,created_by)values('${id(1000)}',pg_temp.practice(),pg_temp.id(1),pg_temp.location(),pg_temp.patient(),'2026-01-01T12:00:00Z','2026-01-01T12:05:00Z','Etc/UTC','Synthetic snapshot clinic','booked',pg_temp.id(1));
 insert into public.administrative_tasks(practice_id,id,location_id,kind,assignee_user_id,due_at,timezone,location_name,captured_location_version,state,created_by,updated_by)values(pg_temp.practice(),'${id(1001)}',pg_temp.location(),'general_administration',pg_temp.id(1),'2026-01-01T12:00:00Z','Etc/UTC','Synthetic snapshot clinic',1,'assigned',pg_temp.id(1),pg_temp.id(1));
 update public.memberships set capabilities=array['worklists.read','worklists.manage']where id=pg_temp.id(201);update public.membership_locations set capabilities=array['worklists.read','worklists.manage']where membership_id=pg_temp.id(201);
 select jsonb_build_object('practice',pg_temp.practice(),'location',pg_temp.location());commit;`),f=JSON.parse(setup.split('\n').at(-1));assert(Object.values(f).every(v=>/^[0-9a-f-]{36}$/.test(v)))
 const claim=`set role authenticated;set request.jwt.claims='{"sub":"${id(1)}","session_id":"${id(11)}","role":"authenticated"}';`,query=kind=>claim+`select public.doctor_operational_report('${f.practice}','${f.location}','2026-01-01','2026-01-01','${kind}',0);`
 function run(input){const p=spawn('docker',args,{stdio:['pipe','pipe','pipe']});let out='',err='';p.stdout.on('data',d=>out+=d);p.stderr.on('data',d=>err+=d);const done=once(p,'exit').then(([code])=>({code,out,err}));p.stdin.end(input);return{p,done}}
 const lock=run(`begin;lock table public.appointments,public.administrative_tasks in access exclusive mode;update public.appointments set state='cancelled',version=version+1 where id='${id(1000)}';update public.administrative_tasks set assignee_user_id='${id(3)}',version=version+1 where id='${id(1001)}';select 'ready';select pg_sleep(1);commit;`)
 await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Report snapshot barrier absent')),5000);lock.p.stdout.on('data',d=>{if(String(d).includes('ready')){clearTimeout(timer);resolve()}})})
 const waiting=run(query('follow_up'));assert.equal((await lock.done).code,0);const read=await waiting.done;assert.equal(read.code,0,read.err);const before=JSON.parse(read.out.trim());assert.equal(before.totals.appointments.booked,1);assert.equal(before.totals.appointments.cancelled,0);assert.equal(before.rows[0].assignee,id(1));assert.equal(before.workload[0].assignee,id(1));assert.equal(before.workload[0].open_count,1)
 const after=JSON.parse(sql(query('follow_up')));assert.equal(after.totals.appointments.cancelled,1);assert.equal(after.totals.appointments.booked,0);assert.equal(after.rows[0].assignee,id(3));assert.equal(after.workload[0].assignee,id(3));assert.equal(after.workload[0].open_count,1);assert.equal(after.totals.follow_up.completed,0)
 sql(`update public.memberships set status='revoked',version=version+1 where id='${id(201)}';`)
 const staff=run(query('follow_up').replace(id(1),id(3)).replace(id(11),id(13)));assert.match((await staff.done).err,/DOCTOR_ACCESS_DENIED/)
 console.log('Three report snapshot scenarios passed: cancellation and reassignment during a blocked report remain one coherent old snapshot; a fresh report sees both committed changes; fresh revoked staff read is denied.')
}
