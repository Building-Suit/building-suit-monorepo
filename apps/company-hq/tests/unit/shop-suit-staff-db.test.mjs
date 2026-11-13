import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { PGlite } from '@electric-sql/pglite'

const migrations = new URL('../../supabase/migrations/', import.meta.url)
const source = file => readFile(new URL(file, migrations), 'utf8')
const founder = '10000000-0000-4000-8000-000000000001'
const worker = '10000000-0000-4000-8000-000000000002'
const founderSession = '20000000-0000-4000-8000-000000000001'
const workerSession = '20000000-0000-4000-8000-000000000002'
const workerId = '30000000-0000-4000-8000-000000000001'
const first = { employeeId: '40000000-0000-4000-8000-000000000001', shopName: 'صالون وسط البلد', state: 'idle' }
const second = { employeeId: '40000000-0000-4000-8000-000000000002', shopName: 'Second shop', state: 'busy' }

test('the registered HQ worker publishes an atomic metadata roster read only by the signed-in founder', async t => {
  const db = new PGlite()
  t.after(() => db.close())
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema auth;
    create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
    create table auth.sessions(id uuid primary key,user_id uuid,not_after timestamptz);
    create function auth.jwt() returns jsonb language sql stable as $$
      select nullif(current_setting('request.jwt.claims',true),'')::jsonb $$;
    create function auth.uid() returns uuid language sql stable as $$ select (auth.jwt()->>'sub')::uuid $$;
    create schema realtime;
    create table realtime.messages(topic text, extension text);
    alter table realtime.messages enable row level security;
    create function realtime.topic() returns text language sql as $$ select null::text $$;
  `)
  await db.exec(await source('20261104194233_hq_founder_company_plans.sql'))
  await db.exec(`create table hq_private.live_invalidations (id uuid primary key default gen_random_uuid(),
    kind text not null check (kind in ('brain','company','access')), delivered_at timestamptz);`)
  const queue = await source('20261105035454_hq_agent_messages_worker_queue.sql')
  await db.exec(queue.slice(0, queue.indexOf('create function hq_private.agent_snapshot()')))
  await db.exec(await source('20261113023602_hq_shop_suit_staff_snapshot.sql'))
  await db.query("insert into auth.users values ($1,'ceo@building-suit.com',now()), ($2,'worker@example.test',now())", [founder, worker])
  await db.query('insert into auth.sessions values ($1,$2,null),($3,$4,null)', [founderSession, founder, workerSession, worker])
  await db.query('select hq_private.register_agent_worker($1,$2)', [workerId, worker])

  async function queryAs(user, session, sql, args = [], role = 'authenticated') {
    await db.query("select set_config('request.jwt.claims',$1,false)", [JSON.stringify({ sub: user, session_id: session, role })])
    await db.exec(`set role ${role}`)
    try { return (await db.query(sql, args)).rows[0]?.data }
    finally { await db.exec('reset role') }
  }
  const publish = (staff, id = workerId) => queryAs(worker, workerSession,
    'select public.hq_worker_sync_shop_staff($1,$2) as data', [id, staff === null ? null : JSON.stringify(staff)])
  const read = (after = null, limit = 100) => queryAs(founder, founderSession,
    'select public.hq_shop_suit_staff($1,$2) as data', [after, limit])

  assert.equal((await queryAs(founder, founderSession, 'select public.hq_founder_access() as data')).isFounder, true)
  assert.deepEqual(await read(), { status: 'unconfigured', staff: [], next: null, observedAt: null })
  await assert.rejects(() => queryAs(worker, workerSession, 'select public.hq_shop_suit_staff()'), /HQ_FOUNDER_REQUIRED/)
  await assert.rejects(() => queryAs(founder, founderSession, 'select public.hq_worker_sync_shop_staff($1,$2)', [workerId, '[]']), /HQ_WORKER_REQUIRED/)
  await assert.rejects(() => queryAs(null, null, 'select public.hq_shop_suit_staff()', [], 'anon'), /permission denied/)
  await assert.rejects(() => queryAs(null, null, 'select public.hq_shop_suit_staff()', [], 'service_role'), /permission denied/)
  await assert.rejects(() => queryAs(founder, founderSession, 'select * from hq_private.shop_suit_staff_snapshot'), /permission denied/)
  await assert.rejects(() => publish([first], founder), /HQ_WORKER_REQUIRED/)

  assert.deepEqual(await publish([second, first]), { accepted: true, count: 2, status: 'ready' })
  const { observedAt } = await read()
  assert.ok(Number.isFinite(Date.parse(observedAt)))
  assert.equal((await db.query("select count(*)::int count from hq_private.live_invalidations where kind='company'")).rows[0].count, 1)
  assert.deepEqual(await publish([first, second]), { accepted: true, count: 2, status: 'ready' })
  assert.equal((await db.query("select count(*)::int count from hq_private.live_invalidations where kind='company'")).rows[0].count, 1)
  assert.deepEqual(await read(null, 1), { status: 'ready', staff: [first], next: first.employeeId, observedAt })
  assert.deepEqual(await read(first.employeeId, 1), { status: 'ready', staff: [second], next: null, observedAt })
  await assert.rejects(() => read(null, 101), /HQ_INVALID_SHOP_STAFF_PAGE/)
  for (const invalid of [[{ ...first, shopId: worker }], [first, first], [{ ...first, state: 'online' }],
    [{ ...first, shopName: ' ' }], [{ ...first, shopName: 'x'.repeat(201) }], Array(2001).fill(first), {}]) {
    await assert.rejects(() => publish(invalid), /HQ_INVALID_SHOP_STAFF/)
  }
  assert.deepEqual(await read(), { status: 'ready', staff: [first, second], next: null, observedAt })
  assert.deepEqual(await publish(null), { accepted: true, count: 0, status: 'overflow' })
  const overflow = await read()
  assert.deepEqual(overflow, { status: 'overflow', staff: [], next: null, observedAt: overflow.observedAt })
  assert.ok(Number.isFinite(Date.parse(overflow.observedAt)))
  assert.deepEqual(await publish([]), { accepted: true, count: 0, status: 'ready' })
  const empty = await read()
  assert.deepEqual(empty, { status: 'ready', staff: [], next: null, observedAt: empty.observedAt })
  assert.ok(Number.isFinite(Date.parse(empty.observedAt)))
  await publish([first]); await db.exec("update hq_private.shop_suit_staff_snapshot set observed_at = clock_timestamp() - interval '11 minutes'")
  const previous = await read()
  assert.deepEqual(previous, { status: 'ready', staff: [first], next: null, observedAt: previous.observedAt })
  assert.ok(Date.parse(previous.observedAt) < Date.parse(empty.observedAt))
  await db.query('update hq_private.agent_workers set enabled=false where worker_id=$1', [workerId])
  await assert.rejects(() => publish([second]), /HQ_WORKER_REQUIRED/)
})
