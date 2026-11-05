import { randomUUID } from 'node:crypto'
import { createMeeting, applyCommand, resolveRecentLink, safeSharedUrl } from '../../shared/meetings/domain.mjs'
import { demonstrationRegistry } from '../../shared/meetings/registry.mjs'
import { createSyntheticMeetingRepository } from './repository.mjs'

const repositories = new Map()
function repository(filename) {
  if (!repositories.has(filename)) {
    if (repositories.size >= 1) throw new Error('demo-database-limit')
    repositories.set(filename, createSyntheticMeetingRepository({ filename, synthetic: true }))
  }
  return repositories.get(filename)
}
export function demoSnapshot(filename, owner, meetingId) {
  const repo = repository(filename)
  const record = meetingId ? repo.get(owner, meetingId) : repo.list(owner)[0] ?? null
  return { mode: 'demonstration', registry: demonstrationRegistry, record, receipts: record ? repo.jobs(owner, record.id) : [], reports: record ? repo.report(owner, record.id) : [] }
}
function taskLinks(record, input, includeRecent) {
  // A supplied URL is exact scope, not a hint to replace with newer chat data.
  if (input.url !== undefined) return [safeSharedUrl(input.url)]
  const explicit = [...new Set((typeof input.question === 'string' ? input.question.match(/https?:\/\/[^\s<>]+/g) : null) ?? [])]
  if (explicit.length > 1) throw new Error('research-link-ambiguous')
  if (explicit.length === 1) return [safeSharedUrl(explicit[0])]
  if (!includeRecent) return []
  const reference = resolveRecentLink(record, input.referenceEventId)
  if (reference.status === 'ambiguous') throw new Error('research-link-ambiguous')
  return reference.status === 'resolved' ? [reference.url] : []
}
function taskFor(record, input, id, includeRecentLinks = true) {
  const agent = record.participants.find(item => item.id === input.agentId)
  if (!agent?.supervisorId) throw new Error('supervisor-required')
  return { id, agentId: agent.id, supervisorId: agent.supervisorId, question: input.question, scope: 'Deterministic disposable fixture only; no external execution.', deliverable: input.deliverable ?? 'A clearly labeled synthetic findings report', allowedTools: ['synthetic-fixture'], allowedActions: ['synthetic-fixture'], links: taskLinks(record, input, includeRecentLinks), budget: 0, timeoutMs: 120000, dependencies: [] }
}
function respond(repo, owner, record) {
  const current = repo.get(owner, record.id)
  if (current.revision !== record.revision) return current
  if (!record.pendingRoute || record.paused || record.status !== 'active' || record.turn?.status === 'speaking') return record
  const agent = record.participants.find(item => item.id === record.pendingRoute.agentId)
  if (!agent) return record
  const result = record.pendingRoute.reportTaskId ? record.tasks.find(task => task.id === record.pendingRoute.reportTaskId)?.result : null
  const text = result ?? (record.language === 'ar'
    ? `[عرض تجريبي مصطنع] أنا ${agent.name}. تم تسجيل رسالتك. لا يوجد نموذج أو موظف مباشر متصل. استخدم أدوات البحث والخطة لاختبار سير الاجتماع.`
    : `[SYNTHETIC DEMONSTRATION] ${agent.name}: your message is recorded. No live model or employee is connected. Use the research and plan controls to test the meeting flow.`)
  const meta = { actorId: record.chairId, kind: 'coordinator' }
  let next = applyCommand(record, { type: 'agent-start', agentId: agent.id, turnId: randomUUID() }, meta)
  next = applyCommand(next, { type: 'agent-contribution', agentId: agent.id, turnId: next.turn.id, generation: next.generation, text }, meta)
  return repo.save(owner, next, { expectedRevision: record.revision })
}
export function demoCommand(filename, owner, input) {
  if (!input || typeof input !== 'object' || typeof input.requestId !== 'string' || !/^[a-f0-9-]{36}$/i.test(input.requestId) || !input.command || typeof input.command !== 'object') throw new Error('invalid-request')
  const repo = repository(filename), command = input.command
  let record
  if (command.type === 'start') {
    if (!Array.isArray(command.participantIds) || command.participantIds.length > 32 || !command.participantIds.includes('AG-CEO-001')) throw new Error('chair-required')
    const selected = new Set(command.participantIds)
    if (selected.size !== command.participantIds.length || command.participantIds.some(id => !demonstrationRegistry.some(row => row.id === id))) throw new Error('unknown-participant')
    // Include the actual reporting chain, never derive authority from selection.
    for (const row of demonstrationRegistry) if (selected.has(row.id)) {
      const supervisor = demonstrationRegistry.find(candidate => candidate.name === row.supervisorName)
      if (supervisor) selected.add(supervisor.id)
    }
    const participants = demonstrationRegistry.filter(row => selected.has(row.id)).map(row => ({ id: row.id, name: row.name, role: row.role, registryReference: `${row.source.url}#${row.source.version}`, supervisorId: demonstrationRegistry.find(candidate => candidate.name === row.supervisorName)?.id ?? null, allowedTools: ['synthetic-fixture'], qualified: false }))
    // A retry with the same UUID returns the original meeting, never a second one.
    try { record = repo.get(owner, input.requestId) }
    catch (error) { if (error.code !== 'meeting-not-found') throw error }
    if (record) {
      if (record.title !== command.title.trim() || record.language !== command.language || JSON.stringify(record.participants.map(item => item.id)) !== JSON.stringify(participants.map(item => item.id))) throw new Error('request-conflict')
    }
    else record = repo.create(owner, createMeeting({ id: input.requestId, founderId: owner, title: command.title, language: command.language, participants, mode: 'demonstration' }))
  }
  else {
    if (typeof input.meetingId !== 'string') throw new Error('meeting-required')
    record = repo.get(owner, input.meetingId)
    const save = value => { record = repo.command(owner, record.id, value, { requestId: input.requestId }); return record }
    switch (command.type) {
      case 'text': save({ type: 'utterance', text: command.text, ...(command.addressedTo ? { addressedTo: command.addressedTo } : {}), source: 'text', final: true }); record = respond(repo, owner, record); break
      case 'chat': {
        const links = String(command.text).match(/https?:\/\/[^\s<>]+/g) ?? []
        if (links.length > 1) throw new Error('share-one-public-link')
        save(links.length ? { type: 'share-link', url: safeSharedUrl(links[0]), text: String(command.text).slice(0, 2000) } : { type: 'chat', text: command.text }); break
      }
      case 'language': save({ type: 'language', language: command.language }); break
      case 'interrupt': save({ type: 'interrupt' }); break
      case 'invite': {
        const task = record.tasks.find(task => task.agentId === command.agentId && task.status === 'completed' && !task.reportedAt)
        save({ type: 'grant-floor', agentId: command.agentId, ...(task ? { taskId: task.id } : {}) }); record = respond(repo, owner, record); break
      }
      case 'research': save({ type: 'research', task: taskFor(record, command, input.requestId) }); break
      case 'draftPlan': {
        const task = taskFor(record, { agentId: command.ownerId, question: command.objective, deliverable: command.deliverable }, `task:${input.requestId}`, false)
        const prior = record.plans.at(-1)
        const proposal = { type: prior?.status === 'revised' ? 'revise-plan' : 'propose-plan', planId: prior?.status === 'revised' ? prior.id : input.requestId, title: command.title, summary: 'Synthetic scoped fixture. No live execution is enabled.', tasks: [{ ...task, objective: task.question, owner: task.agentId, supervisor: task.supervisorId, inputs: ['Disposable synthetic meeting fixture'], acceptanceCriteria: ['Persist a clearly marked synthetic deliverable with evidence and independent review'], requiredReview: [...new Set([task.supervisorId, record.chairId])], blockers: [], priority: 'normal', executionEnvironment: 'synthetic-fixture' }] }
        save(proposal)
        const plan = record.plans.at(-1)
        record = repo.command(owner, record.id, { type: 'submit-plan', planId: plan.id, version: plan.version, hash: plan.hash }, { requestId: `${input.requestId}:submit` })
        break
      }
      case 'plan': {
        const plan = record.plans.at(-1)
        if (!plan) throw new Error('plan-required')
        const decision = command.decision.startsWith('approve') ? 'approve' : command.decision
        save({ type: 'decision', planId: plan.id, version: command.version, hash: command.digest, decision, start: command.decision === 'approve-on-end' ? 'meeting-end' : command.decision === 'approve-now' ? 'now' : 'manual', source: 'control', confirmed: true }); break
      }
      case 'end': save({ type: 'end', intentional: true }); break
      case 'close': save({ type: 'connection', state: 'disconnected' }); break
      case 'reconnect': save({ type: 'connection', state: 'connected' }); break
      case 'playback-ended': save({ type: 'speech-ended', turnId: command.turnId, generation: command.generation }); break
      case 'cancelTask': save({ type: 'cancel-task', taskId: command.taskId }); break
      default: throw new Error('unsupported-meeting-command')
    }
  }
  return demoSnapshot(filename, owner, record.id)
}
