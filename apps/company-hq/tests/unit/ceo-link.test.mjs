import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { load } from '../../scripts/load-test-module.mjs'

const D = await load('../server/utils/hqDomain.ts')
const W = await load('../server/utils/hqWorkflow.ts')
const { HqStore } = await load('../server/utils/hqStore.ts')
const founder = { id: 'founder', role: 'founder' }
const ceo = { id: 'ceo', role: 'ceo' }
const hr = { id: 'hr', role: 'hr' }
const brainFiles = { 'AG-CEO-001': 'ceo-profile', 'AG-HR-001': 'maya-profile', 'AG-HR-002': 'noah-profile', 'AG-HR-003': 'iris-profile', playbook: 'playbook', ...Object.fromEntries(['bootstrap', 'charter', 'workingAgreement', 'registry', 'organization', 'hrCharter', 'workforceSkill', 'home', 'soul', 'milestones', 'mode'].map(key => [key, 'source-' + key])) }
let sequence = 0
const action = (store, body) => store.execute(founder, D.parseFounderAction({ idempotencyKey: 'link-' + ++sequence, ...body }, founder))
const mutate = (store, fn) => store.transaction(document => ({ document, result: fn(document) }))
const proposal = sourceMessageId => ({ action: 'create_task', sourceMessageId, title: 'Synthetic CEO assignment', brief: 'Only this reviewed brief is shared with HR.', acceptance: 'Return a bounded evidence-based assessment.', allowedActions: 'Read only the exact approved Brain files; no external effects.' })
const authorization = id => ({ action: 'authorize_workflow', id, brainFiles, daily: false, timezoneConfirmed: false, allowedTools: [], publicInputs: [] })
const taskFor = (store, id) => store.read().tasks.find(task => task.id === id)
const check = (fn, code) => assert.throws(fn, error => error.code === code)
function setup(store = new HqStore(':memory:'), approved = true) {
  const message = action(store, { action: 'send_message', text: 'Private founder context: keep this conversation with Steve.' })
  const task = action(store, proposal(message.id))
  if (approved) {
    action(store, { action: 'approve_task', id: task.id })
    action(store, authorization(task.id))
  }
  return { store, id: task.id, messageId: message.id }
}
/** Synthetic evidence exercises real SQLite transitions, not actual model execution. */
function prepare(store, id, now = Date.now()) {
  const lease = mutate(store, doc => W.claim(doc, id, 'synthetic-owner', now, false))
  for (const [stage, agentId] of [['research', 'AG-HR-002'], ['evaluate', 'AG-HR-003'], ['consolidate', 'AG-HR-001'], ['reply', 'AG-CEO-001']]) {
    const evidence = { stage, agentId, contextId: 'synthetic-' + stage, principalId: 'synthetic-host', input: 'Synthetic approved input', inputDigest: W.digest('Synthetic approved input'), brain: [], allowedTools: [], toolCalls: [], output: 'Synthetic ' + stage + ' evidence', sources: [], startedAt: new Date(now).toISOString(), completedAt: new Date(now).toISOString(), ...(stage === 'evaluate' ? { review: { accepted: true, artifactDigest: W.digest('Synthetic research evidence'), evidence: 'Synthetic independent review of the research artifact.' } } : {}) }
    mutate(store, doc => W.checkpoint(doc, lease, evidence, now))
  }
  mutate(store, doc => W.prepareReport(doc, lease, now))
  return lease
}

test('linking is founder-only, proposed, durable and idempotent without duplicate tasks or implicit approval', () => {
  const dir = mkdtempSync(join(tmpdir(), 'hq-ceo-link-')), path = join(dir, 'hq.sqlite')
  let store = new HqStore(path)
  try {
    const message = action(store, { action: 'send_message', text: 'A founder request' })
    const body = { ...proposal(message.id), idempotencyKey: 'link-once' }
    const result = action(store, body)
    assert.deepEqual(action(store, body), result)
    const task = taskFor(store, result.id)
    assert.equal(task.status, 'proposed'); assert.equal(task.approvedAt, null); assert.equal(task.workflow, undefined)
    assert.equal(task.sourceMessage.id, message.id); assert.equal(task.sourceMessage.text, 'A founder request')
    assert.match(task.sourceMessage.digest, /^[a-f0-9]{64}$/)
    assert.equal(store.read().messages[0].status, 'queued'); assert.equal(store.read().workflowRuns, undefined)
    check(() => action(store, proposal(message.id)), 'HQ_CONFLICT')
    check(() => action(store, { ...body, brief: 'Changed approval' }), 'HQ_CONFLICT')
    for (const actor of [ceo, hr]) check(() => D.parseFounderAction(body, actor), 'HQ_ACCESS_DENIED')
    check(() => D.parseAgentAction('hq_propose_task', { requestKey: 'no-agent-link', ...proposal(message.id) }, ceo), 'HQ_INVALID_INPUT')
    check(() => store.execute(ceo, { name: 'hq_propose_task', key: 'forged-link', payload: { sourceMessageId: message.id } }), 'HQ_ACCESS_DENIED')
    store.close(); store = new HqStore(path)
    assert.deepEqual(action(store, body), result)
    assert.equal(store.read().tasks.filter(candidate => candidate.sourceMessage?.id === message.id).length, 1)
    check(() => action(store, { action: 'authorize_workflow', ...authorization(result.id) }), 'HQ_CONFLICT')
  } finally { store.close(); rmSync(dir, { recursive: true, force: true }) }
})

test('only an exact unanswered founder-to-CEO message can become a task source', () => {
  for (const patch of [{ agent: 'hr' }, { role: 'ceo' }, { channel: 'internal' }, { recipient: 'hr' }, { status: 'answered' }]) {
    const store = new HqStore(':memory:')
    try {
      const message = action(store, { action: 'send_message', text: 'Original' })
      mutate(store, doc => Object.assign(doc.messages[0], patch))
      check(() => action(store, proposal(message.id)), 'HQ_CONFLICT')
      assert.equal(store.read().tasks.length, 1)
    } finally { store.close() }
  }
})

test('source identity, text and uniqueness are rechecked before approval and workflow authorization', () => {
  const changes = [
    doc => { doc.messages[0].text += ' altered' },
    doc => { doc.messages[0].recipient = 'hr' },
    doc => { doc.messages[0].role = 'hr' },
    doc => { doc.messages[0].channel = 'internal' },
    doc => { doc.messages[0].createdAt = 'changed' },
    doc => { doc.messages[0].status = 'answered' },
    doc => { doc.messages.push({ ...doc.messages[0] }) },
    doc => { doc.tasks[0].sourceMessage.digest = '0'.repeat(64) },
    doc => { doc.tasks[0].sourceMessage.text = 'Changed snapshot' },
    doc => { doc.tasks.push({ ...doc.tasks[0], id: 'duplicate-task' }) },
    doc => { doc.tasks[0].owner = 'hr' },
  ]
  for (const beforeAuthorization of [false, true]) for (const change of changes) {
    const { store, id } = setup(undefined, false)
    try {
      if (beforeAuthorization) action(store, { action: 'approve_task', id })
      mutate(store, change)
      check(() => action(store, beforeAuthorization ? authorization(id) : { action: 'approve_task', id }), 'SOURCE_MESSAGE_CHANGED')
      assert.equal(taskFor(store, id).workflow, undefined)
      assert.equal(taskFor(store, id).status, beforeAuthorization ? 'queued' : 'proposed')
    } finally { store.close() }
  }
})

test('linked execution permits one non-daily Brain-only scope and fences changed contracts', () => {
  for (const patch of [{ daily: true, timezoneConfirmed: true }, { allowedTools: ['public.search'], publicInputs: ['Exact query'] }, { publicInputs: ['Unused query'] }]) {
    const { store, id } = setup(undefined, false)
    try {
      action(store, { action: 'approve_task', id })
      check(() => action(store, { ...authorization(id), ...patch }), 'HQ_ACCESS_DENIED')
      assert.equal(taskFor(store, id).workflow, undefined)
    } finally { store.close() }
  }
  const { store, id } = setup()
  try {
    const now = Date.now(), lease = mutate(store, doc => W.claim(doc, id, 'owner', now, false))
    const task = taskFor(store, id), legacy = { ...task }; delete legacy.sourceMessage
    assert.equal(W.contractDigest(legacy), W.digest([legacy.id, legacy.brief, legacy.acceptance, legacy.allowedActions, legacy.approvedAt, legacy.workflow]))
    assert.notEqual(W.contractDigest(task), W.contractDigest(legacy))
    const changedScope = store.read(); changedScope.tasks[0].workflow.allowedTools = ['public.read']
    check(() => W.approvedTask(changedScope, id), 'MESSAGE_WORKFLOW_SCOPE')
    const changedText = store.read(); changedText.messages[0].text += ' changed'
    check(() => W.leasedRun(changedText, lease, now + 1), 'SOURCE_MESSAGE_CHANGED')
    const changedBrief = store.read(); changedBrief.tasks[0].brief += ' changed'
    check(() => W.leasedRun(changedBrief, lease, now + 1), 'CHANGED_APPROVAL')
  } finally { store.close() }
})

test('legacy bridge actions cannot execute linked assignments or answer them before durable workflow delivery', () => {
  for (const approved of [false, true]) {
    const { store, id, messageId } = setup(undefined, approved)
    try {
      for (const [name, payload] of [['hq_reply', { text: 'Premature reply', replyTo: messageId }], ['hq_delegate_task', { id, detail: 'Bypass', to: 'hr' }], ['hq_update_task', { id, status: 'running', detail: 'Bypass' }]]) {
        check(() => store.execute(ceo, D.parseAgentAction(name, { requestKey: 'bridge-' + ++sequence, ...payload }, ceo)), 'HQ_ACCESS_DENIED')
      }
      assert.equal(store.read().messages.find(message => message.id === messageId).status, 'queued')
      assert.equal(store.read().messages.length, 1)
      action(store, { action: 'cancel_task', id })
      check(() => action(store, proposal(messageId)), 'HQ_CONFLICT')
    } finally { store.close() }
  }
  const store = new HqStore(':memory:')
  try {
    const { id } = action(store, { action: 'send_message', text: 'Legacy conversation' })
    store.execute(ceo, D.parseAgentAction('hq_reply', { requestKey: 'legacy-reply', text: 'Authorized supplied response', replyTo: id }, ceo))
    assert.equal(store.read().messages[0].status, 'answered'); assert.equal(store.read().messages[1].replyTo, id)
  } finally { store.close() }
})

test('only Steve receives the private source conversation and HR projections never expose its snapshot', () => {
  const { store, id } = setup()
  try {
    const task = taskFor(store, id), artifacts = []
    const base = JSON.stringify({ brief: task.brief, acceptance: task.acceptance, allowedActions: task.allowedActions, artifacts })
    for (const stage of ['research', 'evaluate', 'consolidate']) assert.equal(W.workflowAssignment(task, artifacts, stage), base)
    assert.deepEqual(JSON.parse(W.workflowAssignment(task, artifacts, 'reply')).founderMessage, { id: task.sourceMessage.id, text: task.sourceMessage.text })
    const legacy = { ...task }; delete legacy.sourceMessage
    assert.equal(W.workflowAssignment(legacy, artifacts, 'reply'), base)
    assert.deepEqual(D.projectState(store.read(), hr, 'sqlite').messages, [])
    const defensive = store.read(); defensive.tasks[0].owner = 'hr'
    assert.equal(D.projectState(defensive, hr, 'sqlite').tasks.find(candidate => candidate.id === id).sourceMessage, undefined)
    assert.ok(!JSON.stringify(D.projectState(defensive, hr, 'sqlite')).includes(task.sourceMessage.text))
    assert.equal(D.projectState(store.read(), founder, 'sqlite').tasks.find(candidate => candidate.id === id).sourceMessage.id, task.sourceMessage.id)
  } finally { store.close() }
})

test('founder messages retain their linked task ID beyond the task display window', () => {
  const { store, id, messageId } = setup()
  try {
    const doc = store.read(), historical = doc.tasks.find(task => task.id === 'HR-001')
    doc.tasks.unshift(...Array.from({ length: 150 }, (_, index) => ({ ...historical, id: 'synthetic-newer-' + index })))
    const before = structuredClone(doc), state = D.projectState(doc, founder, 'sqlite')
    assert.ok(!state.tasks.some(task => task.id === id))
    assert.equal(state.messages.find(message => message.id === messageId).taskId, id)
    assert.deepEqual(D.projectState(doc, hr, 'sqlite').messages, [])
    assert.deepEqual(doc, before)
  } finally { store.close() }
})

test('pending correlation survives SQLite restart and commits original, reply, receipt and task together exactly once', () => {
  const dir = mkdtempSync(join(tmpdir(), 'hq-ceo-outbox-')), path = join(dir, 'hq.sqlite')
  let store = new HqStore(path)
  try {
    const { id, messageId } = setup(store), now = Date.now(), oldLease = prepare(store, id, now)
    const pending = store.read().workflowRuns[oldLease.key].outbox
    assert.equal(pending.status, 'pending'); assert.equal(store.read().messages[0].status, 'queued')
    store.close(); store = new HqStore(path)
    const resumedAt = now + 60_001
    const lease = mutate(store, doc => W.claim(doc, id, 'replacement-owner', resumedAt, false))
    check(() => mutate(store, doc => W.deliverReport(doc, oldLease, resumedAt)), 'STALE_OR_CANCELLED_LEASE')
    mutate(store, doc => W.prepareReport(doc, lease, resumedAt))
    assert.deepEqual(store.read().workflowRuns[lease.key].outbox, pending)
    mutate(store, doc => W.deliverReport(doc, lease, resumedAt))
    const doc = store.read(), run = doc.workflowRuns[lease.key], reply = doc.messages.find(message => message.id === run.outbox.receipt)
    assert.equal(doc.messages.find(message => message.id === messageId).status, 'answered')
    assert.equal(reply.replyTo, messageId); assert.equal(reply.taskId, id); assert.equal(reply.role, 'ceo')
    assert.equal(taskFor(store, id).status, 'completed'); assert.equal(run.status, 'completed'); assert.equal(run.outbox.status, 'delivered')
    assert.equal(mutate(store, state => W.claim(state, id, 'retry', resumedAt + 1, false)), null)
    check(() => mutate(store, state => W.deliverReport(state, lease, resumedAt + 1)), 'STALE_OR_CANCELLED_LEASE')
    assert.equal(store.read().messages.filter(message => message.replyTo === messageId).length, 1)
  } finally { store.close(); rmSync(dir, { recursive: true, force: true }) }
})

test('cancellation and changed sources prevent a prepared outbox from answering or completing the task', () => {
  for (const cancel of [false, true]) {
    const { store, id, messageId } = setup()
    try {
      const now = Date.now(), lease = prepare(store, id, now)
      if (cancel) action(store, { action: 'cancel_task', id })
      else mutate(store, doc => { doc.messages.find(message => message.id === messageId).text += ' changed' })
      check(() => mutate(store, doc => W.deliverReport(doc, lease, now + 1)), cancel ? 'STALE_OR_CANCELLED_LEASE' : 'SOURCE_MESSAGE_CHANGED')
      const doc = store.read()
      assert.equal(doc.messages[0].status, 'queued'); assert.equal(doc.messages.length, 1)
      assert.equal(doc.workflowRuns[lease.key].outbox.status, 'pending')
      assert.notEqual(taskFor(store, id).status, 'completed')
    } finally { store.close() }
  }
})

test('workspace capacity failure rolls back original status, correlated reply and delivery receipt atomically', () => {
  const { store, id } = setup()
  try {
    const now = Date.now(), lease = prepare(store, id, now)
    mutate(store, doc => {
      const run = doc.workflowRuns[lease.key]
      run.checkpoints.reply.output = 'Synthetic reply ' + 'x'.repeat(2000)
      run.outbox.text = run.checkpoints.reply.output
      const bytes = Buffer.byteLength(JSON.stringify(doc))
      doc.events.push({ id: 'synthetic-capacity', agent: 'ceo', type: 'fixture', title: 'Synthetic audit capacity', detail: 'x'.repeat(7_999_300 - bytes), createdAt: new Date(now).toISOString() })
    })
    const before = store.read()
    check(() => mutate(store, doc => W.deliverReport(doc, lease, now + 1)), 'HQ_CAPACITY')
    assert.deepEqual(store.read(), before)
    assert.equal(store.read().messages[0].status, 'queued'); assert.equal(store.read().workflowRuns[lease.key].outbox.status, 'pending')
  } finally { store.close() }
})
