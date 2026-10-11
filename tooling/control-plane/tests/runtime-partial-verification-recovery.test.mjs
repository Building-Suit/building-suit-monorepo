import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {spawnSync} from 'node:child_process'
import path from 'node:path'
import { runInNewContext } from 'node:vm'
import { controlQueryError, recoveryErrorEnvelope } from '../runner/recovery-error.mjs'

const source = readFileSync(new URL('../runner/bs-agent.mjs', import.meta.url), 'utf8')
const action = source.slice(source.indexOf('function taskVerify()'), source.indexOf('function resolvedRetryPolicy('))
const taskId = 'SAS-M1-SHOP-ADAPTER-001'

function resume({ resumed = true, eligible = true, sqlstate = 'P0001', message = 'immutable_verifier_receipt_conflict', checks = new Map(), crashAtFinalize = false } = {}) {
  const packet = { task: { task_id: taskId, status: 'verification' } }
  const execution = { execution_id: 313, attempt: 1, status: 'succeeded', worktree_path: '/fixture/product' }
  const verification = { verification_run_id: 335, resumed, verification_mode: 'focused' }
  const history = { packet, execution, verification }
  const before = JSON.stringify(history)
  const writes = [], outputs = [], launches = [], records = []
  const stderr = `file:///fixture/pinned-release/tooling/control-plane/runner/task-verifier.mjs:162\nthrow error\nError: ERROR: ${sqlstate}: ${message}\n`
  const invoke = runInNewContext(`(${action.trim()})`, {
    args: [taskId], path, process: { execPath: '/fixture/node', env: { BS_OPERATION_ID: 'existing-operation' } },
    repoRoot: '/fixture/repository', controlSourceRoot: '/fixture/pinned-release',
    validTaskId: () => true, evaluateWorkstreamReadiness: () => ({ ready: true }),
    controlQuery: (sql, values) => {
      if (sql.includes('generic_task_packet')) return packet
      writes.push({ sql, values })
      return eligible
    },
    parseControlJson: value => value, latestExecution: () => execution,
    mkdirSync: () => {}, writeFileSync: () => {}, beginVerification: () => verification,
    queueVerificationChecks: () => {},
    execute: (program, args) => { launches.push({ program, args: Array.from(args) }); return { code: 1, stdout: '', stderr } },
    successful: result => result.code === 0, controlQueryError, recoveryErrorEnvelope,
    recordVerification: (id, check) => { checks.set(check.name, structuredClone(check)); records.push({ kind: 'check', id, check }) },
    skipUnselectedVerificationChecks: (id, names) => records.push({ kind: 'skip', id, names: [...names] }),
    finalizeVerification: (task, id) => {
      records.push({ kind: 'finalize', task, id })
      if (crashAtFinalize) throw Error('synthetic crash before finalization')
      return { passed: false }
    },
    recordControlFailure: (task, stage, reason, metadata) => records.push({ kind: 'failure', task, stage, reason, metadata }),
    output: (payload, code) => outputs.push({ payload, code }),
  })
  invoke()
  assert.equal(JSON.stringify(history), before, 'run/execution/product history is unchanged')
  assert.equal(launches.length, 1)
  assert.equal(launches[0].args[0], '/fixture/pinned-release/tooling/control-plane/runner/task-verifier.mjs')
  assert.ok(!writes.some(({ sql }) => /\b(?:UPDATE|DELETE|INSERT)\b|start_execution|start_retry_execution/i.test(sql)))
  assert.equal(outputs.length, 1)
  return { records, writes, output: outputs[0] }
}

test('partial verification receipt conflict settles as infrastructure failure on the same execution', () => {
  const { records, writes, output } = resume()
  assert.deepEqual(records.map(row => row.kind), ['check', 'skip', 'finalize', 'failure'])
  assert.equal(records[0].id, 335)
  assert.equal(records[0].check.status, 'fail')
  assert.equal(records[0].check.required, true)
  assert.equal(records[0].check.failure_class, 'verification-infrastructure')
  assert.equal(records[2].task, taskId)
  assert.equal(records[2].id, 335)
  assert.ok(writes.some(({ sql, values }) => sql.includes('trusted_receipt') && values.verification_run_id === '335'))
  assert.equal(output.payload.ok, false)
  assert.equal(output.payload.execution_id, 313)
  assert.equal(output.payload.verification_run_id, 335)
  assert.equal(output.payload.classification.failure_class, 'verification-infrastructure')
  assert.equal(output.code, 1)
})

test('other SQL denials, fresh runs and unreviewed failed checks retain their original failure', () => {
  for (const options of [
    { sqlstate: '42501', message: 'permission denied' },
    { message: 'trusted_verifier_receipt_binding_mismatch' },
    { resumed: false },
    { eligible: false },
  ]) {
    const { records, output } = resume(options)
    assert.ok(!records.some(row => ['check', 'skip', 'finalize'].includes(row.kind)))
    assert.equal(output.payload.classification.failure_class, 'unknown-outcome')
    assert.equal(output.payload.sqlstate, options.sqlstate ?? 'P0001')
    assert.equal(output.code, 1)
  }
})

test('restart after the infrastructure marker preserves trusted history and reuses the marker', () => {
  const receipt = { name: 'dependencies', status: 'pass', trusted_receipt: { version: 2, artifact: { sha256: 'a'.repeat(64) } } }
  const checks = new Map([[receipt.name, receipt]])
  assert.throws(() => resume({ checks, crashAtFinalize: true }), /synthetic crash/)
  const marker = JSON.stringify(checks.get('verifier-resume-infrastructure'))
  const recovered = resume({ checks })
  assert.equal(recovered.output.payload.ok, false)
  assert.equal(recovered.output.payload.verification_run_id, 335)
  assert.equal(checks.size, 2)
  assert.equal(checks.get('dependencies'), receipt)
  assert.equal(JSON.stringify(checks.get('verifier-resume-infrastructure')), marker)
})


test('partial verification guard returns a JSON boolean through actual PostgreSQL',{skip:!process.env.CP_EGRESS_TEST_DATABASE},()=>{
 const database=process.env.CP_EGRESS_TEST_DATABASE;assert.match(database,/^cp_egress_/)
 const a=action.indexOf('SELECT to_jsonb(EXISTS ('),b=action.indexOf('`, { verification_run_id:',a)
 assert.ok(a>=0&&b>a)
 const sql=action.slice(a,b).replaceAll(":'verification_run_id'",'0')
 const r=spawnSync('docker',['exec','-i',process.env.CP_EGRESS_TEST_CONTAINER??'cp-remediation-disposable-20261007','psql','-U','postgres','-d',database,'-XqAt','-v','ON_ERROR_STOP=1'],{input:'BEGIN READ ONLY;'+sql+'COMMIT;',encoding:'utf8'})
 assert.equal(r.status,0,r.stderr);assert.equal(JSON.parse(r.stdout.trim()),false)
})
