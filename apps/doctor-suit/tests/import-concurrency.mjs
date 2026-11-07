import{spawn,spawnSync}from'node:child_process'
import{once}from'node:events'
import{readFile}from'node:fs/promises'
import assert from'node:assert/strict'
export async function verifyImportConcurrency(container){
 const args=['exec','-i',container,'psql','-h','127.0.0.1','-U','postgres','-X','-qAt','-v','ON_ERROR_STOP=1'],id=n=>`d309a000-0000-4000-8000-${String(n).padStart(12,'0')}`
 const sql=input=>{const r=spawnSync('docker',args,{input,encoding:'utf8'});assert.equal(r.status,0,r.stderr);return r.stdout.trim()}
 const fixture=(await readFile(new URL('../supabase/tests/fixtures/clinical.sql',import.meta.url),'utf8')).replaceAll('d2020000','d309a000')
 const setup=sql(`begin;${fixture}reset role;update public.memberships set capabilities=array['patients.read','patients.write']where id=pg_temp.id(201);update public.membership_locations set capabilities=array['patients.read','patients.write']where membership_id=pg_temp.id(201);select jsonb_build_object('practice',pg_temp.practice(),'location',pg_temp.location());commit;`),f=JSON.parse(setup.split('\n').at(-1));assert(Object.values(f).every(v=>/^[0-9a-f-]{36}$/.test(v)))
 const claim=(staff=false)=>`set role authenticated;set request.jwt.claims='{"sub":"${id(staff?3:1)}","session_id":"${id(staff?13:11)}","role":"authenticated"}';`
 function run(input){const p=spawn('docker',args,{stdio:['pipe','pipe','pipe']});let out='',err='';p.stdout.on('data',d=>out+=d);p.stderr.on('data',d=>err+=d);const done=once(p,'exit').then(([code])=>({code,out,err}));p.stdin.end(input);return{p,done}}
 const cmd=(version,action,input,key,staff=false)=>claim(staff)+`select public.doctor_import_command('${f.practice}','${f.location}','${id(1000)}',${version},'${action}','${JSON.stringify(input)}','${id(key)}');`
 const rows=Array.from({length:52},(_,i)=>({source_id:`P${i}`,kind:'patient',patient_source_id:null,display_name:`Synthetic resumed person ${i}`,birth_date:'2000-01-01',phone:'',email:'',starts_at:null,state:null})),request=cmd(0,'create',{mapping_version:'patient-appointment-v1',synthetic:true,source_ref:'Synthetic resumable manifest',rows},1001)
 const same=await Promise.all([run(request).done,run(request).done]);assert(same.every(r=>r.code===0));assert.equal(same[0].out,same[1].out)
 const chunk=cmd(1,'next',{limit:1},1002,true),dup=await Promise.all([run(chunk).done,run(chunk).done]);assert(dup.every(r=>r.code===0));assert.equal(dup[0].out,dup[1].out);assert.equal(sql(`select count(*)from public.synthetic_import_rows where batch_id='${id(1000)}';`),'1')
 const pair=await Promise.all([run(cmd(2,'next',{limit:50},1003)).done,run(cmd(2,'next',{limit:50},1004)).done]);assert.equal(pair.filter(r=>r.code===0).length,1);assert.match(pair.find(r=>r.code!==0).err,/DOCTOR_IMPORT_CONFLICT/)
 const interrupted=JSON.parse(sql(claim()+`select public.doctor_import_preview('${f.practice}','${f.location}','${id(1000)}',0);`));assert.equal(interrupted.batch.cursor,51);assert.equal(interrupted.total,51);assert.equal(interrupted.rows.length,20)
 assert.equal(JSON.parse(sql(cmd(3,'next',{limit:50},1005))).cursor,52);assert.equal(JSON.parse(sql(cmd(4,'reconcile',{},1006))).state,'validated');assert.equal(sql(`select count(*)from public.synthetic_import_rows where batch_id='${id(1000)}';`),'52')
 const lock=run(`begin;select pg_advisory_xact_lock(hashtextextended('${f.practice}',1));update public.memberships set status='revoked',version=version+1 where id='${id(201)}';select 'ready';select pg_sleep(1);commit;`)
 await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Import transaction barrier absent')),5000);lock.p.stdout.on('data',d=>{if(String(d).includes('ready')){clearTimeout(timer);resolve()}})})
 const denied=run(chunk);assert.equal((await lock.done).code,0);assert.match((await denied.done).err,/DOCTOR_ACCESS_DENIED/)
 assert.equal(sql(`select count(*)from public.practice_patients where practice_id='${f.practice}';`),'1')
 console.log('Five persisted import transaction scenarios passed: exact manifest replay, duplicate chunk retry, competing cursor CAS, interrupted 51/52-row resume and pagination reconciliation, post-wait revoked replay. Canonical patient count unchanged.')
}
