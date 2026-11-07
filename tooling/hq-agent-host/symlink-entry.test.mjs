/** Real Node main/import dispatch through disposable release links; no network or model. */
import test from 'node:test'
import assert from 'node:assert/strict'
import { spawn, execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { connect } from 'node:net'
import { mkdtemp, mkdir, copyFile, writeFile, readFile, rm, symlink, rename } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createHash, randomUUID } from 'node:crypto'
import { REQUIRED_RPCS } from './maintenance.mjs'
import { fake } from './test-cli.mjs'
const run = promisify(execFile), pause = ms => new Promise(done => setTimeout(done, ms))
const files = ['worker.mjs', 'maintenance.mjs', 'departmentWorkflow.mjs', 'workforceRoster.mjs', 'brainPublisher.mjs']
const digest = bytes => createHash('sha256').update(bytes).digest('hex')
async function until(check) {
  const end = Date.now() + 8000
  while (Date.now() < end) { const value = await check(); if (value) return value; await pause(20) }
  throw Error('symlink-fixture-timeout')
}
async function setup(t) {
  const root = await mkdtemp(join(tmpdir(), 'hq-symlink-main-')), a = 'a'.repeat(40), b = 'b'.repeat(40)
  t.after(() => rm(root, {recursive:true,force:true}))
  for (const sha of [a,b]) {
    const directory = join(root,'releases',sha); await mkdir(directory,{recursive:true})
    for (const name of files) await copyFile(new URL(name,import.meta.url),join(directory,name))
    if (sha === b) await writeFile(join(directory,'worker.mjs'),(await readFile(join(directory,'worker.mjs'),'utf8'))+'\n// Different disposable release bytes.\n')
    const contents = Object.fromEntries(await Promise.all(files.map(async name => { const bytes = await readFile(join(directory,name)); return [name,{sha256:digest(bytes),bytes:bytes.length}] })))
    await writeFile(join(directory,'manifest.json'),JSON.stringify({format:1,sha,files:contents}))
  }
  for (const [link,sha] of [['current',a],['candidate',b]]) await symlink('releases/'+sha,join(root,link),'dir')
  const api = {version:1,role:'authenticated',schemaUsage:true,execute:true,rpcs:REQUIRED_RPCS}
  const preload = join(root,'fixture.mjs')
  await writeFile(preload,`
import {appendFile} from 'node:fs/promises'
const api=${JSON.stringify(api)},log=${JSON.stringify(join(root,'calls'))}
globalThis.fetch=async url=>{
 let body,kind
 if(url.includes('/auth/')){kind='auth';body={access_token:'fixture-access',refresh_token:'fixture-refresh',expires_in:3600}}
 else if(url.endsWith('/rest/v1/')){return new Response(JSON.stringify({error:'api-key',category:'privileged-key-required'}),{status:401})}
 else if(url.endsWith('/hq_worker_release_status')){kind='status';body={api,contract:2,trialDelivery:1,trialSkills:1,trialFailureSettlement:1,activeJobs:0};if(process.env.FIXTURE_BAD_SCHEMA)delete body.api.rpcs.hq_worker_claim}
 else throw Error('unexpected-fixture-request')
 await appendFile(log,kind+'\\n');return new Response(JSON.stringify(body))
}
globalThis.WebSocket=class extends EventTarget{
 static OPEN=1;readyState=1
 constructor(){super();setTimeout(()=>this.dispatchEvent(new Event('open')),5)}
 send(raw){const f=JSON.parse(raw);if(f.event==='phx_join')setTimeout(()=>{
 const emit=value=>this.dispatchEvent(new MessageEvent('message',{data:JSON.stringify(value)}))
 emit({topic:f.topic,ref:f.ref,event:'phx_reply',payload:{status:'ok'}})
 emit({topic:f.topic,event:'system',payload:{status:'ok',extension:'system',message:'Replication connection established'}})
 },5)}
 close(){this.readyState=3}
}
`)
  const env={PATH:process.env.PATH,LANG:'C.UTF-8',HQ_RELEASE_MANAGED:'1',HQ_WORKER_STATE_DIR:join(root,'state'),
    HQ_SUPABASE_URL:'https://dpruoncalmwicrqhqelu.supabase.co',HQ_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_fixture',
    HQ_WORKER_ID:randomUUID(),HQ_WORKER_EMAIL:'synthetic@example.invalid',HQ_WORKER_PASSWORD:'synthetic-password-never-real-12345'}
  const calls=async()=>{try{return await readFile(join(root,'calls'),'utf8')}catch{return ''}}
  return {root,a,b,preload,env,calls}
}
async function unitArguments(name,link) {
  const source=await readFile(new URL(name,import.meta.url),'utf8')
  const argv=source.split('\n').find(line=>line.startsWith('ExecStart=')).slice(10).split(' ')
  assert.deepEqual(argv,['/opt/building-suit-hq-agent-control/bin/node','--preserve-symlinks-main',
    '/opt/building-suit-hq-agent-host/'+link+'/worker.mjs',...(link==='candidate'?['--release-preflight']:[])])
  return argv.slice(1,2)
}
function status(root) {
  return new Promise((done,fail)=>{
    const client=connect(join(root,'state','maintenance.sock'));let body=''
    client.setTimeout(2000,()=>client.destroy(Error('fixture-socket-timeout')))
    client.once('error',fail);client.once('connect',()=>client.write('{"action":"status"}\n'))
    client.on('data',data=>{body+=data});client.once('end',()=>done(JSON.parse(body)))
  })
}
test('real candidate main reproduces false zero exit without flag; fixed preflight actually validates',async t=>{
  const f=await setup(t),entry=join(f.root,'candidate','worker.mjs')
  const discovery=await run(process.execPath,['--import',f.preload,'--input-type=module','-e',
    "const r=await fetch('https://fixture.invalid/rest/v1/');process.stdout.write(String(r.status))"],{env:f.env,timeout:5000})
  assert.equal(discovery.stdout,'401','publishable fixture cannot discover privileged OpenAPI')
  const old=await run(process.execPath,['--import',f.preload,entry,'--release-preflight'],{env:f.env,timeout:5000})
  assert.equal(old.stdout,'');assert.equal(await f.calls(),'','unfixed symlink dispatch falsely exited zero without preflight')
  const args=await unitArguments('company-hq-worker-preflight.service.example','candidate')
  const checked=await run(process.execPath,[...args,'--import',f.preload,entry,'--release-preflight'],{env:f.env,timeout:5000})
  assert.deepEqual(JSON.parse(checked.stdout),{contract:2});assert.equal(await f.calls(),'auth\nstatus\n')
  await assert.rejects(()=>run(process.execPath,[...args,'--import',f.preload,entry,'--release-preflight'],
    {env:{...f.env,FIXTURE_BAD_SCHEMA:'1'},timeout:5000}),error=>error.code===1&&error.stdout.includes('worker-unavailable'))
  const dependency=join(f.root,'releases',f.b,'departmentWorkflow.mjs')
  await rename(dependency,dependency+'.held')
  await assert.rejects(()=>run(process.execPath,[...args,'--import',f.preload,entry,'--release-preflight'],{env:f.env,timeout:5000}),error=>error.code===1&&error.stderr.includes('ERR_MODULE_NOT_FOUND'))
})
test('real current main starts paused, reads the selected manifest and follows atomic release switching',async t=>{
  const f=await setup(t),args=await unitArguments('company-hq-worker.service.example','current')
  for (const sha of [f.a,f.b]) {
    if(sha===f.b){await symlink('releases/'+sha,join(f.root,'current.next'),'dir');await rename(join(f.root,'current.next'),join(f.root,'current'))}
    const child=spawn(process.execPath,[...args,'--import',f.preload,join(f.root,'current','worker.mjs')],{env:f.env,stdio:['ignore','pipe','pipe']})
    let output='';child.stdout.on('data',data=>{output+=data});child.stderr.on('data',data=>{output+=data})
    t.after(()=>{if(child.exitCode===null)child.kill('SIGKILL')})
    await until(()=>output.includes('queue-connected'))
    const health=await status(f.root)
    assert.equal(health.pid,child.pid);assert.equal(health.release,sha);assert.equal(health.ready,true)
    assert.equal(health.paused,true);assert.equal(health.busy,0);assert.equal(health.activeJobs,0)
    assert.match(await f.calls(),/auth\nstatus/);assert.doesNotMatch(await f.calls(),/claim|roster|lesson|presence/)
    child.kill('SIGTERM');await until(()=>child.exitCode!==null);assert.equal(child.exitCode,0)
  }
})
test('direct symlink imports stay inert and trial source digest matches the imported release bytes',async t=>{
  const f=await setup(t),url=pathToFileURL(join(f.root,'candidate','worker.mjs')).href
  const inert=await run(process.execPath,['--preserve-symlinks-main','--import',f.preload,'--input-type=module','-e',
    `await import(${JSON.stringify(url)});process.stdout.write('imported')`],{env:f.env,timeout:5000})
  assert.equal(inert.stdout,'imported');assert.equal(await f.calls(),'')
  const job={id:randomUUID(),agent_id:'AG-HR-002',context:{mode:'worker-trial',task:{id:randomUUID()},
    agent:{id:'AG-HR-002',model:'gpt-6.1-terra',effort:'medium',profileFileId:'profile_source_1'},
    supervisedTrial:{id:randomUUID(),scope:'synthetic-internal-trial-v1'}}}
  job.context.supervisedTrial.taskId=job.context.task.id;job.context.supervisedTrial.agentId=job.agent_id
  const observed=await fake([],async config=>{
    const script=`import {invokeCodex} from ${JSON.stringify(url)};const out=await invokeCodex(${JSON.stringify({...config,id:f.env.HQ_WORKER_ID})},${JSON.stringify(job)},[],AbortSignal.timeout(5000));process.stdout.write(JSON.stringify(out.modelBindingEvidence))`
    return run(process.execPath,['--preserve-symlinks-main','--input-type=module','-e',script],{env:{PATH:process.env.PATH},timeout:7000})
  },{cliVersion:'codex-cli 0.160.0'})
  const evidence=JSON.parse(observed.stdout),manifest=JSON.parse(await readFile(join(f.root,'candidate','manifest.json'),'utf8'))
  assert.equal(evidence.workerSourceDigest,manifest.files['worker.mjs'].sha256)
  assert.equal(evidence.workerSourceDigest,digest(await readFile(join(f.root,'releases',f.b,'worker.mjs'))))
  assert.equal(evidence.attestationLevel,'host-returned-resolution');assert.equal(await f.calls(),'')
})
