/** Explicit recovery guards in disposable PostgreSQL. No hosted writes/inference. */
import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire, registerHooks } from 'node:module'
import { readFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
const require = createRequire(new URL('../../apps/company-hq/package.json', import.meta.url))
const { PGlite } = require('@electric-sql/pglite')
registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier === './officeObservations' && context.parentURL?.endsWith('/shared/types/agents.ts')) return nextResolve('./officeObservations.ts', context)
  return nextResolve(specifier, context)
} })
const { parseHqAgentSnapshot } = await import('../../apps/company-hq/shared/types/agents.ts')
const migrations = new URL('../../apps/company-hq/supabase/migrations/', import.meta.url)
const migration = '20261105201905_hq_chat_intake_size_recovery.sql'

async function setup(t) {
  const db = new PGlite()
  t.after(() => db.close())
  const founder = randomUUID(), session = randomUUID(), worker = randomUUID(), workerUser = randomUUID()
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create schema extensions; create schema realtime;
    create function auth.jwt() returns jsonb language sql stable as $$select current_setting('request.jwt.claims',true)::jsonb$$;
    create function auth.uid() returns uuid language sql stable as $$select (auth.jwt()->>'sub')::uuid$$;
    create function auth.role() returns text language sql stable as $$select auth.jwt()->>'role'$$;
    create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
    create table auth.sessions(id uuid primary key,user_id uuid,not_after timestamptz);
    create function extensions.digest(text,text) returns bytea language sql immutable as $$select sha256(convert_to($1,'UTF8'))$$;
    create table realtime.messages(topic text,event text,private boolean,payload jsonb,extension text default 'broadcast',inserted_at timestamptz default clock_timestamp());
    create function realtime.topic() returns text language sql stable as $$select current_setting('realtime.topic',true)$$;
    create function realtime.send(jsonb,text,text,boolean) returns void language sql as $$insert into realtime.messages(payload,event,topic,private) values($1,$2,$3,$4)$$;
    grant usage on schema public,auth,extensions,realtime to anon,authenticated,service_role;
    grant execute on all functions in schema auth to anon,authenticated,service_role;`)
  for (const name of ['20261104194233_hq_founder_company_plans.sql', '20261104231249_brain_drive_sync.sql']) await db.exec(await readFile(new URL(name, migrations), 'utf8'))
  await db.exec(`create table hq_private.live_invalidations(id uuid primary key default gen_random_uuid(),kind text not null check(kind in ('brain','company','access')),created_at timestamptz default clock_timestamp(),delivered_at timestamptz);
    create function hq_private.live_deliver(uuid) returns boolean language sql as $$select true$$;`)
  for (const name of ['20261105035454_hq_agent_messages_worker_queue.sql', '20261105150500_hq_workforce_tasks_learning.sql', '20261105180148_hq_conversational_chat.sql', migration]) await db.exec(await readFile(new URL(name, migrations), 'utf8'))
  await db.query(`insert into auth.users values($1,'ceo@building-suit.com',clock_timestamp()),($2,'worker@example.invalid',clock_timestamp())`, [founder, workerUser])
  await db.query('insert into auth.sessions(id,user_id) values($1,$2)', [session, founder])
  await db.query(`select set_config('request.jwt.claims',$1,false)`, [JSON.stringify({ sub: founder, role: 'authenticated', session_id: session })])
  await db.query('select hq_private.bind_founder()')
  await db.query('select hq_private.register_agent_worker($1,$2)', [worker, workerUser])
  async function row(id) { return (await db.query('select to_jsonb(j) value from public.hq_agent_jobs j where id=$1', [id])).rows[0].value }
  async function blocked(error = 'response-too-large') {
    const message = randomUUID(), job = randomUUID(), conversation = (await db.query(`insert into public.hq_agent_conversations(founder_user_id) values($1)
      on conflict(founder_user_id) do update set updated_at=clock_timestamp() returning id`, [founder])).rows[0].id
    await db.query(`insert into public.hq_agent_messages(id,conversation_id,role,agent_id,text) values($1,$2,'founder','AG-CEO-001','Founder request')`, [message, conversation])
    await db.query(`insert into public.hq_agent_jobs(id,conversation_id,founder_message_id,founder_user_id,agent_id,request_key,kind,status,completed_at,error,result_digest,worker_id,lease_token,lease_expires_at,started_at)
      values($1,$2,$3,$4,'AG-CEO-001',$5,'conversation-intake','blocked',clock_timestamp(),$6,repeat('a',64),$7,$8,clock_timestamp()+interval '1 minute',clock_timestamp())`, [job, conversation, message, founder, randomUUID(), error, worker, randomUUID()])
    return row(job)
  }
  async function recover(id) { return (await db.query('select hq_private.recover_chat_intake($1) result', [id])).rows[0].result }
  return { db, founder, row, blocked, recover }
}

test('size recovery creates one fresh source-bound job, preserves original lease/digest/messages, and projects actual metadata', async t => {
  const h = await setup(t), original = await h.blocked()
  const beforeMessages = (await h.db.query('select jsonb_agg(to_jsonb(m)) value from public.hq_agent_messages m')).rows[0].value
  const receipt = await h.recover(original.id), recovered = await h.row(receipt.jobId)
  assert.deepEqual(receipt, { jobId: recovered.id, recoveryOf: original.id, recoveryCount: 1 })
  assert.notEqual(recovered.id, original.id)
  assert.notEqual(recovered.request_key, original.request_key)
  for (const key of ['founder_user_id', 'founder_message_id', 'conversation_id', 'agent_id', 'kind']) assert.equal(recovered[key], original[key])
  for (const key of ['depends_on', 'worker_id', 'lease_token', 'lease_expires_at', 'started_at', 'completed_at', 'error', 'result_digest', 'result_text', 'task_id', 'artifact_id']) assert.equal(recovered[key], null)
  assert.equal(recovered.status, 'queued'); assert.equal(recovered.attempt, 0)
  assert.deepEqual(await h.row(original.id), original)
  assert.deepEqual((await h.db.query('select jsonb_agg(to_jsonb(m)) value from public.hq_agent_messages m')).rows[0].value, beforeMessages)
  assert.deepEqual(await h.recover(original.id), receipt)
  assert.equal((await h.db.query('select count(*)::int n from public.hq_agent_jobs where recovery_of=$1', [original.id])).rows[0].n, 1)
  await h.db.exec('set role authenticated')
  const snapshot = (await h.db.query('select public.hq_agent_snapshot() value')).rows[0].value
  const job = snapshot.jobs.find(job => job.id === recovered.id)
  assert.equal(job.kind, 'conversation-intake'); assert.equal(job.founderMessageId, original.founder_message_id); assert.equal(job.recoveryOf, original.id)
  assert.ok(parseHqAgentSnapshot(snapshot))
  assert.ok(parseHqAgentSnapshot({ ...snapshot, jobs: snapshot.jobs.map(job => {
    const legacy = { ...job }
    delete legacy.kind; delete legacy.founderMessageId; delete legacy.recoveryOf
    return legacy
  }) }))
  for (const invalid of [{ kind: 'invented-stage' }, { founderMessageId: 'invalid' }, { recoveryOf: 'invalid' }, { leaseToken: randomUUID() }]) assert.equal(parseHqAgentSnapshot({ ...snapshot, jobs: [{ ...job, ...invalid }] }), null)
})

test('API roles and accidentally granted non-owner callers cannot invoke recovery', async t => {
  const h = await setup(t), original = await h.blocked()
  for (const role of ['anon', 'authenticated', 'service_role']) {
    const privilege = await h.db.query(`select has_function_privilege($1,'hq_private.recover_chat_intake(uuid)','execute') allowed`, [role])
    assert.equal(privilege.rows[0].allowed, false)
    await h.db.exec(`set role ${role}`)
    await assert.rejects(() => h.recover(original.id), /permission denied/)
    await h.db.exec('reset role')
  }
  await h.db.exec('grant usage on schema hq_private to authenticated; grant execute on function hq_private.recover_chat_intake(uuid) to authenticated; set role authenticated')
  await assert.rejects(() => h.recover(original.id), /HQ_ADMIN_REQUIRED/)
  await h.db.exec('reset role')
  assert.deepEqual(await h.row(original.id), original)
})

test('unrelated/provider/uncertain failures and changed source scope reject explicit recovery', async t => {
  const h = await setup(t)
  for (const error of ['provider-unavailable', 'worker-interrupted', 'stage-output-invalid', 'model-timeout']) {
    const original = await h.blocked(error)
    await assert.rejects(() => h.recover(original.id), /HQ_INTAKE_RECOVERY_UNSAFE/)
    assert.deepEqual(await h.row(original.id), original)
  }
  for (const mutation of ["kind='task-work'", "agent_id='AG-HR-001'", "result_text='Already produced output'", "status='completed',error=null"]) {
    const original = await h.blocked()
    await h.db.query(`update public.hq_agent_jobs set ${mutation} where id=$1`, [original.id])
    await assert.rejects(() => h.recover(original.id), /HQ_INTAKE_RECOVERY_UNSAFE/)
  }
  const wrongOwner = await h.blocked()
  await h.db.query('update public.hq_agent_jobs set founder_user_id=$2 where id=$1', [wrongOwner.id, randomUUID()])
  await assert.rejects(() => h.recover(wrongOwner.id), /HQ_RECOVERY_FOUNDER_REQUIRED/)
  const revoked = await h.blocked()
  await h.db.query('update public.hq_founders set revoked_at=clock_timestamp() where user_id=$1', [h.founder])
  await assert.rejects(() => h.recover(revoked.id), /HQ_RECOVERY_FOUNDER_REQUIRED/)
})

test('assistant output, task/artifact evidence and newer or duplicate pending requests reject recovery', async t => {
  const h = await setup(t)
  let original = await h.blocked()
  await h.db.query(`insert into public.hq_agent_messages(conversation_id,role,agent_id,text,reply_to,job_id) values($1,'assistant','AG-CEO-001','Actual reply',$2,$3)`, [original.conversation_id, original.founder_message_id, original.id])
  await assert.rejects(() => h.recover(original.id), /HQ_INTAKE_RECOVERY_UNSAFE/)
  original = await h.blocked()
  await h.db.query(`insert into public.hq_task_artifacts(job_id,agent_id,kind,text,digest) values($1,'AG-CEO-001','intake','Actual output',repeat('b',64))`, [original.id])
  await assert.rejects(() => h.recover(original.id), /HQ_INTAKE_RECOVERY_UNSAFE/)
  original = await h.blocked()
  await h.db.query(`insert into public.hq_business_tasks(founder_user_id,conversation_id,founder_message_id,request_key,title,brief,acceptance) values($1,$2,$3,$4,'Task','Brief','Acceptance')`, [h.founder, original.conversation_id, original.founder_message_id, randomUUID()])
  await assert.rejects(() => h.recover(original.id), /HQ_INTAKE_RECOVERY_UNSAFE/)
  original = await h.blocked()
  await h.db.query(`insert into public.hq_agent_jobs(conversation_id,founder_message_id,founder_user_id,agent_id,request_key,kind) values($1,$2,$3,'AG-CEO-001',$4,'conversation-intake')`, [original.conversation_id, original.founder_message_id, h.founder, randomUUID()])
  await assert.rejects(() => h.recover(original.id), /HQ_INTAKE_RECOVERY_UNSAFE/)
  original = await h.blocked()
  await h.blocked()
  await assert.rejects(() => h.recover(original.id), /HQ_INTAKE_RECOVERY_UNSAFE/)
})

test('all allowed deterministic size errors recover, but durable lineage cannot fork or cross owners and stops after two recoveries', async t => {
  const h = await setup(t)
  for (const error of ['brain-source-too-large', 'brain-context-too-large']) {
    const original = await h.blocked(error)
    assert.equal((await h.recover(original.id)).recoveryCount, 1)
  }
  const original = await h.blocked()
  const insert = `insert into public.hq_agent_jobs(conversation_id,founder_message_id,founder_user_id,agent_id,request_key,kind,recovery_of,recovery_count) values($1,$2,$3,'AG-CEO-001',$4,'conversation-intake',$5,1)`
  await assert.rejects(() => h.db.query(insert, [original.conversation_id, original.founder_message_id, randomUUID(), randomUUID(), original.id]), /foreign key/)
  const first = await h.recover(original.id)
  await assert.rejects(() => h.db.query(insert, [original.conversation_id, original.founder_message_id, h.founder, randomUUID(), original.id]), /unique constraint/)
  await h.db.query(`update public.hq_agent_jobs set status='blocked',completed_at=clock_timestamp(),error='brain-context-too-large' where id=$1`, [first.jobId])
  const second = await h.recover(first.jobId)
  assert.equal(second.recoveryCount, 2)
  assert.equal((await h.row(second.jobId)).attempt, 0)
  await h.db.query(`update public.hq_agent_jobs set status='blocked',completed_at=clock_timestamp(),error='response-too-large' where id=$1`, [second.jobId])
  await assert.rejects(() => h.recover(second.jobId), /HQ_INTAKE_RECOVERY_LIMIT/)
  assert.deepEqual(await h.recover(original.id), first)
  assert.deepEqual(await h.recover(first.jobId), second)
  assert.deepEqual(await h.row(original.id), original)
})
