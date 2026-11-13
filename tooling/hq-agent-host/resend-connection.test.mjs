import test from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {readFile} from 'node:fs/promises'
import {authenticatedWorkerFixture,worker,founder,session,root} from './public-repository-db-fixture.mjs'
import {EMAIL_TEST_SENDER,EMAIL_TEST_DOMAIN_ID,emailTestDigest,emailTestConfigured,runApprovedEmailTest,drainApprovedEmailTest} from './worker.mjs'
const env={HQ_RESEND_TEST_ENABLED:'1',HQ_RESEND_SENDING_KEY:'re_synthetic_test_key_not_real',HQ_RESEND_DOMAIN_ID:EMAIL_TEST_DOMAIN_ID,HQ_RESEND_KEY_PERMISSION:'sending_access'}
const message={sender:EMAIL_TEST_SENDER,recipient:'recipient@example.invalid',subject:'Internal connection test',body:'Synthetic Arabic مرحبا test. No customer outreach.'}
async function fixture(){
 const h=await authenticatedWorkerFixture()
 await h.db.exec('reset role')
 await h.db.exec(`insert into hq_private.agent_roster(id,name,role,department_key,manager_id) values('AG-EMAIL-002','Dina','Email Worker','email-lifecycle','AG-EMAIL-001')`)
 await h.db.exec(await readFile(new URL('20261112213000_hq_resend_connection_test.sql',root),'utf8'))
 return h
}
async function prepare(h){await h.as('founder');return h.rpc('hq_email_test_prepare',[message.recipient,message.subject,message.body,randomUUID()])}
async function approve(h,t){await h.as('founder');return h.rpc('hq_email_test_decide',[t.id,t.digest,true])}
const rpcFor=h=>(name,body)=>h.rpc(name,Object.values(body))

test('actual migration: founder preview/approval, fixed worker binding, durable one-send, truthful receipt',async()=>{
 const h=await fixture();let calls=0
 try{
  const t=await prepare(h);assert.equal(t.state,'prepared');assert.equal(t.digest,emailTestDigest(message));assert.equal(t.reservation,undefined)
  await h.as('worker');await assert.rejects(()=>h.rpc('hq_email_test_prepare',[message.recipient,message.subject,message.body,randomUUID()]),/HQ_FOUNDER_REQUIRED/)
  await assert.rejects(()=>h.rpc('hq_email_test_reserve',[worker,t.id]),/HQ_EMAIL_TEST_NOT_AUTHORIZED/)
  await h.as('founder');await assert.rejects(()=>h.rpc('hq_email_test_decide',[t.id,'0'.repeat(64),true]),/HQ_EMAIL_APPROVAL_MISMATCH/)
  await assert.rejects(()=>h.rpc('hq_email_test_reserve',[worker,t.id]),/HQ_WORKER_REQUIRED/)
  await assert.rejects(()=>h.db.query(`update public.hq_email_connection_tests set body='mutated'`),/permission denied/)
  await approve(h,t);await h.as('worker')
  const providerId=randomUUID()
  const result=await runApprovedEmailTest({rpc:rpcFor(h),workerId:worker,id:t.id,env,transport:async(url,options)=>{
   calls++;assert.equal(url,'https://api.resend.com/emails');assert.equal(options.redirect,'error')
   assert.equal(options.headers['Idempotency-Key'],`hq-email-test/${t.id}`)
   assert.deepEqual(JSON.parse(options.body),{from:message.sender,to:[message.recipient],subject:message.subject,text:message.body})
   return Response.json({id:providerId})
  }})
  assert.equal(result.state,'accepted');assert.equal(result.providerAccepted,true);assert.equal(result.delivered,false)
  await assert.rejects(()=>runApprovedEmailTest({rpc:rpcFor(h),workerId:worker,id:t.id,env,transport:()=>{calls++;throw Error('must not run')}}),/HQ_EMAIL_TEST_NOT_AUTHORIZED/)
  assert.equal(calls,1)
  await h.as('founder');assert.equal((await h.rpc('hq_email_test_status',[t.id])).providerId,providerId)
 }finally{await h.db.close()}
})

test('actual migration: uncertain request persists and forbids retries or second test until reconciliation',async()=>{
 const h=await fixture();let calls=0
 try{
  const t=await prepare(h);await approve(h,t);await h.as('worker')
  const result=await runApprovedEmailTest({rpc:rpcFor(h),workerId:worker,id:t.id,env,transport:async()=>{calls++;throw Error('timeout with SECRET must never escape')}})
  assert.equal(result.state,'uncertain');assert.equal(calls,1)
  await assert.rejects(()=>h.rpc('hq_email_test_reserve',[worker,t.id]),/NOT_AUTHORIZED/)
  const next=await prepare(h);await approve(h,next);await h.as('worker')
  await assert.rejects(()=>h.rpc('hq_email_test_reserve',[worker,next.id]),/RECONCILIATION_REQUIRED/)
 }finally{await h.db.close()}
})

test('actual migration: expired/revoked/foreign approvals and foreign worker cannot authorize',async()=>{
 const h=await fixture()
 try{
  const t=await prepare(h);await approve(h,t);await h.rpc('hq_email_test_decide',[t.id,t.digest,false])
  await h.as('worker');await assert.rejects(()=>h.rpc('hq_email_test_reserve',[worker,t.id]),/NOT_AUTHORIZED/)
  const expired=await prepare(h);await approve(h,expired);await h.db.exec('reset role')
  await h.db.query(`update public.hq_email_connection_tests set expires_at=clock_timestamp()-interval '1 second' where id=$1`,[expired.id])
  await h.as('worker');await assert.rejects(()=>h.rpc('hq_email_test_reserve',[worker,expired.id]),/NOT_AUTHORIZED/)
  const good=await prepare(h);await approve(h,good);await h.as('worker')
  await assert.rejects(()=>h.rpc('hq_email_test_reserve',[randomUUID(),good.id]),/HQ_WORKER_REQUIRED/)
  await h.db.exec('reset role');await h.db.query(`select set_config('request.jwt.claims',$1,false)`,[JSON.stringify({sub:randomUUID(),role:'authenticated',session_id:session})]);await h.db.exec('set role authenticated')
  await assert.rejects(()=>h.rpc('hq_email_test_status',[good.id]),/HQ_FOUNDER_REQUIRED/)
  await h.db.exec('reset role');await h.db.query(`update public.hq_founders set revoked_at=clock_timestamp() where user_id=$1`,[founder])
  await h.as('worker');await assert.rejects(()=>h.rpc('hq_email_test_reserve',[worker,good.id]),/APPROVAL_REVOKED/)
 }finally{await h.db.close()}
})

test('missing configuration never reserves; full-access config refused',async()=>{
 let called=0
 for(const config of [{},{...env,HQ_RESEND_KEY_PERMISSION:'full_access'},{...env,HQ_RESEND_DOMAIN_ID:'other'}]){
  assert.equal(emailTestConfigured(config),false)
  await assert.rejects(()=>runApprovedEmailTest({rpc:()=>{called++},workerId:worker,id:randomUUID(),env:config}),/not-configured/)
 }
 assert.equal(called,0)
})

test('tampered recipient/body/sender/digest and expired host permit never call provider',async()=>{
 const id=randomUUID(),base={...message,id,agentId:'AG-EMAIL-002',managerId:'AG-EMAIL-001',state:'reserved',reservation:randomUUID(),idempotencyKey:`hq-email-test/${id}`,expiresAt:new Date(Date.now()+60000).toISOString(),digest:emailTestDigest(message)}
 for(const patch of [{recipient:'someoneelse@example.invalid'},{body:'different'},{sender:'Other <hello@evil.invalid>'},{digest:'0'.repeat(64)},{expiresAt:'2000-01-01'}, {agentId:'AG-CS-002'}, {subject:'injection\r\nBcc:x'}]){
  let calls=0
  const r=await runApprovedEmailTest({workerId:worker,id,env,rpc:async(name,body)=>name==='hq_email_test_reserve'?{...base,...patch}:{state:body.p_state},transport:async()=>{calls++}})
  assert.equal(calls,0);assert.equal(r.state,'uncertain')
 }
})

test('provider rejection, ambiguous HTTP, oversized replies and receipt persistence never retry or leak credentials',async()=>{
 const id=randomUUID(), permit={...message,id,agentId:'AG-EMAIL-002',managerId:'AG-EMAIL-001',state:'reserved',reservation:randomUUID(),idempotencyKey:`hq-email-test/${id}`,expiresAt:new Date(Date.now()+60000).toISOString(),digest:emailTestDigest(message)}
 for(const [response,expected] of [[new Response('',{status:422}),'rejected'],[new Response('',{status:408}),'uncertain'],[new Response('',{status:500}),'uncertain'],[Response.json({id:randomUUID(),large:'x'.repeat(5000)}),'uncertain']]){
  let calls=0;const receipts=[]
  const result=await runApprovedEmailTest({workerId:worker,id,env,rpc:async(name,b)=>name==='hq_email_test_reserve'?permit:(receipts.push(b),{state:b.p_state}),transport:async()=>{calls++;return response}})
  assert.equal(result.state,expected);assert.equal(calls,1);assert.equal(receipts.length,1)
  assert.equal(JSON.stringify(receipts).includes(env.HQ_RESEND_SENDING_KEY),false)
 }
 let calls=0
 await assert.rejects(()=>runApprovedEmailTest({workerId:worker,id,env,rpc:async(name)=>{if(name==='hq_email_test_reserve')return permit;throw Error('write timeout')},transport:async()=>{calls++;return Response.json({id:randomUUID()})}}),/receipt-persistence-required/)
 assert.equal(calls,1)
})

test('actual SQL rejects altered duplicate request and disabled employee; readiness is observed not inferred',async()=>{
 const h=await fixture()
 try{
  await h.as('founder');const key=randomUUID()
  const t=await h.rpc('hq_email_test_prepare',[message.recipient,message.subject,message.body,key])
  assert.equal((await h.rpc('hq_email_test_prepare',[message.recipient,message.subject,message.body,key])).id,t.id)
  await assert.rejects(()=>h.rpc('hq_email_test_prepare',[message.recipient,message.subject,'changed',key]),/REQUEST_CONFLICT/)
  const initial=await h.rpc('hq_email_test_readiness',[]);assert.equal(initial.configured,false);assert.equal(initial.providerTested,false)
  await assert.rejects(()=>h.rpc('hq_email_test_readiness',[worker,true]),/WORKER_REQUIRED/)
  await approve(h,t);await h.db.exec('reset role');await h.db.exec("update hq_private.agent_roster set enabled=false where id='AG-EMAIL-002'")
  await h.as('worker');await assert.rejects(()=>h.rpc('hq_email_test_reserve',[worker,t.id]),/BINDING_REQUIRED/)
  const ready=await h.rpc('hq_email_test_readiness',[worker,true]);assert.equal(ready.configured,true);assert.equal(ready.credentialScopeVerified,false)
  await h.db.exec('reset role');await h.db.exec("update hq_private.email_test_host_readiness set observed_at=clock_timestamp()-interval '16 minutes'")
  await h.as('founder');assert.equal((await h.rpc('hq_email_test_readiness',[])).configured,false)
 }finally{await h.db.close()}
})

test('new signed worker pair preserves predecessor pairs and exact module; drift fails closed',async()=>{
 const h=await fixture()
 try{
  await h.db.exec('reset role')
  const old=[{workerSourceDigest:'7096b79833132b46cefbe464738a9f3671acbd29666e7dcbc8c3761573783c40',moduleSha256:'bd27db64a57f547c608dc552a25fa7196d33bf908392da82659e91941c1a1976'},{workerSourceDigest:'d768ee8a7ed2717c8fd1dbf09d0159b9aca0607b14f95e5608d5ea5980439ce9',moduleSha256:'bd27db64a57f547c608dc552a25fa7196d33bf908392da82659e91941c1a1976'},{workerSourceDigest:'ba4a8a2323f088dbadec551710896247dddec6e4863ac1a49eff8711a74ba572',moduleSha256:'ee1485139fca3bff250c72266b269a4261d0097852437eb353f3f8e3099b8e58'}]
  await h.db.exec(`create function hq_private.repository_worker_pairs_v2() returns jsonb language sql immutable security invoker set search_path='' as $$select '${JSON.stringify(old)}'::jsonb$$`)
  const sql=await readFile(new URL('20261113070000_hq_resend_test_worker_compatibility.sql',root),'utf8')
  await h.db.exec(sql)
  const pairs=(await h.db.query('select hq_private.repository_worker_pairs_v2() p')).rows[0].p
  assert.deepEqual(pairs.slice(0,3),old)
  assert.deepEqual(pairs[3],{
   workerSourceDigest:'48113a2f9ebd58252cbd05975ca22ad3dea1e35d6cabc8e59152945d04134440',
   moduleSha256:'ee1485139fca3bff250c72266b269a4261d0097852437eb353f3f8e3099b8e58',
  })
  await assert.rejects(()=>h.db.exec(sql),/PREDECESSOR_MISMATCH/);await h.db.exec('rollback')
 }finally{await h.db.close()}
})

test('founder approval wakes existing host drain; admission/missing key block send without manual operator',async()=>{
 const h=await fixture();let calls=0
 try{
  const t=await prepare(h);await approve(h,t)
  await h.db.exec('reset role');assert.ok((await h.db.query("select count(*)::int n from realtime.messages where event='jobs' and topic='hq-agent-jobs'")).rows[0].n>0)
  await h.as('founder');await assert.rejects(()=>h.rpc('hq_email_test_next',[worker]),/WORKER_REQUIRED/)
  await h.as('worker')
  const args={rpc:rpcFor(h),workerId:worker,env,transport:async()=>{calls++;return Response.json({id:randomUUID()})}}
  assert.equal(await drainApprovedEmailTest({...args,env:{}}),false);assert.equal(calls,0)
  assert.equal(await drainApprovedEmailTest({...args,admitting:()=>false}),false);assert.equal(calls,0)
  assert.equal(await drainApprovedEmailTest(args),true);assert.equal(calls,1)
  assert.equal(await drainApprovedEmailTest(args),false);assert.equal(calls,1)
 }finally{await h.db.close()}
})

test('database admission pause rejects direct reservation and automatic drain; duplicate contenders obtain one permit',async()=>{
 const h=await fixture();let calls=0
 try{
  const t=await prepare(h);await approve(h,t);await h.db.exec('reset role')
  await h.db.query("select hq_private.set_worker_admission_pause($1,true,0,$2,'Synthetic email pause')",[worker,randomUUID()])
  await h.as('worker');await assert.rejects(()=>h.rpc('hq_email_test_reserve',[worker,t.id]),/HQ_ADMISSION_PAUSED/)
  await assert.rejects(()=>drainApprovedEmailTest({rpc:rpcFor(h),workerId:worker,env,transport:async()=>{calls++}}),/HQ_ADMISSION_PAUSED/)
  assert.equal(calls,0)
  await h.db.exec('reset role');await h.db.query("select hq_private.set_worker_admission_pause($1,false,1,$2,'Synthetic email resume')",[worker,randomUUID()])
  await h.as('worker')
  const outcomes=await Promise.allSettled([h.rpc('hq_email_test_reserve',[worker,t.id]),h.rpc('hq_email_test_reserve',[worker,t.id])])
  assert.equal(outcomes.filter(x=>x.status==='fulfilled').length,1);assert.equal(outcomes.filter(x=>x.status==='rejected').length,1)
  // This is a PGlite serialized-contender check, not a native parallel-session proof.
  const source=await readFile(new URL('./worker.mjs',import.meta.url),'utf8')
  assert.ok(source.includes("requireValue(!process.argv.includes('--email-test'), 'email-test-use-founder-approval')"))
 }finally{await h.db.close()}
})
