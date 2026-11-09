/** Native PostgreSQL concurrency tests. Fixed disposable endpoint; no hosted URL accepted. */
import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { setTimeout as delay } from 'node:timers/promises'
import { setup, asWorker, enqueue, worker, activationForFixture } from './live-dispatch-native-fixture.mjs'
const require = createRequire(new URL('../../package.json', import.meta.url))
const { Client } = require('pg')
const clients=[]
async function connect(name,user='postgres') {
  assert.ok(['postgres','fixture_admin'].includes(user),'only fixed disposable fixture identities are supported')
  const client=new Client({host:'127.0.0.1',port:55439,database:'hq_live_dispatch_disposable',user,password:'disposable-only',application_name:name,connectionTimeoutMillis:5000})
  await client.connect(); clients.push(client); return client
}
async function until(fn,message,timeout=10000) {
  const deadline=Date.now()+timeout
  while(Date.now()<deadline) { const result=await fn(); if(result) return result; await delay(25) }
  assert.fail(message)
}
async function one(db,sql,args=[]) { return (await db.query(sql,args)).rows[0] }
async function blocked(db,pid,relation) {
  return until(async()=>{
    const row=await one(db,`select a.wait_event_type,a.wait_event,l.mode,l.granted,pg_blocking_pids(a.pid) blockers
      from pg_stat_activity a join pg_locks l on l.pid=a.pid
      where a.pid=$1 and a.wait_event_type='Lock' and not l.granted
      and l.relation=$2::regclass`,[pid,relation])
    return row?.blockers.length ? row : false
  },`PID ${pid} never entered an observed PostgreSQL lock wait on ${relation}`)
}
async function pauseCron(db) { await db.query("update cron.job set active=false where jobname='hq-live-once'") }
async function resetDispatch(db) {
  await db.query(`select hq_private.live_dispatch_cancel();
    delete from hq_private.live_invalidations where format_version=2;
    truncate realtime.messages;
    update hq_private.live_dispatch_state set circuit_open=false,last_error=null,due_at=null;`)
}
async function emit(db,kind='agents') { await db.query('select hq_private.live_emit($1)',[kind]); await pauseCron(db) }
async function assertServiceCannotFlush(admin, service) {
  const snapshot=()=>one(admin,`select
    (select jsonb_agg(to_jsonb(i) order by i.id) from hq_private.live_invalidations i) as outbox,
    (select to_jsonb(s) from hq_private.live_dispatch_state s) as state,
    (select count(*)::int from realtime.messages) as messages`)
  const before=await snapshot()
  await service.query('set role service_role')
  await service.query(`select set_config('request.jwt.claims','{"role":"service_role"}',false)`)
  try {
    await assert.rejects(service.query('select public.hq_live_flush(20)'),error=>
      error.code==='55000' && error.message.includes('HQ_LIVE_OWNER_DISPATCH_REQUIRED'))
  } finally { await service.query('reset role') }
  assert.deepEqual(await snapshot(),before,'disabled service flush must not change attempts, tokens, delivery markers, messages, or circuit state')
}


// One fixture and ordered subtests deliberately distinguish baseline from proposal.
test('native HQ claim and pg_cron publication isolation', {timeout:180000}, async t=>{
  t.after(async()=>{ for(const db of clients) { await db.query('rollback').catch(()=>{}); await db.end().catch(()=>{}) } })
  const bootstrap=await connect('hq-native-bootstrap')
  await setup(bootstrap)
  // Disposable orchestration only. Fresh application-owner connections below
  // genuinely lack superuser privileges and receive no role memberships.
  await bootstrap.query(`create role fixture_admin login superuser password 'disposable-only';
    create role fixture_provider nologin;
    alter table realtime.messages owner to fixture_provider;
    alter function realtime.send(jsonb,text,text,boolean) owner to fixture_provider;
    grant usage on schema realtime to postgres;
    grant select,insert on realtime.messages to postgres;
    grant execute on function realtime.send(jsonb,text,text,boolean) to postgres;
    alter role postgres nosuperuser bypassrls;`)
  const admin=await connect('hq-native-admin','fixture_admin'), hold=await connect('hq-native-lock','fixture_admin'), claim=await connect('hq-native-claim','fixture_admin'), publisher=await connect('hq-native-publisher'), second=await connect('hq-native-second','fixture_admin'), otherPublisher=await connect('hq-native-competing-publisher')
  assert.deepEqual(await one(publisher,"select current_user role,rolsuper,rolbypassrls from pg_roles where rolname=current_user"),{role:'postgres',rolsuper:false,rolbypassrls:true})
  const cronMode=(await one(admin,"select current_setting('cron.use_background_workers') mode")).mode
  if(process.env.HQ_NATIVE_CRON_MODE) assert.equal(cronMode,process.env.HQ_NATIVE_CRON_MODE)
  t.diagnostic(`Actual pg_cron execution mode: background workers ${cronMode}`)
  await t.test('provider augments payload ID, independently generates row ID, and warns on ordinary failure', async()=>{
    await admin.query(`select realtime.send('{"kind":"agents"}','invalidate','hq-live',true)`)
    const auto=await one(admin,"select id,payload from realtime.messages order by inserted_at desc limit 1")
    assert.equal(auto.payload.id,auto.id)
    const fixed='00000000-0000-0000-0000-000000000001'
    await admin.query('select realtime.send($1,\'invalidate\',\'hq-live\',true)',[JSON.stringify({kind:'agents',id:fixed})])
    const preserved=await one(admin,"select id,payload from realtime.messages where payload->>'id'=$1",[fixed])
    assert.notEqual(preserved.id,fixed)
    await admin.query("alter table realtime.messages add constraint fixture_reject check (event<>'fixture-reject')")
    const notices=[]; const onNotice=n=>notices.push(n.message); admin.on('notice',onNotice)
    await admin.query("select realtime.send('{}','fixture-reject','hq-live',true)")
    admin.off('notice',onNotice)
    assert.ok(notices.some(x=>x.includes('WarnSendingBroadcastMessage')))
    assert.equal((await one(admin,"select count(*)::int n from realtime.messages where event='fixture-reject'")).n,0)
    await admin.query('alter table realtime.messages drop constraint fixture_reject')
  })
  const job=await enqueue(admin)
  await asWorker(claim)
  await t.test('baseline actual claim blocks on managed messages and cancellation rolls back its lease', async()=>{
    await hold.query('begin; lock table realtime.messages in access exclusive mode')
    const result=claim.query('select public.hq_worker_repository_claim($1,300,1) result',[worker]).then(x=>({value:x}),error=>({error}))
    await blocked(admin,claim.processID,'realtime.messages')
    assert.equal((await one(admin,'select status from public.hq_agent_jobs where id=$1',[job])).status,'queued')
    await admin.query('select pg_cancel_backend($1)',[claim.processID])
    assert.equal((await result).error?.code,'57014')
    await hold.query('rollback')
    const state=await one(admin,'select status,lease_token,worker_id from public.hq_agent_jobs where id=$1',[job])
    assert.deepEqual(state,{status:'queued',lease_token:null,worker_id:null})
  })
  await t.test('baseline worker_presence independently blocks on managed messages',async()=>{
    await hold.query('begin; lock table realtime.messages in access exclusive mode')
    const result=claim.query('select public.hq_worker_presence($1)',[worker]).then(x=>({value:x}),error=>({error}))
    await blocked(admin,claim.processID,'realtime.messages')
    await admin.query('select pg_cancel_backend($1)',[claim.processID])
    assert.equal((await result).error?.code,'57014'); await hold.query('rollback')
  })
  const legacy=(await one(admin,"insert into hq_private.live_invalidations(kind) values('agents') returning id")).id
  const activation=await activationForFixture(admin)
  for(const substitution of activation.substitutions) t.diagnostic(`Explicit fixture-only guard substitution: ${JSON.stringify(substitution)}`)
  const baselineCatalog=()=>one(admin,`select
    (select jsonb_agg(to_jsonb(i) order by id) from hq_private.live_invalidations i) legacy,
    (select jsonb_agg(jsonb_build_array(attname,atttypid) order by attnum) from pg_attribute
      where attrelid='hq_private.live_invalidations'::regclass and attnum>0 and not attisdropped) columns,
    (select jsonb_agg(jsonb_build_array(proname,md5(prosrc),proacl) order by oid) from pg_proc
      where pronamespace='hq_private'::regnamespace) routines,
    to_regclass('hq_private.live_dispatch_state') state,
    (select count(*)::int from cron.job where jobname='hq-live-once') jobs`)
  async function rejectedActivation(sql,pattern,prepare=null) {
    const before=await baselineCatalog()
    await publisher.query('begin')
    try {
      if(prepare) await publisher.query(prepare)
      await assert.rejects(publisher.query(sql),pattern)
    } finally { await publisher.query('rollback') }
    assert.deepEqual(await baselineCatalog(),before,'failed activation must roll back all catalog, outbox, and cron changes')
  }
  await t.test('untouched hosted guard rejects disposable database before persistent changes',async()=>{
    await rejectedActivation(activation.original,/HQ_LIVE_ACTIVATION_OWNER_DATABASE_MISMATCH/)
  })
  await t.test('statement-by-statement autocommit cannot activate without retained transaction snapshot',async()=>{
    const boundary=activation.sql.indexOf('DO $preflight$')
    assert.ok(boundary>0)
    await publisher.query(activation.sql.slice(0,boundary))
    await rejectedActivation(activation.sql.slice(boundary),/HQ_LIVE_ACTIVATION_OUTER_TRANSACTION_REQUIRED/)
  })
  await t.test('activation rejects cron/object collisions and inherited default grants atomically',async()=>{
    await rejectedActivation(activation.sql,/HQ_LIVE_ACTIVATION_JOB_NAME_COLLISION/,
      "select cron.schedule('hq-live-once','0 0 1 1 *','select 1'); update cron.job set active=false where jobname='hq-live-once'")
    await rejectedActivation(activation.sql,/HQ_LIVE_ACTIVATION_OBJECT_COLLISION/,
      'create table hq_private.live_dispatch_state(fixture boolean)')
    for(const grant of ['grant all on tables','grant execute on functions']) {
      await rejectedActivation(activation.sql,/HQ_LIVE_ACTIVATION_DEFAULT_ACL_REVIEW_REQUIRED/,
        `alter default privileges in schema hq_private ${grant} to anon,authenticated,service_role`)
    }
  })
  await t.test('failure after exact proposal DDL rolls back all activation changes',async()=>{
    const probe=activation.sql.replace('DO $postflight$',
      "DO $fixture_rollback$ begin raise exception 'FIXTURE_POST_DDL_ROLLBACK'; end $fixture_rollback$;\nDO $postflight$")
    await rejectedActivation(probe,/FIXTURE_POST_DDL_ROLLBACK/)
  })
  await t.test('complete guarded activation succeeds with explicit fixture-only expectations',async()=>{
    await publisher.query('begin')
    try { await publisher.query(activation.sql); await publisher.query('commit') }
    catch(error) { await publisher.query('rollback'); throw error }
    assert.equal((await one(admin,"select count(*)::int n from cron.job where jobname='hq-live-once'")).n,0)
    for(const role of ['anon','authenticated','service_role']) {
      assert.equal((await one(admin,"select has_table_privilege($1,'hq_private.live_dispatch_state','SELECT,INSERT,UPDATE,DELETE') allowed",[role])).allowed,false)
    }
  })
  await t.test('candidate actual claim and presence finish with messages exclusively locked', async()=>{
    await hold.query('begin; lock table realtime.messages in access exclusive mode')
    await claim.query("set statement_timeout='1500ms'")
    const result=await one(claim,'select public.hq_worker_repository_claim($1,300,1) result',[worker])
    assert.equal(result.result.job.id,job)
    assert.ok(result.result.job.lease_token)
    assert.equal((await one(claim,'select public.hq_worker_presence($1) result',[worker])).result.accepted,true)
    assert.equal((await one(admin,'select status from public.hq_agent_jobs where id=$1',[job])).status,'working')
    const events=(await admin.query('select distinct event from hq_private.live_invalidations where format_version=2')).rows.map(x=>x.event)
    assert.ok(events.includes('presence')); assert.ok(events.includes('invalidate'))
    await pauseCron(admin); await hold.query('rollback')
    await claim.query('set statement_timeout=0')
  })
  await t.test('legacy remains quarantined and application roles cannot call publisher or enqueue', async()=>{
    await assert.rejects(admin.query('select hq_private.live_deliver($1)',[legacy]),/HQ_LIVE_LEGACY_UNVERIFIED/)
    for(const role of ['anon','authenticated','service_role']) {
      await second.query(`set role ${role}`)
      await assert.rejects(second.query('call hq_private.live_dispatch_tick()'),e=>e.code==='42501')
      await assert.rejects(second.query('select hq_private.live_dispatch_reconcile($1,$1,0)',[legacy]),e=>e.code==='42501')
      await assert.rejects(second.query("select hq_private.live_enqueue_v2('agents','invalidate','{\"kind\":\"agents\"}')"),e=>e.code==='42501')
      await second.query('reset role')
    }
    await assertServiceCannotFlush(admin,second)
    assert.equal((await one(admin,'select delivered_at from hq_private.live_invalidations where id=$1',[legacy])).delivered_at,null)
  })
  await resetDispatch(admin)
  await t.test('publisher cancellation preserves committed attempt and retry but not publication', async()=>{
    await emit(admin)
    await hold.query('begin; lock table realtime.messages in access exclusive mode')
    const pending=publisher.query('call hq_private.live_dispatch_tick()').then(x=>({value:x}),error=>({error}))
    await blocked(admin,publisher.processID,'realtime.messages')
    const row=await one(admin,'select attempts,attempt_token,delivered_at from hq_private.live_invalidations where format_version=2')
    assert.equal(row.attempts,1); assert.ok(row.attempt_token); assert.equal(row.delivered_at,null)
    assert.ok((await one(admin,'select due_at from hq_private.live_dispatch_state')).due_at)
    await pauseCron(admin)
    await admin.query('select pg_cancel_backend($1)',[publisher.processID])
    assert.equal((await pending).error?.code,'57014')
    await hold.query('rollback')
    assert.equal((await one(admin,'select attempts from hq_private.live_invalidations where format_version=2')).attempts,1)
    assert.equal((await one(admin,'select count(*)::int n from realtime.messages')).n,0)
    await assertServiceCannotFlush(admin,second)
  })
  await resetDispatch(admin)
  await t.test('two publishers serialize exact receipt and a new generation retains its wake',async()=>{
    await emit(admin)
    await hold.query('begin; lock table realtime.messages in access exclusive mode')
    const first=publisher.query('call hq_private.live_dispatch_tick()')
    await blocked(admin,publisher.processID,'realtime.messages')
    await otherPublisher.query('call hq_private.live_dispatch_tick()')
    const item=await one(admin,'select id from hq_private.live_invalidations where format_version=2')
    const competing=otherPublisher.query('select hq_private.live_deliver($1)',[item.id])
    await until(async()=> (await one(admin,"select pg_blocking_pids($1) blockers",[otherPublisher.processID])).blockers.includes(publisher.processID),'second publisher did not wait for the exact outbox row')
    await emit(admin,'company') // Must not wait for transport: state lock was committed.
    await hold.query('rollback'); await first; await competing; await pauseCron(admin)
    const state=await one(admin,'select generation,due_at from hq_private.live_dispatch_state')
    assert.ok(state.due_at,'new generation must retain wake')
    await publisher.query('call hq_private.live_dispatch_tick()'); await pauseCron(admin)
    const receipts=(await admin.query(`select i.id,i.delivered_at,count(m.id)::int messages from hq_private.live_invalidations i
      left join realtime.messages m on m.payload->>'id'=i.id::text and m.event=i.event and m.topic='hq-live'
      where i.format_version=2 group by i.id`)).rows
    assert.equal(receipts.length,2)
    for(const row of receipts) { assert.ok(row.delivered_at); assert.equal(row.messages,1) }
  })
  await resetDispatch(admin)
  await t.test('stale-token reconciliation preserves newer pending and delivered outcomes',async()=>{
    await emit(admin)
    // Deterministically reproduce the committed reservation gap. These writes
    // affect only the fixed disposable fixture, never hosted application state.
    const row=await one(admin,`update hq_private.live_invalidations set attempts=1,
      attempt_token=gen_random_uuid() where format_version=2 returning id,attempt_token`)
    const oldToken=row.attempt_token
    const generation=(await one(admin,'select generation from hq_private.live_dispatch_state')).generation
    const newer=await one(admin,`update hq_private.live_invalidations set attempts=2,
      attempt_token=gen_random_uuid(),last_error='publication-unverified' where id=$1 returning attempt_token`,[row.id])
    for(const diagnostic of [null,'publication-unverified']) {
      await admin.query('update hq_private.live_dispatch_state set last_error=$1',[diagnostic])
      await admin.query('select hq_private.live_dispatch_reconcile($1,$2,$3)',[row.id,oldToken,generation])
      await pauseCron(admin)
      assert.equal((await one(admin,'select last_error from hq_private.live_dispatch_state')).last_error,diagnostic)
      const pending=await one(admin,'select attempts,attempt_token,delivered_at,last_error from hq_private.live_invalidations where id=$1',[row.id])
      assert.deepEqual(pending,{attempts:2,attempt_token:newer.attempt_token,delivered_at:null,last_error:'publication-unverified'})
    }
    await admin.query('select hq_private.live_deliver($1)',[row.id])
    await admin.query('select hq_private.live_dispatch_reconcile($1,$2,$3)',[row.id,oldToken,generation])
    assert.equal((await one(admin,'select last_error from hq_private.live_dispatch_state')).last_error,null)
    const delivered=await one(admin,'select attempts,attempt_token,delivered_at,last_error from hq_private.live_invalidations where id=$1',[row.id])
    assert.equal(delivered.attempts,2); assert.equal(delivered.attempt_token,null)
    assert.ok(delivered.delivered_at); assert.equal(delivered.last_error,null)
    assert.equal((await one(admin,`select count(*)::int n from realtime.messages where payload->>'id'=$1`,[row.id])).n,1)
    assert.equal((await one(admin,"select count(*)::int n from cron.job where jobname='hq-live-once'")).n,0)
  })
  await resetDispatch(admin)
  await t.test('same-kind wrong-ID transport row is not an exact receipt',async()=>{
    await admin.query(`create function realtime.fixture_wrong_id() returns trigger language plpgsql as $$
      begin new.payload:=jsonb_set(new.payload,'{id}',to_jsonb(gen_random_uuid())); return new; end $$;
      create trigger fixture_wrong_id before insert on realtime.messages for each row execute function realtime.fixture_wrong_id();`)
    await emit(admin)
    await publisher.query('call hq_private.live_dispatch_tick()'); await pauseCron(admin)
    const row=await one(admin,'select delivered_at,last_error from hq_private.live_invalidations where format_version=2')
    assert.equal(row.delivered_at,null); assert.equal(row.last_error,'publication-unverified')
    // Failed exact-receipt assertion rolls the entire publication subtransaction back.
    assert.equal((await one(admin,'select count(*)::int n from realtime.messages')).n,0)
    await admin.query('drop trigger fixture_wrong_id on realtime.messages; drop function realtime.fixture_wrong_id()')
  })
  await resetDispatch(admin)
  await t.test('warnings cannot fabricate receipt; bounded failures open circuit and new events cannot reset it',async()=>{
    await admin.query("alter table realtime.messages add constraint fixture_failure check (event='never')")
    await emit(admin)
    for(let attempt=1;attempt<=6;attempt++) {
      await admin.query("update hq_private.live_invalidations set next_attempt_at=clock_timestamp() where format_version=2")
      await publisher.query('call hq_private.live_dispatch_tick()'); await pauseCron(admin)
      const row=await one(admin,'select attempts,delivered_at,last_error from hq_private.live_invalidations where format_version=2')
      assert.equal(row.attempts,attempt); assert.equal(row.delivered_at,null); assert.equal(row.last_error,'publication-unverified')
    }
    await admin.query("update hq_private.live_invalidations set next_attempt_at=clock_timestamp() where format_version=2")
    await publisher.query('call hq_private.live_dispatch_tick()')
    assert.equal((await one(admin,'select circuit_open from hq_private.live_dispatch_state')).circuit_open,true)
    await emit(admin,'company')
    assert.equal((await one(admin,'select circuit_open from hq_private.live_dispatch_state')).circuit_open,true)
    assert.equal((await one(admin,"select count(*)::int n from cron.job where jobname='hq-live-once'")).n,0)
    await assertServiceCannotFlush(admin,second)
    await admin.query('alter table realtime.messages drop constraint fixture_failure')
  })
  await resetDispatch(admin)
  await t.test('long retries retain bounded recurring wake and early ticks do not spend attempts',async()=>{
    await emit(admin)
    for(const seconds of [80,160,3153600000]) {
      await admin.query('update hq_private.live_invalidations set next_attempt_at=clock_timestamp()+make_interval(secs=>$1) where format_version=2',[seconds])
      await publisher.query('call hq_private.live_dispatch_tick()'); await pauseCron(admin)
      const row=await one(admin,`select i.attempts,i.attempt_token,i.delivered_at,i.next_attempt_at=s.due_at as due_retained,
        (select schedule from cron.job where jobname='hq-live-once') schedule from hq_private.live_invalidations i
        cross join hq_private.live_dispatch_state s where i.format_version=2`)
      assert.deepEqual(row,{attempts:0,attempt_token:null,delivered_at:null,due_retained:true,schedule:'59 seconds'})
      assert.equal((await one(admin,'select count(*)::int n from realtime.messages')).n,0)
    }
  })
  await resetDispatch(admin)
  await t.test('real cron recovers a missed due time without calendar rearming',async()=>{
    await emit(admin)
    await admin.query("update hq_private.live_invalidations set next_attempt_at=clock_timestamp()+interval '160 seconds' where format_version=2")
    await publisher.query('call hq_private.live_dispatch_tick()'); await pauseCron(admin)
    assert.equal((await one(admin,"select schedule from cron.job where jobname='hq-live-once'")).schedule,'59 seconds')
    // Deterministically advance only disposable due data while execution is
    // disabled. Use an explicitly shortened recurring interval to avoid a
    // one-minute CI wait; the production 59-second mapping was asserted above.
    await admin.query(`update hq_private.live_invalidations set next_attempt_at=clock_timestamp()-interval '1 second' where format_version=2;
      update hq_private.live_dispatch_state set due_at=clock_timestamp()-interval '1 second';
      update cron.job set schedule='1 seconds',active=true where jobname='hq-live-once';`)
    await until(async()=> (await one(admin,"select count(*)::int n from hq_private.live_invalidations where format_version=2 and delivered_at is not null")).n===1,'real cron failed to recover the missed due',30000)
    await until(async()=> (await one(admin,"select count(*)::int n from cron.job where jobname='hq-live-once'")).n===0,'recovered wake did not drain')
    assert.equal((await one(admin,'select attempts from hq_private.live_invalidations where format_version=2')).attempts,1)
  })
  await resetDispatch(admin)
  await t.test('actual configured pg_cron mode executes COMMIT-capable CALL then removes its exhausted wake',async()=>{
    // No mock scheduler/manual CALL: a real background worker must publish.
    await admin.query("select hq_private.live_emit('brain')")
    await until(async()=> (await one(admin,"select count(*)::int n from hq_private.live_invalidations where format_version=2 and delivered_at is not null")).n===1,'pg_cron did not publish',30000)
    await until(async()=> (await one(admin,"select count(*)::int n from cron.job where jobname='hq-live-once'")).n===0,'drained wake was not canceled')
    await until(async()=> (await one(admin,"select count(*)::int n from cron.job_run_details where command='call hq_private.live_dispatch_tick()' and status='succeeded'")).n>0,'pg_cron CALL did not report success')
    assert.equal((await one(admin,'select attempts from hq_private.live_invalidations where format_version=2')).attempts,1)
  })
})
