import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { after, before, test } from 'node:test'
import { PGlite } from '@electric-sql/pglite'

const foundation = new URL('../../supabase/migrations/20261104194233_hq_founder_company_plans.sql', import.meta.url)
const migration = new URL('../../supabase/migrations/20261105210955_hq_voice_meetings.sql', import.meta.url)
const founder = '10000000-0000-4000-8000-000000000001'
const other = '10000000-0000-4000-8000-000000000002'
const sessions = { [founder]: '20000000-0000-4000-8000-000000000001', [other]: '20000000-0000-4000-8000-000000000002' }
let db

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
  await db.exec(await readFile(foundation, 'utf8'))
  await db.exec(await readFile(migration, 'utf8'))
  await db.query(`insert into auth.users values($1,'ceo@building-suit.com',now()),($2,'second@example.test',now())`, [founder, other])
  await db.query(`insert into auth.sessions values($1,$2,null),($3,$4,null)`, [sessions[founder],founder,sessions[other],other])
  await db.exec(`insert into hq_private.founder_invitations(email) values('second@example.test');
    insert into hq_private.meeting_agent_bindings(agent_id,display_name,supervisor_id,registry_reference) values
    ('AG-CEO-001','Steve',null,'synthetic registry fixture'),
    ('AG-HR-001','Amaya','AG-CEO-001','synthetic registry fixture'),
    ('AG-HR-002','Noah','AG-HR-001','synthetic registry fixture');`)
  for (const user of [founder,other]) {
    const result = await asUser(user, 'select public.hq_founder_access() as data')
    assert.equal(result.isFounder,true)
  }
})
after(async () => { await db?.close() })

async function asUser(user,sql,args=[]) {
  await db.query(`select set_config('request.jwt.claims',$1,false)`,[JSON.stringify({sub:user,role:'authenticated',session_id:sessions[user]})])
  await db.exec(`set role authenticated`)
  try { return (await db.query(sql,args)).rows[0]?.data }
  finally { await db.exec('reset role') }
}
async function asWorker(action,id=null,lease=null,payload={agentId:'AG-HR-002'}) {
  await db.query(`select set_config('request.jwt.claims',$1,false)`,[JSON.stringify({role:'service_role'})])
  await db.exec('set role service_role')
  try { return (await db.query('select public.hq_meeting_worker($1,$2,$3,$4::jsonb) as data',[action,id,lease,JSON.stringify(payload)])).rows[0].data }
  finally { await db.exec('reset role') }
}
async function create(user=founder) {
  const id=randomUUID()
  return asUser(user,'select public.hq_meeting_create($1,$2,$3,$4::text[],$5) as data',[id,'اجتماع تجريبي','ar',['AG-CEO-001','AG-HR-001','AG-HR-002'],randomUUID()])
}
const command = (id,value,key=randomUUID(),user=founder) => asUser(user,'select public.hq_meeting_command($1,$2::jsonb,$3) as data',[id,JSON.stringify(value),key])
const snapshot = (id,user=founder) => asUser(user,'select public.hq_meeting_snapshot($1) as data',[id])
function planTask(overrides={}) {
  return {id:'research',objective:'Inspect approved synthetic repository evidence',ownerId:'AG-HR-002',supervisorId:'AG-HR-001',
    deliverable:'A source-attributed report',inputs:['fixture://repository'],dependencies:[],allowedActions:['synthetic-fixture'],budget:0,
    acceptanceCriteria:['Reference an inspected synthetic fixture'],requiredReview:'independent',blockers:[],priority:1,environment:'synthetic',timeLimitSeconds:300,...overrides}
}
async function proposed(meeting,overrides={}) {
  const planId=randomUUID()
  let record=await command(meeting,{type:'proposePlan',planId,document:{title:'Synthetic evidence review',tasks:[planTask(overrides)]}})
  const plan=record.plans.at(-1)
  record=await command(meeting,{type:'submitPlan',planId,version:plan.version,digest:plan.digest})
  return record.plans.at(-1)
}
const approve = (meeting,plan,start='meeting-end',extra={}) => command(meeting,{type:'decidePlan',planId:plan.plan_id,version:plan.version,digest:plan.digest,decision:'approved',start,source:'control',confirmed:true,...extra})

test('SQL uses current founder boundary, denies cross-owner reads/writes and direct table access',async () => {
  const record=await create(),id=record.meeting.id
  await assert.rejects(snapshot(id,other),/HQ_MEETING_NOT_FOUND/)
  await assert.rejects(command(id,{type:'end'},randomUUID(),other),/HQ_MEETING_NOT_FOUND/)
  await assert.rejects(asUser(founder,'select * from public.hq_meeting_tasks'),/permission denied/)
  await assert.rejects(asUser(founder,"select public.hq_meeting_worker('claim',null,null,'{\"agentId\":\"AG-HR-002\"}') as data"),/permission denied/)
  const rows=(await db.query(`select relname,relrowsecurity from pg_class where relname in ('hq_meetings','hq_meeting_tasks','hq_meeting_plan_versions','hq_meeting_events')`)).rows
  assert.equal(rows.length,4)
  assert.ok(rows.every(row=>row.relrowsecurity))
  await db.query('update auth.sessions set not_after=now()-interval \'1 second\' where id=$1',[sessions[founder]])
  await assert.rejects(snapshot(id),/HQ_FOUNDER_REQUIRED/)
  await db.query('update auth.sessions set not_after=null where id=$1',[sessions[founder]])
  await command(id,{type:'end'})
})

test('exact immutable plan approval dispatches once on intentional end; disconnect holds',async () => {
  const {meeting}=await create(),plan=await proposed(meeting.id)
  await assert.rejects(approve(meeting.id,plan,'meeting-end',{digest:'a'.repeat(64)}),/HQ_MEETING_PLAN_VERSION_CHANGED/)
  await approve(meeting.id,plan)
  let record=await command(meeting.id,{type:'disconnect'})
  assert.equal(record.tasks.length,0)
  assert.equal(record.meeting.status,'active')
  await command(meeting.id,{type:'reconnect'})
  const key=randomUUID()
  record=await command(meeting.id,{type:'end'},key)
  const replay=await command(meeting.id,{type:'end'},key)
  assert.equal(record.tasks.length,1)
  assert.deepEqual(replay.tasks,record.tasks)
  assert.equal(record.plans.at(-1).status,'dispatched')
  await assert.rejects(command(meeting.id,{type:'pause'},key),/HQ_REQUEST_KEY_REUSED/)
  assert.equal(record.executorEnabled,false)
  await assert.rejects(asWorker('claim'),/HQ_MEETING_EXECUTOR_UNQUALIFIED/)
  await command(meeting.id,{type:'cancelTask',taskId:record.tasks[0].id})
})

test('uncertain speech, casual OK, wrong source and unconfirmed approval never approve',async () => {
  const {meeting}=await create(),plan=await proposed(meeting.id)
  await command(meeting.id,{type:'text',text:'OK approve everything',uncertain:true})
  await assert.rejects(approve(meeting.id,plan,'now',{source:'speech'}),/HQ_MEETING_EXPLICIT_DECISION_REQUIRED/)
  await assert.rejects(approve(meeting.id,plan,'now',{confirmed:false}),/HQ_MEETING_EXPLICIT_DECISION_REQUIRED/)
  const result=await snapshot(meeting.id)
  assert.equal(result.plans.at(-1).status,'awaiting-approval')
  assert.equal(result.tasks.length,0)
  await command(meeting.id,{type:'end'})
})

test('revision invalidates earlier approval; discarded/deferred plans cannot execute at end',async () => {
  for (const decision of ['discarded','deferred']) {
    const {meeting}=await create(),old=await proposed(meeting.id)
    await approve(meeting.id,old)
    let result=await command(meeting.id,{type:'proposePlan',planId:old.plan_id,document:{title:'Changed scope',tasks:[planTask({objective:'Changed inspect scope'})]}})
    const changed=result.plans.at(-1)
    assert.equal(changed.version,2)
    assert.equal(result.plans[0].status,'revised')
    await assert.rejects(approve(meeting.id,old),/HQ_MEETING_PLAN_VERSION_CHANGED/)
    await command(meeting.id,{type:'decidePlan',planId:changed.plan_id,version:changed.version,digest:changed.digest,decision,start:'manual',source:'control',confirmed:true})
    result=await command(meeting.id,{type:'end'})
    assert.equal(result.tasks.length,0)
  }
})

test('budget, unknown staff, self supervision, broad tools and incomplete tasks are rejected',async () => {
  const {meeting}=await create()
  for (const changes of [{budget:1},{ownerId:'AG-FAKE-001'},{supervisorId:'AG-HR-002'}, {allowedActions:['shell']},{acceptanceCriteria:[]},
    {requiredReview:null},{environment:null},{inputs:[null]},{dependencies:['unknown']},{dependencies:['research']}]) {
    await assert.rejects(proposed(meeting.id,changes))
  }
  await assert.rejects(command(meeting.id,{type:'text',text:'hello',addressedTo:'AG-FAKE-001'}),/HQ_MEETING_UNKNOWN_PARTICIPANT/)
  await assert.rejects(command(meeting.id,{type:'proposePlan',planId:randomUUID(),document:{title:'Cycle',tasks:[
    planTask({id:'a',dependencies:['b']}),planTask({id:'b',dependencies:['a']})
  ]}}),/HQ_MEETING_DEPENDENCY_CYCLE/)
  await command(meeting.id,{type:'end'})
})

test('leased worker completion raises a hand; independent review and report are separate',async () => {
  const {meeting}=await create(),plan=await proposed(meeting.id)
  await approve(meeting.id,plan,'now')
  await assert.rejects(db.exec('update hq_private.meeting_runtime set executor_enabled=true'),/check constraint/)
  await assert.rejects(db.exec("update hq_private.meeting_agent_bindings set execution_qualified=true where agent_id='AG-HR-002'"),/check constraint/)
  // Test operator qualifies only disposable fixtures. No hosted setting changes.
  await db.exec(`update hq_private.meeting_runtime set executor_enabled=true,qualification_reference='synthetic fixture only';
    update hq_private.meeting_agent_bindings set execution_qualified=true,qualification_reference='synthetic fixture only';`)
  const lease=await asWorker('claim')
  assert.equal(lease.meeting_id,meeting.id)
  assert.equal(lease.status,'running')
  assert.equal(await asWorker('claim'),null)
  await asWorker('heartbeat',lease.id,lease.lease_token)
  await assert.rejects(asWorker('complete',lease.id,randomUUID(),{agentId:'AG-HR-002',deliverable:'Source report',evidence:['fixture://repository']}),/HQ_MEETING_STALE_LEASE/)
  for (const evidence of [[null],[''],[]]) await assert.rejects(asWorker('complete',lease.id,lease.lease_token,{agentId:'AG-HR-002',deliverable:'Source report',evidence}))
  const complete=await asWorker('complete',lease.id,lease.lease_token,{agentId:'AG-HR-002',deliverable:'Source report',evidence:['fixture://repository']})
  assert.equal(complete.hand_raised,true)
  assert.equal(complete.review_status,null)
  await assert.rejects(asWorker('review',lease.id,null,{agentId:'AG-HR-002',decision:'accepted',evidence:['fixture://review']}),/HQ_MEETING_INDEPENDENT_REVIEW_REQUIRED/)
  for (const evidence of [[null],[''],[]]) await assert.rejects(asWorker('review',lease.id,null,{agentId:'AG-HR-001',decision:'accepted',evidence}))
  const reviewed=await asWorker('review',lease.id,null,{agentId:'AG-HR-001',decision:'accepted',evidence:['fixture://review']})
  assert.equal(reviewed.review_status,'accepted')
  assert.equal(reviewed.hand_raised,true)
  let record=await command(meeting.id,{type:'report',taskId:lease.id})
  assert.equal(record.tasks[0].hand_raised,false)
  assert.deepEqual(record.tasks[0].result,complete.result)
  assert.ok(record.events.some(event=>event.kind==='report'))
  await command(meeting.id,{type:'end'})
})

test('crash reclamation changes lease generation and cancellation fences old completion',async () => {
  const {meeting}=await create(),plan=await proposed(meeting.id)
  await approve(meeting.id,plan,'now')
  let lease=await asWorker('claim')
  await db.query(`update public.hq_meeting_tasks set lease_expires_at=now()-interval '1 second' where id=$1`,[lease.id])
  const replacement=await asWorker('claim')
  assert.equal(replacement.id,lease.id)
  assert.equal(replacement.attempt,2)
  assert.ok(replacement.generation>lease.generation)
  assert.notEqual(replacement.lease_token,lease.lease_token)
  await assert.rejects(asWorker('complete',lease.id,lease.lease_token,{agentId:'AG-HR-002',deliverable:'Stale result',evidence:['fixture://stale']}),/HQ_MEETING_STALE_LEASE/)
  await command(meeting.id,{type:'cancelTask',taskId:lease.id})
  await assert.rejects(asWorker('complete',lease.id,replacement.lease_token,{agentId:'AG-HR-002',deliverable:'Late result',evidence:['fixture://late']}),/HQ_MEETING_STALE_LEASE/)
  const record=await snapshot(meeting.id)
  assert.equal(record.tasks[0].status,'cancelled')
  assert.equal(record.tasks[0].hand_raised,false)
  await command(meeting.id,{type:'end'})
})

test('timeouts and bounded retries become failed rather than completed or hand raised',async () => {
  const {meeting}=await create(),plan=await proposed(meeting.id)
  await approve(meeting.id,plan,'now')
  const lease=await asWorker('claim')
  await db.query(`update public.hq_meeting_tasks set attempt=3,lease_expires_at=now()-interval '1 second' where id=$1`,[lease.id])
  assert.equal(await asWorker('claim'),null)
  const record=await snapshot(meeting.id)
  assert.equal(record.tasks[0].status,'failed')
  assert.equal(record.tasks[0].hand_raised,false)
  await command(meeting.id,{type:'end'})
  await db.exec(`update hq_private.meeting_runtime set executor_enabled=false,qualification_reference=null`)
})
