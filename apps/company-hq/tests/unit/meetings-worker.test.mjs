import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawn, spawnSync } from 'node:child_process'
import { once } from 'node:events'
import { performance } from 'node:perf_hooks'
import { DatabaseSync } from 'node:sqlite'
import { createMeeting } from '../../shared/meetings/domain.mjs'
import { createSyntheticMeetingRepository } from '../../server/meetings/repository.mjs'
import { createMeetingWorker, createSyntheticExecutor, validateResearchUrl } from '../../server/meetings/worker.mjs'
import { inspectSyntheticDeliverable, reviewSyntheticResults } from '../../server/meetings/syntheticReviewer.mjs'

const OWNER = 'founder-fixture'
const agents = [
  { id: 'AG-CEO-001', name: 'Steve', role: 'CEO', supervisorId: null, registryReference: 'synthetic-registry-v1', allowedTools: [], qualified: true },
  { id: 'AG-HR-001', name: 'Amaya', role: 'HR head', supervisorId: 'AG-CEO-001', registryReference: 'synthetic-registry-v1', allowedTools: [], qualified: false },
  { id: 'AG-HR-002', name: 'Noah', role: 'Research', supervisorId: 'AG-HR-001', registryReference: 'synthetic-registry-v1', allowedTools: ['fixture-read'], qualified: false },
  { id: 'AG-RES-001', name: 'Nadia', role: 'Research head', supervisorId: 'AG-CEO-001', registryReference: 'synthetic-registry-v1', allowedTools: ['fixture-read'], qualified: false },
]
function fixture(t, options = {}) {
  const directory = mkdtempSync(join(tmpdir(), 'hq-meetings-'))
  const filename = join(directory, 'synthetic.sqlite')
  const repository = createSyntheticMeetingRepository({ filename, synthetic: true, ...options })
  t.after(() => { try { repository.close() } catch { /* A recovery test can close its first handle. */ } rmSync(directory, { recursive: true, force: true }) })
  return { repository, filename }
}
function meeting(id = 'meeting-fixture') {
  return createMeeting({ id, founderId: OWNER, title: 'اجتماع اصطناعي', language: 'ar', mode: 'demonstration', participants: agents })
}
function research(id = 'research-fixture', timeoutMs = 1000) {
  return { type: 'research', task: { id, agentId: 'AG-HR-002', supervisorId: 'AG-HR-001', question: 'Inspect synthetic repository facts', scope: 'Synthetic fixture only', deliverable: 'Evidence report', allowedTools: ['fixture-read'], allowedActions: ['read-fixture'], links: [], budget: 0, timeoutMs, dependencies: [] } }
}
function result() {
  return { status: 'completed', deliverable: '[SYNTHETIC] inspected fixture facts', evidence: [{ url: 'https://example.com/synthetic-fixture', title: 'Synthetic input only; no external request' }] }
}
function plan(repository, decision = 'approve', start = 'meeting-end', ownerId = 'AG-HR-002') {
  const supervisor = agents.find(agent => agent.id === ownerId).supervisorId
  let state = repository.command(OWNER, 'meeting-fixture', {
    type: 'propose-plan', planId: 'plan-fixture', title: 'Synthetic work', summary: 'One scoped fixture deliverable', tasks: [{
      id: 'task-fixture', objective: 'Check fixture', owner: ownerId, supervisor, deliverable: 'Fixture deliverable',
      inputs: ['synthetic'], dependencies: [], allowedActions: ['read-fixture'], allowedTools: ['fixture-read'], links: [], budget: 0,
      acceptanceCriteria: ['Fixture evidence persisted'], requiredReview: [...new Set([supervisor, 'AG-CEO-001'])], blockers: [], priority: 'normal', executionEnvironment: 'disposable-synthetic', timeoutMs: 5000,
    }],
  })
  let proposed = state.plans.at(-1)
  state = repository.command(OWNER, state.id, { type: 'submit-plan', planId: proposed.id, version: proposed.version, hash: proposed.hash })
  proposed = state.plans.at(-1)
  return repository.command(OWNER, state.id, { type: 'decision', planId: proposed.id, version: proposed.version, hash: proposed.hash, decision, source: 'control', confirmed: true, ...(decision === 'approve' ? { start } : {}) })
}

test('synthetic repository rejects live mode, unauthorized reads, and conflicting request replay', t => {
  const { repository, filename } = fixture(t)
  assert.throws(() => createSyntheticMeetingRepository({ filename }), /synthetic-repository-required/)
  repository.create(OWNER, meeting())
  assert.throws(() => repository.get('other-founder', 'meeting-fixture'), /meeting-not-found/)
  assert.throws(() => repository.command('other-founder', 'meeting-fixture', { type: 'pause' }), /meeting-not-found/)
  const first = repository.command(OWNER, 'meeting-fixture', research(), { requestId: 'request-one' })
  const replay = repository.command(OWNER, 'meeting-fixture', research(), { requestId: 'request-one' })
  assert.equal(replay.revision, first.revision)
  assert.equal(repository.jobs(OWNER, first.id).length, 1)
  repository.command(OWNER, first.id, { type: 'pause' }, { requestId: 'later-pause' })
  assert.equal(repository.command(OWNER, first.id, research(), { requestId: 'request-one' }).paused, true)
  assert.throws(() => repository.command(OWNER, first.id, { type: 'pause' }, { requestId: 'request-one' }), /request-conflict/)
  assert.throws(() => repository.command(OWNER, first.id, { type: 'pause' }, { expectedRevision: 1 }), /revision-conflict/)
})

test('claim acknowledges real acceptance and only persisted completion raises a hand', t => {
  const { repository } = fixture(t)
  repository.create(OWNER, meeting())
  repository.command(OWNER, 'meeting-fixture', research())
  assert.equal(repository.get(OWNER, 'meeting-fixture').participants.find(a => a.id === 'AG-HR-002').handRaised, false)
  const lease = repository.claim('worker-one')
  assert.equal(repository.get(OWNER, lease.meetingId).tasks[0].status, 'running')
  assert.equal(repository.get(OWNER, lease.meetingId).participants.find(a => a.id === 'AG-HR-002').status, 'researching')
  assert.equal(repository.claim('worker-two'), null)
  repository.complete(lease, result())
  const record = repository.get(OWNER, lease.meetingId)
  assert.equal(record.tasks[0].status, 'completed')
  assert.equal(record.participants.find(a => a.id === 'AG-HR-002').handRaised, true)
  assert.equal(record.turn, null)
  assert.equal(repository.jobs(OWNER, lease.meetingId)[0].result.deliverable, result().deliverable)
})

test('expired leases recover with generation fencing and preserve persisted results', t => {
  let clock = Date.now()
  const { repository, filename } = fixture(t, { now: () => clock })
  repository.create(OWNER, meeting())
  repository.command(OWNER, 'meeting-fixture', research())
  const old = repository.claim('crashed-worker', { leaseMs: 100 })
  clock += 101
  const recovered = repository.claim('restarted-worker', { leaseMs: 100 })
  assert.equal(recovered.generation, old.generation + 1)
  assert.equal(recovered.attempt, 2)
  assert.throws(() => repository.complete(old, result()), /stale-lease/)
  repository.complete(recovered, result())
  const reopened = createSyntheticMeetingRepository({ filename, synthetic: true, now: () => clock })
  try { assert.equal(reopened.get(OWNER, recovered.meetingId).tasks[0].result, result().deliverable) }
  finally { reopened.close() }
})

test('timeouts, bounded recovery attempts and cancellation races reject late completion', t => {
  let clock = Date.now()
  const { repository } = fixture(t, { now: () => clock })
  repository.create(OWNER, meeting())
  repository.command(OWNER, 'meeting-fixture', research('timeout'))
  repository.claim('worker-one', { leaseMs: 100 })
  clock += 101
  repository.claim('worker-two', { leaseMs: 100 })
  clock += 101
  assert.equal(repository.claim('worker-three'), null)
  assert.equal(repository.get(OWNER, 'meeting-fixture').tasks[0].status, 'failed')
  repository.command(OWNER, 'meeting-fixture', research('cancelled'))
  const lease = repository.claim('worker-four')
  repository.cancel(OWNER, 'meeting-fixture', 'cancelled')
  assert.throws(() => repository.heartbeat(lease), /stale-lease/)
  assert.throws(() => repository.complete(lease, result()), /stale-lease/)
  assert.equal(repository.jobs(OWNER, 'meeting-fixture').find(j => j.id === 'cancelled').status, 'cancelled')
  assert.equal(repository.get(OWNER, 'meeting-fixture').tasks.find(j => j.id === 'cancelled').result, null)
})

test('end dispatch is idempotent; discard and unexpected disconnect hold all undispatched work', t => {
  const { repository } = fixture(t)
  repository.create(OWNER, meeting())
  plan(repository)
  repository.command(OWNER, 'meeting-fixture', { type: 'connection', state: 'disconnected' })
  assert.equal(repository.jobs(OWNER, 'meeting-fixture').length, 0)
  repository.command(OWNER, 'meeting-fixture', { type: 'connection', state: 'connected' })
  repository.command(OWNER, 'meeting-fixture', { type: 'end', intentional: true }, { requestId: 'end-one' })
  repository.command(OWNER, 'meeting-fixture', { type: 'end', intentional: true }, { requestId: 'end-one' })
  repository.command(OWNER, 'meeting-fixture', { type: 'end', intentional: true }, { requestId: 'end-two' })
  assert.equal(repository.jobs(OWNER, 'meeting-fixture').length, 1)
})

test('discarded plan creates no execution job after ending', t => {
  const { repository } = fixture(t)
  repository.create(OWNER, meeting())
  plan(repository, 'discard')
  repository.command(OWNER, 'meeting-fixture', { type: 'end', intentional: true })
  assert.deepEqual(repository.jobs(OWNER, 'meeting-fixture'), [])
})

test('execution deliverables require independent supervisor then Steve review, persisted for return', async t => {
  const { repository } = fixture(t)
  repository.create(OWNER, meeting())
  plan(repository, 'approve', 'now')
  const lease = repository.claim('fixture-worker')
  repository.complete(lease, result())
  assert.equal(repository.report(OWNER, lease.meetingId)[0].readyForFounder, false)
  assert.throws(() => repository.review(OWNER, lease.meetingId, lease.id, { reviewerId: 'AG-HR-002', verdict: 'accepted', evidence: 'Self review' }), /independent-review-required/)
  assert.throws(() => repository.review(OWNER, lease.meetingId, lease.id, { reviewerId: 'AG-CEO-001', stage: 'steve', verdict: 'accepted', evidence: 'Premature CEO review' }), /supervisor-review-required/)
  repository.review(OWNER, lease.meetingId, lease.id, { reviewerId: 'AG-HR-001', verdict: 'accepted', evidence: 'Synthetic supervisor inspected the exact stored fixture deliverable' })
  repository.review(OWNER, lease.meetingId, lease.id, { reviewerId: 'AG-CEO-001', stage: 'steve', verdict: 'accepted', evidence: 'Synthetic Steve checked supervisor receipt and exact result' })
  assert.equal(repository.report(OWNER, lease.meetingId)[0].readyForFounder, true)
  assert.equal(repository.get(OWNER, lease.meetingId).tasks[0].reviewStatus, 'accepted')
})

test('direct reports require one independent Steve review without a duplicate CEO stage', t => {
  const { repository } = fixture(t)
  repository.create(OWNER, meeting())
  plan(repository, 'approve', 'now', 'AG-RES-001')
  const lease = repository.claim('fixture-worker')
  repository.complete(lease, result())
  const receipt = repository.review(OWNER, lease.meetingId, lease.id, {
    reviewerId: 'AG-CEO-001', verdict: 'accepted', evidence: 'Synthetic Steve reviewed direct-report Nadia fixture deliverable', requestId: 'direct-report-review',
  })
  assert.equal(receipt.reviewerId, 'AG-CEO-001')
  assert.equal(repository.report(OWNER, lease.meetingId)[0].readyForFounder, true)
  assert.equal(repository.get(OWNER, lease.meetingId).tasks[0].reviewStatus, 'accepted')
  assert.equal(repository.get(OWNER, lease.meetingId).tasks[0].reviews.length, 1)
})

test('separate synthetic reviewer process validates stored evidence and completes the declared review chain', async t => {
  const { repository, filename } = fixture(t)
  repository.create(OWNER, meeting())
  plan(repository, 'approve', 'now')
  await createMeetingWorker({ repository, executor: createSyntheticExecutor() }).runOnce()
  assert.equal(repository.report(OWNER, 'meeting-fixture')[0].readyForFounder, false)
  const processRun = spawnSync(process.execPath, [resolve('apps/company-hq/scripts/meeting-reviewer.mjs'), '--synthetic', '--once', '--database', filename], { encoding: 'utf8', timeout: 10000 })
  assert.equal(processRun.status, 0, processRun.stderr)
  const observations = JSON.parse(processRun.stdout)
  assert.equal(observations.reviews.length, 2)
  assert.ok(observations.reviews.every(row => row.synthetic && row.verdict === 'accepted'))
  const report = repository.report(OWNER, 'meeting-fixture')[0]
  assert.equal(report.readyForFounder, true)
  assert.match(report.reviews.supervisor.evidence, /SYNTHETIC REVIEW PROCESS/)
  assert.match(report.reviews.steve.evidence, /not an employee qualification/)
  assert.deepEqual(repository.pendingReviews(), [])
})

test('independent fixture review rejects substituted results and forbids declaring live work reviewed', t => {
  const { repository } = fixture(t)
  repository.create(OWNER, meeting())
  plan(repository, 'approve', 'now')
  const lease = repository.claim('fixture-worker')
  repository.complete(lease, result())
  const candidate = repository.pendingReviews()[0]
  assert.equal(inspectSyntheticDeliverable(candidate).accepted, false)
  assert.equal(inspectSyntheticDeliverable({ ...candidate, mode: 'live' }).accepted, false)
  const observations = reviewSyntheticResults(repository)
  assert.equal(observations.length, 1)
  assert.equal(observations[0].verdict, 'rejected')
  assert.equal(repository.get(OWNER, 'meeting-fixture').tasks[0].reviewStatus, 'rejected')
  assert.equal(repository.report(OWNER, 'meeting-fixture')[0].readyForFounder, false)
  assert.deepEqual(repository.pendingReviews(), [])
})

test('worker uses text-safe fixture and rejects unqualified live execution and unsafe research URL', async t => {
  const { repository } = fixture(t)
  repository.create(OWNER, meeting())
  repository.command(OWNER, 'meeting-fixture', research())
  assert.throws(() => createMeetingWorker({ repository, executor: { mode: 'live' } }), /live-provider-not-qualified/)
  const observation = await createMeetingWorker({ repository, executor: createSyntheticExecutor() }).runOnce()
  assert.equal(observation.status, 'completed')
  assert.equal(observation.synthetic, true)
  assert.ok(observation.elapsedMs >= 0 && observation.rssMiB > 0)
  assert.equal(validateResearchUrl('https://github.com/org/repo', ['github.com']), 'https://github.com/org/repo')
  for (const url of ['http://github.com/org/repo', 'https://127.0.0.1/', 'https://localhost/', 'https://github.com:8443/', 'https://user@github.com/', 'https://evil.invalid/']) {
    assert.throws(() => validateResearchUrl(url, ['github.com']))
  }
})

test('unavailable tools fail honestly and cancellation aborts running synthetic work', async t => {
  const { repository } = fixture(t)
  repository.create(OWNER, meeting())
  repository.command(OWNER, 'meeting-fixture', research('tool-failure'))
  const failed = await createMeetingWorker({ repository, executor: createSyntheticExecutor({ fail: true }) }).runOnce()
  assert.equal(failed.status, 'failed')
  assert.equal(repository.get(OWNER, 'meeting-fixture').tasks[0].error, 'synthetic-tool-unavailable')
  assert.equal(repository.get(OWNER, 'meeting-fixture').participants.find(a => a.id === 'AG-HR-002').handRaised, false)
  repository.command(OWNER, 'meeting-fixture', research('cancel-during-work'))
  const worker = createMeetingWorker({ repository, executor: createSyntheticExecutor({ delayMs: 250 }), leaseMs: 200, heartbeatMs: 50 })
  const operation = worker.runOnce()
  await new Promise(resolve => setTimeout(resolve, 25))
  repository.cancel(OWNER, 'meeting-fixture', 'cancel-during-work')
  const cancelled = await operation
  assert.equal(cancelled.status, 'stale-or-cancelled')
  const record = repository.get(OWNER, 'meeting-fixture')
  assert.equal(record.tasks.find(task => task.id === 'cancel-during-work').status, 'cancelled')
  assert.equal(record.tasks.find(task => task.id === 'cancel-during-work').result, null)
})

test('real child process crash/restart and browser disconnect retain work without a browser owner', async t => {
  const { repository, filename } = fixture(t)
  repository.create(OWNER, meeting())
  plan(repository)
  repository.command(OWNER, 'meeting-fixture', { type: 'end', intentional: true })
  repository.command(OWNER, 'meeting-fixture', { type: 'connection', state: 'disconnected' })
  const moduleUrl = new URL('../../server/meetings/repository.mjs', import.meta.url).href
  const child = spawn(process.execPath, ['--input-type=module', '-e', `
    import { createSyntheticMeetingRepository } from ${JSON.stringify(moduleUrl)};
    const r=createSyntheticMeetingRepository({filename:process.argv[1],synthetic:true});
    const lease=r.claim('process-that-will-crash',{leaseMs:100});
    console.log(JSON.stringify({claimed:!!lease}));
    setTimeout(()=>{},30000);
  `, filename], { stdio: ['ignore', 'pipe', 'pipe'] })
  const [data] = await once(child.stdout, 'data')
  assert.equal(JSON.parse(data.toString()).claimed, true)
  child.kill('SIGKILL')
  await once(child, 'exit')
  await new Promise(resolve => setTimeout(resolve, 130))
  const started = performance.now()
  const run = spawnSync(process.execPath, [resolve('apps/company-hq/scripts/meeting-worker.mjs'), '--synthetic', '--once', '--database', filename], { encoding: 'utf8', timeout: 10000 })
  assert.equal(run.status, 0, run.stderr)
  const observation = JSON.parse(run.stdout.trim())
  assert.equal(observation.status, 'completed')
  assert.equal(observation.attempt, 2)
  assert.equal(repository.get(OWNER, 'meeting-fixture').tasks[0].status, 'completed')
  assert.equal(repository.get(OWNER, 'meeting-fixture').connection, 'disconnected')
  t.diagnostic(JSON.stringify({ scope: 'synthetic-child-process; no physical PC-off or Oracle test', restartWallMs: Math.round(performance.now() - started), ...observation }))
})

test('simultaneous worker/reviewer constructors wait for the first database schema lock', async t => {
  const directory = mkdtempSync(join(tmpdir(), 'hq-meeting-startup-'))
  const filename = join(directory, 'shared-startup.sqlite')
  const lock = new DatabaseSync(filename)
  lock.exec('create table startup_guard (id integer); begin exclusive;')
  const children = []
  t.after(() => {
    for (const child of children) if (child.exitCode === null) child.kill('SIGKILL')
    try { lock.close() } catch { /* The successful path has already released the fixture lock. */ }
    rmSync(directory, { recursive: true, force: true })
  })
  function run(script) {
    return new Promise((resolveRun, reject) => {
      const child = spawn(process.execPath, [resolve(`apps/company-hq/scripts/${script}`), '--synthetic', '--once', '--database', filename], { stdio: ['ignore', 'pipe', 'pipe'] })
      children.push(child)
      let stdout = '', stderr = ''
      child.stdout.on('data', value => { stdout += value.toString() })
      child.stderr.on('data', value => { stderr += value.toString() })
      child.once('error', reject)
      child.once('exit', code => resolveRun({ code, stdout, stderr }))
    })
  }
  const running = [run('meeting-worker.mjs'), run('meeting-reviewer.mjs')]
  await new Promise(resolveWait => setTimeout(resolveWait, 250))
  lock.exec('commit;')
  lock.close()
  const results = await Promise.all(running)
  for (const result of results) assert.equal(result.code, 0, result.stderr)
  assert.equal(JSON.parse(results[0].stdout).claimed, false)
  assert.deepEqual(JSON.parse(results[1].stdout).reviews, [])
  const repository = createSyntheticMeetingRepository({ filename, synthetic: true })
  try { assert.deepEqual(repository.pendingReviews(), []) }
  finally { repository.close() }
})
