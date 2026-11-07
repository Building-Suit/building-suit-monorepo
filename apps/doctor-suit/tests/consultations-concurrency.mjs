import{spawn,spawnSync}from'node:child_process'
import{once}from'node:events'
import assert from'node:assert/strict'
export async function verifyConsultationConcurrency(container){
 const args=['exec','-i',container,'psql','-h','127.0.0.1','-U','postgres','-X','-qAt','-v','ON_ERROR_STOP=1']
 function sql(input){const r=spawnSync('docker',args,{input,encoding:'utf8'});assert.equal(r.status,0,r.stderr);return r.stdout.trim()}
 const id=n=>`c3f10000-0000-4000-8000-${String(n).padStart(12,'0')}`
 const claim=`set role authenticated;set request.jwt.claims='{"sub":"${id(1)}","session_id":"${id(2)}","role":"authenticated"}';`
 const day="((clock_timestamp()at time zone'Etc/UTC')::date+8)"
 const type=duration=>`jsonb_build_object('name','Synthetic race type','duration_minutes',${duration},'buffer_before',10,'buffer_after',10,'capacity',1,'location_ids',jsonb_build_array('${id(4)}','${id(5)}'),'active',true)`
 function run(input){const p=spawn('docker',args,{stdio:['pipe','pipe','pipe']});let out='',err='';p.stdout.on('data',d=>out+=d);p.stderr.on('data',d=>err+=d);p.stdin.end(input);return{p,done:once(p,'exit').then(([code])=>({code,out,err}))}}
 const book=(key,location,minute=600)=>`${claim}select public.doctor_book_consultation('${id(3)}','${id(location)}','${id(7)}',${day},${minute},1,1,'${id(key)}','${id(8)}',1);`
 sql(`insert into auth.users(id,email,email_confirmed_at)values('${id(1)}','synthetic-type-race@example.test',now());insert into auth.sessions(id,user_id)values('${id(2)}','${id(1)}');insert into public.doctor_profiles(user_id,display_name)values('${id(1)}','Synthetic type race');insert into public.practices(id,owner_user_id,name)values('${id(3)}','${id(1)}','Synthetic race');insert into public.locations(id,practice_id,name,timezone)values('${id(4)}','${id(3)}','Synthetic A','Etc/UTC'),('${id(5)}','${id(3)}','Synthetic B','Etc/UTC');insert into public.patient_identities(id)values('${id(6)}');insert into public.practice_patients(id,practice_id,patient_identity_id,display_name,created_location_id,created_by)values('${id(7)}','${id(3)}','${id(6)}','Synthetic race patient','${id(4)}','${id(1)}');`)
 for(const n of[4,5])sql(`${claim}select public.doctor_write_schedule('${id(3)}','${id(n)}',0,jsonb_build_object('slot_minutes',10,'weekly',(select jsonb_agg(jsonb_build_object('weekday',d,'start',540,'end',1080))from generate_series(0,6)d),'exceptions','[]'::jsonb),'${id(n+20)}',1);`)
 sql(`${claim}select public.doctor_write_consultation_type('${id(3)}','${id(4)}','${id(8)}',0,${type(30)},'${id(30)}');`)
 const a=run(book(31,4)),b=run(book(32,5));const results=await Promise.all([a.done,b.done]);assert.equal(results.filter(r=>r.code===0).length,1);assert.match(results.find(r=>r.code!==0).err,/DOCTOR_APPOINTMENT_CONFLICT/)
 // A legacy booking at the buffer boundary competes with a typed interval.
 const typed=run(book(33,4,800)),legacy=run(`${claim}select public.doctor_book_appointment('${id(3)}','${id(5)}','${id(7)}',${day},790,1,1,'${id(34)}');`)
 const mixed=await Promise.all([typed.done,legacy.done]);assert.equal(mixed.filter(r=>r.code===0).length,1)
 // Hold configuration's real transaction open; booking queues on the same lock.
 const writer=run(`${claim}begin;select public.doctor_write_consultation_type('${id(3)}','${id(4)}','${id(8)}',1,${type(60)},'${id(35)}');select 'ready';select pg_sleep(1.5);commit;`)
 await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Configuration barrier absent')),5000);writer.p.stdout.on('data',d=>{if(String(d).includes('ready')){clearTimeout(timer);resolve()}})})
 const queued=run(book(36,5,1000));assert.equal((await writer.done).code,0);const stale=await queued.done;assert.notEqual(stale.code,0);assert.match(stale.err,/DOCTOR_AVAILABILITY_CONFLICT/)
 // A waiting command must recheck the actual Auth session after the lock.
 const blocker=run(`begin;select pg_advisory_xact_lock(hashtextextended('${id(3)}',1));select 'ready';select pg_sleep(1.5);delete from auth.sessions where id='${id(2)}';commit;`)
 await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Session barrier absent')),5000);blocker.p.stdout.on('data',d=>{if(String(d).includes('ready')){clearTimeout(timer);resolve()}})})
 const revoked=run(book(37,5,1000));assert.equal((await blocker.done).code,0);const denial=await revoked.done;assert.notEqual(denial.code,0);assert.match(denial.err,/DOCTOR_(ACCESS_DENIED|SESSION_INVALID|SESSION_REQUIRED|AUTH_REQUIRED)/)
 console.log('Four M3 scheduling transaction scenarios passed: cross-clinic typed capacity, mixed legacy/buffer race, queued stale configuration and post-lock session revocation')
}
