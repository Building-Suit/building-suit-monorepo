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
      || !(supervisedTrialAllowed(job, agent) || researchDiscoveryTrialAllowed(job))) return 'trial-authorization-required'
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
    && trial?.scope==='public-research-tool-trial-v1' && trial.status==='active'
    && trial.toolPolicyId===DISCOVERY_MCP_POLICY && trial.agentId===job.agent_id
    && trial.taskId===job.context?.task?.id && trial.managerId===agent.managerId
    && trial.externalActionsAllowed===false && trial.publishingAllowed===false
    && (agent.skillFileIds||[]).includes(trial.skillFileId) && /^[a-f0-9]{64}$/.test(trial.bindingDigest||'')
    && Number.isFinite(expires) && expires>Date.now()
}

export function discoveryMcpConfig(job, { nodePath, modulePath, budgetFile, executionModel } = {}) {
  const agent = job?.context?.agent, permit = job?.context?.publicDiscoveryPermit
  const trial=researchDiscoveryTrialAllowed(job)
  if (!job || !['task-work','worker-trial'].includes(job.context?.mode) || agent?.id !== job.agent_id || job.agent_id!=='AG-RES-002'
    || agent.modelTier !== 'T1_WORKER' || agent.departmentKey !== 'research-market-intelligence'
    || job.context?.task?.attempt!==0 || executionModel!==agent.model
    || workerExecutionBlock(job) !== null || Object.hasOwn(job.context,'meetingResponse')
    || !exactKeys(permit,['version','policyId','jobId','agentId','bindingDigest'])
    || permit.version !== 1 || permit.policyId !== DISCOVERY_MCP_POLICY
    || permit.jobId !== job.id || permit.agentId !== job.agent_id
    || permit.bindingDigest !== (trial ? job.context.supervisedTrial.bindingDigest : agent.qualification?.bindingDigest)
    || !isAbsolute(nodePath || '') || !isAbsolute(modulePath || '') || !modulePath.endsWith('/departmentWorkflow.mjs')
    || !validDiscoveryBudgetPath(budgetFile)) return null
  return { command: nodePath, args: ['--preserve-symlinks-main',modulePath,'--public-discovery-mcp',budgetFile],
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
    if(url==='https://thebarber-eg.com/en' || seen.has(url))continue
    seen.add(url);sources.push({url,title:titles[0][1],excerpt})
  }
  mcpNeed(sources.length>0,'discovery-source-unavailable')
  return sources
}

/** One upstream attempt with memory-only session state; callers reserve budget first. */
export async function runFixedDiscovery({ signal, post = discoveryPinnedPost, now = () => new Date() } = {}) {
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
      arguments:{query:DISCOVERY_QUERY,objective:DISCOVERY_OBJECTIVE,numResults:3}}})
    const result=searched.result
    mcpNeed(result.isError!==true && Array.isArray(result.content) && result.content.length===1
      && result.content[0].type==='text' && typeof result.content[0].text==='string','discovery-result-invalid')
    const text=result.content[0].text
    mcpNeed(![...sessionValues].some(value=>text.includes(value)),'discovery-session-echo-rejected')
    const sources=discoveryResultSources(text)
    const structuredContent={version:1,kind:'mcp-exa-public-discovery',policyId:DISCOVERY_MCP_POLICY,
      observedAt:now().toISOString(),rawResultSha256:mcpHash(searched.raw),rawResultBytes:searched.raw.length,
      sourceUrls:sources.map(source=>source.url),literalTextSha256:mcpHash(text),partial:true,wholePageVerified:false}
    return {content:[{type:'text',text}],structuredContent}
  } finally { session=null;sessionValues.clear() }
}

/** JSON-RPC handler shared by stdio and generated tests. No caller text reaches Exa. */
export function createDiscoveryMcpServer({ upstream = runFixedDiscovery, budgetFile } = {}) {
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
    try { await reserveDiscoveryBudget(budgetFile);return {jsonrpc:'2.0',id,result:await upstream({signal:controller.signal})} }
    catch(error) {
      const known=new Set(['discovery-access-denied','discovery-rate-limited','discovery-response-too-large',
        'discovery-dns-rejected','discovery-source-unavailable','discovery-result-invalid'])
      const code=error.code==='EEXIST'?'discovery-budget-exhausted':known.has(error.discoveryCode)?error.discoveryCode:'discovery-unavailable-no-retry'
      return {jsonrpc:'2.0',id,result:{isError:true,content:[{type:'text',text:code}]}}
    }
  } }
}

export async function serveDiscoveryMcp({budgetFile,input=process.stdin,output=process.stdout}={}) {
  const server=createDiscoveryMcpServer({budgetFile});let buffer='',bytes=0,messages=0
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
