import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,rmSync,readFileSync} from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {spawnSync} from 'node:child_process'
import {createHealthCache} from '../runner/dot-health-cache.mjs'
import {requiresWatchdogAction,cycleEvidenceCache,currentStateSql,healthOverview} from '../runner/dot-current-state.mjs'
import {classifyHealth} from '../runner/dot-health-state.mjs'
import {recordEgress,readEgress} from '../runner/dot-egress-telemetry.mjs'
const now=Date.now(),past=new Date(now-300000).toISOString(),future=new Date(now+300000).toISOString()
const fixture=()=>({key:'run:original',run:{run_id:'original',status:'running',workstream_slug:'shared',current_task_id:'TASK',completed_tasks:1,max_tasks:4},task:{task_id:'TASK',status:'in_progress'},execution:{execution_id:1,attempt:1,status:'running',started_at:past},policy:{max_attempts:5}})
test('hundreds of cached browser refreshes cannot execute hosted SQL; inflight requests coalesce',async()=>{
 const root=mkdtempSync(path.join(os.tmpdir(),'egress-cache-'));let queries=0,resolve
 try{const cache=createHealthCache({root,load:()=>{queries++;return new Promise(r=>resolve=r)}})
 const a=cache.refresh(),b=cache.refresh();for(let i=0;i<500;i++)cache.read();assert.equal(queries,1)
 resolve({rows:[{run_id:'original'}],collected_at:new Date(now).toISOString()});await Promise.all([a,b]);for(let i=0;i<500;i++)assert.equal(cache.read().rows[0].run_id,'original');assert.equal(queries,1)
 cache.publish({rows:[{run_id:'same-run'}],collected_at:new Date(now+1).toISOString()});assert.equal(cache.read().rows[0].run_id,'same-run');assert.equal(queries,1)
 assert.equal(readEgress(root).last_hour.health.cache_hits,1001)
 }finally{rmSync(root,{recursive:true,force:true})}
})
test('failure retains cache and later event refresh restores it',async()=>{let fail=false;const cache=createHealthCache({load:async()=>{if(fail)throw Error('db unavailable');return healthOverview([],now)}});await cache.refresh();fail=true;await cache.refresh();assert.match(cache.read().collector_error,/retained/);assert.equal(cache.read().collected_at,new Date(now).toISOString());fail=false;await cache.refresh();assert.equal(cache.read().collector_error,null)})
test('same cycle loads evidence once; explicit state transition invalidates it',()=>{let calls=0;const cache=cycleEvidenceCache(()=>({id:++calls}));assert.equal(cache.get('TASK'),cache.get('TASK'));assert.equal(calls,1);cache.invalidate('TASK');assert.equal(cache.get('TASK').id,2)})
for(const [name,edit,process,action] of [
 ['healthy worker',()=>{},{worker_alive:true},false],
 ['dead worker',()=>{},{},true],
 ['overdue worker',()=>{},{worker_alive:true,worker:{deadline_at:past}},true],
 ['future timer',x=>{x.recovery={next_wake_at:future,error_code:'worker_transport_interrupted'}},{},false],
 ['expired timer',x=>{x.recovery={next_wake_at:past,error_code:'worker_transport_interrupted'}},{},true],
 ['exact human gate',x=>{x.recovery={status:'active',next_action:'wait-operator',error_code:'exact_approval_required'}},{},false],
 ['completion credit',x=>{x.task.status='complete';x.execution.status='succeeded'},{},true],
 ['publication handoff',x=>{x.task.status='passed';x.execution.status='succeeded';x.verification={status:'passed',finished_at:past}},{},true],
 ['unknown failure',x=>{x.task.status='failed';x.execution.status='failed'},{},true],
])test('compact watchdog decision preserves '+name,()=>{const input=fixture();edit(input);assert.equal(requiresWatchdogAction(input,classifyHealth(input,process,now),now),action)})
test('rolling counters are local, omit payloads and expire old samples',()=>{const root=mkdtempSync(path.join(os.tmpdir(),'egress-telemetry-'));try{recordEgress('bs31',{queries:2,bytes:1234,secret:'never'},root,now-7200000);recordEgress('bs31',{queries:1,bytes:4321},root,now);const result=readEgress(root,now);assert.equal(result.last_hour.bs31.bytes,4321);assert.equal(result.last_24h.bs31.queries,3);assert.ok(!JSON.stringify(result).includes('never'))}finally{rmSync(root,{recursive:true,force:true})}})
test('overview payload budgets and SQL exclude preemptive history',()=>{const rows=Array.from({length:20},(_,i)=>classifyHealth({...fixture(),key:'run:'+i}, {worker_alive:true},now));for(const row of rows)assert.ok(Buffer.byteLength(JSON.stringify(row))<=15*1024);assert.ok(Buffer.byteLength(JSON.stringify(healthOverview(rows)))<=100*1024)
 assert.doesNotMatch(currentStateSql(),/SELECT \*|to_jsonb\((t|e|v|r|o|p)\)/);assert.doesNotMatch(currentStateSql(),/verification_plan|acceptance_criteria|run_log_path|\.metadata/)
 const server=readFileSync(new URL('../runner/dot-health-server.mjs',import.meta.url),'utf8');assert.match(server,/LIMIT 25/);const browser=readFileSync(new URL('../runner/dot-health.html',import.meta.url),'utf8');assert.match(browser,/history-section.*ontoggle/);assert.match(browser,/setInterval\(refresh,60000\)/)
})
// Actual PostgreSQL projection, with 100 old 100 KB verification rows and a 1 MB
// current metadata/description. This only runs in an explicitly disposable DB.
test('large synthetic history is excluded by PostgreSQL, not JS filtering',{skip:!process.env.CP_EGRESS_TEST_DATABASE},()=>{
 const database=process.env.CP_EGRESS_TEST_DATABASE;assert.match(database,/^cp_egress_/)
 const invoke=sql=>{const r=spawnSync('docker',['exec','-i',process.env.CP_EGRESS_TEST_CONTAINER??'cp-remediation-disposable-20261007','psql','-U','postgres','-d',database,'-XqAt','-v','ON_ERROR_STOP=1'],{input:sql,encoding:'utf8',maxBuffer:2*1024*1024});assert.equal(r.status,0,r.stderr);return r.stdout}
 const sql=`BEGIN;SET LOCAL session_replication_role=replica;
 INSERT INTO control.tasks(task_id,suit_slug,project_id,workstream_slug,title,status,retry_policy_id,description,acceptance_criteria,verification_plan,metadata) SELECT 'CP-EGRESS-001','ledger-suit',project_id,'ledger-suit','Synthetic','in_progress','standard-five',repeat('DO_NOT_DOWNLOAD',80000),jsonb_build_array(repeat('DO_NOT_DOWNLOAD',80000)),jsonb_build_array(repeat('DO_NOT_DOWNLOAD',80000)),jsonb_build_object('history',repeat('DO_NOT_DOWNLOAD',80000)) FROM control.projects WHERE slug='building-suit';
 INSERT INTO control.workflow_runs(run_id,suit_slug,project_id,workstream_slug,current_task_id,max_tasks) SELECT 'a0000000-0000-4000-8000-000000000001','ledger-suit',project_id,'ledger-suit','CP-EGRESS-001',4 FROM control.projects WHERE slug='building-suit';
 INSERT INTO control.executions(task_id,attempt,model_profile,status,metadata,started_at) VALUES('CP-EGRESS-001',1,'standard','running',jsonb_build_object('logs',repeat('DO_NOT_DOWNLOAD',80000)),now());
 INSERT INTO control.verification_runs(execution_id,status,metadata) SELECT execution_id,'failed',jsonb_build_object('logs',repeat('DO_NOT_DOWNLOAD',8000)) FROM control.executions CROSS JOIN generate_series(1,100) WHERE task_id='CP-EGRESS-001';
 SET LOCAL session_replication_role=origin;
 ${currentStateSql()}
 ROLLBACK;`
 const result=invoke(sql);assert.ok(!result.includes('DO_NOT_DOWNLOAD'));const inputs=JSON.parse(result.trim());const row=inputs.find(x=>x.run?.run_id==='a0000000-0000-4000-8000-000000000001');assert.ok(row);assert.ok(Buffer.byteLength(JSON.stringify(row))<=25*1024);assert.equal(row.execution.attempt,1);assert.ok(!row.task.verification_plan);assert.ok(!row.verification.metadata)
})
test('pooled health session serializes concurrent queries, bounds errors and reconnects',{timeout:10000},async()=>{
 const {createPostgresSession}=await import('../runner/dot-postgres-session.mjs');const {writeFileSync,chmodSync}=await import('node:fs');const root=mkdtempSync(path.join(os.tmpdir(),'egress-session-'));const program=path.join(root,'psql');
 writeFileSync(program,`#!/usr/bin/env node\nconst {createInterface}=require('node:readline');createInterface({input:process.stdin}).on('line',line=>{if(line.startsWith('BAD')){process.stderr.write('private server diagnostic');process.exit(1)}else if(line.startsWith('SELECT'))console.log('{"ok":true}');else if(line.startsWith('\\\\echo '))console.log(line.slice(6))})`);chmodSync(program,0o700)
 const session=createPostgresSession({...process.env,PATH:root+':'+process.env.PATH,BS_CONTROL_REPOSITORY_ROOT:root,BS_CONTROL_DB_HOST:'fixture',BS_CONTROL_DB_PORT:'1',BS_CONTROL_DB_USER:'fixture',BS_CONTROL_DB_NAME:'fixture'})
 try{const rows=await Promise.all(Array.from({length:10},()=>session.query('SELECT fixture;')));assert.ok(rows.every(r=>r.ok));assert.equal(readEgress(root).last_hour.health.connections,1);assert.equal(readEgress(root).last_hour.health.queries,10);await assert.rejects(session.query('BAD;'),/connection_closed/);assert.equal((await session.query('SELECT recovered;')).ok,true);assert.equal(readEgress(root).last_hour.health.connections,2);assert.ok(!JSON.stringify(readEgress(root)).includes('private'))}finally{session.close();rmSync(root,{recursive:true,force:true})}
})
test('event bursts and fallback do not prefetch evidence for a live incident lease; due local receipts still progress',()=>{const input=fixture();input.execution.status='failed';input.task.status='failed';input.incident_recovery={status:'queued',claim_until:future,next_check_at:future};const health=classifyHealth(input,{},now);for(let i=0;i<20;i++)assert.equal(requiresWatchdogAction(input,health,now),false);input.recovery={status:'active',recoverable:true,error_code:'runtime_operation_in_flight',next_wake_at:past};input.operation={action:'task-verify'};assert.equal(requiresWatchdogAction(input,health,now),true);input.incident_recovery.claim_until=past;assert.equal(requiresWatchdogAction(input,health,now),true)})
