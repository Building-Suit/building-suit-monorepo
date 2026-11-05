import assert from 'node:assert/strict'
import { test } from 'node:test'
import { parseLiveRoster, parseLiveMeetingSnapshot, buildLiveMeetingRequest, buildLivePlanSubmission } from '../../shared/meetings/livePresentation.mjs'

const stamp = '2026-11-05T12:00:00.000Z'
const uid = number => `10000000-0000-4000-8000-${String(number).padStart(12, '0')}`
const hash = 'a'.repeat(64)
const rosterPayload = { observedAt: stamp, participants: [
  { id: 'AG-CEO-001', name: 'Steve', role: 'CEO', supervisorId: null, qualified: true, allowedTools: ['read-approved-sources'], registryReference: 'actual-source:ceo:v1' },
  { id: 'AG-HR-001', name: 'Amaya', role: 'HR', supervisorId: 'AG-CEO-001', qualified: true, allowedTools: ['read-approved-sources'], registryReference: 'actual-source:hr:v1' },
  { id: 'AG-HR-002', name: 'Noah', role: 'Recruiter', supervisorId: 'AG-HR-001', qualified: true, allowedTools: ['read-approved-sources'], registryReference: 'actual-source:recruiter:v1' },
] }
const roster = parseLiveRoster(rosterPayload)
const planTask = { id: 'task-key', objective: 'Inspect approved source evidence', ownerId: 'AG-HR-002', supervisorId: 'AG-HR-001', deliverable: 'A bounded evidence report', inputs: [], dependencies: [], allowedActions: ['read-approved-sources'], budget: 0, acceptanceCriteria: ['Cite actual source evidence'], requiredReview: 'independent', blockers: [], priority: 3, environment: 'hq-existing-worker', timeLimitSeconds: 600, timeoutScope: 'worker-job' }
const planRow = (overrides = {}) => ({ meeting_id: uid(1), plan_id: uid(10), version: 1, document: { title: 'Reviewed scope', tasks: [structuredClone(planTask)] }, digest: hash, status: 'awaiting-approval', approved_by: null, approved_at: null, start_policy: null, created_at: stamp, ...overrides })
function snapshot() {
  return { meeting: { id: uid(1), founder_id: uid(2), title: 'الاجتماع', language: 'ar', status: 'active', connection: 'connected', participants: roster.map(person => person.id), floor: 'AG-CEO-001', generation: 3, paused: false, revision: 7, created_at: stamp, ended_at: null },
    events: [{ id: 1, kind: 'text', actor_id: uid(2), payload: { type: 'text', text: 'ناقش الأدلة', uncertain: false }, created_at: stamp }], plans: [], tasks: [],
    contributions: [{ id: uid(3), meeting_id: uid(1), generation: 3, agent_id: 'AG-CEO-001', source_event_id: 1, job_id: uid(4), business_task_id: null, founder_message_id: uid(5), response_message_id: null, response_artifact_id: null, response_digest: null, response_text: null, status: 'thinking', error: null, created_at: stamp, completed_at: null }],
    turn: { id: uid(3), agentId: 'AG-CEO-001', generation: 3, status: 'thinking', language: 'ar', text: null }, executionBackend: 'hq-business-tasks' }
}
function ready(value = snapshot()) {
  Object.assign(value.contributions[0], { status: 'speaking', response_text: 'Actual persisted CEO reply', response_digest: hash, response_message_id: uid(6) })
  Object.assign(value.turn, { status: 'speaking', text: 'This uncorrelated field must not become the reply' })
  return value
}

test('canonical roster qualification stays explicit; registry names do not imply readiness', () => {
  const input = structuredClone(rosterPayload)
  input.participants[2].qualified = false
  const result = parseLiveRoster(input)
  assert.equal(result[2].qualifiedForLiveMeeting, false)
  assert.equal(result[2].supervisorName, 'Amaya')
  assert.throws(() => parseLiveRoster({ ...input, participants: [input.participants[0], input.participants[0]] }), /roster/)
  assert.throws(() => parseLiveRoster({ ...input, participants: [{ ...input.participants[0], qualified: undefined }] }), /roster/)
})

test('pending and failed actual queue outputs produce honest states without invented replies', () => {
  const pending = parseLiveMeetingSnapshot(snapshot(), roster)
  assert.equal(pending.mode, 'live')
  assert.equal(pending.turn.status, 'thinking')
  assert.equal(pending.participants[0].status, 'thinking')
  assert.equal(pending.events.filter(event => event.type === 'agent-contribution').length, 0)
  const failed = snapshot()
  failed.contributions[0].status = 'failed'
  failed.contributions[0].error = 'actual-stage-failure'
  failed.turn = null
  const result = parseLiveMeetingSnapshot(failed, roster)
  assert.equal(result.turn, null)
  assert.equal(result.participants[0].status, 'failed')
  assert.deepEqual(result.liveContributionErrors, [{ agentId: 'AG-CEO-001', error: 'actual-stage-failure' }])
  assert.equal(result.events.some(event => event.type === 'agent-contribution'), false)
})

test('only correlated persisted output supplies transcript and the one current floor', () => {
  const value = ready()
  value.contributions.push({ ...value.contributions[0], id: uid(7), agent_id: 'AG-HR-001', response_text: 'Another persisted reply', business_task_id: uid(8), response_artifact_id: uid(9), founder_message_id: null, response_message_id: null })
  const result = parseLiveMeetingSnapshot(value, roster)
  assert.equal(result.turn.id, uid(3))
  assert.equal(result.events.find(event => event.id === result.turn.contributionEventId).data.text, 'Actual persisted CEO reply')
  assert.equal(result.participants.filter(person => person.status === 'speaking').length, 1)
  assert.equal(result.events.some(event => event.data.text === value.turn.text), false)
  value.contributions[0].response_message_id = null
  const missingCorrelation = parseLiveMeetingSnapshot(value, roster)
  assert.equal(missingCorrelation.turn, null)
  assert.equal(missingCorrelation.events.some(event => event.actorId === 'AG-CEO-001' && event.type === 'agent-contribution'), false)
})

test('stale, ended, disconnected and paused outputs cannot obtain audible floor', () => {
  for (const mutate of [value => value.meeting.generation++, value => value.meeting.status = 'ended', value => value.meeting.connection = 'disconnected', value => value.meeting.paused = true]) {
    const value = ready(); mutate(value)
    const result = parseLiveMeetingSnapshot(value, roster)
    assert.equal(result.turn, null)
    assert.equal(result.participants.some(person => person.status === 'speaking'), false)
  }
})

test('qualification revoked mid-turn removes audible admission while preserving actual historical text', () => {
  const value = ready()
  assert.equal(parseLiveMeetingSnapshot(value, roster).turn.status, 'speaking')
  const changedRoster = structuredClone(rosterPayload)
  changedRoster.participants[0].qualified = false
  changedRoster.participants[0].allowedTools = []
  const revoked = parseLiveRoster(changedRoster)
  const result = parseLiveMeetingSnapshot(value, revoked)
  assert.equal(result.turn, null)
  assert.equal(result.participants[0].qualified, false)
  assert.equal(result.participants[0].status, 'unavailable')
  assert.equal(result.events.find(event => event.type === 'agent-contribution').data.text, 'Actual persisted CEO reply')
  assert.equal(parseLiveMeetingSnapshot(snapshot(), revoked).turn, null)
})

test('exact plan documents, per-job limits and backend block status remain available', () => {
  const value = snapshot()
  value.plans = [planRow({ status: 'blocked' })]
  const result = parseLiveMeetingSnapshot(value, roster)
  assert.deepEqual(result.livePlanDocuments[`${uid(10)}:1`].tasks[0], planTask)
  assert.equal(result.plans[0].tasks[0].scope, 'hq-existing-worker; 600s worker-job')
  assert.deepEqual(result.liveBlockedPlanIds, [uid(10)])
  value.plans.push(planRow({ version: 2, status: 'draft' }))
  assert.deepEqual(parseLiveMeetingSnapshot(value, roster).liveBlockedPlanIds, [])
})

test('business task completion needs actual independent review receipts to claim reviewed', () => {
  const value = snapshot()
  value.tasks = [{ id: uid(20), kind: 'execution', instruction: planTask, business_status: 'completed', status: 'completed', result: { deliverable: 'Actual task result' }, error: null, hand_raised: true, review_receipts: [], created_at: stamp, updated_at: stamp, reported_at: null }]
  let result = parseLiveMeetingSnapshot(value, roster)
  assert.equal(result.tasks[0].result, 'Actual task result')
  assert.equal(result.tasks[0].reviewStatus, 'pending')
  assert.equal(result.participants.find(person => person.id === 'AG-HR-002').handRaised, true)
  value.tasks[0].delivered_artifact_id = uid(23)
  value.tasks[0].delivered_digest = hash
  value.tasks[0].review_receipts = [{ id: uid(21), kind: 'head-review', agent_id: 'AG-HR-001', digest: hash, accepted: true, input_artifact_id: uid(23), input_digest: hash, created_at: stamp }, { id: uid(22), kind: 'ceo-review', agent_id: 'AG-CEO-001', digest: hash, accepted: true, input_artifact_id: uid(23), input_digest: hash, created_at: stamp }]
  result = parseLiveMeetingSnapshot(value, roster)
  assert.equal(result.tasks[0].reviewStatus, 'accepted')
  value.tasks[0].business_status = 'review'
  assert.equal(parseLiveMeetingSnapshot(value, roster).tasks[0].result, null)
})

test('request adapter requires qualified attendance and never turns ordinary text into approval', () => {
  const context = { requestId: uid(30), roster }
  assert.equal(buildLiveMeetingRequest({ type: 'start', title: 'Meeting', language: 'ar', participantIds: ['AG-CEO-001'] }, context).type, 'create')
  assert.throws(() => buildLiveMeetingRequest({ type: 'start', title: 'Meeting', language: 'ar', participantIds: ['AG-HR-001'] }, context), /unqualified/)
  assert.throws(() => buildLiveMeetingRequest({ type: 'start', title: 'Meeting', language: 'ar', participantIds: ['AG-CEO-001'] }, { ...context, roster: [{ ...roster[0], qualified: false }] }), /unqualified/)
  const request = buildLiveMeetingRequest({ type: 'text', text: 'Approve everything now', addressedTo: 'AG-HR-001' }, { ...context, meetingId: uid(1) })
  assert.deepEqual(request.command, { type: 'text', text: 'Approve everything now', addressedTo: 'AG-HR-001' })
  assert.equal(buildLiveMeetingRequest({ type: 'microphone', active: true }, context), null)
})

test('live text preserves exact founder control phrases and canonical names for authoritative SQL routing', () => {
  const context = { requestId: uid(30), meetingId: uid(1), roster }
  for (const text of ['Stop', 'Everyone pause', 'Continue', 'توقفوا', 'أكمل', 'Amaya, your turn.', '  Steve: keep the original wording.  ', 'Approve this plan now']) {
    const body = buildLiveMeetingRequest({ type: 'text', text }, context)
    assert.deepEqual(body.command, { type: 'text', text })
  }
  const explicit = buildLiveMeetingRequest({ type: 'text', text: 'Steve, ask Amaya.', addressedTo: 'AG-HR-002' }, context)
  assert.deepEqual(explicit.command, { type: 'text', text: 'Steve, ask Amaya.', addressedTo: 'AG-HR-002' })
})

test('bounded Unicode founder text is preserved exactly and malformed or oversized source text fails closed', () => {
  const exact = ` ${'😀'.repeat(3998)} `
  assert.equal([...exact].length, 4000)
  assert.equal(exact.length, 7998)
  const value = snapshot()
  value.events[0].payload.text = exact
  assert.equal(parseLiveMeetingSnapshot(value, roster).events.find(event => event.type === 'founder-utterance').data.text, exact)
  const context = { requestId: uid(30), meetingId: uid(1), roster }
  assert.equal(buildLiveMeetingRequest({ type: 'text', text: exact }, context).command.text, exact)
  for (const invalid of ['😀'.repeat(4001), `retain\uD800`, `\uDC00retain`]) {
    value.events[0].payload.text = invalid
    assert.throws(() => parseLiveMeetingSnapshot(value, roster), /invalid-live-meeting-text/)
    assert.throws(() => buildLiveMeetingRequest({ type: 'text', text: invalid }, context), /invalid-live-meeting-text/)
  }
  const reply = ready()
  reply.contributions[0].response_text = 'Actual prefix\uD800'
  const result = parseLiveMeetingSnapshot(reply, roster)
  assert.equal(result.turn, null)
  assert.equal(result.events.some(event => event.type === 'agent-contribution'), false)
})

test('plan creation and exact submission use only supported source scope and fresh returned digest', () => {
  const context = { requestId: uid(30), meetingId: uid(1), roster }
  const proposal = buildLiveMeetingRequest({ type: 'draftPlan', title: 'Plan', objective: 'Inspect sources', deliverable: 'Report', ownerId: 'AG-HR-002' }, context)
  const task = proposal.command.document.tasks[0]
  assert.deepEqual({ actions: task.allowedActions, environment: task.environment, seconds: task.timeLimitSeconds, timeoutScope: task.timeoutScope, dependencies: task.dependencies, blockers: task.blockers, budget: task.budget }, { actions: ['read-approved-sources'], environment: 'hq-existing-worker', seconds: 600, timeoutScope: 'worker-job', dependencies: [], blockers: [], budget: 0 })
  assert.throws(() => buildLiveMeetingRequest({ type: 'research', agentId: 'AG-CEO-001', question: 'Inspect' }, context), /owner-unqualified/)
  const value = snapshot(); value.plans = [planRow({ status: 'draft' })]
  const record = parseLiveMeetingSnapshot(value, roster)
  assert.deepEqual(buildLivePlanSubmission(record, uid(31)).command, { type: 'submitPlan', planId: uid(10), version: 1, digest: hash })
})

test('decision and revision controls bind exact current whole-plan version and digest', () => {
  const value = snapshot(); value.plans = [planRow()]
  const record = parseLiveMeetingSnapshot(value, roster), context = { requestId: uid(30), record, roster }
  const approved = buildLiveMeetingRequest({ type: 'plan', decision: 'approve-on-end', version: 1, digest: hash }, context)
  assert.deepEqual(approved.command, { type: 'decidePlan', planId: uid(10), version: 1, digest: hash, decision: 'approved', start: 'meeting-end', source: 'control', confirmed: true })
  assert.throws(() => buildLiveMeetingRequest({ type: 'plan', decision: 'approve-now', version: 2, digest: hash }, context), /version-changed/)
  const revise = buildLiveMeetingRequest({ type: 'plan', decision: 'revise', version: 1, digest: hash }, context)
  assert.equal(revise.command.type, 'proposePlan')
  assert.deepEqual(revise.command.document, value.plans[0].document)
})


test('transient contribution jobs stay separate from durable business findings', () => {
  const value = snapshot()
  value.tasks = [{ kind: 'contribution', instruction: { objective: 'An actual queued response draft' } }]
  assert.deepEqual(parseLiveMeetingSnapshot(value, roster).tasks, [])
  value.executionBackend = 'synthetic-fixture'
  assert.throws(() => parseLiveMeetingSnapshot(value, roster), /backend/)
})


test('mocked request flow submits only the returned immutable draft and waits for explicit approval', async () => {
  const sent = [], actualDigest = 'b'.repeat(64)
  const transport = async body => {
    sent.push(structuredClone(body))
    const value = snapshot()
    value.meeting.revision = 10 + sent.length
    value.plans = [planRow({ plan_id: uid(30), version: 4, digest: actualDigest, status: body.command.type === 'submitPlan' ? 'awaiting-approval' : 'draft' })]
    return value
  }
  const draft = buildLiveMeetingRequest({ type: 'draftPlan', title: 'Edited plan', objective: 'Inspect actual approved sources', deliverable: 'Source evidence', ownerId: 'AG-HR-002' }, { requestId: uid(30), meetingId: uid(1), roster })
  let record = parseLiveMeetingSnapshot(await transport(draft), roster)
  const editedAgain = buildLiveMeetingRequest({ type: 'draftPlan', title: 'Second edit', objective: 'Inspect sources', deliverable: 'Report', ownerId: 'AG-HR-002' }, { requestId: uid(31), record, roster })
  assert.equal(editedAgain.command.planId, uid(30))
  const submission = buildLivePlanSubmission(record, uid(32))
  assert.equal(submission.command.digest, actualDigest)
  assert.equal(submission.command.version, 4)
  record = parseLiveMeetingSnapshot(await transport(submission), roster)
  assert.deepEqual(sent.map(body => body.command.type), ['proposePlan', 'submitPlan'])
  const decision = buildLiveMeetingRequest({ type: 'plan', decision: 'approve-now', version: 4, digest: actualDigest }, { requestId: uid(33), record, roster })
  assert.equal(decision.command.type, 'decidePlan')
  assert.equal(decision.command.digest, actualDigest)
  assert.equal(decision.command.confirmed, true)
})


test('submission targets its proposed plan even when another plan is globally newer', () => {
  const value = snapshot()
  value.plans = [planRow({ status: 'draft', version: 2 }), planRow({ plan_id: uid(11), status: 'draft', version: 1, created_at: '2026-11-05T12:01:00.000Z', digest: 'b'.repeat(64) })]
  const record = parseLiveMeetingSnapshot(value, roster)
  assert.deepEqual(buildLivePlanSubmission(record, uid(30), uid(10)).command, { type: 'submitPlan', planId: uid(10), version: 2, digest: hash })
  assert.throws(() => buildLivePlanSubmission(record, uid(30), uid(99)), /not-draft/)
  value.plans[0].status = 'awaiting-approval'
  const retried = parseLiveMeetingSnapshot(value, roster)
  assert.equal(retried.plans.find(plan => plan.id === uid(10)).status, 'awaiting-approval')
  assert.throws(() => buildLivePlanSubmission(retried, uid(30), uid(10)), /not-draft/)
})


test('rejected repair history and unverified review outputs never become current acceptance', () => {
  const value = snapshot()
  const oldArtifact = uid(40), currentArtifact = uid(41), currentDigest = 'b'.repeat(64)
  const receipt = (id, kind, agent, accepted, artifactId = currentArtifact, inputDigest = currentDigest) => ({ id: uid(id), kind, agent_id: agent, digest: hash, accepted, input_artifact_id: artifactId, input_digest: inputDigest, created_at: stamp })
  const task = { id: uid(20), kind: 'execution', instruction: planTask, business_status: 'completed', result: { deliverable: 'Current repaired deliverable' }, error: null, hand_raised: true, created_at: stamp, updated_at: stamp, delivered_artifact_id: currentArtifact, delivered_digest: currentDigest,
    review_receipts: [receipt(42, 'head-review', 'AG-HR-001', false, oldArtifact, hash), receipt(43, 'ceo-review', 'AG-CEO-001', null)] }
  value.tasks = [task]
  let result = parseLiveMeetingSnapshot(value, roster).tasks[0]
  assert.equal(result.reviewStatus, 'pending')
  assert.deepEqual(result.reviews.map(review => review.decision), ['rejected'])
  task.review_receipts.push(receipt(44, 'head-review', 'AG-HR-001', true, oldArtifact, hash), receipt(45, 'ceo-review', 'AG-CEO-001', true, oldArtifact, hash))
  assert.equal(parseLiveMeetingSnapshot(value, roster).tasks[0].reviewStatus, 'pending')
  task.review_receipts.push(receipt(46, 'head-review', 'AG-HR-001', true), receipt(47, 'ceo-review', 'AG-CEO-001', false))
  assert.equal(parseLiveMeetingSnapshot(value, roster).tasks[0].reviewStatus, 'rejected')
  task.review_receipts.push(receipt(48, 'ceo-review', 'AG-CEO-001', true))
  result = parseLiveMeetingSnapshot(value, roster).tasks[0]
  assert.equal(result.reviewStatus, 'accepted')
  assert.equal(result.reviews.filter(review => review.decision === 'rejected').length, 2)
  task.delivered_digest = 'c'.repeat(64)
  assert.equal(parseLiveMeetingSnapshot(value, roster).tasks[0].reviewStatus, 'pending')
})
