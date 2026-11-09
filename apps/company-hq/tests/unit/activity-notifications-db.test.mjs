import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { PGlite } from '@electric-sql/pglite'

const directory = new URL('../../supabase/migrations/', import.meta.url)
const source = file => readFile(new URL(file, directory), 'utf8')
const owner = '10000000-0000-4000-8000-000000000001'
const ownerSession = '20000000-0000-4000-8000-000000000001'
const other = '10000000-0000-4000-8000-000000000002'
const otherSession = '20000000-0000-4000-8000-000000000002'
const endpoint = 'https://fcm.googleapis.com/fcm/send/device-owner'
const otherEndpoint = 'https://fcm.googleapis.com/fcm/send/device-other'
const p256dh = 'A'.repeat(87)
const auth = 'B'.repeat(22)

test('only the relevant founder devices receive committed activity and expired devices are removed', async () => {
  const db = new PGlite()
  async function query(sql, args = []) {
    return (await db.query(sql, args)).rows[0]?.data
  }
  async function as(role, user, session, sql, args) {
    await db.query("select set_config('request.jwt.claims',$1,false)", [JSON.stringify({ sub: user, session_id: session, role })])
    await db.exec(`set role ${role}`)
    try { return await query(sql, args) }
    finally { await db.exec('reset role') }
  }
  const register = (user, session, device) => as('authenticated', user, session,
    'select public.hq_manage_push_device($1,$2,$3) as data', [device,p256dh,auth])
  const claim = () => as('service_role', null, null, 'select public.hq_claim_push_deliveries() as data')
  const finish = (job, result) => as('service_role', null, null, 'select public.hq_finish_push_delivery($1,$2,$3) as data',
    [job.id,job.lease,result])
  try {
    await db.exec(`
      create role anon; create role authenticated; create role service_role;
      create schema auth;
      create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
      create table auth.sessions(id uuid primary key,user_id uuid,not_after timestamptz);
      create function auth.jwt() returns jsonb language sql stable as $$ select current_setting('request.jwt.claims')::jsonb $$;
      create function auth.uid() returns uuid language sql stable as $$ select (auth.jwt()->>'sub')::uuid $$;
    `)
    await db.exec(await source('20261104194233_hq_founder_company_plans.sql'))
    const queue = await source('20261105035454_hq_agent_messages_worker_queue.sql')
    await db.exec(queue.slice(0, queue.indexOf('-- Extend the existing durable')))
    // Other activity tables stand in for their owning migration chains. The
    // founder, chat, notification trigger, queue and RPC definitions are real.
    await db.exec(`
      create table public.hq_business_tasks(founder_user_id uuid,status text);
      create table public.hq_meetings(id uuid,founder_id uuid);
      create table public.hq_meeting_events(meeting_id uuid);
      create table public.hq_meeting_contributions(meeting_id uuid,status text);
      create table public.hq_task_artifacts(job_id uuid);
      create table public.hq_agent_lessons(founder_user_id uuid,status text);
      create table hq_private.staffing_workflows(founder_user_id uuid,status text);
      create table hq_private.staffing_decisions(actor_user_id uuid);
      create table hq_private.workforce_trials(requested_by uuid,status text);
      create table hq_private.brain_sync_state(content_digest text);
    `)
    await db.exec(await source('20261109032511_hq_activity_web_push.sql'))
    await db.query("insert into auth.users values ($1,'ceo@building-suit.com',now()), ($2,'other@example.test',now())", [owner,other])
    await db.query('insert into auth.sessions values ($1,$2,null), ($3,$4,null)', [ownerSession,owner,otherSession,other])
    assert.equal((await as('authenticated', owner, ownerSession, 'select public.hq_founder_access() as data')).isFounder, true)
    await assert.rejects(() => register(other, otherSession, otherEndpoint), /HQ_FOUNDER_REQUIRED/)
    await db.exec("insert into hq_private.founder_invitations(email) values ('other@example.test')")
    assert.equal((await as('authenticated', other, otherSession, 'select public.hq_founder_access() as data')).isFounder, true)
    await assert.rejects(() => register(owner, ownerSession, 'https://127.0.0.1/unsafe'), /HQ_INVALID_PUSH_ENDPOINT/)
    await assert.rejects(() => as('authenticated', owner, ownerSession, 'select public.hq_claim_push_deliveries() as data'), /permission denied/)
    assert.equal(await register(owner, ownerSession, endpoint), true)
    assert.equal(await register(other, otherSession, otherEndpoint), true)
    assert.equal(await register(other, otherSession, endpoint), false)
    const conversation = await query('insert into public.hq_agent_conversations(founder_user_id) values($1) returning id as data', [owner])
    await db.query("insert into public.hq_agent_messages(conversation_id,role,agent_id,text) values($1,'founder','AG-CEO-001','Private message')", [conversation])
    await db.query("insert into public.hq_business_tasks values($1,'queued')", [owner])
    await db.exec("update public.hq_business_tasks set status='queued'")
    const jobs = await claim()
    assert.deepEqual(jobs.map(job => job.activity).sort(), ['founder-message','task'])
    assert.ok(jobs.every(job => job.endpoint === endpoint))
    assert.ok(!JSON.stringify(jobs).includes('Private message'))
    assert.deepEqual(await claim(), [])
    await finish(jobs[0], 'retry')
    await finish(jobs[1], 'sent')
    assert.deepEqual(await claim(), [])
    await db.exec("update hq_private.push_deliveries set available_at=now()")
    const [retried] = await claim()
    assert.equal(retried.id, jobs[0].id)
    assert.notEqual(retried.lease, jobs[0].lease)
    await finish(jobs[0], 'expired')
    assert.equal(await as('authenticated', owner, ownerSession, 'select public.hq_check_push_device($1) as data', [endpoint]), true)
    await finish(retried, 'expired')
    assert.equal(await as('authenticated', owner, ownerSession, 'select public.hq_check_push_device($1) as data', [endpoint]), false)
    await db.query('delete from auth.sessions where id=$1', [otherSession])
    await db.exec("insert into hq_private.brain_sync_state values('before'); update hq_private.brain_sync_state set content_digest='after'")
    assert.deepEqual(await claim(), [])
  }
  finally { await db.close() }
})
