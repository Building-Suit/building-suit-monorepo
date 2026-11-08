import { managerForAgent, modelTierForAgent, pilotDepartments, T1_WORKER_MODEL } from './workforceRoster.mjs'
import { createHash } from 'node:crypto'
import { request as httpsRequest } from 'node:https'
import { lookup as dnsLookup } from 'node:dns/promises'
import { isIP } from 'node:net'
import { isAbsolute, resolve, basename, dirname } from 'node:path'
import { open, lstat } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'

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

export const supervisedTrialAllowed = (job, agent) => {
  const trial = job.context?.supervisedTrial
  const expiresAt = Date.parse(trial?.expiresAt || '')
  return (trial?.scope === 'synthetic-internal-trial-v1'
    || trial?.scope === 'evaluator-skill-trial-v1' && job.agent_id === 'AG-HR-003' && agent?.managerId === 'AG-HR-001'
      && trial.reviewerId === 'AG-CEO-001' && /^[a-f0-9]{64}$/.test(trial.reviewerBindingDigest || '')) && trial.status === 'active'
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
      || !(supervisedTrialAllowed(job, agent) || researchDiscoveryTrialAllowed(job) || repositoryTrialAllowed(job))) return 'trial-authorization-required'
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

// Deliberately one narrow tool in an existing signed module, not general HTTP,
// arbitrary-query MCP, page fetching or a new runtime dependency/service.
export const DISCOVERY_MCP_TOOL = 'public_business_discovery'
export const DISCOVERY_MCP_POLICY = 'exa-public-business-discovery-v1'
export const DISCOVERY_RETAIL_POLICY = 'exa-public-retail-discovery-v1'
export const DISCOVERY_RETAIL_CATEGORIES = Object.freeze(['clothing','footwear','homewares'])
export function discoveryRetailPlan(category) {
  if (!DISCOVERY_RETAIL_CATEGORIES.includes(category)) return null
  const subject = {clothing:'clothing stores',footwear:'footwear stores',homewares:'homewares stores'}[category]
  return Object.freeze({query:`Official websites of ${subject} in New Cairo, Egypt`,
    objective:`Find up to three public official business websites with literal page evidence of their New Cairo location and ${subject}. Exclude personal profiles, social networks, directories and inferred contact details.`})
}
export const DISCOVERY_QUERY = 'Official websites of barbershops and hair salons in New Cairo, Egypt'
export const DISCOVERY_OBJECTIVE = 'Find up to three public official business websites with literal page evidence of their New Cairo location and barber or hair salon services. Exclude personal profiles, social networks, directories and inferred contact details.'
const EXA_ENDPOINT = 'https://mcp.exa.ai/mcp?tools=web_search_exa'
const MCP_VERSION = '2025-03-26'
const MCP_VERSIONS = new Set(['2024-11-05','2025-03-26','2025-06-18','2025-11-25'])
const DISCOVERY_LIMIT = 32768
const mcpHash = value => createHash('sha256').update(value).digest('hex')
const mcpNeed = (ok, code) => { if (!ok) throw Object.assign(new Error(code), { discoveryCode: code }) }
const exactKeys = (value, keys) => value && typeof value === 'object' && !Array.isArray(value)
  && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value,key))

/** Host-issued permit remains absent until canonical policy/qualification rollout.
 * This helper cannot mint qualification, turn a founder request into a permit or
 * grant tools to another role. The server receives no private task/query input.
 */
export function researchDiscoveryTrialAllowed(job) {
  const agent=job?.context?.agent,trial=job?.context?.supervisedTrial
  const expires=Date.parse(trial?.expiresAt||'')
  return ['trial-start','worker-trial'].includes(job?.context?.mode) && job.agent_id==='AG-RES-002' && agent?.id===job.agent_id
    && agent.modelTier==='T1_WORKER' && agent.model===T1_WORKER_MODEL && agent.departmentKey==='research-market-intelligence'
    && agent.managerModelTier==='T2_HEAD' && agent.headAuthorization===true && Boolean(agent.profileFileId)
    && (trial?.scope==='public-research-tool-trial-v1' && trial.toolPolicyId===DISCOVERY_MCP_POLICY
      || trial?.scope==='public-retail-tool-trial-v1' && trial.toolPolicyId===DISCOVERY_RETAIL_POLICY && Boolean(discoveryRetailPlan(trial.category)))
    && trial.status==='active' && trial.agentId===job.agent_id
    && trial.taskId===job.context?.task?.id && trial.managerId===agent.managerId
    && trial.externalActionsAllowed===false && trial.publishingAllowed===false
    && (agent.skillFileIds||[]).includes(trial.skillFileId) && /^[a-f0-9]{64}$/.test(trial.bindingDigest||'')
    && Number.isFinite(expires) && expires>Date.now()
}

export function discoveryMcpConfig(job, { nodePath, modulePath, budgetFile, executionModel } = {}) {
  const agent = job?.context?.agent, permit = job?.context?.publicDiscoveryPermit
  const trial=researchDiscoveryTrialAllowed(job),retail=permit?.policyId===DISCOVERY_RETAIL_POLICY
  if (!job || !['task-work','worker-trial'].includes(job.context?.mode) || agent?.id !== job.agent_id || job.agent_id!=='AG-RES-002'
    || agent.modelTier !== 'T1_WORKER' || agent.departmentKey !== 'research-market-intelligence'
    || job.context?.task?.attempt!==0 || executionModel!==agent.model
    || workerExecutionBlock(job) !== null || Object.hasOwn(job.context,'meetingResponse')
    || !exactKeys(permit,['version','policyId','jobId','agentId','bindingDigest',...(retail?['category']:[])])
    || permit.version !== 1 || ![DISCOVERY_MCP_POLICY,DISCOVERY_RETAIL_POLICY].includes(permit.policyId)
    || retail && !discoveryRetailPlan(permit.category)
    || trial && (job.context.supervisedTrial.toolPolicyId!==permit.policyId || retail && job.context.supervisedTrial.category!==permit.category)
    || permit.jobId !== job.id || permit.agentId !== job.agent_id
    || permit.bindingDigest !== (trial ? job.context.supervisedTrial.bindingDigest : agent.qualification?.bindingDigest)
    || !isAbsolute(nodePath || '') || !isAbsolute(modulePath || '') || !modulePath.endsWith('/departmentWorkflow.mjs')
    || !validDiscoveryBudgetPath(budgetFile)) return null
  return { command: nodePath, args: ['--preserve-symlinks-main',modulePath,...(retail?['--public-retail-discovery-mcp',permit.category,budgetFile]:['--public-discovery-mcp',budgetFile])],
    enabled: true, required: true, startup_timeout_sec: 10, tool_timeout_sec: 25,
    enabled_tools: [DISCOVERY_MCP_TOOL] }
}

const validDiscoveryBudgetPath = value => typeof value==='string' && isAbsolute(value)
  && resolve(value)===value && basename(value)==='exa-discovery-budget'
async function reserveDiscoveryBudget(path) {
  mcpNeed(validDiscoveryBudgetPath(path),'discovery-budget-invalid')
  const info=await lstat(dirname(path))
  mcpNeed(info.isDirectory() && !info.isSymbolicLink() && info.uid===process.getuid()
    && (info.mode&0o077)===0,'discovery-budget-invalid')
  // Never remove this reservation, even after a failed/canceled upstream call.
  // wx also rejects an existing symlink. Child restarts cannot reset the budget.
  const file=await open(path,'wx',0o600)
  try { await file.writeFile('reserved-before-exa-initialize\n');await file.sync() }
  finally { await file.close() }
  const directory=await open(dirname(path),'r')
  try { await directory.sync() } finally { await directory.close() }
}

/** Conservative global-public IP policy, using Node builtins only. */
export function discoveryPublicAddress(value) {
  if (typeof value !== 'string' || value.includes('%')) return false
  const family = isIP(value)
  if (family === 4) {
    const octets = value.split('.').map(Number), ip = octets.reduce((n,part)=>(n<<8n)|BigInt(part),0n)
    const inRange = (base,bits) => ip >> BigInt(32-bits) === BigInt(base) >> BigInt(32-bits)
    return ![[0x00000000,8],[0x0a000000,8],[0x64400000,10],[0x7f000000,8],[0xa9fe0000,16],
      [0xac100000,12],[0xc0000000,24],[0xc0000200,24],[0xc0586300,24],[0xc0a80000,16],
      [0xc6120000,15],[0xc6336400,24],[0xcb007100,24],[0xe0000000,4],[0xf0000000,4]].some(([base,bits])=>inRange(base,bits))
  }
  if (family !== 6 || value.includes('.')) return false
  const sides = value.toLowerCase().split('::'), left = sides[0] ? sides[0].split(':') : [], right = sides[1] ? sides[1].split(':') : []
  const words = sides.length === 1 ? left : [...left,...Array(8-left.length-right.length).fill('0'),...right]
  const ip = words.reduce((n,part)=>(n<<16n)|BigInt(parseInt(part,16)),0n)
  const inRange = (base,bits) => ip >> BigInt(128-bits) === base >> BigInt(128-bits)
  return inRange(0x20000000000000000000000000000000n,3)
    && ![[0x20010000000000000000000000000000n,23],[0x20010db8000000000000000000000000n,32],
      [0x20020000000000000000000000000000n,16],[0x3fff0000000000000000000000000000n,20]].some(([base,bits])=>inRange(base,bits))
}

const discoveryIpKey = value => {
  if (typeof value === 'string' && value.toLowerCase().startsWith('::ffff:') && isIP(value.slice(7)) === 4) return value.slice(7)
  if(isIP(value)===4)return value
  try { return new URL('https://['+value+']/').hostname.toLowerCase() } catch { return null }
}
const withAbort = (promise, signal) => new Promise((done, fail) => {
  if (signal.aborted) { fail(signal.reason); return }
  const abort = () => fail(signal.reason)
  signal.addEventListener('abort',abort,{once:true})
  promise.then(value=>{signal.removeEventListener('abort',abort);if(signal.aborted)fail(signal.reason);else done(value)},error=>{signal.removeEventListener('abort',abort);fail(error)})
})

/** Fixed destination and safe DNS pin. No environment proxy/agent/header inputs. */
export async function discoveryPinnedPost(url, body, session, signal, { resolveDns = dnsLookup, request = httpsRequest } = {}) {
  mcpNeed(url.href === EXA_ENDPOINT, 'discovery-endpoint-invalid')
  const answers = await withAbort(resolveDns(url.hostname,{all:true,verbatim:true}),signal)
  mcpNeed(Array.isArray(answers) && answers.length > 0 && answers.length <= 8
    && answers.every(row=>[4,6].includes(row.family) && isIP(row.address)===row.family && discoveryPublicAddress(row.address)), 'discovery-dns-rejected')
  const address = answers.find(row=>row.family===4) || answers[0]
  signal.throwIfAborted()
  return new Promise((done, fail) => {
    const headers = { Accept:'application/json, text/event-stream','Content-Type':'application/json',
      'Accept-Encoding':'identity','MCP-Protocol-Version':MCP_VERSION,'Content-Length':Buffer.byteLength(body),
      'User-Agent':'Building-Suit-HQ-Research-Discovery/1.0' }
    if(session)headers['Mcp-Session-Id']=session
    const req = request({ protocol:'https:',hostname:url.hostname,port:443,path:url.pathname+url.search,
      method:'POST',servername:url.hostname,rejectUnauthorized:true,agent:false,signal,headers,
      lookup:(hostname,options,callback)=>{
        if(hostname!==url.hostname){callback(new Error('discovery-dns-rejected'));return}
        if(options?.all)callback(null,[address]);else callback(null,address.address,address.family)
      },
    }, response=>{
      if(discoveryIpKey(response.socket.remoteAddress)!==discoveryIpKey(address.address)){
        response.destroy();fail(new Error('discovery-peer-rejected'));return
      }
      done(response)
    })
    req.once('error',fail);req.end(body)
  })
}

function parseMcpResponse(body, contentType, id) {
  let text
  try { text=new TextDecoder('utf-8',{fatal:true}).decode(body) } catch { throw new Error('discovery-response-invalid') }
  let values
  if(/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(contentType)) {
    try { values=[JSON.parse(text)] } catch { throw new Error('discovery-response-invalid') }
  } else {
    mcpNeed(/^text\/event-stream(?:\s*;\s*charset=utf-8)?$/i.test(contentType),'discovery-content-type')
    values=[]
    for(const frame of text.replace(/\r\n/g,'\n').split('\n\n')) {
      const data=frame.split('\n').filter(line=>line.startsWith('data:')).map(line=>line.slice(5).replace(/^ /,'')).join('\n')
      if(!data)continue
      try { values.push(JSON.parse(data)) } catch { throw new Error('discovery-response-invalid') }
    }
  }
  mcpNeed(values.length===1 && values[0]?.jsonrpc==='2.0' && values[0].id===id && values[0].result
    && !Object.hasOwn(values[0],'error'),'discovery-response-invalid')
  return values[0].result
}

const discoverySourceUrl = value => {
  try {
    const url=new URL(value)
    return value.length<=500 && url.protocol==='https:' && !url.username && !url.password && !url.port && !url.hash
      && !isIP(url.hostname) && url.hostname.includes('.') && !/(?:^|\.)(?:localhost|local|internal|invalid|test|example)$/.test(url.hostname)
      && ![...url.searchParams.keys()].some(key=>/(?:token|secret|password|signature|credential|api[_-]?key|^key$|^auth|^code$|^sig$)/i.test(key))
      ? url.href : null
  } catch { return null }
}

/** Shared strict literal-result parser; no network or authority is conferred. */
export function discoveryResultSources(text) {
  mcpNeed(typeof text==='string' && Buffer.byteLength(text)<=16000 && ![...text].some(character=>{const code=character.codePointAt(0);return code<32 && ![9,10,13].includes(code)})
    && !/-----BEGIN [A-Z ]*PRIVATE KEY-----|\bBearer\s+\S+|\bsb_secret_/i.test(text),'discovery-result-invalid')
  // Validate every literal result, including locally excluded/duplicate ones.
  // The fixed exclusion never becomes an upstream query or model parameter.
  const blocks=text.split(/(?=^Title: )/m)
  mcpNeed(blocks.length>=1 && blocks.length<=3 && blocks.every(block=>block.startsWith('Title: ')),'discovery-source-unavailable')
  const sources=[],seen=new Set()
  for(const block of blocks) {
    const titles=[...block.matchAll(/^Title: (.+)$/gm)],links=[...block.matchAll(/^URL: (\S+)\s*$/gm)]
    const highlights=[...block.matchAll(/^Highlights:[ \t]*$/gm)]
    mcpNeed(titles.length===1 && titles[0][1].trim().length>0 && Buffer.byteLength(titles[0][1])<=240
      && links.length===1 && highlights.length===1 && titles[0].index===0
      && links[0].index>titles[0].index && links[0].index<highlights[0].index,'discovery-source-unavailable')
    const url=discoverySourceUrl(links[0][1]),excerpt=block.slice(highlights[0].index+highlights[0][0].length).trim()
    mcpNeed(url && excerpt.length>0 && Buffer.byteLength(excerpt)<=4096,'discovery-source-unavailable')
    if(['thebarber-eg.com','www.thebarber-eg.com'].includes(new URL(url).hostname.replace(/\.$/,'')) || seen.has(url))continue
    seen.add(url);sources.push({url,title:titles[0][1],excerpt})
  }
  mcpNeed(sources.length>0,'discovery-source-unavailable')
  return sources
}

/** One upstream attempt with memory-only session state; callers reserve budget first. */
export async function runFixedDiscovery({ signal, post = discoveryPinnedPost, now = () => new Date(), policyId = DISCOVERY_MCP_POLICY, category } = {}) {
  const retail=policyId===DISCOVERY_RETAIL_POLICY,plan=retail?discoveryRetailPlan(category):{query:DISCOVERY_QUERY,objective:DISCOVERY_OBJECTIVE}
  mcpNeed([DISCOVERY_MCP_POLICY,DISCOVERY_RETAIL_POLICY].includes(policyId) && plan && (retail || category===undefined),'discovery-policy-invalid')
  const deadline=AbortSignal.any([AbortSignal.timeout(20000),...(signal?[signal]:[])])
  let session=null, requests=0
  const sessionValues=new Set()
  async function exchange(message, notification=false) {
    const body=JSON.stringify(message), url=new URL(EXA_ENDPOINT)
    for(let redirects=0;;redirects++) {
      deadline.throwIfAborted();mcpNeed(++requests<=10,'discovery-request-limit')
      const response=await withAbort(post(url,body,session,deadline),deadline)
      try {
        const incoming=response.headers['mcp-session-id']
        if(incoming!==undefined){mcpNeed(typeof incoming==='string' && /^[A-Za-z0-9._~+/=-]{1,256}$/.test(incoming),'discovery-session-invalid');session=incoming;sessionValues.add(incoming)}
        mcpNeed(!response.headers['content-encoding'] || response.headers['content-encoding']==='identity','discovery-compression-rejected')
        if([307,308].includes(response.statusCode)) {
          // A search POST is already a dispatch, even if its HTTP response is
          // a redirect. Never resend it; only non-search protocol setup may
          // follow a bounded same-endpoint redirect.
          mcpNeed(message.method!=='tools/call' && redirects<2 && typeof response.headers.location==='string'
            && new URL(response.headers.location,url).href===EXA_ENDPOINT,'discovery-redirect-rejected')
          continue
        }
        mcpNeed(response.statusCode!==403,'discovery-access-denied')
        mcpNeed(response.statusCode!==429,'discovery-rate-limited')
        mcpNeed(notification ? [200,202,204].includes(response.statusCode) : response.statusCode===200,'discovery-upstream-unavailable')
        const declared=response.headers['content-length']
        mcpNeed(declared===undefined || /^\d+$/.test(declared) && Number(declared)<=DISCOVERY_LIMIT,'discovery-response-too-large')
        const chunks=[];let bytes=0
        for await(const chunk of response){deadline.throwIfAborted();bytes+=chunk.byteLength;mcpNeed(bytes<=DISCOVERY_LIMIT,'discovery-response-too-large');chunks.push(Buffer.from(chunk))}
        deadline.throwIfAborted()
        const raw=Buffer.concat(chunks)
        if(notification){mcpNeed(raw.length===0,'discovery-response-invalid');return {}}
        return {result:parseMcpResponse(raw,response.headers['content-type']||'',message.id),raw}
      } finally { response.destroy() }
    }
  }
  try {
    const initialized=await exchange({jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:MCP_VERSION,
      capabilities:{},clientInfo:{name:'building-suit-hq-public-discovery',version:'1.0'}}})
    mcpNeed(initialized.result.protocolVersion===MCP_VERSION && initialized.result.capabilities?.tools,'discovery-protocol-invalid')
    await exchange({jsonrpc:'2.0',method:'notifications/initialized'},true)
    const listed=await exchange({jsonrpc:'2.0',id:2,method:'tools/list',params:{}})
    const tools=listed.result.tools
    mcpNeed(Array.isArray(tools) && tools.length===1 && tools[0].name==='web_search_exa','discovery-tool-list-invalid')
    const schema=tools[0].inputSchema
    mcpNeed(schema?.type==='object' && schema.additionalProperties===false && schema.required?.includes('query')
      && schema.required?.includes('objective') && schema.required.every(key=>['query','objective','numResults'].includes(key))
      && schema.properties?.query?.type==='string' && schema.properties.objective?.type==='string'
      && schema.properties.numResults?.type==='number','discovery-tool-schema-invalid')
    const searched=await exchange({jsonrpc:'2.0',id:3,method:'tools/call',params:{name:'web_search_exa',
      arguments:{query:plan.query,objective:plan.objective,numResults:3}}})
    const result=searched.result
    mcpNeed(result.isError!==true && Array.isArray(result.content) && result.content.length===1
      && result.content[0].type==='text' && typeof result.content[0].text==='string','discovery-result-invalid')
    const text=result.content[0].text
    mcpNeed(![...sessionValues].some(value=>text.includes(value)),'discovery-session-echo-rejected')
    const sources=discoveryResultSources(text)
    const structuredContent={version:1,kind:'mcp-exa-public-discovery',policyId,...(retail?{category}:{}),
      observedAt:now().toISOString(),rawResultSha256:mcpHash(searched.raw),rawResultBytes:searched.raw.length,
      sourceUrls:sources.map(source=>source.url),literalTextSha256:mcpHash(text),partial:true,wholePageVerified:false}
    return {content:[{type:'text',text}],structuredContent}
  } finally { session=null;sessionValues.clear() }
}

/** JSON-RPC handler shared by stdio and generated tests. No caller text reaches Exa. */
export function createDiscoveryMcpServer({ upstream = runFixedDiscovery, budgetFile, policyId = DISCOVERY_MCP_POLICY, category } = {}) {
  mcpNeed([DISCOVERY_MCP_POLICY,DISCOVERY_RETAIL_POLICY].includes(policyId)
    && (policyId===DISCOVERY_RETAIL_POLICY?Boolean(discoveryRetailPlan(category)):category===undefined),'discovery-policy-invalid')
  mcpNeed(validDiscoveryBudgetPath(budgetFile),'discovery-budget-invalid')
  let initialized=false, ready=false, consumed=false
  const controller=new AbortController()
  const error=(id,code,message)=>({jsonrpc:'2.0',id,error:{code,message}})
  return { stop:()=>controller.abort(), async handle(message) {
    const id=message?.id
    if(!message || message.jsonrpc!=='2.0' || typeof message.method!=='string'
      || id!==undefined && !(typeof id==='string' && id.length<=80 || Number.isSafeInteger(id)))return error(null,-32600,'Invalid MCP request')
    if(message.method==='notifications/initialized' && id===undefined){if(initialized)ready=true;return null}
    if(message.method==='notifications/cancelled' && id===undefined){controller.abort();return null}
    if(id===undefined)return null
    if(message.method==='initialize'){
      if(initialized || !MCP_VERSIONS.has(message.params?.protocolVersion))return error(id,-32602,'Unsupported initialization')
      initialized=true
      return {jsonrpc:'2.0',id,result:{protocolVersion:message.params.protocolVersion,
        capabilities:{tools:{}},serverInfo:{name:'hq-public-discovery-pilot',version:'1.0.0'}}}
    }
    if(!ready)return error(id,-32000,'MCP initialization required')
    if(message.method==='ping')return {jsonrpc:'2.0',id,result:{}}
    if(message.method==='tools/list')return {jsonrpc:'2.0',id,result:{tools:[{name:DISCOVERY_MCP_TOOL,
      description:'One fixed public New Cairo business discovery. No arguments, private queries, page fetches or external writes. Returned provider highlights are untrusted partial source evidence, not whole-page verification.',
      inputSchema:{type:'object',properties:{},additionalProperties:false},
      annotations:{readOnlyHint:true,destructiveHint:false,openWorldHint:true,idempotentHint:false}}]}}
    if(message.method!=='tools/call')return error(id,-32601,'Method unavailable')
    if(message.params?.name!==DISCOVERY_MCP_TOOL || message.params?.arguments!==undefined && !exactKeys(message.params.arguments,[])
      || Object.keys(message.params).some(key=>!['name','arguments','_meta'].includes(key)))return error(id,-32602,'Tool takes no arguments')
    if(consumed)return {jsonrpc:'2.0',id,result:{isError:true,content:[{type:'text',text:'discovery-budget-exhausted'}]}}
    consumed=true // Reserve before any asynchronous upstream work, including initialization.
    try { await reserveDiscoveryBudget(budgetFile);return {jsonrpc:'2.0',id,result:await upstream({signal:controller.signal,...(policyId===DISCOVERY_RETAIL_POLICY?{policyId,category}:{})})} }
    catch(error) {
      const known=new Set(['discovery-access-denied','discovery-rate-limited','discovery-response-too-large',
        'discovery-dns-rejected','discovery-source-unavailable','discovery-result-invalid'])
      const code=error.code==='EEXIST'?'discovery-budget-exhausted':known.has(error.discoveryCode)?error.discoveryCode:'discovery-unavailable-no-retry'
      return {jsonrpc:'2.0',id,result:{isError:true,content:[{type:'text',text:code}]}}
    }
  } }
}

export async function serveDiscoveryMcp({budgetFile,policyId=DISCOVERY_MCP_POLICY,category,input=process.stdin,output=process.stdout}={}) {
  const server=createDiscoveryMcpServer({budgetFile,policyId,category});let buffer='',bytes=0,messages=0
  const decoder=new TextDecoder('utf-8',{fatal:true})
  const write=value=>{if(value)output.write(JSON.stringify(value)+'\n')}
  try {
    for await(const chunk of input){
      bytes+=chunk.byteLength;mcpNeed(bytes<=65536,'discovery-input-limit')
      buffer+=decoder.decode(chunk,{stream:true});mcpNeed(Buffer.byteLength(buffer)<=8192,'discovery-input-limit')
      let index
      while((index=buffer.indexOf('\n'))>=0){
        const line=buffer.slice(0,index);buffer=buffer.slice(index+1)
        mcpNeed(++messages<=40,'discovery-input-limit')
        let message
        try { message=JSON.parse(line) } catch { write({jsonrpc:'2.0',id:null,error:{code:-32700,message:'Invalid JSON'}});continue }
        // Do not serialize requests behind a long search: concurrent attempts
        // immediately see the consumed budget; completion remains id-bound.
        void server.handle(message).then(write).catch(()=>write({jsonrpc:'2.0',id:message?.id??null,error:{code:-32603,message:'MCP unavailable'}}))
      }
    }
  } finally { server.stop() }
}

if(process.argv.length===4 && process.argv[2]==='--public-discovery-mcp'
  && import.meta.url===pathToFileURL(resolve(process.argv[1])).href) {
  serveDiscoveryMcp({budgetFile:process.argv[3]}).catch(()=>{process.exitCode=1})
}

if(process.argv.length===5 && process.argv[2]==='--public-retail-discovery-mcp'
  && import.meta.url===pathToFileURL(resolve(process.argv[1])).href) {
  serveDiscoveryMcp({policyId:DISCOVERY_RETAIL_POLICY,category:process.argv[3],budgetFile:process.argv[4]}).catch(()=>{process.exitCode=1})
}

// Anonymous, finite-manifest repository inspection. Never a generic GitHub client.
export const PUBLIC_REPOSITORY_POLICY='hq-public-github-read-v1'
export const PUBLIC_REPOSITORY_TOOL='read_public_repository_bundle'
export const PUBLIC_REPOSITORY_BOOTSTRAP="import {pathToFileURL} from 'node:url';import {realpathSync} from 'node:fs';const [modulePath,selection,budget]=process.argv.slice(1);for(const key of Object.keys(process.env))delete process.env[key];process.env.LANG='C.UTF-8';process.env.TZ='UTC';const source=realpathSync(modulePath);process.argv=[process.execPath,source,'--public-repository-mcp',selection,budget];await import(pathToFileURL(source).href)"
const freezeRepository=value=>{if(value&&typeof value==='object'){for(const child of Object.values(value))freezeRepository(child);Object.freeze(value)}return value}
export const PUBLIC_REPOSITORY_MANIFEST=freezeRepository({version:1,repository:{id:1376504404,fullName:'Building-Suit/building-suit-monorepo'},presets:[{id:'hq-worker-boundary-v1',lane:'source',files:[{path:'tooling/hq-agent-host/worker.mjs',windows:[[1,80],[540,619]]},{path:'tooling/hq-agent-host/departmentWorkflow.mjs',windows:[[1,80],[229,308]]}]},{id:'hq-ci-config-v1',lane:'ci',files:[{path:'.github/workflows/ci.yml',windows:[[1,80],[81,160]]},{path:'package.json',windows:[[1,80]]}]}]})
export const PUBLIC_REPOSITORY_MANIFEST_DIGEST=mcpHash(JSON.stringify(PUBLIC_REPOSITORY_MANIFEST))
const repositoryPrefix='/repos/Building-Suit/building-suit-monorepo'
const gitSha=value=>typeof value==='string'&&/^[a-f0-9]{40}$/.test(value)
const repoUuid=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(value)
export function repositorySelectionValid(selection){
 return Boolean(exactKeys(selection,['version','preset','mode','sha','pullRequestNumber'])&&selection.version===1
  &&PUBLIC_REPOSITORY_MANIFEST.presets.some(preset=>preset.id===selection.preset)&&gitSha(selection.sha)
  &&['snapshot','stg','approved-pr'].includes(selection.mode)
  &&(selection.mode==='approved-pr'?Number.isSafeInteger(selection.pullRequestNumber)&&selection.pullRequestNumber>0:selection.pullRequestNumber===null))
}
const repositoryLaneAllowed=(agentId,selection)=>selection?.preset==='hq-worker-boundary-v1'
 ?['AG-DEV-002','AG-DEV-003'].includes(agentId):selection?.preset==='hq-ci-config-v1'&&agentId==='AG-DEV-004'
const repositoryBudgetValid=path=>typeof path==='string'&&isAbsolute(path)&&resolve(path)===path
 &&/^public-repository-[a-f0-9-]{36}\.budget$/.test(basename(path))&&repoUuid(basename(path).slice(18,-7))
export function repositoryTrialAllowed(job){
 const agent=job?.context?.agent,trial=job?.context?.supervisedTrial,permit=job?.context?.publicRepositoryPermit
 return ['trial-start','worker-trial'].includes(job?.context?.mode)&&Boolean(agent)&&typeof job.agent_id==='string'&&agent.id===job.agent_id
  &&agent.modelTier==='T1_WORKER'&&agent.model===T1_WORKER_MODEL&&agent.departmentKey==='development-maintenance'
  &&agent.managerId==='AG-DEV-001'&&agent.managerModelTier==='T2_HEAD'&&agent.headAuthorization===true&&Boolean(agent.profileFileId)
  &&hasCurrentQualification(agent,agent.qualification)&&trial?.bindingDigest===agent.qualification.bindingDigest
  &&trial.reviewerId==='AG-HR-003'&&trial.reviewerId!==agent.id&&trial.reviewerId!==agent.managerId&&/^[a-f0-9]{64}$/.test(trial.reviewerBindingDigest||'')
  &&trial?.scope==='public-repository-read-trial-v1'&&trial.toolPolicyId===PUBLIC_REPOSITORY_POLICY&&trial.status==='active'
  &&trial.agentId===job.agent_id&&trial.taskId===job.context.task?.id&&trial.managerId===agent.managerId
  &&trial.externalActionsAllowed===false&&trial.publishingAllowed===false&&(agent.skillFileIds||[]).includes(trial.skillFileId)
  &&/^[a-f0-9]{64}$/.test(trial.bindingDigest||'')&&Date.parse(trial.expiresAt||'')>Date.now()
  &&repositorySelectionValid(job.context.mode==='trial-start'?trial.repositorySelection:permit?.selection)
  &&repositoryLaneAllowed(job.agent_id,job.context.mode==='trial-start'?trial.repositorySelection:permit.selection)
}
export function repositoryMcpConfig(job,{nodePath,modulePath,budgetFile,executionModel}={}){
 const agent=job?.context?.agent,permit=job?.context?.publicRepositoryPermit,trial=repositoryTrialAllowed(job)
 if(!agent||!['task-work','worker-trial'].includes(job.context?.mode)||agent.id!==job.agent_id
  ||!repositorySelectionValid(permit?.selection)||!repositoryLaneAllowed(job.agent_id,permit.selection)
  ||agent.departmentKey!=='development-maintenance'||job.context.task?.attempt!==0||executionModel!==agent.model
  ||workerExecutionBlock(job)!==null||Object.hasOwn(job.context,'meetingResponse')
  ||!exactKeys(permit,['version','policyId','jobId','agentId','bindingDigest','selection','reservationId','manifestDigest','expiresAt'])
  ||permit.version!==1||permit.policyId!==PUBLIC_REPOSITORY_POLICY||permit.jobId!==job.id||permit.agentId!==job.agent_id
  ||permit.manifestDigest!==PUBLIC_REPOSITORY_MANIFEST_DIGEST||!repoUuid(permit.reservationId)||Date.parse(permit.expiresAt||'')<=Date.now()||!Number.isFinite(Date.parse(permit.expiresAt||''))
  ||permit.bindingDigest!==(trial?job.context.supervisedTrial.bindingDigest:agent.qualification?.bindingDigest)
  ||!isAbsolute(nodePath||'')||!isAbsolute(modulePath||'')||!modulePath.endsWith('/departmentWorkflow.mjs')
  ||!repositoryBudgetValid(budgetFile)||basename(budgetFile)!==`public-repository-${permit.reservationId}.budget`)return null
 return{command:nodePath,args:['--preserve-symlinks-main','--input-type=module','--eval',PUBLIC_REPOSITORY_BOOTSTRAP,modulePath,Buffer.from(JSON.stringify(permit.selection)).toString('base64url'),budgetFile],enabled:true,required:true,startup_timeout_sec:10,tool_timeout_sec:45,enabled_tools:[PUBLIC_REPOSITORY_TOOL]}
}
async function reserveRepositoryBudget(path){
 mcpNeed(repositoryBudgetValid(path),'repository-budget-invalid')
 const info=await lstat(dirname(path));mcpNeed(info.isDirectory()&&!info.isSymbolicLink()&&info.uid===process.getuid()&&(info.mode&0o077)===0,'repository-budget-invalid')
 const file=await open(path,'wx',0o600);try{await file.writeFile('reserved-before-public-github-get\n');await file.sync()}finally{await file.close()}
 const directory=await open(dirname(path),'r');try{await directory.sync()}finally{await directory.close()}
}
/** Only the fixed API origin is reachable; API-provided URLs are never followed. */
export async function repositoryPinnedGet(path,signal,{resolveDns=dnsLookup,request=httpsRequest}={}){
 mcpNeed(typeof path==='string'&&path.startsWith(repositoryPrefix)&&/^(?:|\/git\/(?:commits|trees|blobs)\/[a-f0-9]{40}|\/git\/ref\/heads\/stg|\/pulls\/[1-9][0-9]*|\/actions\/runs\?head_sha=[a-f0-9]{40}&per_page=20|\/commits\/[a-f0-9]{40}\/check-runs\?per_page=20|\/actions\/runs\/[1-9][0-9]*\/attempts\/[1-9][0-9]*\/jobs\?per_page=3)$/.test(path.slice(repositoryPrefix.length)),'repository-path-invalid')
 const answers=await withAbort(resolveDns('api.github.com',{all:true,verbatim:true}),signal)
 mcpNeed(Array.isArray(answers)&&answers.length>0&&answers.length<=8&&answers.every(row=>[4,6].includes(row.family)&&isIP(row.address)===row.family&&discoveryPublicAddress(row.address)),'repository-dns-rejected')
 const address=answers.find(row=>row.family===4)||answers[0];signal.throwIfAborted()
 return new Promise((done,fail)=>{
  const req=request({protocol:'https:',hostname:'api.github.com',port:443,path,method:'GET',servername:'api.github.com',rejectUnauthorized:true,agent:false,signal,
   headers:{Accept:'application/vnd.github+json','Accept-Encoding':'identity','X-GitHub-Api-Version':'2022-11-28','User-Agent':'Building-Suit-HQ-Public-Repository/1.0'},
   lookup:(hostname,options,callback)=>{if(hostname!=='api.github.com'){callback(new Error('repository-dns-rejected'));return}if(options?.all)callback(null,[address]);else callback(null,address.address,address.family)},
  },response=>{if(discoveryIpKey(response.socket.remoteAddress)!==discoveryIpKey(address.address)){response.destroy();fail(new Error('repository-peer-rejected'));return}done(response)})
  req.once('error',fail);req.end()
 })
}
const repositoryIdentity=row=>row&&row.id===1376504404&&row.full_name==='Building-Suit/building-suit-monorepo'&&row.private===false&&(row.visibility===undefined||row.visibility==='public')
const repoControl=text=>[...text].some(character=>{const code=character.codePointAt(0);return code<32&&![9,10,13].includes(code)})
const repoSensitive=text=>/-----BEGIN [A-Z ]*PRIVATE KEY-----|\b(?:ghp_|github_pat_|sb_secret_)[A-Za-z0-9_]{12,}|\bAKIA[A-Z0-9]{16}\b|\bBearer\s+[A-Za-z0-9._~-]{20,}|\b(?:password|api[_-]?key|access[_-]?token|refresh[_-]?token|client[_-]?secret)\s*[:=]\s*["'][A-Za-z0-9_./+=-]{16,}/i.test(text)
const boundedRepoText=(value,max)=>{let result='',bytes=0;for(const char of value){const next=Buffer.byteLength(char);if(bytes+next>max)break;result+=char;bytes+=next}return result}
export async function readPublicRepository({selection,signal,get=repositoryPinnedGet,now=()=>new Date()}={}){
 mcpNeed(repositorySelectionValid(selection),'repository-selection-invalid')
 selection=freezeRepository(JSON.parse(JSON.stringify(selection)))
 const preset=PUBLIC_REPOSITORY_MANIFEST.presets.find(row=>row.id===selection.preset)
 const deadline=AbortSignal.any([AbortSignal.timeout(40000),...(signal?[signal]:[])]);let attempts=0,bytesRead=0,treesRead=0
 async function json(path,optional=false){
  mcpNeed(++attempts<=12,'repository-request-limit');deadline.throwIfAborted()
  const requestSignal=AbortSignal.any([deadline,AbortSignal.timeout(8000)])
  const response=await withAbort(get(path,requestSignal),requestSignal)
  try{
   mcpNeed(response.statusCode!==403,'repository-access-denied');mcpNeed(response.statusCode!==429,'repository-rate-limited')
   if(optional&&response.statusCode===404)return{unavailable:404}
   mcpNeed(response.statusCode===200&&/^application\/json(?:\s*;.*)?$/i.test(response.headers['content-type']||''),'repository-response-invalid')
   mcpNeed(!response.headers['content-encoding']||response.headers['content-encoding']==='identity','repository-compression-rejected')
   mcpNeed(!response.headers.location&&!(response.statusCode>=300&&response.statusCode<400),'repository-redirect-rejected')
   const declared=response.headers['content-length'];mcpNeed(declared===undefined||/^\d+$/.test(declared)&&Number(declared)<=262144,'repository-json-too-large')
   let size=0;const chunks=[]
   await withAbort((async()=>{for await(const chunk of response){requestSignal.throwIfAborted();size+=chunk.byteLength;bytesRead+=chunk.byteLength;mcpNeed(size<=262144&&bytesRead<=1048576,'repository-byte-limit');chunks.push(Buffer.from(chunk))}})(),requestSignal)
   requestSignal.throwIfAborted()
   let value;try{value=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks)))}catch{throw Object.assign(new Error('repository-json-invalid'),{discoveryCode:'repository-json-invalid'})}
   return value
  }finally{response.destroy()}
 }
 mcpNeed(repositoryIdentity(await json(repositoryPrefix)),'repository-identity-invalid')
 if(selection.mode==='stg'){
  const ref=await json(repositoryPrefix+'/git/ref/heads/stg');mcpNeed(ref.ref==='refs/heads/stg'&&ref.object?.type==='commit'&&ref.object.sha===selection.sha,'repository-ref-drift')
 }else if(selection.mode==='approved-pr'){
  const pr=await json(repositoryPrefix+'/pulls/'+selection.pullRequestNumber)
  mcpNeed(pr.number===selection.pullRequestNumber&&repositoryIdentity(pr.base?.repo)&&repositoryIdentity(pr.head?.repo)&&pr.base.ref==='stg'&&pr.head.sha===selection.sha,'repository-pr-drift')
 }
 const commit=await json(repositoryPrefix+'/git/commits/'+selection.sha)
 mcpNeed(commit.sha===selection.sha&&gitSha(commit.tree?.sha),'repository-commit-invalid')
 const resolvedSha=commit.sha,revisionObservedAt=now().toISOString()
 const treeCache=new Map()
 async function tree(sha){
  if(treeCache.has(sha))return treeCache.get(sha)
  mcpNeed(++treesRead<=8,'repository-tree-limit')
  const data=await json(repositoryPrefix+'/git/trees/'+sha)
  mcpNeed(data.sha===sha&&data.truncated===false&&Array.isArray(data.tree)&&data.tree.length<=4096,'repository-tree-invalid')
  const seen=new Set()
  for(const entry of data.tree){mcpNeed(typeof entry.path==='string'&&entry.path.length>0&&entry.path.length<=255&&!/[/\\]/.test(entry.path)&&!repoControl(entry.path)&&!seen.has(entry.path)&&gitSha(entry.sha),'repository-tree-invalid');seen.add(entry.path)}
  treeCache.set(sha,data.tree);return data.tree
 }
 const files=[];let excerptBytes=0
 const windowShare=Math.floor(20480/preset.files.reduce((count,file)=>count+file.windows.length,0))
 for(const spec of preset.files){
  let sha=commit.tree.sha;const parts=spec.path.split('/');let entry
  for(let n=0;n<parts.length;n++){
   entry=(await tree(sha)).find(row=>row.path===parts[n]);mcpNeed(entry,'repository-file-missing')
   if(n<parts.length-1){mcpNeed(entry.type==='tree'&&entry.mode==='040000','repository-mode-invalid');sha=entry.sha}
   else mcpNeed(entry.type==='blob'&&entry.mode==='100644','repository-mode-invalid')
  }
  const blob=await json(repositoryPrefix+'/git/blobs/'+entry.sha)
  mcpNeed(blob.sha===entry.sha&&blob.encoding==='base64'&&Number.isSafeInteger(blob.size)&&blob.size>0&&blob.size<=131072&&typeof blob.content==='string','repository-blob-invalid')
  const encoded=blob.content.replace(/\n/g,'');mcpNeed(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded),'repository-base64-invalid')
  const raw=Buffer.from(encoded,'base64');mcpNeed(raw.length===blob.size&&raw.toString('base64')===encoded&&createHash('sha1').update(Buffer.concat([Buffer.from(`blob ${raw.length}\0`),raw])).digest('hex')===entry.sha,'repository-blob-integrity')
  let text;try{text=new TextDecoder('utf-8',{fatal:true}).decode(raw)}catch{throw Object.assign(new Error('repository-utf8-invalid'),{discoveryCode:'repository-utf8-invalid'})}
  mcpNeed(!repoControl(text)&&!repoSensitive(text)&&!text.startsWith('version https://git-lfs.github.com/spec/v1'),'repository-content-rejected')
  const lines=text.split('\n'),windows=[]
  for(const[start,end]of spec.windows){const full=lines.slice(start-1,end).join('\n'),excerpt=boundedRepoText(full,Math.min(windowShare,Math.max(0,20480-excerptBytes)));excerptBytes+=Buffer.byteLength(excerpt);windows.push({start,end,text:excerpt,sha256:mcpHash(excerpt),truncated:excerpt!==full})}
  files.push({path:spec.path,blobSha:entry.sha,bytes:raw.length,sha256:mcpHash(raw),windows})
 }
 const ci={state:preset.lane==='ci'?'observed':'not-requested',runs:[],checks:[],jobs:[],unknownReasons:[]}
 if(preset.lane==='ci'){
  const runs=await json(repositoryPrefix+'/actions/runs?head_sha='+selection.sha+'&per_page=20',true)
  const checks=await json(repositoryPrefix+'/commits/'+selection.sha+'/check-runs?per_page=20',true)
  const nameValid=value=>typeof value==='string'&&value.trim().length>0&&Buffer.byteLength(value)<=160&&!repoControl(value)&&!repoSensitive(value)
  const dateValid=(value,nullable=false)=>nullable&&value===null||typeof value==='string'&&value.length<=40&&Number.isFinite(Date.parse(value))
  const statusValid=row=>typeof row.status==='string'&&/^[a-z_]{1,40}$/.test(row.status)&&(row.conclusion===null||typeof row.conclusion==='string'&&/^[a-z_]{1,40}$/.test(row.conclusion))
  for(const[key,data,arrayKey]of[['runs',runs,'workflow_runs'],['checks',checks,'check_runs']]){
   if(data.unavailable){ci.state='unavailable';ci.unknownReasons.push(key+'-http-'+data.unavailable);continue}
   mcpNeed(Array.isArray(data[arrayKey])&&data[arrayKey].length<=20&&Number.isSafeInteger(data.total_count)&&data.total_count>=data[arrayKey].length,'repository-ci-invalid')
   if(data.total_count>data[arrayKey].length)ci.unknownReasons.push(key+'-window-only')
   for(const row of data[arrayKey]){
    mcpNeed(Number.isSafeInteger(row.id)&&row.id>0&&row.head_sha===selection.sha&&statusValid(row),'repository-ci-invalid')
    if(key==='runs'){
     mcpNeed(repositoryIdentity(row.repository)&&Number.isSafeInteger(row.run_attempt)&&row.run_attempt>0,'repository-ci-invalid')
     if(row.path!=='.github/workflows/ci.yml'){if(!ci.unknownReasons.includes('other-workflow-omitted'))ci.unknownReasons.push('other-workflow-omitted');continue}
     mcpNeed(nameValid(row.name)&&dateValid(row.created_at)&&dateValid(row.updated_at),'repository-ci-invalid')
     if(ci.runs.length>=2){if(!ci.unknownReasons.includes('runs-window-only'))ci.unknownReasons.push('runs-window-only');continue}
     ci.runs.push({id:row.id,attempt:row.run_attempt,name:row.name,status:row.status,conclusion:row.conclusion,createdAt:row.created_at,updatedAt:row.updated_at})
    }else{
     mcpNeed(nameValid(row.name)&&dateValid(row.started_at,true)&&dateValid(row.completed_at,true),'repository-ci-invalid')
     if(ci.checks.length>=3){if(!ci.unknownReasons.includes('checks-window-only'))ci.unknownReasons.push('checks-window-only');continue}
     ci.checks.push({id:row.id,name:row.name,status:row.status,conclusion:row.conclusion,startedAt:row.started_at,completedAt:row.completed_at})
    }
   }
  }
  for(const run of ci.runs){
   const jobs=await json(repositoryPrefix+'/actions/runs/'+run.id+'/attempts/'+run.attempt+'/jobs?per_page=3',true)
   if(jobs.unavailable){ci.state='unavailable';ci.unknownReasons.push('jobs-http-'+jobs.unavailable);continue}
   mcpNeed(Array.isArray(jobs.jobs)&&jobs.jobs.length<=3&&Number.isSafeInteger(jobs.total_count)&&jobs.total_count>=jobs.jobs.length,'repository-ci-invalid')
   if(jobs.total_count>jobs.jobs.length)ci.unknownReasons.push('jobs-window-only')
   for(const row of jobs.jobs){
    mcpNeed(Number.isSafeInteger(row.id)&&row.id>0&&row.run_id===run.id&&(row.run_attempt===undefined||row.run_attempt===run.attempt)&&row.head_sha===selection.sha&&statusValid(row)&&nameValid(row.name)&&dateValid(row.started_at,true)&&dateValid(row.completed_at,true),'repository-ci-invalid')
    ci.jobs.push({id:row.id,runId:run.id,attempt:run.attempt,name:row.name,status:row.status,conclusion:row.conclusion,startedAt:row.started_at,completedAt:row.completed_at})
   }
  }
 }
 deadline.throwIfAborted()
 const bundle={version:1,repositoryId:1376504404,repositoryFullName:'Building-Suit/building-suit-monorepo',manifestDigest:PUBLIC_REPOSITORY_MANIFEST_DIGEST,selection,resolvedSha,revisionObservedAt,observedAt:now().toISOString(),requestAttempts:attempts,bytesRead,files,ci,partial:true,authentication:'none',codeExecuted:false,writesPerformed:false,testedSourceSha:'unknown',executedByThisEmployee:false,requiredChecksVerified:false}
 const text=JSON.stringify(bundle)
 const structuredContent={version:1,kind:'mcp-public-github-read',policyId:PUBLIC_REPOSITORY_POLICY,repositoryId:1376504404,manifestDigest:PUBLIC_REPOSITORY_MANIFEST_DIGEST,selection,observedAt:bundle.observedAt,bundleSha256:mcpHash(text),bundleBytes:Buffer.byteLength(text)}
 const result={content:[{type:'text',text}],structuredContent};mcpNeed(Buffer.byteLength(JSON.stringify(result))<=32768,'repository-result-limit');repositoryToolResult(result);return result
}
export function createRepositoryMcpServer({selection,budgetFile,upstream=readPublicRepository}={}){
 mcpNeed(repositorySelectionValid(selection)&&repositoryBudgetValid(budgetFile),'repository-selection-invalid')
 selection=freezeRepository(JSON.parse(JSON.stringify(selection)))
 let initialized=false,ready=false,consumed=false;const controller=new AbortController()
 return{stop:()=>controller.abort(),async handle(message){
  const id=message?.id,error=(code,text)=>({jsonrpc:'2.0',id:id??null,error:{code,message:text}})
  if(!message||message.jsonrpc!=='2.0'||typeof message.method!=='string'||id!==undefined&&!(typeof id==='string'&&id.length<=80||Number.isSafeInteger(id)))return error(-32600,'Invalid MCP request')
  if(id===undefined){if(message.method==='notifications/initialized'&&initialized)ready=true;if(message.method==='notifications/cancelled')controller.abort();return null}
  if(message.method==='initialize'){if(initialized||!MCP_VERSIONS.has(message.params?.protocolVersion))return error(-32602,'Unsupported initialization');initialized=true;return{jsonrpc:'2.0',id,result:{protocolVersion:message.params.protocolVersion,capabilities:{tools:{}},serverInfo:{name:'hq-public-repository-reader',version:'1.0.0'}}}}
  if(!ready)return error(-32000,'MCP initialization required')
  if(message.method==='ping')return{jsonrpc:'2.0',id,result:{}}
  if(message.method==='tools/list')return{jsonrpc:'2.0',id,result:{tools:[{name:PUBLIC_REPOSITORY_TOOL,description:'Read one fixed public repository source/CI manifest at the host-approved immutable snapshot. No arguments, credentials, execution or writes.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,destructiveHint:false,openWorldHint:true,idempotentHint:false}}]}}
  if(message.method!=='tools/call')return error(-32601,'Method unavailable')
  if(message.params?.name!==PUBLIC_REPOSITORY_TOOL||message.params.arguments!==undefined&&!exactKeys(message.params.arguments,[])||Object.keys(message.params).some(key=>!['name','arguments','_meta'].includes(key)))return error(-32602,'Tool takes no arguments')
  if(consumed)return{jsonrpc:'2.0',id,result:{isError:true,content:[{type:'text',text:'repository-budget-exhausted'}]}}
  consumed=true
  try{await reserveRepositoryBudget(budgetFile);return{jsonrpc:'2.0',id,result:await upstream({selection,signal:controller.signal})}}
  catch(error){return{jsonrpc:'2.0',id,result:{isError:true,content:[{type:'text',text:error.code==='EEXIST'?'repository-budget-exhausted':['repository-access-denied','repository-rate-limited'].includes(error.discoveryCode)?error.discoveryCode:'repository-unavailable-no-retry'}]}}}
 }}
}
async function serveRepositoryMcp(selection,budgetFile){
 const server=createRepositoryMcpServer({selection,budgetFile});let buffer='',bytes=0,messages=0
 const decoder=new TextDecoder('utf-8',{fatal:true}),write=value=>{if(value)process.stdout.write(JSON.stringify(value)+'\n')}
 try{for await(const chunk of process.stdin){bytes+=chunk.byteLength;mcpNeed(bytes<=65536,'repository-input-limit');buffer+=decoder.decode(chunk,{stream:true});mcpNeed(Buffer.byteLength(buffer)<=8192,'repository-input-limit');let index
  while((index=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,index);buffer=buffer.slice(index+1);mcpNeed(++messages<=40,'repository-input-limit');let message;try{message=JSON.parse(line)}catch{write({jsonrpc:'2.0',id:null,error:{code:-32700,message:'Invalid JSON'}});continue}void server.handle(message).then(write).catch(()=>write({jsonrpc:'2.0',id:message?.id??null,error:{code:-32603,message:'MCP unavailable'}}))}
 }}finally{server.stop()}
}
if(process.argv.length===5&&process.argv[2]==='--public-repository-mcp'&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 Promise.resolve().then(()=>{const encoded=process.argv[3];mcpNeed(/^[A-Za-z0-9_-]{1,1000}$/.test(encoded),'repository-selection-invalid');const raw=Buffer.from(encoded,'base64url');mcpNeed(raw.toString('base64url')===encoded,'repository-selection-invalid');return serveRepositoryMcp(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(raw)),process.argv[4])}).catch(()=>{process.exitCode=1})
}
/** Validate the actual typed MCP result, never a model's repository narrative. */
export function repositoryToolResult(result){
 const metadata=result?.structuredContent??result?.structured_content,content=result?.content
 mcpNeed(result?.isError!==true&&exactKeys(metadata,['version','kind','policyId','repositoryId','manifestDigest','selection','observedAt','bundleSha256','bundleBytes'])
  &&metadata.version===1&&metadata.kind==='mcp-public-github-read'&&metadata.policyId===PUBLIC_REPOSITORY_POLICY&&metadata.repositoryId===1376504404
  &&metadata.manifestDigest===PUBLIC_REPOSITORY_MANIFEST_DIGEST&&repositorySelectionValid(metadata.selection)
  &&typeof metadata.observedAt==='string'&&Number.isFinite(Date.parse(metadata.observedAt))
  &&Array.isArray(content)&&content.length===1&&content[0]?.type==='text'&&typeof content[0].text==='string'
  &&Buffer.byteLength(JSON.stringify(result))<=32768,'repository-result-invalid')
 if(result.structuredContent&&result.structured_content)mcpNeed(JSON.stringify(result.structuredContent)===JSON.stringify(result.structured_content),'repository-result-invalid')
 const text=content[0].text
 mcpNeed(metadata.bundleBytes===Buffer.byteLength(text)&&metadata.bundleSha256===mcpHash(text)&&!repoSensitive(text),'repository-result-invalid')
 let bundle;try{bundle=JSON.parse(text)}catch{throw Object.assign(new Error('repository-result-invalid'),{discoveryCode:'repository-result-invalid'})}
 mcpNeed(exactKeys(bundle,['version','repositoryId','repositoryFullName','manifestDigest','selection','resolvedSha','revisionObservedAt','observedAt','requestAttempts','bytesRead','files','ci','partial','authentication','codeExecuted','writesPerformed','testedSourceSha','executedByThisEmployee','requiredChecksVerified'])
  &&bundle.version===1&&bundle.repositoryId===1376504404&&bundle.repositoryFullName==='Building-Suit/building-suit-monorepo'
  &&bundle.manifestDigest===metadata.manifestDigest&&JSON.stringify(bundle.selection)===JSON.stringify(metadata.selection)&&bundle.observedAt===metadata.observedAt
  &&bundle.resolvedSha===bundle.selection.sha&&typeof bundle.revisionObservedAt==='string'&&Number.isFinite(Date.parse(bundle.revisionObservedAt))
  &&Date.parse(bundle.revisionObservedAt)<=Date.parse(bundle.observedAt)&&Date.parse(bundle.observedAt)-Date.parse(bundle.revisionObservedAt)<=40000
  &&Number.isSafeInteger(bundle.requestAttempts)&&bundle.requestAttempts>0&&bundle.requestAttempts<=12&&Number.isSafeInteger(bundle.bytesRead)&&bundle.bytesRead>0&&bundle.bytesRead<=1048576
  &&bundle.partial===true&&bundle.authentication==='none'&&bundle.codeExecuted===false&&bundle.writesPerformed===false&&bundle.testedSourceSha==='unknown'&&bundle.executedByThisEmployee===false&&bundle.requiredChecksVerified===false,'repository-result-invalid')
 const preset=PUBLIC_REPOSITORY_MANIFEST.presets.find(row=>row.id===bundle.selection.preset);let excerptBytes=0
 const windowShare=Math.floor(20480/preset.files.reduce((count,file)=>count+file.windows.length,0))
 mcpNeed(Array.isArray(bundle.files)&&bundle.files.length===preset.files.length,'repository-result-invalid')
 for(let n=0;n<preset.files.length;n++){
  const file=bundle.files[n],spec=preset.files[n]
  mcpNeed(exactKeys(file,['path','blobSha','bytes','sha256','windows'])&&file.path===spec.path&&gitSha(file.blobSha)&&/^[a-f0-9]{64}$/.test(file.sha256||'')&&Number.isSafeInteger(file.bytes)&&file.bytes>0&&file.bytes<=131072&&Array.isArray(file.windows)&&file.windows.length===spec.windows.length,'repository-result-invalid')
  for(let w=0;w<spec.windows.length;w++){
   const window=file.windows[w],[start,end]=spec.windows[w]
   mcpNeed(exactKeys(window,['start','end','text','sha256','truncated'])&&window.start===start&&window.end===end&&typeof window.text==='string'&&Buffer.byteLength(window.text)<=windowShare&&!repoControl(window.text)&&!repoSensitive(window.text)&&mcpHash(window.text)===window.sha256&&typeof window.truncated==='boolean','repository-result-invalid')
   excerptBytes+=Buffer.byteLength(window.text);mcpNeed(excerptBytes<=20480,'repository-result-invalid')
  }
 }
 const ci=bundle.ci
 mcpNeed(exactKeys(ci,['state','runs','checks','jobs','unknownReasons'])&&['observed','unavailable','not-requested'].includes(ci.state)&&Array.isArray(ci.runs)&&ci.runs.length<=2&&Array.isArray(ci.checks)&&ci.checks.length<=3&&Array.isArray(ci.jobs)&&ci.jobs.length<=6&&Array.isArray(ci.unknownReasons)&&ci.unknownReasons.length<=6,'repository-result-invalid')
 mcpNeed(ci.unknownReasons.every(value=>['runs-http-404','checks-http-404','jobs-http-404','runs-window-only','checks-window-only','jobs-window-only','other-workflow-omitted'].includes(value)),'repository-result-invalid')
 if(preset.lane==='source')mcpNeed(ci.state==='not-requested'&&ci.runs.length===0&&ci.checks.length===0&&ci.jobs.length===0&&ci.unknownReasons.length===0,'repository-result-invalid')
 for(const[key,entries]of[['runs',ci.runs],['checks',ci.checks],['jobs',ci.jobs]])for(const row of entries){
  const keys=key==='runs'?['id','attempt','name','status','conclusion','createdAt','updatedAt']:key==='jobs'?['id','runId','attempt','name','status','conclusion','startedAt','completedAt']:['id','name','status','conclusion','startedAt','completedAt']
  mcpNeed(exactKeys(row,keys)&&Number.isSafeInteger(row.id)&&row.id>0&&typeof row.name==='string'&&row.name.trim().length>0&&Buffer.byteLength(row.name)<=160&&!repoControl(row.name)&&!repoSensitive(row.name)
   &&(key==='checks'||Number.isSafeInteger(row.attempt)&&row.attempt>0)&&(key!=='jobs'||ci.runs.some(run=>run.id===row.runId&&run.attempt===row.attempt))
   &&typeof row.status==='string'&&/^[a-z_]{1,40}$/.test(row.status)&&(row.conclusion===null||typeof row.conclusion==='string'&&/^[a-z_]{1,40}$/.test(row.conclusion)),'repository-result-invalid')
  for(const field of key==='runs'?['createdAt','updatedAt']:['startedAt','completedAt'])mcpNeed(key!=='runs'&&row[field]===null||typeof row[field]==='string'&&row[field].length<=40&&Number.isFinite(Date.parse(row[field])),'repository-result-invalid')
 }
 return bundle
}
