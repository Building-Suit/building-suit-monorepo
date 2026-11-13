import{spawn,spawnSync}from'node:child_process'
import{once}from'node:events'
import{readFile}from'node:fs/promises'
import assert from'node:assert/strict'
export async function verifyFulfillmentConcurrency(container){
 const args=['exec','-i',container,'psql','-h','127.0.0.1','-U','postgres','-X','-qAt','-v','ON_ERROR_STOP=1'],id=n=>`d308a000-0000-4000-8000-${String(n).padStart(12,'0')}`
 const sql=input=>{const r=spawnSync('docker',args,{input,encoding:'utf8'});assert.equal(r.status,0,r.stderr);return r.stdout.trim()}
 const fixture=(await readFile(new URL('../supabase/tests/fixtures/clinical.sql',import.meta.url),'utf8')).replaceAll('d2020000','d308a000')
 const setup=sql(`begin;${fixture}
 select pg_temp.command('create',jsonb_build_object('patient_id',pg_temp.patient(),'snapshot',jsonb_set(pg_temp.snapshot(),'{orders}',jsonb_build_array(jsonb_build_object('id',pg_temp.id(9000),'kind','lab','request','Synthetic concurrency request','due_at',null,'state','requested','reason','')))),9001);
 select pg_temp.command('start','{}',9002);select pg_temp.command('finalize','{}',9003);
 reset role;update public.memberships set capabilities=array['patients.read','patients.write','documents.read']where id=pg_temp.id(201);update public.membership_locations set capabilities=array['patients.read','patients.write','documents.read']where membership_id=pg_temp.id(201);
 set local role service_role;select pg_temp.put('upload',public.doctor_reserve_document(pg_temp.id(1),pg_temp.id(11),pg_temp.practice(),pg_temp.location(),pg_temp.patient(),'synthetic-race.pdf','application/pdf',128,repeat('e',64),pg_temp.id(9004)));select pg_temp.put('file',public.doctor_finalize_document(pg_temp.id(1),pg_temp.id(11),(pg_temp.v('upload')->>'intent_id')::uuid));
 set local role authenticated;select pg_temp.claim(1);select jsonb_build_object('practice',pg_temp.practice(),'location',pg_temp.location(),'patient',pg_temp.patient(),'encounter',pg_temp.v('encounter')->>'encounter_id','source',pg_temp.detail()->'versions'->0->>'id','document',pg_temp.v('file')->>'version_id');commit;`)
 const f=JSON.parse(setup.split('\n').at(-1));assert(Object.values(f).every(v=>/^[0-9a-f-]{36}$/.test(v)))
 const claim=(staff=false)=>`set role authenticated;set request.jwt.claims='{"sub":"${id(staff?3:1)}","session_id":"${id(staff?13:11)}","role":"authenticated"}';`
 function run(input){const p=spawn('docker',args,{stdio:['pipe','pipe','pipe']});let out='',err='';p.stdout.on('data',d=>out+=d);p.stderr.on('data',d=>err+=d);const done=once(p,'exit').then(([code])=>({code,out,err}));p.stdin.end(input);return{p,done}}
 const statement=(ver,action,input,key,staff=false)=>claim(staff)+`select public.doctor_fulfillment_command('${f.practice}','${f.location}','${f.patient}','${id(9100)}',${ver},'${action}','${JSON.stringify(input)}','${id(key)}');`
 const create={encounter_id:f.encounter,source_version_id:f.source,order_id:id(9000),source_ref:'Synthetic concurrency source'},request=statement(0,'create',create,9101)
 const same=await Promise.all([run(request).done,run(request).done]);assert(same.every(r=>r.code===0));assert.equal(same[0].out,same[1].out)
 const received={document_version_id:f.document,source_ref:'Synthetic receipt source',source_at:'2026-01-01T10:00:00Z',received_at:'2026-01-02T10:00:00Z'}
 const pair=await Promise.all([run(statement(1,'receive',received,9102,true)).done,run(statement(1,'receive',received,9103,true)).done]);assert.equal(pair.filter(r=>r.code===0).length,1);assert.match(pair.find(r=>r.code!==0).err,/DOCTOR_FULFILLMENT_CONFLICT/)
 const winning=pair[0].code===0?9102:9103;assert.equal(sql(statement(1,'receive',received,winning,true)),pair.find(r=>r.code===0).out.trim());assert.equal(sql(`select count(*)from public.operational_fulfillment_events where practice_id='${f.practice}'and fulfillment_id='${id(9100)}';`),'2')
 assert.equal(sql(`select count(*)from public.operational_fulfillment_documents where practice_id='${f.practice}'and fulfillment_id='${id(9100)}'and review_state='unreviewed';`),'1')
 const lock=run(`begin;select pg_advisory_xact_lock(hashtextextended('${f.practice}',1));update public.memberships set status='revoked',version=version+1 where id='${id(201)}';select 'ready';select pg_sleep(1);commit;`)
 await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Fulfillment transaction barrier absent')),5000);lock.p.stdout.on('data',d=>{if(String(d).includes('ready')){clearTimeout(timer);resolve()}})})
 const denied=run(statement(1,'receive',received,winning,true));assert.equal((await lock.done).code,0);assert.match((await denied.done).err,/DOCTOR_ACCESS_DENIED/)
 assert.equal(sql(`select count(*)from public.clinical_versions where encounter_id='${f.encounter}';`),'3')
 console.log('Four fulfillment transaction scenarios passed: exact duplicate creation, competing receipt CAS, duplicate receipt replay, post-wait revoked replay. One unreviewed file/event; clinical history unchanged.')
}
