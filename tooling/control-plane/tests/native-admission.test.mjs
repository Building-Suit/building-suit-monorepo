import {runSupervisorLifecycle} from '../runner/lifecycle-policy.mjs'
import path from 'node:path'
import test from 'node:test'
import assert from 'node:assert/strict'
import {admissionDiagnostic,reviewedAdmissionBindings,registryBindings} from '../runner/native-admission.mjs'
import {classifyHealth,HEALTH_STATES} from '../runner/dot-health-state.mjs'
import {dispatchRecovery} from '../runner/dot-general-recovery.mjs'
import {resolveVerificationPlan} from '../runner/verification-mode.mjs'
const run={run_id:'existing',status:'running',max_tasks:7,completed_tasks:0,current_task_id:null}
test('idle active native run is owned WAITING_ADMISSION, never false dependency',()=>{
 const r=classifyHealth({run,key:'run:existing'})
 assert.equal(r.state,'WAITING_ADMISSION');assert.equal(r.operator_action_required,false);assert.equal(r.recovery_owner,'Dot');assert.equal(r.recovery_action,'admission-diagnostics')
 assert.ok(HEALTH_STATES.includes('RECONCILING'))
})
test('genuine dependency and decision report exact IDs and correct needs-me',()=>{
 const dependency=admissionDiagnostic({task_id:'NEXT',dependencies:[{task_id:'PREREQ',status:'planned',owned:true}]})
 assert.equal(dependency.state,'WAITING_DEPENDENCY');assert.equal(dependency.needs,false);assert.match(dependency.why,/PREREQ/)
 assert.equal(admissionDiagnostic({dependencies:[{task_id:'PREREQ',status:'planned',owned:false}]}).needs,true)
 const decision=admissionDiagnostic({decisions:[{decision_id:'SAS-D001',status:'open'}]})
 assert.equal(decision.state,'WAITING_OPERATOR');assert.equal(decision.needs,true);assert.match(decision.why,/SAS-D001/)
})
test('next cycle and duplicate restart dispatch one existing-run admission recovery',async()=>{
 const health=classifyHealth({run,key:'run:existing'}),claims=new Set(),starts=[]
 const cycle=()=>dispatchRecovery({health,snapshot:{},claim:async(id,key,family)=>{assert.equal(id,'existing');assert.equal(family,'controller-acquisition');if(claims.has(key))return {claimed:false};claims.add(key);return {claimed:true,job:{key}}},start:async job=>starts.push(job)})
 await cycle();await cycle();await cycle();assert.equal(starts.length,1)
})
test('active admission incident shows RECONCILING rather than idle dependency',()=>{
 assert.equal(classifyHealth({run,incident_recovery:{status:'running',owner:'Dot',action:'controller-acquisition'}}).state,'RECONCILING')
})
test('reviewed registry bindings retain every approved obligation and mandatory future focused tests',()=>{
 const diagnosis={task_id:registryBindings.task_id,packet:{task:{verification_plan:registryBindings.entries}}}
 const bindings=reviewedAdmissionBindings(diagnosis);assert.ok(bindings)
 const quality={name:'super-admin-quality',program:'pnpm',args:['exec','turbo','run','typecheck','lint','build','--filter=@building-suit/super-admin-suit'],required:true,capabilities:['typecheck','lint','build']}
 for(const phase of ['pre_implementation','post_implementation']){
  const p=resolveVerificationPlan({entries:registryBindings.entries,configuredCommands:[...bindings.commands,quality],legacyMappings:bindings.legacy_plan_mappings,phase})
  assert.equal(p.unenforced.length,0);assert.equal(p.blockers.length,0);assert.ok(p.checks.length>=4)
 }
 assert.ok(bindings.commands.every(c=>c.required));assert.ok(bindings.commands[0].args.includes('apps/super-admin-suit/tests/unit/registry.test.mjs'))
 assert.ok(bindings.commands[1].args.includes('tests/e2e/registry.spec.ts'))
 assert.equal(reviewedAdmissionBindings({...diagnosis,task_id:'UNRELATED'}),null)
 assert.equal(reviewedAdmissionBindings({...diagnosis,packet:{task:{verification_plan:['changed scope']}}}),null)
})
test('actual native reconciliation runs before same-run acquisition and dispatch',async()=>{
 const {readFileSync}=await import('node:fs'),{runInNewContext}=await import('node:vm')
 const source=readFileSync(new URL('../runner/bs-agent.mjs',import.meta.url),'utf8')
 const helper=source.slice(source.indexOf('function reconcileNativeAdmission(runId){'),source.indexOf('async function recoveryWatch()'))
 const recover=source.slice(source.indexOf('function recoverWorkflowRun()'),source.indexOf('\nfunction taskReaccept()',source.indexOf('function recoverWorkflowRun()')))
 const calls=[],outputs=[],d={task_id:registryBindings.task_id,dependencies:[],decisions:[],packet:{task:{verification_plan:registryBindings.entries},project:{project_id:'project'},workstream:{slug:'super-admin-suit'}}}
 const context={runSupervisorLifecycle,path,mkdirSync:()=>{},args:['existing'],process:{execPath:'node',env:{BS_RUN_SUPERVISOR_LOCKED:'1'}},agentScriptPath:'bs-agent.mjs',repoRoot:'/fixture',validRunId:()=>true,parseControlJson:x=>x,parseJson:JSON.parse,reviewedAdmissionBindings,output:x=>outputs.push(x),controlQuery:(sql)=>{
  if(sql.includes('reconcile_lifecycle_incidents'))return {resolved:0}
  if(sql.includes('workflow_run_gate'))return {should_continue:true}
  if(sql.includes('diagnose_native_run_admission')){calls.push('diagnose');return d}
  if(sql.includes('UPDATE control.workstreams')){calls.push('bindings');return null}
  if(sql.includes('INSERT INTO control.task_events'))return null
  if(sql.includes('reconcile_native_run_admission')){calls.push('contract');return {...d,reconciled:true}}
  if(sql.includes('reconcile_ordinary_run_publication'))return null
  if(sql.includes('acquire_workflow_run_task')){calls.push('acquire');return {acquired:true,task_id:registryBindings.task_id}}
  throw Error('unexpected SQL')
 },execute:(_program,args)=>{calls.push('dispatch');assert.equal(args[1],'task-supervise');assert.equal(args[2],registryBindings.task_id);return {stdout:JSON.stringify({ok:true,status:'running'})}}}
 await runInNewContext(helper+recover+'\nrecoverWorkflowRun()',context)
 assert.deepEqual(calls,['contract','acquire','dispatch']);assert.equal(outputs[0].run_id,'existing')
 assert.equal(run.max_tasks,7);assert.equal(run.completed_tasks,0)
})
