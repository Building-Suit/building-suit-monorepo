/** The proposed additive capability runs only in disposable PGlite here. */
import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { readFile } from 'node:fs/promises'
const require = createRequire(new URL('../../apps/company-hq/package.json', import.meta.url))
const { PGlite } = require('@electric-sql/pglite')
const worker = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const foreign = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

test('proposed DB release capability is authorized, read-only, lease-aware and additive', async t => {
  const db = new PGlite()
  t.after(() => db.close())
  await db.exec(`create role anon; create role authenticated; create role service_role;
    create schema hq_private;
    grant usage on schema hq_private to authenticated;
    create table public.hq_agent_jobs(worker_id uuid,status text);
    alter table public.hq_agent_jobs enable row level security;
    create index jobs_active on public.hq_agent_jobs(worker_id) where status='working';
    create function hq_private.agent_worker_uid(uuid) returns uuid language sql as $$
      select case when $1::text=current_setting('fixture.authorized_worker',true) then $1 else null end $$;
    create function public.hq_worker_claim(uuid,integer,integer) returns jsonb language sql as $$select '{}'::jsonb$$;
    create function public.hq_worker_finish_v2(uuid,uuid,uuid,text,text,jsonb) returns jsonb language sql as $$select '{}'::jsonb$$;
    create function public.hq_worker_heartbeat(uuid,uuid,uuid,text) returns jsonb language sql as $$select '{}'::jsonb$$;
    create function public.hq_worker_sync_roster(uuid,jsonb) returns jsonb language sql as $$select '{}'::jsonb$$;
    create function public.hq_worker_pending_lessons(uuid) returns jsonb language sql as $$select '[]'::jsonb$$;
    create function public.hq_worker_publish_lesson(uuid,uuid,text,text) returns jsonb language sql as $$select '{}'::jsonb$$;
    insert into public.hq_agent_jobs values('${worker}','working'),('${worker}','completed'),('${foreign}','working');`)
  const before = (await db.query('select * from public.hq_agent_jobs order by worker_id,status')).rows
  await db.exec(await readFile(new URL('./database-release-contract.sql', import.meta.url), 'utf8'))
  for (const role of ['anon', 'service_role']) {
    await db.exec('set role ' + role)
    await assert.rejects(() => db.query('select public.hq_worker_release_status($1)', [worker]), /permission denied/)
    await db.exec('reset role')
  }
  await db.exec('set role authenticated')
  await assert.rejects(() => db.query('select public.hq_worker_release_status($1)', [worker]), /HQ_WORKER_REQUIRED/)
  await db.query("select set_config('fixture.authorized_worker',$1,false)", [worker])
  const result = (await db.query('select public.hq_worker_release_status($1) value', [worker])).rows[0].value
  assert.deepEqual(result, { contract: 1, activeJobs: 1 })
  await assert.rejects(() => db.query('select public.hq_worker_release_status($1)', [foreign]), /HQ_WORKER_REQUIRED/)
  await assert.rejects(() => db.query('select * from public.hq_agent_jobs'), /permission denied/)
  await db.exec('reset role')
  assert.deepEqual((await db.query('select * from public.hq_agent_jobs order by worker_id,status')).rows, before)
  assert.ok((await db.query("select to_regprocedure('public.hq_worker_claim(uuid,integer,integer)')::text value")).rows[0].value)
  await db.exec(`update public.hq_agent_jobs set status='completed' where worker_id='${worker}'`)
  await db.exec('set role authenticated')
  assert.equal((await db.query('select public.hq_worker_release_status($1) value', [worker])).rows[0].value.activeJobs, 0)
  await db.exec('reset role; drop function public.hq_worker_claim(uuid,integer,integer)')
  await db.exec('set role authenticated')
  await assert.rejects(() => db.query('select public.hq_worker_release_status($1)', [worker]), /HQ_RELEASE_SCHEMA_INCOMPATIBLE/)
})
