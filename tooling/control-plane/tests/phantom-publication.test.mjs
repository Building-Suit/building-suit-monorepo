import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,rmSync,readFileSync} from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {classifyHealth} from '../runner/dot-health-state.mjs'
import {planSupervisorStep} from '../runner/task-supervisor.mjs'
import {dispatchRecovery} from '../runner/dot-general-recovery.mjs'
import {receiptPaths,atomicJson,startReceipt,readJson,processStamp} from '../runner/durable-process.mjs'
import {classifyPublicationFiles} from '../runner/publication-preflight.mjs'
import {observeProcesses} from '../runner/dot-health-collector.mjs'
const now=Date.now(),past=new Date(now-120_000).toISOString(),future=new Date(now+120_000).toISOString()
const input=()=>({key:'run:original',run:{run_id:'original',status:'running',max_tasks:2,completed_tasks:0},task:{task_id:'SHELL',status:'passed'},execution:{execution_id:309,attempt:5,status:'failed',finished_at:past},verification:{status:'passed',finished_at:past},operation:{operation_id:'publication',action:'task-publish'},recovery:{status:'active',next_action:'wait-external',next_wake_at:past},policy:{max_attempts:5}})
test('reaccepted verification PASS enters publication without another product execution',()=>{
 const snapshot={packet:{task:{task_id:'SHELL',status:'passed'}},executions:[{execution_id:309,attempt:5,status:'failed'}],verification_runs:[{execution_id:309,verification_run_id:307,status:'passed',metadata:{verifier_only_reacceptance:true}}],publication_execution_eligible:true,run_publication_authority:{authorized:true,mode:'ordinary-draft',run_id:'original',task_id:'SHELL',contract_fingerprint:'current'}}
 const plan=planSupervisorStep(snapshot)
 assert.equal(plan.command,'task-publish')
 const source=readFileSync(new URL('../runner/bs-agent.mjs',import.meta.url),'utf8')
 assert.ok(source.indexOf("SELECT :'task_id','publication_started'")<source.indexOf('    const publisher ='))
 assert.ok(source.includes("payload->>'operation_id'=:'op'"))
})
test('live wrapper with stale publisher receipt cannot display PUBLISHING',()=>{
 const row=classifyHealth(input(),{operation_alive:true,publisher:{alive:true,heartbeat_at:past,deadline_at:future}},now)
 assert.equal(row.state,'STUCK');assert.equal(row.operator_action_required,false)
 assert.equal(row.recovery_owner,'Dot');assert.equal(row.recovery_action,'publication-handoff')
})
test('publisher dies before first DB event: restart settles the same immutable receipt',()=>{
 const root=mkdtempSync(path.join(os.tmpdir(),'phantom-pub-'))
 try{const paths=receiptPaths(root,'publication');atomicJson(paths.state,{pid:99999999,start_stamp:'dead',child:{pid:99999998,start_stamp:'dead'}})
 const first=startReceipt(paths,{program:process.execPath,args:['-e','throw Error("must not spawn")'],cwd:root})
 assert.equal(first.settled,true);assert.equal(readJson(paths.result).error,'receipt_writer_interrupted')
 assert.equal(startReceipt(receiptPaths(root,'publication'),{}).settled,true)
 assert.equal(classifyHealth(input(),{operation_alive:false},now).state,'STUCK')
 }finally{rmSync(root,{recursive:true,force:true})}
})
test('expired next-check requires recovery even with a fresh publisher heartbeat before first event',()=>{
 const row=classifyHealth(input(),{operation_alive:true,publisher:{alive:true,heartbeat_at:new Date(now).toISOString(),deadline_at:future}},now)
 assert.equal(row.state,'STUCK');assert.match(row.why,/check expired/)
})
test('duplicate watchdog cycles and restart claim only one same-run publication incident',async()=>{
 const health=classifyHealth(input(),{operation_alive:true},now),persisted=new Set(),started=[]
 const cycle=()=>dispatchRecovery({health,snapshot:{packet:{task:{status:'passed'}},verification_runs:[{status:'passed'}]},now,claim:async(run,key,family)=>{assert.equal(run,'original');assert.equal(family,'publication-handoff');if(persisted.has(key))return {claimed:false};persisted.add(key);return {claimed:true,job:{key}}},start:async job=>started.push(job)})
 await cycle();await cycle();await cycle();assert.equal(started.length,1)
})
test('health requires a current publisher receipt, fresh heartbeat and enforced deadline',()=>{
 const s=input();s.publication_started={operation_id:'publication',at:past}
 const process={operation_alive:true,publisher:{alive:true,receipt_id:'receipt:0',heartbeat_at:new Date(now).toISOString(),deadline_at:future}}
 const row=classifyHealth(s,process,now);assert.equal(row.state,'PUBLISHING');assert.equal(row.publisher.receipt_id,'receipt:0')
 assert.equal(classifyHealth(s,{...process,publisher:{...process.publisher,deadline_at:past}},now).state,'STUCK')
 assert.equal(classifyHealth(s,{operation_alive:true},now).state,'STUCK')
})
test('ordinary run grant permits only registered ordinary paths; protected paths and drift stay gated',()=>{
 const args={files:['packages/ux/src/index.ts','docs/shared/shell.md','apps/shop-suit/app.vue','packages/ux/.env'],taskPaths:['packages/ux/**','docs/shared/**'],projectPaths:['packages/','docs/','apps/'],workstreamPaths:['packages/ui/']}
 const scoped=classifyPublicationFiles({...args,ordinaryRunAuthorized:true})
 assert.deepEqual(scoped.allowed,['docs/shared/shell.md','packages/ux/src/index.ts']);assert.deepEqual(scoped.waiting,['apps/shop-suit/app.vue']);assert.deepEqual(scoped.blocked,['packages/ux/.env'])
 assert.equal(classifyPublicationFiles(args).allowed.length,0)
})
test('publisher inventory observes nested PID-stamped receipt rather than outer wrapper',()=>{
 const root=mkdtempSync(path.join(os.tmpdir(),'publisher-observe-'))
 try{const s=input(),paths=receiptPaths(path.join(root,'.local/runtime-receipts'),'publication:publisher');atomicJson(paths.state,{child:{pid:process.pid,start_stamp:processStamp(process.pid)},heartbeat_at:new Date(now).toISOString(),deadline_at:future})
 const observed=observeProcesses(s,root,[],now);assert.equal(observed.publisher.alive,true);assert.ok(observed.publisher.receipt_id);assert.equal(observed.operation_alive,false)
 }finally{rmSync(root,{recursive:true,force:true})}
})
test('health page renders publisher evidence and changes stale evidence to STUCK',async()=>{
 const {chromium}=await import('@playwright/test'),browser=await chromium.launch({headless:true})
 try{const page=await browser.newPage(),s=input();s.publication_started={operation_id:'publication',at:past}
 let row=classifyHealth(s,{publisher:{alive:true,receipt_id:'receipt:0',heartbeat_at:new Date(now).toISOString(),deadline_at:future}},now)
 await page.route('http://dot.fixture/api/status',r=>r.fulfill({json:{rows:[row],alerts:[],collected_at:new Date(now).toISOString()}}))
 await page.route('http://dot.fixture/',r=>r.fulfill({contentType:'text/html',body:readFileSync(new URL('../runner/dot-health.html',import.meta.url),'utf8')}))
 await page.goto('http://dot.fixture/');await page.waitForFunction(()=>document.body.textContent.includes('receipt:0'))
 const text=await page.locator('#runs').innerText();for(const value of ['Publisher operation publication','Receipt receipt:0','Heartbeat','Publication started','Next recovery check'])assert.ok(text.includes(value))
 assert.equal(await page.locator('.badge').first().innerText(),'PUBLISHING')
 row=classifyHealth(s,{operation_alive:true,publisher:{alive:true,heartbeat_at:past,deadline_at:future}},now)
 await page.reload();await page.waitForFunction(()=>document.querySelector('.badge')?.textContent==='STUCK')
 assert.equal(await page.locator('.badge').first().innerText(),'STUCK')
 }finally{await browser.close()}
})
