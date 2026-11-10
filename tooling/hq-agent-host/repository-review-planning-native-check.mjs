/** Native PostgreSQL 17.11, fixed disposable database, no hosted connection input. */
import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { performance } from 'node:perf_hooks'
import { setTimeout as delay } from 'node:timers/promises'
import {
  preparedWorker, setFutureWorker, repositoryFixture, founder, session,
} from './public-repository-db-fixture.mjs'
import { evidence } from './claim-query-budget-checks.mjs'
import { latestOrdinary } from './trial-review-planning-checks.mjs'
import {
  repositoryReviewFixture, verifyRepositoryReviewPlanning, repositoryReviewDefinition,
  latestRepository, passedRepositoryAgent, repositoryBindingSource,
} from './repository-review-planning-checks.mjs'

const require = createRequire(new URL('../../package.json', import.meta.url))
const { Client } = require('pg')
const database = 'hq_repository_review_planning_disposable'
const clients = new Set()

async function connect(name, statementTimeout = 20000) {
  const db = new Client({
    host: '127.0.0.1', port: 5432, database, user: 'postgres',
    password: 'disposable-only', application_name: name,
    connectionTimeoutMillis: 5000, query_timeout: statementTimeout + 5000,
    statement_timeout: statementTimeout,
  })
  await db.connect()
  clients.add(db)
  return db
}

async function close(db) {
  await db.end()
  clients.delete(db)
}

async function asFounder(db) {
  await db.query('reset role')
  await db.query("select set_config('request.jwt.claims',$1,false)", [
    JSON.stringify({ sub: founder, role: 'authenticated', session_id: session }),
  ])
  await db.query('set role authenticated')
}

test('native repository review preserves true proof across cold and repeated four-reader batches', { timeout: 360000 }, async t => {
  t.after(async () => {
    await Promise.all([...clients].map(db => db.end().catch(() => {})))
  })
  const prepared = await preparedWorker()
  setFutureWorker(prepared)
  t.after(() => prepared.close())
  const db = await connect('hq-repository-review-installer')
  assert.deepEqual((await db.query(`select current_database() name,
    current_setting('server_version_num') version,
    to_regnamespace('hq_private') private_schema, to_regnamespace('auth') auth_schema`)).rows[0],
  { name: database, version: '170011', private_schema: null, auth_schema: null },
  'only the exact fresh disposable PostgreSQL 17.11 database may be initialized')
  const adapter = { query: (...args) => db.query(...args), exec: sql => db.query(sql), close: async () => {} }
  const f = await repositoryFixture({ database: adapter })
  const { h } = f
  await repositoryReviewFixture(f)
  await db.query('reset role')
  const ordinary = (await db.query(latestOrdinary)).rows
  assert.equal(ordinary.length, 10)
  assert.equal(ordinary.filter(row => row.status === 'passed' && row.purpose === 'synthetic-internal-trial-v1'
    && row.lifecycle === 'Active / Qualified').length, 8)
  assert.equal(ordinary.filter(row => row.status === 'canceled').length, 1)
  assert.equal(ordinary.filter(row => row.status === 'passed' && row.purpose === 'evaluator-skill-trial-v1').length, 1)
  const latest = (await db.query(latestRepository)).rows
  assert.equal(latest.length, 3)
  assert.equal(latest.filter(row => row.status === 'passed' && row.in_time).length, 1)
  assert.equal(latest.filter(row => row.status === 'canceled').length, 1)
  assert.equal(latest.filter(row => row.trial_id === null).length, 1)
  const passed = latest.find(row => row.status === 'passed')
  assert.equal(passed.agent_id, passedRepositoryAgent)
  assert.ok(passed.trial_id)
  assert.equal((await db.query('select hq_private.repository_review_ready($1) ready', [passed.trial_id])).rows[0].ready, true,
    'the fixture exercises an actual accepted repository proof, not only false branches')
  const original = await repositoryReviewDefinition(db)
  const preserved = await evidence(db)
  const state = async () => (await db.query(`select
    (select md5(jsonb_agg(to_jsonb(t) order by id)::text) from hq_private.workforce_trials t) trials,
    (select md5(jsonb_agg(to_jsonb(j) order by id)::text) from public.hq_agent_jobs j) jobs,
    (select md5(jsonb_agg(to_jsonb(r) order by job_id)::text) from hq_private.repository_receipts r) receipts,
    (select md5(jsonb_agg(to_jsonb(q) order by id)::text) from hq_private.repository_qualifications q) qualifications,
    (select md5(jsonb_agg(to_jsonb(e) order by job_id)::text) from hq_private.repository_host_executions e) executions`)).rows[0]
  const preservedState = await state()
  await h.as('founder')
  const expected = await h.rpc('hq_workforce_trial_status')
  assert.equal(expected.length, 10)
  const expectedPassed = expected.find(row => row.agentId === passed.agent_id)
  assert.equal(expectedPassed.repository.reviewComplete, true)
  assert.equal(expectedPassed.repository.qualified, true)
  await db.query('reset role')

  const seenPids = new Set()
  const openReaders = async phase => {
    const readers = await Promise.all(Array.from({ length: 4 }, (_, i) => connect(`hq-repository-${phase}-${i}`, 8000)))
    for (const reader of readers) {
      await asFounder(reader)
      const settings = (await reader.query(`select pg_backend_pid() pid,
        current_setting('statement_timeout') statement_timeout,
        current_setting('join_collapse_limit') join_collapse_limit`)).rows[0]
      assert.equal(settings.statement_timeout, '8s')
      assert.equal(settings.join_collapse_limit, '8')
      assert.ok(!seenPids.has(settings.pid), 'each phase starts four fresh server-side plan caches')
      seenPids.add(settings.pid)
    }
    return readers
  }
  const batch = async (readers, phase, round, mustSucceed) => {
    const utcStart = new Date().toISOString(), start = performance.now()
    const responses = await Promise.all(readers.map(async (reader, index) => {
      const began = performance.now()
      try {
        const result = (await reader.query('select public.hq_workforce_trial_status() result')).rows[0].result
        return { index, ok: true, elapsedMs: performance.now() - began, result }
      } catch (error) {
        return { index, ok: false, elapsedMs: performance.now() - began, code: error.code, message: error.message }
      }
    }))
    const summary = {
      phase, round, concurrentSessions: 4, statementTimeoutMs: 8000, utcStart,
      utcEnd: new Date().toISOString(), batchMs: performance.now() - start,
      samples: responses.map(({ index, ok, elapsedMs, code }) => ({ index, ok, elapsedMs, ...(code ? { code } : {}) })),
    }
    t.diagnostic(JSON.stringify(summary))
    for (const response of responses) {
      if (!response.ok) {
        assert.equal(response.code, '57014', 'only a real statement timeout may fail the measured baseline')
        assert.match(response.message, /statement timeout/)
      } else {
        assert.deepEqual(response.result, expected, `${phase} round ${round}: complete status and ordering match`)
        const row = response.result.find(value => value.agentId === passed.agent_id)
        assert.equal(row.repository.reviewComplete, true)
        assert.equal(row.repository.qualified, true)
      }
    }
    if (mustSucceed) assert.ok(responses.every(response => response.ok), 'all candidate readers must succeed without increasing the 8s cap')
    for (const reader of readers) {
      assert.equal((await reader.query('show join_collapse_limit')).rows[0].join_collapse_limit, '8')
      assert.equal((await reader.query('show statement_timeout')).rows[0].statement_timeout, '8s')
    }
    return summary
  }

  const baselineReaders = await openReaders('baseline')
  try { await batch(baselineReaders, 'baseline-cold', 0, false) }
  finally { await Promise.all(baselineReaders.map(close)) }
  const verified = await verifyRepositoryReviewPlanning(h, { report: value => t.diagnostic(JSON.stringify({ parity: value })) })
  assert.equal(verified.original, original)
  assert.deepEqual(verified.counts, { baseline: 3, candidate: 1 })
  await db.query('reset role')
  const candidate = await repositoryReviewDefinition(db)
  assert.notEqual(candidate, original)
  const candidateReaders = await openReaders('candidate')
  try {
    await batch(candidateReaders, 'candidate-cold', 0, true)
    // Retain four independent sessions for three additional bounded batches.
    // This covers repeated access as well as the first cold compilation.
    for (let round = 1; round <= 3; round++) {
      await delay(2000)
      await batch(candidateReaders, 'candidate-repeated', round, true)
    }
  } finally { await Promise.all(candidateReaders.map(close)) }

  const reader = await connect('hq-repository-freshness', 8000)
  const writer = await connect('hq-repository-writer')
  const profile = repositoryBindingSource
  assert.equal((await db.query('select source_version from hq_private.brain_files where file_id=$1', [profile])).rows[0].source_version, '1')
  const fresh = async expectedReady => {
    await asFounder(reader)
    const result = (await reader.query('select public.hq_workforce_trial_status() result')).rows[0].result
    const row = result.find(value => value.agentId === passed.agent_id)
    assert.equal(row.repository.reviewComplete, expectedReady, 'status observes only committed source binding')
    assert.equal(row.repository.qualified, expectedReady, 'qualification remains tied to current accepted proof')
    await db.query('reset role')
    assert.equal((await db.query('select hq_private.repository_review_ready($1) ready', [passed.trial_id])).rows[0].ready, expectedReady)
    assert.equal((await reader.query('show join_collapse_limit')).rows[0].join_collapse_limit, '8')
  }
  for (let i = 0; i < 7; i++) await fresh(true)
  await writer.query('begin')
  await writer.query("update hq_private.brain_files set source_version='2' where file_id=$1", [profile])
  await fresh(true)
  await writer.query('commit')
  await fresh(false)
  await writer.query('begin')
  await writer.query("update hq_private.brain_files set source_version='1' where file_id=$1", [profile])
  await fresh(false)
  await writer.query('rollback')
  await fresh(false)
  await writer.query("update hq_private.brain_files set source_version='1' where file_id=$1", [profile])
  await fresh(true)
  await db.query('reset role')
  assert.deepEqual((await db.query(latestOrdinary)).rows, ordinary)
  assert.deepEqual((await db.query(latestRepository)).rows, latest)
  assert.deepEqual(await evidence(db), preserved)
  assert.deepEqual(await state(), preservedState, 'trials, jobs, immutable repository receipts and host evidence stay unchanged')
  assert.equal(await repositoryReviewDefinition(db), candidate)
})
