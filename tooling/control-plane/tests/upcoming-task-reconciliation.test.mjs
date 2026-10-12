import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { applyReviewedChanges, assertAcyclic, buildReconciliation, fingerprint, firstN } from '../lib/upcoming-task-reconciliation.mjs'
const read = name => JSON.parse(readFileSync(new URL(`../../../docs/shared/upcoming-task-readiness.${name}.json`, import.meta.url)))
const snapshot = read('snapshot'), config = read('configuration')
const proposal = buildReconciliation(snapshot, config)

test('24 exact unstarted tasks retain identity, lifecycle, decisions, retry budgets, acceptance and history', () => {
  const after = applyReviewedChanges(snapshot.tasks, proposal.changes)
  assert.equal(proposal.changes.length, 24)
  for (const [i, task] of after.entries()) {
    for (const key of ['task_id', 'status', 'retry_policy_id', 'model_profile', 'acceptance_criteria', 'created_at', 'updated_at', 'engine_stage']) assert.deepEqual(task[key], snapshot.tasks[i][key])
    for (const key of ['blocking_decision_ids', 'task_dependencies', 'source_record', 'publication_requirement_evidence']) assert.deepEqual(task.metadata[key], snapshot.tasks[i].metadata[key])
  }
  assert.deepEqual(applyReviewedChanges(after, proposal.changes), after)
  assert.deepEqual(proposal.dependencies, snapshot.dependencies)
  assert.equal(read('audit').extra_tasks.find(t => t.task_id === 'SS-WEB-CHANGELOG-001').status, 'cancelled')
})

test('concurrent change, consumed attempt, completion, absent task and protected-field edits fail closed', () => {
  const changed = structuredClone(snapshot.tasks); changed[0].metadata.concurrent = true
  assert.throws(() => applyReviewedChanges(changed, proposal.changes), /concurrent_task_change/)
  assert.throws(() => applyReviewedChanges(snapshot.tasks, proposal.changes, [{ task_id: snapshot.tasks[0].task_id }]), /still_unstarted/)
  const complete = structuredClone(snapshot.tasks); complete[0].status = 'complete'
  assert.throws(() => applyReviewedChanges(complete, proposal.changes), /still_unstarted/)
  assert.throws(() => applyReviewedChanges(snapshot.tasks.slice(1), proposal.changes), /task_missing/)
  const bad = structuredClone(proposal.changes); bad[0].patch.retry_policy_id = 'wider'
  assert.throws(() => applyReviewedChanges(snapshot.tasks, bad), /protected_field_change/)
  const tampered = structuredClone(proposal.changes); tampered[0].patch.metadata.allowed_paths = ['apps/**']
  assert.throws(() => applyReviewedChanges(snapshot.tasks, tampered), /reviewed_patch_fingerprint_mismatch/)
})

test('selection uses unfinished first N, never substitutes arbitrary ready tasks', () => {
  assert.equal(firstN(snapshot.tasks, 'shared', 1)[0].task_id, 'BS-SA-FUTURE-SUIT-M4-VALIDATION-001')
  assert.equal(firstN(snapshot.tasks, 'shop-suit', 1)[0].task_id, 'SHOP-CAS-M1-INT-001')
  const after = applyReviewedChanges(snapshot.tasks, proposal.changes)
  assert.deepEqual(firstN(after, 'shared', 5).map(t => t.task_id), [1, 2, 3, 4, 5].map(i => `BS-UI-PRO-00${i}`))
  assert.equal(firstN(after, 'shared', 6)[5].task_id, 'BS-UI-PRO-010')
  assert.equal(firstN(after, 'shop-suit', 1)[0].task_id, 'SS-OFFLINE-001')
  assert.equal(firstN(after, 'shop-suit', 2)[1].task_id, 'SS-SET-001')
  assert.ok(firstN(after, 'shop-suit', 17).findIndex(t => t.task_id === 'SS-SET-001') < firstN(after, 'shop-suit', 17).findIndex(t => t.task_id === 'SS-EGY-ETA-001'))
  assert.throws(() => firstN(after, 'shared', 21), /bounded_count/)
})

test('hard dependency graph and UI/web order remain acyclic and intact', () => {
  assert.doesNotThrow(() => assertAcyclic(proposal.dependencies))
  const edge = (child, parent) => assert.ok(proposal.dependencies.some(d => d.task_id === child && d.depends_on_task_id === parent && d.dependency_type === 'hard'))
  edge('BS-SA-FUTURE-SUIT-M4-VALIDATION-001', 'SAS-M4-EVENTS-001')
  edge('SHOP-CAS-M1-INT-001', 'CAS-M1-INT-001')
  edge('SS-EGY-ETA-001', 'SS-SET-001')
  edge('BS-UI-PRO-006', 'BS-UI-PRO-005'); edge('BS-UI-PRO-008', 'BS-UI-PRO-007'); edge('BS-UI-PRO-010', 'BS-UI-PRO-009')
  edge('SS-WEB-LAUNCH-001', 'BS-CHANGELOG-VERSION-001')
  assert.throws(() => assertAcyclic([{ task_id: 'a', depends_on_task_id: 'b', dependency_type: 'hard' }, { task_id: 'b', depends_on_task_id: 'a', dependency_type: 'hard' }]), /dependency_cycle/)
})

test('all verification obligations resolve structurally without claiming execution or evidence PASS', () => {
  assert.equal(proposal.plans.ready, true, JSON.stringify(proposal.plans.gates))
  for (const plan of proposal.plans.plans) {
    assert.equal(plan.obligations.length, proposal.changes.find(c => c.task_id === plan.task_id).patch.verification_plan.length)
    for (const o of plan.obligations) {
      assert.ok(['EXISTING_EXECUTABLE', 'TASK_OWNED_OUTPUT', 'EXTERNAL_EVIDENCE'].includes(o.category))
      if (o.category === 'TASK_OWNED_OUTPUT') { assert.ok(o.expected_outputs.length); assert.ok(o.checks.length) }
      if (o.category === 'EXTERNAL_EVIDENCE') assert.ok(o.external_gate)
    }
  }
  assert.equal(proposal.status, 'PROPOSAL_NOT_APPLIED')
})

test('scope proposals grant no authority, evidence-only gate stays docs-only and live registry is preserved', () => {
  const after = applyReviewedChanges(snapshot.tasks, proposal.changes)
  const final = after.find(t => t.task_id === 'BS-UI-PRO-010')
  assert.deepEqual(final.metadata.allowed_paths, ['apps/building-suit-docs/', 'docs/shared/'])
  const cas = after.find(t => t.task_id === 'SHOP-CAS-M1-INT-001')
  assert.ok(cas.metadata.source_allowed_paths.includes('apps/shop-suit/**'))
  assert.deepEqual(cas.metadata.publication_resolved_scopes, snapshot.tasks.find(t => t.task_id === cas.task_id).metadata.publication_resolved_scopes)
  for (const w of config.workstreams) {
    const updated = proposal.workstreams.find(p => p.slug === w.slug)
    assert.equal(updated.before_fingerprint, fingerprint(w))
    for (const command of w.verification_config.commands) assert.deepEqual(updated.verification_config.commands.find(c => c.name === command.name), command)
    assert.deepEqual(updated.verification_config.legacy_plan_mappings, w.verification_config.legacy_plan_mappings)
  }
  const all = proposal.workstreams[0].verification_config.commands.find(c => c.name === 'readiness-all-consumer-quality')
  assert.deepEqual(all.args, ['exec', 'turbo', 'run', 'typecheck', 'lint', 'build'])
})
