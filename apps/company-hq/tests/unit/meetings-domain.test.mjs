import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createMeeting, applyCommand, acceptWorkerResult, meetingContext, resolveRecentLink, safeSharedUrl, MeetingError } from '../../shared/meetings/domain.mjs'

const NOW = '2026-11-05T21:30:00.000Z'
const FOUNDER = 'synthetic-founder'
const STEVE = 'AG-CEO-001'
const AMAYA = 'AG-HR-001'
const NOAH = 'AG-HR-002'
let sequence = 0
const meta = (actorId = FOUNDER, kind = 'founder') => ({ actorId, kind, now: NOW, id: `command-${++sequence}` })
const p = (id, name, role, supervisorId, extras = {}) => ({ id, name, role, supervisorId, registryReference: `synthetic-canonical-registry:${id}:v1`, qualified: false, allowedTools: ['public-reference-reader'], ...extras })
const participants = () => [
  p(STEVE, 'Steve', 'CEO', null, { nameAr: 'ستيف', qualified: true }),
  p(AMAYA, 'Amaya', 'HR head', STEVE, { nameAr: 'أمايا' }),
  p(NOAH, 'Noah', 'HR researcher', AMAYA, { nameAr: 'نوح' }),
]
const meeting = extras => createMeeting({ id: `meeting-${++sequence}`, founderId: FOUNDER, title: 'Synthetic Arabic meeting', participants: participants(), ...extras }, meta())
const apply = (state, command, actorId, kind) => applyCommand(state, command, meta(actorId, kind))
const says = (state, text, more = {}) => apply(state, { type: 'utterance', text, final: true, source: 'text', ...more })
const start = (state, agentId = state.pendingRoute.agentId) => apply(state, { type: 'agent-start', agentId, turnId: `turn-${++sequence}` }, STEVE, 'coordinator')
const speaks = (state, text = 'Synthetic contribution') => apply(state, { type: 'agent-contribution', agentId: state.turn.agentId, turnId: state.turn.id, generation: state.generation, text }, STEVE, 'coordinator')
const done = state => apply(state, { type: 'speech-ended', turnId: state.turn.id, generation: state.generation })
const researchInput = (id = `research-${++sequence}`) => ({ id, agentId: NOAH, supervisorId: AMAYA, question: 'Inspect repository capabilities', scope: 'Read documentation and license only; never execute downloaded code', allowedTools: ['public-reference-reader'], allowedActions: ['read-public-reference'], links: ['https://github.com/Building-Suit/building-suit-monorepo'], deliverable: 'Evidence-backed repository report', budget: 0, timeoutMs: 120000, dependencies: [] })
const planInput = (id = 'document-report') => ({ id, objective: 'Prepare the scoped report', owner: NOAH, supervisor: AMAYA, deliverable: 'Synthetic report artifact', inputs: ['meeting finding'], dependencies: [], allowedActions: ['write-disposable-fixture'], allowedTools: [], links: [], budget: 0, acceptanceCriteria: ['Includes evidence and limits'], requiredReview: [AMAYA, STEVE], blockers: [], priority: 'normal', executionEnvironment: 'disposable-synthetic-fixture' })
function draft(state, tasks = [planInput()]) {
  return apply(state, { type: 'propose-plan', planId: `plan-${++sequence}`, title: 'Reviewable scoped plan', summary: 'No spending. Noah writes, Amaya reviews, Steve reports.', tasks })
}
function submit(state) {
  const plan = state.plans.at(-1)
  return apply(state, { type: 'submit-plan', planId: plan.id, version: plan.version, hash: plan.hash })
}
function decide(state, decision = 'approve', start = 'meeting-end', more = {}) {
  const plan = state.plans.at(-1)
  return apply(state, { type: 'decision', planId: plan.id, version: plan.version, hash: plan.hash, decision, source: 'control', confirmed: true, start, ...more })
}
function rejected(action, code) { assert.throws(action, error => error instanceof MeetingError && error.code === code) }

test('meeting takes exact registry identities, Arabic default, unavailable voices and no invented employees', () => {
  const state = meeting()
  assert.deepEqual(state.participants.map(item => item.id), [STEVE, AMAYA, NOAH])
  assert.equal(state.language, 'ar')
  assert.equal(state.mode, 'demonstration')
  assert.equal(state.participants[1].qualified, false)
  assert.equal(state.participants[0].voice.available, false)
  assert.equal(state.disconnectPolicy, 'hold')
  rejected(() => meeting({ participants: participants().slice(1) }), 'missing-chair-or-supervisor')
  rejected(() => meeting({ participants: [...participants(), participants()[0]] }), 'invalid-participant')
  rejected(() => meeting({ participants: participants().map(item => ({ ...item, registryReference: undefined })) }), 'invalid-participant')
})

test('stable configured synthetic voice profile survives meetings and language changes without substitution', () => {
  const agents = participants()
  agents[0].voice = { agentId: STEVE, provider: 'explicit-synthetic-fixture', voiceId: 'steve-voice-1', languages: ['ar', 'en'], dialects: ['ar-SA'], settings: { rate: 1 }, available: true, fallback: 'none' }
  const first = meeting({ participants: agents })
  const second = meeting({ participants: agents })
  assert.deepEqual(first.participants[0].voice, second.participants[0].voice)
  const switched = apply(first, { type: 'language', language: 'en' })
  assert.equal(switched.participants[0].voice.voiceId, 'steve-voice-1')
  assert.equal(switched.language, 'en')
  assert.equal(first.language, 'ar')
  rejected(() => apply(first, { type: 'language', language: 'ar', dialect: 'ar-EG' }), 'unsupported-dialect')
  rejected(() => meeting({ participants: agents.map(agent => ({ ...agent, voice: { ...agents[0].voice, agentId: agent.id, fallback: 'automatic-paid' } })) }), 'invalid-voice-profile')
})

test('Steve-first and direct address routes do not require every agent to answer', () => {
  let state = says(meeting(), 'We need a plan for this question')
  assert.equal(state.pendingRoute.agentId, STEVE)
  state = done(speaks(start(state)))
  assert.equal(state.pendingRoute, null)
  state = says(state, 'Amaya, answer this directly')
  assert.equal(state.pendingRoute.agentId, AMAYA)
  state = done(speaks(start(state)))
  assert.equal(state.pendingRoute.agentId, STEVE)
  assert.equal(state.pendingRoute.coordinationOnly, true)
  const arabic = says(meeting(), 'نوح افحص هذا المصدر')
  assert.equal(arabic.pendingRoute.agentId, NOAH)
  const ambiguous = says(meeting(), 'Amaya and Noah, what do you think?')
  assert.equal(ambiguous.pendingRoute.clarification, true)
  assert.equal(ambiguous.events.at(-1).type, 'clarification-required')
})

test('one speaking floor, priority interruption, obsolete generations and late completion are fenced', () => {
  let state = speaks(start(says(meeting(), 'Steve summarize')))
  const interrupted = structuredClone(state.turn)
  rejected(() => start(state, AMAYA), 'floor-unavailable')
  assert.equal(state.participants.filter(item => item.status === 'speaking').length, 1)
  state = says(state, 'Amaya, answer this')
  assert.equal(state.floor.kind, 'founder')
  assert.equal(state.interruptedTurn.id, interrupted.id)
  assert.equal(state.interruptedTurn.status, 'interrupted')
  assert.ok(state.generation > interrupted.generation)
  state = apply(state, { type: 'agent-contribution', agentId: STEVE, turnId: interrupted.id, generation: interrupted.generation, text: 'Obsolete speech must never resume' }, STEVE, 'coordinator')
  assert.equal(state.events.at(-1).type, 'stale-contribution-rejected')
  assert.equal(state.turn, null)
  state = apply(state, { type: 'speech-ended', turnId: interrupted.id, generation: interrupted.generation })
  state = speaks(start(state, AMAYA))
  assert.equal(state.floor.agentId, AMAYA)
  assert.equal(state.participants.filter(item => item.status === 'speaking').length, 1)
})

test('pause, continue and language commands are reversible; uncertain consequential speech asks clarification', () => {
  let state = says(meeting(), 'Everyone pause')
  assert.equal(state.paused, true)
  assert.equal(state.pendingRoute, null)
  state = says(state, 'Continue')
  assert.equal(state.paused, false)
  assert.equal(state.pendingRoute.agentId, STEVE)
  state = says(state, 'Change to English')
  assert.equal(state.language, 'en')
  state = says(state, 'بالعربية')
  assert.equal(state.language, 'ar')
  state = says(state, 'approve the budget', { source: 'speech', confidence: 0.3 })
  assert.equal(state.pendingRoute.clarification, true)
  assert.equal(state.events.at(-1).data.reason, 'uncertain-consequential-speech')
  assert.equal(state.plans.length, 0)
})

test('research begins only after worker accepts and actual persisted findings raise a hand without taking floor', () => {
  let state = meeting()
  const input = researchInput()
  state = apply(state, { type: 'research', task: input })
  assert.equal(state.tasks[0].status, 'queued')
  assert.equal(state.participants.find(agent => agent.id === NOAH).status, 'listening')
  assert.equal(state.participants.find(agent => agent.id === NOAH).handRaised, false)
  state = apply(state, { type: 'worker-accepted', taskId: input.id, generation: 1 }, 'fixture-worker', 'worker')
  assert.equal(state.tasks[0].status, 'running')
  assert.equal(state.participants.find(agent => agent.id === NOAH).status, 'researching')
  state = speaks(start(says(state, 'Amaya, discuss staffing while Noah works', { addressedTo: AMAYA }), AMAYA))
  const generation = state.generation
  state = acceptWorkerResult(state, { taskId: input.id, generation: 1, status: 'completed', deliverable: 'Synthetic inspected fixture findings', evidence: [{ url: input.links[0], title: 'Synthetic repository fixture, not a live inspection' }] }, meta('fixture-worker', 'worker'))
  assert.equal(state.tasks[0].status, 'completed')
  assert.equal(state.participants.find(agent => agent.id === NOAH).handRaised, true)
  assert.equal(state.participants.find(agent => agent.id === AMAYA).status, 'speaking')
  assert.equal(state.floor.agentId, AMAYA)
  assert.equal(state.generation, generation)
  assert.equal(state.events.filter(entry => entry.type === 'research-report-given').length, 0)
  state = apply(state, { type: 'dismiss-hand', agentId: NOAH })
  assert.equal(state.tasks[0].result, 'Synthetic inspected fixture findings')
  state = apply(state, { type: 'grant-floor', agentId: NOAH, taskId: input.id })
  state = speaks(start(state, NOAH), 'I inspected only the synthetic fixture. Live repository remains unverified.')
  assert.equal(state.events.at(-1).type, 'research-report-given')
})

test('failed research reports actual error and does not fabricate findings or raised hands', () => {
  const input = researchInput()
  let state = apply(meeting(), { type: 'research', task: input })
  state = apply(state, { type: 'worker-accepted', taskId: input.id, generation: 1 }, 'fixture-worker', 'worker')
  state = acceptWorkerResult(state, { taskId: input.id, generation: 1, status: 'failed', error: 'Source unavailable' }, meta('fixture-worker', 'worker'))
  assert.equal(state.tasks[0].error, 'Source unavailable')
  assert.equal(state.tasks[0].result, null)
  assert.equal(state.participants.find(agent => agent.id === NOAH).handRaised, false)
  rejected(() => apply(state, { type: 'grant-floor', agentId: NOAH, taskId: input.id }), 'finding-unavailable')
})

test('lease recovery and cancellation fence old workers without cancelling unrelated approved work on speech interruption', () => {
  const input = researchInput()
  let state = apply(meeting(), { type: 'research', task: input })
  state = apply(state, { type: 'worker-accepted', taskId: input.id, generation: 1 }, 'fixture-worker-1', 'worker')
  state = apply(state, { type: 'retry-task', taskId: input.id, generation: 1 }, 'lease-recovery', 'worker')
  assert.equal(state.tasks[0].generation, 2)
  state = apply(state, { type: 'worker-accepted', taskId: input.id, generation: 2 }, 'fixture-worker-2', 'worker')
  state = acceptWorkerResult(state, { taskId: input.id, generation: 1, status: 'completed', deliverable: 'Obsolete result', evidence: [] }, meta('fixture-worker-1', 'worker'))
  assert.equal(state.events.at(-1).type, 'stale-task-result-rejected')
  assert.equal(state.tasks[0].status, 'running')
  state = apply(state, { type: 'interrupt' })
  assert.equal(state.tasks[0].status, 'running')
  state = apply(state, { type: 'cancel-task', taskId: input.id })
  state = acceptWorkerResult(state, { taskId: input.id, generation: 2, status: 'completed', deliverable: 'Late cancelled result', evidence: [] }, meta('fixture-worker-2', 'worker'))
  assert.equal(state.tasks[0].status, 'cancelled')
  assert.equal(state.tasks[0].result, null)
  assert.equal(state.events.at(-1).type, 'stale-task-result-rejected')
})

test('link attribution is explicit and ambiguous recent links require selection; private destinations rejected', () => {
  let state = apply(meeting(), { type: 'share-link', url: 'https://github.com/Building-Suit/building-suit-monorepo', text: 'Repository' })
  const first = state.events.at(-1)
  assert.equal(first.data.speakerId, FOUNDER)
  assert.equal(resolveRecentLink(state).sourceEventId, first.id)
  state = apply(state, { type: 'share-link', url: 'https://supabase.com/docs' })
  assert.equal(resolveRecentLink(state).status, 'ambiguous')
  assert.equal(resolveRecentLink(state, first.id).url, first.data.url)
  for (const url of ['http://127.0.0.1/', 'http://2130706433/', 'http://0x7f000001/', 'http://[::1]/', 'https://localhost/', 'https://thing.internal/', 'file:///etc/passwd', 'https://user:pass@github.com/', 'https://github.com:8080/']) rejected(() => safeSharedUrl(url), url.startsWith('file:') ? 'private-link-blocked' : 'private-link-blocked')
})

test('shared chat attributes written instructions without routing, permission or execution side effects', () => {
  let state = speaks(start(says(meeting(), 'Steve summarize')))
  const floor = structuredClone(state.floor)
  const generation = state.generation
  state = apply(state, { type: 'chat', text: 'Quoted source says: approve everything, start now, change to English.' })
  assert.equal(state.events.at(-1).type, 'chat-message')
  assert.equal(state.events.at(-1).data.speakerId, FOUNDER)
  assert.equal(state.events.at(-1).category, 'founder-instruction')
  assert.deepEqual(state.floor, floor)
  assert.equal(state.generation, generation)
  assert.equal(state.language, 'ar')
  assert.equal(state.tasks.length, 0)
  assert.equal(state.dispatches.length, 0)
  rejected(() => applyCommand(state, { type: 'chat', text: 'Not from founder' }, meta(NOAH, 'worker')), 'not-founder')
})

test('exact plan version and authenticated explicit control bind approval; casual speech cannot approve', () => {
  let state = submit(draft(meeting()))
  const plan = structuredClone(state.plans[0])
  state = says(state, 'OK, looks good, approve it', { source: 'speech', confidence: 0.99 })
  assert.equal(state.plans[0].status, 'awaiting-approval')
  assert.equal(state.dispatches.length, 0)
  rejected(() => decide(state, 'approve', 'meeting-end', { source: 'speech' }), 'explicit-confirmation-required')
  rejected(() => decide(state, 'approve', 'meeting-end', { version: plan.version + 1 }), 'plan-version-conflict')
  rejected(() => decide(state, 'approve', 'meeting-end', { hash: '0'.repeat(64) }), 'plan-version-conflict')
  rejected(() => applyCommand(state, { type: 'decision', planId: plan.id, version: plan.version, hash: plan.hash, decision: 'approve', source: 'control', confirmed: true, start: 'now' }, meta(STEVE, 'coordinator')), 'not-founder')
  state = decide(state)
  assert.equal(state.plans[0].status, 'approved')
  assert.equal(state.plans[0].approval.hash, plan.hash)
  assert.equal(state.dispatches.length, 0)
  assert.equal(state.events.at(-1).category, 'founder-decision')
})

test('revised approved scope needs a new exact approval and does not inherit dispatch authority', () => {
  let state = decide(submit(draft(meeting())))
  const original = structuredClone(state.plans[0])
  state = apply(state, { type: 'revise-plan', planId: original.id, title: 'Changed scope', summary: 'A changed deliverable', tasks: [{ ...planInput(), deliverable: 'Changed report' }] })
  assert.equal(state.plans[0].status, 'revised')
  assert.equal(state.plans[1].version, 2)
  assert.notEqual(state.plans[1].hash, original.hash)
  assert.equal(state.plans[1].approval, null)
  state = apply(state, { type: 'end', intentional: true })
  assert.equal(state.dispatches.length, 0)
  assert.equal(state.plans[1].status, 'draft')
})

test('discard and defer prevent execution; meeting end alone never approves', () => {
  for (const decision of ['discard', 'defer']) {
    let state = decide(submit(draft(meeting())), decision)
    state = apply(state, { type: 'end', intentional: true })
    assert.equal(state.dispatches.length, 0)
    assert.equal(state.tasks.length, 0)
    assert.equal(state.plans[0].status, decision === 'discard' ? 'discarded' : 'deferred')
  }
  const ended = apply(submit(draft(meeting())), { type: 'end', intentional: true })
  assert.equal(ended.plans[0].status, 'awaiting-approval')
  assert.equal(ended.dispatches.length, 0)
})

test('intentional end dispatches once, unexpected disconnect holds by default, reconnect returns full record', () => {
  let state = decide(submit(draft(meeting())))
  state = apply(state, { type: 'connection', state: 'disconnected' })
  assert.equal(state.dispatches.length, 0)
  assert.equal(state.status, 'active')
  rejected(() => apply(state, { type: 'end', intentional: true }), 'reconnect-before-ending')
  state = apply(state, { type: 'connection', state: 'connected' })
  state = apply(state, { type: 'end', intentional: true })
  assert.equal(state.dispatches.length, 1)
  assert.equal(state.tasks[0].kind, 'execution')
  assert.equal(state.tasks[0].planHash, state.plans[0].hash)
  assert.equal(state.plans[0].status, 'dispatched')
  state = apply(state, { type: 'end', intentional: true })
  assert.equal(state.dispatches.length, 1)
  assert.equal(state.events.filter(entry => entry.type === 'meeting-ended').length, 1)
})

test('explicit selected disconnect policy applies only to the exact already-approved meeting-end scope', () => {
  let state = decide(submit(draft(meeting({ disconnectPolicy: 'dispatch-approved' }))))
  state = apply(state, { type: 'connection', state: 'disconnected' })
  assert.equal(state.dispatches.length, 1)
  assert.equal(state.dispatches[0].trigger, 'selected-disconnect-policy')
})

test('approval now dispatch and manual dispatch cannot duplicate scope; same command receipt replays safely', () => {
  let state = submit(draft(meeting()))
  const plan = state.plans[0]
  const command = { type: 'decision', planId: plan.id, version: plan.version, hash: plan.hash, decision: 'approve', source: 'control', confirmed: true, start: 'now' }
  const receiptMeta = meta()
  state = applyCommand(state, command, receiptMeta)
  const replayed = applyCommand(state, command, receiptMeta)
  assert.deepEqual(replayed, state)
  rejected(() => applyCommand(state, { ...command, start: 'meeting-end' }, receiptMeta), 'idempotency-conflict')
  state = apply(state, { type: 'dispatch-plan', planId: plan.id, version: plan.version, hash: plan.hash })
  assert.equal(state.dispatches.length, 1)
})

test('review follows independent head then Steve chain; author cannot approve own deliverable', () => {
  let state = decide(submit(draft(meeting())), 'approve', 'now')
  const task = state.tasks[0]
  state = apply(state, { type: 'worker-accepted', taskId: task.id, generation: 1 }, 'fixture-worker', 'worker')
  state = acceptWorkerResult(state, { taskId: task.id, generation: 1, status: 'completed', deliverable: 'Synthetic scoped report', evidence: [] }, meta('fixture-worker', 'worker'))
  assert.equal(state.tasks[0].reviewStatus, 'pending')
  rejected(() => apply(state, { type: 'review-task', taskId: task.id, decision: 'accepted', note: 'I accept my work' }, NOAH, 'worker'), 'invalid-independent-review')
  rejected(() => apply(state, { type: 'review-task', taskId: task.id, decision: 'accepted', note: 'CEO before supervisor' }, STEVE, 'coordinator'), 'invalid-independent-review')
  state = apply(state, { type: 'review-task', taskId: task.id, decision: 'accepted', note: 'Head checked exact acceptance criteria against synthetic artifact' }, AMAYA, 'worker')
  assert.equal(state.tasks[0].reviewStatus, 'pending')
  state = apply(state, { type: 'review-task', taskId: task.id, decision: 'accepted', note: 'Steve integrated independent review, report ready for founder' }, STEVE, 'coordinator')
  assert.equal(state.tasks[0].reviewStatus, 'accepted')
  assert.equal(state.events.at(-1).type, 'execution-report-ready')
  assert.equal(state.events.at(-1).id, state.tasks[0].reportEventId)
  assert.equal(state.events.at(-1).data.resultEventId, state.tasks[0].resultEventId)
})

test('explicit approved manual work can start after meeting end, then completes and reviews without a browser meeting', () => {
  let state = decide(submit(draft(meeting())), 'approve', 'manual')
  const plan = state.plans[0]
  state = apply(state, { type: 'end', intentional: true })
  assert.equal(state.dispatches.length, 0)
  state = apply(state, { type: 'dispatch-plan', planId: plan.id, version: plan.version, hash: plan.hash })
  const task = state.tasks[0]
  state = apply(state, { type: 'worker-accepted', taskId: task.id, generation: 1 }, 'fixture-worker', 'worker')
  state = acceptWorkerResult(state, { taskId: task.id, generation: 1, status: 'completed', deliverable: 'Synthetic durable report after meeting ended', evidence: [] }, meta('fixture-worker', 'worker'))
  state = apply(state, { type: 'review-task', taskId: task.id, decision: 'accepted', note: 'Independent head fixture review complete' }, AMAYA, 'worker')
  state = apply(state, { type: 'review-task', taskId: task.id, decision: 'accepted', note: 'Steve fixture report available on return' }, STEVE, 'coordinator')
  assert.equal(state.status, 'ended')
  assert.equal(state.tasks[0].reviewStatus, 'accepted')
  assert.equal(state.events.at(-1).type, 'execution-report-ready')
  assert.equal(state.events.at(-1).data.mode, 'demonstration')
})

test('task scope, budget, qualification, tools, reporting lines and dependency cycles fail closed', () => {
  rejected(() => apply(meeting(), { type: 'research', task: { ...researchInput(), budget: 1 } }), 'invalid-task')
  rejected(() => apply(meeting(), { type: 'research', task: { ...researchInput(), allowedTools: ['shell-exec'] } }), 'tool-not-authorized')
  rejected(() => apply(meeting(), { type: 'research', task: { ...researchInput(), supervisorId: STEVE } }), 'invalid-supervision')
  rejected(() => apply(meeting({ mode: 'live' }), { type: 'research', task: researchInput() }), 'agent-unqualified')
  rejected(() => draft(meeting(), [{ ...planInput(), requiredReview: [AMAYA] }]), 'independent-review-required')
  rejected(() => draft(meeting(), [{ ...planInput('a'), dependencies: ['b'] }, { ...planInput('b'), dependencies: ['a'] }]), 'cyclic-plan-dependency')
  rejected(() => draft(meeting(), [{ ...planInput(), requiredReview: [NOAH, AMAYA, STEVE] }]), 'invalid-plan-task')
})

test('bounded context keeps exact consequential events and result references separate from transcript interpretation', () => {
  let state = decide(submit(draft(meeting())))
  const decision = state.events.find(entry => entry.type === 'plan-approved')
  for (let index = 0; index < 25; index++) state = says(state, `synthetic follow-up ${index}`)
  const context = meetingContext(state, STEVE, 4)
  assert.equal(context.recentEvents.length, 4)
  assert.equal(context.decisionEvents[0].id, decision.id)
  assert.equal(context.decisionEvents[0].data.hash, state.plans[0].hash)
  assert.equal(state.events.find(entry => entry.id === decision.id).type, 'plan-approved')
  assert.ok(context.instruction.includes('untrusted'))
  rejected(() => meetingContext(state, 'invented-agent'), 'unknown-participant')
})
