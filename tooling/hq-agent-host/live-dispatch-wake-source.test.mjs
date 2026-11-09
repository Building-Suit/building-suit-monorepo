/** Fast source-only adaptive producer test. No scheduler emulation or activation. */
import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { setup,asWorker,enqueue,worker } from './live-dispatch-native-fixture.mjs'
import { deliverWorkerEntry } from './worker.mjs'
const require=createRequire(new URL('../../apps/company-hq/package.json',import.meta.url))
const { PGlite }=require('@electric-sql/pglite')
test('adaptive source compiles and real claim/finish append with no cron schema',async()=>{
  const pg=new PGlite()
  const db={query:async(sql,args)=>{
    sql=sql.replace('create extension pg_cron;','')
    return args?pg.query(sql,args):(await pg.exec(sql)).at(-1)
  }}
  const scalar=async(sql,args)=>(await db.query(sql,args)).rows[0]
  try {
    await setup(db)
    await db.query(await readFile(new URL('./proposed-migrations/hq_live_dispatch.sql',import.meta.url),'utf8'))
    await db.query("update hq_private.live_dispatch_state set circuit_open=true,last_error='attempts-exhausted'")
    await db.query(await readFile(new URL('./proposed-migrations/hq_live_dispatch_adaptive.sql',import.meta.url),'utf8'))
    assert.deepEqual(await scalar('select circuit_open,last_error,jobs_circuit_open,jobs_last_error from hq_private.live_dispatch_state'),{circuit_open:true,last_error:'attempts-exhausted',jobs_circuit_open:false,jobs_last_error:null})
    assert.equal((await scalar("select to_regnamespace('cron') scheduler")).scheduler,null)
    // Fail rather than silently tolerate any remaining synchronous transport.
    await db.query(`create or replace function realtime.send(payload jsonb,event text,topic text,private boolean default true)
      returns void language plpgsql as $$begin raise exception 'FIXTURE_SYNCHRONOUS_TRANSPORT' using errcode='57014'; end$$;`)

    const state=(await scalar('select to_jsonb(s) value from hq_private.live_dispatch_state s')).value
    const id=await enqueue(db)
    await asWorker(db)
    const job=(await scalar('select public.hq_worker_repository_claim($1,300,1) result',[worker])).result.job
    assert.equal(job.id,id)
    const writes=[],entry={version:3,job:{id:job.id,lease_token:job.lease_token},phase:'finished',reply:'Synthetic finished conversation.',error:null,evidence:[]}
    const result=await deliverWorkerEntry({workerId:worker,retryWait:async()=>{},write:async value=>writes.push(value),
      rpc:async(name,input)=>(await scalar(`select public.${name}(${Object.values(input).map((_,i)=>'$'+(i+1)).join(',')}) result`,
        Object.values(input).map(value=>value!==null&&typeof value==='object'?JSON.stringify(value):value))).result},entry)
    assert.equal(result.accepted,true); assert.ok(!result.discarded)
    assert.equal(writes.length,1); assert.equal(writes[0].phase,'delivered'); assert.deepEqual(writes[0].job,entry.job)
    await db.query('reset role')
    assert.deepEqual((await scalar('select to_jsonb(s) value from hq_private.live_dispatch_state s')).value,state)
    assert.equal((await scalar('select status from public.hq_agent_jobs where id=$1',[id])).status,'completed')
    assert.ok((await scalar('select count(*)::int n from hq_private.live_invalidations where format_version in (2,3) and delivered_at is null')).n>=2)
    assert.ok((await scalar("select count(*)::int n from hq_private.live_invalidations where format_version=3 and event='jobs' and kind='agents' and payload='{}'")).n>=1)
    for(const [kind,payload] of [['company','{}'],['agents','{"topic":"hq-live"}'],['agents',null]]) {
      await assert.rejects(db.query("select hq_private.live_enqueue_v2($1,'jobs',$2)",[kind,payload]),/HQ_INVALID_LIVE_EVENT/)
    }
    await assert.rejects(db.query("insert into hq_private.live_invalidations(kind,event,payload) values('agents','jobs','{}')"),error=>error.code==='23514')
    await assert.rejects(db.query("insert into hq_private.live_invalidations(kind,format_version,event,payload) values('agents',2,'jobs','{}')"),error=>error.code==='23514')
    await assert.rejects(db.query("insert into hq_private.live_invalidations(kind,format_version,event,payload) values('agents',3,'invalidate','{\"kind\":\"agents\"}')"),error=>error.code==='23514')
    const consumer=await readFile(new URL('./worker.mjs',import.meta.url),'utf8')
    assert.ok(consumer.includes("const TOPIC = 'realtime:hq-agent-jobs'"))
    assert.ok(consumer.includes("if (frame.topic !== TOPIC) return"))
    assert.ok(consumer.includes("if (connected && frame.event === 'broadcast') { if (frame.payload?.payload?.kind === 'roster') rosterDirty = true; requestDrain() }"))

    await db.query("update public.hq_agent_jobs set status='blocked',error='fixture-reset',completed_at=clock_timestamp() where status in ('queued','working')")
    const lateId=await enqueue(db)
    await asWorker(db)
    const lateJob=(await scalar('select public.hq_worker_repository_claim($1,300,1) result',[worker])).result.job
    assert.equal(lateJob.id,lateId)
    await assert.rejects(db.query('select public.hq_worker_finish_v4($1,$2,$3,$4,null,$5,null,null)',
      [lateJob.id,randomUUID(),worker,'Synthetic late conversation.','[]']),error=>error.code==='42501')
    await db.query('reset role')
    await db.query("update public.hq_agent_jobs set lease_expires_at=clock_timestamp()-interval '1 second' where id=$1",[lateId])
    await asWorker(db)
    const late=(await scalar('select public.hq_worker_finish_v4($1,$2,$3,$4,null,$5,null,null)',
      [lateJob.id,lateJob.lease_token,worker,'Synthetic late conversation.','[]'])).hq_worker_finish_v4
    assert.equal(late.accepted,true); assert.equal(late.discarded,true)
    await db.query('reset role')
    for(const role of ['anon','authenticated','service_role']) {
      assert.equal((await scalar("select has_function_privilege($1,'hq_private.live_dispatch_watchdog()','EXECUTE') allowed",[role])).allowed,false)
    }
  } finally {await pg.close()}
})
