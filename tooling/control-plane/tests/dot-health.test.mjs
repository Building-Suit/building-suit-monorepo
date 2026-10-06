import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync,readFileSync,rmSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { classifyHealth } from '../runner/dot-health-state.mjs'
import { collectHealth,healthQuery,workerInventory,readHealth } from '../runner/dot-health-collector.mjs'
import { receiptPaths,startReceipt,readJson } from '../runner/durable-process.mjs'
const now=Date.parse('2026-10-06T16:00:00Z'),past=new Date(now-300000).toISOString(),future=new Date(now+300000).toISOString()
const fixture=()=>({key:'run:original',run:{run_id:'original',status:'running',current_task_id:'TASK',completed_tasks:0,max_tasks:2,workstream_slug:'shared'},task:{task_id:'TASK',status:'in_progress'},execution:{execution_id:299,attempt:1,status:'running',started_at:past,model_name:'gpt-6.1-sol',model_profile:'standard'},policy:{max_attempts:5},last_progress_at:past})
for(const [name,alter,process,expected] of [
 ['live worker',()=>{}, {worker_alive:true},'RUNNING'],
 ['dead worker',()=>{},{worker_alive:false},'STUCK'],
 ['valid infrastructure timer',s=>{s.recovery={next_wake_at:future,error_code:'worker_transport_interrupted'}},{},'WAITING_TIMER'],
 ['human gate',s=>{s.recovery={status:'active',next_action:'wait-operator',error_code:'missing_credentials'}},{},'WAITING_OPERATOR'],
 ['active verifier',()=>{},{worker_alive:true,phase:'verification'},'VERIFYING'],
 ['active repair',s=>{s.operation={action:'task-retry'}},{worker_alive:true},'REPAIRING'],
 ['publisher',s=>{s.execution.status='succeeded';s.operation={action:'task-publish',operation_id:'pub'};s.publication_started={operation_id:'pub',at:new Date(now).toISOString()}},{operation_alive:true},'PUBLISHING'],
 ['legitimate exhaustion',s=>{s.execution.status='failed';s.task.status='failed';s.accounting={all_product:true,consumed:5};s.recovery={status:'active',error_code:'retry_budget_exhausted',next_action:'wait-operator',condition:{exhaustion_audit:{all_attempts_audited:true,action:'operator-gate',root_cause:'AssertionError: shell accessibility',required_authorization:'Authorize bounded repair'}}}},{},'WAITING_OPERATOR'],
 ['completed run',s=>{s.run.completed_tasks=2},{},'COMPLETE'],
 ['null current with eligible task',s=>{s.task=null;s.execution=null;s.run.current_task_id=null;s.next_eligible_task='NEXT'},{},'STUCK'],
 ['passed without publication',s=>{s.execution.status='succeeded';s.task.status='passed';s.verification={status:'passed',finished_at:past}},{},'STUCK'],
 ['completed task without credit',s=>{s.execution.status='succeeded';s.task.status='complete'},{},'STUCK'],
 ['expired unowned lease',s=>{s.execution=null;s.run.controller_lease_expires_at=past},{},'STUCK'],
 ['overdue wake',s=>{s.execution=null;s.recovery={status:'active',next_action:'wait-external',next_wake_at:past}},{},'STUCK'],
 ['deadline missed while process remains alive',()=>{},{worker_alive:true,worker:{deadline_at:past}},'STUCK'],
 ['pending dependency',s=>{s.run=null;s.execution=null;s.task.status='planned';s.blocking_dependency=true},{},'WAITING_DEPENDENCY'],
])test(`health ${name} => ${expected}`,()=>{const s=fixture();alter(s);const r=classifyHealth(s,process,now);assert.equal(r.state,expected);assert.equal(r.llm_used,false)})
test('controller renewals cannot masquerade as meaningful progress',()=>{const s=fixture();s.run.updated_at=new Date(now).toISOString();s.run.controller_lease_expires_at=future;const r=classifyHealth(s,{},now);assert.equal(r.state,'STUCK');assert.equal(r.last_progress_at,past)})
test('restart reconstructs the same health solely from authoritative state and receipts',()=>{const s=fixture();const observation={worker_alive:true,worker:{pid:123,start_stamp:'456',started_at:past},observed_at:new Date(now).toISOString()};assert.deepEqual(classifyHealth(JSON.parse(JSON.stringify(s)),JSON.parse(JSON.stringify(observation)),now),classifyHealth(s,observation,now))})
test('healthy status collection performs only SQL reads/health persistence and never invokes Codex',()=>{const root=mkdtempSync(path.join(os.tmpdir(),'health-no-llm-'));try{const calls=[];const s=fixture();s.execution.status='succeeded';s.task.status='passed';const rows=collectHealth({root,now,inventory:[],query:sql=>{calls.push(sql);return calls.length===1?[s]:1}});assert.equal(rows.length,1);assert.equal(calls.length,2);assert.ok(calls[1].includes('record_dot_health'));assert.ok(!calls[1].includes('UPDATE control.tasks'))
 const programs=[];healthQuery('SELECT 1;', {BS_CONTROL_DB_HOST:'fixture',BS_CONTROL_DB_PORT:'123',BS_CONTROL_DB_USER:'fixture',BS_CONTROL_DB_NAME:'fixture'},(program)=>{programs.push(program);return {status:0,stdout:'1'}});assert.deepEqual(programs,['psql'])
 }finally{rmSync(root,{recursive:true,force:true})}})
test('persisted worker heartbeat/deadline/output/exit receipt and secret-free health inventory',async()=>{const root=mkdtempSync(path.join(os.tmpdir(),'health-heartbeat-'));try{const paths=receiptPaths(path.join(root,'.local/runtime-receipts'),'heartbeat');startReceipt(paths,{program:process.execPath,args:['-e',"console.log('private-fixture-output');setTimeout(()=>{},5500)"],cwd:root,timeout:10000});const until=async fn=>{for(let i=0;i<400;i++){const value=fn();if(value)return value;await new Promise(r=>setTimeout(r,20))}throw Error('fixture_timeout')};const first=await until(()=>readJson(paths.state)?.heartbeat_at?readJson(paths.state):null);const next=await until(()=>{const s=readJson(paths.state);return Date.parse(s?.heartbeat_at)>Date.parse(first.heartbeat_at)+1000?s:null});assert.ok(next.child.pid);assert.ok(next.last_output_at);assert.ok(next.deadline_at);const result=await until(()=>readJson(paths.result));assert.equal(result.code,0);assert.equal(readJson(paths.state).worker_state,'exited');assert.equal(workerInventory(root).length,0);assert.ok(!JSON.stringify(workerInventory(root)).includes('private-fixture-output'));assert.ok(readFileSync(paths.state,'utf8').includes('heartbeat_at'))}finally{rmSync(root,{recursive:true,force:true})}})

test('current run observation supersedes historical task-only human gate without deleting history',()=>{
 const historical={key:'task:TASK',task_id:'TASK',run_id:null,state:'STUCK',operator_action_required:true}
 const current={key:'run:original',task_id:'TASK',run_id:'original',state:'WAITING_TIMER',operator_action_required:false}
 const unrelated={key:'task:OTHER',task_id:'OTHER',run_id:null,state:'WAITING_OPERATOR',operator_action_required:true}
 const persisted=[historical,current,unrelated]
 const result=readHealth(()=>({rows:[...persisted]}))
 assert.deepEqual(result.rows,[current,unrelated]);assert.equal(persisted.length,3)
})
