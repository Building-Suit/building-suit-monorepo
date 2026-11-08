import test from 'node:test'
import assert from 'node:assert/strict'
import { bindStaffingPlan, canonicalStaffingPublisher, staffingNextAction } from './departmentWorkflow.mjs'

const digest = 'a'.repeat(64)
function fixture() {
  const proposal = { agentId: 'AG-DEV-099', name: 'Synthetic worker', managerId: 'AG-DEV-001',
    profileDraft: '# Synthetic bounded drafting worker\nNo external actions.',
    skills: [{ fileId: 'synthetic_skill_a', sourceVersion: '7' }, { fileId: 'synthetic_skill_b', sourceVersion: '2' }],
    trialCriteria: 'Use synthetic input. Head and independent reviewer check the same immutable artifact.', resumeOriginal: true }
  const facts = { needId: 'synthetic-need', departmentKey: 'development-maintenance', approvedDepartments: ['development-maintenance'], existingAgentIds: ['AG-DEV-001'],
    manager: { id: 'AG-DEV-001', modelTier: 'T2_HEAD', departmentKey: 'development-maintenance', enabled: true, bindingDigest: digest },
    reviewer: { id: 'AG-HR-003', enabled: true, authorized: true, bindingDigest: digest },
    modelPolicy: { model: 'gpt-6.1-terra', effort: 'medium', sourceVersion: '11' },
    original: { id: 'synthetic-source-task', scopeDigest: digest, status: 'blocked' },
    skills: proposal.skills.map(skill => ({ ...skill, departmentKey: 'development-maintenance', inScope: true, trashed: false, assignedToExistingT1: true })) }
  const bound = bindStaffingPlan(proposal, facts)
  const approved = { ...bound, decision: 'approved', resumeOriginal: true }
  const observed = { originalTaskId: facts.original.id, originalStatus: 'blocked', originalError: 'staffing-required', originalWorkingJobs: 0, scopeDigest: digest,
    managerBinding: digest, reviewerBinding: digest, modelPolicyVersion: '11', skills: bound.plan.skills }
  return { proposal, facts, approved, observed }
}

test('immutable plan binds exact current skill revisions, model policy, roles and continuation scope', () => {
  const { proposal, facts, approved } = fixture()
  assert.equal(approved.plan.modelTier, 'T1_WORKER')
  assert.equal(approved.plan.externalActionsAllowed, false)
  assert.equal(approved.plan.toolsMayChange, false)
  assert.deepEqual(bindStaffingPlan({ ...proposal, skills: [...proposal.skills].reverse() }, facts), { plan: approved.plan, canonicalPlan: approved.canonicalPlan, digest: approved.digest })
  for (const mutation of [p => { p.profileDraft += '\nChanged' }, p => { p.resumeOriginal = false }, p => { p.trialCriteria += ' Changed' }]) {
    const changed = structuredClone(proposal); mutation(changed)
    assert.notEqual(bindStaffingPlan(changed, facts).digest, approved.digest)
  }
})

test('plans reject extra permissions, existing identities, stale/cross-department skills and invented reviewers', () => {
  const mutations = [
    (p) => { p.tools = ['shell'] }, (p) => { p.agentId = 'AG-DEV-001' },
    (p) => { p.skills[0].sourceVersion = '6' }, (p) => { p.skills.push(p.skills[0]) },
    (_p, f) => { f.skills[0].departmentKey = 'other' },
    (_p, f) => { f.reviewer.id = 'AG-DEV-099' }, (_p, f) => { f.reviewer.id = f.manager.id },
    (_p, f) => { f.reviewer.authorized = false }, (_p, f) => { f.manager.enabled = false },
    (_p, f) => { f.modelPolicy.model = 'gpt-other' }, (_p, f) => { f.original.status = 'canceled' },
  ]
  for (const mutate of mutations) {
    const { proposal, facts } = fixture(); mutate(proposal, facts)
    assert.throws(() => bindStaffingPlan(proposal, facts), /staffing-/)
  }
})

test('installed publisher has no write capability and cannot be unlocked with caller settings', async () => {
  const publisher = canonicalStaffingPublisher({ credential: 'synthetic', writer: true })
  assert.equal(publisher.capability, 'unavailable')
  for (const method of ['publishPending','reconcile','activateRegistryOnly']) {
    assert.deepEqual(await publisher[method](), { status: 'blocked', code: 'canonical-writer-setup-required' })
  }
  assert.equal(Object.isFrozen(publisher), true)
})

test('approval and original-task scope fail closed before any publisher operation', () => {
  const { approved, observed } = fixture()
  assert.equal(staffingNextAction(approved, observed).code, 'canonical-writer-setup-required')
  assert.equal(staffingNextAction({ ...approved, decision: 'rejected' }, observed).code, 'staffing-approval-required')
  const changed = structuredClone(approved); changed.plan.resumeOriginal = false
  assert.equal(staffingNextAction(changed, observed).code, 'staffing-approval-required')
  for (const originalStatus of ['canceled','completed']) assert.equal(staffingNextAction(approved, { ...observed, originalStatus }).code, 'staffing-source-task-unavailable')
  assert.equal(staffingNextAction(approved, { ...observed, scopeDigest: 'b'.repeat(64) }).code, 'staffing-source-task-unavailable')
  assert.equal(staffingNextAction(approved, { ...observed, reviewerBinding: 'b'.repeat(64) }).code, 'staffing-binding-stale')
})

test('partial or uncertain publication requires the original operation readback, never a second publication', () => {
  const { approved, observed } = fixture()
  for (const status of ['partial','uncertain']) {
    assert.deepEqual(staffingNextAction(approved, { ...observed, publication: { status, operationId: 'synthetic-operation' } }),
      { action: 'reconcile-publication', operationId: 'synthetic-operation', digest: approved.digest })
    assert.equal(staffingNextAction(approved, { ...observed, publication: { status } }).code, 'staffing-publication-uncertain')
  }
})

test('every assigned skill needs real current host and independent same-artifact proof before activation', () => {
  const { approved, observed } = fixture()
  Object.assign(observed, { writerCapability: 'owner-backed-canonical-staff-v1', mediaCasVerified: true, mediaCasProbeReceiptDigest: digest,
    canonicalSlot: { approved: true, departmentKey: 'development-maintenance', fileId: 'synthetic_profile', agentId: null },
    publication: { status: 'verified', planDigest: approved.digest, profileFileId: 'synthetic_profile', profileSourceVersion: '3' },
    profileFileId: 'synthetic_profile', profileSourceVersion: '3', bindingDigest: digest, lifecycle: 'configured trial pending' })
  assert.equal(staffingNextAction(approved, observed).action, 'start-trial')
  const trial = { id: 'synthetic-trial-a', skillFileId: 'synthetic_skill_a', bindingDigest: digest, status: 'passed',
    hostAttested: true, sameArtifactReviewed: true, reviewerId: 'AG-HR-003', headId: 'AG-DEV-001' }
  observed.trials = [trial]
  assert.equal(staffingNextAction(approved, observed).action, 'record-qualification')
  trial.receiptId = 'synthetic-receipt-a'
  assert.deepEqual(staffingNextAction(approved, observed), { action: 'start-trial', skillFileId: 'synthetic_skill_b', digest: approved.digest })
  observed.trials.push({ ...trial }) // A duplicate cannot cover the other skill.
  assert.equal(staffingNextAction(approved, observed).skillFileId, 'synthetic_skill_b')
  observed.trials.push({ ...trial, id: 'synthetic-trial-b', skillFileId: 'synthetic_skill_b', receiptId: 'synthetic-receipt-b' })
  assert.equal(staffingNextAction(approved, observed).action, 'activate-registry-only')
  for (const field of ['hostAttested','sameArtifactReviewed']) {
    trial[field] = false
    assert.equal(staffingNextAction(approved, observed).code, 'staffing-trial-proof-required'); trial[field] = true
  }
  trial.status = 'failed'; assert.equal(staffingNextAction(approved, observed).code, 'staffing-trial-failed')
  trial.status = 'passed'; observed.profileSourceVersion = '4'
  assert.equal(staffingNextAction(approved, observed).code, 'staffing-binding-stale')
  observed.profileSourceVersion = '3'; observed.lifecycle = 'Active'
  assert.equal(staffingNextAction(approved, observed).code, 'staffing-qualification-required')
  observed.qualified = true
  assert.equal(staffingNextAction(approved, observed).action, 'create-linked-continuation')
  observed.continuation = { taskId: 'synthetic-child', sourceTaskId: observed.originalTaskId, scopeDigest: digest, planDigest: approved.digest }
  assert.equal(staffingNextAction(approved, observed).taskId, 'synthetic-child')
  observed.continuation.taskId = observed.originalTaskId
  assert.equal(staffingNextAction(approved, observed).code, 'staffing-lineage-invalid')
})
