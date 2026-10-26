// Owned disposable SQL CI only: real persisted RPC interleavings, no real patients/money.
import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
export async function verifyPracticeBillingConcurrency(container) {
 const args = ['exec','-i',container,'psql','-h','127.0.0.1','-U','postgres','-v','ON_ERROR_STOP=1','-At']
 const id = n => `d2061600-0000-4000-8000-${String(n).padStart(12,'0')}`
 function sql(input) { const r = spawnSync('docker',args,{ input,encoding:'utf8' }); assert.equal(r.status,0,'Owned practice billing SQL failed'); return r.stdout.trim() }
 const claim = n => `set role authenticated;select set_config('request.jwt.claims','${JSON.stringify({sub:id(n),session_id:id(n+10),role:'authenticated'})}',false);`
 const literal = v => v === null ? 'null' : `'${v}'`
 const price = (n,key,service=null,revision=0,minor='29900') => `${claim(n)}select public.doctor_write_service_price('${id(n+20)}','${id(n+40)}',${literal(service)},${revision},'Synthetic service','${minor}','EGP',2,'${id(key)}');`
 function latest(n) { return JSON.parse(sql(`select json_build_object('id',id,'service',service_id,'revision',revision)from public.doctor_service_price_versions where practice_id='${id(n+20)}'order by revision desc limit 1;`)) }
 const charge = (n,priceId,key,quantity=1,chargeId=null,revision=0) => `${claim(n)}select public.doctor_write_visit_charge('${id(n+20)}','${id(n+40)}','${id(n+100)}','${priceId}',${quantity},${literal(chargeId)},${revision},'Synthetic attributable charge','${id(key)}');`
 function start(input,open=false) {
  const child=spawn('docker',args,{stdio:['pipe','pipe','pipe']});let output='',errors=''
  child.stdout.on('data',v=>{output+=v});child.stderr.on('data',v=>{errors+=v})
  const done=new Promise(resolve=>child.once('close',status=>resolve({status,errors})))
  child.stdin.write(input);if(!open)child.stdin.end();return{child,done,output:()=>output}
 }
 async function until(check) { const deadline=Date.now()+10000;while(!check()){if(Date.now()>deadline)throw Error('Practice billing transaction handshake timed out');await new Promise(r=>setTimeout(r,25))} }
 async function race(number,firstSql,secondSql) {
  const first=start(`begin;${firstSql}\n\\echo practice_billing_held\n`,true);let second
  try {
   await until(()=>first.output().includes('practice_billing_held'))
   second=start(`set application_name='doctor_billing_wait_${number}';${secondSql}`)
   await until(()=>sql(`select count(*)from pg_stat_activity where application_name='doctor_billing_wait_${number}'and wait_event_type='Lock'and wait_event='advisory';`)==='1')
   first.child.stdin.end('commit;\n\\q\n');const a=await first.done,b=await second.done;assert.equal(a.status,0,'First owned billing transaction failed');return b
  }finally{for(const p of[first,second])if(p&&!p.child.killed&&p.child.exitCode===null)p.child.kill('SIGTERM')}
 }
 const actors=[1,2,3,4,5,6]
 sql(`insert into auth.users(id,email,email_confirmed_at)values${actors.map(n=>`('${id(n)}','synthetic-practice-billing-race-${n}@example.test',now())`).join(',')};
 insert into auth.sessions(id,user_id)values${actors.map(n=>`('${id(n+10)}','${id(n)}')`).join(',')};
 insert into public.doctor_candidate_admissions(user_id,purpose,evidence_ref,valid_until)values${actors.map(n=>`('${id(n)}','synthetic_fixture','disposable-practice-billing-race:${n}',clock_timestamp()+interval'2 hours')`).join(',')};
 insert into public.doctor_profiles(user_id,display_name)values${actors.map(n=>`('${id(n)}','Synthetic billing doctor ${n}')`).join(',')};
 insert into public.practices(id,owner_user_id,name)values${actors.map(n=>`('${id(n+20)}','${id(n)}','Synthetic billing practice ${n}')`).join(',')};
 insert into public.locations(id,practice_id,name,timezone)values${actors.map(n=>`('${id(n+40)}','${id(n+20)}','Synthetic billing clinic ${n}','Etc/UTC')`).join(',')};
 insert into public.patient_identities(id)values${actors.map(n=>`('${id(n+60)}')`).join(',')};
 insert into public.practice_patients(id,practice_id,patient_identity_id,display_name,created_location_id,created_by)values${actors.map(n=>`('${id(n+80)}','${id(n+20)}','${id(n+60)}','Synthetic billing patient ${n}','${id(n+40)}','${id(n)}')`).join(',')};
 insert into public.appointments(id,practice_id,doctor_user_id,location_id,patient_id,starts_at,ends_at,timezone,location_name,state,created_by,checked_in_at,started_at,completed_at)values${actors.map(n=>`('${id(n+100)}','${id(n+20)}','${id(n)}','${id(n+40)}','${id(n+80)}',now()-interval'1 day',now()-interval'1 day'+interval'20 minutes','Etc/UTC','Synthetic billing clinic ${n}','completed','${id(n)}',now()-interval'1 day',now()-interval'1 day',now()-interval'1 day'+interval'20 minutes')`).join(',')};`)
 assert.equal((await race(1,price(1,201),price(1,201))).status,0,'Original price receipt retry failed')
 assert.equal(sql(`select count(*)from public.doctor_service_price_versions where practice_id='${id(21)}';`),'1')
 for(const n of[2,3,4,5,6])sql(price(n,200+n))
 let p=latest(2),r=await race(2,price(2,212,p.service,1,'40000'),price(2,213,p.service,1,'50000'))
 assert.notEqual(r.status,0);assert.equal(r.errors.includes('DOCTOR_BILLING_VERSION_CONFLICT'),true,'Stale price writer accepted')
 p=latest(3);r=await race(3,price(3,214,p.service,1,'40000'),charge(3,p.id,215))
 assert.notEqual(r.status,0);assert.equal(r.errors.includes('DOCTOR_BILLING_VERSION_CONFLICT'),true,'Old price selected during concurrent edit')
 assert.equal(sql(`select count(*)from public.doctor_visit_charge_versions where practice_id='${id(23)}';`),'0')
 p=latest(4);sql(charge(4,p.id,216));const original=JSON.parse(sql(`select json_build_object('id',id,'charge',charge_id)from public.doctor_visit_charge_versions where practice_id='${id(24)}';`))
 r=await race(4,charge(4,p.id,217,2,original.charge,1),charge(4,p.id,218,3,original.charge,1))
 assert.notEqual(r.status,0);assert.equal(r.errors.includes('DOCTOR_BILLING_VERSION_CONFLICT'),true,'Stale correction writer accepted')
 assert.equal(sql(`select count(*)from public.doctor_visit_charge_versions where charge_id='${original.charge}';`),'2')
 assert.equal(sql(`select amount_minor from public.doctor_visit_charge_versions where id='${original.id}';`),'29900')
 p=latest(5);r=await race(5,`select pg_advisory_xact_lock(hashtextextended('${id(25)}',1));delete from auth.sessions where id='${id(15)}';`,charge(5,p.id,219))
 assert.notEqual(r.status,0);assert.equal(r.errors.includes('DOCTOR_AUTH_REQUIRED'),true,'Post-lock SID revocation bypassed')
 p=latest(6);r=await race(6,`${claim(6)}select public.doctor_archive_location('${id(26)}','${id(46)}',1,'${id(220)}');`,charge(6,p.id,221))
 assert.notEqual(r.status,0);assert.equal(r.errors.includes('DOCTOR_BILLING_ACTIVE_LOCATION_REQUIRED'),true,'Archived location accepted a new charge')
 assert.equal(sql(`select count(*)from doctor_private.command_receipts where command_key in('${id(213)}','${id(215)}','${id(218)}','${id(219)}','${id(221)}');`),'0')
 console.log('Six practice billing transactions passed: exact receipt replay, stale price writer, price/charge race, immutable correction race, post-lock session revocation and actual clinic archive versus charge; no live collection or tax approval.')
}
