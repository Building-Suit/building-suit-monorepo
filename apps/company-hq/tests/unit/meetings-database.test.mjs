import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { after, before, test } from 'node:test'
import { PGlite } from '@electric-sql/pglite'
import { validateJob, webAllowed } from '../../../../tooling/hq-agent-host/worker.mjs'

const migrations = new URL('../../supabase/migrations/', import.meta.url)
const founder = '10000000-0000-4000-8000-000000000001'
const worker = '10000000-0000-4000-8000-000000000003'
const workerId = '30000000-0000-4000-8000-000000000001'
const other = '10000000-0000-4000-8000-000000000002'
const sessions = { [founder]: '20000000-0000-4000-8000-000000000001', [other]: '20000000-0000-4000-8000-000000000002', [worker]: '20000000-0000-4000-8000-000000000003' }
let db
const source = name => readFile(new URL(name, migrations), 'utf8')
function functionSource(sql, name, schema='hq_private') {
  const start = sql.search(new RegExp(`create (?:or replace )?function ${schema}\\.${name}\\(`))
  assert.ok(start >= 0, `actual workforce function ${name} must exist`)
  const end = sql.indexOf('$$;', start)
  assert.ok(end > start)
  return sql.slice(start, end + 3)
}

before(async () => {
  db = new PGlite()
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema auth;
    create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
    create table auth.sessions(id uuid primary key,user_id uuid,not_after timestamptz);
    create function auth.jwt() returns jsonb language sql stable as $$ select nullif(current_setting('request.jwt.claims',true),'')::jsonb $$;
    create function auth.uid() returns uuid language sql stable as $$ select (auth.jwt()->>'sub')::uuid $$;
    grant usage on schema auth to authenticated,service_role;
    grant execute on function auth.jwt(),auth.uid() to authenticated,service_role;
  `)
  await db.exec(await source('20261104194233_hq_founder_company_plans.sql'))
  // Explicit contract fixture: use the current queue/workforce TABLE definitions
  // and actual current create/cancel/assignability helpers, not a second queue.
  // Actual current technical authentication and claim are included. Native
  // broadcast delivery, the source index and unrelated aggregate snapshot are
  // local fixtures. No provider/host process or review completion is exercised.
  const queue = await source('20261105035454_hq_agent_messages_worker_queue.sql')
  const workforce = await source('20261105150500_hq_workforce_tasks_learning.sql')
  const chat = await source('20261105180148_hq_conversational_chat.sql')
  const recovery = await source('20261105204244_hq_hr_output_supervisor_recovery.sql')
  const native = await source('20261105155841_hq_native_tool_evidence.sql')
  const presence = await source('20261105192548_hq_presence_without_snapshot_polling.sql')
  await db.exec(queue.slice(0, queue.indexOf('-- Extend the existing durable')))
  await db.exec(workforce.slice(0, workforce.indexOf('create function hq_private.workforce_wake()')))
  await db.exec(chat.slice(0,chat.indexOf('-- One source-bound utterance')))
  await db.exec(recovery.slice(0,recovery.indexOf('create function hq_private.recover_hr_task_output')))
  await db.exec(native.slice(0,native.indexOf('create function hq_private.validate_tool_evidence')))
  await db.exec(`
    -- The source-index is an explicit disposable fixture; no Google read occurs.
    create table hq_private.brain_files(file_id text primary key,root_id text,in_scope boolean,trashed boolean);
    insert into hq_private.brain_files select id,'1JgnIBa6As96sdOQn1z3rcQpwDyAvcZm8',true,false from unnest(array[
      '1IRzs2Q41vfq0ocAT6HB3-bcMDPGTdMx5','1efnq6B7sKn4x099Dv5xsNyFJFIrnC6Xz','1kYDlexJRpJblhEFTq-XSqOEMIDnYdyjf',
      '14A5qRpobLLnX9-e2iJxw7ekB2TB_IBvB','1ayMJWoihUx0rSYCkRc5hotRBRY1AAz9N','fixture-profile']) id;
    create schema extensions;
    create function extensions.digest(text,text) returns bytea language sql immutable as $$ select pg_catalog.sha256(pg_catalog.convert_to($1,'UTF8')) $$;
    create schema realtime;
    create table realtime.messages(topic text,event text,private boolean,inserted_at timestamp default(transaction_timestamp() at time zone 'UTC'));
    create function realtime.send(jsonb,text,text,boolean) returns void language sql as $$ insert into realtime.messages(topic,event,private) values($3,$2,$4) $$;
    create table hq_private.fixture_wakes(id bigint generated always as identity);
    create function hq_private.agent_snapshot() returns jsonb language sql set search_path='' as $$ select '{}'::jsonb $$;
    create function hq_private.live_emit(text) returns void language plpgsql set search_path='' as $$ begin return; end $$;
    create function hq_private.workforce_wake() returns void language plpgsql set search_path='' as $$ begin
      if current_setting('fixture.wake_failure',true)='true' then raise exception 'FIXTURE_PUSH_UNAVAILABLE'; end if;
      insert into hq_private.fixture_wakes default values;
    end $$;
  `)
  for (const sql of [functionSource(workforce, 'workforce_agent_assignable'), functionSource(chat, 'create_business_task'), functionSource(workforce, 'cancel_business_task'),functionSource(queue,'agent_worker_uid'),functionSource(workforce,'workforce_block_claim'),functionSource(presence,'worker_presence'),functionSource(recovery,'worker_claim'),functionSource(workforce,'hq_create_task','public'),functionSource(workforce,'hq_cancel_task','public'),functionSource(chat,'chat_message'),functionSource(recovery,'workforce_enqueue'),functionSource(recovery,'worker_finish'),functionSource(native,'validate_tool_evidence'),functionSource(native,'worker_finish_v2'),functionSource(chat,'send_ceo_message'),functionSource(queue,'hq_send_ceo_message','public')]) await db.exec(sql)
  await db.exec(`revoke all on function hq_private.chat_message(public.hq_agent_jobs,text,text,text[]),hq_private.workforce_enqueue(public.hq_agent_jobs,text,text,uuid,uuid,integer),hq_private.workforce_agent_assignable(text),hq_private.create_business_task(text,text,text,text,uuid),hq_private.cancel_business_task(uuid) from public,anon,authenticated,service_role`)
  await db.exec('grant execute on function hq_private.create_business_task(text,text,text,text,uuid),hq_private.cancel_business_task(uuid),public.hq_create_task(text,text,text,text,uuid),public.hq_cancel_task(uuid),hq_private.send_ceo_message(text,uuid),public.hq_send_ceo_message(text,uuid) to authenticated')
  await db.exec(await source('20261105235516_hq_voice_meetings.sql'))
  await db.query(`insert into auth.users values($1,'ceo@building-suit.com',now()),($2,'second@example.test',now())`, [founder, other])
  await db.query(`insert into auth.sessions values($1,$2,null),($3,$4,null)`, [sessions[founder],founder,sessions[other],other])
  await db.query("insert into auth.users values($1,'technical-worker@example.test',now())",[worker])
  await db.query('insert into auth.sessions values($1,$2,null)',[sessions[worker],worker])
  await db.query('insert into hq_private.agent_workers(worker_id,auth_user_id,enabled) values($1,$2,true)',[workerId,worker])
  await db.exec(`insert into hq_private.founder_invitations(email) values('second@example.test');
    update hq_private.agent_roster set profile_file_id='fixture-profile',model='gpt-6.1-sol',effort='low',lifecycle='active';
    update hq_private.agent_roster set manager_id='AG-CEO-001' where id='AG-HR-001';
    insert into hq_private.agent_roster(id,name,role,department_key,manager_id,profile_file_id,model,effort,lifecycle) values
      ('AG-HR-002','Noah','Researcher','hr-agent-development','AG-HR-001','fixture-profile','gpt-6.1-sol','low','active');
    insert into hq_private.meeting_agent_qualifications(agent_id,binding_digest,qualification_scope,evidence_reference)
      select id,hq_private.meeting_agent_binding_digest(id),'read-approved-sources-worker-job-600','Disposable synthetic qualification fixture only' from hq_private.agent_roster;`)
  for (const user of [founder,other]) assert.equal((await asUser(user, 'select public.hq_founder_access() as data')).isFounder,true)
})
after(async () => { await db?.close() })

async function asUser(user,sql,args=[]) {
  await db.query(`select set_config('request.jwt.claims',$1,false)`,[JSON.stringify({sub:user,role:'authenticated',session_id:sessions[user]})])
  await db.exec('set role authenticated')
  try { return (await db.query(sql,args)).rows[0]?.data }
  finally { await db.exec('reset role') }
}
async function create(user=founder) {
  return asUser(user,'select public.hq_meeting_create($1,$2,$3,$4::text[],$5) as data',[randomUUID(),'اجتماع تجريبي','ar',['AG-CEO-001','AG-HR-001','AG-HR-002'],randomUUID()])
}
const command = (id,value,key=randomUUID(),user=founder) => asUser(user,'select public.hq_meeting_command($1,$2::jsonb,$3) as data',[id,JSON.stringify(value),key])
const snapshot = (id,user=founder) => asUser(user,'select public.hq_meeting_snapshot($1) as data',[id])
function planTask(overrides={}) {
  return {id:'research',objective:'Inspect approved source evidence',ownerId:'AG-HR-002',supervisorId:'AG-HR-001',deliverable:'A source-attributed report',
    inputs:['fixture://repository'],dependencies:[],allowedActions:['read-approved-sources'],budget:0,acceptanceCriteria:['Reference an inspected source'],
    requiredReview:'independent',blockers:[],priority:1,environment:'hq-existing-worker',timeoutScope:'worker-job',timeLimitSeconds:600,...overrides}
}
async function proposed(meeting,overrides={}) {
  const planId=randomUUID()
  let record=await command(meeting,{type:'proposePlan',planId,document:{title:'Source evidence review',tasks:[planTask(overrides)]}})
  const plan=record.plans.at(-1)
  record=await command(meeting,{type:'submitPlan',planId,version:plan.version,digest:plan.digest})
  return record.plans.at(-1)
}
const approve = (meeting,plan,start='meeting-end',extra={}) => command(meeting,{type:'decidePlan',planId:plan.plan_id,version:plan.version,digest:plan.digest,decision:'approved',start,source:'control',confirmed:true,...extra})
const countTasks = async () => (await db.query('select count(*)::integer as n from public.hq_business_tasks')).rows[0].n

test('founder live-session boundary rejects cross-owner reads, commands and direct state writes',async () => {
  const {meeting}=await create()
  await assert.rejects(snapshot(meeting.id,other),/HQ_MEETING_NOT_FOUND/)
  await assert.rejects(command(meeting.id,{type:'end'},randomUUID(),other),/HQ_MEETING_NOT_FOUND/)
  await assert.rejects(asUser(founder,'select * from public.hq_meeting_task_links'),/permission denied/)
  await assert.rejects(asUser(founder,'select * from hq_private.meeting_agent_qualifications'),/permission denied/)
  await assert.rejects(asUser(founder,"select hq_private.meeting_dispatch($1,$2,1) as data",[meeting.id,randomUUID()]),/permission denied/)
  const rows=(await db.query(`select relname,relrowsecurity from pg_class where relname in ('hq_meetings','hq_meeting_task_links','hq_meeting_plan_versions','hq_meeting_events')`)).rows
  assert.equal(rows.length,4)
  assert.ok(rows.every(row=>row.relrowsecurity))
  assert.equal((await db.query("select to_regclass('public.hq_meeting_tasks') as queue,to_regprocedure('public.hq_meeting_worker(text,uuid,uuid,jsonb)') as worker")).rows[0].queue,null)
  assert.equal((await db.query("select to_regprocedure('public.hq_meeting_worker(text,uuid,uuid,jsonb)') as worker")).rows[0].worker,null)
  await db.query("update auth.sessions set not_after=now()-interval '1 second' where id=$1",[sessions[founder]])
  await assert.rejects(snapshot(meeting.id),/HQ_FOUNDER_REQUIRED/)
  await db.query('update auth.sessions set not_after=null where id=$1',[sessions[founder]])
  await command(meeting.id,{type:'end'})
})

test('conversation configuration does not infer research qualification, while stale work evidence still blocks execution',async () => {
  await assert.rejects(db.exec("update hq_private.meeting_agent_qualifications set evidence_reference=null where agent_id='AG-HR-002'"),/not-null constraint/)
  await assert.rejects(db.exec("update hq_private.meeting_agent_qualifications set evidence_reference='' where agent_id='AG-HR-002'"),/check constraint/)
  await db.exec("delete from hq_private.meeting_agent_qualifications where agent_id='AG-HR-002'")
  let {meeting}=await create()
  let roster=await asUser(founder,'select public.hq_meeting_roster() as data')
  const noah=roster.participants.find(r=>r.id==='AG-HR-002')
  assert.equal(noah.conversationAvailable,true); assert.equal(noah.workQualified,false); assert.equal(noah.qualified,false)
  const before=await countTasks()
  let record=await command(meeting.id,{type:'text',text:'Noah, answer from this meeting context.',addressedTo:'AG-HR-002'})
  assert.equal(record.turn.agentId,'AG-HR-002'); assert.equal(await countTasks(),before)
  const conversational=await claim()
  validateJob(conversational.job); assert.equal(webAllowed(conversational.job),false)
  await finish(conversational.job,{message:'[FIXTURE] Conversation without a work qualification claim',task:null})
  record=await snapshot(meeting.id)
  assert.equal(record.contributions.at(-1).status,'speaking'); assert.equal(await countTasks(),before)
  const plan=await proposed(meeting.id)
  record=await approve(meeting.id,plan,'now')
  assert.equal(record.plans.at(-1).status,'blocked'); assert.equal(record.tasks.length,0)
  await command(meeting.id,{type:'end'})
  await db.exec("insert into hq_private.meeting_agent_qualifications(agent_id,binding_digest,qualification_scope,evidence_reference) values('AG-HR-002',hq_private.meeting_agent_binding_digest('AG-HR-002'),'read-approved-sources-worker-job-600','Disposable synthetic qualification fixture only')")
  ;({meeting}=await create())
  const delayed=await proposed(meeting.id)
  await approve(meeting.id,delayed,'meeting-end')
  await db.exec("update hq_private.agent_roster set effort='high' where id='AG-HR-002'")
  try {
    record=await command(meeting.id,{type:'end'})
    assert.equal(record.plans.at(-1).status,'blocked'); assert.equal(await countTasks(),before)
  } finally { await db.exec("update hq_private.agent_roster set effort='low' where id='AG-HR-002'") }
  await db.exec("update hq_private.agent_roster set model='unsupported-model' where id='AG-HR-002'")
  try { await assert.rejects(create(),/HQ_MEETING_CONVERSATION_UNAVAILABLE/) }
  finally { await db.exec("update hq_private.agent_roster set model='gpt-6.1-sol' where id='AG-HR-002'") }
})

test('exact approval/end atomically enqueue existing task-route once; disconnect holds',async () => {
  const {meeting}=await create(),plan=await proposed(meeting.id),before=await countTasks()
  await assert.rejects(approve(meeting.id,plan,'meeting-end',{digest:'a'.repeat(64)}),/HQ_MEETING_PLAN_VERSION_CHANGED/)
  await approve(meeting.id,plan)
  let record=await command(meeting.id,{type:'disconnect'})
  assert.equal(record.tasks.length,0)
  assert.equal(record.meeting.status,'active')
  await command(meeting.id,{type:'reconnect'})
  const key=randomUUID()
  record=await command(meeting.id,{type:'end'},key)
  assert.deepEqual((await command(meeting.id,{type:'end'},key)).tasks,record.tasks)
  assert.equal(await countTasks(),before+1)
  assert.equal(record.plans.at(-1).status,'dispatched')
  const t=record.tasks[0]
  const row=(await db.query('select * from public.hq_business_tasks where id=$1',[t.id])).rows[0]
  assert.equal(row.founder_user_id,founder)
  assert.equal(row.requested_assignee_id,'AG-HR-002')
  assert.deepEqual(JSON.parse(row.brief).contract,plan.document.tasks[0])
  assert.equal(JSON.parse(row.brief).planVersion,plan.version)
  assert.equal(JSON.parse(row.brief).planDigest,plan.digest)
  assert.equal((await db.query('select kind from public.hq_agent_jobs where task_id=$1',[t.id])).rows[0].kind,'task-route')
  await assert.rejects(command(meeting.id,{type:'pause'},key),/HQ_REQUEST_KEY_REUSED/)
  await command(meeting.id,{type:'cancelTask',taskId:t.id})
  assert.equal((await snapshot(meeting.id)).tasks[0].business_status,'canceled')
})

test('casual speech, wrong source, unconfirmed control and stale immutable scope never approve',async () => {
  const {meeting}=await create(),plan=await proposed(meeting.id)
  await command(meeting.id,{type:'text',text:'OK approve everything',uncertain:true})
  await assert.rejects(approve(meeting.id,plan,'now',{source:'speech'}),/HQ_MEETING_EXPLICIT_DECISION_REQUIRED/)
  await assert.rejects(approve(meeting.id,plan,'now',{confirmed:false}),/HQ_MEETING_EXPLICIT_DECISION_REQUIRED/)
  await assert.rejects(db.query("update public.hq_meeting_plan_versions set document='{}' where meeting_id=$1",[meeting.id]),/HQ_MEETING_IMMUTABLE_PLAN_VERSION/)
  const result=await snapshot(meeting.id)
  assert.equal(result.plans.at(-1).status,'awaiting-approval')
  assert.equal(result.tasks.length,0)
  await command(meeting.id,{type:'end'})
})

test('revised, deferred and discarded versions cannot execute on meeting end',async () => {
  for (const decision of ['discarded','deferred']) {
    const {meeting}=await create(),old=await proposed(meeting.id)
    await approve(meeting.id,old)
    let record=await command(meeting.id,{type:'proposePlan',planId:old.plan_id,document:{title:'Changed scope',tasks:[planTask({objective:'Changed source scope'})]}})
    const changed=record.plans.at(-1)
    assert.equal(changed.version,2)
    assert.equal(record.plans[0].status,'revised')
    await assert.rejects(approve(meeting.id,old),/HQ_MEETING_PLAN_VERSION_CHANGED/)
    await command(meeting.id,{type:'decidePlan',planId:changed.plan_id,version:2,digest:changed.digest,decision,start:'manual',source:'control',confirmed:true})
    record=await command(meeting.id,{type:'end'})
    assert.equal(record.tasks.length,0)
  }
})

test('budget, identity, broad tools, incomplete scope and dependency cycles reject before approval',async () => {
  const {meeting}=await create()
  for (const changes of [{budget:1},{ownerId:'AG-FAKE-001'},{supervisorId:'AG-HR-002'},{allowedActions:['shell']},{acceptanceCriteria:[]},
    {requiredReview:null},{environment:null},{inputs:[null]},{allowedActions:[null]},{priority:1.5},{dependencies:['unknown']},{dependencies:['research']}]) await assert.rejects(proposed(meeting.id,changes))
  await assert.rejects(command(meeting.id,{type:'proposePlan',planId:randomUUID(),document:{title:'Cycle',tasks:[planTask({id:'a',dependencies:['b']}),planTask({id:'b',dependencies:['a']})]}}),/HQ_MEETING_DEPENDENCY_CYCLE/)
  await command(meeting.id,{type:'end'})
})

test('unsupported total deadlines, synthetic execution and blockers persist blocked outcomes without queue writes',async () => {
  const before=await countTasks()
  for (const changes of [{timeLimitSeconds:300,timeoutScope:'whole-task'},{environment:'synthetic',allowedActions:['synthetic-fixture']},{blockers:['Needs separate authorization']}]) {
    const {meeting}=await create(),plan=await proposed(meeting.id,changes)
    let record=await approve(meeting.id,plan,'now')
    assert.equal(record.plans.at(-1).status,'blocked')
    assert.equal(record.tasks.length,0)
    assert.ok(record.events.some(e=>e.kind==='plan-dispatch-blocked' && e.payload.error==='HQ_MEETING_SCOPE_UNSUPPORTED'))
    record=await command(meeting.id,{type:'end'})
    assert.equal(record.meeting.status,'ended')
  }
  assert.equal(await countTasks(),before)
})

test('dependency contracts and unavailable canonical owners block without silently changing scope',async () => {
  const {meeting}=await create(),planId=randomUUID(),before=await countTasks()
  let record=await command(meeting.id,{type:'proposePlan',planId,document:{title:'Ordered work',tasks:[planTask({id:'a'}),planTask({id:'b',dependencies:['a']})]}})
  let plan=record.plans.at(-1)
  await command(meeting.id,{type:'submitPlan',planId,version:plan.version,digest:plan.digest})
  record=await approve(meeting.id,plan,'now')
  assert.equal(record.plans.at(-1).status,'blocked')
  assert.equal(record.tasks.length,0)
  plan=await proposed(meeting.id)
  await approve(meeting.id,plan,'meeting-end')
  await db.exec("update hq_private.agent_roster set lifecycle='suspended' where id='AG-HR-002'")
  try {
    record=await command(meeting.id,{type:'end'})
    assert.equal(record.plans.at(-1).status,'blocked')
    assert.equal(record.tasks.length,0)
    assert.equal(await countTasks(),before)
  } finally { await db.exec("update hq_private.agent_roster set lifecycle='active' where id='AG-HR-002'") }
})

test('current helper push failure rolls back approval, task, job, link and event atomically',async () => {
  const {meeting}=await create(),plan=await proposed(meeting.id),before=await countTasks()
  await db.exec("select set_config('fixture.wake_failure','true',false)")
  await assert.rejects(approve(meeting.id,plan,'now'),/FIXTURE_PUSH_UNAVAILABLE/)
  await db.exec("select set_config('fixture.wake_failure','false',false)")
  const record=await snapshot(meeting.id)
  assert.equal(record.plans.at(-1).status,'awaiting-approval')
  assert.equal(record.tasks.length,0)
  assert.equal(await countTasks(),before)
  assert.ok(!record.events.some(e=>e.kind==='decidePlan'))
  await command(meeting.id,{type:'end'})
})

test('existing route cannot change exact approved owner before enqueue; matching owner remains allowed',async () => {
  const {meeting}=await create(),plan=await proposed(meeting.id)
  const record=await approve(meeting.id,plan,'now'),id=record.tasks[0].id
  await db.query("update public.hq_business_tasks set assignee_id='AG-HR-002' where id=$1",[id])
  const jobs=(await db.query('select count(*)::integer as n from public.hq_agent_jobs where task_id=$1',[id])).rows[0].n
  await db.exec('begin')
  try {
    await assert.rejects(db.query("with routed as (update public.hq_business_tasks set assignee_id='AG-HR-001' where id=$1 returning id) insert into public.hq_agent_jobs(conversation_id,founder_message_id,founder_user_id,agent_id,request_key,kind,task_id) select conversation_id,founder_message_id,founder_user_id,'AG-HR-001',gen_random_uuid(),'task-work',id from public.hq_business_tasks where id in (select id from routed)",[id]),/HQ_MEETING_OWNER_SCOPE_CHANGED/)
  } finally { await db.exec('rollback') }
  assert.equal((await db.query('select count(*)::integer as n from public.hq_agent_jobs where task_id=$1',[id])).rows[0].n,jobs)
  assert.equal((await snapshot(meeting.id)).tasks[0].assignee_id,'AG-HR-002')
  await command(meeting.id,{type:'cancelTask',taskId:id})
  await command(meeting.id,{type:'end'})
})

test('founder research uses existing queue, idempotency and linked owner-scoped cancellation',async () => {
  const {meeting}=await create(),{meeting:theirs}=await create(other),key=randomUUID(),task=planTask(),before=await countTasks()
  let record=await command(meeting.id,{type:'research',task},key)
  assert.equal(record.tasks[0].kind,'research')
  assert.equal(record.tasks[0].plan_id,null)
  assert.equal((await command(meeting.id,{type:'research',task},key)).tasks[0].id,record.tasks[0].id)
  assert.equal(await countTasks(),before+1)
  await assert.rejects(command(theirs.id,{type:'cancelTask',taskId:record.tasks[0].id},randomUUID(),other),/HQ_MEETING_TASK_NOT_CANCELLABLE/)
  record=await command(meeting.id,{type:'cancelTask',taskId:record.tasks[0].id})
  assert.equal(record.tasks[0].status,'cancelled')
  await command(meeting.id,{type:'end'})
  await command(theirs.id,{type:'end'},randomUUID(),other)
})

test('report only acknowledges actual workforce completion and never creates review or worker output',async () => {
  const {meeting}=await create(),record=await command(meeting.id,{type:'research',task:planTask()}),id=record.tasks[0].id
  await assert.rejects(command(meeting.id,{type:'report',taskId:id}),/HQ_MEETING_FINDING_UNAVAILABLE/)
  // Disposable fixture receipt: simulates already committed canonical worker
  // output. No meeting worker/model is run and no review acceptance is invented.
  await db.query("update public.hq_business_tasks set status='completed',deliverable='Fixture report',review_summary='Fixture existing review',completed_at=now() where id=$1",[id])
  const result=await command(meeting.id,{type:'report',taskId:id})
  assert.equal(result.tasks[0].hand_raised,false)
  assert.equal(result.tasks[0].result.deliverable,'Fixture report')
  assert.deepEqual(result.tasks[0].review_receipts,[])
  await assert.rejects(command(meeting.id,{type:'report',taskId:id}),/HQ_MEETING_FINDING_UNAVAILABLE/)
  await command(meeting.id,{type:'end'})
})


test('fresh technical worker claims through current delegate; stale meeting job cannot starve unrelated work',async () => {
  // The final report fixture intentionally did not run its queue. Clean only
  // disposable fixture jobs before exercising the actual current claim helper.
  await db.exec("update public.hq_agent_jobs set status='blocked',error='fixture-cleanup',completed_at=now() where status='queued'")
  await assert.rejects(asUser(founder,'select public.hq_worker_claim($1,300) as data',[workerId]),/HQ_WORKER_REQUIRED/)
  await assert.rejects(asUser(worker,'select public.hq_worker_claim($1,300) as data',[randomUUID()]),/HQ_WORKER_REQUIRED/)
  await assert.rejects(asUser(worker,'select hq_private.worker_claim_before_meetings($1,300) as data',[workerId]),/permission denied/)
  let {meeting}=await create()
  let record=await command(meeting.id,{type:'research',task:planTask()})
  const first=await asUser(worker,'select public.hq_worker_claim($1,300) as data',[workerId])
  assert.equal(first.job.context.task.id,record.tasks[0].id)
  assert.equal(first.job.context.agent.id,'AG-CEO-001')
  assert.ok(first.job.lease_token)
  await command(meeting.id,{type:'cancelTask',taskId:record.tasks[0].id})
  await command(meeting.id,{type:'end'})

  ;({meeting}=await create())
  record=await command(meeting.id,{type:'research',task:planTask()})
  const linked=record.tasks[0].id
  const normalKey=randomUUID()
  await asUser(founder,'select public.hq_create_task($1,$2,$3,$4,$5) as data',['Normal contract fixture','Read an approved fixture','Return a bounded draft','AG-CEO-001',normalKey])
  const normal=(await db.query('select id from public.hq_business_tasks where request_key=$1',[normalKey])).rows[0].id
  await db.exec("update hq_private.agent_roster set effort='high' where id='AG-HR-002'")
  try {
    const next=await asUser(worker,'select public.hq_worker_claim($1,300) as data',[workerId])
    assert.equal(next.job.context.task.id,normal)
    assert.equal((await db.query('select status,error from public.hq_business_tasks where id=$1',[linked])).rows[0].error,'meeting-qualification-stale')
    assert.equal((await db.query('select status from public.hq_agent_jobs where task_id=$1',[linked])).rows[0].status,'blocked')
  } finally { await db.exec("update hq_private.agent_roster set effort='low' where id='AG-HR-002'") }
  await asUser(founder,'select public.hq_cancel_task($1) as data',[normal])
  await command(meeting.id,{type:'end'})
})


test('current owner reports remain claimable while stale independent reviewers block before invocation',async () => {
  let {meeting}=await create()
  let record=await command(meeting.id,{type:'research',task:planTask()})
  let id=record.tasks[0].id
  // Disposable pending-stage fixture: claim the real current report stage,
  // without inventing a completed work/review artifact or invoking a provider.
  await db.query("update public.hq_agent_jobs set kind='task-report',agent_id='AG-HR-002' where task_id=$1",[id])
  let claimed=await asUser(worker,'select public.hq_worker_claim($1,300) as data',[workerId])
  assert.equal(claimed.job.context.mode,'task-report')
  assert.equal(claimed.job.agent_id,'AG-HR-002')
  await command(meeting.id,{type:'cancelTask',taskId:id})
  await command(meeting.id,{type:'end'})

  ;({meeting}=await create())
  record=await command(meeting.id,{type:'research',task:planTask()})
  id=record.tasks[0].id
  await db.query("update public.hq_agent_jobs set kind='head-review',agent_id='AG-HR-001' where task_id=$1",[id])
  await db.exec("update hq_private.agent_roster set effort='high' where id='AG-HR-001'")
  try {
    claimed=await asUser(worker,'select public.hq_worker_claim($1,300) as data',[workerId])
    assert.equal(claimed.job,null)
    assert.equal((await db.query('select error from public.hq_agent_jobs where task_id=$1',[id])).rows[0].error,'meeting-qualification-stale')
  } finally { await db.exec("update hq_private.agent_roster set effort='low' where id='AG-HR-001'") }
  await command(meeting.id,{type:'end'})
})


const claim = (protocol=1) => asUser(worker,'select public.hq_worker_claim($1,300,$2) as data',[workerId,protocol])
const legacyClaim = () => asUser(worker,'select public.hq_worker_claim($1,300) as data',[workerId])
const finish = (job,reply) => asUser(worker,"select public.hq_worker_finish_v2($1,$2,$3,$4,null,'[]'::jsonb) as data",[job.id,job.lease_token,workerId,JSON.stringify(reply)])
const clearFixtureQueue = () => db.exec("update public.hq_agent_jobs set status='blocked',error='fixture-cleanup',completed_at=now() where status='queued'")
async function persistedTaskFixture(taskId,text='[FIXTURE] Correlated inspected finding',attempt=0) {
  // Synthetic committed output only. This seeds canonical immutable artifact
  // tables and does not claim an actual provider or independent reviewer ran.
  const jobId=randomUUID(),artifactId=randomUUID()
  await db.query("insert into public.hq_agent_jobs(id,conversation_id,founder_message_id,founder_user_id,agent_id,request_key,kind,task_id,status,completed_at,result_digest,attempt) select $1,conversation_id,founder_message_id,founder_user_id,assignee_id,request_key,'task-work',id,'completed',now(),encode(sha256(convert_to($2,'UTF8')),'hex'),$4 from public.hq_business_tasks where id=$3",[jobId,text,taskId,attempt])
  await db.query("insert into public.hq_task_artifacts(id,task_id,job_id,agent_id,kind,text,digest) select $1,id,$2,assignee_id,'task-work',$3,encode(sha256(convert_to($3,'UTF8')),'hex') from public.hq_business_tasks where id=$4",[artifactId,jobId,text,taskId])
  await db.query("update public.hq_business_tasks set status='completed',deliverable=$2,completed_at=now(),updated_at=now() where id=$1",[taskId,text])
  return artifactId
}

test('source roster and latest recovery expose only founder-safe canonical fields',async () => {
  const roster=await asUser(founder,'select public.hq_meeting_roster() as data')
  assert.equal(roster.participants.length,3)
  assert.ok(roster.participants.every(r=>r.conversationAvailable && r.workQualified && r.qualified && r.name.length<=160 && r.role.length<=200))
  assert.ok(roster.participants.every(r=>!('model' in r) && !('evidence_reference' in r) && !('profile_file_id' in r)))
  const {meeting}=await create()
  const latest=await asUser(founder,'select public.hq_meeting_snapshot(null) as data')
  assert.equal(latest.meeting.id,meeting.id)
  await assert.rejects(asUser(worker,'select public.hq_meeting_roster() as data'),/HQ_FOUNDER_REQUIRED/)
  await command(meeting.id,{type:'end'})
})

test('text asynchronously correlates genuine response-only CEO output, one floor and playback receipt',async () => {
  await clearFixtureQueue()
  const {meeting}=await create(),key=randomUUID()
  let record=await command(meeting.id,{type:'text',text:'Give a brief meeting response.'},key)
  let c=record.contributions.at(-1)
  assert.equal(c.status,'thinking'); assert.equal(c.response_text,null)
  assert.equal(record.turn.agentId,'AG-CEO-001')
  record=await command(meeting.id,{type:'continue'})
  assert.equal(record.meeting.floor,'AG-CEO-001'); assert.equal(record.turn.status,'thinking')
  assert.equal((await command(meeting.id,{type:'text',text:'Give a brief meeting response.'},key)).contributions.length,1)
  await assert.rejects(command(meeting.id,{type:'text',text:'Question',response_text:'Forged reply'}),/HQ_INVALID_DOCUMENT_SHAPE/)
  const {job}=await claim()
  assert.equal(job.id,c.job_id)
  assert.deepEqual(job.context.messages,[])
  await finish(job,{message:'[FIXTURE] Persisted response-only CEO output',task:null})
  record=await snapshot(meeting.id); c=record.contributions.at(-1)
  assert.equal(c.status,'speaking')
  assert.equal(c.response_text,'[FIXTURE] Persisted response-only CEO output')
  assert.ok(c.response_message_id && c.founder_message_id && c.response_digest)
  assert.ok(record.events.some(e=>e.id===c.source_event_id && e.kind==='text'))
  assert.equal(record.turn.id,c.id)
  record=await command(meeting.id,{type:'continue'})
  assert.equal(record.meeting.floor,'AG-CEO-001'); assert.equal(record.turn.status,'speaking')
  await assert.rejects(command(meeting.id,{type:'speechEnded',contributionId:c.id,generation:c.generation+1}),/HQ_MEETING_STALE_CONTRIBUTION/)
  record=await command(meeting.id,{type:'playback-ended',turnId:c.id,generation:c.generation})
  assert.equal(record.turn,null); assert.equal(record.meeting.floor,null)
  assert.equal(record.contributions.at(-1).status,'completed')
  await command(meeting.id,{type:'end'})
})

test('meeting CEO intake cannot create model-suggested work; ordinary chat retains its current contract',async () => {
  await clearFixtureQueue()
  const {meeting}=await create(),before=await countTasks()
  await command(meeting.id,{type:'text',text:'Discuss the next step without creating work.'})
  let claimed=await claim()
  const suggested={message:'@Noah fixture suggested action',task:{title:'Unapproved model work',brief:'Do not run this fixture',acceptance:'A fixture only',assigneeId:'AG-HR-002'}}
  await finish(claimed.job,suggested)
  const record=await snapshot(meeting.id)
  assert.equal(await countTasks(),before)
  assert.equal(record.contributions.at(-1).status,'failed')
  assert.equal(record.contributions.at(-1).error,'meeting-response-only')
  assert.equal(record.contributions.at(-1).response_text,null)
  await command(meeting.id,{type:'end'})
  const key=randomUUID()
  await asUser(founder,'select public.hq_send_ceo_message($1,$2) as data',['Ordinary chat fixture',key])
  claimed=await claim()
  assert.equal(claimed.job.context.mode,'conversation-intake')
  await finish(claimed.job,suggested)
  assert.equal(await countTasks(),before+1)
  const ordinary=(await db.query('select id from public.hq_business_tasks where request_key=$1',[key])).rows[0].id
  await asUser(founder,'select public.hq_cancel_task($1) as data',[ordinary])
})

test('stale CEO conversation binding blocks before invocation, while ordinary chat is untouched',async () => {
  await clearFixtureQueue()
  const {meeting}=await create()
  let record=await command(meeting.id,{type:'text',text:'Pending qualified response'})
  const linked=record.contributions.at(-1).job_id,key=randomUUID()
  await asUser(founder,'select public.hq_send_ceo_message($1,$2) as data',['Unrelated ordinary chat fixture',key])
  await db.exec("update hq_private.agent_roster set effort='high' where id='AG-CEO-001'")
  try {
    const claimed=await claim()
    assert.notEqual(claimed.job.id,linked)
    assert.equal((await db.query('select error from public.hq_agent_jobs where id=$1',[linked])).rows[0].error,'meeting-binding-stale')
    await finish(claimed.job,{message:'[FIXTURE] Normal chat remains unchanged',task:null})
    record=await snapshot(meeting.id)
    assert.equal(record.contributions.at(-1).status,'failed')
  } finally { await db.exec("update hq_private.agent_roster set effort='low' where id='AG-CEO-001'") }
  await command(meeting.id,{type:'end'})
})

test('interrupt rejects completed but unsynchronized output and preserves unrelated approved tasks',async () => {
  await clearFixtureQueue()
  const {meeting}=await create()
  await command(meeting.id,{type:'text',text:'Response whose playback will be interrupted'})
  const {job}=await claim()
  const plan=await proposed(meeting.id)
  let record=await approve(meeting.id,plan,'now')
  const approved=record.tasks.find(t=>t.kind==='execution')
  await finish(job,{message:'[FIXTURE] Late correlated output',task:null})
  record=await command(meeting.id,{type:'interrupt'})
  const revision=record.meeting.revision
  record=await snapshot(meeting.id)
  assert.equal(record.turn,null)
  assert.equal(record.contributions.at(-1).status,'interrupted')
  assert.equal(record.contributions.at(-1).response_text,null)
  assert.equal(record.tasks.find(t=>t.id===approved.id).status,'queued')
  assert.ok(record.meeting.revision>=revision)
  await command(meeting.id,{type:'cancelTask',taskId:approved.id})
  await command(meeting.id,{type:'end'})
})

test('actual head conversation is one tool-disabled intake receipt; research findings stay separate',async () => {
  await clearFixtureQueue()
  const {meeting}=await create(),before=await countTasks()
  let record=await command(meeting.id,{type:'text',text:'Noah, answer this meeting question.',addressedTo:'AG-HR-002'})
  let c=record.contributions.at(-1)
  assert.equal(c.source_kind,'head-chat'); assert.equal(c.business_task_id,null)
  assert.equal(record.tasks.length,0); assert.equal(await countTasks(),before)
  const {job}=await claim()
  assert.equal(job.agent_id,'AG-HR-002'); assert.equal(job.context.agent.id,'AG-HR-002')
  assert.equal(job.context.agent.model,'gpt-6.1-sol'); assert.equal(job.context.mode,'conversation-intake')
  assert.deepEqual(job.context.meetingResponse,{protocol:1,scope:'conversation-only',meetingId:meeting.id,contributionId:c.id,generation:c.generation,agentId:c.agent_id,bindingDigest:c.binding_digest})
  validateJob(job); assert.equal(webAllowed(job),false)
  await finish(job,{message:'[FIXTURE] Actual named-head response',task:null})
  record=await snapshot(meeting.id); c=record.contributions.at(-1)
  assert.equal(c.status,'speaking'); assert.ok(c.response_message_id)
  assert.equal((await db.query('select agent_id from public.hq_agent_messages where id=$1',[c.response_message_id])).rows[0].agent_id,'AG-HR-002')
  assert.equal(await countTasks(),before)
  await command(meeting.id,{type:'speechEnded',contributionId:c.id,generation:c.generation})
  record=await command(meeting.id,{type:'research',task:planTask({id:'invited-finding'})})
  const research=record.tasks.find(t=>t.task_key==='invited-finding')
  await persistedTaskFixture(research.id)
  record=await command(meeting.id,{type:'invite',agentId:'AG-HR-002'})
  c=record.contributions.at(-1)
  assert.equal(c.source_kind,'finding'); assert.equal(c.status,'speaking')
  assert.equal(record.tasks.find(t=>t.id===research.id).reported_at,null)
  await command(meeting.id,{type:'interrupt'})
  assert.equal((await snapshot(meeting.id)).tasks.find(t=>t.id===research.id).business_status,'completed')
  record=await command(meeting.id,{type:'invite',agentId:'AG-HR-002'}); c=record.contributions.at(-1)
  record=await command(meeting.id,{type:'speechEnded',contributionId:c.id,generation:c.generation})
  assert.ok(record.tasks.find(t=>t.id===research.id).reported_at)
  await command(meeting.id,{type:'end'})
})

async function persistedReviewFixture(taskId,inputId,accepted,attempt=0,kind='head-review') {
  const input=(await db.query('select digest from public.hq_task_artifacts where id=$1',[inputId])).rows[0]
  const jobId=randomUUID(),id=randomUUID(),agent=kind==='head-review'?'AG-HR-001':'AG-CEO-001'
  const text=JSON.stringify({accepted,summary:'Disposable review receipt fixture',artifactDigest:input.digest})
  await db.query("insert into public.hq_agent_jobs(id,conversation_id,founder_message_id,founder_user_id,agent_id,request_key,kind,task_id,status,completed_at,result_digest,artifact_id,attempt) select $1,conversation_id,founder_message_id,founder_user_id,$2,request_key,$3,id,'completed',now(),encode(sha256(convert_to($4,'UTF8')),'hex'),$5,$6 from public.hq_business_tasks where id=$7",[jobId,agent,kind,text,inputId,attempt,taskId])
  await db.query("insert into public.hq_task_artifacts(id,task_id,job_id,agent_id,kind,text,digest,input_artifact_id) values($1,$2,$3,$4,$5,$6,encode(sha256(convert_to($6,'UTF8')),'hex'),$7)",[id,taskId,jobId,agent,kind,text,inputId])
  return id
}

test('review receipts preserve actual rejected decisions and bind accepted history to its exact artifact',async () => {
  const {meeting}=await create()
  let record=await command(meeting.id,{type:'research',task:planTask({id:'receipt-proof'})})
  const id=record.tasks[0].id,old=await persistedTaskFixture(id,'[FIXTURE] Older repaired output',0)
  const rejected=await persistedReviewFixture(id,old,false,0)
  await persistedReviewFixture(id,old,true,0,'ceo-review')
  const current=await persistedTaskFixture(id,'[FIXTURE] Current delivered output',1)
  record=await snapshot(meeting.id)
  const task=record.tasks[0],receipt=task.review_receipts.find(r=>r.id===rejected)
  assert.equal(task.delivered_artifact_id,current)
  assert.ok(task.delivered_digest)
  assert.equal(receipt.accepted,false)
  assert.equal(receipt.input_artifact_id,old)
  assert.ok(receipt.input_digest && receipt.created_at)
  assert.notEqual(receipt.input_artifact_id,task.delivered_artifact_id)
  await command(meeting.id,{type:'end'})
})

test('meeting context keeps exact current plan decision refs and scopes ambiguous recent chat links',async () => {
  await clearFixtureQueue()
  const {meeting}=await create(),plan=await proposed(meeting.id)
  await approve(meeting.id,plan,'meeting-end')
  await command(meeting.id,{type:'chat',text:'First source https://github.com/example/one'})
  await command(meeting.id,{type:'chat',text:'Second source https://github.com/example/two'})
  const exact='What is the link we should inspect?'
  const record=await command(meeting.id,{type:'text',text:exact})
  const {job}=await claim(),context=JSON.parse(job.prompt)
  assert.equal(context.founder.text,exact)
  assert.equal(context.currentPlan.planId,plan.plan_id)
  assert.equal(context.currentPlan.version,plan.version)
  assert.equal(context.currentPlan.digest,plan.digest)
  assert.equal(context.currentPlan.decision,'approved')
  assert.ok(record.events.some(e=>e.id===context.currentPlan.decisionEventId && e.kind==='decidePlan'))
  assert.equal(context.reference.status,'ambiguous')
  assert.equal(context.reference.clarificationRequired,true)
  assert.equal(context.reference.candidateCount,2)
  assert.equal(context.reference.sourceEventIds.length,2)
  assert.ok(context.recent.some(e=>e.speakerId===founder && e.kind==='chat'))
  assert.ok(!job.prompt.includes('https://github.com/example/one') && !job.prompt.includes('https://github.com/example/two'))
  assert.deepEqual(job.context.messages,[])
  assert.ok(job.prompt.length<=4000)
  await command(meeting.id,{type:'interrupt'})
  await command(meeting.id,{type:'decidePlan',planId:plan.plan_id,version:plan.version,digest:plan.digest,decision:'deferred',start:'manual',source:'control',confirmed:true})
  await command(meeting.id,{type:'end'})
})

test('context rejects oversize current utterance without truncating or enqueuing it',async () => {
  await clearFixtureQueue()
  const {meeting}=await create(),before=(await db.query('select count(*)::integer as n from public.hq_agent_jobs')).rows[0].n
  await assert.rejects(command(meeting.id,{type:'text',text:'x'.repeat(3900)}),/HQ_MEETING_CONTEXT_CAPACITY/)
  const record=await snapshot(meeting.id)
  assert.equal(record.contributions.length,0)
  assert.ok(!record.events.some(e=>e.kind==='text'))
  assert.equal((await db.query('select count(*)::integer as n from public.hq_agent_jobs')).rows[0].n,before)
  await command(meeting.id,{type:'end'})
})


test('live text routes canonical names and exact reversible controls without interpreting approvals',async () => {
  await clearFixtureQueue()
  const {meeting}=await create()
  let record=await command(meeting.id,{type:'text',text:'Noah, give a concise response.'})
  assert.equal(record.turn.agentId,'AG-HR-002')
  const responseJob=record.contributions.at(-1).job_id
  record=await command(meeting.id,{type:'text',text:'Stop!'})
  assert.equal(record.meeting.paused,true); assert.equal(record.turn,null)
  assert.equal((await db.query('select status from public.hq_agent_jobs where id=$1',[responseJob])).rows[0].status,'blocked')
  record=await command(meeting.id,{type:'text',text:'Continue'})
  assert.equal(record.meeting.paused,false); assert.equal(record.turn.agentId,'AG-CEO-001')
  record=await command(meeting.id,{type:'text',text:'Noah, discuss this with Amaya.'})
  assert.equal(record.turn.agentId,'AG-CEO-001')
  const prompt=(await db.query('select text from public.hq_agent_messages where id=$1',[record.contributions.at(-1).founder_message_id])).rows[0].text
  assert.equal(JSON.parse(prompt).addressing.clarificationRequired,true)
  record=await command(meeting.id,{type:'text',text:'Pause',uncertain:true})
  assert.equal(record.meeting.paused,false); assert.equal(record.turn,null)
  await command(meeting.id,{type:'end'})
})


test('legacy claims visibly block unsupported head intakes and still drain ordinary and Steve jobs',async () => {
  await clearFixtureQueue()
  const {meeting}=await create()
  let record=await command(meeting.id,{type:'text',text:'Noah, this needs protocol one.',addressedTo:'AG-HR-002'})
  const head=record.contributions.at(-1),ordinary=randomUUID()
  await asUser(founder,'select public.hq_send_ceo_message($1,$2) as data',['Ordinary compatibility fixture',ordinary])
  let claimed=await legacyClaim()
  assert.notEqual(claimed.job.id,head.job_id); assert.equal(claimed.job.agent_id,'AG-CEO-001')
  assert.equal('meetingResponse' in claimed.job.context,false)
  validateJob(claimed.job)
  await finish(claimed.job,{message:'[FIXTURE] Old host ordinary chat',task:null})
  record=await snapshot(meeting.id)
  assert.equal(record.contributions.at(-1).status,'blocked')
  assert.equal(record.contributions.at(-1).error,'meeting-protocol-required')
  await clearFixtureQueue()
  record=await command(meeting.id,{type:'text',text:'Steve, continue the compatible conversation.'})
  claimed=await legacyClaim()
  assert.equal(claimed.job.id,record.contributions.at(-1).job_id)
  assert.equal('meetingResponse' in claimed.job.context,false)
  validateJob(claimed.job); assert.equal(webAllowed(claimed.job),false)
  await finish(claimed.job,{message:'[FIXTURE] Compatible Steve meeting reply',task:null})
  await command(meeting.id,{type:'end'})
})

test('protocol head intake rejects work creation and stale actual bindings before inference',async () => {
  await clearFixtureQueue()
  const {meeting}=await create(),before=await countTasks()
  await command(meeting.id,{type:'text',text:'Noah, ordinary conversation only.',addressedTo:'AG-HR-002'})
  let claimed=await claim()
  await finish(claimed.job,{message:'Fixture rejected task',task:{title:'Unapproved',brief:'Not allowed',acceptance:'No execution',assigneeId:'AG-HR-002'}})
  let record=await snapshot(meeting.id)
  assert.equal(record.contributions.at(-1).error,'meeting-response-only')
  assert.equal(await countTasks(),before)
  record=await command(meeting.id,{type:'text',text:'Noah, new binding fence.',addressedTo:'AG-HR-002'})
  const linked=record.contributions.at(-1).job_id
  await db.exec("update hq_private.agent_roster set effort='high' where id='AG-HR-002'")
  try {
    claimed=await claim()
    assert.equal(claimed.job,null)
    assert.equal((await db.query('select error from public.hq_agent_jobs where id=$1',[linked])).rows[0].error,'meeting-binding-stale')
  } finally { await db.exec("update hq_private.agent_roster set effort='low' where id='AG-HR-002'") }
  await assert.rejects(claim(2),/HQ_MEETING_PROTOCOL_UNSUPPORTED/)
  await command(meeting.id,{type:'end'})
})
