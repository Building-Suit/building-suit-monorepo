/** Synthetic predecessor/receipt fixture. This is not a hosted-schema reset. */
import assert from 'node:assert/strict'
import { createHash, randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import {
  root, founder, worker, preparedWorker, setFutureWorker, repositoryFixture,
} from './public-repository-db-fixture.mjs'

export const retirementFile = '20261111013758_hq_retire_meetings_and_voice_greeting.sql'
export const compatibilityFile = '20261111020000_hq_repository_worker_compatibility_v2.sql'
export const assignmentFile = '20261111033000_hq_retail_assignment_context.sql'
export const retirementSha256 = '06f92be9097abc12b585eb8ef1e51ae23b9bd3e0f343f55b7310565d66d9a8ef'
export const assignmentSignature = 'hq_private.workforce_enrich_claim_before_repository(jsonb)'
export const migrationSql = name => readFile(new URL(name, root), 'utf8')

export async function exactRetirementSql() {
  const sql = await migrationSql(retirementFile)
  assert.equal(Buffer.byteLength(sql), 11060)
  assert.equal(sql.split('\n').length - 1, 177)
  assert.equal(createHash('sha256').update(sql).digest('hex'), retirementSha256)
  assert.equal(createHash('md5').update(sql).digest('hex'), '6991a79261ccf83eef863251d0d11583')
  return sql
}

export async function reconciliationFixture(database = null) {
  const prepared = await preparedWorker()
  setFutureWorker(prepared)
  let h
  try {
    ;({ h } = await repositoryFixture({ database }))
    await h.db.exec('reset role')
    // The shared fixture stubs live delivery and omits this unrelated projection
    // column. Its exact original declaration is needed by activity push triggers.
    await h.db.exec("alter table hq_private.brain_sync_state add column content_digest text check (content_digest ~ '^[0-9a-f]{64}$')")
    // Reuse the maintained synthetic fixture, then the exact chronological
    // application predecessors. Scheduler/provider activation is not emulated.
    for (const file of [
      '20261108041146_hq_task_browser.sql',
      '20261109024147_hq_repository_worker_compatibility.sql',
      '20261109032511_hq_activity_web_push.sql',
      '20261110002441_hq_skill_evidence_plan_reuse.sql',
      '20261110140432_hq_trial_status_projection.sql',
      '20261110140541_hq_founder_shared_authorization.sql',
      '20261110160612_hq_trial_review_planning.sql',
      '20261110165424_hq_repository_review_planning.sql',
    ]) await h.db.exec(await migrationSql(file))
    const rows = (await h.db.query('select count(*)::int n from hq_private.workforce_qualification_receipts')).rows
    assert.ok(rows[0].n > 0, 'preservation tests must contain genuine synthetic accepted receipts')
    const meeting = await seedMeetingHistory(h.db)
    return { h, meeting, close: async () => { await h.db.close(); await prepared.close() } }
  } catch (error) {
    await h?.db.close(); await prepared.close(); throw error
  }
}

async function seedMeetingHistory(db) {
  const result = {}
  for (const state of ['queued', 'working', 'completed', 'started', 'ordinary']) {
    const task = randomUUID(), job = randomUUID(), message = randomUUID(), meeting = randomUUID()
    const conversation = (await db.query('select id from public.hq_agent_conversations where founder_user_id=$1', [founder])).rows[0].id
    await db.query(`insert into public.hq_agent_messages(id,conversation_id,role,agent_id,text)
      values($1,$2,'founder','AG-CEO-001','Synthetic retirement preservation sentinel')`, [message, conversation])
    await db.query(`insert into public.hq_business_tasks(id,founder_user_id,conversation_id,founder_message_id,request_key,title,brief,acceptance,status)
      values($1,$2,$3,$4,$5,'Synthetic retirement sentinel','Preserve history','No fabricated evidence',$6)`,
    [task, founder, conversation, message, randomUUID(), state === 'started' || state === 'ordinary' ? 'queued' : state])
    const jobState = state === 'started' || state === 'ordinary' ? 'queued' : state
    await db.query(`insert into public.hq_agent_jobs(id,conversation_id,founder_message_id,founder_user_id,agent_id,request_key,kind,task_id,status,
        worker_id,lease_token,lease_expires_at,started_at,completed_at,result_digest)
      values($1,$2,$3,$4,'AG-CEO-001',$5,'task-work',$6,$7,$8,$9,$10,$11,$12,$13)`,
    [job, conversation, message, founder, randomUUID(), task, jobState,
      ['working','completed'].includes(jobState) ? worker : null,
      ['working','completed'].includes(jobState) ? randomUUID() : null,
      ['working','completed'].includes(jobState) ? '2099-01-01T00:00:00Z' : null,
      ['working','completed'].includes(jobState) ? '2026-01-01T00:00:00Z' : null,
      jobState === 'completed' ? '2026-01-01T00:01:00Z' : null,
      jobState === 'completed' ? '1'.repeat(64) : null])
    if (state === 'started') {
      await db.query(`insert into public.hq_agent_jobs(conversation_id,founder_message_id,founder_user_id,agent_id,request_key,kind,task_id,status,
          worker_id,lease_token,lease_expires_at,started_at,completed_at,result_digest)
        values($1,$2,$3,'AG-CEO-001',$4,'task-route',$5,'completed',$6,$7,'2026-01-01','2026-01-01','2026-01-01',repeat('2',64))`,
      [conversation, message, founder, randomUUID(), task, worker, randomUUID()])
    }
    result[state] = { task, job, meeting }
    if (state === 'ordinary') continue
    await db.query(`insert into public.hq_meetings(id,founder_id,title,language,participants,floor)
      values($1,$2,'Synthetic preserved meeting','en',array['AG-CEO-001'],'AG-CEO-001')`, [meeting, founder])
    const event = (await db.query(`insert into public.hq_meeting_events(meeting_id,kind,actor_id,payload)
      values($1,'fixture-history','synthetic','{"preserved":true}') returning id`, [meeting])).rows[0].id
    await db.query(`insert into public.hq_meeting_task_links(business_task_id,meeting_id,task_kind,task_key,instruction,request_key)
      values($1,$2,'research','preserve','{}',$3)`, [task, meeting, randomUUID()])
    await db.query(`insert into public.hq_meeting_contributions(meeting_id,generation,agent_id,binding_digest,source_event_id,source_kind,
        request_key,job_id,business_task_id,status,response_text,response_digest,completed_at)
      values($1,0,'AG-CEO-001',repeat('0',64),$2,'ceo-chat',$3,$4,$5,$6,$7,$8,$9)`,
    [meeting, event, randomUUID(), job, task, state === 'completed' ? 'completed' : 'thinking',
      state === 'completed' ? 'Historical response survives retirement.' : null,
      state === 'completed' ? '3'.repeat(64) : null, state === 'completed' ? '2026-01-01' : null])
  }
  return result
}

/** Fingerprint every application table, function metadata/body, ACL and trigger.
 * Sequences and catalog transaction IDs are deliberately excluded: nextval is
 * nontransactional in PostgreSQL. This does not assert gapless event IDs.
 */
export async function currentState(db) {
  await db.exec('reset role')
  const functions = (await db.query(`select p.oid,to_jsonb(p) definition from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname in ('public','hq_private') order by p.oid`)).rows
  const relations = (await db.query(`select c.oid,n.nspname schema,c.relname name,c.relkind,c.relowner,c.relacl,c.relrowsecurity,c.relforcerowsecurity
    from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','hq_private')
      and c.relkind in ('r','p') order by n.nspname,c.relname`)).rows
  const triggers = (await db.query(`select t.oid,to_jsonb(t) definition from pg_trigger t join pg_class c on c.oid=t.tgrelid
    join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','hq_private') order by t.oid`)).rows
  const tables = {}
  for (const { schema, name } of relations) {
    assert.match(schema, /^[a-z_]+$/); assert.match(name, /^[a-z_0-9]+$/)
    tables[`${schema}.${name}`] = (await db.query(`select to_jsonb(t) data from ${schema}.${name} t order by to_jsonb(t)::text`)).rows
  }
  return { functions, relations, triggers, tables }
}

export async function verifyRetirementEffects(f, before) {
  const { h, meeting } = f, { db } = h
  const after = await currentState(db)
  for (const table of Object.keys(before.tables)) {
    if (['public.hq_agent_jobs','public.hq_business_tasks','public.hq_meetings','public.hq_meeting_events',
      'public.hq_meeting_contributions','hq_private.live_invalidations'].includes(table)) continue
    assert.deepEqual(after.tables[table], before.tables[table], `${table} retains every historical row`)
  }
  const retiredJobs = new Set([meeting.queued.job, meeting.started.job])
  for (const row of before.tables['public.hq_agent_jobs']) {
    const actual = after.tables['public.hq_agent_jobs'].find(x => x.data.id === row.data.id)
    assert.ok(actual, 'no queue history is deleted')
    assert.deepEqual(actual.data, retiredJobs.has(row.data.id)
      ? { ...row.data, status: 'blocked', error: 'meeting-feature-retired', completed_at: actual.data.completed_at }
      : row.data, 'only the two queued meeting jobs receive retirement metadata')
  }
  assert.equal(after.tables['public.hq_agent_jobs'].length, before.tables['public.hq_agent_jobs'].length)
  for (const row of before.tables['public.hq_business_tasks']) {
    const actual = after.tables['public.hq_business_tasks'].find(x => x.data.id === row.data.id)
    assert.ok(actual, 'no task history is deleted')
    assert.deepEqual(actual.data, row.data.id === meeting.queued.task
      ? { ...row.data, status: 'blocked', error: 'meeting-feature-retired', completed_at: actual.data.completed_at, updated_at: actual.data.updated_at }
      : row.data, 'a previously dispatched task and all unrelated tasks are preserved')
  }
  assert.equal(after.tables['public.hq_business_tasks'].length, before.tables['public.hq_business_tasks'].length)
  for (const row of before.tables['public.hq_meeting_events']) {
    assert.deepEqual(after.tables['public.hq_meeting_events'].find(x => x.data.id === row.data.id), row)
  }
  for (const state of ['queued','started']) {
    const job = (await db.query('select status,error from public.hq_agent_jobs where id=$1', [meeting[state].job])).rows[0]
    assert.deepEqual(job, { status: 'blocked', error: 'meeting-feature-retired' })
    const task = (await db.query('select status,error from public.hq_business_tasks where id=$1', [meeting[state].task])).rows[0]
    assert.deepEqual(task, state === 'queued' ? { status: 'blocked', error: 'meeting-feature-retired' } : { status: 'queued', error: null })
  }
  assert.equal((await db.query(`select count(*)::int n from public.hq_meetings where status='active'`)).rows[0].n, 0)
  assert.equal((await db.query(`select count(*)::int n from public.hq_meeting_events where kind='meeting-retired'`)).rows[0].n, 4)
  const completed = before.tables['public.hq_meeting_contributions'].filter(x => x.data.status === 'completed')
  for (const row of completed) assert.deepEqual(after.tables['public.hq_meeting_contributions'].find(x => x.data.id === row.data.id), row)
  assert.equal((await db.query(`select status from public.hq_meeting_contributions where job_id=$1`, [meeting.working.job])).rows[0].status, 'interrupted')
  const predecessor = before.functions.find(x => x.definition.proname === 'worker_claim' && x.definition.pronargs === 3)
  const renamed = after.functions.find(x => x.definition.proname === 'worker_claim_before_meeting_retirement')
  assert.equal(renamed.oid, predecessor.oid)
  assert.equal(renamed.definition.prosrc, predecessor.definition.prosrc, 'the current enriched claim body is preserved verbatim')
  await verifyRetirementPrivileges(h)
}

export async function verifyRetirementPrivileges(h) {
  const { db } = h
  await db.exec('reset role')
  const predecessors = (await db.query("select p.oid::regprocedure::text signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='hq_private' and p.proname like 'worker_claim_before%'")).rows
  assert.ok(predecessors.length >= 3, 'check the complete historical claim chain')
  const meetings = ['hq_meeting_create(uuid,text,text,text[],uuid)','hq_meeting_snapshot(uuid)',
    'hq_meeting_command(uuid,jsonb,uuid)','hq_meeting_roster()']
  for (const role of ['anon','authenticated','service_role']) {
    for (const name of meetings) for (const signature of [`public.${name}`, `hq_private.${name.slice(3)}`]) {
      assert.equal((await db.query('select has_function_privilege($1,$2,\'execute\') allowed', [role, signature])).rows[0].allowed, false)
    }
    for (const name of [...predecessors.map(row => row.signature), 'hq_private.block_retired_meeting_jobs()']) {
      assert.equal((await db.query('select has_function_privilege($1,$2,\'execute\') allowed', [role, name])).rows[0].allowed, false)
    }
    for (const name of ['hq_private.voice_greet(text,uuid)','public.hq_voice_greet(text,uuid)',
      'hq_private.worker_claim(uuid,integer,integer)','hq_private.worker_claim(uuid,integer)']) {
      assert.equal((await db.query('select has_function_privilege($1,$2,\'execute\') allowed', [role, name])).rows[0].allowed, role === 'authenticated')
    }
    assert.equal((await db.query(`select has_table_privilege($1,'hq_private.voice_greeting_requests','select,insert,update,delete') allowed`, [role])).rows[0].allowed, false)
  }
  assert.equal((await db.query(`select relrowsecurity from pg_class where oid='hq_private.voice_greeting_requests'::regclass`)).rows[0].relrowsecurity, true)
  assert.equal((await db.query(`select count(*)::int n from pg_trigger where tgname='hq_push_activity'
    and tgrelid in ('public.hq_meeting_events'::regclass,'public.hq_meeting_contributions'::regclass)`)).rows[0].n, 0)
}

export async function verifyGreetingAndClaimFences(h) {
  const { db } = h
  await db.exec('reset role;begin')
  try {
    const key = randomUUID()
    await h.as('worker')
    await assert.rejects(h.rpc('hq_voice_greet', ['Fixture',key]), /HQ_FOUNDER_REQUIRED/)
  } finally { await db.exec('rollback;reset role') }
  // Expected SQL errors abort native transactions; each negative probe gets a
  // fresh transaction rather than relying on PGlite-only transaction behavior.
  for (const [who, name, args, pattern] of [
    ['founder','hq_worker_claim',[worker,300,1],/HQ_WORKER_REQUIRED/],
    ['worker','hq_worker_claim',[worker,301,1],/HQ_INVALID_LEASE/],
    ['worker','hq_worker_claim',[worker,300,2],/HQ_INVALID_LEASE/],
    ['worker','hq_worker_claim',[null,300,1],/HQ_WORKER_REQUIRED/],
  ]) {
    await db.exec('reset role;begin')
    try { await h.as(who); await assert.rejects(h.rpc(name,args),pattern) }
    finally { await db.exec('rollback;reset role') }
  }
  const fenceBefore = await currentState(db)
  const blocked = (await db.query("select id from public.hq_agent_jobs where error='meeting-feature-retired' and started_at is null order by id limit 1")).rows[0].id
  for (const [name, args] of [
    ['hq_worker_claim',[worker,300]], ['hq_worker_claim',[worker,300,1]],
    ['hq_worker_role_claim',[worker,300,1]], ['hq_worker_research_claim',[worker,300,1]],
    ['hq_worker_repository_claim',[worker,300,1]],
  ]) {
    await db.exec('reset role;begin')
    try {
      await db.query("update public.hq_agent_jobs set status='queued',error=null,completed_at=null where id=$1", [blocked])
      await h.as('worker'); await h.rpc(name,args); await db.exec('reset role')
      assert.equal((await db.query('select status from public.hq_agent_jobs where id=$1',[blocked])).rows[0].status,
        'blocked', `${name}/${args.length} reaches the retirement fence through the existing claim chain`)
    } finally { await db.exec('rollback;reset role') }
  }
  assert.deepEqual(await currentState(db),fenceBefore,'rolled-back wrapper probes preserve queue and receipts')
  const before = await currentState(db), key = randomUUID()
  await h.as('founder')
  const result = await h.rpc('hq_voice_greet', ['Fixture',key])
  assert.deepEqual(await h.rpc('hq_voice_greet',['Fixture',key]), result)
  await assert.rejects(h.rpc('hq_voice_greet',['Other',key]), /HQ_REQUEST_KEY_REUSED/)
  await db.exec('reset role')
  const after = await currentState(db)
  assert.deepEqual(after.tables['public.hq_agent_jobs'], before.tables['public.hq_agent_jobs'], 'deterministic greeting does not enqueue work')
  assert.equal(after.tables['public.hq_agent_messages'].length, before.tables['public.hq_agent_messages'].length + 2)
  await assert.rejects(db.query(`update hq_private.voice_greeting_requests set greeting_name='Changed' where request_key=$1`, [key]), /HQ_IMMUTABLE_RECORD/)
}

export async function installLateFailure(db) {
  // Native DDL event trigger throws late in the exact original SQL, after the
  // queue writes, revokes, wrapper rename and private greeting table/function.
  await db.exec(`create schema retirement_test;
    create function retirement_test.fail_late() returns event_trigger language plpgsql as $$
    begin
      if exists(select 1 from pg_event_trigger_ddl_commands() where classid='pg_proc'::regclass and objid=to_regprocedure('public.hq_voice_greet(text,uuid)')) then
        raise exception 'RETIREMENT_SYNTHETIC_LATE_FAILURE' using errcode='P0001';
      end if;
    end $$;
    create event trigger retirement_test_fail_late on ddl_command_end when tag in ('CREATE FUNCTION')
      execute function retirement_test.fail_late();`)
}

export async function removeLateFailure(db) {
  await db.exec('drop event trigger retirement_test_fail_late; drop schema retirement_test cascade')
}

export async function verifyAssignmentOnly(db, apply) {
  const before = await currentState(db)
  assert.equal((await db.query('select md5(prosrc) digest from pg_proc where oid=$1::regprocedure', [assignmentSignature])).rows[0].digest,
    '0db742a9c2aeb28848ff5650253b4a0c')
  await apply()
  const after = await currentState(db)
  const changed = after.functions.filter((row,index) => row.definition.prosrc !== before.functions[index].definition.prosrc)
  assert.equal(changed.length, 1)
  assert.equal(changed[0].definition.proname, 'workforce_enrich_claim_before_repository')
  assert.ok(changed[0].definition.prosrc.includes('publicDiscoveryAssignment'))
  for (const state of [before, after]) for (const row of state.functions) delete row.definition.prosrc
  assert.deepEqual(after, before, 'assignment migration preserves all other function metadata/OIDs/ACLs and application rows')
}
