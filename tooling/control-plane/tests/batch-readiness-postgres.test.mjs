import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import { readdirSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../../../', import.meta.url))
const adminUrl = process.env.CP_BATCH_READY_TEST_POSTGRES_URL ?? ''
const postgresRequired = process.env.CP_BATCH_READY_TEST_REQUIRE_POSTGRES === '1'

function prerequisiteReason() {
  if (!adminUrl) return 'CP_BATCH_READY_TEST_POSTGRES_URL is not set'
  let parsed
  try { parsed = new URL(adminUrl) }
  catch { return 'CP_BATCH_READY_TEST_POSTGRES_URL is not a valid PostgreSQL URL' }
  if (!['localhost', '127.0.0.1', '::1'].includes(parsed.hostname)) return 'disposable PostgreSQL must be localhost-only'
  if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) return 'disposable PostgreSQL URL must use postgres:// or postgresql://'
  if (spawnSync('psql', ['--version'], { encoding:'utf8' }).status !== 0) return 'psql is unavailable'
  return null
}

function psql(url, args, options = {}) {
  const result = spawnSync('psql', [url, '-X', '-v', 'ON_ERROR_STOP=1', ...args], {
    cwd:root, encoding:'utf8', timeout:120_000, ...options,
  })
  assert.equal(result.status, 0, `${result.stderr || result.stdout || result.error?.message}`)
  return result.stdout.trim()
}

function concurrentPsql(url, sql) {
  return new Promise(resolve => {
    const child = spawn('psql', [url, '-X', '-v', 'ON_ERROR_STOP=1', '-Atqc', sql], {
      cwd:root, stdio:['ignore', 'pipe', 'pipe'],
    })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', chunk => { stdout += chunk })
    child.stderr.on('data', chunk => { stderr += chunk })
    child.on('close', code => resolve({ code,stdout,stderr }))
  })
}

const prerequisite = prerequisiteReason()

test('migration 001..028 and upgrade 027->028 preserve authoritative full lifecycle behavior', {
  skip: !postgresRequired && prerequisite || false,
  timeout: 180_000,
}, async () => {
  assert.equal(prerequisite, null, prerequisite ?? undefined)
  const suffix = `${process.pid}_${Date.now()}`
  const database = `cp_batch_ready_test_${suffix}`
  const parsed = new URL(adminUrl)
  const databaseUrl = new URL(adminUrl)
  databaseUrl.pathname = `/${database}`

  psql(adminUrl, ['-c', `CREATE DATABASE ${database}`])
  try {
    const migrations = readdirSync(path.join(root, 'tooling/control-plane/sql'))
      .filter(file => /^\d{3}_.+\.sql$/.test(file))
      .sort()
    assert.equal(psql(databaseUrl.href, ['-Atqc', "SELECT current_setting('server_version_num')::integer / 10000"]), '17')
    assert.equal(psql(databaseUrl.href, ['-Atqc', "SELECT current_setting('check_function_bodies')"]), 'on')
    assert.equal(psql(databaseUrl.href, ['-Atqc', "SELECT current_setting('plpgsql.variable_conflict')"]), 'error')
    const upgrade = migrations.at(-1)
    assert.equal(upgrade, '028_batch_admission_safe_resume.sql')
    for (const migration of migrations.slice(0, -1)) {
      psql(databaseUrl.href, ['-f', path.join(root, 'tooling/control-plane/sql', migration)])
    }
    assert.equal(psql(databaseUrl.href, ['-Atqc', "SELECT to_regclass('control.publication_readiness_contracts') IS NOT NULL"]), 't')
    assert.equal(psql(databaseUrl.href, ['-Atqc', "SELECT NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='control' AND table_name='workflow_runs' AND column_name='admitted_repair_id')"]), 't')
    psql(databaseUrl.href, ['-f', path.join(root, 'tooling/control-plane/sql', upgrade)])
    psql(databaseUrl.href, ['-f', path.join(root, 'tooling/control-plane/tests/batch-readiness-postgres-smoke.sql')])

    const taskId = 'BS-UI-ZN-PATTERNS-001'
    const update = concurrentPsql(databaseUrl.href,
      `BEGIN; SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='10s'; UPDATE control.tasks SET metadata=metadata||'{"concurrency_update":true}'::jsonb WHERE task_id='${taskId}'; SELECT pg_sleep(0.5); COMMIT;`)
    await new Promise(resolve => setTimeout(resolve, 75))
    const refresh = concurrentPsql(databaseUrl.href,
      `BEGIN; SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='10s'; SELECT control.refresh_publication_readiness_contract('${taskId}','concurrency-test')->>'task_id'; COMMIT;`)
    const schedules = await Promise.all([update, refresh])
    assert.deepEqual(schedules.map(result => result.code), [0, 0], schedules.map(result => result.stderr).join('\n'))

    const runId = '4f3b1b7f-0c82-4667-a420-563a43953326'
    const first = concurrentPsql(databaseUrl.href,
      `SET statement_timeout='10s'; SELECT control.acquire_workflow_run_task('${runId}','cp-batch-v2','fixture-controller','controller-a','runner')->>'action';`)
    await new Promise(resolve => setTimeout(resolve, 75))
    const second = concurrentPsql(databaseUrl.href,
      `SET statement_timeout='10s'; SELECT control.acquire_workflow_run_task('${runId}','cp-batch-v2','fixture-controller','controller-b','runner')->>'action';`)
    const acquisitions = await Promise.all([first, second])
    assert.deepEqual(acquisitions.map(result => result.code), [0, 0], acquisitions.map(result => result.stderr).join('\n'))
    assert.equal(acquisitions[0].stdout.trim(), 'resume')
    assert.equal(acquisitions[1].stdout.trim(), 'wait_for_owner')

    psql(databaseUrl.href, ['-f', path.join(root, 'tooling/control-plane/tests/batch-readiness-authority-smoke.sql')])
    psql(databaseUrl.href, ['-f', path.join(root, 'tooling/control-plane/tests/batch-readiness-real-graph-lifecycle-smoke.sql')])
  }
  finally {
    parsed.pathname = '/postgres'
    psql(parsed.href, ['-c', `DROP DATABASE IF EXISTS ${database} WITH (FORCE)`])
  }
})
