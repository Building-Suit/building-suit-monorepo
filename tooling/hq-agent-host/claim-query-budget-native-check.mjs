/** Native sessions only on the fixed, fresh CI container. Never accepts a DSN. */
import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { performance } from 'node:perf_hooks'
import { setTimeout as delay } from 'node:timers/promises'
import { preparedWorker, setFutureWorker, repositoryFixture, founder, session, workerUser, workerSession, worker } from './public-repository-db-fixture.mjs'
import { verify, evidence, agent, skill, predicate, prepareQueuedTrial, observeClaim } from './claim-query-budget-checks.mjs'
import { tenWorkerFixture,verifyStatusProjection } from './trial-status-projection-checks.mjs'
const require=createRequire(new URL('../../package.json',import.meta.url))
const { Client }=require('pg')
const clients=[]
async function connect(name){
 const db=new Client({host:'127.0.0.1',port:5432,database:'hq_claim_budget_disposable',user:'postgres',password:'disposable-only',application_name:name,connectionTimeoutMillis:5000,query_timeout:25000,statement_timeout:20000})
 await db.connect();clients.push(db);return db
}
async function as(db,who){
 await db.query('reset role')
 await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify(who==='worker'?{sub:workerUser,role:'authenticated',session_id:workerSession}:{sub:founder,role:'authenticated',session_id:session})])
 await db.query('set role authenticated')
}
async function until(fn){
 const deadline=Date.now()+10000
 while(Date.now()<deadline){const result=await fn();if(result)return result;await delay(25)}
 assert.fail('both independent sessions must enter observed PostgreSQL relation lock waits')
}
test('native concurrent status and claim retain snapshot freshness and lock behavior',{timeout:180000},async t=>{
 // Disconnect active sessions on any failure: the server rolls back held locks.
 t.after(async()=>{await Promise.all(clients.map(db=>db.end().catch(()=>{})))})
 const prepared=await preparedWorker();setFutureWorker(prepared);t.after(()=>prepared.close())
 const db=await connect('hq-plan-installer')
 const adapter={query:(...args)=>db.query(...args),exec:sql=>db.query(sql),close:async()=>{}}
 const f=await repositoryFixture({database:adapter}),{h}=f
 await prepareQueuedTrial(f)
 await verify(h)
 await tenWorkerFixture(f)
 const sample=async()=>{
  const times={statusMs:[],claimMs:[]};let claimed
  for(let i=0;i<3;i++){
   await h.as('founder');let start=performance.now();await h.rpc('hq_workforce_trial_status');times.statusMs.push(performance.now()-start)
   start=performance.now();claimed=await observeClaim(f);times.claimMs.push(performance.now()-start)
  }
  return {times,claimed}
 }
 const baseline=await sample()
 await verifyStatusProjection(h,{report:value=>t.diagnostic(JSON.stringify({projection:value}))})
 const candidate=await sample()
 assert.deepEqual(candidate.claimed,baseline.claimed)
 t.diagnostic(JSON.stringify({engine:'native PostgreSQL',observationsOnly:true,baseline:baseline.times,candidate:candidate.times}))
 await db.query('reset role')
 const preserved=await evidence(db)
 const status=await connect('hq-plan-status'),claimer=await connect('hq-plan-claim'),hold=await connect('hq-plan-lock'),observer=await connect('hq-plan-observer')
 const pid=async c=>(await c.query('select pg_backend_pid() pid')).rows[0].pid
 const pids=[await pid(status),await pid(claimer)]
 const fresh=async(expected)=>{
  assert.equal((await db.query(predicate,[agent,skill])).rows[0].value,expected)
  await as(status,'founder')
  const projected=(await status.query('select public.hq_workforce_trial_status() result')).rows[0].result.find(row=>row.agentId===agent)
  assert.equal(projected.qualified,expected,'assembled status observes committed binding freshness')
  assert.equal(projected.ordinary.qualified,expected)
  assert.equal(projected.repository.freezeEligible,expected)
 }
 for(let i=0;i<7;i++)await fresh(true)
 // Warmed plan observes committed changes, does not see another session's dirty
 // update, and sees rollback restoration. No result or transaction snapshot cache.
 await hold.query('begin')
 await hold.query("update hq_private.brain_files set source_version='2' where file_id='synthetic_developer_profile_2'")
 await fresh(true)
 await hold.query('commit');await fresh(false)
 await hold.query('begin')
 await hold.query("update hq_private.brain_files set source_version='1' where file_id='synthetic_developer_profile_2'")
 await fresh(false)
 await hold.query('rollback');await fresh(false)
 await hold.query("update hq_private.brain_files set source_version='1' where file_id='synthetic_developer_profile_2'")
 await fresh(true)
 const queue=async()=>(await db.query('select id,status,started_at,worker_id,lease_token from public.hq_agent_jobs order by id')).rows
 const beforeQueue=await queue()
 // Bounded realistic overlap: four tabs, office observations and a rolled-back
 // claim. Keep the actual 8s cap; timings are observations, never a relaxed SLA.
 const tabs=await Promise.all(Array.from({length:4},(_,i)=>connect('hq-status-tab-'+i)))
 const office=await connect('hq-status-office')
 for(const client of [...tabs,office]){await as(client,'founder');await client.query("set statement_timeout='8s'")}
 await as(claimer,'worker');await claimer.query("set statement_timeout='8s'")
 const observations=[]
 for(let round=0;round<3;round++){
  await claimer.query('begin')
  try{
   const start=performance.now()
   const replies=await Promise.all([
    ...tabs.map(client=>client.query('select public.hq_workforce_trial_status() result')),
    office.query('select public.hq_office_observations() result'),
    claimer.query('select public.hq_worker_repository_claim($1,300,1) result',[worker]),
   ])
   for(const response of replies.slice(0,4))assert.equal(response.rows[0].result.length,10)
   assert.equal(replies[5].rows[0].result.job.agent_id,agent)
   observations.push(performance.now()-start)
  }finally{await claimer.query('rollback')}
 }
 t.diagnostic(JSON.stringify({tenWorkerConcurrentBatchMs:observations,concurrentSessions:6,statementTimeoutMs:8000}))
 assert.deepEqual(await queue(),beforeQueue)

 await as(status,'founder');await as(claimer,'worker')
 await status.query('begin');await claimer.query('begin')
 await hold.query('begin; lock table hq_private.agent_roster in access exclusive mode')
 // Attach rejection handlers immediately so timeout/failure cannot escape teardown.
 const reads=Promise.all([
  status.query('select public.hq_workforce_trial_status() result'),
  claimer.query('select public.hq_worker_repository_claim($1,300,1) result',[worker]),
 ]);reads.catch(()=>{})
 const waiting=await until(async()=>{
  const rows=(await observer.query(`select a.pid,a.wait_event_type,l.mode,pg_blocking_pids(a.pid) blockers
   from pg_stat_activity a join pg_locks l on l.pid=a.pid
   where a.pid=any($1::int[]) and a.wait_event_type='Lock' and not l.granted
   and l.relation='hq_private.agent_roster'::regclass`,[pids])).rows
  return new Set(rows.filter(r=>r.blockers.length).map(r=>r.pid)).size===2 ? rows : false
 })
 assert.equal(waiting.length,2)
 await hold.query('rollback')
 const [statusResult,claimResult]=await reads
 assert.ok(statusResult.rows[0].result)
 assert.equal(claimResult.rows[0].result.job.context.mode,'worker-trial')
 assert.equal(claimResult.rows[0].result.job.agent_id,agent)
 await status.query('rollback');await claimer.query('rollback')
 assert.deepEqual(await queue(),beforeQueue,'rolled-back concurrent claim preserves queue and lease')
 assert.deepEqual(await evidence(db),preserved,'concurrency does not rewrite immutable evidence')
 await fresh(true)
})
