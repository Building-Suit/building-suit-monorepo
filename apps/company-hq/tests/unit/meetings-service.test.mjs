import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { demoCommand, demoSnapshot } from '../../server/meetings/demoService.mjs'
import { createSyntheticMeetingRepository } from '../../server/meetings/repository.mjs'
import { createMeetingWorker, createSyntheticExecutor } from '../../server/meetings/worker.mjs'

const directory = mkdtempSync(join(tmpdir(), 'hq-service-fixture-')), filename = join(directory, 'fixture.sqlite')
after(() => rmSync(directory, { recursive: true, force: true }))
const start = owner => demoCommand(filename, owner, { requestId: randomUUID(), command: { type: 'start', title: 'اجتماع تجريبي', language: 'ar', participantIds: ['AG-CEO-001', 'AG-HR-001', 'AG-HR-002', 'AG-RES-001'] } }).record
const send = (owner, meetingId, command, requestId = randomUUID()) => demoCommand(filename, owner, { meetingId, requestId, command }).record

test('demonstrated synthetic meeting: research continues through discussion, exact end dispatch and report persistence', async () => {
  const owner = 'fixture-founder', first = start(owner), id = first.id
  let state = send(owner, id, { type: 'text', text: 'ستيف، لنبدأ الاجتماع' })
  assert.equal(state.turn.agentId, 'AG-CEO-001')
  send(owner, id, { type: 'chat', text: 'https://github.com/example/repository' })
  state = send(owner, id, { type: 'research', agentId: 'AG-HR-002', question: 'افحص المستودع' })
  assert.equal(state.tasks[0].status, 'queued')
  assert.equal(state.participants.find(item => item.id === 'AG-HR-002').handRaised, false)
  const repo = createSyntheticMeetingRepository({ filename, synthetic: true })
  const worker = createMeetingWorker({ repository: repo, executor: createSyntheticExecutor({ delayMs: 30 }) })
  const background = worker.runOnce()
  state = send(owner, id, { type: 'text', addressedTo: 'AG-RES-001', text: 'نناقش التسويق الآن' })
  assert.equal(state.turn.agentId, 'AG-RES-001')
  send(owner, id, { type: 'interrupt' })
  send(owner, id, { type: 'text', addressedTo: 'AG-HR-001', text: 'أجيبي يا أمايا' })
  await background
  state = repo.get(owner, id)
  assert.equal(state.turn.agentId, 'AG-HR-001')
  assert.equal(state.participants.find(item => item.id === 'AG-HR-002').handRaised, true)
  state = send(owner, id, { type: 'invite', agentId: 'AG-HR-002' })
  assert.match(state.events.filter(item => item.type === 'agent-contribution').at(-1).data.text, /SYNTHETIC FIXTURE/)
  state = send(owner, id, { type: 'draftPlan', title: 'خطة محددة', objective: 'Test a synthetic deliverable', deliverable: 'Fixture report', ownerId: 'AG-HR-002' })
  const plan = state.plans.at(-1)
  state = send(owner, id, { type: 'plan', decision: 'approve-on-end', version: plan.version, digest: plan.hash })
  assert.equal(state.dispatches.length, 0)
  const endKey = randomUUID()
  state = send(owner, id, { type: 'end' }, endKey)
  assert.equal(state.dispatches.length, 1)
  assert.equal(send(owner, id, { type: 'end' }, endKey).dispatches.length, 1)
  await worker.runOnce()
  const task = state.dispatches[0].taskId
  repo.review(owner, id, task, { reviewerId: 'AG-HR-001', verdict: 'accepted', evidence: 'Independent synthetic supervisor fixture review; no employee invocation.' })
  repo.review(owner, id, task, { reviewerId: 'AG-CEO-001', verdict: 'accepted', evidence: 'Independent synthetic chair fixture review; no employee invocation.' })
  assert.equal(demoSnapshot(filename, owner, id).reports.find(item => item.taskId === task).readyForFounder, true)
  repo.close()
})

test('discarded plan never dispatches; completed response retry is idempotent; owner isolation holds', () => {
  const owner = 'rejection-founder', first = start(owner), id = first.id, key = randomUUID()
  const command = { type: 'text', text: 'Steve, summarize.' }
  const initial = send(owner, id, command, key)
  const retry = send(owner, id, command, key)
  assert.equal(retry.events.filter(item => item.type === 'agent-contribution').length, initial.events.filter(item => item.type === 'agent-contribution').length)
  assert.throws(() => send(owner, id, { type: 'text', text: 'different' }, key), /conflict/)
  let state = send(owner, id, { type: 'draftPlan', title: 'Discard', objective: 'Never execute', deliverable: 'No deliverable', ownerId: 'AG-HR-002' })
  const plan = state.plans.at(-1)
  send(owner, id, { type: 'plan', decision: 'discard', version: plan.version, digest: plan.hash })
  state = send(owner, id, { type: 'end' })
  assert.equal(state.dispatches.length, 0)
  assert.equal(state.tasks.length, 0)
  assert.throws(() => demoSnapshot(filename, 'different-owner', id), /not-found/)
})

test('research resolves one unique recent shared URL and repeated references preserve exact attribution', () => {
  const owner = 'unique-link-founder', id = start(owner).id
  send(owner, id, { type: 'chat', text: 'First reference https://github.com/Acme/first' })
  send(owner, id, { type: 'chat', text: 'Same reference again https://github.com/Acme/first' })
  const state = send(owner, id, { type: 'research', agentId: 'AG-HR-002', question: 'Inspect the link I just sent' })
  assert.deepEqual(state.tasks[0].links, ['https://github.com/Acme/first'])
  assert.equal(state.tasks[0].question, 'Inspect the link I just sent')
})

test('ambiguous recent links ask for exact scope through a finite failure and create no work', () => {
  const owner = 'ambiguous-link-founder', id = start(owner).id
  send(owner, id, { type: 'chat', text: 'https://github.com/Acme/first' })
  const before = send(owner, id, { type: 'chat', text: 'https://github.com/Acme/second' })
  assert.throws(() => send(owner, id, { type: 'research', agentId: 'AG-HR-002', question: 'Check the repository I sent' }), /research-link-ambiguous/)
  const unchanged = demoSnapshot(filename, owner, id).record
  assert.equal(unchanged.tasks.length, 0)
  assert.equal(unchanged.revision, before.revision)
  assert.equal(unchanged.events.length, before.events.length)
})

test('explicit research URLs override unrelated recent links and private URLs remain blocked', () => {
  const owner = 'explicit-link-founder', id = start(owner).id
  send(owner, id, { type: 'chat', text: 'https://github.com/Acme/first' })
  send(owner, id, { type: 'chat', text: 'https://github.com/Acme/second' })
  let state = send(owner, id, { type: 'research', agentId: 'AG-HR-002', question: 'Inspect https://github.com/Acme/exact' })
  assert.deepEqual(state.tasks[0].links, ['https://github.com/Acme/exact'])
  state = send(owner, id, { type: 'research', agentId: 'AG-HR-002', question: 'Inspect the explicitly selected source', url: 'https://github.com/Acme/structured' })
  assert.deepEqual(state.tasks[1].links, ['https://github.com/Acme/structured'])
  assert.throws(() => send(owner, id, { type: 'research', agentId: 'AG-HR-002', question: 'Inspect a source', url: 'http://127.0.0.1/metadata' }), /private-link-blocked/)
  assert.throws(() => send(owner, id, { type: 'research', agentId: 'AG-HR-002', question: 'Inspect https://github.com/Acme/first or https://github.com/Acme/second' }), /research-link-ambiguous/)
  assert.equal(demoSnapshot(filename, owner, id).record.tasks.length, 2)
})

test('an exact shared-link event resolves ambiguity, and draft plans never inherit an arbitrary chat URL', () => {
  const owner = 'event-link-founder', id = start(owner).id
  const first = send(owner, id, { type: 'chat', text: 'https://github.com/Acme/first' }).events.at(-1)
  send(owner, id, { type: 'chat', text: 'https://github.com/Acme/second' })
  let state = send(owner, id, { type: 'research', agentId: 'AG-HR-002', question: 'Inspect this exact shared source', referenceEventId: first.id })
  assert.deepEqual(state.tasks[0].links, ['https://github.com/Acme/first'])
  assert.throws(() => send(owner, id, { type: 'research', agentId: 'AG-HR-002', question: 'Inspect a nonexistent reference', referenceEventId: 'not-an-event' }), /unknown-link-reference/)
  state = send(owner, id, { type: 'draftPlan', title: 'Scoped fixture plan', objective: 'Write a fixture report', deliverable: 'Synthetic report', ownerId: 'AG-HR-002' })
  assert.deepEqual(state.plans.at(-1).tasks[0].links, [])
})
