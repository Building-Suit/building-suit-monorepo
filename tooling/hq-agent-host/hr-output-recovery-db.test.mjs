/** Disposable PostgreSQL engine checks. No hosted writes or inference. */
import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { readFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
const require = createRequire(new URL('../../apps/company-hq/package.json', import.meta.url))
const { PGlite } = require('@electric-sql/pglite')
const root = new URL('../../apps/company-hq/supabase/migrations/', import.meta.url)
const founder = randomUUID(), workerUser = randomUUID(), worker = randomUUID(), session = randomUUID(), workerSession = randomUUID()
const commonIds = ['1IRzs2Q41vfq0ocAT6HB3-bcMDPGTdMx5','1efnq6B7sKn4x099Dv5xsNyFJFIrnC6Xz','1kYDlexJRpJblhEFTq-XSqOEMIDnYdyjf','14A5qRpobLLnX9-e2iJxw7ekB2TB_IBvB','1ayMJWoihUx0rSYCkRc5hotRBRY1AAz9N']
const ids = ['AG-CEO-001','AG-HR-001','AG-HR-002','AG-HR-003','AG-RES-001','AG-SALES-001','AG-CS-001','AG-SOC-001','AG-EMAIL-001','AG-DEV-001']
const roster = ids.map((id,index)=>({id,name:'Employee '+index,departmentKey:index>0?'hr-agent-development':null,profileFileId:'profile_source_'+index,skillFileIds:[],lifecycle:'configured trial pending',model:index===0?'gpt-6-astra':[1,4,5,6,7,8,9].includes(index)?'gpt-6.1-sol':'gpt-6.1-terra',effort:'medium',managerId:index>1?'AG-HR-001':index===1?'AG-CEO-001':null}))
async function setup(withEvidence = true, withChat = true, withPresence = true) {
  const db=new PGlite()
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create schema extensions; create schema realtime;
    create function auth.jwt() returns jsonb language sql stable as $$ select current_setting('request.jwt.claims',true)::jsonb $$;
    create function auth.uid() returns uuid language sql stable as $$ select (auth.jwt()->>'sub')::uuid $$;
    create function auth.role() returns text language sql stable as $$ select auth.jwt()->>'role' $$;
    create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
    create table auth.sessions(id uuid primary key,user_id uuid,not_after timestamptz);
    create function extensions.digest(text,text) returns bytea language sql immutable as $$select sha256(convert_to($1,'UTF8'))$$;
    create table realtime.messages(topic text,event text,private boolean,payload jsonb,extension text default 'broadcast',inserted_at timestamptz default clock_timestamp());
    create function realtime.topic() returns text language sql stable as $$ select current_setting('realtime.topic',true) $$;
    create function realtime.send(jsonb,text,text,boolean) returns void language sql as $$ insert into realtime.messages(payload,event,topic,private) values($1,$2,$3,$4) $$;
    grant usage on schema public,auth,extensions,realtime to anon,authenticated,service_role;
    grant execute on all functions in schema auth to anon,authenticated,service_role;`)
  for(const name of ['20261104194233_hq_founder_company_plans.sql','20261104231249_brain_drive_sync.sql']) await db.exec(await readFile(new URL(name,root),'utf8'))
  await db.exec(`create table hq_private.live_invalidations(id uuid primary key default gen_random_uuid(),kind text not null check(kind in ('brain','company','access')),created_at timestamptz default clock_timestamp(),delivered_at timestamptz);
    create function hq_private.live_deliver(uuid) returns boolean language sql as $$select true$$;`)
  for(const name of ['20261105035454_hq_agent_messages_worker_queue.sql','20261105150500_hq_workforce_tasks_learning.sql',...(withEvidence?['20261105155841_hq_native_tool_evidence.sql','20261105164140_hq_reviewer_learning_context.sql']:[])]) {
    try { await db.exec(await readFile(new URL(name,root),'utf8')) }
    catch(error) { throw new Error(name+': '+error.message,{cause:error}) }
  }
  if (withChat) await db.exec(await readFile(new URL('20261105180148_hq_conversational_chat.sql',root),'utf8'))
  if (withPresence) await db.exec(await readFile(new URL('20261105192548_hq_presence_without_snapshot_polling.sql',root),'utf8'))
  for (const name of ['20261105201905_hq_chat_intake_size_recovery.sql','20261105204244_hq_hr_output_supervisor_recovery.sql']) await db.exec(await readFile(new URL(name,root),'utf8'))
  await db.query(`insert into auth.users values($1,'ceo@building-suit.com',clock_timestamp()),($2,'worker@example.invalid',clock_timestamp());`,[founder,workerUser])
  await db.query(`insert into auth.sessions(id,user_id) values($1,$2),($3,$4)`,[session,founder,workerSession,workerUser])
  await db.query(`select set_config('request.jwt.claims',$1,false)`,[JSON.stringify({sub:founder,role:'authenticated',session_id:session})])
  await db.query(`select hq_private.bind_founder()`)
  await db.query(`select hq_private.register_agent_worker($1,$2)`,[worker,workerUser])
  for(const id of [...commonIds,...roster.map(x=>x.profileFileId)]) await db.query(`insert into hq_private.brain_files(file_id,root_id,parent_ids,name,mime_type,trashed,in_scope) values($1,'1JgnIBa6As96sdOQn1z3rcQpwDyAvcZm8','{}','fixture.md','text/markdown',false,true)`,[id])
  async function as(who) {
    await db.exec('reset role')
    await db.query(`select set_config('request.jwt.claims',$1,false)`,[JSON.stringify(who==='worker'?{sub:workerUser,role:'authenticated',session_id:workerSession}:{sub:founder,role:'authenticated',session_id:session})])
    await db.exec('set role authenticated')
  }
  async function rpc(name,args=[]) { const r=await db.query(`select public.${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) result`,args);return r.rows[0].result }
  await as('worker'); await rpc('hq_worker_sync_roster',[worker,JSON.stringify(roster)])
  return {db,as,rpc,async claim(){await as('worker');return(await rpc('hq_worker_claim',[worker,300])).job},async finish(j,reply,error=null,evidence=[]){await as('worker');return rpc(withEvidence?'hq_worker_finish_v2':'hq_worker_finish',[j.id,j.lease_token,worker,typeof reply==='string'?reply:JSON.stringify(reply),error,...(withEvidence?[JSON.stringify(evidence)]:[])])}}
}

const repairBrief = 'The exact validation guard is unknown. Independently review a compact complete plan within1600 words and20000 UTF-8 bytes, while retaining every original acceptance criterion and honest external-action limits.'
async function value(h, sql, args = []) { return (await h.db.query(sql, args)).rows[0].value }
async function jobRow(h, id) { return value(h, 'select to_jsonb(j) value from public.hq_agent_jobs j where id=$1', [id]) }
async function taskRow(h, id) { return value(h, 'select to_jsonb(t) value from public.hq_business_tasks t where id=$1', [id]) }
async function recover(h, id, brief = repairBrief) {
  await h.db.exec('reset role')
  return value(h, 'select hq_private.recover_hr_task_output($1,$2) value', [id, brief])
}
async function failedHrTask(h) {
  await h.as('founder')
  await h.rpc('hq_send_ceo_message', ['Create the complete founder-requested plan with all criteria.', randomUUID()])
  let j = await h.claim()
  assert.equal(j.context.mode, 'conversation-intake')
  await h.finish(j, { message: '@Employee 1 Please deliver the full plan.', task: { title: 'Complete plan', brief: 'Retain the entire requested plan.', acceptance: 'Complete every criterion and identify actual external-action limits.', assigneeId: 'AG-HR-001' } })
  j = await h.claim(); assert.equal(j.context.mode, 'task-ack'); assert.equal(j.context.task.attempt, 0)
  await h.finish(j, { message: 'I understand the full plan and will draft it.', delegateId: null })
  j = await h.claim(); assert.equal(j.context.mode, 'task-work'); assert.equal(j.agent_id, 'AG-HR-001')
  const id = j.id, taskId = j.context.task.id
  await h.finish(j, '', 'provider-output-invalid')
  await h.db.exec('reset role')
  return { source: await jobRow(h, id), task: await taskRow(h, taskId) }
}

test('explicit recovery preserves failed history, creates real supervisor→Amaya acknowledgment→work at attempt1 and completes only after real review/report', async t => {
  const h = await setup(); t.after(() => h.db.close())
  const { source, task } = await failedHrTask(h)
  const messages = await value(h, 'select jsonb_agg(to_jsonb(m)) value from public.hq_agent_messages m')
  const receipt = await recover(h, source.id), queued = await jobRow(h, receipt.jobId), repaired = await taskRow(h, task.id)
  assert.deepEqual(receipt, { jobId: queued.id, recoveryOf: source.id, taskId: task.id, repairCount: 1 })
  assert.equal(queued.kind, 'task-route'); assert.equal(queued.agent_id, 'AG-CEO-001'); assert.equal(queued.attempt, 1); assert.equal(queued.depends_on, null)
  assert.notEqual(queued.request_key, source.request_key); assert.equal(queued.recovery_of, null)
  assert.equal(repaired.status, 'queued'); assert.equal(repaired.error, null); assert.equal(repaired.completed_at, null)
  for (const key of ['brief', 'acceptance', 'title', 'requested_assignee_id', 'assignee_id', 'founder_message_id', 'founder_user_id']) assert.deepEqual(repaired[key], task[key])
  assert.match(repaired.review_summary, /exact validation guard is not established/)
  assert.ok(repaired.review_summary.includes(repairBrief))
  assert.deepEqual(await jobRow(h, source.id), source)
  assert.deepEqual(await value(h, 'select jsonb_agg(to_jsonb(m)) value from public.hq_agent_messages m'), messages)
  const audit = await value(h, 'select to_jsonb(a) value from hq_private.hr_output_recoveries a where source_job_id=$1', [source.id])
  assert.deepEqual(audit.prior_state.task, task); assert.equal(audit.prior_state.source.id, source.id); assert.equal(audit.repair_brief, repairBrief)
  assert.equal(audit.prior_state.source.lease_token, undefined)
  assert.deepEqual(await recover(h, source.id, 'A different proposal cannot fork or alter existing recovery.'), receipt)
  await h.as('founder'); const projection = await h.rpc('hq_agent_snapshot')
  assert.equal(projection.jobs.find(x => x.id === queued.id).recoveryOf, source.id)
  let j = await h.claim(); assert.equal(j.id, queued.id); assert.equal(j.context.task.attempt, 1); assert.equal(j.context.task.requestedAssigneeId, 'AG-HR-001')
  assert.ok(j.context.task.reviewSummary.includes(repairBrief))
  await h.finish(j, { assigneeId: 'AG-HR-001', message: '@Employee 1 Independently checked remedy: keep every criterion in a compact complete plan.' })
  j = await h.claim(); assert.equal(j.context.mode, 'task-ack'); assert.equal(j.context.task.attempt, 1); assert.equal(j.agent_id, 'AG-HR-001')
  await h.finish(j, { message: 'I understand the remedy and retain the full acceptance criteria.', delegateId: null })
  j = await h.claim(); assert.equal(j.context.mode, 'task-work'); assert.equal(j.context.task.attempt, 1); assert.ok(j.context.task.reviewSummary.includes(repairBrief))
  await h.finish(j, 'Actual compact complete plan with the original acceptance criteria and honest action limits.')
  j = await h.claim(); assert.equal(j.context.mode, 'ceo-review'); assert.equal(j.context.task.attempt, 1)
  await h.finish(j, { accepted: true, summary: 'Independently checked all original criteria against this artifact.', artifactDigest: j.context.artifact.digest })
  j = await h.claim(); assert.equal(j.context.mode, 'task-report'); await h.finish(j, 'The reviewed actual plan is delivered.')
  await h.db.exec('reset role')
  assert.equal((await taskRow(h, task.id)).status, 'completed')
  assert.deepEqual(await jobRow(h, source.id), source)
  await assert.rejects(() => h.db.query('update hq_private.hr_output_recoveries set repair_brief=$1', ['Changed']), /HQ_IMMUTABLE/)
  await assert.rejects(() => h.db.query('delete from hq_private.hr_output_recoveries'), /HQ_IMMUTABLE/)
})

test('a fresh failed descendant still blocks, second explicit repair uses the last budget, and replay cannot create a third', async t => {
  const h = await setup(); t.after(() => h.db.close())
  const { source, task } = await failedHrTask(h)
  const first = await recover(h, source.id)
  let j = await h.claim(); await h.finish(j, { assigneeId: 'AG-HR-001', message: '@Employee 1 Repair preserving the complete request.' })
  j = await h.claim(); await h.finish(j, { message: 'I will apply the proposed repair.', delegateId: null })
  j = await h.claim(); const failedAgain = j.id; await h.finish(j, '', 'provider-output-invalid')
  assert.equal(await h.claim(), null)
  await h.db.exec('reset role'); assert.equal((await taskRow(h, task.id)).status, 'blocked')
  const second = await recover(h, failedAgain); assert.equal(second.repairCount, 2)
  j = await h.claim(); assert.equal(j.id, second.jobId); assert.equal(j.context.task.attempt, 2)
  await h.finish(j, { assigneeId: 'AG-HR-001', message: '@Employee 1 Last bounded repair; preserve all criteria.' })
  j = await h.claim(); assert.equal(j.context.task.attempt, 2); await h.finish(j, { message: 'I understand the final repair.', delegateId: null })
  j = await h.claim(); assert.equal(j.context.task.attempt, 2); const last = j.id; await h.finish(j, '', 'provider-output-invalid')
  assert.equal(await h.claim(), null)
  await assert.rejects(() => recover(h, last), /HQ_HR_RECOVERY_LIMIT/)
  assert.deepEqual(await recover(h, source.id), first)
  assert.equal((await taskRow(h, task.id)).repair_count, 2)
  assert.deepEqual(await jobRow(h, source.id), source)
})

test('audited supervisor routing to a different employee blocks durably without a false handoff or acknowledgment', async t => {
  const h = await setup(); t.after(() => h.db.close())
  const { source, task } = await failedHrTask(h), receipt = await recover(h, source.id)
  const j = await h.claim(); assert.equal(j.id, receipt.jobId)
  await h.finish(j, { assigneeId: 'AG-RES-001', message: '@Employee 4 I propose a different recipient.' })
  assert.equal(await h.claim(), null)
  await h.db.exec('reset role'); assert.equal((await jobRow(h, j.id)).error, 'stage-output-invalid')
  assert.equal((await taskRow(h, task.id)).assignee_id, 'AG-HR-001')
  assert.equal(await value(h, 'select count(*)::int value from public.hq_agent_messages where job_id=$1', [j.id]), 0)
  assert.equal(await value(h, 'select count(*)::int value from public.hq_agent_jobs where depends_on=$1', [j.id]), 0)
})

test('owner-only helper/private audit enforce API denial, active source founder, exact error/role, no pending work/output and bounded repair briefs', async t => {
  const h = await setup(); t.after(() => h.db.close())
  const { source, task } = await failedHrTask(h)
  for (const role of ['anon', 'authenticated', 'service_role']) {
    assert.equal(await value(h, `select has_function_privilege($1,'hq_private.recover_hr_task_output(uuid,text)','execute') value`, [role]), false)
    await h.db.exec(`set role ${role}`)
    await assert.rejects(() => h.db.query('select hq_private.recover_hr_task_output($1,$2)', [source.id, repairBrief]), /permission denied/)
    await assert.rejects(() => h.db.query('select * from hq_private.hr_output_recoveries'), /permission denied/)
    await h.db.exec('reset role')
  }
  await h.db.exec('grant usage on schema hq_private to authenticated; grant execute on function hq_private.recover_hr_task_output(uuid,text) to authenticated; set role authenticated')
  await assert.rejects(() => h.db.query('select hq_private.recover_hr_task_output($1,$2)', [source.id, repairBrief]), /HQ_ADMIN_REQUIRED/)
  await h.db.exec('reset role')
  for (const brief of ['', ' ', '\u0001bad', 'ع'.repeat(1001)]) await assert.rejects(() => recover(h, source.id, brief), /HQ_INVALID_REPAIR_BRIEF/)
  for (const change of ["error='worker-interrupted'", "error='provider-unavailable'", "agent_id='AG-RES-001'", "kind='task-route'", "result_text='Already produced output'"]) {
    await h.db.query(`update public.hq_agent_jobs set ${change} where id=$1`, [source.id])
    await assert.rejects(() => recover(h, source.id), /HQ_HR_RECOVERY_UNSAFE/)
    await h.db.query(`update public.hq_agent_jobs set error='provider-output-invalid',agent_id='AG-HR-001',kind='task-work',result_text=null where id=$1`, [source.id])
  }
  await h.db.query(`update public.hq_business_tasks set requested_assignee_id='AG-RES-001' where id=$1`, [task.id])
  await assert.rejects(() => recover(h, source.id), /HQ_HR_RECOVERY_UNSAFE/)
  assert.equal((await taskRow(h, task.id)).requested_assignee_id, 'AG-RES-001')
  await h.db.query('update public.hq_business_tasks set requested_assignee_id=null where id=$1', [task.id])
  await h.db.query(`update public.hq_business_tasks set assignee_id=null where id=$1`, [task.id])
  await assert.rejects(() => recover(h, source.id), /HQ_HR_RECOVERY_UNSAFE/)
  await h.db.query(`update public.hq_business_tasks set assignee_id='AG-HR-001',deliverable='Already accepted output' where id=$1`, [task.id])
  await assert.rejects(() => recover(h, source.id), /HQ_HR_RECOVERY_UNSAFE/)
  await h.db.query(`update public.hq_business_tasks set deliverable=null,founder_user_id=$2 where id=$1`, [task.id, randomUUID()])
  await assert.rejects(() => recover(h, source.id), /HQ_RECOVERY_FOUNDER_REQUIRED/)
  await h.db.query('update public.hq_business_tasks set founder_user_id=$2 where id=$1', [task.id, founder])
  await h.db.query(`insert into public.hq_agent_jobs(conversation_id,founder_message_id,founder_user_id,agent_id,request_key,kind,task_id,attempt)
    values($1,$2,$3,'AG-CEO-001',$4,'task-route',$5,1)`, [source.conversation_id, source.founder_message_id, founder, randomUUID(), task.id])
  await assert.rejects(() => recover(h, source.id), /HQ_HR_RECOVERY_UNSAFE/)
  await h.db.query('update public.hq_founders set revoked_at=clock_timestamp() where user_id=$1', [founder])
  await assert.rejects(() => recover(h, source.id), /HQ_RECOVERY_FOUNDER_REQUIRED/)
})
