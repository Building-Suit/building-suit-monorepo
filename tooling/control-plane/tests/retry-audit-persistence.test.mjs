import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {spawnSync,spawn} from 'node:child_process'
import vm from 'node:vm'
import path from 'node:path'
import {currentStateSql} from '../runner/dot-current-state.mjs'
const database=process.env.CP_EGRESS_TEST_DATABASE,container=process.env.CP_EGRESS_TEST_CONTAINER??'cp-remediation-disposable-20261007'
const args=()=>['exec','-i',container,'psql','-U','postgres','-d',database,'-XqAt','-v','ON_ERROR_STOP=1']
function sql(text){assert.match(database,/^cp_egress_/);const r=spawnSync('docker',args(),{input:text,encoding:'utf8'});assert.equal(r.status,0,r.stderr);return r.stdout.trim()}
const quote=s=>"'"+String(s).replaceAll("'","''")+"'"
test('persistent audit survives 100 cycles, concurrent fallback/webhooks and restarted clients; real evidence creates one new event',{skip:!database},async()=>{
 const task='CP-AUDIT-'+Date.now()
 const fixture=readFileSync(new URL('./retry-audit-idempotency-smoke.sql',import.meta.url),'utf8').split('-- Exercise the real executor')[0].replaceAll('CP-AUDIT-IDEMPOTENCY',task)
 const f=JSON.parse(sql(fixture+'SELECT row_to_json(audit_fixture) FROM audit_fixture; COMMIT;'))
 const invoke=`SELECT control.record_retry_exhaustion_audit(${quote(f.task)},${quote(JSON.stringify(f.proof))}::jsonb);`
 const first=JSON.parse(sql('SET ROLE bs_control_executor;'+invoke));assert.ok(first.event_id)
 // Same mutation as production: recovery condition loses exhaustion_audit.
 sql(`UPDATE control.recovery_states SET condition='{}',status='active',resolved_at=NULL,error_code='retry_audit_investigation_required',version=version+1 WHERE current_task_id=${quote(task)};`)
 const loop=`DO $$BEGIN FOR cycle IN 1..100 LOOP PERFORM control.record_retry_exhaustion_audit(${quote(task)},${quote(JSON.stringify(f.proof))}::jsonb);END LOOP;END $$;`
 sql('SET ROLE bs_control_executor;'+loop)
 // Independent connections emulate webhook/fallback overlap and process restart.
 const results=await Promise.all(Array.from({length:8},()=>new Promise((resolve,reject)=>{const child=spawn('docker',args(),{stdio:['pipe','pipe','pipe']});let out='',err='';child.stdout.on('data',b=>out+=b);child.stderr.on('data',b=>err+=b);child.on('error',reject);child.on('exit',code=>code===0?resolve(JSON.parse(out.trim())):reject(Error(err)));child.stdin.end('SET ROLE bs_control_executor;'+invoke)})))
 assert.ok(results.every(r=>r.idempotent&&r.event_id===first.event_id))
 sql('SET ROLE bs_control_executor;'+loop) // fresh server/client session after restart
 assert.equal(Number(sql(`SELECT count(*) FROM control.task_events WHERE task_id=${quote(task)} AND event_type='retry_exhaustion_audited';`)),1)
 sql(`UPDATE control.executions SET commit_sha=repeat('b',40) WHERE execution_id=${f.ex};`)
 const changed=JSON.parse(sql('SET ROLE bs_control_executor;'+invoke));assert.notEqual(changed.event_id,first.event_id)
 sql('SET ROLE bs_control_executor;'+loop)
 assert.equal(Number(sql(`SELECT count(*) FROM control.task_events WHERE task_id=${quote(task)} AND event_type='retry_exhaustion_audited';`)),2)
 assert.equal(Number(sql(`SELECT count(*) FROM control.dot_model_invocations WHERE incident_id IN(SELECT incident_id FROM control.dot_incidents WHERE task_id=${quote(task)});`)),0)
 // Fixture is in the explicitly disposable test DB only.
 sql(`UPDATE control.workflow_runs SET status='finished',finished_at=now() WHERE run_id=${quote(f.run)};`)
})
test('100 duplicate webhook entrypoints read only readiness; no global scans, writes, evidence loads or model calls',async()=>{
 const runner=readFileSync(new URL('../runner/bs-agent.mjs',import.meta.url),'utf8'),source=runner.slice(runner.indexOf('async function recoveryWatch()'),runner.indexOf('function recoverWorkflowRun()'))
 const queries=[],outputs=[],telemetry=[]
 const context=vm.createContext({path,repoRoot:'/synthetic',mkdirSync(){},process:{env:{BS_DOT_WATCH_LOCKED:'1'}},currentStateSql,parseControlJson:x=>x,controlQuery:q=>{queries.push(q);return {coalesced:true}},recordEgress:(...args)=>telemetry.push(args),output:x=>outputs.push(x)})
 vm.runInContext(source,context)
 for(let i=0;i<100;i++)await context.recoveryWatch()
 assert.equal(queries.length,100);assert.equal(outputs.length,100)
 assert.ok(queries.every(q=>q.includes('CASE WHEN (SELECT ok FROM ready)')))
 assert.ok(outputs.every(x=>x.codex_invoked_by_scan===false&&x.outcomes[0].action==='duplicate_or_derived_wake_coalesced'))
 assert.ok(telemetry.every(x=>x[1].coalesced===1))
})
