import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {spawn,spawnSync} from 'node:child_process'
import {randomBytes,randomUUID} from 'node:crypto'
const container=process.env.SHOP_WEBSITE_TEST_CONTAINER??'supabase_db_building-suit-shop'
assert.ok(['supabase_db_building-suit-shop','shop_website_disposable'].includes(container),'Known disposable Shop backend required')
const args=['exec','-i',container,'psql','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-Atq']
function sql(input){const r=spawnSync('docker',args,{input,encoding:'utf8'});assert.equal(r.status,0,r.stderr);return r.stdout.trim()}
function asyncSql(input){return new Promise(resolve=>{const p=spawn('docker',args);let output='',error='';p.stdout.on('data',v=>output+=v);p.stderr.on('data',v=>error+=v);p.on('close',code=>resolve({code,output,error}));p.stdin.end(input)})}
const suite=readFileSync(new URL('../../apps/shop-suit/supabase/tests/shop_public_booking.sql',import.meta.url),'utf8')
for(const name of ['shop_appointments.sql','ss-web-appt-access-001-obligation-4.test.sql','shop_customer_portal.sql'])sql('BEGIN;'+readFileSync(new URL('../../apps/shop-suit/supabase/tests/'+name,import.meta.url),'utf8')+'ROLLBACK;')
sql('BEGIN;'+suite+'ROLLBACK;')
// Committed synthetic fixtures are necessary for separate concurrent connections;
// they persist only in this explicitly disposable backend, never hosted projects.
const prefix=suite.slice(0,suite.indexOf('do $$declare f record;g record;'))
const raceSetup=`
create temporary table booking_race(saved_token text,target uuid,target_reference uuid,other_customer uuid,source_appointment uuid);
do $$declare f record;b record;credential jsonb;session jsonb;r jsonb;start_time timestamptz;other uuid;begin
 select * into b from booking_fixture order by shop limit 1;select * into f from access_fixture where shop=b.shop;
 perform set_config('request.jwt.claim.sub',f.actor::text,true);
 credential:=public.appointment_access_issue(f.shop,f.appointment);session:=public.appointment_access_verify(b.slug,credential->>'code','01000000000');
 start_time:=(public.appointment_booking_slots(b.slug,b.service,b.location,b.staff,current_date+6)->'slots'->0->>'startsAt')::timestamptz;
 r:=public.appointment_booking_command(b.slug,session->>'token','create',repeat('d',64),null,b.service,b.location,b.staff,start_time);
 assert r->>'ok'='true','Saved-customer race target created';
 other:=public.save_customer(f.shop,null,'Concurrent other customer','01000000000',null,null,null);
 insert into booking_race select session->>'token',appointment_id,(r->>'reference')::uuid,other,f.appointment from public.appointment_booking_references where reference=(r->>'reference')::uuid;
end$$;`
const rows=sql('BEGIN;'+prefix+raceSetup+`select jsonb_build_object('shop',b.shop,'slug',b.slug,'service',b.service,'location',b.location,'staff',b.staff,'guestToken',b.token,'guestReference',b.reference,'savedToken',race.saved_token,'target',race.target,'targetReference',race.target_reference,'otherCustomer',race.other_customer,'sourceAppointment',race.source_appointment,'actor',w.actor,'member',(select id from public.shop_memberships where shop_id=b.shop and role='owner'),'serviceId',w.service,'start',public.appointment_booking_slots(b.slug,b.service,b.location,b.staff,current_date+5)->'slots'->0->>'startsAt') from booking_fixture b join website_catalog_fixture w on w.shop=b.shop cross join booking_race race order by b.shop limit 1;COMMIT;`)
const f=JSON.parse(rows.split('\n').find(v=>v.startsWith('{')))
const requestKey=()=>randomBytes(32).toString('hex')
const create=(start,phone)=>`select public.appointment_booking_command('${f.slug}',null,'create','${requestKey()}',null,'${f.service}','${f.location}','${f.staff}','${start}','Concurrent guest','${phone}');`
const staff=start=>`select set_config('request.jwt.claim.sub','${f.actor}',true);select public.save_appointment('${randomUUID()}','${f.shop}',null,'${f.location}','${f.member}','${f.serviceId}','${start}','walk_in',null,'Concurrent staff',null,null);`
async function race(firstCommand,secondCommand,waitFragment){
 const first=spawn('docker',args);let output='',error='';first.stdout.on('data',v=>output+=v);first.stderr.on('data',v=>error+=v);const done=new Promise(resolve=>first.on('close',resolve));first.stdin.write('BEGIN;'+firstCommand+"select 'RESERVATION_READY';\n")
 try{
  const deadline=Date.now()+10000;while(!output.includes('RESERVATION_READY')){assert.ok(Date.now()<deadline,error||'Reservation did not acquire its lock');await new Promise(r=>setTimeout(r,20))}
  assert.ok(!output.includes('"ok": false'),'First booking must succeed')
  const second=asyncSql(secondCommand)
  const until=Date.now()+10000;while(sql(`select count(*) from pg_stat_activity where wait_event_type='Lock' and query like '%${waitFragment}%' and pid<>pg_backend_pid()`)==='0'){assert.ok(Date.now()<until,'Competitor did not reach a real database lock');await new Promise(r=>setTimeout(r,20))}
  first.stdin.end('COMMIT;\n');assert.equal(await done,0,error)
  const loser=await second;assert.equal(loser.code,0,loser.error);assert.equal(JSON.parse(loser.output.trim().split('\n').at(-1)).ok,false)
 }finally{if(first.exitCode===null)first.stdin.end('ROLLBACK;\n')}
}
await race(create(f.start,'+201000000010'),create(f.start,'+201000000011'),'appointment_booking_command')
assert.equal(sql(`select count(*) from public.appointments where shop_id='${f.shop}' and starts_at='${f.start}' and status='booked'`),'1')
const next=new Date(Date.parse(f.start)+7200000).toISOString()
await race(staff(next),create(next,'+201000000012'),'appointment_booking_command')
assert.equal(sql(`select count(*) from public.appointments where shop_id='${f.shop}' and starts_at='${next}' and status='booked'`),'1')
const targetStart=sql(`select starts_at from public.appointments where id='${f.target}'`)
const reassign=`select set_config('request.jwt.claim.sub','${f.actor}',true);select public.save_appointment('${randomUUID()}','${f.shop}','${f.target}','${f.location}','${f.member}','${f.serviceId}','${targetStart}','customer','${f.otherCustomer}',null,null,null);`
await race(reassign,`select public.appointment_booking_command('${f.slug}','${f.savedToken}','cancel','${requestKey()}','${f.targetReference}');`,'appointment_booking_command')
assert.equal(sql(`select status from public.appointments where id='${f.target}' and client_id='${f.otherCustomer}'`),'booked')
const revoke=`select set_config('request.jwt.claim.sub','${f.actor}',true);select public.appointment_access_revoke('${f.shop}','${f.sourceAppointment}');`
await race(revoke,`select public.appointment_booking_command('${f.slug}','${f.savedToken}','create','${requestKey()}',null,'${f.service}','${f.location}','${f.staff}','${new Date(Date.parse(f.start)+86400000+7200000).toISOString()}');`,'appointment_booking_command')
console.log('Booking SQL scope/privacy/policy/idempotency/reminder invariants passed. Real public/public and staff/public conflicts preserve one reservation; concurrent customer reassignment and credential revocation deny stale authority after lock waits.')
