/** Draft adaptive wake regression. Run ONLY in a fresh disposable native fixture.
 * No URL/credential override, hosted calls, or activation deployment path.
 * Requires the same isolated PostgreSQL+pg_cron image as native-check; do not run
 * both scripts against one database. Production watchdog cadence is asserted
 * independently from any explicitly accelerated disposable scheduler exercise.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { readFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { setTimeout as delay } from 'node:timers/promises'
import { setup, asWorker, enqueue, worker, activationForFixture } from './live-dispatch-native-fixture.mjs'
import { deliverWorkerEntry } from './worker.mjs'
const require=createRequire(new URL('../../package.json',import.meta.url))
const { Client }=require('pg')
const clients=[]
const proposalPath=new URL('./proposed-migrations/hq_live_dispatch_adaptive.sql',import.meta.url)
async function connect(name,user='postgres') {
  assert.ok(['postgres','fixture_admin'].includes(user))
  const db=new Client({host:'127.0.0.1',port:55439,database:'hq_live_dispatch_disposable',user,password:'disposable-only',application_name:name,
    connectionTimeoutMillis:5000,statement_timeout:20000,query_timeout:25000})
  db.on('error',()=>{}) // Termination tests assert the pending query error explicitly.
  await db.connect(); clients.push(db); return db
}
async function one(db,sql,args=[]) { return (await db.query(sql,args)).rows[0] }
async function until(fn,message,timeout=10000) {
  const deadline=Date.now()+timeout
  while(Date.now()<deadline) { const value=await fn(); if(value) return value; await delay(25) }
  assert.fail(message)
}
async function runCase(t,name,fn) {
  let failure
  await t.test(name,async()=>{ try { await fn() } catch(error) { failure=error; throw error } })
  if(failure) throw failure
}
async function withLock(hold,kind,fn) {
  await hold.query('begin')
  try {
    await hold.query(kind==='cron'?'lock table cron.job in access exclusive mode':
      kind==='messages'?'lock table realtime.messages in access exclusive mode':
      kind==='reservation'?'select pg_advisory_xact_lock(926671)':
      'select * from hq_private.live_dispatch_state where singleton for update')
    return await fn()
  } finally { await hold.query('rollback') }
}
async function waitBlocked(admin,victim,holder) {
  return until(async()=>await one(admin,`select a.wait_event_type,a.wait_event,pg_blocking_pids(a.pid) blockers
    from pg_stat_activity a where a.pid=$1 and a.wait_event_type='Lock'
    and $2=any(pg_blocking_pids(a.pid)) and exists(select 1 from pg_locks l where l.pid=a.pid and not l.granted)`,[victim.processID,holder.processID]),
  `No observed PostgreSQL lock wait from ${victim.processID} on ${holder.processID}`)
}
async function rpc(db,name,args) { return (await one(db,`select public.${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) result`,args)).result }
async function claimJob(db) { return (await rpc(db,'hq_worker_repository_claim',[worker,300,1])).job }
const entryFor=job=>({version:3,job:{id:job.id,lease_token:job.lease_token},phase:'finished',reply:'Synthetic finished conversation.',error:null,evidence:[]})
async function finishRpc(db,entry) {
  return rpc(db,'hq_worker_finish_v4',[entry.job.id,entry.job.lease_token,worker,entry.reply,entry.error,JSON.stringify(entry.evidence),null,null])
}
async function deliver(db,entry,writes) {
  return deliverWorkerEntry({workerId:worker,retryWait:async()=>{},write:async value=>writes.push(value),
    rpc:async(name,input)=>rpc(db,name,Object.values(input).map(value=>value!==null&&typeof value==='object'?JSON.stringify(value):value))},entry)
}
async function clearDispatch(admin) {
  await admin.query(`select hq_private.live_dispatch_cancel();
    delete from hq_private.live_invalidations where format_version in (2,3);
    truncate realtime.messages;
    update hq_private.live_dispatch_state set circuit_open=false,last_error=null,due_at=null;`)
  // Explicit disposable case isolation, never automatic application recovery.
  if((await one(admin,"select exists(select 1 from pg_attribute where attrelid='hq_private.live_dispatch_state'::regclass and attname='jobs_circuit_open' and not attisdropped) present")).present) {
    await admin.query('update hq_private.live_dispatch_state set jobs_circuit_open=false,jobs_last_error=null')
  }
}
async function clearPending(admin) {
  // Finish may enqueue synthetic lesson jobs. Retire only disposable pending
  // fixture work so the next scenario claims its own generated conversation.
  await admin.query(`update public.hq_agent_jobs set status='blocked',error='fixture-reset',completed_at=clock_timestamp()
    where status in ('queued','working')`)
}
async function freshJob(admin,workerDb) {
  await clearPending(admin)
  const id=await enqueue(admin)
  const job=await claimJob(workerDb)
  assert.equal(job.id,id); return job
}

test('adaptive wake leaves real claim and finish independent of scheduler locks',{timeout:240000},async t=>{
  t.after(async()=>{await Promise.all(clients.map(db=>db.end().catch(()=>{})))})
  const admin=await connect('hq-wake-admin','fixture_admin')
  assert.equal((await one(admin,"select to_regnamespace('hq_private') present")).present,null,'fresh disposable database required')
  await admin.query("create role postgres login superuser password 'disposable-only'")
  const installer=await connect('hq-wake-installer')
  await setup(installer)
  await admin.query(`create role fixture_provider nologin;
    alter table realtime.messages owner to fixture_provider;
    alter function realtime.send(jsonb,text,text,boolean) owner to fixture_provider;
    grant usage on schema realtime to postgres;
    grant select,insert on realtime.messages to postgres;
    grant execute on function realtime.send(jsonb,text,text,boolean) to postgres;
    grant pg_read_all_settings to postgres;
    alter role postgres nosuperuser bypassrls;`)
  let owner=await connect('hq-wake-owner')
  const rival=await connect('hq-wake-rival'), holder=await connect('hq-wake-holder','fixture_admin'), actor=await connect('hq-wake-actor','fixture_admin')
  assert.deepEqual(await one(owner,"select current_user role,rolsuper,rolbypassrls from pg_roles where rolname=current_user"),{role:'postgres',rolsuper:false,rolbypassrls:true})
  const cronMode=(await one(owner,"select current_setting('cron.use_background_workers') value")).value
  if(process.env.HQ_NATIVE_CRON_MODE) assert.equal(cronMode,process.env.HQ_NATIVE_CRON_MODE)
  t.diagnostic(`Actual adaptive fixture cron mode: ${cronMode}; nominal watchdog60s is separate from accelerated runtime checks`)
  await asWorker(actor)
  const baseline=await activationForFixture(admin)
  await owner.query('begin')
  try {await owner.query(baseline.sql);await owner.query('commit')} catch(error){await owner.query('rollback');throw error}
  for(const kind of ['cron','state']) {
    await runCase(t,`applied560 claim demonstrably waits on ${kind} and cancellation rolls back lease`,async()=>{
      await clearPending(admin)
      const id=await enqueue(admin)
      await clearDispatch(admin) // due_at=null is essential to exercise scheduling.
      await withLock(holder,kind,async()=>{
        const pending=claimJob(actor).then(value=>({value}),error=>({error}))
        await waitBlocked(admin,actor,holder)
        await admin.query('select pg_cancel_backend($1)',[actor.processID])
        assert.equal((await pending).error?.code,'57014')
        assert.deepEqual(await one(admin,'select status,lease_token from public.hq_agent_jobs where id=$1',[id]),{status:'queued',lease_token:null})
      })
      const job=await claimJob(actor); assert.equal(job.id,id)
      await finishRpc(actor,entryFor(job))
    })
    await runCase(t,`applied560 finish demonstrably waits on ${kind} and cancellation preserves exact result journal`,async()=>{
      const job=await freshJob(admin,actor),entry=entryFor(job),original=structuredClone(entry)
      await clearDispatch(admin)
      await withLock(holder,kind,async()=>{
        const pending=finishRpc(actor,entry).then(value=>({value}),error=>({error}))
        await waitBlocked(admin,actor,holder)
        await admin.query('select pg_cancel_backend($1)',[actor.processID])
        assert.equal((await pending).error?.code,'57014')
        assert.deepEqual(await one(admin,'select status,result_digest from public.hq_agent_jobs where id=$1',[job.id]),{status:'working',result_digest:null})
        assert.deepEqual(entry,original)
      })
      await finishRpc(actor,entry)
    })
  }
  let savedOldTickDefinition
  await clearDispatch(admin)
  await runCase(t,'adaptive schema DDL fails bounded and rolls back while an old publisher holds its row',async()=>{
    await admin.query("select hq_private.live_emit('agents')")
    await withLock(holder,'messages',async()=>{
      const pending=owner.query('call hq_private.live_dispatch_tick()').then(value=>({value}),error=>({error}))
      await waitBlocked(admin,owner,holder)
      await admin.query("update cron.job set active=false where jobname='hq-live-once'")
      const catalog=()=>one(admin,`select (select jsonb_agg(jsonb_build_array(conname,pg_get_constraintdef(oid)) order by conname)
        from pg_constraint where conrelid='hq_private.live_invalidations'::regclass) constraints,
        (select jsonb_agg(jsonb_build_array(proname,md5(prosrc)) order by oid) from pg_proc where pronamespace='hq_private'::regnamespace) routines`)
      const before=await catalog()
      await rival.query("begin; set local lock_timeout='250ms'")
      try {await assert.rejects(rival.query(await readFile(proposalPath,'utf8')),error=>error.code==='55P03')}
      finally {await rival.query('rollback')}
      assert.deepEqual(await catalog(),before)
      await holder.query('rollback')
      const result=await pending; if(result.error) throw result.error
    })
  })
  await clearDispatch(admin)
  await runCase(t,'an old committed reservation resumes safely across adaptive function replacement',async()=>{
    await admin.query("select hq_private.live_emit('agents')")
    const oldDefinition=(await one(owner,"select pg_get_functiondef('hq_private.live_dispatch_tick()'::regprocedure) definition")).definition
    savedOldTickDefinition=oldDefinition
    assert.ok(oldDefinition.includes('  commit;'))
    // Explicit disposable-only barrier at the committed reservation boundary:
    // release outbox/state/cron locks before applying complete schema+routine DDL.
    // The old invocation otherwise executes the original procedure body.
    await owner.query(oldDefinition.replace('  commit;','  commit;\n  perform pg_catalog.pg_advisory_lock(926671);\n  perform pg_catalog.pg_advisory_unlock(926671);'))
    await withLock(holder,'reservation',async()=>{
      const oldCall=owner.query('call hq_private.live_dispatch_tick()').then(value=>({value}),error=>({error}))
      await waitBlocked(admin,owner,holder)
      await admin.query("update cron.job set active=false where jobname='hq-live-once'")
      const reservation=await one(admin,'select attempts,attempt_token from hq_private.live_invalidations where format_version in (2,3)')
      assert.equal(reservation.attempts,1); assert.ok(reservation.attempt_token)
      await admin.query("update hq_private.live_dispatch_state set circuit_open=true,last_error='attempts-exhausted'")
      const uiBefore=await one(admin,'select circuit_open,last_error from hq_private.live_dispatch_state')
      const rowsBefore=(await one(admin,'select jsonb_agg(to_jsonb(i) order by id) rows from hq_private.live_invalidations i')).rows
      const contracts=()=>one(admin,`select jsonb_agg(jsonb_build_array(oid,proowner,proacl,proconfig,prorettype,proargtypes::text) order by oid) value from pg_proc
        where oid in ('hq_private.live_enqueue_v2(text,text,jsonb)'::regprocedure,'hq_private.live_deliver(uuid)'::regprocedure,'hq_private.workforce_wake()'::regprocedure)`)
      const beforeContracts=await contracts()
      await rival.query('begin')
      try { await rival.query(await readFile(proposalPath,'utf8')); await rival.query('commit') }
      catch(error) { await rival.query('rollback'); throw error }
      assert.deepEqual((await one(admin,'select jsonb_agg(to_jsonb(i) order by id) rows from hq_private.live_invalidations i')).rows,rowsBefore)
      assert.deepEqual(await contracts(),beforeContracts)
      assert.deepEqual(await one(admin,'select circuit_open,last_error from hq_private.live_dispatch_state'),uiBefore)
      assert.deepEqual(await one(admin,'select jobs_circuit_open,jobs_last_error from hq_private.live_dispatch_state'),{jobs_circuit_open:false,jobs_last_error:null})
      await holder.query('rollback')
      const result=await oldCall; if(result.error) throw result.error
    })
    const delivered=await one(admin,'select attempts,attempt_token,delivered_at from hq_private.live_invalidations where format_version in (2,3)')
    assert.equal(delivered.attempts,1); assert.equal(delivered.attempt_token,null); assert.ok(delivered.delivered_at)
    assert.equal((await one(admin,'select count(*)::int n from realtime.messages')).n,1)
    assert.deepEqual(await one(admin,'select circuit_open,last_error from hq_private.live_dispatch_state'),{circuit_open:true,last_error:'attempts-exhausted'})
  })
  await clearDispatch(admin)
  const coldName='hq-live-watchdog',coldCommand='select hq_private.live_dispatch_watchdog()'
  async function cold(active,accelerated=false) {
    if(accelerated) await owner.query('select cron.schedule($1,$2,$3)',[coldName,'1 second',coldCommand])
    await admin.query('update cron.job set active=$2 where jobname=$1',[coldName,active])
  }
  async function drainViaActualCron() {
    await until(async()=> (await one(admin,`select count(*)::int n from hq_private.live_invalidations i cross join hq_private.live_dispatch_state s
      where i.format_version in (2,3) and i.delivered_at is null and ((i.event='jobs' and not s.jobs_circuit_open) or (i.event<>'jobs' and not s.circuit_open))`)).n===0,
      'actual watchdog/hot cron did not drain due v2 rows',30000)
    await until(async()=> (await one(admin,"select count(*)::int n from cron.job where jobname='hq-live-once'")).n===0,'hot job did not drain',10000)
    await cold(false)
  }
  await runCase(t,'proposal creates no schedule; separately proposed production watchdog has exact minute cadence',async()=>{
    assert.equal((await one(admin,"select count(*)::int n from cron.job where jobname in ('hq-live-watchdog','hq-live-once')")).n,0)
    await owner.query('select cron.schedule($1,$2,$3)',[coldName,'* * * * *',coldCommand])
    assert.deepEqual(await one(admin,'select schedule,command,username from cron.job where jobname=$1',[coldName]),
      {schedule:'* * * * *',command:coldCommand,username:'postgres'})
    await cold(false)
  })
  for(const kind of ['cron','state','messages']) {
    await runCase(t,`append-only actual claim and finish complete under held ${kind} lock`,async()=>{
      await clearPending(admin)
      await clearDispatch(admin)
      const id=await enqueue(admin),before=(await one(admin,'select to_jsonb(s) value from hq_private.live_dispatch_state s')).value
      await withLock(holder,kind,async()=>{
        await actor.query("set statement_timeout='1500ms'")
        try {
          const job=await claimJob(actor); assert.equal(job.id,id)
          const writes=[],entry=entryFor(job),result=await deliver(actor,entry,writes)
          assert.equal(result.accepted,true); assert.ok(!result.discarded)
          assert.equal(writes.length,1); assert.equal(writes[0].phase,'delivered')
          assert.deepEqual(writes[0].job,entry.job)
          assert.equal((await one(admin,'select status from public.hq_agent_jobs where id=$1',[id])).status,'completed')
          assert.deepEqual((await one(admin,'select to_jsonb(s) value from hq_private.live_dispatch_state s')).value,before)
          assert.ok((await one(admin,'select count(*)::int n from hq_private.live_invalidations where format_version in (2,3)')).n>=2)
        } finally {await actor.query("set statement_timeout='20s'")}
      })
    })
  }
  await clearDispatch(admin)
  await runCase(t,'jobs receipts use only the private worker channel and never browser invalidation routing',async()=>{
    await owner.query('select hq_private.workforce_wake()')
    await rpc(actor,'hq_worker_presence',[worker])
    await cold(true,true); await drainViaActualCron()
    const rows=(await admin.query(`select i.id,i.format_version,i.event,i.kind,i.payload,m.id message_id,m.topic,m.private,m.extension,m.payload message_payload
      from hq_private.live_invalidations i join realtime.messages m on m.payload->>'id'=i.id::text where i.format_version in (2,3) order by i.event`)).rows
    assert.deepEqual(rows.map(row=>row.event),['invalidate','jobs','presence'])
    for(const row of rows) {
      assert.equal(row.topic,row.event==='jobs'?'hq-agent-jobs':'hq-live')
      assert.equal(row.private,true); assert.equal(row.extension,'broadcast'); assert.notEqual(row.message_id,row.id)
      assert.deepEqual(row.message_payload,{...row.payload,id:row.id})
      if(row.event==='jobs') {assert.equal(row.format_version,3);assert.equal(row.kind,'agents');assert.deepEqual(row.payload,{})}
      else assert.equal(row.format_version,2)
    }
    assert.equal((await one(admin,'select count(*)::int n from realtime.messages')).n,3)
  })
  await clearDispatch(admin)
  await runCase(t,'same-ID jobs message on the browser topic is not publication evidence',async()=>{
    await admin.query(`create function realtime.fixture_wrong_jobs_topic() returns trigger language plpgsql as $$
      begin if new.event='jobs' then new.topic:='hq-live'; end if; return new; end $$;
      create trigger fixture_wrong_jobs_topic before insert on realtime.messages for each row execute function realtime.fixture_wrong_jobs_topic();`)
    try {
      await owner.query("select hq_private.live_enqueue_v2('agents','jobs','{}')")
      await owner.query('call hq_private.live_dispatch_tick()')
      assert.deepEqual(await one(admin,"select attempts,delivered_at,last_error from hq_private.live_invalidations where format_version in (2,3)"),
        {attempts:1,delivered_at:null,last_error:'publication-unverified'})
      assert.equal((await one(admin,'select count(*)::int n from realtime.messages')).n,0,'wrong-route insertion must roll back with failed exact receipt')
    } finally {await admin.query('drop trigger fixture_wrong_jobs_topic on realtime.messages; drop function realtime.fixture_wrong_jobs_topic()')}
  })
  await runCase(t,'only exact expired journal is discarded; mismatched lease cannot clear a journal',async()=>{
    const job=await freshJob(admin,actor),wrong=entryFor({...job,lease_token:randomUUID()}),writes=[]
    await assert.rejects(deliver(actor,wrong,writes),error=>error.code==='42501')
    assert.deepEqual(writes,[])
    await admin.query("update public.hq_agent_jobs set lease_expires_at=clock_timestamp()-interval '1 second' where id=$1",[job.id])
    const entry=entryFor(job),result=await deliver(actor,entry,writes)
    assert.equal(result.accepted,true); assert.equal(result.discarded,true)
    assert.equal(writes.length,1); assert.deepEqual(writes[0].job,entry.job); assert.equal(writes[0].phase,'delivered')
    assert.equal(writes[0].reply,''); assert.deepEqual(writes[0].evidence,[])
  })
  await clearDispatch(admin)
  await runCase(t,'saved old tick cannot select or exhaust v3 jobs and watchdog recovers canceled hot wake',async()=>{
    assert.ok(savedOldTickDefinition)
    const signature='PROCEDURE hq_private.live_dispatch_tick()'
    assert.equal(savedOldTickDefinition.split(signature).length,2)
    await owner.query(savedOldTickDefinition.replace(signature,'PROCEDURE hq_private.fixture_pre_adaptive_tick()'))
    await owner.query('revoke all on procedure hq_private.fixture_pre_adaptive_tick() from public,anon,authenticated,service_role')
    try {
      await owner.query("select hq_private.live_enqueue_v2('agents','jobs','{}')")
      const before=await one(admin,'select circuit_open,last_error,jobs_circuit_open,jobs_last_error from hq_private.live_dispatch_state')
      for(const attempts of [0,6]) {
        await admin.query('update hq_private.live_invalidations set attempts=$1,attempt_token=case when $1=0 then null else gen_random_uuid() end where format_version=3',[attempts])
        await owner.query('call hq_private.fixture_pre_adaptive_tick()')
        assert.deepEqual(await one(admin,'select circuit_open,last_error,jobs_circuit_open,jobs_last_error from hq_private.live_dispatch_state'),before)
        assert.deepEqual(await one(admin,'select attempts,delivered_at from hq_private.live_invalidations where format_version=3'),{attempts,delivered_at:null})
      }
      await owner.query('call hq_private.live_dispatch_tick()')
      assert.deepEqual(await one(admin,'select circuit_open,last_error,jobs_circuit_open,jobs_last_error from hq_private.live_dispatch_state'),
        {circuit_open:false,last_error:null,jobs_circuit_open:true,jobs_last_error:'attempts-exhausted'})
      // New UI traffic remains eligible; a delayed old idle tick may cancel
      // its hot wake but cannot remove the independent cold watchdog.
      await owner.query("select hq_private.live_emit('company')")
      await owner.query('select hq_private.live_dispatch_watchdog()')
      await owner.query('select hq_private.live_dispatch_cancel()')
      await cold(true,true); await drainViaActualCron()
      assert.equal((await one(admin,'select count(*)::int n from hq_private.live_invalidations where format_version=2 and delivered_at is not null')).n,1)
      assert.equal((await one(admin,'select circuit_open from hq_private.live_dispatch_state')).circuit_open,false)
    } finally {await owner.query('drop procedure hq_private.fixture_pre_adaptive_tick()')}
  })
  await clearDispatch(admin)
  await runCase(t,'future-only backlog stays cold and due work arms exactly one-second hot polling',async()=>{
    await admin.query("select hq_private.live_emit('agents'); update hq_private.live_invalidations set next_attempt_at=clock_timestamp()+interval '160 seconds' where format_version in (2,3)")
    await owner.query('select hq_private.live_dispatch_watchdog()')
    assert.equal((await one(admin,"select count(*)::int n from cron.job where jobname='hq-live-once'")).n,0)
    await owner.query('call hq_private.live_dispatch_tick()')
    assert.equal((await one(admin,'select attempts from hq_private.live_invalidations where format_version in (2,3)')).attempts,0)
    await admin.query('update hq_private.live_invalidations set next_attempt_at=clock_timestamp() where format_version in (2,3)')
    await owner.query('select hq_private.live_dispatch_watchdog()')
    assert.deepEqual(await one(admin,"select schedule,command,username from cron.job where jobname='hq-live-once'"),
      {schedule:'1 second',command:'call hq_private.live_dispatch_tick()',username:'postgres'})
    await admin.query("update cron.job set active=false where jobname='hq-live-once'")
  })
  await clearDispatch(admin)
  await runCase(t,'hot-drain then new append is recovered by real watchdog (accelerated test cadence only)',async()=>{
    await owner.query('select hq_private.live_dispatch_reconcile($1,$2,0)',[randomUUID(),randomUUID()])
    assert.equal((await one(admin,"select count(*)::int n from cron.job where jobname='hq-live-once'")).n,0)
    await admin.query("select hq_private.live_emit('brain')")
    assert.equal((await one(admin,"select count(*)::int n from cron.job where jobname='hq-live-once'")).n,0,'producer must not arm a wake')
    await cold(true,true) // Production minute mapping was asserted separately.
    await drainViaActualCron()
    assert.equal((await one(admin,'select attempts from hq_private.live_invalidations where format_version in (2,3)')).attempts,1)
    assert.ok((await one(admin,"select count(*)::int n from cron.job_run_details where command=$1 and status='succeeded'",[coldCommand])).n>0)
  })
  await clearDispatch(admin)
  await runCase(t,'missed watchdog ticks retain due work and resume without a producer scheduler call',async()=>{
    await cold(false)
    await admin.query("select hq_private.live_emit('company')")
    await admin.query("update hq_private.live_invalidations set next_attempt_at=clock_timestamp()-interval '2 minutes' where format_version in (2,3)")
    assert.equal((await one(admin,'select attempts from hq_private.live_invalidations where format_version in (2,3)')).attempts,0)
    await cold(true,true); await drainViaActualCron()
    assert.equal((await one(admin,'select attempts from hq_private.live_invalidations where format_version in (2,3)')).attempts,1)
  })
  await clearDispatch(admin)
  await runCase(t,'publisher backend crash after committed reservation is recovered with one bounded next attempt',async()=>{
    await admin.query("select hq_private.live_emit('access')")
    await withLock(holder,'messages',async()=>{
      const pending=owner.query('call hq_private.live_dispatch_tick()').then(value=>({value}),error=>({error}))
      await waitBlocked(admin,owner,holder)
      const reserved=await one(admin,'select attempts,attempt_token,delivered_at from hq_private.live_invalidations where format_version in (2,3)')
      assert.equal(reserved.attempts,1); assert.ok(reserved.attempt_token); assert.equal(reserved.delivered_at,null)
      await admin.query('select pg_terminate_backend($1)',[owner.processID])
      assert.equal((await pending).error?.code,'57P01')
    })
    owner=await connect('hq-wake-owner-recovered')
    assert.equal((await one(admin,'select count(*)::int n from realtime.messages')).n,0)
    await admin.query("update hq_private.live_invalidations set next_attempt_at=clock_timestamp()-interval '1 second' where format_version in (2,3)")
    await cold(true,true); await drainViaActualCron()
    assert.equal((await one(admin,'select attempts from hq_private.live_invalidations where format_version in (2,3)')).attempts,2)
    assert.equal((await one(admin,'select count(*)::int n from realtime.messages')).n,1)
  })
  await clearDispatch(admin)
  await runCase(t,'concurrent ticks preserve one reservation and exact provider receipt',async()=>{
    await admin.query("select hq_private.live_emit('agents')")
    await withLock(holder,'messages',async()=>{
      const pending=owner.query('call hq_private.live_dispatch_tick()').then(value=>({value}),error=>({error}))
      await waitBlocked(admin,owner,holder)
      await rival.query('call hq_private.live_dispatch_tick()')
      assert.equal((await one(admin,'select attempts from hq_private.live_invalidations where format_version in (2,3)')).attempts,1)
      await holder.query('rollback')
      const result=await pending; if(result.error) throw result.error
    })
    assert.equal((await one(admin,`select count(*)::int n from hq_private.live_invalidations i join realtime.messages m
      on m.payload=i.payload||jsonb_build_object('id',i.id) and m.event=i.event and m.topic='hq-live'
      where i.format_version in (2,3) and i.delivered_at is not null`)).n,1)
  })
  for(const failedLane of ['ui','jobs']) {
    await clearDispatch(admin)
    await runCase(t,`${failedLane} exhausts only its six-attempt circuit while the other lane continues`,async()=>{
      const legacy=(await one(admin,"insert into hq_private.live_invalidations(kind) values('agents') returning id")).id
      const failedEvent=failedLane==='jobs'?'jobs':'invalidate'
      const failureCondition=failedLane==='jobs'?"event<>'jobs'":"event='jobs'"
      await admin.query(`alter table realtime.messages add constraint fixture_wake_failure check(${failureCondition})`)
      await owner.query('select hq_private.live_enqueue_v2($1,$2,$3)',
        ['agents',failedEvent,failedLane==='jobs'?'{}':'{"kind":"agents"}'])
      const original=(await one(admin,'select id from hq_private.live_invalidations where format_version in (2,3)')).id
      for(let attempt=1;attempt<=6;attempt++) {
        await admin.query('update hq_private.live_invalidations set next_attempt_at=clock_timestamp() where id=$1',[original])
        await owner.query('call hq_private.live_dispatch_tick()')
        assert.deepEqual(await one(admin,'select attempts,delivered_at from hq_private.live_invalidations where id=$1',[original]),{attempts:attempt,delivered_at:null})
      }
      await admin.query('update hq_private.live_invalidations set next_attempt_at=clock_timestamp() where id=$1',[original])
      await owner.query('call hq_private.live_dispatch_tick()')
      const expected=failedLane==='jobs'
        ? {circuit_open:false,last_error:null,jobs_circuit_open:true,jobs_last_error:'attempts-exhausted'}
        : {circuit_open:true,last_error:'attempts-exhausted',jobs_circuit_open:false,jobs_last_error:null}
      const state=()=>one(admin,'select circuit_open,last_error,jobs_circuit_open,jobs_last_error from hq_private.live_dispatch_state')
      assert.deepEqual(await state(),expected)
      await admin.query('alter table realtime.messages drop constraint fixture_wake_failure')
      // New traffic and transport recovery cannot reopen/reset the failed lane.
      await owner.query('select hq_private.workforce_wake()')
      await cold(true,true); await drainViaActualCron()
      assert.deepEqual(await state(),expected,'success in the other lane must not clear failed-lane diagnostics')
      assert.equal((await one(admin,'select attempts from hq_private.live_invalidations where id=$1',[original])).attempts,6)
      const successfulEvent=failedLane==='jobs'?'invalidate':'jobs'
      assert.equal((await one(admin,'select count(*)::int n from hq_private.live_invalidations where format_version in (2,3) and event=$1 and delivered_at is not null',[successfulEvent])).n,1)
      assert.equal((await one(admin,'select count(*)::int n from hq_private.live_invalidations where format_version in (2,3) and event=$1 and delivered_at is not null',[failedEvent])).n,0)
      assert.equal((await one(admin,'select count(*)::int n from hq_private.live_invalidations where format_version in (2,3) and event=$1 and attempts=0 and delivered_at is null',[failedEvent])).n,1)
      assert.equal((await one(admin,'select delivered_at from hq_private.live_invalidations where id=$1',[legacy])).delivered_at,null)
      assert.equal((await one(admin,"select count(*)::int n from cron.job where jobname='hq-live-once'")).n,0)
      assert.equal((await one(admin,'select count(*)::int n from cron.job where jobname=$1',[coldName])).n,1)
      for(const role of ['anon','authenticated','service_role']) {
        await holder.query(`set role ${role}`)
        try {await assert.rejects(holder.query('select hq_private.live_dispatch_watchdog()'),error=>error.code==='42501')}
        finally {await holder.query('reset role')}
      }
    })
  }
})
