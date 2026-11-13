/** Disposable PostgreSQL queue contract; no inference, hosted writes or outreach. */
import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {randomUUID} from 'node:crypto'
import {repositoryFixture,preparedWorker,setFutureWorker,worker,root} from './public-repository-db-fixture.mjs'

test('opt-in cap two, per-employee FIFO, dependency handoff, serial rollback and authorization',async()=>{
 const prepared=await preparedWorker();setFutureWorker(prepared);let h
 try {
  ({h}=await repositoryFixture());await h.db.exec('reset role')
  for(const file of ['20261109024147_hq_repository_worker_compatibility.sql','20261110165424_hq_repository_review_planning.sql','20261111020000_hq_repository_worker_compatibility_v2.sql']) await h.db.exec(await readFile(new URL(file,root),'utf8'))
  await h.db.exec(await readFile(new URL('20261112140052_hq_bounded_employee_parallelism.sql',root),'utf8'))
  // All ordinary fixtures below use actual claim/context/lease guards. They do
  // not grant qualifications or skip claim wrappers to simulate success.
  await h.as('founder');await h.rpc('hq_send_ceo_message',['Internal queue fixture',randomUUID()])
  await h.db.exec('reset role')
  const seed=(await h.db.query(`select * from public.hq_agent_jobs where status='queued' order by created_at desc limit 1`)).rows[0]
  await h.db.query(`update public.hq_agent_jobs set status='blocked',error='fixture-cleanup',completed_at=clock_timestamp() where status='queued'`)
  const ids=Array.from({length:5},()=>randomUUID())
  const agents=['AG-HR-001','AG-HR-001','AG-CEO-001','AG-RES-001','AG-HR-001']
  for(let i=0;i<ids.length;i++) {
   const message=randomUUID();await h.db.query(`insert into public.hq_agent_messages(id,conversation_id,agent_id,role,text) values($1,$2,'AG-CEO-001','founder','Internal queue test')`,[message,seed.conversation_id]);
   await h.db.query(`insert into public.hq_agent_jobs(id,conversation_id,founder_message_id,founder_user_id,agent_id,request_key,kind,depends_on,created_at)
   values($1,$2,$3,$4,$5,$6,'conversation-hr',$7,clock_timestamp()-interval '1 minute'+$8*interval '1 second')`,
   [ids[i],seed.conversation_id,message,seed.founder_user_id,agents[i],randomUUID(),i===4?ids[2]:null,i])
  }
  await h.as('worker');const status=await h.rpc('hq_worker_release_status',[worker]);assert.equal(status.parallelClaims,1);assert.equal(status.parallelCapacity,2)
  await h.as('founder');await assert.rejects(()=>h.rpc('hq_worker_parallel_claim',[worker,300,1]),/HQ_WORKER_REQUIRED/)
  await h.as('worker');await assert.rejects(()=>h.db.query('insert into hq_private.parallel_claim_requests values(txid_current(),$1)',[worker]),/permission denied/)
  const claim=async()=>{await h.as('worker');return h.rpc('hq_worker_parallel_claim',[worker,300,1])}
  const first=(await claim()).job;assert.equal(first.id,ids[0])
  assert.equal((await h.rpc('hq_worker_repository_claim',[worker,300,1])).job,null,'old host stays serial')
  const second=(await claim()).job;assert.equal(second.id,ids[2],'skip busy employee, take oldest independent job')
  const full=await claim();assert.equal(full.job,null);assert.ok(full.next_wake_at)
  assert.equal((await h.rpc('hq_worker_staffing_claim',[worker])).job,null,'staffing remains exclusive')
  await h.db.exec('reset role');assert.equal((await h.db.query('select count(*)::int n from hq_private.parallel_claim_requests')).rows[0].n,0)
  await assert.rejects(()=>h.db.query(`update public.hq_agent_jobs set status='working',worker_id=$1,lease_token=gen_random_uuid(),lease_expires_at=clock_timestamp()+interval '5 minutes',started_at=clock_timestamp() where id=$2`,[worker,ids[1]]),/hq_agent_single_active_agent/)
  // Complete through the real lease-token endpoint, not a status shortcut.
  await h.finish(first,'Synthetic internal response')
  assert.equal((await claim()).job.id,ids[1],'same employee proceeds to next queued task')
  await assert.rejects(()=>h.finish({...second,lease_token:randomUUID()},'Wrong token'),/HQ_.*LEASE|HQ_.*JOB/)
  await h.db.exec('reset role');const running=(await h.db.query(`select id from public.hq_agent_jobs where status='working'`)).rows
  assert.equal(running.length,2)
  const hr=(await h.db.query(`select * from public.hq_agent_jobs where id=$1`,[ids[1]])).rows[0]
  await h.finish(hr,'Next task finished')
  assert.equal((await claim()).job.id,ids[3],'dependent job cannot start before parent completion')
  await h.finish(second,'Dependency result')
  assert.equal((await claim()).job.id,ids[4],'dependent handoff unlocks after completion')
 }finally{await h?.db.close();await prepared.close()}
})
