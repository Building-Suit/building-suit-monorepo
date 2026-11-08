/** Actual worker process and Unix socket; fake HTTP/WebSocket/roster only. */
import test from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { connect } from 'node:net'
import { mkdtemp, copyFile, writeFile, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { REQUIRED_RPCS, STAFFING_RPCS } from './maintenance.mjs'

const pause = ms => new Promise(done => setTimeout(done, ms))
async function until(check) {
  const end = Date.now() + 10_000
  while (Date.now() < end) { const value = await check(); if (value) return value; await pause(20) }
  throw Error('fixture-timeout')
}
async function fixture(t, extra = {}) {
  const root = await mkdtemp(join(tmpdir(), 'hq-lifecycle-'))
  for (const name of ['worker.mjs', 'maintenance.mjs', 'departmentWorkflow.mjs']) await copyFile(new URL(name, import.meta.url), join(root, name))
  const sha = 'a'.repeat(40)
  await writeFile(join(root, 'manifest.json'), JSON.stringify({ sha }))
  await copyFile(new URL('workforceRoster.mjs', import.meta.url), join(root, 'workforceRoster.mjs'))
  await writeFile(join(root, 'brainPublisher.mjs'), 'export const createBrainPublisher = () => ({})')
  const staffingApi = {version:1,role:'authenticated',schemaUsage:true,execute:true,rpcs:STAFFING_RPCS}
  const api = {version:1,role:'authenticated',schemaUsage:true,execute:true,rpcs:REQUIRED_RPCS}
  await writeFile(join(root, 'bootstrap.mjs'), `
import { appendFile, access } from 'node:fs/promises'
const root = ${JSON.stringify(root)}, api = ${JSON.stringify(api)}, staffingApi = ${JSON.stringify(staffingApi)}
let activeJobs = 0, taskAckDelivered = false
const exists = async path => { try { await access(path); return true } catch { return false } }
const wait = ms => new Promise(done => setTimeout(done, ms))
globalThis.fetch = async (url, options = {}) => {
  let body = true, status = 200
  if (url.includes('/auth/')) body = {access_token:'fixture-access',refresh_token:'fixture-refresh',expires_in:3600}
  else if (url.endsWith('/rest/v1/')) {
    throw Error('privileged-openapi-must-not-be-requested')
  } else if (url.endsWith('/hq_worker_release_status')) { body = {staffingApi:structuredClone(staffingApi),api:structuredClone(api),contract:2,trialSkills:1,trialFailureSettlement:1,trialDelivery:process.env.FIXTURE_TRIAL_SCHEMA_BAD ? 0 : 1,activeJobs:process.env.FIXTURE_FOREIGN_LEASE ? 1 : activeJobs}; if(process.env.FIXTURE_SCHEMA_BAD)delete body.api.rpcs.hq_worker_claim; if(process.env.FIXTURE_PROOF_MISSING)delete body.api }
  else if (url.endsWith('/hq_worker_pending_lessons')) body = []
  else if (url.endsWith('/hq_worker_heartbeat')) { await appendFile(root + '/events', 'lease-renewal\\n'); body = {accepted:true} }
  else if (url.endsWith('/hq_worker_finish_v4')) { const receipt = JSON.parse(options.body); if(process.env.FIXTURE_TASK_ACK){if(receipt.p_reply!==''||receipt.p_error!=='task-ack-mention-required')throw Error('task-ack-failure-missing');await appendFile(root+'/ack-receipt.json',JSON.stringify(receipt));taskAckDelivered=true}else{if(!receipt.p_model_evidence || receipt.p_model_evidence.selectedModel !== 'gpt-6-astra') throw Error('model-evidence-missing'); await appendFile(root + '/receipt.json', JSON.stringify(receipt.p_model_evidence))} await appendFile(root + '/events', 'delivery\\n'); body = {accepted:true}; activeJobs = 0 }
  else if (url.endsWith('/hq_worker_skill_context')) body = true
  else if (url.endsWith('/hq_worker_staffing_claim')) { await appendFile(root + '/events', 'staffing-dispatch\\n'); if(process.env.FIXTURE_STAFFING_CLAIM_DELAY)while(!await exists(root+'/settle-staffing'))await wait(10); if(process.env.FIXTURE_STAFFING_CLAIM_ERROR){status=503;body={}}else body={job:null} }
  else if (url.endsWith('/hq_worker_claim')) {
    await appendFile(root + '/events', 'claim\\n')
    if (process.env.FIXTURE_CLAIM_ERROR) { status = 503; body = {} }
    else if (process.env.FIXTURE_TASK_ACK && taskAckDelivered) body = {job:null}
    else if (process.env.FIXTURE_ACTIVE_JOB || process.env.FIXTURE_TASK_ACK) { activeJobs = 1; body = {job:{id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',conversation_id:'cccccccc-cccc-4ccc-8ccc-cccccccccccc',agent_id:'AG-CEO-001',lease_token:'dddddddd-dddd-4ddd-8ddd-dddddddddddd',prompt:'Fixture draft only',context:{mode:'conversation-intake',agent:{id:'AG-CEO-001',name:'Fixture',model:'gpt-6-astra',effort:'medium',profileFileId:'profile_source_1'},brain_files:[{id:'profile_source_1'}]}}}; if(process.env.FIXTURE_TASK_ACK){body.job.agent_id='AG-HR-001';Object.assign(body.job.context,{mode:'task-ack',agent:{id:'AG-HR-001',name:'Fixture head',model:'gpt-6.1-sol',effort:'medium',modelTier:'T2_HEAD',managerId:'AG-CEO-001',managerModelTier:'T3_EXEC',departmentKey:'hr-agent-development',profileFileId:'profile_source_1'},roster:[{id:'AG-HR-002',name:'Synthetic Recipient',managerId:'AG-HR-001'}]})} }
    else { while (!await exists(root + '/settle')) await wait(10); body = {job:null} }
  } else if (url.endsWith('/hq_worker_presence')) await appendFile(root + '/events', 'presence\\n')
  else throw Error('unexpected-remote-request')
  return new Response(JSON.stringify(body), {status})
}
globalThis.WebSocket = class extends EventTarget {
  static OPEN = 1
  readyState = 1
  constructor() { super(); setTimeout(() => this.dispatchEvent(new Event('open')), 5) }
  send(raw) {
    const frame = JSON.parse(raw)
    const emit = value => this.dispatchEvent(new MessageEvent('message', {data: JSON.stringify(value)}))
    if (frame.event === 'phx_join') setTimeout(() => {
      emit({topic:frame.topic,ref:frame.ref,event:'phx_reply',payload:{status:'ok'}})
      emit({topic:frame.topic,event:'system',payload:{status:'ok',extension:'system',message:'Replication connection established'}})
    }, 5)
  }
  close() { this.readyState = 3 }
}
`)
  await writeFile(join(root, 'entry.mjs'), `
import './bootstrap.mjs'
import { appendFile, access } from 'node:fs/promises'
import { start } from './worker.mjs'
const root = ${JSON.stringify(root)}
const adapters = {roster:{sync:async()=>{}}}
if (process.env.FIXTURE_ACTIVE_JOB || process.env.FIXTURE_TASK_ACK) {
  const originalInterval = globalThis.setInterval
  globalThis.setInterval = (fn, ms, ...args) => originalInterval(fn, ms === 60_000 ? 30 : ms, ...args)
  adapters.brain = async () => []
  adapters.invoke = async (_config, _job, _documents, signal) => {
    await appendFile(root + '/events', 'inference-started\\n')
    if(process.env.FIXTURE_TASK_ACK)return {reply:JSON.stringify({message:'Generated body without the required mention',delegateId:'AG-HR-002'}),evidence:[]}
    signal.addEventListener('abort', () => { void appendFile(root + '/events', 'inference-aborted\\n') })
    for (;;) {
      try { await access(root + '/settle-inference'); break } catch { await new Promise(done => setTimeout(done, 10)) }
    }
    return {reply:'Fixture draft completed once',evidence:[],modelExecutionEvidence:{schemaVersion:1,workerJobId:_job.id,workerId:_config.id,agentId:_job.agent_id,configuredModel:'gpt-6-astra',selectedModel:'gpt-6-astra',fallbackUsed:false}}
  }
}
await start(adapters)
`)
  const state = join(root, 'state')
  const env = { PATH: process.env.PATH, HQ_RELEASE_MANAGED: '1', HQ_WORKER_STATE_DIR: state,
    HQ_SUPABASE_URL: 'https://dpruoncalmwicrqhqelu.supabase.co', HQ_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_fixture',
    HQ_WORKER_ID: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', HQ_WORKER_EMAIL: 'fixture@example.invalid', HQ_WORKER_PASSWORD: 'fixture-password-never-real-12345', ...extra }
  const child = spawn(process.execPath, [join(root, 'entry.mjs')], { env, stdio: ['ignore', 'pipe', 'pipe'] })
  let output = ''; child.stdout.on('data', data => { output += data }); child.stderr.on('data', data => { output += data })
  t.after(async () => { if (child.exitCode === null) child.kill('SIGKILL'); await rm(root, { recursive: true, force: true }) })
  await until(() => output.includes('queue-connected'))
  const control = action => new Promise((done, fail) => {
    const client = connect(join(state, 'maintenance.sock'))
    let response = ''
    client.setTimeout(3000, () => client.destroy(Error('control-timeout')))
    client.once('error', fail)
    client.once('connect', () => client.write(JSON.stringify({action}) + '\n'))
    client.on('data', data => { response += data })
    client.once('end', () => done(JSON.parse(response)))
  })
  const events = async () => { try { return await readFile(join(root, 'events'), 'utf8') } catch { return '' } }
  return { root, state, child, control, events, sha, env }
}

test('actual candidate health is read-only, claim race drains, and no new side effects start while paused', async t => {
  const f = await fixture(t)
  const initial = await f.control('status')
  assert.equal(initial.ready, true); assert.equal(initial.paused, true); assert.equal(initial.release, f.sha)
  assert.equal(await f.events(), '')
  await f.control('resume')
  await until(async () => (await f.events()).includes('claim'))
  await f.control('drain')
  assert.equal((await f.control('status')).busy, 1)
  await writeFile(join(f.root, 'settle'), '')
  await until(async () => (await f.control('status')).busy === 0)
  await pause(50)
  assert.equal(await f.events(), 'claim\n')
  assert.equal((await f.control('status')).paused, true)
})

test('SIGTERM waits for an in-flight claim rather than aborting it', async t => {
  const f = await fixture(t)
  await f.control('resume')
  await until(async () => (await f.events()).includes('claim'))
  f.child.kill('SIGTERM')
  await pause(20)
  f.child.kill('SIGTERM')
  await pause(100); assert.equal(f.child.exitCode, null)
  await writeFile(join(f.root, 'settle'), '')
  await until(() => f.child.exitCode !== null)
  assert.equal(f.child.exitCode, 0)
  assert.equal(await f.events(), 'claim\n')
})

test('unknown claim outcome persists poison and candidate schema failure never admits work', async t => {
  const f = await fixture(t, { FIXTURE_CLAIM_ERROR: '1' })
  await f.control('resume')
  await until(async () => (await f.control('status')).uncertain)
  assert.match(await readFile(join(f.state, 'maintenance-uncertain'), 'utf8'), /reconcile/)
  assert.equal((await f.control('resume')).error, 'maintenance-unavailable')
  for (const failure of [{ FIXTURE_SCHEMA_BAD: '1' }, { FIXTURE_PROOF_MISSING: '1' }]) {
    const bad = await fixture(t, failure)
    assert.equal((await bad.control('status')).ready, false)
    assert.equal((await bad.control('resume')).error, 'maintenance-unavailable')
    assert.equal(await bad.events(), '')
  }
})


test('active inference keeps renewing while drained and SIGTERM waits for durable delivery', async t => {
  const f = await fixture(t, { FIXTURE_ACTIVE_JOB: '1' })
  await f.control('resume')
  await until(async () => (await f.events()).includes('inference-started'))
  await f.control('drain')
  await until(async () => (await f.events()).includes('lease-renewal'))
  assert.equal((await f.control('status')).busy, 1)
  f.child.kill('SIGTERM')
  await pause(100)
  assert.equal(f.child.exitCode, null)
  assert.doesNotMatch(await f.events(), /inference-aborted/)
  await writeFile(join(f.root, 'settle-inference'), '')
  await until(() => f.child.exitCode !== null)
  assert.equal(f.child.exitCode, 0)
  const events = await f.events()
  assert.equal(events.match(/claim/g)?.length, 1)
  assert.equal(events.match(/inference-started/g)?.length, 1)
  assert.match(events, /delivery/)
  assert.doesNotMatch(events, /inference-aborted/)
  const journal = JSON.parse(await readFile(join(f.state, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.json'), 'utf8'))
  assert.equal(journal.phase, 'delivered')
  assert.equal(journal.version, 3)
  const receipt = JSON.parse(await readFile(join(f.root, 'receipt.json'), 'utf8'))
  assert.equal(receipt.workerJobId, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')
  assert.deepEqual(receipt, journal.modelExecutionEvidence)
})
test('invalid task-ack is delivered once without inference retry and retains only the fixed diagnostic',async t=>{
 const f=await fixture(t,{FIXTURE_TASK_ACK:'1'})
 await f.control('resume')
 await until(async()=>(await f.events()).includes('delivery'))
 await f.control('drain');await pause(100)
 const events=await f.events()
 assert.equal(events.match(/inference-started/g)?.length,1)
 assert.equal(events.match(/delivery/g)?.length,1)
 const receipt=JSON.parse(await readFile(join(f.root,'ack-receipt.json'),'utf8'))
 assert.equal(receipt.p_reply,'');assert.equal(receipt.p_error,'task-ack-mention-required')
 const journal=JSON.parse(await readFile(join(f.state,'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.json'),'utf8'))
 assert.equal(journal.phase,'delivered');assert.equal(journal.error,null);assert.equal(journal.reply,'')
 assert.equal(journal.outputDiagnostic,'task-ack-mention-required')
 assert.doesNotMatch(JSON.stringify(journal),/Generated body|Synthetic Recipient/)
})


test('process loss during a claim leaves durable intent and restart cannot silently claim again', async t => {
  const f = await fixture(t)
  await f.control('resume')
  await until(async () => (await f.events()).includes('claim'))
  assert.match(await readFile(join(f.state, 'maintenance-inflight'), 'utf8'), /in flight/)
  f.child.kill('SIGKILL')
  await new Promise(done => f.child.once('exit', done))
  const restarted = spawn(process.execPath, [join(f.root, 'entry.mjs')], {env:f.env,stdio:['ignore','pipe','pipe']})
  let output = ''; restarted.stdout.on('data', data => { output += data })
  restarted.stderr.on('data', data => { output += data })
  t.after(() => restarted.kill('SIGKILL'))
  await until(() => output.includes('queue-connected'))
  const status = await f.control('status')
  assert.equal(status.uncertain, true)
  assert.equal(status.paused, true)
  assert.equal((await f.control('resume')).error, 'maintenance-unavailable')
  assert.equal((await f.events()).match(/claim/g)?.length, 1)
})


test('server-side working lease prevents admission even when the local worker is idle', async t => {
  const f = await fixture(t, { FIXTURE_FOREIGN_LEASE: '1' })
  const status = await f.control('status')
  assert.equal(status.busy, 0)
  assert.equal(status.activeJobs, 1)
  assert.equal((await f.control('resume')).error, 'maintenance-unavailable')
  assert.equal(await f.events(), '')
})


test('candidate without atomic trial delivery capability stays paused before any side effect', async t => {
  const f = await fixture(t, { FIXTURE_TRIAL_SCHEMA_BAD: '1' })
  assert.equal((await f.control('status')).ready, false)
  assert.equal((await f.control('resume')).error, 'maintenance-unavailable')
  assert.equal(await f.events(), '')
})


test('staffing claims share the real drain barrier and an uncertain staffing outcome poisons admission',async t=>{
 const f=await fixture(t,{FIXTURE_STAFFING_CLAIM_DELAY:'1'})
 await writeFile(join(f.root,'settle'),'')
 await f.control('resume')
 await until(async()=>(await f.events()).includes('staffing-dispatch'))
 await f.control('drain');assert.equal((await f.control('status')).busy,1)
 await writeFile(join(f.root,'settle-staffing'),'')
 await until(async()=>(await f.control('status')).busy===0)
 assert.equal(await f.events(),'claim\nstaffing-dispatch\n')
 assert.equal((await f.control('status')).paused,true)
 const failed=await fixture(t,{FIXTURE_STAFFING_CLAIM_ERROR:'1'})
 await writeFile(join(failed.root,'settle'),'');await failed.control('resume')
 await until(async()=>(await failed.control('status')).uncertain===true)
 assert.equal((await failed.control('status')).paused,true)
 assert.match(await readFile(join(failed.state,'maintenance-uncertain'),'utf8'),/reconcile/)
 assert.equal(await failed.events(),'claim\nstaffing-dispatch\n')
})
