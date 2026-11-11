/** Actual installed Supabase CLI against one fixed, network-isolated PG17.11 container.
 * No DSN, port, user, binary, workdir or credential overrides are accepted.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdtemp, mkdir, readdir, readFile, writeFile, rm, access } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import {
  reconciliationFixture, exactRetirementSql, migrationSql, retirementFile, compatibilityFile, assignmentFile,
  currentState, verifyRetirementEffects, verifyGreetingAndClaimFences,
  installLateFailure, removeLateFailure, verifyAssignmentOnly,
} from './retirement-reconciliation-checks.mjs'

const require = createRequire(new URL('../../package.json', import.meta.url))
const { Client } = require('pg')
const run = promisify(execFile)
const database = 'hq_retirement_reconciliation_disposable'
const selected = process.env.HQ_RETIREMENT_RECONCILIATION_CASE
assert.ok(['hosted','clean','rollback'].includes(selected), 'select a fixed fixture scenario, never a connection')
const files = [retirementFile, compatibilityFile, assignmentFile]
const clients = new Set()
async function connect(name) {
  const client = new Client({
    host: '127.0.0.1', port: 5432, database, user: 'postgres', password: 'disposable-only',
    ssl: false, application_name: name, connectionTimeoutMillis: 5000,
    statement_timeout: 20000, query_timeout: 25000,
  })
  await client.connect(); clients.add(client); return client
}
async function close(client) { await client.end(); clients.delete(client) }

async function cliHarness() {
  const directory = await mkdtemp(join(tmpdir(), 'hq-retirement-reconciliation-'))
  const home = join(directory, 'home'), migrations = join(directory, 'supabase', 'migrations')
  await mkdir(home); await mkdir(migrations, { recursive: true })
  await writeFile(join(directory, 'supabase', 'config.toml'), 'project_id = "hq-retirement-reconciliation-disposable"\n[db]\nmajor_version = 17\n')
  const manifest = require.resolve('supabase/package.json')
  assert.equal(JSON.parse(await readFile(manifest,'utf8')).version, '2.116.0', 'use the lockfile-installed CLI; never install/download at runtime')
  const executable = join(dirname(manifest), 'dist', 'supabase.js')
  // No inherited SUPABASE_*, PG*, proxy, token or binary-override variables.
  const env = { HOME: home, XDG_CONFIG_HOME: home, XDG_CACHE_HOME: home,
    PATH: '/usr/local/bin:/usr/bin:/bin', CI: 'true', NO_COLOR: '1' }
  async function invoke(args) {
    try {
      const { stdout, stderr } = await run(process.execPath, [executable, ...args], {
        cwd: directory, env, timeout: 45000, maxBuffer: 1024 * 1024, encoding: 'utf8',
      })
      return { code: 0, output: stdout + stderr }
    } catch (error) {
      if (!Number.isInteger(error.code)) throw error
      return { code: error.code, output: (error.stdout ?? '') + (error.stderr ?? '') }
    }
  }
  const version = await invoke(['--version'])
  assert.equal(version.code, 0, version.output); assert.match(version.output, /2\.116\.0/)
  const push = () => invoke(['db','push','--db-url',
    'postgresql://postgres:disposable-only@127.0.0.1:5432/hq_retirement_reconciliation_disposable?sslmode=disable',
    '--skip-vault','--yes','--workdir',directory])
  return { push, copy: async name => writeFile(join(migrations,name),await migrationSql(name)),
    close: () => rm(directory, { recursive: true, force: true }) }
}

async function ledger(db) {
  const exists = (await db.query("select to_regclass('supabase_migrations.schema_migrations') relation")).rows[0].relation
  return exists ? (await db.query('select version,name,statements,xmin::text original_transaction from supabase_migrations.schema_migrations order by version')).rows : []
}
async function existingLedger(db) {
  // Minimal official ledger shape, not a migration-selection implementation.
  // Only this scoped three-file recovery window is modeled, not all provider history.
  await db.exec(`create schema supabase_migrations;
    create table supabase_migrations.schema_migrations(version text not null primary key,statements text[],name text);`)
  for (const name of [retirementFile, compatibilityFile]) {
    await db.query('insert into supabase_migrations.schema_migrations(version,statements,name) values($1,$2,$3)',
      [name.slice(0,14), [await migrationSql(name)], name.slice(15,-4)])
  }
}
async function succeeds(cli) {
  const result = await cli.push()
  assert.equal(result.code, 0, result.output)
  return result.output
}
async function noReplay(db, cli) {
  const state = await currentState(db), history = await ledger(db)
  await succeeds(cli)
  assert.deepEqual(await currentState(db), state, 'second real CLI push is an application no-op')
  assert.deepEqual(await ledger(db), history, 'second push does not rewrite or duplicate the ledger')
}

async function verifyQueueFence(db, sql) {
  const holder = await connect('hq-retirement-lock-holder'), contender = await connect('hq-retirement-lock-contender')
  let pending
  try {
    const before = await currentState(db)
    await holder.query('begin;select pg_advisory_xact_lock(hashtextextended(\'hq-agent-queue\',0))')
    const holderPid = (await holder.query('select pg_backend_pid() pid')).rows[0].pid
    const contenderPid = (await contender.query('select pg_backend_pid() pid')).rows[0].pid
    // Original retirement has no lock_timeout. This disposable session supplies
    // a one-second bound; do not claim the migration supplies a bounded timeout.
    await contender.query("set lock_timeout='1s'")
    pending = contender.query(sql).then(() => ({ code: null }), error => error)
    let observed = false
    for (let attempt = 0; attempt < 30; attempt++) {
      const row = (await db.query(`select wait_event,pg_blocking_pids(pid) blockers from pg_stat_activity where pid=$1`, [contenderPid])).rows[0]
      if (row?.wait_event === 'advisory' && row.blockers.includes(holderPid)) { observed = true; break }
      await delay(20)
    }
    assert.equal(observed,true,'observe the exact retirement waiting at its canonical queue lock')
    assert.equal((await pending).code,'55P03')
    await contender.query('rollback')
    assert.deepEqual(await currentState(db),before,'native queue-lock refusal rolls back earlier trigger drops and revokes too')
  } finally {
    // Never release the holder while the contender might still commit.
    if (pending) await pending
    await contender.query('rollback').catch(() => {})
    await holder.query('rollback').catch(() => {})
    await Promise.all([close(holder),close(contender)])
  }
}

test(`native Supabase CLI retirement reconciliation: ${selected}`, { timeout: 240000 }, async t => {
  await access('/.dockerenv')
  assert.equal(process.version,'v26.8.1','run in the reviewed pinned CI image')
  assert.deepEqual((await readdir('/sys/class/net')).sort(),['lo'],'Docker --network none: no host ports or external network')
  t.after(async () => { await Promise.all([...clients].map(client => client.end().catch(() => {}))) })
  const client = await connect('hq-retirement-installer')
  const identity = (await client.query(`select current_database() name,current_user username,
    host(inet_server_addr()) address,current_setting('server_version_num') version,
    to_regnamespace('hq_private') private_schema,to_regnamespace('auth') auth_schema,
    to_regnamespace('extensions') extensions_schema,to_regnamespace('realtime') realtime_schema,
    to_regnamespace('supabase_migrations') migration_schema,
    (select count(*)::int from pg_roles where rolname in ('anon','authenticated','service_role')) fixture_roles,
    (select count(*)::int from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relkind in ('r','p','v','m','S','f')) public_relations`)).rows[0]
  assert.deepEqual(identity, { name: database, username: 'postgres', address: '127.0.0.1', version: '170011',
    private_schema: null, auth_schema: null, extensions_schema: null, realtime_schema: null,
    migration_schema: null, fixture_roles: 0, public_relations: 0 }, 'only a pristine fixed disposable cluster may be initialized')
  const db = { query: (...args) => client.query(...args), exec: sql => client.query(sql), close: async () => {} }
  const cli = await cliHarness()
  let f
  try {
    f = await reconciliationFixture(db)
    const sql = await exactRetirementSql()
    if (selected === 'hosted') {
      await db.exec(sql)
      await db.exec(await migrationSql(compatibilityFile))
      await verifyGreetingAndClaimFences(f.h)
      await existingLedger(db)
      const prior = await ledger(db), state = await currentState(db)
      await cli.copy(compatibilityFile); await cli.copy(assignmentFile)
      const missing = await cli.push()
      assert.notEqual(missing.code,0,'missing local historical version must fail before assignment')
      assert.match(missing.output,/20261111013758/)
      assert.match(missing.output,/not found|missing|history|migration/i)
      assert.deepEqual(await currentState(db),state)
      assert.deepEqual(await ledger(db),prior)
      await cli.copy(retirementFile)
      await verifyAssignmentOnly(db,async () => {
        assert.match(await succeeds(cli),/20261111033000/)
      })
      const final = await ledger(db)
      assert.deepEqual(final.filter(row => row.version !== '20261111033000'),prior,
        'restoring the file never reruns or rewrites existing retirement/compatibility history')
      assert.deepEqual(final.map(row => row.version),['20261111013758','20261111020000','20261111033000'])
    } else {
      for (const name of files) await cli.copy(name)
      const before = await currentState(db)
      if (selected === 'rollback') {
        await verifyQueueFence(db,sql)
        await installLateFailure(db)
        const failed = await cli.push()
        assert.notEqual(failed.code,0)
        assert.match(failed.output,/RETIREMENT_SYNTHETIC_LATE_FAILURE/)
        assert.deepEqual(await currentState(db),before,'late failure in real CLI push preserves application state')
        assert.deepEqual(await ledger(db),[],'failed migration is not registered as applied')
        await removeLateFailure(db)
      }
      await succeeds(cli)
      assert.deepEqual((await ledger(db)).map(row => row.version),['20261111013758','20261111020000','20261111033000'])
      await verifyRetirementEffects(f,before)
    }
    await noReplay(db,cli)
    await verifyGreetingAndClaimFences(f.h)
    t.diagnostic(`Supabase CLI 2.116.0 on PostgreSQL 17.11: ${selected}; synthetic application predecessor and three-file ledger window, not full provider bootstrap.`)
  } finally { await f?.close(); await cli.close() }
})
