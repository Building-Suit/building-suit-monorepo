import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { setTimeout as delay } from 'node:timers/promises'
import test from 'node:test'
import { PGlite } from '@electric-sql/pglite'

const migrations = new URL('../../supabase/migrations/', import.meta.url)
const source = file => readFile(new URL(file, migrations), 'utf8')
const migration = '20261110140541_hq_founder_shared_authorization.sql'
const founder = '10000000-0000-4000-8000-000000000001'
const session = '20000000-0000-4000-8000-000000000001'
const other = '10000000-0000-4000-8000-000000000002'
const otherSession = '20000000-0000-4000-8000-000000000002'
const claims = { sub: founder, role: 'authenticated', session_id: session }
const permissionsSql = `select p.oid,n.nspname,p.proname,p.proowner,p.prosecdef,p.provolatile,p.proconfig,p.proacl::text
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where (n.nspname='hq_private' and p.proname in ('bind_founder','founder_uid','live_auth_uid'))
     or (n.nspname='public' and p.proname='hq_founder_access') order by n.nspname,p.proname`

async function installBase(db) {
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema auth;
    create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
    create table auth.sessions(id uuid primary key,user_id uuid,not_after timestamptz);
    create function auth.jwt() returns jsonb language sql stable as $$
      select nullif(current_setting('request.jwt.claims',true),'')::jsonb $$;
    create function auth.uid() returns uuid language sql stable as $$ select (auth.jwt()->>'sub')::uuid $$;
    grant usage on schema auth to authenticated,service_role;
    grant execute on function auth.jwt(),auth.uid() to authenticated,service_role;
  `)
  await db.exec(await source('20261104194233_hq_founder_company_plans.sql'))
}

async function install(db) {
  await installBase(db)
  const permissions = (await db.query(permissionsSql)).rows
  await db.exec(await source(migration))
  assert.deepEqual((await db.query(permissionsSql)).rows, permissions,
    'replacement preserves exact OIDs, owners, ACLs, security, volatility and safe search paths')
  await db.query(`insert into auth.users values($1,'ceo@building-suit.com',clock_timestamp()),
    ($2,'other@example.test',clock_timestamp())`, [founder, other])
  await db.query('insert into auth.sessions values($1,$2,null),($3,$4,null)', [session, founder, otherSession, other])
}

async function authorize(db, value = claims) {
  await db.query('reset role')
  await db.query("select set_config('request.jwt.claims',$1,false)", [JSON.stringify(value)])
  await db.query('set role authenticated')
}

async function access(db, value = claims) {
  await authorize(db, value)
  try { return (await db.query('select public.hq_founder_access() as data')).rows[0].data.isFounder }
  finally { await db.query('reset role') }
}

async function evidence(db) {
  return {
    invitations: (await db.query('select * from hq_private.founder_invitations order by id')).rows,
    founders: (await db.query('select * from public.hq_founders order by user_id')).rows,
  }
}

test('founder binding keeps authority, history, repair behavior and exact privileges', async t => {
  const db = new PGlite()
  t.after(() => db.close())
  await install(db)
  assert.equal(await access(db), true, 'confirmed founder binds once')
  const original = await evidence(db)
  for (let attempt = 0; attempt < 8; attempt++) assert.equal(await access(db), true)
  assert.deepEqual(await evidence(db), original, 'repeated access preserves invitation and membership history')

  await t.test('already bound access issues no invitation or membership writes', async () => {
    await db.exec(`begin;
      create function hq_private.fixture_reject_write() returns trigger language plpgsql as $$
        begin raise exception 'FIXTURE_UNEXPECTED_WRITE'; end $$;
      create trigger fixture_invitation_write before insert or update or delete on hq_private.founder_invitations
        for each statement execute function hq_private.fixture_reject_write();
      create trigger fixture_founder_write before insert or update or delete on public.hq_founders
        for each statement execute function hq_private.fixture_reject_write();`)
    try { assert.equal(await access(db), true) }
    finally { await db.exec('rollback') }
  })

  const denied = [
    ['missing session', 'delete from auth.sessions where id=$1', [session]],
    ['expired session', "update auth.sessions set not_after=clock_timestamp()-interval '1 second' where id=$1", [session]],
    ['session belongs to another user', 'update auth.sessions set user_id=$2 where id=$1', [session, other]],
    ['deleted user', 'delete from auth.users where id=$1', [founder]],
    ['unconfirmed email', 'update auth.users set email_confirmed_at=null where id=$1', [founder]],
    ['changed email', "update auth.users set email='changed@example.test' where id=$1", [founder]],
    ['revoked invitation', 'update hq_private.founder_invitations set revoked_at=clock_timestamp()', []],
    ['revoked membership', 'update public.hq_founders set revoked_at=clock_timestamp()', []],
  ]
  for (const [name, sql, args] of denied) await t.test(name, async () => {
    await db.exec('begin')
    try {
      await db.query(sql, args)
      const before = await evidence(db)
      assert.equal(await access(db), false)
      assert.deepEqual(await evidence(db), before, 'denial never resurrects or rewrites authority')
    } finally { await db.exec('rollback') }
  })

  await t.test('claims and user metadata alone cannot grant authority', async () => {
    for (const value of [
      { ...claims, role: 'service_role' }, { ...claims, sub: null }, { ...claims, session_id: null },
      { ...claims, session_id: 'invalid-session' },
      { sub: other, session_id: otherSession, role: 'authenticated', email: 'ceo@building-suit.com',
        user_metadata: { isFounder: true, role: 'founder' } },
    ]) assert.equal(await access(db, value), false)
    assert.deepEqual(await evidence(db), original)
  })

  await t.test('email reuse never rebinds an existing invitation', async () => {
    await db.exec('begin')
    try {
      await db.query('delete from auth.users where id=$1', [founder])
      await db.query("update auth.users set email='ceo@building-suit.com' where id=$1", [other])
      assert.equal(await access(db, { ...claims, sub: other, session_id: otherSession }), false)
      assert.deepEqual(await evidence(db), original)
    } finally { await db.exec('rollback') }
  })

  await t.test('missing membership repairs without changing its immutable invitation binding', async () => {
    await db.exec('begin')
    try {
      await db.query('delete from public.hq_founders where user_id=$1', [founder])
      assert.equal(await access(db), true)
      const repaired = await evidence(db)
      assert.deepEqual(repaired.invitations, original.invitations)
      assert.equal(repaired.founders.length, 1)
      assert.equal(repaired.founders[0].user_id, founder)
      assert.equal(repaired.founders[0].revoked_at, null)
    } finally { await db.exec('rollback') }
  })

  await t.test('mismatched membership cannot authorize or overwrite its recorded invitation', async () => {
    await db.exec('begin')
    try {
      await db.exec("insert into hq_private.founder_invitations(email) values('mismatch@example.test')")
      await db.query(`update public.hq_founders set invitation_id=(select id from hq_private.founder_invitations
        where email='mismatch@example.test') where user_id=$1`, [founder])
      const before = await evidence(db)
      assert.equal(await access(db), false)
      assert.deepEqual(await evidence(db), before)
    } finally { await db.exec('rollback') }
  })

  await t.test('authenticated callers cannot read or mutate authority tables directly', async () => {
    await authorize(db)
    for (const sql of ['select * from public.hq_founders', 'select * from hq_private.founder_invitations',
      'update public.hq_founders set revoked_at=null', 'select hq_private.founder_uid()']) {
      await assert.rejects(db.query(sql), /permission denied/)
    }
    await db.query('reset role')
    for (const role of ['anon', 'service_role']) {
      await db.query(`set role ${role}`)
      await assert.rejects(db.query('select public.hq_founder_access()'), /permission denied/)
      await db.query('reset role')
    }
  })
})

test('founder migration rejects a missing or changed predecessor without creating public authority', async t => {
  const db = new PGlite()
  t.after(() => db.close())
  await installBase(db)
  const candidate = await source(migration)
  const original = (await db.query("select pg_get_functiondef('hq_private.bind_founder()'::regprocedure) as definition")).rows[0].definition
  for (const [name, change] of [
    ['changed body', `create or replace function hq_private.bind_founder() returns boolean
      language plpgsql security definer set search_path='' as $$ begin return false; end $$`],
    ['changed language', `create or replace function hq_private.bind_founder() returns boolean
      language sql security definer set search_path='' as $$ select false $$`],
    ['missing function', 'drop function hq_private.bind_founder()'],
  ]) await t.test(name, async () => {
    await db.exec(change)
    const before = (await db.query(permissionsSql)).rows
    await assert.rejects(db.exec(candidate), /HQ_FOUNDER_BIND_PREDECESSOR_MISMATCH/)
    await db.exec('rollback')
    assert.deepEqual((await db.query(permissionsSql)).rows, before, 'failed migration must leave existing metadata unchanged')
    if (name === 'missing function') {
      assert.equal((await db.query("select to_regprocedure('hq_private.bind_founder()') as function")).rows[0].function, null)
    }
    await db.exec(original)
  })
})

// Native locking is exercised only in the fresh, isolated CI fixture container.
// Never accepts a URL, host, credentials or project override. PGlite does not
// establish cross-backend locking behavior; a skipped test is not a native pass.
test('native PostgreSQL founder checks preserve concurrency and revocation ordering', {
  skip: process.env.HQ_FOUNDER_NATIVE !== '1' && 'requires the disposable native PostgreSQL CI fixture',
  timeout: 180_000,
}, async t => {
  const require = createRequire(new URL('../../../../package.json', import.meta.url))
  const { Client } = require('pg')
  const clients = []
  async function connect(name) {
    const db = new Client({ host: '127.0.0.1', port: 5432, database: 'hq_founder_bind_disposable',
      user: 'postgres', password: 'disposable-only', application_name: name,
      connectionTimeoutMillis: 5000, statement_timeout: 15_000, query_timeout: 20_000 })
    await db.connect()
    clients.push(db)
    db.exec = sql => db.query(sql)
    return db
  }
  // Closing every independent backend rolls back locks even if an assertion fails.
  t.after(async () => { await Promise.all(clients.map(db => db.end().catch(() => {}))) })
  const admin = await connect('hq-founder-installer')
  const a = await connect('hq-founder-reader-a')
  const b = await connect('hq-founder-reader-b')
  const hold = await connect('hq-founder-holder')
  const observer = await connect('hq-founder-observer')
  assert.equal((await admin.query('select current_database() as name')).rows[0].name, 'hq_founder_bind_disposable')
  assert.equal((await admin.query("select to_regnamespace('hq_private') as schema")).rows[0].schema, null,
    'refuse to install fixtures into an existing HQ schema')
  await install(admin)
  async function race(name, run) {
    let failed
    await t.test(name, async () => {
      try { await run() }
      catch (error) { failed = error; throw error }
    })
    // Stop on a failed race so parent teardown closes all backends immediately,
    // rather than attempting later cases while a failed assertion retains locks.
    if (failed) throw failed
  }
  const pid = async db => (await db.query('select pg_backend_pid() as pid')).rows[0].pid
  const aPid = await pid(a), bPid = await pid(b), holdPid = await pid(hold)
  const begin = async db => { await db.query('reset role'); await db.query('begin') }
  const finish = async (db, action = 'rollback') => { await db.query(action); await db.query('reset role') }
  function pending(promise) {
    // Install a rejection handler immediately, before waiting for observed locks.
    promise.catch(() => {})
    return promise
  }
  async function waitForBlock(blockedPid, blockerPid) {
    const deadline = Date.now() + 8000
    while (Date.now() < deadline) {
      const row = (await observer.query(`select wait_event_type,pg_blocking_pids(pid) as blockers
        from pg_stat_activity where pid=$1`, [blockedPid])).rows[0]
      if (row?.wait_event_type === 'Lock' && row.blockers.includes(blockerPid)) return
      await delay(20)
    }
    assert.fail(`backend ${blockedPid} must enter an observed lock wait on ${blockerPid}`)
  }

  await race('first binding serializes, then preserves one binding and membership', async () => {
    await begin(a)
    assert.equal(await access(a), true)
    const second = pending(access(b))
    await waitForBlock(bPid, aPid)
    await finish(a, 'commit')
    assert.equal(await second, true)
    const state = await evidence(admin)
    assert.equal(state.founders.length, 1)
    assert.equal(state.invitations[0].bound_user_id, founder)
  })

  await race('bound checks coexist but block invitation revocation until both commit', async () => {
    await begin(a); await begin(b)
    assert.equal(await access(a), true)
    // A second shared reader finishes while A still retains its transaction lock.
    await b.query("set local lock_timeout='2s'")
    assert.equal(await access(b), true)
    const revoking = pending(hold.query('update hq_private.founder_invitations set revoked_at=clock_timestamp()'))
    await waitForBlock(holdPid, aPid)
    await finish(a, 'commit')
    await waitForBlock(holdPid, bPid)
    await finish(b, 'commit')
    await revoking
    assert.equal(await access(a), false)
    await admin.query('update hq_private.founder_invitations set revoked_at=null')
  })

  await race('in-flight invitation revocation is awaited and committed denial is respected', async () => {
    await begin(hold)
    await hold.query('update hq_private.founder_invitations set revoked_at=clock_timestamp()')
    const result = pending(access(a))
    await waitForBlock(aPid, holdPid)
    await finish(hold, 'commit')
    assert.equal(await result, false)
    await admin.query('update hq_private.founder_invitations set revoked_at=null')
  })

  await race('rolled-back invitation revocation does not deny valid authority', async () => {
    await begin(hold)
    await hold.query('update hq_private.founder_invitations set revoked_at=clock_timestamp()')
    const result = pending(access(a))
    await waitForBlock(aPid, holdPid)
    await finish(hold)
    assert.equal(await result, true)
  })

  for (const [name, change, restore] of [
    ['session expires', "update auth.sessions set not_after=clock_timestamp()-interval '1 second'", 'update auth.sessions set not_after=null'],
    ['membership is revoked', 'update public.hq_founders set revoked_at=clock_timestamp()', 'update public.hq_founders set revoked_at=null'],
    ['verified email changes', "update auth.users set email='changed@example.test' where id='" + founder + "'", "update auth.users set email='ceo@building-suit.com' where id='" + founder + "'"],
  ]) await race(`fresh authority is rechecked after waiting when ${name}`, async () => {
    await begin(hold)
    await hold.query('select id from hq_private.founder_invitations for update')
    const result = pending(access(a))
    await waitForBlock(aPid, holdPid)
    await admin.query(change)
    await finish(hold)
    assert.equal(await result, false)
    await admin.query(restore)
  })

  await race('two failed fast checks return false without SHARE-to-UPDATE upgrades', async () => {
    await begin(hold)
    await hold.query('select id from hq_private.founder_invitations for update')
    await begin(a); await begin(b)
    const results = [pending(access(a)), pending(access(b))]
    await waitForBlock(aPid, holdPid); await waitForBlock(bPid, holdPid)
    await admin.query('update public.hq_founders set revoked_at=clock_timestamp()')
    await finish(hold)
    assert.deepEqual(await Promise.all(results), [false, false])
    await finish(a); await finish(b)
    await admin.query('update public.hq_founders set revoked_at=null')
  })

  await race('two missing-membership repairs serialize without shared-lock upgrade deadlocks', async () => {
    const before = (await evidence(admin)).invitations
    await admin.query('delete from public.hq_founders where user_id=$1', [founder])
    await begin(a)
    assert.equal(await access(a), true)
    const second = pending(access(b))
    await waitForBlock(bPid, aPid)
    await finish(a, 'commit')
    assert.equal(await second, true)
    const after = await evidence(admin)
    assert.deepEqual(after.invitations, before)
    assert.equal(after.founders.length, 1)
  })

  await race('first bind rechecks the live session after waiting and leaves no partial authority', async () => {
    await admin.query("insert into hq_private.founder_invitations(email) values('other@example.test')")
    await begin(hold)
    await hold.query("select id from hq_private.founder_invitations where email='other@example.test' for update")
    const result = pending(access(a, { ...claims, sub: other, session_id: otherSession }))
    await waitForBlock(aPid, holdPid)
    await admin.query('delete from auth.sessions where id=$1', [otherSession])
    await finish(hold)
    assert.equal(await result, false)
    assert.equal((await admin.query("select bound_user_id from hq_private.founder_invitations where email='other@example.test'")).rows[0].bound_user_id, null)
    assert.equal((await admin.query('select count(*)::integer as n from public.hq_founders where user_id=$1', [other])).rows[0].n, 0)
    await admin.query('insert into auth.sessions values($1,$2,null)', [otherSession, other])
  })

  await race('competing verified identities cannot bind the same invitation twice', async () => {
    const competitor = '10000000-0000-4000-8000-000000000003'
    const competitorSession = '20000000-0000-4000-8000-000000000003'
    // Deliberately stronger than upstream email uniqueness: even two synthetic
    // confirmed identities with the same email cannot win one invitation.
    await admin.query("insert into auth.users values($1,'other@example.test',clock_timestamp())", [competitor])
    await admin.query('insert into auth.sessions values($1,$2,null)', [competitorSession, competitor])
    await begin(a)
    assert.equal(await access(a, { ...claims, sub: other, session_id: otherSession }), true)
    const result = pending(access(b, { ...claims, sub: competitor, session_id: competitorSession }))
    await waitForBlock(bPid, aPid)
    await finish(a, 'commit')
    assert.equal(await result, false)
    assert.equal((await admin.query("select bound_user_id from hq_private.founder_invitations where email='other@example.test'")).rows[0].bound_user_id, other)
    assert.equal((await admin.query('select count(*)::integer as n from public.hq_founders where user_id=$1', [competitor])).rows[0].n, 0)
  })
})
