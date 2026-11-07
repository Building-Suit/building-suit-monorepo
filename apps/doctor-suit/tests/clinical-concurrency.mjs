import assert from 'node:assert/strict'
import {spawn,spawnSync} from 'node:child_process'
import {snapshot,id} from './clinical-fixtures.mjs'
/** Real transactions inside the caller's uniquely owned disposable database. */
export async function verifyClinicalConcurrency(container){
 const args=['exec','-i',container,'psql','-h','127.0.0.1','-U','postgres','-v','ON_ERROR_STOP=1','-At']
 const sql=input=>{const r=spawnSync('docker',args,{input,encoding:'utf8',timeout:15000});assert.equal(r.status,0,r.stderr);return r.stdout.trim()}
 const uid=n=>id(900000+n),practice=n=>id(901000+n),location=n=>id(902000+n),patient=n=>id(903000+n),grant=n=>id(904000+n),key=n=>id(905000+n)
 const claim=n=>`set role authenticated;select set_config('request.jwt.claims','{"sub":"${uid(n)}","session_id":"${uid(10+n)}","role":"authenticated"}',false);`
 for(const n of [1,2])sql(`insert into auth.users(id,email,email_confirmed_at)values('${uid(n)}','synthetic-clinical-race-${n}@example.test',now());insert into auth.sessions(id,user_id)values('${uid(n+10)}','${uid(n)}');insert into public.doctor_profiles(user_id,display_name)values('${uid(n)}','Synthetic clinical race');insert into public.practices(id,owner_user_id,name)values('${practice(n)}','${uid(n)}','Synthetic clinical race');insert into public.locations(id,practice_id,name,timezone)values('${location(n)}','${practice(n)}','Synthetic clinic','Etc/UTC');insert into public.patient_identities(id)values('${patient(n)}');insert into public.practice_patients(id,practice_id,patient_identity_id,display_name,created_location_id,created_by)values('${patient(n)}','${practice(n)}','${patient(n)}','Synthetic patient','${location(n)}','${uid(n)}');insert into doctor_private.clinical_fixture_grants(id,practice_id,location_id,user_id,capabilities,purpose,evidence_ref,policy_version,valid_until)values('${grant(n)}','${practice(n)}','${location(n)}','${uid(n)}',array['read','draft','review','sign','release','export'],'synthetic_fixture','owned clinical race','synthetic-engineering-v1',clock_timestamp()+interval '1 hour');`)
 const command=(n,e,v,action,input,k)=>`${claim(n)}select public.doctor_clinical_command('${practice(n)}','${location(n)}',${e?`'${e}'`:'null'},${v??'null'},'${action}','${JSON.stringify(input).replaceAll("'","''")}'::jsonb,'${key(k)}');`
 const json=output=>JSON.parse(output.split('\n').findLast(line=>line.startsWith('{')))
 const create=n=>json(sql(command(n,null,null,'create',{patient_id:patient(n),snapshot:snapshot()},n))).encounter_id
 const encounter=create(1),other=create(2)
 const review=()=>{const v=json(sql(`${claim(1)}select public.doctor_clinical_detail('${practice(1)}','${location(1)}','${encounter}');`)).versions[0];return{reviewed_version_id:v.id,reviewed_sha256:v.snapshot_sha256}}
 function start(input,open=false){const child=spawn('docker',args,{stdio:['pipe','pipe','pipe']});let output='',errors='';child.stdout.on('data',v=>{output+=v});child.stderr.on('data',v=>{errors+=v});const done=new Promise(resolve=>child.on('close',status=>resolve({status,output,errors})));child.stdin.write(input);if(!open)child.stdin.end();return{child,done,output:()=>output}}
 async function until(check){const end=Date.now()+10000;while(!check()){if(Date.now()>end)throw new Error('Clinical race handshake timed out');await new Promise(resolve=>setTimeout(resolve,25))}}
 async function race(n,a,b){const first=start(`begin;${a}\n\\echo clinical_transaction_held\n`,true);let second
  try{await until(()=>first.output().includes('clinical_transaction_held'));second=start(`set application_name='doctor_clinical_race_${n}';${b}`);await until(()=>sql(`select exists(select 1 from pg_stat_activity where application_name='doctor_clinical_race_${n}' and wait_event='advisory');`)==='t');first.child.stdin.end('commit;\n\\q\n');const left=await first.done,right=await second.done;assert.equal(left.status,0,left.errors);return{left,right}}
  finally{for(const process of [first,second])if(process&&process.child.exitCode===null)process.child.kill('SIGTERM')}
 }
 sql(command(1,encounter,1,'start',{},10));const checked=review()
 const replay=await race(1,command(1,encounter,2,'finalize',checked,11),command(1,encounter,2,'finalize',checked,11));assert.equal(replay.right.status,0,replay.right.errors);assert.equal(sql(`select count(*)from public.clinical_events where encounter_id='${encounter}'and action='finalize';`),'1')
 const amend=await race(2,command(1,encounter,3,'amend',{reason:'Synthetic amendment'},12),command(1,encounter,3,'amend',{reason:'Competing synthetic amendment'},13));assert.notEqual(amend.right.status,0);assert.match(amend.right.errors,/DOCTOR_CLINICAL_CONFLICT/)
 const oldReview=review();sql(command(1,encounter,4,'save',{snapshot:snapshot()},14));const stale=await start(command(1,encounter,5,'finalize',oldReview,15)).done;assert.notEqual(stale.status,0);assert.match(stale.errors,/DOCTOR_CLINICAL_REVIEW_CONFLICT/)
 const held=`select pg_advisory_xact_lock(hashtextextended('${practice(1)}',1));`
 const revoke=await race(3,held+`update doctor_private.clinical_fixture_grants set revoked_at=clock_timestamp()where id='${grant(1)}';`,command(1,encounter,5,'save',{snapshot:snapshot()},16));assert.notEqual(revoke.right.status,0);assert.match(revoke.right.errors,/DOCTOR_CLINICAL_UNAVAILABLE/)
 sql(`update doctor_private.clinical_fixture_grants set revoked_at=null where id='${grant(1)}';`)
 const signout=await race(4,held+`delete from auth.sessions where id='${uid(11)}';`,command(1,encounter,5,'save',{snapshot:snapshot()},17));assert.notEqual(signout.right.status,0);assert.match(signout.right.errors,/DOCTOR_AUTH_REQUIRED/)
 sql(`insert into auth.sessions(id,user_id)values('${uid(11)}','${uid(1)}');`)
 const first=start(`begin;${held}\n\\echo clinical_independent_held\n`,true);let second
 try{await until(()=>first.output().includes('clinical_independent_held'));second=start(command(2,other,1,'start',{},18));let timer;try{const result=await Promise.race([second.done,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Independent practice globally blocked')),10000)})]);assert.equal(result.status,0,result.errors)}finally{clearTimeout(timer)}first.child.stdin.end('commit;\n\\q\n');assert.equal((await first.done).status,0)}finally{for(const process of [first,second])if(process&&process.child.exitCode===null)process.child.kill('SIGTERM')}
 const isolation=await start(`begin isolation level repeatable read;${command(1,encounter,5,'save',{snapshot:snapshot()},20)}rollback;`).done;assert.notEqual(isolation.status,0);assert.match(isolation.errors,/DOCTOR_CLINICAL_ISOLATION_REQUIRED/)
 sql(command(1,encounter,5,'finalize',review(),21));
 sql(`insert into doctor_private.clinical_recipient_grants(practice_id,patient_id,user_id,purpose,valid_until)values('${practice(1)}','${patient(1)}','${uid(2)}','synthetic_fixture',clock_timestamp()+interval '1 hour');`)
 const released=json(sql(command(1,encounter,6,'release',{recipient_user_id:uid(2),expires_at:new Date(Date.now()+3600000).toISOString()},22))).release_id
 const recipientRead=`${claim(2)}select public.doctor_clinical_released('${released}');`
 const recipientSignout=await race(6,held+`delete from auth.sessions where id='${uid(12)}';`,recipientRead);assert.notEqual(recipientSignout.right.status,0);assert.match(recipientSignout.right.errors,/DOCTOR_AUTH_REQUIRED/)
 sql(`insert into auth.sessions(id,user_id)values('${uid(12)}','${uid(2)}');`)
 const recipientIsolation=await start(`begin isolation level repeatable read;${recipientRead}rollback;`).done;assert.notEqual(recipientIsolation.status,0);assert.match(recipientIsolation.errors,/DOCTOR_CLINICAL_ISOLATION_REQUIRED/)
 const expiry=await race(5,held+`update doctor_private.clinical_fixture_grants set valid_until=clock_timestamp()-interval '1 millisecond'where id='${grant(1)}';`,command(1,encounter,6,'save',{snapshot:snapshot()},19));assert.notEqual(expiry.right.status,0);assert.match(expiry.right.errors,/DOCTOR_CLINICAL_UNAVAILABLE/)
 console.log('Ten clinical transaction scenarios passed: exact finalization replay, amendment CAS, stale reviewed-version hash, post-lock fixture and author SID revocation, independent practices, write and recipient snapshot-isolation rejection, recipient SID revocation after lock wait and database-clock grant expiry')
}
