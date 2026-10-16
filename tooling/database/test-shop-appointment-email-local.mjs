import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {spawn,spawnSync} from 'node:child_process'
import {randomBytes} from 'node:crypto'
const container=process.env.SHOP_WEBSITE_TEST_CONTAINER??'supabase_db_building-suit-shop'
assert.ok(['supabase_db_building-suit-shop','shop_website_disposable'].includes(container),'Explicit disposable Shop database required')
const args=['exec','-i',container,'psql','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-Atq']
const sql=input=>{const r=spawnSync('docker',args,{input,encoding:'utf8'});assert.equal(r.status,0,r.stderr);return r.stdout.trim()}
const asyncSql=input=>new Promise(resolve=>{const p=spawn('docker',args);let output='',error='';p.stdout.on('data',v=>output+=v);p.stderr.on('data',v=>error+=v);p.on('close',code=>resolve({code,output,error}));p.stdin.end(input)})
const booking=readFileSync(new URL('../../apps/shop-suit/supabase/tests/shop_public_booking.sql',import.meta.url),'utf8').split('do $$declare f record;g record;')[0]
const suite=readFileSync(new URL('../../apps/shop-suit/supabase/tests/shop_appointment_email_reminders.sql',import.meta.url),'utf8')
sql('BEGIN;delete from public.appointment_email_budget;'+booking+suite+'ROLLBACK;')
sql('delete from public.appointment_email_budget;')
const setup=suite.split('do $$declare f record;g record;')[0]
function fixtures(){
 const result=sql('BEGIN;'+booking+setup+`select jsonb_agg(to_jsonb(r)||jsonb_build_object('service',b.service,'location',b.location,'staff',b.staff)) from reminder_fixture r join booking_fixture b on b.shop=r.shop;COMMIT;`)
 return JSON.parse(result.split('\n').find(s=>s.startsWith('[')))
}
function due(f){sql(`update public.appointment_email_outbox set due_at=clock_timestamp()-interval '1 minute' where id='${f.queue}';`)}
const claim=f=>`select public.claim_appointment_email(array['${f.email}']);`
const payload=f=>JSON.stringify({to:[f.email],from:'reminders@building-suit.com',subject:'Synthetic',text:'Synthetic',html:'<p>Synthetic</p>'})
const prepare=(f,lease)=>`select public.prepare_appointment_email('${f.queue}','${lease}','${payload(f)}'::jsonb,array['${f.email}']);`
const row=result=>{assert.equal(result.code,0,result.error);return result.output.trim().split('\n').at(-1)}
async function blockedRace(firstCommand,secondCommand,waitName,{delay=0}={}){
 const first=spawn('docker',args);let output='',error='';first.stdout.on('data',v=>output+=v);first.stderr.on('data',v=>error+=v);const done=new Promise(resolve=>first.on('close',resolve));first.stdin.write('BEGIN;'+firstCommand+"select 'REMINDER_LOCK_READY';\n")
 try{
  const deadline=Date.now()+10000
  while(!output.includes('REMINDER_LOCK_READY')){assert.ok(Date.now()<deadline,error||'first transaction did not reach lock');await new Promise(r=>setTimeout(r,30))}
  if(firstCommand.includes('appointment_booking_command'))assert.match(output,/"ok": true/,`Mutation rejected: ${output}`)
  let early;const second=asyncSql(secondCommand).then(result=>{early=result;return result})
  while(!Number(sql(`select count(*) from pg_stat_activity where datname='postgres' and pid<>pg_backend_pid() and wait_event_type='Lock' and query like '%${waitName}%';`))){assert.ok(!early,`Second completed before contention: ${JSON.stringify(early)}`);assert.ok(Date.now()<deadline,'second transaction did not contend');await new Promise(r=>setTimeout(r,30))}
  if(delay)await new Promise(r=>setTimeout(r,delay))
  first.stdin.end('COMMIT;\n');assert.equal(await done,0,error);return row(await second)
 }finally{if(first.exitCode===null)first.stdin.end('ROLLBACK;\n')}
}
// Two actual sessions compete for one queue row. One lease only, no provider.
{
 const [f]=fixtures();due(f)
 const results=await Promise.all([asyncSql(claim(f)),asyncSql(claim(f))]);assert.equal(results.map(row).filter(Boolean).length,1)
}
// Cancel, reschedule and contact changes that commit after claim but before
// prepare must invalidate the old email. Waiting workers recheck committed state.
for(const operation of ['cancel','reschedule','contact']){
 const [f]=fixtures();due(f);const lease=JSON.parse(sql(claim(f))).leaseToken
 let mutation
 if(operation==='contact')mutation=`update public.clients set email='changed@example.test' where id=(select client_id from public.appointments where id='${f.appointment}');`
 else {
  const next=sql(`select public.appointment_booking_slots('${f.slug}','${f.service}','${f.location}','${f.staff}',current_date+4)->'slots'->0->>'startsAt';`)
  mutation=`select public.appointment_booking_command('${f.slug}','${f.token}','${operation}','${randomBytes(32).toString('hex')}','${f.reference}',${operation==='reschedule'?`'${f.service}','${f.location}','${f.staff}','${next}'`:'null,null,null,null'});`
 }
 assert.equal(await blockedRace(mutation,prepare(f,lease),'prepare_appointment_email'),'')
 assert.equal(sql(`select state from public.appointment_email_outbox where id='${f.queue}';`),'cancelled')
}
// Cross-tenant workers contend for the last global daily allowance. Hold the
// winner beyond the rate gate so the losing prepare must hit the shared budget.
{
 const [a,b]=fixtures();due(a);due(b);const la=JSON.parse(sql(claim(a))).leaseToken,lb=JSON.parse(sql(claim(b))).leaseToken
 sql(`insert into public.appointment_email_budget(bucket,used) values('day:'||to_char(clock_timestamp() at time zone 'UTC','YYYY-MM-DD'),79) on conflict(bucket) do update set used=79;update public.appointment_email_budget set next_claim_at='-infinity' where bucket='rate';`)
 assert.equal(await blockedRace(prepare(a,la),prepare(b,lb),'prepare_appointment_email',{delay:1200}),'')
 assert.equal(sql(`select used from public.appointment_email_budget where bucket='day:'||to_char(clock_timestamp() at time zone 'UTC','YYYY-MM-DD');`),'80')
 assert.equal(sql(`select count(*) from public.appointment_email_outbox where id in ('${a.queue}','${b.queue}') and state='dispatching';`),'1')
}
console.log('Reminder SQL authorization/privacy/consent/leases/retries/allowlist/tenant budgets passed; real worker/worker, cancellation, reschedule, contact-change and cross-tenant global-budget races passed. No provider calls.')
