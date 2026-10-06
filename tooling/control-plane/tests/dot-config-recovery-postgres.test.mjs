import { initialSupervisorLeaseSql } from '../runner/supervisor-lease.mjs'
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

test('Dot binding recovery and native bounded ordinary publication preserve identities and advance normally', {
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
      .filter(file => /^\d{3}_.+\.sql$/.test(file) && Number(file.slice(0,3)) <= 28)
      .sort()
    assert.ok(['17', '18'].includes(psql(databaseUrl.href, ['-Atqc', "SELECT current_setting('server_version_num')::integer / 10000"])))
    assert.equal(psql(databaseUrl.href, ['-Atqc', "SELECT current_setting('check_function_bodies')"]), 'on')
    assert.equal(psql(databaseUrl.href, ['-Atqc', "LOAD 'plpgsql'; SELECT current_setting('plpgsql.variable_conflict')"]), 'error')
    const upgrade = migrations.at(-1)
    assert.equal(upgrade, '028_batch_admission_safe_resume.sql')
    for (const migration of migrations.slice(0, -1)) {
      psql(databaseUrl.href, ['-f', path.join(root, 'tooling/control-plane/sql', migration)])
    }
    assert.equal(psql(databaseUrl.href, ['-Atqc', "SELECT to_regclass('control.publication_readiness_contracts') IS NOT NULL"]), 't')
    assert.equal(psql(databaseUrl.href, ['-Atqc', "SELECT NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='control' AND table_name='workflow_runs' AND column_name='admitted_repair_id')"]), 't')
    psql(databaseUrl.href, ['-f', path.join(root, 'tooling/control-plane/sql', upgrade)])
    psql(databaseUrl.href, ['-f', path.join(root, 'tooling/control-plane/tests/batch-readiness-postgres-smoke.sql')])
    // Reproduce a resolved recovery whose old initial key exists in the journal.
    // Each supervisor invocation must atomically create its own active lease.
    const resumeIdentity = 'test:supervisor-lease-replay'
    const record = (key, token, status = 'active') => `control.record_recovery_condition(
      p_resume_identity => '${resumeIdentity}', p_idempotency_key => '${key}',
      p_failure_class => 'transient-infrastructure', p_error_code => 'implementation_failed',
      p_next_action => 'retry', p_recoverable => true, p_source => 'unit-test',
      p_heartbeat_at => now(), p_lease_owner => 'test-owner', p_lease_token => '${token}',
      p_lease_expires_at => now() + interval '5 minutes', p_status => '${status}')`
    psql(databaseUrl.href, ['-c', `SELECT ${record('old-decision', 'old-token')}`])
    psql(databaseUrl.href, ['-c', `SELECT ${record('resolved-stop', 'old-token', 'resolved')}`])
    const leaseSql = (key, token) => initialSupervisorLeaseSql(record(key, token))
      .replaceAll(":'resume_identity'", `'${resumeIdentity}'`)
      .replaceAll(":'lease_token'", `'${token}'`)
    const jsonLine = output => JSON.parse(output.split('\n').find(line => line.startsWith('{')))
    const fresh = jsonLine(psql(databaseUrl.href, ['-At'], { input: leaseSql('new-invocation:initial', 'new-token') }))
    assert.equal(fresh.acquired, true)
    assert.equal(fresh.recorded.recovery.status, 'active')
    assert.equal(fresh.recorded.recovery.lease_token, 'new-token')
    const contended = jsonLine(psql(databaseUrl.href, ['-At'], { input: leaseSql('contender:initial', 'contender-token') }))
    assert.equal(contended.acquired, false)
    assert.equal(contended.recovery.lease_token, 'new-token')
    psql(databaseUrl.href, ['-c', `SELECT ${record('resolved-before-race', 'new-token', 'resolved')}`])
    const raced = await Promise.all([
      concurrentPsql(databaseUrl.href, leaseSql('race-a:initial', 'race-a')),
      concurrentPsql(databaseUrl.href, leaseSql('race-b:initial', 'race-b')),
    ])
    assert.ok(raced.every(result => result.code === 0), JSON.stringify(raced))
    assert.deepEqual(raced.map(result => jsonLine(result.stdout).acquired).sort(), [false, true])


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
    psql(databaseUrl.href, ['-f', path.join(root, 'tooling/control-plane/sql/029_selfhealing_runtime_operations.sql')])
    psql(databaseUrl.href, ['-f', path.join(root, 'tooling/control-plane/tests/selfhealing-postgres-smoke.sql')])
    psql(databaseUrl.href, ['-c', "DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='bs_control_app') THEN CREATE ROLE bs_control_app; END IF; END $$; ALTER DEFAULT PRIVILEGES IN SCHEMA control GRANT ALL ON TABLES TO bs_control_app;"])
    psql(databaseUrl.href, ['-f', path.join(root, 'tooling/control-plane/sql/031_bounded_ordinary_publication.sql')])
    assert.equal(psql(databaseUrl.href, ['-Atqc', "SELECT has_table_privilege('bs_control_app','control.run_task_publication_authorities','SELECT') AND NOT has_table_privilege('bs_control_app','control.run_task_publication_authorities','INSERT,UPDATE,DELETE,TRUNCATE')"]), 't')
    psql(databaseUrl.href, ['-f', path.join(root, 'tooling/control-plane/tests/bounded-publication-smoke.sql')])
    psql(databaseUrl.href, ['-f', path.join(root, 'tooling/control-plane/sql/032_dot_watchdog.sql')])
    psql(databaseUrl.href, ['-f', path.join(root, 'tooling/control-plane/sql/030_verifier_only_reacceptance.sql')])
    psql(databaseUrl.href, ['-f', path.join(root, 'tooling/control-plane/sql/033_dot_same_attempt_reacceptance.sql')])
    psql(databaseUrl.href, ['-f', path.join(root, 'tooling/control-plane/sql/034_dot_admission_refresh.sql')])
    psql(databaseUrl.href, ['-f', path.join(root, 'tooling/control-plane/sql/035_dot_event_backpressure.sql')])
    psql(databaseUrl.href, ['-f', path.join(root, 'tooling/control-plane/sql/036_dot_future_retry_escalation.sql')])
    psql(databaseUrl.href, ['-f', path.join(root, 'tooling/control-plane/sql/037_dot_future_scope_capture.sql')])
    psql(databaseUrl.href, ['-f', path.join(root, 'tooling/control-plane/tests/dot-future-scope-smoke.sql')])
    assert.equal(psql(databaseUrl.href, ['-Atqc', "SELECT attempt_profiles->>1 FROM control.retry_policies WHERE policy_id='standard-five'"]), 'deep')
    psql(databaseUrl.href, ['-f', path.join(root, 'tooling/control-plane/tests/dot-postgres-smoke.sql')])
    psql(databaseUrl.href, ['-f', path.join(root, 'tooling/control-plane/tests/shared-retry-five-seed.sql')])
    psql(databaseUrl.href, ['-f', path.join(root, 'tooling/control-plane/sql/038_shared_product_retry_accounting.sql')])
    psql(databaseUrl.href, ['-f', path.join(root, 'tooling/control-plane/sql/039_dot_reviewed_verifier_reacceptance.sql')])
    psql(databaseUrl.href, ['-f', path.join(root, 'tooling/control-plane/sql/040_dot_reaccepted_publication.sql')])
    psql(databaseUrl.href, ['-f', path.join(root, 'tooling/control-plane/tests/shared-retry-five-smoke.sql')])
    psql(databaseUrl.href, ['-f', path.join(root, 'tooling/control-plane/tests/dot-reaccepted-publication-smoke.sql')])
    psql(databaseUrl.href, ['-f', path.join(root, 'tooling/control-plane/sql/041_dot_configuration_recovery.sql')])
    psql(databaseUrl.href, ['-f', path.join(root, 'tooling/control-plane/sql/042_dot_owned_ordinary_scope.sql')])
    psql(databaseUrl.href, ['-f', path.join(root, 'tooling/control-plane/tests/dot-config-recovery-smoke.sql')])

  }
  finally {
    parsed.pathname = '/postgres'
    psql(parsed.href, ['-c', `DROP DATABASE IF EXISTS ${database} WITH (FORCE)`])
  }
})
