/** Fixed fresh PostgreSQL 17.11 container only. No DSN or connection overrides. */
import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { performance } from 'node:perf_hooks'
import { setTimeout as delay } from 'node:timers/promises'
import { verifyRetailAssignmentContext } from './retail-assignment-context-checks.mjs'

const require=createRequire(new URL('../../package.json',import.meta.url))
const {Client}=require('pg')
const database='hq_retail_assignment_disposable'
const clients=new Set()
async function connect(name){
 const client=new Client({
  host:'127.0.0.1',port:5432,database,user:'postgres',password:'disposable-only',
  application_name:name,ssl:false,connectionTimeoutMillis:5000,query_timeout:25000,statement_timeout:20000,
 })
 await client.connect();clients.add(client);return client
}
async function close(client){await client.end();clients.delete(client)}

async function verifyQueueLockTimeout(sql,report,{observerFault=false}={}){
 const holder=await connect('hq-retail-assignment-lock-holder')
 const contender=await connect('hq-retail-assignment-lock-contender')
 const observer=await connect('hq-retail-assignment-lock-observer')
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
  if(observerFault)throw new Error('synthetic observer failure while migration is blocked')
  const result=await pending
  assert.equal(result.ok,false,'the unchanged migration lock timeout must reject contention')
  assert.equal(result.code,'55P03','require native lock_not_available, not a client or statement timeout')
  assert.match(result.message,/lock timeout/)
  await contender.query('rollback')
  assert.equal((await contender.query('show lock_timeout')).rows[0].lock_timeout,originalLockTimeout,
   'the transaction-local timeout does not leak after refusal')
  assert.equal((await contender.query('show statement_timeout')).rows[0].statement_timeout,'20s')
  report({engine:'PostgreSQL 17.11',observedWait:blocked.wait_event,errorCode:result.code,
   elapsedMs:performance.now()-started,lockTimeoutMs:5000,timingsAreObservations:true})
 }finally{
  // Keep the holder locked until the bounded pending migration has refused.
  // Releasing it first could let the migration COMMIT after an observer failure.
  try {
   if(pending){
    const result=await pending
    assert.equal(result.ok,false,'cleanup must not release a still-running migration')
    assert.equal(result.code,'55P03','cleanup retains the queue fence until native lock timeout')
   }
  } finally {
   await contender.query('rollback').catch(()=>{})
   await holder.query('rollback').catch(()=>{})
   await Promise.all([holder,contender,observer].map(close))
  }
 }
}

test('native bounded retail assignment and atomic lock refusal',{timeout:160000},async t=>{
 t.after(async()=>{await Promise.all([...clients].map(client=>client.end().catch(()=>{})))})
 const client=await connect('hq-retail-assignment-installer')
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
 await verifyRetailAssignmentContext({
  database:adapter,
  beforeApply:async({sql})=>{
   await assert.rejects(()=>verifyQueueLockTimeout(sql,()=>{},{observerFault:true}),
    /synthetic observer failure while migration is blocked/)
   t.diagnostic('Observer-failure cleanup retained the queue fence until lock timeout.')
   await verifyQueueLockTimeout(sql,value=>t.diagnostic(JSON.stringify(value)))
  },
 })
 // Shared checks prove timeout atomicity, normal apply, semantic parity, all
 // qualification outcomes and rollback using the same SQL on both engines.
 assert.equal((await client.query('show lock_timeout')).rows[0].lock_timeout,'0')
 assert.equal((await client.query('show statement_timeout')).rows[0].statement_timeout,'20s')
})
