/** Fixed fresh PostgreSQL 17.11 container only. No DSN or connection overrides. */
import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { performance } from 'node:perf_hooks'
import { setTimeout as delay } from 'node:timers/promises'
import {
 verifyRepositoryWorkerCompatibilityV2,verifySqlFirstProductionWorker,
} from './repository-worker-compatibility-v2-checks.mjs'

// Each case runs in its own fresh container: fixture roles are cluster-wide.
// This enum selects test evidence only; every connection property stays fixed.
const selected=process.env.HQ_REPOSITORY_COMPATIBILITY_CASE
assert.ok(['v1','historical'].includes(selected),'select exactly v1 or historical synthetic evidence')
const require=createRequire(new URL('../../package.json',import.meta.url))
const {Client}=require('pg')
const database='hq_repository_compatibility_v2_disposable'
const clients=new Set()
async function connect(name){
 const client=new Client({
  host:'127.0.0.1',port:5432,database,user:'postgres',password:'disposable-only',
  application_name:name,ssl:false,connectionTimeoutMillis:5000,query_timeout:25000,statement_timeout:20000,
 })
 await client.connect();clients.add(client);return client
}
async function close(client){await client.end();clients.delete(client)}

async function verifyQueueLockTimeout(sql,report){
 const holder=await connect('hq-repository-v2-lock-holder')
 const contender=await connect('hq-repository-v2-lock-contender')
 const observer=await connect('hq-repository-v2-lock-observer')
 let pending
 try{
  const holderPid=(await holder.query('select pg_backend_pid() pid')).rows[0].pid
  const contenderPid=(await contender.query('select pg_backend_pid() pid')).rows[0].pid
  assert.notEqual(holderPid,contenderPid)
  const originalLockTimeout=(await contender.query('show lock_timeout')).rows[0].lock_timeout
  await holder.query('begin')
  await holder.query("select pg_advisory_xact_lock(hashtextextended('hq-agent-queue',0))")
  const started=performance.now();let settled=false
  // The exact migration supplies BEGIN and its unchanged five-second timeout.
  pending=contender.query(sql).then(
   ()=>{settled=true;return{ok:true}},
   error=>{settled=true;return{ok:false,code:error.code,message:error.message}},
  )
  let blocked
  const deadline=performance.now()+3000
  while(performance.now()<deadline&&!settled){
   const row=(await observer.query(`select wait_event_type,wait_event,pg_blocking_pids(pid) blockers
    from pg_stat_activity where pid=$1 and datname=current_database()`,[contenderPid])).rows[0]
   if(row?.wait_event_type==='Lock'&&row.wait_event==='advisory'&&row.blockers.includes(holderPid)){
    blocked=row;break
   }
   await delay(25)
  }
  assert.ok(blocked,'observe the exact migration waiting on the held queue advisory lock')
  assert.equal(settled,false,'migration cannot pass the queue fence while its lock is held')
  const result=await pending
  assert.equal(result.ok,false,'the unchanged migration lock timeout must reject contention')
  assert.equal(result.code,'55P03','require native lock_not_available, not a client or statement timeout')
  assert.match(result.message,/lock timeout/)
  await contender.query('rollback')
  assert.equal((await contender.query('show lock_timeout')).rows[0].lock_timeout,originalLockTimeout,
   'the transaction-local timeout does not leak after refusal')
  assert.equal((await contender.query('show statement_timeout')).rows[0].statement_timeout,'20s')
  report({engine:'PostgreSQL 17.11',case:selected,observedWait:blocked.wait_event,errorCode:result.code,
   elapsedMs:performance.now()-started,lockTimeoutMs:5000,timingsAreObservations:true})
 }finally{
  // Even an assertion failure releases the holder and rolls back the contender.
  await holder.query('rollback').catch(()=>{})
  await pending?.catch(()=>{})
  await contender.query('rollback').catch(()=>{})
  await Promise.all([holder,contender,observer].map(close))
 }
}

test(`native exact-pair v2 preserves ${selected} evidence, qualifications and atomic lock refusal`,{timeout:140000},async t=>{
 t.after(async()=>{await Promise.all([...clients].map(client=>client.end().catch(()=>{})))})
 await verifySqlFirstProductionWorker()
 const client=await connect('hq-repository-v2-installer')
 const identity=(await client.query(`select current_database() name,current_user username,
  host(inet_server_addr()) address,current_setting('server_version_num') version,
  to_regnamespace('hq_private') private_schema,to_regnamespace('auth') auth_schema,
  to_regnamespace('extensions') extensions_schema,to_regnamespace('realtime') realtime_schema,
  (select count(*)::int from pg_roles where rolname in ('anon','authenticated','service_role')) fixture_roles,
  (select count(*)::int from pg_class c join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='public' and c.relkind in ('r','p','v','m','S','f')) public_relations`)).rows[0]
 assert.deepEqual(identity,{
  name:database,username:'postgres',address:'127.0.0.1',version:'170011',
  private_schema:null,auth_schema:null,extensions_schema:null,realtime_schema:null,
  fixture_roles:0,public_relations:0,
 },'initialize only the exact fresh disposable PostgreSQL 17.11 database and cluster')
 const adapter={query:(...args)=>client.query(...args),exec:sql=>client.query(sql),close:async()=>{}}
 await verifyRepositoryWorkerCompatibilityV2({
  database:adapter,historical:selected==='historical',
  testStep:(name,run)=>t.test(name,run),report:value=>t.diagnostic(value),
  beforeApply:({sql})=>verifyQueueLockTimeout(sql,value=>t.diagnostic(JSON.stringify(value))),
 })
 // Shared checks prove timeout atomicity, normal apply, semantic parity, all
 // qualification outcomes and rollback using the same SQL on both engines.
 assert.equal((await client.query('show lock_timeout')).rows[0].lock_timeout,'0')
 assert.equal((await client.query('show statement_timeout')).rows[0].statement_timeout,'20s')
})
