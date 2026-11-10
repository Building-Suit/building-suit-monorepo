/** Native PostgreSQL 17.11 in one fixed fresh CI database. Never accepts a DSN. */
import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { performance } from 'node:perf_hooks'
import {
  preparedWorker, setFutureWorker, repositoryFixture, founder, session,
} from './public-repository-db-fixture.mjs'
import { evidence } from './claim-query-budget-checks.mjs'
import {
  trialReviewFixture, verifyTrialReviewPlanning, reviewDefinition, latestOrdinary,
} from './trial-review-planning-checks.mjs'

const require = createRequire(new URL('../../package.json', import.meta.url))
const { Client } = require('pg')
const database = 'hq_trial_review_planning_disposable'
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

test('native cold trial review stays within the unchanged eight-second cap with current evidence', { timeout: 300000 }, async t => {
  // Failure teardown closes every connection, rolling back any fixture writer.
  t.after(async () => {
    await Promise.all([...clients].map(db => db.end().catch(() => {})))
  })
  const prepared = await preparedWorker()
  setFutureWorker(prepared)
  t.after(() => prepared.close())
  const db = await connect('hq-review-installer')
  const identity = (await db.query(`select current_database() name,
    current_setting('server_version_num') version,
    to_regnamespace('hq_private') private_schema, to_regnamespace('auth') auth_schema`)).rows[0]
  assert.deepEqual(identity, { name: database, version: '170011', private_schema: null, auth_schema: null },
    'only the exact fresh disposable PostgreSQL 17.11 fixture may be initialized')
  const adapter = { query: (...args) => db.query(...args), exec: sql => db.query(sql), close: async () => {} }
  const f = await repositoryFixture({ database: adapter })
  const { h } = f
  const latest = await trialReviewFixture(f)
  assert.equal(latest.length, 10)
  const mix = {
    workers: latest.length,
    ineligiblePassedOrdinary: latest.filter(row => row.status === 'passed'
      && row.purpose === 'synthetic-internal-trial-v1' && row.lifecycle === 'Active / Qualified').length,
    canceled: latest.filter(row => row.status === 'canceled').length,
    eligibleEvaluator: latest.filter(row => row.status === 'passed'
      && row.purpose === 'evaluator-skill-trial-v1').length,
  }
  assert.deepEqual(mix, { workers: 10, ineligiblePassedOrdinary: 8, canceled: 1, eligibleEvaluator: 1 })
  await db.query('reset role')
  const original = await reviewDefinition(db)
  const preserved = await evidence(db)
  const state = async () => (await db.query(`select
    (select md5(jsonb_agg(to_jsonb(t) order by id)::text) from hq_private.workforce_trials t) trials,
    (select md5(jsonb_agg(to_jsonb(j) order by id)::text) from public.hq_agent_jobs j) jobs`)).rows[0]
  const preservedState = await state()
  await h.as('founder')
  const expected = await h.rpc('hq_workforce_trial_status')
  assert.equal(expected.length, 10)
  await db.query('reset role')

  // Each phase opens four different server sessions and never warms their
  // functions before the simultaneous query. Report baseline timeouts rather
  // than requiring a slow machine; the candidate must succeed at the same cap.
  const sessionPids = new Set()
  const fourFreshReads = async (phase, mustSucceed) => {
    const readers = await Promise.all(Array.from({ length: 4 }, (_, i) => connect(`hq-review-${phase}-${i}`, 8000)))
    try {
      for (const reader of readers) {
        await asFounder(reader)
        const settings = (await reader.query(`select pg_backend_pid() pid,
          current_setting('statement_timeout') statement_timeout,
          current_setting('join_collapse_limit') join_collapse_limit`)).rows[0]
        assert.equal(settings.statement_timeout, '8s')
        assert.equal(settings.join_collapse_limit, '8', 'caller planner setting stays at the PostgreSQL default')
        assert.ok(!sessionPids.has(settings.pid), 'each before/after reader has a fresh backend')
        sessionPids.add(settings.pid)
      }
      const start = performance.now()
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
        phase, freshSessions: readers.length, statementTimeoutMs: 8000,
        batchMs: performance.now() - start,
        samples: responses.map(({ index, ok, elapsedMs, code }) => ({ index, ok, elapsedMs, ...(code ? { code } : {}) })),
      }
      t.diagnostic(JSON.stringify(summary))
      for (const response of responses) {
        if (!response.ok) {
          assert.equal(response.code, '57014', 'only the actual unchanged statement timeout may fail the baseline')
          assert.match(response.message, /statement timeout/)
        } else {
          assert.deepEqual(response.result, expected, `${phase} complete response and ordering match the oracle`)
        }
      }
      if (mustSucceed) assert.ok(responses.every(response => response.ok), 'all four cold candidate reads complete under the unchanged 8s cap')
      for (const reader of readers) {
        assert.equal((await reader.query('show join_collapse_limit')).rows[0].join_collapse_limit, '8',
          'function-local planner setting does not leak after success or timeout')
        assert.equal((await reader.query('show statement_timeout')).rows[0].statement_timeout, '8s')
      }
      return summary
    } finally {
      await Promise.all(readers.map(close))
    }
  }

  const baseline = await fourFreshReads('baseline', false)
  const verified = await verifyTrialReviewPlanning(h, { report: value => t.diagnostic(JSON.stringify({ parity: value })) })
  assert.equal(verified.original, original)
  assert.deepEqual(verified.counts, { baseline: 10, candidate: 1 })
  const candidate = await fourFreshReads('candidate', true)
  t.diagnostic(JSON.stringify({ engine: 'PostgreSQL 17.11', mix, baseline, candidate, timingsAreObservations: true }))

  // A warmed server plan must observe committed evidence changes, but not
  // another session's dirty update. Rollback and restoration cannot leave a
  // stale result or function-local planner setting in the reader.
  const reader = await connect('hq-review-freshness', 8000)
  const writer = await connect('hq-review-writer')
  const trialId = verified.trial.id
  const skill = 'synthetic_repository_evaluator_skill'
  const source = (await db.query('select source_version from hq_private.brain_files where file_id=$1', [skill])).rows[0].source_version
  assert.equal(source, '1', 'generated evaluator fixture starts at source version 1')
  const fresh = async expectedReady => {
    await asFounder(reader)
    const result = (await reader.query('select public.hq_workforce_trial_status() result')).rows[0].result
    const evaluator = result.find(row => row.agentId === 'AG-HR-003')
    assert.equal(evaluator.ordinary.reviewComplete, expectedReady, 'assembled status observes committed review evidence')
    await db.query('reset role')
    assert.equal((await db.query('select hq_private.trial_review_ready($1) ready', [trialId])).rows[0].ready, expectedReady)
    assert.equal((await reader.query('show join_collapse_limit')).rows[0].join_collapse_limit, '8')
  }
  for (let i = 0; i < 7; i++) await fresh(true)
  await writer.query('begin')
  await writer.query("update hq_private.brain_files set source_version='2' where file_id=$1", [skill])
  await fresh(true)
  await writer.query('commit')
  await fresh(false)
  await writer.query('begin')
  await writer.query('update hq_private.brain_files set source_version=$1 where file_id=$2', [source, skill])
  await fresh(false)
  await writer.query('rollback')
  await fresh(false)
  await writer.query('update hq_private.brain_files set source_version=$1 where file_id=$2', [source, skill])
  await fresh(true)
  await db.query('reset role')
  assert.deepEqual((await db.query(latestOrdinary)).rows, latest, 'the trial mix remains unchanged')
  assert.deepEqual(await evidence(db), preserved, 'no artifact, host or qualification evidence was rewritten')
  assert.deepEqual(await state(), preservedState, 'read tests do not change trial, queue, lease or job state')
  assert.equal(await reviewDefinition(db), verified.candidate, 'all fixture instrumentation and oracle swaps were restored')
})
