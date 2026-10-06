import test from 'node:test'
import assert from 'node:assert/strict'
import { planSupervisorStep, classifySupervisorFailure, supervisorStateFingerprint } from '../runner/task-supervisor.mjs'
import { protectedPublicationPath, classifyPublicationFiles, evaluateVerificationAuthority } from '../runner/publication-preflight.mjs'
import { runWakeEligibility } from '../runner/selfhealing.mjs'

function fixture() {
  return {
    packet: { task: { task_id: 'CP-RETRY-PUBLICATION', status: 'failed', engine_stage: 'verification' }, retry_policy: { max_attempts: 3 } },
    workflow_run: { status: 'running', completed_tasks: 0, max_tasks: 9 },
    executions: [{ execution_id: 1, attempt: 1, status: 'succeeded' }],
    verification_runs: [{ verification_run_id: 10, execution_id: 1, status: 'failed' }],
    failures: [{ failure_id: 1, execution_id: 1, failure_class: 'verification-product-defect', resolved_at: null }],
  }
}

test('failed verification -> retry -> passed verification -> one ordinary publication -> completion', () => {
  const s = fixture()
  const commands = []
  let publications = 0
  for (let step = 0; step < 5; step++) {
    const plan = planSupervisorStep(s)
    if (plan.kind === 'terminal') break
    commands.push(plan.command)
    if (plan.command === 'task-retry') {
      s.executions.push({ execution_id: 2, attempt: 2, status: 'succeeded' })
      s.packet.task.status = 'verification'
    } else if (plan.command === 'task-verify') {
      s.verification_runs.push({ verification_run_id: 11, execution_id: 2, status: 'passed', state_fingerprint: 'verified-content' })
      s.packet.task.status = 'passed'
      s.packet.task.engine_stage = 'publication'
    } else if (plan.command === 'task-publish') {
      publications++
      assert.equal(plan.execution.execution_id, 2)
      assert.equal(plan.verification.verification_run_id, 11)
      const file = 'apps/automation-suit/app/pages/n8n.vue'
      assert.equal(protectedPublicationPath(file), false, 'ordinary Vue page must reach publisher reconciliation')
      assert.deepEqual(classifyPublicationFiles({ files: [file], workstreamPaths: ['apps/automation-suit/'] }).blocked, [])
      assert.equal(evaluateVerificationAuthority({ verification: plan.verification, executionId: 2, stateFingerprint: 'verified-content' }).authoritative, true)
      s.publications = [{ pull_request_id: 1, execution_id: 2, state: 'open', is_draft: true }]
      s.packet.task.status = 'complete'
      s.packet.task.engine_stage = 'complete'
    } else assert.fail(`unexpected lifecycle command: ${plan.command}`)
  }
  assert.deepEqual(commands, ['task-retry', 'task-verify', 'task-publish'])
  assert.equal(publications, 1)
  assert.equal(s.packet.task.status, 'complete')
  assert.equal(s.executions.length, 2)
  assert.equal(s.verification_runs[0].status, 'failed', 'history is retained')
  assert.equal(planSupervisorStep(s).kind, 'terminal')
})

test('publisher nested operator gate remains a visible recoverable wait, never terminal or product retry', () => {
  const plan = classifySupervisorFailure({ command: 'task-publish', payload: { ok: false, publication: { error: 'publication_protected_path_operator_wait', classification: { failure_class: 'operator-wait', recovery_action: 'wait-operator' } } }, attempt: 2, maxAttempts: 3 })
  assert.equal(plan.kind, 'wait')
  assert.equal(plan.next_action, 'wait-operator')
  assert.equal(plan.recoverable, true)
  assert.equal(plan.command, undefined)
  const safety = classifySupervisorFailure({ command: 'task-publish', payload: { classification: { failure_class: 'safety-stop' }, publication: { classification: { failure_class: 'operator-wait' } } } })
  assert.equal(safety.kind, 'terminal', 'top-level safety classification wins')
})

function legacyStop() {
  const s = fixture()
  s.packet.task.status = 'passed'
  s.packet.task.engine_stage = 'publication'
  s.verification_runs[0].status = 'passed'
  s.failures = [{ failure_id: 2, execution_id: 1, stage: 'publication', error_code: 'publication_protected_path_operator_wait', failure_class: 'operator-wait', recovery_action: 'wait-operator', resolved_at: null, metadata: { classification: { failure_class: 'operator-wait', recovery_action: 'wait-operator' } } }]
  s.recovery = { status: 'resolved', next_action: 'safety-stop', failure_class: 'safety-stop', failure_id: 2, execution_id: 1, error_code: 'publication_protected_path_operator_wait', metadata: { child_command: 'task-publish' }, condition: { fingerprint: supervisorStateFingerprint(s) } }
  return s
}

test('legacy publisher misclassification wakes and reruns real publication gates with the same passing execution', () => {
  const s = legacyStop()
  assert.equal(runWakeEligibility(s.workflow_run, s.recovery, null, Date.now(), s).eligible, true)
  assert.equal(planSupervisorStep(s).command, 'task-publish')
  assert.equal(s.recovery.status, 'resolved', 'planning cannot rewrite historical evidence')
})

test('legacy recovery cannot override genuine safety stops, untyped evidence, stale executions, or failed verification', () => {
  for (const change of [s => { s.failures[0].failure_class = 'safety-stop' }, s => { delete s.failures[0].metadata.classification }, s => { s.failures[0].execution_id = 99 }, s => { s.verification_runs[0].status = 'failed' }, s => { s.recovery.failure_id = 99 }]) {
    const s = legacyStop()
    change(s)
    s.recovery.condition.fingerprint = supervisorStateFingerprint(s)
    assert.equal(planSupervisorStep(s).kind, 'terminal')
    assert.equal(runWakeEligibility(s.workflow_run, s.recovery, null, Date.now(), s).eligible, false)
  }
})

test('Vue exception does not authorize workflows, configuration, secrets, or deployment changes', () => {
  for (const file of ['tooling/n8n/workflow.json', 'apps/automation-suit/n8n/workflows/test.json', 'apps/automation-suit/app/pages/n8n.json', 'apps/automation-suit/app/pages/n8n/config.vue', 'apps/automation-suit/app/pages/n8n-secret/n8n.vue', 'apps/automation-suit/app/pages/deploy.vue', 'apps/automation-suit/app/pages/.env.vue', 'apps/automation-suit/supabase/migrations/n8n.sql', '.github/workflows/n8n.yml']) assert.equal(protectedPublicationPath(file), true, file)
  assert.equal(protectedPublicationPath('apps/automation-suit/app/pages/n8n.vue'), false)
  assert.equal(protectedPublicationPath('apps/automation-suit/app/components/n8n-status.vue'), false)
})
