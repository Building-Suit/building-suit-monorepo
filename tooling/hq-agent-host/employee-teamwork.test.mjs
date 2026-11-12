import test from 'node:test'
import assert from 'node:assert/strict'
import { drainWorkerJobs } from './worker.mjs'
const defer = () => { let resolve; const promise = new Promise(r => { resolve = r }); return { promise, resolve } }
const tick = () => new Promise(r => setImmediate(r))
test('two independent employees overlap; same employee queue and dependent handoff stay ordered', async () => {
  const release = defer(), started = [], finished = new Set()
  const jobs = [{id:'a1',agent_id:'a'}, {id:'b1',agent_id:'b'}, {id:'a2',agent_id:'a',depends:'a1'}, {id:'review',agent_id:'steve',depends:'a2'}]
  const busy = new Set()
  const run = drainWorkerJobs({capacity:2, admitting:()=>true, idle:()=>{},
    claim:async()=> {const i=jobs.findIndex(j=>!busy.has(j.agent_id)&&(!j.depends||finished.has(j.depends)));if(i<0)return {job:null};const [job]=jobs.splice(i,1);busy.add(job.agent_id);return {job}},
    work:async job=>{started.push(job.id);if(job.id==='a1'||job.id==='b1')await release.promise;finished.add(job.id);busy.delete(job.agent_id)}})
  await tick();assert.deepEqual(started,['a1','b1']);release.resolve();await run
  assert.deepEqual(started,['a1','b1','a2','review']);assert.equal(finished.size,4)
})
test('pause stops new claims but waits for both active jobs before returning', async()=>{
  const release=defer();let admit=true,claims=0,done=false
  const run=drainWorkerJobs({capacity:2,admitting:()=>admit,idle:()=>{},claim:async()=>({job:{id:String(++claims),agent_id:String(claims)}}),work:async()=>{await release.promise}}).then(()=>{done=true})
  await tick();admit=false;await tick();assert.equal(done,false);assert.equal(claims,2);release.resolve();await run;assert.equal(claims,2)
})
test('claim uncertainty drains started work and never claims again',async()=>{
  const release=defer();let claims=0,done=false
  const run=drainWorkerJobs({capacity:2,admitting:()=>true,idle:()=>{},claim:async()=>{if(++claims===2)throw Error('uncertain');return {job:{id:'1',agent_id:'a'}}},work:async()=>release.promise})
  const checked=assert.rejects(run,/uncertain/).then(()=>{done=true})
  await tick();assert.equal(done,false);release.resolve();await checked;assert.equal(claims,2)
})
test('duplicate active employee is rejected without starting duplicate inference',async()=>{
  const release=defer();let executions=0
  const run=drainWorkerJobs({capacity:2,admitting:()=>true,idle:()=>{},claim:async()=>({job:{id:'same',agent_id:'a'}}),work:async()=>{executions++;await release.promise}})
  const checked=assert.rejects(run,/duplicate-active-job/);await tick();release.resolve();await checked;assert.equal(executions,1)
})
test('legacy capacity one remains serial and task failure settles peers',async()=>{
  let calls=0,active=0,max=0
  await drainWorkerJobs({admitting:()=>true,idle:()=>{},claim:async()=>({job:++calls<=3?{id:String(calls),agent_id:String(calls)}:null}),work:async()=>{max=Math.max(max,++active);await tick();active--}})
  assert.equal(max,1)
  const release=defer();let claims=0,settled=false
  const run=drainWorkerJobs({capacity:2,admitting:()=>true,idle:()=>{},claim:async()=>({job:{id:String(++claims),agent_id:String(claims)}}),work:async j=>{if(j.id==='1')throw Error('work-failed');await release.promise;settled=true}})
  const checked=assert.rejects(run,/work-failed/);await tick();assert.equal(settled,false);release.resolve();await checked;assert.equal(settled,true);assert.equal(claims,2)
})
test('fast completed employee may immediately receive next queued task',async()=>{
 let claims=0;const started=[]
 await drainWorkerJobs({capacity:2,admitting:()=>true,idle:()=>{},claim:async()=>{await tick();return {job:++claims<5?{id:String(claims),agent_id:'a'}:null}},work:async job=>{started.push(job.id)}})
 assert.deepEqual(started,['1','2','3','4'])
})
test('committed delivery with delayed response serializes the same employee locally',async()=>{
 const release=defer();let claims=0;const started=[]
 const run=drainWorkerJobs({capacity:2,admitting:()=>true,idle:()=>{},claim:async()=>({job:++claims<=2?{id:String(claims),agent_id:'a'}:null}),work:async j=>{started.push(j.id);if(j.id==='1')await release.promise}})
 await tick();assert.deepEqual(started,['1']);release.resolve();await run;assert.deepEqual(started,['1','2'])
})
