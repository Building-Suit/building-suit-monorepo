import { managerForAgent, modelTierForAgent, pilotDepartments, T1_WORKER_MODEL } from './workforceRoster.mjs'

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
