// Owned disposable SQL CI only: real persisted RPC interleavings, no real patients/money.
import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
export async function verifyPracticeMoneyConcurrency(container) {
 const args = ['exec','-i',container,'psql','-h','127.0.0.1','-U','postgres','-v','ON_ERROR_STOP=1','-At']
 const id = n => `d2071700-0000-4000-8000-${String(n).padStart(12,'0')}`
 function sql(input) { const r = spawnSync('docker',args,{ input,encoding:'utf8' }); assert.equal(r.status,0,'Owned practice billing SQL failed'); return r.stdout.trim() }
 const claim = n => `set role authenticated;select set_config('request.jwt.claims','${JSON.stringify({sub:id(n),session_id:id(n+10),role:'authenticated'})}',false);`
 const literal = v => v === null ? 'null' : `'${v}'`
 const price = (n,key,service=null,revision=0,minor='29900') => `${claim(n)}select public.doctor_write_service_price('${id(n+20)}','${id(n+40)}',${literal(service)},${revision},'Synthetic service','${minor}','EGP',2,'${id(key)}');`
 function latest(n) { return JSON.parse(sql(`select json_build_object('id',id,'service',service_id,'revision',revision)from public.doctor_service_price_versions where practice_id='${id(n+20)}'order by revision desc limit 1;`)) }
 const charge = (n,priceId,key,quantity=1,chargeId=null,revision=0) => `${claim(n)}select public.doctor_write_visit_charge('${id(n+20)}','${id(n+40)}','${id(n+100)}',1,'${id(n+80)}','${priceId}',${quantity},${literal(chargeId)},${revision},'Synthetic attributable charge','${id(key)}');`
 function start(input,open=false) {
  const child=spawn('docker',args,{stdio:['pipe','pipe','pipe']});let output='',errors=''
  child.stdout.on('data',v=>{output+=v});child.stderr.on('data',v=>{errors+=v})
  const done=new Promise(resolve=>child.once('close',status=>resolve({status,errors})))
  child.stdin.write(input);if(!open)child.stdin.end();return{child,done,output:()=>output}
 }
 async function until(check) { const deadline=Date.now()+10000;while(!check()){if(Date.now()>deadline)throw Error('Practice billing transaction handshake timed out');await new Promise(r=>setTimeout(r,25))} }
 async function race(number,firstSql,secondSql) {
  const first=start(`begin;${firstSql}\n\\echo practice_money_held\n`,true);let second
  try {
   await until(()=>first.output().includes('practice_money_held'))
   second=start(`set application_name='doctor_money_wait_${number}';${secondSql}`)
   await until(()=>sql(`select count(*)from pg_stat_activity where application_name='doctor_money_wait_${number}'and wait_event_type='Lock'and wait_event='advisory';`)==='1')
   first.child.stdin.end('commit;\n\\q\n');const a=await first.done,b=await second.done;assert.equal(a.status,0,'First owned billing transaction failed');return b
  }finally{for(const p of[first,second])if(p&&!p.child.killed&&p.child.exitCode===null)p.child.kill('SIGTERM')}
 }
 const actors=[1,2,3,4,5,6,7,8]
 sql(`insert into auth.users(id,email,email_confirmed_at)values${actors.map(n=>`('${id(n)}','synthetic-practice-money-race-${n}@example.test',now())`).join(',')};
 insert into auth.sessions(id,user_id)values${actors.map(n=>`('${id(n+10)}','${id(n)}')`).join(',')};
 insert into public.doctor_candidate_admissions(user_id,purpose,evidence_ref,valid_until)values${actors.map(n=>`('${id(n)}','synthetic_fixture','disposable-practice-money-race:${n}',clock_timestamp()+interval'2 hours')`).join(',')};
 insert into public.doctor_profiles(user_id,display_name)values${actors.map(n=>`('${id(n)}','Synthetic billing doctor ${n}')`).join(',')};
 insert into public.practices(id,owner_user_id,name)values${actors.map(n=>`('${id(n+20)}','${id(n)}','Synthetic billing practice ${n}')`).join(',')};
 insert into public.locations(id,practice_id,name,timezone)values${actors.map(n=>`('${id(n+40)}','${id(n+20)}','Synthetic billing clinic ${n}','Etc/UTC')`).join(',')};
 insert into public.patient_identities(id)values${actors.map(n=>`('${id(n+60)}')`).join(',')};
 insert into public.practice_patients(id,practice_id,patient_identity_id,display_name,created_location_id,created_by)values${actors.map(n=>`('${id(n+80)}','${id(n+20)}','${id(n+60)}','Synthetic billing patient ${n}','${id(n+40)}','${id(n)}')`).join(',')};
 insert into public.appointments(id,practice_id,doctor_user_id,location_id,patient_id,starts_at,ends_at,timezone,location_name,state,created_by,checked_in_at,started_at,completed_at)values${actors.map(n=>`('${id(n+100)}','${id(n+20)}','${id(n)}','${id(n+40)}','${id(n+80)}',now()-interval'1 day',now()-interval'1 day'+interval'20 minutes','Etc/UTC','Synthetic billing clinic ${n}','completed','${id(n)}',now()-interval'1 day',now()-interval'1 day',now()-interval'1 day'+interval'20 minutes')`).join(',')};`)
 const charges=new Map(),collections=new Map()
 function value(input){return JSON.parse(sql(input).split('\n').at(-1))}
 const prepare=(n,key,minor='20000',kind='collection',original=null)=>`${claim(n)}select public.doctor_prepare_practice_payment('${id(n+20)}','${id(n+40)}','${kind}','${charges.get(n).id}',${literal(original)},'${minor}','Synthetic explicit collection/refund','${id(key)}');`
 const advance=(n,intent,revision,action,key,outcome=null)=>`${claim(n)}select public.doctor_advance_practice_payment('${id(n+20)}','${id(n+40)}','${intent}',${revision},'${action}',${literal(outcome)},'${id(key)}');`
 function settledCollection(n,key){const i=value(prepare(n,key,'29900'));value(advance(n,i.id,1,'dispatch',key+1,'accepted'));const result=value(advance(n,i.id,2,'reconcile',key+2));collections.set(n,result.entry);return result.entry}
 for(const n of actors){sql(price(n,300+n));const p=latest(n);charges.set(n,value(charge(n,p.id,320+n)))}
 let r=await race(1,prepare(1,401),prepare(1,402,'10000'))
 assert.notEqual(r.status,0);assert.equal(r.errors.includes('DOCTOR_PRACTICE_OVER_ALLOCATION'),true,'Concurrent collection exceeded unreserved charge')
 assert.equal(sql(`select sum(amount_minor)from public.doctor_practice_payment_intents where practice_id='${id(21)}';`),'20000')
 assert.equal((await race(2,prepare(2,403),prepare(2,403))).status,0,'Duplicate original prepare failed')
 assert.equal(sql(`select count(*)from public.doctor_practice_payment_intents where practice_id='${id(22)}';`),'1')
 let original=settledCollection(3,410)
 r=await race(3,prepare(3,413,'20000','refund',original.id),prepare(3,414,'10000','refund',original.id))
 assert.notEqual(r.status,0);assert.equal(r.errors.includes('DOCTOR_PRACTICE_OVER_REFUND'),true,'Concurrent refunds exceeded original receipt')
 original=settledCollection(4,420);let refund=value(prepare(4,423,'10000','refund',original.id));value(advance(4,refund.id,1,'dispatch',424,'accepted'))
 assert.equal((await race(4,advance(4,refund.id,2,'reconcile',425),advance(4,refund.id,2,'reconcile',425))).status,0,'Duplicate refund reconciliation failed')
 assert.equal(sql(`select count(*)from public.doctor_practice_ledger_entries where original_entry_id='${original.id}';`),'1')
 assert.equal(sql(`select amount_minor from public.doctor_practice_ledger_entries where id='${original.id}';`),'29900')
 const p=latest(5);sql(price(5,430,p.service,1,'10000'));const updated=latest(5)
 r=await race(5,prepare(5,431),charge(5,updated.id,432,1,charges.get(5).charge_id,1))
 assert.notEqual(r.status,0);assert.equal(r.errors.includes('DOCTOR_PRACTICE_ALLOCATED_CHARGE_FLOOR'),true,'Charge correction erased pending allocation')
 const pending=value(prepare(6,440));value(advance(6,pending.id,1,'dispatch',441,'accepted'))
 assert.equal(sql(`select count(*)from public.doctor_practice_ledger_entries where intent_id='${pending.id}';`),'0')
 r=await race(6,`select pg_advisory_xact_lock(hashtextextended('${id(26)}',1));delete from auth.sessions where id='${id(16)}';`,advance(6,pending.id,2,'reconcile',442))
 assert.notEqual(r.status,0);assert.equal(r.errors.includes('DOCTOR_AUTH_REQUIRED'),true,'Post-lock revoked SID posted a ledger entry')
 assert.equal(sql(`select count(*)from doctor_private.synthetic_practice_payment_acceptances where intent_id='${pending.id}';`),'1')
 assert.equal(sql(`select count(*)from public.doctor_practice_ledger_entries where intent_id='${pending.id}';`),'0')
 const one=value(prepare(7,450,'10000')),two=value(prepare(7,451,'9000'))
 value(advance(7,one.id,1,'dispatch',452,'accepted'));value(advance(7,two.id,1,'dispatch',453,'accepted'))
 assert.equal((await race(7,advance(7,one.id,2,'reconcile',454),advance(7,two.id,2,'reconcile',455))).status,0,'Independent collection reconciliation failed')
 assert.equal(sql(`select string_agg(receipt_number::text,','order by receipt_number)from public.doctor_practice_ledger_entries where practice_id='${id(27)}';`),'1,2')
 const cancelled=value(prepare(8,460));value(advance(8,cancelled.id,1,'dispatch',461,'accepted'))
 assert.equal((await race(8,`select pg_advisory_xact_lock(hashtextextended('${id(28)}',1));update public.appointments set state='cancelled',version=version+1 where id='${id(108)}';`,advance(8,cancelled.id,2,'reconcile',462))).status,0,'Cancellation invented loss of an already accepted result')
 assert.equal(sql(`select amount_minor from public.doctor_practice_ledger_entries where intent_id='${cancelled.id}';`),'20000')
 assert.equal(sql(`select count(*)from public.doctor_practice_ledger_entries where practice_id='${id(28)}'and kind='refund';`),'0')
 assert.equal(sql(`select count(*)from doctor_private.command_receipts where command_key in('${id(402)}','${id(414)}','${id(432)}','${id(442)}');`),'0')
 console.log('Eight practice money transactions passed: bounded concurrent allocations/refunds, duplicate prepare, single original-linked reversal, charge allocation floor, revoked SID after lock wait, scoped receipt sequences and cancelled-visit acceptance reconciliation; no external money transport or live financial approval.')
}
