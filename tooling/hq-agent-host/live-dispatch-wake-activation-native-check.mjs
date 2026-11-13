/** Exact guarded activation in a fresh, isolated native fixture. No hosted endpoint. */
import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { setTimeout as delay } from 'node:timers/promises'
import { setup,asWorker,enqueue,worker,activationForFixture } from './live-dispatch-native-fixture.mjs'
import { adaptiveActivationForFixture } from './live-dispatch-wake-activation-fixture.mjs'
import { deliverWorkerEntry } from './worker.mjs'
const require=createRequire(new URL('../../package.json',import.meta.url)),{Client}=require('pg'),clients=[]
async function connect(name,user='postgres') {
  assert.ok(['postgres','fixture_admin'].includes(user))
  const db=new Client({host:'127.0.0.1',port:55439,database:'hq_live_dispatch_disposable',user,password:'disposable-only',application_name:name,
    connectionTimeoutMillis:5000,query_timeout:25000,statement_timeout:20000})
  await db.connect();clients.push(db);return db
}
async function one(db,sql,args=[]) {return (await db.query(sql,args)).rows[0]}
async function until(fn,message,timeout=10000) {
  const deadline=Date.now()+timeout
  while(Date.now()<deadline) {const value=await fn();if(value)return value;await delay(50)}
  assert.fail(message)
}
async function runCase(t,name,fn) {
  let failure
  await t.test(name,async()=>{try {await fn()} catch(error){failure=error;throw error}})
  if(failure)throw failure
}
test('guarded adaptive activation preserves history and installs a real minute watchdog',{timeout:240000},async t=>{
  t.after(async()=>{await Promise.all(clients.map(db=>db.end().catch(()=>{})))})
  const admin=await connect('hq-activation-admin','fixture_admin')
  assert.equal((await one(admin,"select to_regnamespace('hq_private') present")).present,null,'fresh disposable database required')
  await admin.query("create role postgres login superuser password 'disposable-only'")
  const installer=await connect('hq-activation-installer')
  // The permanent bootstrap provider owns the real extension, never the app owner.
  await admin.query('create extension pg_cron')
  await setup({query:(sql,args)=>installer.query(sql.replace('create extension pg_cron;',''),args)})
  // Synthetic ledger structure, populated only after the actual old activation
  // succeeds. The new migration's history guard remains fully intact.
  await installer.query('create schema supabase_migrations; create table supabase_migrations.schema_migrations(version text primary key,name text)')
  await admin.query(`create role fixture_provider nologin;
    alter table realtime.messages owner to fixture_provider;
    alter function realtime.send(jsonb,text,text,boolean) owner to fixture_provider;
    grant usage on schema realtime to postgres;
    grant select,insert on realtime.messages to postgres;
    grant execute on function realtime.send(jsonb,text,text,boolean) to postgres;
    grant pg_read_all_settings to postgres;
    grant usage on schema cron to postgres;
    grant select on cron.job to postgres;
    alter role postgres nosuperuser bypassrls;`)
  const owner=await connect('hq-activation-owner'),actor=await connect('hq-activation-worker','fixture_admin')
  assert.deepEqual(await one(owner,"select current_user role,rolsuper,rolbypassrls from pg_roles where rolname=current_user"),{role:'postgres',rolsuper:false,rolbypassrls:true})
  assert.deepEqual(await one(owner,"select has_table_privilege(current_user,'cron.job','SELECT') read,has_table_privilege(current_user,'cron.job','INSERT,UPDATE,DELETE,TRUNCATE') write"),{read:true,write:false})
  const mode=(await one(owner,"select current_setting('cron.use_background_workers') mode")).mode
  if(process.env.HQ_NATIVE_CRON_MODE)assert.equal(mode,process.env.HQ_NATIVE_CRON_MODE)
  const old=await activationForFixture(admin)
  await owner.query('begin')
  try {
    await owner.query(old.sql)
    await owner.query("insert into supabase_migrations.schema_migrations values('20261109150515','hq_live_dispatch_activation')")
    await owner.query('commit')
  } catch(error){await owner.query('rollback');throw error}
  await admin.query(`truncate realtime.messages;
    update hq_private.live_dispatch_state set circuit_open=true,last_error='attempts-exhausted',generation=7;
    insert into hq_private.live_invalidations(kind,format_version,event,payload,attempts,attempt_token,next_attempt_at,last_error)
      values('agents',2,'invalidate','{"kind":"agents"}',6,gen_random_uuid(),clock_timestamp()-interval '1 minute','attempts-exhausted');
    insert into hq_private.live_invalidations(kind,format_version,event,payload,delivered_at)
      values('company',2,'invalidate','{"kind":"company"}',clock_timestamp());`)
  await owner.query("select cron.schedule('fixture-unrelated','* * * * *','select 1')")
  await admin.query("update cron.job set active=false where jobname='fixture-unrelated'")
  const priorJobs=(await admin.query('select * from cron.job order by jobid')).rows
  const first=(await one(owner,"select cron.schedule('* * * * *','select 2') id")).id
  const second=(await one(owner,"select cron.schedule('* * * * *','select 3') id")).id
  assert.notEqual(first,second,'two-argument scheduler must allocate fresh identities')
  assert.deepEqual((await admin.query('select * from cron.job where jobid<>$1 and jobid<>$2 order by jobid',[first,second])).rows,priorJobs)
  const activation=await adaptiveActivationForFixture(admin)
  t.diagnostic(`Exact adaptive proposal SHA256 ${activation.proposalSha256}; actual pg_cron mode ${mode}`)
  for(const entry of activation.substitutions)t.diagnostic(`Explicit fixture-only guard expectation: ${JSON.stringify(entry)}`)
  async function snapshot() {
    return one(admin,`select
      (select jsonb_agg(to_jsonb(i) order by id) from hq_private.live_invalidations i) rows,
      (select to_jsonb(s) from hq_private.live_dispatch_state s) state,
      (select jsonb_agg(jsonb_build_array(oid,proname,md5(prosrc),proowner,proacl,proconfig) order by oid) from pg_proc where pronamespace='hq_private'::regnamespace) routines,
      (select jsonb_agg(jsonb_build_array(attrelid,attname,atttypid) order by attrelid,attnum) from pg_attribute where attrelid in ('hq_private.live_invalidations'::regclass,'hq_private.live_dispatch_state'::regclass) and attnum>0 and not attisdropped) columns,
      (select jsonb_agg(jsonb_build_array(conrelid,conname,pg_get_constraintdef(oid)) order by conrelid,conname) from pg_constraint where conrelid in ('hq_private.live_invalidations'::regclass,'hq_private.live_dispatch_state'::regclass)) constraints,
      (select coalesce(jsonb_agg(to_jsonb(j) order by jobid),'[]') from cron.job j) jobs,
      (select jsonb_agg(to_jsonb(h) order by version) from supabase_migrations.schema_migrations h) history,
      (select jsonb_agg(to_jsonb(d) order by oid) from pg_default_acl d) defaults,
      to_regclass('hq_private.hq_live_v3_jobs_pending_idx') jobs_index`)
  }
  async function rejects(sql,pattern,prepare=null) {
    const before=await snapshot()
    await owner.query('begin')
    try {if(prepare)await owner.query(prepare);await assert.rejects(owner.query(sql),pattern)}
    finally {await owner.query('rollback')}
    assert.deepEqual(await snapshot(),before,'failed activation must roll back rows, state, catalogs, jobs and history')
  }
  await runCase(t,'unmodified hosted guard rejects the disposable destination',async()=>{
    await rejects(activation.original,/HQ_ADAPTIVE_OWNER_DATABASE_MISMATCH/)
  })
  await runCase(t,'autocommit sentinel loss prevents any activation',async()=>{
    const boundary=activation.sql.indexOf('-- BEGIN HOSTED ADAPTIVE BASELINE')
    assert.ok(boundary>0)
    await owner.query(activation.sql.slice(0,boundary))
    // Statement-by-statement application cannot even insert the expected JSON
    // after the temporary evidence table vanished at commit.
    await rejects(activation.sql.slice(boundary),error=>error.code==='42P01')
  })
  await runCase(t,'missing prerequisite history cannot be substituted away',async()=>{
    await rejects(activation.sql,/HQ_ADAPTIVE_HISTORY_RECONCILIATION_REQUIRED/,'delete from supabase_migrations.schema_migrations')
  })
  await runCase(t,'inherited defaults and existing watchdog identities fail closed',async()=>{
    for(const grant of ['grant all on tables','grant execute on functions']) {
      await rejects(activation.sql,/HQ_ADAPTIVE_DEFAULT_ACL_REVIEW_REQUIRED/,`alter default privileges in schema hq_private ${grant} to anon,authenticated,service_role`)
    }
    await rejects(activation.sql,/HQ_ADAPTIVE_OBJECT_COLLISION/,'create function hq_private.live_dispatch_watchdog() returns void language sql as $$select$$')
    await rejects(activation.sql,/HQ_ADAPTIVE_JOB_IDENTITY_COLLISION/,"select cron.schedule('hq-live-watchdog','* * * * *','select 1')")
  })
  await runCase(t,'wrong existing hot host or port is rejected without adoption',async()=>{
    for(const change of ["nodename='wrong.fixture.invalid'",'nodeport=55440']) {
      await owner.query("select cron.schedule('hq-live-once','59 seconds','call hq_private.live_dispatch_tick()')")
      try {
        // Provider-only synthetic fault; the tested owner never receives UPDATE.
        await admin.query(`update cron.job set ${change} where jobname='hq-live-once'`)
        await rejects(activation.sql,/HQ_ADAPTIVE_JOB_IDENTITY_COLLISION/)
      } finally {await owner.query("select cron.unschedule('hq-live-once')")}
    }
  })
  await runCase(t,'postflight rejects an installed watchdog with wrong host or port and rolls it back',async()=>{
    for(const change of ["nodename='wrong.fixture.invalid'",'nodeport=55440']) {
      // Provider-owned trigger corrupts only this synthetic new job, inside
      // the migration transaction. The owner still has no table-write authority.
      await admin.query(`create function public.fixture_wrong_destination() returns trigger language plpgsql as $$
        begin if NEW.command='select hq_private.live_dispatch_watchdog()' then NEW.${change}; end if; return NEW; end $$;
        create trigger fixture_wrong_destination before insert on cron.job for each row execute function public.fixture_wrong_destination()`)
      try {await rejects(activation.sql,/HQ_ADAPTIVE_WATCHDOG_DESTINATION_MISMATCH/)}
      finally {await admin.query('drop trigger fixture_wrong_destination on cron.job; drop function public.fixture_wrong_destination()')}
    }
  })
  await runCase(t,'post-DDL failure rolls back schema changes and atomic watchdog installation',async()=>{
    const marker='DO $postflight$';assert.equal(activation.sql.split(marker).length,2)
    const probe=activation.sql.replace(marker,"DO $test_rollback$ begin raise exception 'FIXTURE_ADAPTIVE_POST_DDL_ROLLBACK'; end $test_rollback$;\n"+marker)
    await rejects(probe,/FIXTURE_ADAPTIVE_POST_DDL_ROLLBACK/)
  })
  const before=await snapshot()
  await runCase(t,'complete guarded migration and ledger commit preserve open UI circuit and all old rows',async()=>{
    await owner.query('begin')
    try {
      await owner.query(activation.sql)
      await owner.query("insert into supabase_migrations.schema_migrations values('20261109182552','hq_live_dispatch_adaptive_activation')")
      await owner.query('commit')
    } catch(error){await owner.query('rollback');throw error}
    const after=await snapshot()
    assert.deepEqual(after.rows,before.rows)
    const {jobs_circuit_open,jobs_last_error,watchdog_job_id,...browser}=after.state
    assert.deepEqual(browser,before.state);assert.equal(jobs_circuit_open,false);assert.equal(jobs_last_error,null)
    assert.equal(after.jobs.length,before.jobs.length+1)
    assert.deepEqual(after.jobs.filter(job=>String(job.jobid)!==String(watchdog_job_id)),before.jobs)
    assert.ok(BigInt(watchdog_job_id)>0n)
    const job=after.jobs.find(job=>String(job.jobid)===String(watchdog_job_id))
    assert.equal(job.jobname,null);assert.equal(job.username,'postgres');assert.equal(job.database,activation.config.database)
    assert.equal(job.nodename,activation.config.host);assert.equal(job.nodeport,55439);assert.equal(job.active,true)
    assert.equal(job.schedule,'* * * * *');assert.equal(job.command,'select hq_private.live_dispatch_watchdog()')
    for(const role of ['anon','authenticated','service_role']) {
      assert.equal((await one(admin,"select has_function_privilege($1,'hq_private.live_dispatch_watchdog()','EXECUTE') allowed",[role])).allowed,false)
      assert.equal((await one(admin,"select has_table_privilege($1,'hq_private.live_dispatch_state','SELECT,INSERT,UPDATE,DELETE') allowed",[role])).allowed,false)
    }
  })
  await runCase(t,'replay after committed activation fails on history without adopting or duplicating jobs',async()=>{
    await rejects(activation.sql,/HQ_ADAPTIVE_HISTORY_RECONCILIATION_REQUIRED/)
  })
  await runCase(t,'actual installed minute watchdog publishes private jobs while browser circuit remains open',async()=>{
    await asWorker(actor)
    const id=await enqueue(admin)
    const job=(await one(actor,'select public.hq_worker_repository_claim($1,300,1) result',[worker])).result.job
    assert.equal(job.id,id)
    const writes=[],entry={version:3,job:{id:job.id,lease_token:job.lease_token},phase:'finished',reply:'Synthetic guarded activation finish.',error:null,evidence:[]}
    const result=await deliverWorkerEntry({workerId:worker,retryWait:async()=>{},write:async value=>writes.push(value),
      rpc:async(name,input)=>(await one(actor,`select public.${name}(${Object.values(input).map((_,i)=>'$'+(i+1)).join(',')}) result`,
        Object.values(input).map(value=>value!==null&&typeof value==='object'?JSON.stringify(value):value))).result},entry)
    assert.equal(result.accepted,true);assert.equal(writes.length,1);assert.equal(writes[0].phase,'delivered')
    // No manual CALL, schedule acceleration or due-time rewriting here. This
    // is the actual minute job created by the migration, in each configured mode.
    await until(async()=> (await one(admin,"select count(*)::int n from hq_private.live_invalidations where format_version=3 and event='jobs' and delivered_at is not null")).n>=1,
      'installed real minute watchdog did not publish jobs within 80 seconds',80000)
    await until(async()=> (await one(admin,"select count(*)::int n from cron.job where jobname='hq-live-once'")).n===0,'hot job did not drain')
    await until(async()=> (await one(admin,"select count(*)::int n from cron.job_run_details where command='select hq_private.live_dispatch_watchdog()' and status='succeeded'")).n>=1,'real watchdog run not confirmed')
    const receipt=await one(admin,`select i.payload,i.attempts,m.topic,m.private,m.payload receipt from hq_private.live_invalidations i
      join realtime.messages m on m.payload->>'id'=i.id::text where i.format_version=3 and i.delivered_at is not null`)
    assert.deepEqual(receipt.payload,{});assert.equal(receipt.attempts,1);assert.equal(receipt.topic,'hq-agent-jobs');assert.equal(receipt.private,true)
    assert.deepEqual(Object.keys(receipt.receipt),['id'])
    assert.deepEqual(await one(admin,'select circuit_open,last_error,jobs_circuit_open,jobs_last_error from hq_private.live_dispatch_state'),
      {circuit_open:true,last_error:'attempts-exhausted',jobs_circuit_open:false,jobs_last_error:null})
    assert.equal((await one(admin,"select count(*)::int n from cron.job where jobid=(select watchdog_job_id from hq_private.live_dispatch_state) and jobname is null and schedule='* * * * *' and active")).n,1)
  })
})
