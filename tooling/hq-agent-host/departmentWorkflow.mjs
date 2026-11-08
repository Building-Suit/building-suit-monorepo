import { managerForAgent, modelTierForAgent, pilotDepartments, T1_WORKER_MODEL } from './workforceRoster.mjs'
import { createHash } from 'node:crypto'

const staffingProblem = code => { const error = new Error(code); error.code = code; throw error }
const staffingDigest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex')
const staffingText = (value, max) => typeof value === 'string' && value.trim().length > 0
  && Buffer.byteLength(value) <= max && !Array.from(value).some(character => {
    const code = character.charCodeAt(0)
    return code <= 8 || code === 11 || code === 12 || code >= 14 && code <= 31
  })
const exactStaffingKeys = (value, keys) => value && typeof value === 'object' && !Array.isArray(value)
  && Object.keys(value).sort().join('|') === [...keys].sort().join('|')
const staffingHeads = ['AG-DEV-001','AG-RES-001','AG-SALES-001','AG-CS-001','AG-SOC-001','AG-EMAIL-001']

/** A proposal is data, never authority. Only current, server-authored facts may
 * be supplied as the second argument. Semantic version labels are not revisions. */
export function bindStaffingPlan(proposal, facts) {
  if (!exactStaffingKeys(proposal, ['agentId','name','managerId','profileDraft','skills','trialCriteria','resumeOriginal'])
    || !/^AG-[A-Z]+-[0-9]{3}$/.test(proposal.agentId || '') || !staffingText(proposal.name, 160)
    || !staffingText(proposal.profileDraft, 16000) || !staffingText(proposal.trialCriteria, 4000)
    || typeof proposal.resumeOriginal !== 'boolean' || !Array.isArray(proposal.skills)
    || proposal.skills.length < 1 || proposal.skills.length > 10
    || proposal.agentId.startsWith('AG-HR-') || proposal.agentId.startsWith('AG-CEO-')
    || !facts || !Array.isArray(facts.existingAgentIds) || facts.existingAgentIds.includes(proposal.agentId)) staffingProblem('staffing-plan-invalid')
  const manager = facts.manager, reviewer = facts.reviewer
  if (!manager || !staffingHeads.includes(manager.id) || manager.id !== proposal.managerId || manager.modelTier !== 'T2_HEAD' || !manager.enabled
    || proposal.agentId.split('-')[1] !== manager.id.split('-')[1]
    || !Array.isArray(facts.approvedDepartments) || !facts.approvedDepartments.includes(manager.departmentKey)
    || manager.departmentKey !== facts.departmentKey || !manager.bindingDigest
    || !reviewer || reviewer.id !== 'AG-HR-003' || reviewer.id === manager.id || reviewer.id === proposal.agentId
    || !reviewer.enabled || !reviewer.authorized || !reviewer.bindingDigest) staffingProblem('staffing-reviewer-unavailable')
  if (!facts.modelPolicy || facts.modelPolicy.model !== T1_WORKER_MODEL
    || !['minimal','low','medium','high','xhigh'].includes(facts.modelPolicy.effort)
    || !facts.modelPolicy.sourceVersion) staffingProblem('staffing-model-policy-unavailable')
  const skills = proposal.skills.map(skill => {
    if (!exactStaffingKeys(skill, ['fileId','sourceVersion'])) staffingProblem('staffing-skill-invalid')
    const canonical = facts.skills.find(entry => entry.fileId === skill.fileId)
    if (!canonical || canonical.departmentKey !== manager.departmentKey || canonical.sourceVersion !== skill.sourceVersion
      || !canonical.inScope || canonical.trashed || !canonical.assignedToExistingT1
      || !/^[A-Za-z0-9_-]{8,200}$/.test(skill.fileId) || !/^[0-9]{1,40}$/.test(skill.sourceVersion)) staffingProblem('staffing-skill-stale')
    return { fileId: skill.fileId, sourceVersion: skill.sourceVersion }
  }).sort((a, b) => a.fileId.localeCompare(b.fileId))
  if (new Set(skills.map(skill => skill.fileId)).size !== skills.length) staffingProblem('staffing-skill-invalid')
  if (!facts.original || !/^[0-9a-f]{64}$/.test(facts.original.scopeDigest || '')
    || ['canceled','completed'].includes(facts.original.status)) staffingProblem('staffing-source-task-unavailable')
  const plan = { version: 1, needId: facts.needId, originalTaskId: facts.original.id, scopeDigest: facts.original.scopeDigest,
    agentId: proposal.agentId, name: proposal.name, departmentKey: manager.departmentKey, managerId: manager.id,
    managerBinding: manager.bindingDigest, reviewerId: reviewer.id, reviewerBinding: reviewer.bindingDigest,
    profileDraft: proposal.profileDraft, skills, modelTier: 'T1_WORKER', modelPolicy: { ...facts.modelPolicy },
    trialCriteria: proposal.trialCriteria, trialScope: 'synthetic-internal-trial-v1', qualificationScope: 'bounded-drafting-v1',
    resumeOriginal: proposal.resumeOriginal, externalActionsAllowed: false, toolsMayChange: false }
  return { plan, canonicalPlan: JSON.stringify(plan), digest: staffingDigest(plan) }
}

/** The installed Reader and learning-journal Writer are deliberately insufficient.
 * No environment switch, credential fallback or learning-publisher escape hatch. */
export function canonicalStaffingPublisher() {
  return Object.freeze({ capability: 'unavailable',
    async publishPending() { return { status: 'blocked', code: 'canonical-writer-setup-required' } },
    async reconcile() { return { status: 'blocked', code: 'canonical-writer-setup-required' } },
    async activateRegistryOnly() { return { status: 'blocked', code: 'canonical-writer-setup-required' } } })
}

/** Choose only the next authorized action from durable, server-validated
 * observations. This does not write files, issue receipts, or manufacture health. */
export function staffingNextAction(approved, observed) {
  const blocked = code => ({ action: 'blocked', code })
  let parsed
  try { parsed = JSON.parse(approved?.canonicalPlan) } catch { return blocked('staffing-approval-required') }
  if (!approved || approved.decision !== 'approved' || !approved.plan || typeof approved.canonicalPlan !== 'string'
    || Buffer.byteLength(approved.canonicalPlan) > 65536 || !parsed || typeof parsed !== 'object' || Array.isArray(parsed)
    || approved.digest !== createHash('sha256').update(approved.canonicalPlan).digest('hex')
    || JSON.stringify(parsed) !== JSON.stringify(approved.plan)
    || typeof approved.resumeOriginal !== 'boolean' || approved.resumeOriginal && !approved.plan.resumeOriginal) return blocked('staffing-approval-required')
  const p = approved.plan
  if (!observed || observed.originalTaskId !== p.originalTaskId || observed.scopeDigest !== p.scopeDigest
    || observed.originalStatus !== 'blocked' || observed.originalError !== 'staffing-required'
    || observed.originalWorkingJobs !== 0) return blocked('staffing-source-task-unavailable')
  if (observed.managerBinding !== p.managerBinding || observed.reviewerBinding !== p.reviewerBinding
    || observed.modelPolicyVersion !== p.modelPolicy.sourceVersion
    || !Array.isArray(observed.skills) || JSON.stringify(observed.skills) !== JSON.stringify(p.skills)) return blocked('staffing-binding-stale')
  // An uncertain write always requires readback against its original operation;
  // never generate a second file or clear the uncertainty to try again.
  if (observed.publication?.status === 'uncertain' || observed.publication?.status === 'partial') {
    return observed.publication.operationId ? { action: 'reconcile-publication', operationId: observed.publication.operationId, digest: approved.digest }
      : blocked('staffing-publication-uncertain')
  }
  if (observed.writerCapability !== 'owner-backed-canonical-staff-v1') return blocked('canonical-writer-setup-required')
  if (observed.mediaCasVerified !== true || !/^[0-9a-f]{64}$/.test(observed.mediaCasProbeReceiptDigest || '')) return blocked('canonical-media-cas-unverified')
  if (!observed.canonicalSlot || observed.canonicalSlot.approved !== true
    || observed.canonicalSlot.departmentKey !== p.departmentKey || !/^[A-Za-z0-9_-]{8,200}$/.test(observed.canonicalSlot.fileId || '')
    || !(observed.canonicalSlot.agentId === null || observed.canonicalSlot.agentId === p.agentId)) return blocked('canonical-slot-unavailable')
  if (!observed.publication) return { action: 'publish-pending', digest: approved.digest }
  if (observed.publication.status !== 'verified' || observed.publication.planDigest !== approved.digest
    || !observed.publication.profileSourceVersion || !observed.publication.profileFileId) return blocked('staffing-publication-unverified')
  if (observed.profileSourceVersion !== observed.publication.profileSourceVersion
    || observed.profileFileId !== observed.publication.profileFileId || !observed.bindingDigest) return blocked('staffing-binding-stale')
  for (const skill of p.skills) {
    const trial = (observed.trials || []).find(entry => entry.skillFileId === skill.fileId && entry.bindingDigest === observed.bindingDigest)
    if (!trial) return { action: 'start-trial', skillFileId: skill.fileId, digest: approved.digest }
    if (['failed','canceled'].includes(trial.status)) return blocked('staffing-trial-failed')
    if (trial.status !== 'passed') return { action: 'await-trial', skillFileId: skill.fileId }
    if (!trial.hostAttested || !trial.sameArtifactReviewed || trial.reviewerId !== p.reviewerId
      || trial.headId !== p.managerId || trial.reviewerId === p.agentId || trial.reviewerId === trial.headId) return blocked('staffing-trial-proof-required')
    if (!trial.receiptId) return { action: 'record-qualification', trialId: trial.id, digest: approved.digest }
  }
  if (observed.lifecycle !== 'Active') return { action: 'activate-registry-only', profileSourceVersion: observed.profileSourceVersion, digest: approved.digest }
  if (!observed.qualified) return blocked('staffing-qualification-required')
  if (!approved.resumeOriginal) return { action: 'complete', resumed: false }
  if (observed.continuation) {
    if (observed.continuation.sourceTaskId !== p.originalTaskId || observed.continuation.scopeDigest !== p.scopeDigest
      || observed.continuation.planDigest !== approved.digest || observed.continuation.taskId === p.originalTaskId) return blocked('staffing-lineage-invalid')
    return { action: 'complete', resumed: true, taskId: observed.continuation.taskId }
  }
  return { action: 'create-linked-continuation', sourceTaskId: p.originalTaskId, scopeDigest: p.scopeDigest, digest: approved.digest }
}

const blockedLifecycle = /\b(?:configured|candidate|trial|pending|suspended|inactive|retired|terminated|archived|paused)\b/i
const unavailableHeadLifecycle = /\b(?:suspended|inactive|retired|terminated|archived|paused)\b/i
const hasCurrentQualification = (agent, qualification) => {
  if (!qualification || qualification.status !== 'qualified' || qualification.scope !== 'bounded-drafting-v1'
    || !/^[0-9a-f]{64}$/.test(qualification.bindingDigest || '') || typeof qualification.evidenceId !== 'string'
    || !/^[A-Za-z0-9_-]{8,200}$/.test(qualification.evidenceId)
    || !qualification.evidenceId.trim() || qualification.profileFileId !== agent.profileFileId
    || qualification.modelTier !== agent.modelTier || qualification.managerId !== agent.managerId
    || qualification.departmentKey !== agent.departmentKey
    || !Array.isArray(qualification.skillFileIds) || !qualification.skillFileIds.length) return false
  const assigned = [...new Set(agent.skillFileIds || [])].sort()
  const qualified = [...new Set(qualification.skillFileIds)].sort()
  return assigned.length > 0 && JSON.stringify(assigned) === JSON.stringify(qualified)
}

const supervisedTrialAllowed = (job, agent) => {
  const trial = job.context?.supervisedTrial
  const expiresAt = Date.parse(trial?.expiresAt || '')
  return trial?.scope === 'synthetic-internal-trial-v1' && trial.status === 'active'
    && trial.externalActionsAllowed === false && trial.publishingAllowed === false
    && trial.agentId === job.agent_id && trial.agentId === agent?.id
    && trial.taskId === job.context?.task?.id && trial.managerId === agent?.managerId
    && trial.skillFileId && (agent?.skillFileIds || []).includes(trial.skillFileId)
    && /^[0-9a-f]{64}$/.test(trial.bindingDigest || '') && Number.isFinite(expiresAt) && expiresAt > Date.now()
}

/**
 * A model tier is only a configuration label. A worker is eligible only with a
 * current HR qualification receipt bound to that worker's exact profile and
 * skill assignment, and a direct reporting line to the department head.
 */
export function assessDepartmentCapacity(departmentKey, roster, qualifications = {}) {
  if (typeof departmentKey !== 'string' || !departmentKey || !Array.isArray(roster)) return { status: 'blocked', reason: 'department-contract-invalid' }
  const byId = new Map(roster.filter(agent => agent && typeof agent.id === 'string').map(agent => [agent.id, agent]))
  const configuredHeadId = pilotDepartments[departmentKey]
  const tier = agent => agent?.modelTier || modelTierForAgent(agent?.id)
  const departmentHeads = roster.filter(agent => agent?.departmentKey === departmentKey && tier(agent) === 'T2_HEAD')
  const headId = configuredHeadId || (departmentHeads.length === 1 ? departmentHeads[0].id : null)
  const head = byId.get(headId)
  if (!head || tier(head) !== 'T2_HEAD' || head.departmentKey !== departmentKey
    || unavailableHeadLifecycle.test(head.lifecycle || '') || !head.profileFileId) {
    return { status: 'blocked', reason: 'department-head-evidence-required', departmentKey }
  }
  const eligibleReports = roster.filter(agent => agent && tier(agent) === 'T1_WORKER'
    && agent.managerId === headId && agent.departmentKey === departmentKey
    && !blockedLifecycle.test(agent.lifecycle || '') && agent.profileFileId
    && hasCurrentQualification(agent, qualifications[agent.id]))
  const workers = eligibleReports.filter(agent => agent.model === T1_WORKER_MODEL)
  if (workers.length === 0) {
    if (eligibleReports.length > 0) return { status: 'blocked', reason: 'worker-model-policy-unavailable', departmentKey, headId }
    return {
      status: 'staffing-required', reason: 'no-qualified-lower-tier-worker',
      departmentKey, headId, hrOwnerId: 'AG-HR-001',
    }
  }
  return { status: 'ready', departmentKey, headId, workerIds: workers.map(agent => agent.id).sort() }
}

/** Reject worker execution unless the durable job's author is an eligible T1 report. */
export function workerExecutionBlock(job) {
  if (!job || !['task-ack', 'task-work', 'task-start', 'worker-trial', 'trial-start'].includes(job.context?.mode)) return null
  const agent = job.context?.agent
  const tier = agent?.modelTier ?? modelTierForAgent(job.agent_id)
  if (job.context.mode === 'task-ack') return tier === 'T2_HEAD' ? null : 'staffing-required'
  if (tier === 'T1_WORKER' && agent?.model !== T1_WORKER_MODEL) return 'worker-model-policy-unavailable'
  if (['worker-trial','trial-start'].includes(job.context.mode)) {
    if (tier !== 'T1_WORKER' || !agent || agent.id !== job.agent_id || !agent.profileFileId
      || agent.managerModelTier !== 'T2_HEAD' || agent.headAuthorization !== true
      || !supervisedTrialAllowed(job, agent)) return 'trial-authorization-required'
    return null
  }
  if (tier !== 'T1_WORKER') return 'staffing-required'
  if (!agent || agent.id !== job.agent_id || agent.lifecycle === undefined
    || blockedLifecycle.test(agent.lifecycle) || !agent.profileFileId
    || !(agent.managerId || managerForAgent(job.agent_id))
    || (agent.managerModelTier ?? modelTierForAgent(agent.managerId || managerForAgent(job.agent_id))) !== 'T2_HEAD'
    || agent.headAuthorization !== true || !hasCurrentQualification(agent, agent.qualification)) return 'staffing-required'
  return null
}
