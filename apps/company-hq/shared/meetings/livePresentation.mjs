/** Pure, browser-safe projection of the existing HQ meeting RPC contract. */
const agentPattern = /^AG-[A-Z]+-[0-9]{3}$/
const uuidPattern = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i
const digestPattern = /^[a-f0-9]{64}$/i
const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key)
function object(value) { if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('invalid-live-meeting-object'); return value }
function boundedText(value, maximum) {
  if (typeof value !== 'string' || !value.trim()) return false
  let length = 0
  for (const character of value) {
    // PostgreSQL text limits count Unicode characters and reject unpaired
    // surrogates. Preserve exact source text rather than truncating UTF-16.
    const code = character.charCodeAt(0)
    if ((character.length === 1 && code >= 0xD800 && code <= 0xDFFF) || ++length > maximum) return false
  }
  return true
}
function string(value, maximum = 4000) { if (!boundedText(value, maximum)) throw new Error('invalid-live-meeting-text'); return value }
function optionalString(value, maximum = 4000) { return value == null ? null : string(value, maximum) }
function integer(value, minimum = 0) { if (!Number.isSafeInteger(value) || value < minimum) throw new Error('invalid-live-meeting-number'); return value }
function list(value, maximum = 200) { if (!Array.isArray(value) || value.length > maximum) throw new Error('invalid-live-meeting-list'); return value }
function strings(value, maximum = 32) { return list(value, maximum).map(item => string(item, 2000)) }
function uuid(value) { const result = string(value, 36); if (!uuidPattern.test(result)) throw new Error('invalid-live-meeting-id'); return result }
function agentId(value) { const result = string(value, 40); if (!agentPattern.test(result)) throw new Error('invalid-live-meeting-agent'); return result }
function digest(value) { const result = string(value, 64); if (!digestPattern.test(result)) throw new Error('invalid-live-meeting-digest'); return result }
function date(value) { const result = string(value, 64); if (!Number.isFinite(Date.parse(result))) throw new Error('invalid-live-meeting-date'); return result }
function enumeration(value, options) { if (!options.includes(value)) throw new Error('invalid-live-meeting-state'); return value }
function eventId(value) { if ((typeof value !== 'string' && typeof value !== 'number') || !/^\d+$/.test(String(value))) throw new Error('invalid-live-meeting-event'); return String(value) }

export function parseLiveRoster(value) {
  const raw = object(value), observedAt = date(raw.observedAt)
  const rows = list(raw.participants, 32), seen = new Set()
  const result = rows.map(input => {
    const row = object(input), id = agentId(row.id)
    if (seen.has(id) || typeof row.conversationAvailable !== 'boolean' || typeof row.workQualified !== 'boolean'
      || (own(row, 'qualified') && row.qualified !== row.workQualified)) throw new Error('invalid-live-meeting-roster')
    seen.add(id)
    const reference = string(row.registryReference, 2000), allowedTools = strings(row.allowedTools ?? [], 16)
    if (row.workQualified && !allowedTools.includes('read-approved-sources')) throw new Error('invalid-live-meeting-roster-scope')
    return { id, name: string(row.name, 200), role: string(row.role, 200), supervisorId: row.supervisorId == null ? null : agentId(row.supervisorId),
      conversationAvailable: row.conversationAvailable, workQualified: row.workQualified,
      qualified: row.workQualified, qualifiedForLiveMeeting: row.workQualified, allowedTools: row.workQualified ? allowedTools : [], registryReference: reference,
      supervisorName: '', lifecycle: row.conversationAvailable ? 'configured' : 'unavailable',
      operation: row.workQualified ? 'Context-only conversation; separately qualified read-only work' : row.conversationAvailable ? 'Context-only conversation; research and execution unavailable' : 'Conversation unavailable', source: { id: reference, version: observedAt } }
  })
  for (const row of result) {
    if (row.supervisorId) row.supervisorName = result.find(item => item.id === row.supervisorId)?.name ?? row.supervisorId
  }
  return result
}

function planDocument(input) {
  const document = object(input)
  const tasks = list(document.tasks, 16).map(input => {
    const task = object(input)
    const priority = integer(task.priority, 1), timeLimitSeconds = integer(task.timeLimitSeconds, 1)
    if (priority > 5 || timeLimitSeconds > 600 || task.budget !== 0 || task.requiredReview !== 'independent') throw new Error('invalid-live-meeting-task-scope')
    return { id: string(task.id, 120), objective: string(task.objective, 2000), ownerId: agentId(task.ownerId), supervisorId: agentId(task.supervisorId), deliverable: string(task.deliverable, 2000),
      inputs: strings(task.inputs), dependencies: strings(task.dependencies), allowedActions: strings(task.allowedActions, 1), budget: 0,
      acceptanceCriteria: strings(task.acceptanceCriteria), requiredReview: 'independent', blockers: strings(task.blockers), priority,
      environment: enumeration(task.environment, ['qualified-cloud', 'synthetic', 'hq-existing-worker']), timeLimitSeconds,
      ...(own(task, 'timeoutScope') ? { timeoutScope: enumeration(task.timeoutScope, ['worker-job']) } : {}) }
  })
  if (!tasks.length || tasks.some(task => !task.acceptanceCriteria.length || !task.allowedActions.length)) throw new Error('invalid-live-meeting-task-scope')
  if (tasks.some(task => !['read-approved-sources', 'synthetic-fixture'].includes(task.allowedActions[0]))) throw new Error('invalid-live-meeting-task-scope')
  if (new Set(tasks.map(task => task.id)).size !== tasks.length) throw new Error('invalid-live-meeting-task-key')
  return { title: string(document.title, 200), ...(document.summary == null ? {} : { summary: string(document.summary, 4000) }), tasks }
}

function domainPlanTask(task) {
  return { id: task.id, objective: task.objective, owner: task.ownerId, supervisor: task.supervisorId, deliverable: task.deliverable,
    inputs: task.inputs, dependencies: task.dependencies, allowedActions: task.allowedActions, allowedTools: task.allowedActions,
    scope: `${task.environment}; ${task.timeLimitSeconds}s ${task.timeoutScope ?? 'whole-task (unsupported)'}`,
    budget: 0, acceptanceCriteria: task.acceptanceCriteria, requiredReview: [...new Set([task.supervisorId, 'AG-CEO-001'])], blockers: task.blockers,
    priority: task.priority >= 4 ? 'high' : task.priority <= 2 ? 'low' : 'normal', executionEnvironment: task.environment, timeoutMs: task.timeLimitSeconds * 1000 }
}

function correlatedOutput(row) {
  return boundedText(row.response_text, 65536)
    && typeof row.response_digest === 'string' && digestPattern.test(row.response_digest)
    && ((typeof row.response_message_id === 'string' && uuidPattern.test(row.response_message_id) && typeof row.founder_message_id === 'string' && uuidPattern.test(row.founder_message_id))
      || (typeof row.response_artifact_id === 'string' && uuidPattern.test(row.response_artifact_id) && typeof row.business_task_id === 'string' && uuidPattern.test(row.business_task_id)))
}

/** Never synthesizes an agent reply from prompts, queue status, or roster presence. */
export function parseLiveMeetingSnapshot(value, roster) {
  if (value == null) return null
  const raw = object(value)
  if (raw.meeting == null) return null
  if (raw.executionBackend !== 'hq-business-tasks') throw new Error('invalid-live-meeting-backend')
  const meeting = object(raw.meeting), id = uuid(meeting.id), founderId = uuid(meeting.founder_id)
  const language = enumeration(meeting.language, ['ar', 'en']), generation = integer(meeting.generation), status = enumeration(meeting.status, ['active', 'ended'])
  const participantIds = strings(meeting.participants, 16).map(agentId)
  if (!participantIds.includes('AG-CEO-001') || new Set(participantIds).size !== participantIds.length) throw new Error('invalid-live-meeting-participants')
  const people = participantIds.map(id => { const person = roster.find(item => item.id === id); if (!person) throw new Error('live-meeting-roster-missing'); return person })
  const events = list(raw.events ?? [], 4000).map(input => {
    const event = object(input), data = object(event.payload), kind = string(event.kind, 80), actorId = string(event.actor_id, 100)
    return { id: `event:${eventId(event.id)}`, type: kind === 'text' ? 'founder-utterance' : kind === 'chat' ? 'chat-message' : kind,
      category: kind === 'text' ? 'founder-instruction' : kind === 'chat' ? 'reference' : 'meeting-event', actorId, at: date(event.created_at),
      data: kind === 'text' ? { text: string(data.text, 4000), source: 'text', uncertain: data.uncertain === true, ...(data.addressedTo ? { addressedTo: agentId(data.addressedTo) } : {}) }
        : kind === 'chat' ? { text: string(data.text, 4000), speakerId: actorId } : { ...data } }
  })
  const contributions = list(raw.contributions ?? [], 4000).map(input => {
    const row = object(input)
    return { ...row, id: uuid(row.id), meeting_id: uuid(row.meeting_id), generation: integer(row.generation), agent_id: agentId(row.agent_id), source_event_id: eventId(row.source_event_id),
      status: enumeration(row.status, ['thinking', 'speaking', 'completed', 'interrupted', 'failed', 'blocked']), created_at: date(row.created_at) }
  }).filter(row => row.meeting_id === id && participantIds.includes(row.agent_id))
  for (const row of contributions) {
    if (!['speaking', 'completed', 'interrupted'].includes(row.status) || !correlatedOutput(row)) continue
    events.push({ id: `contribution:${row.id}`, type: 'agent-contribution', category: 'agent-contribution', actorId: row.agent_id, at: row.created_at,
      data: { agentId: row.agent_id, turnId: row.id, generation: row.generation, text: row.response_text, language, sourceEventId: `event:${row.source_event_id}`, source: 'correlated-worker-output', responseDigest: row.response_digest } })
  }
  events.sort((first, second) => Date.parse(first.at) - Date.parse(second.at) || first.id.localeCompare(second.id))
  const livePlanDocuments = {}, blockedVersions = new Map()
  const plans = list(raw.plans ?? [], 64).map(input => {
    const row = object(input), planId = uuid(row.plan_id), version = integer(row.version, 1), document = planDocument(row.document)
    const state = enumeration(row.status, ['draft', 'awaiting-approval', 'approved', 'dispatched', 'revised', 'deferred', 'discarded', 'blocked'])
    livePlanDocuments[`${planId}:${version}`] = document
    if (!blockedVersions.has(planId) || blockedVersions.get(planId).version < version) blockedVersions.set(planId, { version, blocked: state === 'blocked' })
    const approved = row.approved_by != null
    return { id: planId, version, title: document.title, summary: document.summary ?? '', tasks: document.tasks.map(domainPlanTask), hash: digest(row.digest),
      status: state === 'blocked' ? 'deferred' : state,
      approval: approved ? { actorId: uuid(row.approved_by), at: date(row.approved_at), version, hash: digest(row.digest), start: enumeration(row.start_policy, ['now', 'meeting-end', 'manual']) } : null,
      createdAt: date(row.created_at), sourceEventIds: [] }
  })
  plans.sort((first, second) => Date.parse(first.createdAt) - Date.parse(second.createdAt) || first.version - second.version)
  const liveBlockedPlanIds = [...blockedVersions].filter(([, value]) => value.blocked).map(([id]) => id)
  const tasks = list(raw.tasks ?? [], 256).filter(input => object(input).kind !== 'contribution').map(input => {
    const row = object(input), taskId = uuid(row.id), instruction = planDocument({ title: 'Task scope', tasks: [row.instruction] }).tasks[0]
    const businessStatus = enumeration(row.business_status, ['queued', 'working', 'review', 'completed', 'blocked', 'canceled'])
    const taskStatus = businessStatus === 'working' || businessStatus === 'review' ? 'running' : businessStatus === 'blocked' ? 'failed' : businessStatus === 'canceled' ? 'cancelled' : businessStatus
    const expectedReview = [...new Set([instruction.supervisorId, 'AG-CEO-001'])]
    const expectedStages = instruction.supervisorId === 'AG-HR-001'
      ? [{ kind: 'head-review', agentId: 'AG-HR-001' }, { kind: 'ceo-review', agentId: 'AG-CEO-001' }]
      : [{ kind: 'ceo-review', agentId: 'AG-CEO-001' }]
    const receiptRows = list(row.review_receipts ?? [], 32).flatMap(input => {
      const review = object(input)
      if (!expectedStages.some(stage => stage.kind === review.kind && stage.agentId === review.agent_id) || review.agent_id === instruction.ownerId
        || typeof review.accepted !== 'boolean' || !uuidPattern.test(review.id ?? '') || !digestPattern.test(review.digest ?? '')
        || !uuidPattern.test(review.input_artifact_id ?? '') || !digestPattern.test(review.input_digest ?? '') || !review.created_at) return []
      return [{ ...review, created_at: date(review.created_at) }]
    })
    const reviews = receiptRows.map(review => ({ reviewerId: review.agent_id, decision: review.accepted ? 'accepted' : 'rejected', note: review.digest, at: review.created_at, sourceEventId: review.id }))
    const delivered = uuidPattern.test(row.delivered_artifact_id ?? '') && digestPattern.test(row.delivered_digest ?? '')
    const currentReceipts = delivered ? receiptRows.filter(review => review.input_artifact_id === row.delivered_artifact_id && review.input_digest === row.delivered_digest) : []
    const reviewed = businessStatus === 'completed' && typeof row.result?.deliverable === 'string' && row.result.deliverable.trim()
      && expectedStages.every(stage => currentReceipts.some(review => review.kind === stage.kind && review.agent_id === stage.agentId && review.accepted))
    const rejected = currentReceipts.some(review => !review.accepted)
    return { id: taskId, meetingId: id, kind: enumeration(row.kind, ['research', 'execution']), agentId: instruction.ownerId, supervisorId: instruction.supervisorId,
      question: instruction.objective, scope: domainPlanTask(instruction).scope, allowedTools: instruction.allowedActions, allowedActions: instruction.allowedActions, links: [], deliverable: instruction.deliverable,
      // These neutral domain bookkeeping fields do not attest host capacity,
      // retry behavior or an end-to-end task deadline. Only instruction scope
      // and actual source statuses are projected to the product interface.
      budget: 0, timeoutMs: instruction.timeLimitSeconds * 1000, dependencies: instruction.dependencies, resourceLimits: { concurrency: 1, maxOutputBytes: 65536 }, status: taskStatus,
      generation: 0, attempt: 0, maxAttempts: 1, createdAt: date(row.created_at), startedAt: null, completedAt: businessStatus === 'completed' ? date(row.updated_at) : null,
      cancellationRequested: businessStatus === 'canceled', evidence: [], result: businessStatus === 'completed' && row.result?.deliverable ? string(row.result.deliverable, 65536) : null,
      error: optionalString(row.error, 4000), requiredReview: expectedReview, reviews, reviewStatus: reviewed ? 'accepted' : rejected ? 'rejected' : 'pending',
      ...(row.plan_id ? { planId: uuid(row.plan_id), planVersion: integer(row.plan_version, 1) } : {}),
      ...(row.reported_at ? { reportEventId: `reported:${taskId}` } : {}), liveHandRaised: businessStatus === 'completed' && row.hand_raised === true }
  })
  let turn = null
  if (raw.turn != null) {
    const candidate = object(raw.turn)
    const row = contributions.find(item => item.id === candidate.id && item.agent_id === candidate.agentId && item.generation === candidate.generation && item.generation === generation)
    if (row && people.some(person => person.id === row.agent_id && person.conversationAvailable) && status === 'active' && meeting.connection === 'connected' && meeting.paused === false && meeting.floor === row.agent_id) {
      if (row.status === 'thinking' && candidate.status === 'thinking') turn = { id: row.id, agentId: row.agent_id, generation, language, status: 'thinking', sourceEventId: `event:${row.source_event_id}`, reportTaskId: row.business_task_id ?? null }
      else if (row.status === 'speaking' && candidate.status === 'speaking' && correlatedOutput(row)) turn = { id: row.id, agentId: row.agent_id, generation, language, status: 'speaking', sourceEventId: `event:${row.source_event_id}`, reportTaskId: row.business_task_id ?? null, contributionEventId: `contribution:${row.id}` }
    }
  }
  const participants = people.map(person => {
    const current = contributions.filter(row => row.agent_id === person.id && row.generation === generation).at(-1)
    const handRaised = tasks.some(task => task.agentId === person.id && task.liveHandRaised)
    const activity = !person.conversationAvailable ? 'unavailable' : turn?.agentId === person.id ? turn.status : current && ['failed', 'blocked'].includes(current.status) ? 'failed' : handRaised ? 'hand-raised' : tasks.some(task => task.agentId === person.id && task.status === 'running') ? 'researching' : 'listening'
    return { id: person.id, name: person.name, role: person.role, supervisorId: person.supervisorId, registryReference: person.registryReference, qualified: person.workQualified,
      conversationAvailable: person.conversationAvailable, workQualified: person.workQualified,
      allowedTools: person.allowedTools, status: activity, handRaised, voice: { agentId: person.id, provider: 'browser-local', voiceId: null, languages: [language], available: false, fallback: 'none' } }
  })
  const floor = meeting.floor === 'founder' || meeting.floor === founderId ? { kind: 'founder' } : participantIds.includes(meeting.floor) ? { kind: 'agent', agentId: meeting.floor } : { kind: 'unassigned' }
  return { id, founderId, title: string(meeting.title, 200), mode: 'live', chairId: 'AG-CEO-001', language, dialect: null, status,
    connection: meeting.connection === 'ended' ? 'disconnected' : enumeration(meeting.connection, ['connected', 'disconnected']), disconnectPolicy: 'hold', participants, floor,
    paused: meeting.paused === true, generation, turn, pendingRoute: null, interruptedTurn: null, revision: integer(meeting.revision, 1), events, tasks, plans,
    dispatches: [], commandReceipts: [], createdAt: date(meeting.created_at), endedAt: meeting.ended_at == null ? null : date(meeting.ended_at), livePlanDocuments, liveBlockedPlanIds,
    liveContributionErrors: contributions.filter(row => ['failed', 'blocked'].includes(row.status) && row.generation === generation).map(row => ({ agentId: row.agent_id, error: typeof row.error === 'string' ? row.error : row.status })) }
}

function scopedTask(context, ownerId, objective, deliverable) {
  const owner = context.roster?.find(person => person.id === ownerId)
  if (!owner?.workQualified || !owner.supervisorId || !context.roster.some(person => person.id === owner.supervisorId && person.workQualified) || !context.roster.some(person => person.id === 'AG-CEO-001' && person.workQualified)) throw new Error('live-meeting-owner-unqualified')
  return { id: context.requestId, objective: string(objective, 2000), ownerId: owner.id, supervisorId: owner.supervisorId, deliverable: string(deliverable, 2000),
    inputs: [], dependencies: [], allowedActions: ['read-approved-sources'], budget: 0, acceptanceCriteria: [string(deliverable, 2000)], requiredReview: 'independent', blockers: [], priority: 3,
    environment: 'hq-existing-worker', timeLimitSeconds: 600, timeoutScope: 'worker-job' }
}

/** Only supported, explicit semantic controls become live RPC commands. */
export function buildLiveMeetingRequest(command, context) {
  const requestId = uuid(context.requestId)
  if (['draft', 'newMeeting', 'microphone', 'mute', 'voice', 'refresh', 'recognitionMode', 'recheckMicrophone', 'prepareRecognition'].includes(command.type)) return null
  if (command.type === 'start') {
    const participantIds = strings(command.participantIds, 16).map(agentId)
    if (!participantIds.includes('AG-CEO-001') || new Set(participantIds).size !== participantIds.length || participantIds.some(id => !context.roster?.some(person => person.id === id && person.conversationAvailable))) throw new Error('live-meeting-conversation-unavailable')
    return { type: 'create', requestId, title: string(command.title, 200), language: enumeration(command.language, ['ar', 'en']), participantIds }
  }
  const meetingId = uuid(context.meetingId ?? context.record?.id)
  let mapped
  if (command.type === 'text' || command.type === 'chat') mapped = { type: command.type, text: string(command.text, 4000), ...(command.addressedTo ? { addressedTo: agentId(command.addressedTo) } : {}) }
  else if (command.type === 'language') mapped = { type: 'language', language: enumeration(command.language, ['ar', 'en']) }
  else if (['interrupt', 'end', 'reconnect'].includes(command.type)) mapped = { type: command.type }
  else if (command.type === 'close') mapped = { type: 'disconnect' }
  else if (command.type === 'cancelTask') mapped = { type: 'cancelTask', taskId: uuid(command.taskId) }
  else if (command.type === 'playback-ended') mapped = { type: 'playback-ended', turnId: uuid(command.turnId), generation: integer(command.generation) }
  else if (command.type === 'invite') mapped = { type: 'invite', agentId: agentId(command.agentId) }
  else if (command.type === 'research') mapped = { type: 'research', task: scopedTask(context, command.agentId, command.question, command.question) }
  else if (command.type === 'draftPlan') {
    const prior = context.record?.plans.at(-1)
    const planId = prior && ['draft', 'revised'].includes(prior.status) ? prior.id : requestId
    mapped = { type: 'proposePlan', planId, document: { title: string(command.title, 200), tasks: [scopedTask(context, command.ownerId, command.objective, command.deliverable)] } }
  }
  else if (command.type === 'plan') {
    const plan = context.record?.plans.at(-1)
    if (!plan || plan.version !== command.version || plan.hash !== command.digest) throw new Error('live-meeting-plan-version-changed')
    if (command.decision === 'revise') {
      const document = context.record.livePlanDocuments[`${plan.id}:${plan.version}`]
      if (!document) throw new Error('live-meeting-plan-document-missing')
      mapped = { type: 'proposePlan', planId: plan.id, document }
    }
    else mapped = { type: 'decidePlan', planId: plan.id, version: plan.version, digest: plan.hash,
      decision: command.decision.startsWith('approve') ? 'approved' : command.decision === 'defer' ? 'deferred' : command.decision === 'discard' ? 'discarded' : enumeration(command.decision, []),
      start: command.decision === 'approve-now' ? 'now' : command.decision === 'approve-on-end' ? 'meeting-end' : 'manual', source: 'control', confirmed: true }
  }
  else return null
  return { type: 'command', requestId, meetingId, command: mapped }
}

export function buildLivePlanSubmission(record, requestId, planId) {
  const plan = record?.plans.filter(item => planId === undefined || item.id === planId).at(-1)
  if (!plan || plan.status !== 'draft') throw new Error('live-meeting-plan-not-draft')
  return { type: 'command', requestId: uuid(requestId), meetingId: uuid(record.id), command: { type: 'submitPlan', planId: plan.id, version: plan.version, digest: plan.hash } }
}
