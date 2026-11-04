import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { load } from '../../scripts/load-test-module.mjs'

const D = await load('../server/utils/hqDomain.ts'), W = await load('../server/utils/hqWorkflow.ts')
const { HqStore } = await load('../server/utils/hqStore.ts'), { HqRunner } = await load('../server/utils/hqRunner.ts')
const { HqCeoDispatcher } = await load('../server/utils/hqCeoDispatch.ts')
const { openDisabledHqHost } = await load('../server/utils/hqHostBootstrap.ts')
const { ResponsesProtocol, requireSettledProviderJournal } = await load('../server/utils/hqResponsesProtocol.ts')
const founder = { id: 'founder', role: 'founder' }
const readiness = { enabled: true, backendScopeVerified: true, modelScopeVerified: true, persistentHostVerified: true, zeroCostHostVerified: true }
const keys = ['AG-CEO-001','AG-HR-001','AG-HR-002','AG-HR-003','playbook','bootstrap','charter','workingAgreement','registry','organization','hrCharter','workforceSkill','home','soul','milestones','mode']
const brainFiles = Object.fromEntries(keys.map(key => [key, 'synthetic-dispatch-' + key]))
const privateText = 'Synthetic private founder question for Steve only.'
let sequence = 0
const action = (s, input) => s.execute(founder, D.parseFounderAction({ idempotencyKey: 'dispatch-' + ++sequence, ...input }, founder))
const mutate = (s, fn) => s.transaction(document => ({ document, result: fn(document) }))
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done }); return { promise, resolve } }
async function promptly(promise) {
 let timer
 try { return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(Error('Bounded synthetic operation did not settle')), 1500) })]) }
 finally { clearTimeout(timer) }
}
function fixture(t, options = {}) {
 const directory = mkdtempSync(join(tmpdir(), 'hq-ceo-dispatch-')), path = join(directory, 'hq.sqlite')
 const s = new HqStore(path)
 const cleanup = []
 t.after(async () => { for (const close of cleanup) await close(); try { s.close() } catch { /* Dispatcher owns and may already have closed this connection. */ } rmSync(directory, { recursive: true, force: true }) })
 const { id: messageId } = action(s, { action: 'send_message', text: privateText })
 const { id } = action(s, { action: 'create_task', title: 'Synthetic approved CEO assignment', brief: 'Assess the authorized synthetic evidence.', acceptance: 'Independent review and CEO answer.', allowedActions: 'Read only the exact authorized synthetic Brain files.', ...(options.linked === false ? {} : { sourceMessageId: messageId }) })
 if (options.approved !== false) {
  action(s, { action: 'approve_task', id })
  action(s, { action: 'authorize_workflow', id, brainFiles, allowedTools: [], publicInputs: [], daily: options.daily === true, timezoneConfirmed: options.daily === true })
 }
 return { s, path, id, messageId, cleanup }
}
function adapters(overrides = {}) {
 const calls = [], reads = [], counts = { verify: 0, reserve: 0 }
 let allowance = 4
 const brain = { async read(id, { cache, signal }) { signal.throwIfAborted(); assert.equal(cache, 'no-store'); reads.push(id); return { id, revision: 'synthetic-v1', text: 'Synthetic scoped Brain ' + id, accessedAt: new Date().toISOString() } } }
 const executor = {
  async verify(signal) { signal.throwIfAborted(); counts.verify++; return { authenticated: true, zeroIncrementalCost: true, remainingCalls: allowance } },
  async reserve(signal) { signal.throwIfAborted(); assert.ok(allowance > 0); allowance--; return { id: 'synthetic-allowance-' + ++counts.reserve, zeroIncrementalCost: true } },
  async invoke(input) {
   calls.push(input)
   return { identity: { agentId: input.agentId, contextId: input.contextId, principalId: 'synthetic-host', isolated: true }, output: 'Synthetic ' + input.stage, sources: [brainFiles.playbook], ...(input.stage === 'evaluate' ? { review: { accepted: true, artifactDigest: input.artifacts[0].digest, evidence: 'Synthetic independent evaluation.' } } : {}) }
  }, ...overrides,
 }
 return { readiness, brain, executor, calls, reads, counts }
}
const dispatcher = (_t, f, a = adapters()) => { const host = new HqCeoDispatcher(f.s, a); f.cleanup.push(() => host.close()); return host }

test('durable dispatch requires real SQLite, explicit approval, source linkage and non-daily scope without invoking adapters', async t => {
 assert.throws(() => new HqCeoDispatcher({ read() {} }), /SQLITE_DISPATCH_REQUIRED/)
 for (const options of [{ approved: false }, { linked: false }, { linked: false, daily: true }]) {
  const f = fixture(t, options), a = adapters(), host = dispatcher(t, f, a)
  assert.equal((await host.dispatchNext()).status, 'no_dispatchable_work')
  await assert.rejects(() => host.dispatchTask(f.id))
  assert.deepEqual(a.counts, { verify: 0, reserve: 0 }); assert.equal(a.calls.length, 0)
  assert.equal(f.s.read().workflowRuns, undefined)
 }
})

test('manual host dispatch stays disabled and never changes an approved queued task', async t => {
 const f = fixture(t), before = f.s.read(); f.s.close()
 const host = openDisabledHqHost(f.path); f.cleanup.push(() => host.close())
 assert.equal(host.status.enabled, false)
 await assert.rejects(() => host.dispatchTask(f.id), /RUNNER_NOT_VERIFIED/)
 await assert.rejects(() => host.dispatchNext(), /RUNNER_NOT_VERIFIED/)
 await host.close(); await host.close()
 await assert.rejects(() => host.dispatchNext(), /HOST_CLOSED/)
 const reopened = new HqStore(f.path); assert.deepEqual(reopened.read(), before); reopened.close()
})

test('one explicit dispatch runs four isolated stages, delivers the linked reply once and survives SQLite reopen', async t => {
 const f = fixture(t), a = adapters(), host = dispatcher(t, f, a)
 const result = await host.dispatchNext()
 assert.equal(result.status, 'completed')
 assert.deepEqual(a.calls.map(call => call.agentId), ['AG-HR-002','AG-HR-003','AG-HR-001','AG-CEO-001'])
 assert.equal(new Set(a.calls.map(call => call.contextId)).size, 4); assert.equal(a.reads.length, 80)
 for (const input of a.calls) {
  const assignment = JSON.parse(input.assignment)
  if (input.stage === 'reply') assert.deepEqual(assignment.founderMessage, { id: f.messageId, text: privateText })
  else { assert.equal(assignment.founderMessage, undefined); assert.ok(!input.assignment.includes(privateText)) }
 }
 const saved = f.s.read(), reply = saved.messages.find(message => message.id === result.receipt)
 assert.equal(reply.replyTo, f.messageId); assert.equal(reply.taskId, f.id)
 assert.equal(saved.messages.find(message => message.id === f.messageId).status, 'answered')
 assert.equal(Object.values(saved.workflowRuns)[0].outbox.status, 'delivered')
 await host.close()
 const nextStore = new HqStore(f.path), next = new HqCeoDispatcher(nextStore, a); f.cleanup.push(() => next.close())
 assert.equal((await next.dispatchTask(f.id)).status, 'already_claimed_or_finished')
 assert.equal((await next.dispatchNext()).status, 'no_dispatchable_work')
 assert.equal(a.calls.length, 4); assert.deepEqual(nextStore.read(), saved)
})

test('independent SQLite dispatchers compete for one claim and each instance rejects concurrent calls', async t => {
 const f = fixture(t), a = adapters(), entered = deferred(), release = deferred(), invoke = a.executor.invoke
 a.executor.invoke = async input => { if (input.stage === 'research') { entered.resolve(); await release.promise } return invoke(input) }
 const first = dispatcher(t, f, a), second = new HqCeoDispatcher(new HqStore(f.path), a); f.cleanup.push(() => second.close())
 const pending = first.dispatchTask(f.id); await promptly(entered.promise)
 await assert.rejects(() => first.dispatchNext(), /DISPATCH_ALREADY_ACTIVE/)
 assert.equal((await second.dispatchTask(f.id)).status, 'already_claimed_or_finished')
 release.resolve(); assert.equal((await pending).status, 'completed'); assert.equal(a.counts.reserve, 4)
})

test('dispatchNext is bounded to one task and stops before selection above its document limit', async t => {
 const f = fixture(t), a = adapters(), host = dispatcher(t, f, a)
 const { id: messageId } = action(f.s, { action: 'send_message', text: 'Another synthetic founder request.' })
 const { id } = action(f.s, { action: 'create_task', sourceMessageId: messageId, title: 'Second synthetic assignment', brief: 'Read synthetic evidence.', acceptance: 'Independent review.', allowedActions: 'Exact synthetic Brain read scope.' })
 action(f.s, { action: 'approve_task', id })
 action(f.s, { action: 'authorize_workflow', id, brainFiles, allowedTools: [], publicInputs: [], daily: false, timezoneConfirmed: false })
 assert.equal((await host.dispatchNext()).status, 'completed'); assert.equal(a.calls.length, 4)
 assert.equal(f.s.read().tasks.filter(task => task.sourceMessage && task.status === 'queued').length, 1)
 mutate(f.s, doc => { while (doc.tasks.length < 1001) doc.tasks.push({ ...doc.tasks[0], id: 'synthetic-proposal-' + doc.tasks.length, status: 'proposed', approvedAt: null, sourceMessage: undefined, workflow: undefined }) })
 await assert.rejects(() => host.dispatchNext(), /DISPATCH_SELECTION_LIMIT/)
 assert.equal(a.counts.reserve, 4)
})

test('pre-aborted dispatch never claims work and an expired owner cannot retry its orphan attempt', async t => {
 const f = fixture(t), a = adapters(), host = dispatcher(t, f, a), parent = new AbortController()
 parent.abort(); await assert.rejects(() => host.dispatchTask(f.id, parent.signal))
 assert.equal(f.s.read().workflowRuns, undefined); assert.equal(a.counts.verify, 0)
 mutate(f.s, doc => {
  const lease = W.claim(doc, f.id, 'synthetic-old-owner', Date.now() - 120000, false)
  doc.workflowRuns[lease.key].attempts.push({ stage: 'research', contextId: 'synthetic-orphan', reservationId: 'synthetic-uncertain', at: new Date().toISOString() })
 })
 await assert.rejects(() => host.dispatchTask(f.id), /DISPATCH_ATTEMPT_RECONCILIATION_REQUIRED/)
 assert.equal(a.counts.reserve, 0); assert.equal(Object.values(f.s.read().workflowRuns)[0].owner, 'synthetic-old-owner')
})

test('a competing SQLite write after queue inspection is rechecked atomically before claiming or reserving', async t => {
 for (const mode of ['orphan', 'dispatched', 'completed']) {
  const f = fixture(t), a = adapters(), host = dispatcher(t, f, a), other = new HqStore(f.path)
  f.cleanup.push(() => other.close())
  const transaction = f.s.transaction.bind(f.s); let injected = false
  f.s.transaction = reduce => {
   if (!injected) {
    injected = true
    mutate(other, doc => {
     if (mode === 'orphan') {
      const lease = W.claim(doc, f.id, 'synthetic-intervening-owner', Date.now() - 120000, false)
      doc.workflowRuns[lease.key].attempts.push({ stage: 'research', contextId: 'synthetic-intervening-context', reservationId: 'synthetic-unknown-reservation', at: new Date().toISOString() })
     } else doc.providerOperations = { synthetic: { contextId: 'synthetic-other-context', reservationId: 'synthetic-other-reservation', requestDigest: 'synthetic-request', state: mode, accounting: 'unreconciled', at: new Date().toISOString(), ...(mode === 'completed' ? { resultDigest: 'synthetic-lost-result' } : {}) } }
    })
   }
   return transaction(reduce)
  }
  const code = mode === 'orphan' ? 'DISPATCH_ATTEMPT_RECONCILIATION_REQUIRED' : mode === 'dispatched' ? 'RESPONSES_UNCERTAIN_OUTCOME' : 'RESPONSES_CHECKPOINT_RECONCILIATION_REQUIRED'
  await assert.rejects(() => host.dispatchTask(f.id), error => error.code === code)
  assert.equal(injected, true); assert.deepEqual(a.counts, { verify: 0, reserve: 0 }); assert.equal(a.calls.length, 0)
  if (mode === 'orphan') assert.equal(Object.values(f.s.read().workflowRuns)[0].owner, 'synthetic-intervening-owner')
  else assert.equal(f.s.read().workflowRuns, undefined)
 }
})

test('a new uncertain provider outcome after claim prevents even an allowance reservation', async t => {
 const f = fixture(t), a = adapters(), host = dispatcher(t, f, a), verify = a.executor.verify
 a.executor.verify = async signal => {
  const result = await verify(signal)
  if (a.counts.verify === 2) mutate(f.s, doc => { doc.providerOperations = { synthetic: { contextId: 'synthetic-racing-context', reservationId: 'synthetic-racing-reservation', requestDigest: 'synthetic-request', state: 'ambiguous', accounting: 'unreconciled', at: new Date().toISOString() } } })
  return result
 }
 assert.equal((await host.dispatchTask(f.id)).code, 'RESPONSES_UNCERTAIN_OUTCOME')
 assert.equal(a.counts.reserve, 0); assert.equal(a.calls.length, 0)
 assert.equal(Object.values(f.s.read().workflowRuns)[0].attempts.length, 0)
})

test('parent cancellation and host close settle noncooperative reads or inference before SQLite closes', async t => {
 for (const mode of ['parent-inference', 'close-inference', 'close-read']) {
  const f = fixture(t), a = adapters(), entered = deferred(), release = deferred(), parent = new AbortController()
  let observedSignal
  if (mode === 'close-read') a.brain.read = async (_id, { signal }) => { observedSignal = signal; entered.resolve(); return release.promise }
  else a.executor.invoke = async input => { observedSignal = input.signal; entered.resolve(); return release.promise }
  const host = dispatcher(t, f, a), pending = host.dispatchTask(f.id, parent.signal)
  await promptly(entered.promise)
  if (mode.startsWith('parent')) parent.abort()
  else await promptly(host.close())
  assert.equal((await promptly(pending)).status, 'blocked'); assert.equal(observedSignal.aborted, true)
  await promptly(host.close())
  await assert.rejects(() => host.dispatchTask(f.id), /HOST_CLOSED/)
  const check = new HqStore(f.path), saved = check.read()
  assert.equal(saved.messages.length, 1); assert.equal(saved.messages[0].status, 'queued')
  assert.deepEqual(Object.values(saved.workflowRuns)[0].checkpoints, {})
  release.resolve({}); await new Promise(resolve => setTimeout(resolve, 20))
  assert.deepEqual(check.read(), saved); check.close()
 }
})

test('blocked or orphan inference never automatically reserves or retries after restart', async t => {
 const f = fixture(t), a = adapters({ async invoke() { throw Error('Synthetic lost inference outcome') } }), first = dispatcher(t, f, a)
 assert.equal((await first.dispatchTask(f.id)).status, 'blocked'); assert.equal(a.counts.reserve, 1)
 await first.close()
 const reopened = new HqStore(f.path), next = new HqCeoDispatcher(reopened, a); f.cleanup.push(() => next.close())
 assert.equal((await next.dispatchNext()).status, 'no_dispatchable_work')
 await assert.rejects(() => next.dispatchTask(f.id), /DISPATCH_BLOCKED_REQUIRES_REVIEW/)
 mutate(reopened, doc => { doc.tasks.find(task => task.id === f.id).status = 'queued' })
 await assert.rejects(() => next.dispatchTask(f.id), /DISPATCH_ATTEMPT_RECONCILIATION_REQUIRED/)
 assert.equal(a.counts.reserve, 1); assert.equal(Object.values(reopened.read().workflowRuns)[0].attempts.length, 1)
})

test('a durable pending outbox resumes after restart without another model call or allowance reservation', async t => {
 const f = fixture(t), a = adapters(), first = dispatcher(t, f, a), transaction = f.s.transaction.bind(f.s)
 let fail = true
 f.s.transaction = reduce => transaction(doc => {
  const result = reduce(doc)
  if (fail && doc.messages.some(message => message.id.startsWith('workflow_'))) { fail = false; throw Error('Synthetic delivery transaction failure') }
  return result
 })
 assert.equal((await first.dispatchTask(f.id)).status, 'blocked')
 const before = f.s.read(); assert.equal(before.messages.length, 1); assert.equal(before.messages[0].status, 'queued')
 assert.equal(Object.values(before.workflowRuns)[0].outbox.status, 'pending'); assert.equal(a.counts.reserve, 4)
 await first.close()
 const reopened = new HqStore(f.path), next = new HqCeoDispatcher(reopened, a); f.cleanup.push(() => next.close())
 assert.equal((await next.dispatchNext()).status, 'completed')
 assert.equal(a.calls.length, 4); assert.equal(a.counts.reserve, 4)
 assert.equal(reopened.read().messages.filter(message => message.replyTo === f.messageId).length, 1)
 assert.equal((await next.dispatchTask(f.id)).status, 'already_claimed_or_finished')
})

function protocolHarness(f) {
 const a = adapters(); let current, transports = 0
 const protocol = new ResponsesProtocol(f.s, async () => {
  transports++
  const payload = { output: 'Synthetic protocol ' + current.stage, sources: [brainFiles.playbook], review: current.stage === 'evaluate' ? { evidence: 'Synthetic independent assessment', artifactDigest: current.artifacts[0].digest, accepted: true } : null }
  return new Response(JSON.stringify({ id: 'resp_synthetic_' + transports, model: 'synthetic-pinned', status: 'completed', error: null, incomplete_details: null, usage: { input_tokens: 10, output_tokens: 10, total_tokens: 20 }, output: [{ type: 'message', role: 'assistant', status: 'completed', content: [{ type: 'output_text', text: JSON.stringify(payload) }] }] }))
 }, 'synthetic-pinned', 'synthetic-host', 1000)
 a.executor.invoke = async (input, reservationId) => { current = input; a.calls.push(input); return protocol.invoke(input, reservationId) }
 return { a, protocol, transports: () => transports }
}

test('completed provider outcomes without checkpoints quarantine new contexts globally across SQLite restart', async t => {
 const f = fixture(t), h = protocolHarness(f), invoke = h.a.executor.invoke
 h.a.executor.invoke = async (...args) => { await invoke(...args); throw Error('Synthetic crash after response journal and before checkpoint') }
 const first = dispatcher(t, f, h.a)
 assert.equal((await first.dispatchTask(f.id)).status, 'blocked'); assert.equal(h.transports(), 1)
 const saved = f.s.read(), operation = Object.values(saved.providerOperations)[0]
 assert.equal(operation.state, 'completed'); assert.equal(operation.accounting, 'unreconciled'); assert.ok(operation.resultDigest)
 assert.throws(() => requireSettledProviderJournal(saved), /RESPONSES_CHECKPOINT_RECONCILIATION_REQUIRED/)
 await first.close()
 f.s = new HqStore(f.path); f.cleanup.push(() => f.s.close())
 const restarted = protocolHarness(f)
 let reservations = 0
 restarted.a.executor.reserve = async () => { reservations++; return { id: 'synthetic-new-context-reservation', zeroIncrementalCost: true } }
 // Exercise protocol defense independently of the stricter dispatcher: a new attempt/context
 // from the legacy runner must still never result in a second transport call.
 const result = await new HqRunner(f.s, readiness, restarted.a.executor, restarted.a.brain).run(f.id).catch(error => ({ code: error.code }))
 assert.equal(result.code, 'RESPONSES_CHECKPOINT_RECONCILIATION_REQUIRED'); assert.equal(restarted.transports(), 0)
 assert.equal(reservations, 0); assert.equal(restarted.a.counts.verify, 0)
 assert.deepEqual(f.s.read().providerOperations, saved.providerOperations)
})

test('completed provider journal matches saved identity, output, sources and normalized independent review', async t => {
 const f = fixture(t), h = protocolHarness(f), host = dispatcher(t, f, h.a)
 assert.equal((await host.dispatchTask(f.id)).status, 'completed'); assert.equal(h.transports(), 4)
 const saved = f.s.read(); requireSettledProviderJournal(saved)
 for (const field of ['principalId','agentId','contextId','output','sources','review']) {
  const altered = structuredClone(saved), evidence = Object.values(altered.workflowRuns)[0].checkpoints.evaluate
  evidence[field] = field === 'sources' ? ['unobserved'] : field === 'review' ? { ...evidence.review, accepted: false } : 'altered'
  assert.throws(() => requireSettledProviderJournal(altered), /RESPONSES_CHECKPOINT_RECONCILIATION_REQUIRED/)
 }
})
