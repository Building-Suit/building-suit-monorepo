import assert from 'node:assert/strict'
import {spawn} from 'node:child_process'
import {readFileSync,writeFileSync,existsSync} from 'node:fs'
import path from 'node:path'
import {failureEvidence,validateFailureEvidence,evidenceDigest} from '../../runner/failure-evidence.mjs'

// Only the isolated SQL fixture and local provider executables supplied by the
// synthetic harness are used. Actual service, CLI, flock and lifecycle are intact.
export async function supervisorDispatchProof({source,env,agent,sql,quote,controlSnapshot,output,bin,runId,injectedFault,boundedTasks,container}) {
 const first=boundedTasks[0], pause=ms=>new Promise(resolve=>setTimeout(resolve,ms))
 const save=(name,value)=>writeFileSync(path.join(output,name),JSON.stringify(value,null,2))
 const count=()=>JSON.parse(sql(`SELECT jsonb_build_object('executions',(SELECT count(*) FROM control.executions WHERE task_id='${first}'),'verifications',(SELECT count(*) FROM control.verification_runs v JOIN control.executions e USING(execution_id) WHERE e.task_id='${first}'),'publications',(SELECT count(*) FROM control.pull_requests WHERE task_id='${first}'),'credits',(SELECT count(*) FROM control.workflow_run_task_credits WHERE run_id='${runId}'),'incidents',(SELECT count(*) FROM control.dot_recovery_jobs WHERE run_id='${runId}'))`))
 // These holds are disposable setup, never operator authority on a live run.
 sql(`UPDATE control.workflow_runs SET maintenance_requested=true WHERE run_id='${runId}'`)
 assert.equal(agent(['run-supervise',runId]).status,'maintenance_requested')
 assert.equal(count().executions,0)
 sql(`UPDATE control.workflow_runs SET maintenance_requested=false,stop_requested=true WHERE run_id='${runId}'`)
 assert.equal(agent(['run-supervise',runId]).status,'stop_requested')
 assert.equal(sql(`SELECT status FROM control.workflow_runs WHERE run_id='${runId}'`),'stopped')
 assert.equal(count().executions,0)
 sql(`UPDATE control.workflow_runs SET status='running',stop_requested=false,finished_at=NULL WHERE run_id='${runId}'`)
 save('stop-maintenance-proof.json',{maintenance_blocked:true,stop_blocked:true,no_execution:true})
 // A separate registered run is blocked by the same hard cross-run dependency
 // used by Shared. Only completion of the parent can make this task actionable.
 const shared=JSON.parse(sql(`WITH suit AS (INSERT INTO control.suits(slug,display_name,stack_key,status) VALUES('synthetic-shared','Synthetic Shared','synthetic-shared','active') RETURNING slug), workstream AS (INSERT INTO control.workstreams(project_id,slug,suit_slug,display_name,stack_key,application_path,publication_config) SELECT project_id,'synthetic-shared','synthetic-shared','Synthetic Shared','synthetic-shared','src/',publication_config FROM control.workstreams WHERE slug='synthetic-e2e' RETURNING project_id) INSERT INTO control.tasks(task_id,suit_slug,project_id,workstream_slug,title,description,status,acceptance_criteria,verification_plan,metadata,retry_policy_id) SELECT 'CP-E2E-SHARED','synthetic-shared',project_id,'synthetic-shared','Shared dependency','Write bounded src/result.mjs','planned','["Write src/result.mjs"]','["git diff --check"]','{"allowed_paths":["src/**"]}','standard-five' FROM workstream RETURNING to_jsonb(tasks)`))
 assert.equal(shared.task_id,'CP-E2E-SHARED')
 sql(`SELECT control.refresh_publication_readiness_contract('CP-E2E-SHARED','disposable-shared');INSERT INTO control.task_dependencies VALUES('CP-E2E-SHARED','${first}','hard')`)
 const startedShared=agent(['run-start','synthetic-shared','1'])
 const sharedRun=startedShared.run?.run_id??startedShared.run_id??startedShared.result?.run_id
 assert.ok(sharedRun,'Shared must use the same bounded admission and frozen plan contract')
 sql(`SELECT control.authorize_ordinary_bounded_run('${sharedRun}','["CP-E2E-SHARED"]','Explicit disposable Shared dependency');SELECT control.reconcile_ordinary_run_publication('${sharedRun}')`)
 const dependencyWait=agent(['run-supervise',sharedRun]);assert.equal(dependencyWait.status,'wait');assert.equal(Number(sql("SELECT count(*) FROM control.executions WHERE task_id='CP-E2E-SHARED'")),0)
 save('shared-dependency-before.json',{shared_run:sharedRun,upstream:first,no_execution:true,response:dependencyWait})
 writeFileSync(path.join(bin,'psql'),`#!/bin/sh\nexec docker exec -i ${container} stdbuf -oL psql "$@"\n`,{mode:0o700})
 let service,logs='',restarted=false,reviewed=false,repairCount=0,unchangedChecked=false,externalReconciled=false
 const launch=()=>{
  const child=spawn(process.execPath,[path.join(source,'tooling/control-plane/runner/supervisor-service.mjs')],{cwd:env.BS_CONTROL_REPOSITORY_ROOT,env,stdio:['ignore','pipe','pipe']})
  child.stdout.on('data',data=>{logs+=data});child.stderr.on('data',data=>{logs+=data});return child
 }
 const stop=async()=>{const previous=service;service=null;if(previous&&previous.exitCode===null&&previous.signalCode===null){const exited=new Promise(resolve=>previous.once('exit',resolve)),timer=setTimeout(()=>{if(previous.exitCode===null)previous.kill('SIGKILL')},10000);previous.kill('SIGTERM');try{await exited}finally{clearTimeout(timer)}}}
 const terminal=()=>sql(`SELECT status FROM control.workflow_runs WHERE run_id='${sharedRun}'`)==='limit_reached'
 try {
  // Replay external recovery with the same authoritative event; it must coalesce
  // in SQL before the real service claims the wake.
  const beforeVersion=Number(sql(`SELECT version FROM control.supervisor_wakes WHERE run_id='${runId}'`))
  const event=sql(`SELECT event_id FROM control.supervisor_wakes WHERE run_id='${runId}'`)
  for(let n=0;n<20;n++)sql(`SELECT control.enqueue_supervisor_wake('${runId}',${event})`)
  assert.equal(Number(sql(`SELECT version FROM control.supervisor_wakes WHERE run_id='${runId}'`)),beforeVersion)
  agent(['run-recover',runId]);service=launch()
  const deadline=Date.now()+240000
  let actionSeen=false
  while(Date.now()<deadline){
   const state=controlSnapshot();actionSeen ||= state.executions.length>0
   if(!actionSeen&&Number(sql(`SELECT version FROM control.supervisor_wakes WHERE run_id='${runId}'`))>beforeVersion+20)assert.fail('claimed wake re-enqueues itself instead of entering task lifecycle')
   if(!injectedFault&&!restarted&&state.executions.some(e=>e.status==='running')){await stop();service=launch();restarted=true}
   if(['verifier-fixture','product-defect'].includes(injectedFault)&&!reviewed){
    const checks=JSON.parse(sql(`SELECT coalesce(jsonb_agg(to_jsonb(v)),'[]') FROM control.verification_results v JOIN control.executions e USING(execution_id) JOIN control.verification_runs vr USING(verification_run_id) WHERE e.task_id='${first}' AND vr.status='failed' AND v.status='fail' AND v.trusted_receipt IS NOT NULL AND e.execution_id=(SELECT max(execution_id) FROM control.executions WHERE task_id='${first}')`))
    if(checks.length){
     await stop()
     // Replaying a settled, unchanged failed generation cannot produce an
     // implementation or a verification. Exercise the actual CLI, not a planner.
     agent(['run-supervise',runId]);const before=count()
     for(let n=0;n<3;n++)agent(['run-supervise',runId])
     assert.deepEqual(count(),before);unchangedChecked=true
     const worktree=sql(`SELECT worktree_path FROM control.executions WHERE task_id='${first}' ORDER BY attempt DESC LIMIT 1`)
     const classification=injectedFault==='product-defect'?'PRODUCT_DEFECT':'VERIFIER_INFRA'
     for(const check of checks){
      const sourcePath=injectedFault==='product-defect'?'src/result.mjs':'apps/shop-suit/tests/e2e/cash-policy-pilot-fixture.ts'
      const evidence=failureEvidence({execution_id:check.execution_id,verification_run_id:check.verification_run_id,check,artifact:readFileSync(check.log_path),classification,origin:injectedFault==='product-defect'?'product-test':'verifier-fixture',review:{root_cause:injectedFault==='product-defect'?'Current SAS-style product output fails its registered contract':'Shop-style fixture prerequisite is stale; product output is unchanged',source:[{path:sourcePath,sha256:evidenceDigest(readFileSync(path.join(worktree,sourcePath)))}]}})
      validateFailureEvidence(evidence,{execution_id:check.execution_id,verification_run_id:check.verification_run_id,check,artifactRoot:worktree,sourceRoot:worktree})
      if(injectedFault==='verifier-fixture'){
       assert.equal(checks.length,1);const file='apps/shop-suit/tests/e2e/cash-policy-pilot-fixture.ts',content='export const fixtureReady = true\n'
       const recipe={id:'disposable-shop-fixture',task_id:first,checks:[{name:check.check_name,artifact_sha256:evidence.artifact.sha256}],files:[{path:file,before_sha256:evidenceDigest(readFileSync(path.join(worktree,file))),after_sha256:evidenceDigest(content),content}]}
       writeFileSync(path.join(source,'tooling/control-plane/verifier-repairs/shop-cash-policy.json'),JSON.stringify(recipe))
      }
      sql(`SET ROLE bs_control_verifier;SELECT control.review_verification_failure(${check.verification_id},${quote(JSON.stringify(evidence))}::jsonb);RESET ROLE`)
      save('bound-recovery-review.json',evidence)
     }
     reviewed=true;service=launch()
    }
   }
   if(injectedFault==='verifier-fixture'&&reviewed){
    const root=sql(`SELECT worktree_path FROM control.executions WHERE task_id='${first}' ORDER BY attempt DESC LIMIT 1`),receipt=path.join(root,'.local/verification-inputs/verifier-fixture-repair.json')
    if(existsSync(receipt)){const repaired=JSON.parse(readFileSync(receipt));assert.equal(repaired.product_attempts,0);assert.equal(repaired.recipe_id,'disposable-shop-fixture');save('automatic-fixture-repair.json',repaired);repairCount=1}
   }
   // A deliberately lost PR response is an external-evidence wait, not healthy
   // progression. Use the existing bounded watcher to probe the local provider;
   // it must reconcile the already-created PR rather than publish a duplicate.
   if(!injectedFault&&!externalReconciled&&existsSync(path.join(output,'prs.json.crash-pr'))&&sql(`SELECT EXISTS(SELECT 1 FROM control.recovery_states WHERE current_task_id='${first}' AND status='active' AND failure_class='publication-reconciliation' AND next_wake_at<=now())`)==='t'){
    await stop();const observation=agent(['external-watch','1'])
    assert.equal(observation.checked,1);assert.equal(observation.results[0].actionable,true)
    assert.equal(observation.results[0].resume.invoked,true)
    save('publication-response-reconciliation.json',observation);externalReconciled=true;service=launch()
   }
   if(state.status==='limit_reached'&&terminal())break
   await pause(300)
  }
  assert.equal(actionSeen,true,'durable wake must invoke the real task lifecycle')
  assert.equal(controlSnapshot().status,'limit_reached','service must reach publication, credit and next acquisition')
  assert.equal(terminal(),true,'Shared must automatically wake after dependency completion')
  if(!injectedFault)assert.equal(restarted,true,'restart must occur during an existing execution')
  if(injectedFault){assert.equal(reviewed,true);assert.equal(unchangedChecked,true)}
  if(injectedFault==='verifier-fixture'){assert.equal(repairCount,1);assert.equal(count().executions,1);assert.equal(count().verifications,2)}
  if(injectedFault==='product-defect'){
   assert.equal(count().executions,2);assert.equal(count().verifications,2)
   assert.equal(Number(sql(`SELECT max_attempts FROM control.retry_policies WHERE policy_id='standard-five'`)),5)
   assert.equal(Number(sql(`SELECT count(*) FROM control.operator_invocation_extensions WHERE run_id='${runId}'`)),0)
  }
  await stop()
  const settled=controlSnapshot(),settledCount=count(),modelCalls=Number(sql('SELECT count(*) FROM control.dot_model_invocations'))
  assert.equal(modelCalls,0,'healthy task progression must not involve Dot')
  const wake=()=>sql(`SELECT jsonb_agg(jsonb_build_object('run_id',run_id,'version',version,'pending',pending) ORDER BY run_id) FROM control.supervisor_wakes WHERE run_id IN('${runId}','${sharedRun}')`)
  const settledWakes=wake();assert.equal(sql('SELECT control.claim_supervisor_wake()'),'','terminal inbox entries must never be claimable')
  // The real CLI's terminal replay must not reverify, publish or credit again.
  for(let n=0;n<3;n++){agent(['run-supervise',runId]);agent(['run-recover',runId])}
  assert.deepEqual(controlSnapshot(),settled);assert.deepEqual(count(),settledCount);assert.equal(wake(),settledWakes)
  assert.equal(Number(sql(`SELECT count(*) FROM control.workflow_run_task_credits WHERE run_id='${sharedRun}'`)),1)
  assert.equal(Number(sql(`SELECT count(*) FROM control.pull_requests WHERE task_id='CP-E2E-SHARED'`)),1)
  assert.equal(Number(sql(`SELECT max_tasks FROM control.workflow_runs WHERE run_id='${runId}'`)),2)
  assert.equal(Number(sql(`SELECT count(*) FROM control.task_dependencies WHERE task_id='CP-E2E-SHARED' AND depends_on_task_id='${first}' AND dependency_type='hard'`)),1)
  save('supervisor-service-proof.json',{real_cli:true,claimed_wake_task_action:true,no_webhook:true,dot_calls:0,restarted,unchanged_generation_replayed:unchangedChecked,recovery:injectedFault,external_response_reconciled:externalReconciled,counts:settledCount,shared_run:sharedRun,shared_credit:1,terminal_replay_unchanged:true,run_id:runId})
 }finally{await stop();writeFileSync(path.join(output,'supervisor-service.log'),logs)}
}
