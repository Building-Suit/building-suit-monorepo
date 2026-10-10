import assert from 'node:assert/strict'
import {spawn,spawnSync} from 'node:child_process'
import {readFileSync,writeFileSync,mkdirSync,cpSync,existsSync} from 'node:fs'
import path from 'node:path'
import {failureEvidence,evidenceDigest} from '../../runner/failure-evidence.mjs'

// Historical rows are fixture setup. All lifecycle actions, receipt production,
// authentication, verification, Git publication and credits use the real CLI.
export async function executionOwnerScopeProof({source,env,agent,sql,quote,controlSnapshot,output,bin,runId,injectedFault,container}) {
 const first='CP-E2E-001',actor='a0000000-0000-4000-8000-000000000090',pause=ms=>new Promise(r=>setTimeout(r,ms))
 const json=query=>JSON.parse(sql(query)),save=(name,value)=>writeFileSync(path.join(output,name),JSON.stringify(value,null,2))
 const invoke=(runtime,args,extra={})=>{const r=spawnSync(process.execPath,[path.join(runtime,'tooling/control-plane/runner/bs-agent.mjs'),...args],{cwd:env.BS_CONTROL_REPOSITORY_ROOT,env:{...env,...extra},encoding:'utf8',timeout:120000,maxBuffer:8*1024*1024});assert.ok([0,1].includes(r.status),r.stderr);const value=JSON.parse(r.stdout);save('last-cli.json',{args,status:r.status,value});return value}
 const counts=()=>json(`SELECT jsonb_build_object('attempts',(SELECT count(*) FROM control.executions WHERE task_id='${first}'),'verifications',(SELECT count(*) FROM control.verification_runs v JOIN control.executions e USING(execution_id) WHERE e.task_id='${first}'),'credits',(SELECT count(*) FROM control.workflow_run_task_credits WHERE run_id='${runId}'),'publications',(SELECT count(*) FROM control.pull_requests WHERE task_id='${first}'),'consumed',(control.product_retry_accounting('${first}')->>'consumed')::int)`)
 let proof={real_cli:true,real_postgres:true,real_git_publisher:injectedFault==='owner-scope',scenario:injectedFault},recoveredExecution
 if(injectedFault==='owner-scope'){
  const scopes=['packages/brand/**','packages/nuxt-layer/**','packages/ui/**']
  assert.equal(agent(['run-supervise',runId]).status,'wait');assert.equal(counts().attempts,0)
  const offers=()=>json(`SELECT control.operator_gate_offers('${runId}')`);let offer=offers().find(o=>o.action==='task-shared-package-scope');assert.ok(offer,JSON.stringify(offers()));assert.deepEqual(offer.approved_scopes,scopes)
  const resolve=(gate,response,who=actor)=>{const r=spawnSync(process.execPath,[path.join(source,'tooling/control-plane/runner/operator-gate.mjs'),runId,gate,response,who],{cwd:env.BS_CONTROL_REPOSITORY_ROOT,env:{...env,BS_OPERATOR_DB_USER:'cp_fixture_operator'},encoding:'utf8',timeout:15000});assert.equal(r.status,0,r.stdout+'\n'+r.stderr);return JSON.parse(r.stdout)}
  // A worker role cannot call either the authenticated capability or its renamed
  // legacy implementation, nor write grants/resolved scopes directly.
  for(const query of [`SELECT control.resolve_authenticated_operator_gate('${actor}','${runId}','${offer.gate_fingerprint}','approve')`,`SELECT control.resolve_authenticated_operator_gate_before_task_shared_scope('${actor}','${runId}','${offer.gate_fingerprint}','approve')`,`UPDATE control.tasks SET metadata=metadata||'{"publication_resolved_scopes":["packages/ui/**"]}' WHERE task_id='${first}'`,`INSERT INTO control.task_shared_package_authorizations(event_id) VALUES(1)`]){
   const r=spawnSync('docker',['exec','-i',container,'psql','-U','cp_fixture_executor','-d',env.BS_CONTROL_DB_NAME,'-Xq','-v','ON_ERROR_STOP=1'],{input:query,encoding:'utf8'});assert.notEqual(r.status,0);assert.match(r.stderr,/permission denied/)
  }
  const denied=(gate,who)=>{const r=spawnSync(process.execPath,[path.join(source,'tooling/control-plane/runner/operator-gate.mjs'),runId,gate,'approve',who],{cwd:env.BS_CONTROL_REPOSITORY_ROOT,env:{...env,BS_OPERATOR_DB_USER:'cp_fixture_operator'},encoding:'utf8'});assert.equal(r.status,1,r.stdout)}
  denied(offer.gate_fingerprint,'a0000000-0000-4000-8000-000000000099');denied('0'.repeat(32),actor)
  sql(`UPDATE control.requirements SET summary=summary||' changed' WHERE requirement_id='APPROVED-BRAND' AND suit_slug='synthetic-e2e';SELECT control.refresh_publication_readiness_contract('${first}','stale-offer-test')`);denied(offer.gate_fingerprint,actor)
  sql(`UPDATE control.requirements SET summary='Already approved three shared-package paths' WHERE requirement_id='APPROVED-BRAND' AND suit_slug='synthetic-e2e';SELECT control.refresh_publication_readiness_contract('${first}','restored-approved-requirement')`)
  offer=offers().find(o=>o.action==='task-shared-package-scope');assert.ok(offer)
  assert.ok(agent(['operator-gates',runId]).gates.some(o=>o.gate_fingerprint===offer.gate_fingerprint),'existing authenticated form review must expose the new offer')
  const authority=resolve(offer.gate_fingerprint,'approve'),wake=sql(`SELECT to_jsonb(w) FROM control.supervisor_wakes w WHERE run_id='${runId}'`)
  resolve(offer.gate_fingerprint,'approve');assert.equal(sql(`SELECT to_jsonb(w) FROM control.supervisor_wakes w WHERE run_id='${runId}'`),wake,'authenticated receipt replay must not create another wake')
  assert.equal(sql(`SELECT control.task_publication_authority_is_current('${first}')`),'t')
  assert.ok(agent(['operator-gates',runId]).gates.some(o=>o.gate_fingerprint===offer.gate_fingerprint&&o.available_responses?.includes('revoke')))
  assert.equal(Number(sql(`SELECT count(*) FROM control.supervisor_wakes WHERE run_id='${runId}' AND pending`)),1)
  sql(`BEGIN;UPDATE control.workflow_runs SET status='stopped' WHERE run_id='${runId}';DO $$ BEGIN IF control.task_publication_authority_is_current('${first}') THEN RAISE EXCEPTION 'old run grant escaped its run identity';END IF;END $$;ROLLBACK`)
  // An active implementation remains revocable, and a fresh task-bound offer
  // supports an explicit owner reauthorization of that same execution/task.
  sql(`BEGIN;UPDATE control.workflow_runs SET current_task_id='${first}' WHERE run_id='${runId}';UPDATE control.tasks SET status='in_progress' WHERE task_id='${first}';SET LOCAL ROLE bs_control_operator;SELECT control.resolve_authenticated_operator_gate('${actor}','${runId}','${offer.gate_fingerprint}','revoke');RESET ROLE;DO $$ BEGIN IF control.task_shared_package_offer('${runId}')->>'action' IS DISTINCT FROM 'task-shared-package-scope' THEN RAISE EXCEPTION 'active task lacks exact reauthorization offer';END IF;END $$;ROLLBACK`)
  // A publisher with unresolved possible remote side effects must reconcile
  // before revocation; a frozen child context cannot silently retain authority.
  sql(`BEGIN;INSERT INTO control.runtime_operations(task_id,workflow_run_id,action,status) VALUES('${first}','${runId}','task-publish','pending');SET LOCAL ROLE bs_control_operator;DO $$ BEGIN BEGIN PERFORM control.resolve_authenticated_operator_gate('${actor}','${runId}','${offer.gate_fingerprint}','revoke');RAISE EXCEPTION 'in-flight publication revocation accepted';EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'publication_operation_in_flight_scope_revocation_requires_reconciliation' THEN RAISE;END IF;END;END $$;ROLLBACK`)
  // Revocation retains the audit row and freezes both acquisition/publication.
  resolve(offer.gate_fingerprint,'revoke');resolve(offer.gate_fingerprint,'approve')
  assert.equal(sql(`SELECT control.task_publication_authority_is_current('${first}')`),'f');agent(['run-supervise',runId]);assert.equal(counts().attempts,0)
  const renewed=offers().find(o=>o.action==='task-shared-package-scope');assert.ok(renewed);assert.notEqual(renewed.gate_fingerprint,offer.gate_fingerprint)
  resolve(renewed.gate_fingerprint,'approve')
  // Changes to the approved requirement invalidate authorization even if the
  // worker could still see resolved paths in its old packet.
  sql(`UPDATE control.requirements SET summary=summary||' changed' WHERE requirement_id='APPROVED-BRAND' AND suit_slug='synthetic-e2e'`)
  assert.equal(sql(`SELECT control.task_publication_authority_is_current('${first}')`),'f')
  sql(`UPDATE control.requirements SET summary='Already approved three shared-package paths' WHERE requirement_id='APPROVED-BRAND' AND suit_slug='synthetic-e2e';SELECT control.reconcile_ordinary_run_task('${runId}','${first}')`)
  assert.equal(sql(`SELECT control.task_publication_authority_is_current('${first}')`),'t')
  const pubGrant=json(`SELECT to_jsonb(g) FROM control.run_ordinary_publication_authorizations g WHERE run_id='${runId}'`);assert.equal(pubGrant.max_tasks,2)
  assert.equal(Number(sql(`SELECT count(*) FROM control.operator_invocation_extensions WHERE run_id='${runId}'`)),0)
  proof={...proof,scopes,authenticated:true,revocation_enforced:true,stale_requirement_blocked:true,replay_one_wake:true,authority}
 }else{
  // Reproduce the installed parent's exact early-return defect, using its actual
  // dispatcher and worker/verifier processes against this isolated database.
  const baseline=path.join(output,'installed-parent');mkdirSync(baseline,{recursive:true});cpSync(path.join(source,'tooling/control-plane'),path.join(baseline,'tooling/control-plane'),{recursive:true});cpSync(path.join(source,'tooling/git'),path.join(baseline,'tooling/git'),{recursive:true})
  const parent=spawnSync('git',['show','590ccbf3941fb358c915a0981430d9612c7918ca:tooling/control-plane/runner/bs-agent.mjs'],{cwd:source,encoding:'utf8',maxBuffer:4*1024*1024});assert.equal(parent.status,0,parent.stderr);writeFileSync(path.join(baseline,'tooling/control-plane/runner/bs-agent.mjs'),parent.stdout)
  for(const args of [['init','-q'],['add','.'],['-c','user.name=Disposable','-c','user.email=fixture@example.invalid','commit','-qm','Installed-parent fixture']])assert.equal(spawnSync('git',args,{cwd:baseline,encoding:'utf8'}).status,0)
  let checks=[],deadline=Date.now()+120000
  while(Date.now()<deadline){const staged=path.join(output,'worktrees/automation-suit-cp-e2e-001/.local');if(existsSync(staged)){mkdirSync(path.join(staged,'verification-inputs'),{recursive:true});writeFileSync(path.join(staged,'verification-inputs/staging.json'),JSON.stringify({environment:'disposable',status:'verified'}));}invoke(baseline,['run-supervise',runId]);checks=json(`SELECT coalesce(jsonb_agg(to_jsonb(v)),'[]') FROM control.verification_results v JOIN control.executions e USING(execution_id) JOIN control.verification_runs vr USING(verification_run_id) WHERE e.task_id='${first}' AND vr.status='failed' AND v.status='fail' AND v.check_name='synthetic-owned-output'`);if(checks.length)break;await pause(200)}
  assert.equal(checks.length,1,'original failed product check must be persisted')
  const worktree=sql(`SELECT worktree_path FROM control.executions WHERE task_id='${first}' ORDER BY attempt DESC LIMIT 1`)
  writeFileSync(path.join(worktree,'.local/verification-inputs/staging.json'),JSON.stringify({environment:'disposable',status:'pending'}))
  for(const check of checks){const evidence=failureEvidence({execution_id:check.execution_id,verification_run_id:check.verification_run_id,check,artifact:readFileSync(check.log_path),classification:'PRODUCT_DEFECT',origin:'product-test',review:{root_cause:'The first current source violates its actual registered result assertion',source:[{path:'src/result.mjs',sha256:evidenceDigest(readFileSync(path.join(worktree,'src/result.mjs')))}]}});sql(`SET ROLE bs_control_verifier;SELECT control.review_verification_failure(${check.verification_id},${quote(JSON.stringify(evidence))}::jsonb);RESET ROLE`)}
  const trusted=json(`SELECT to_jsonb(review) FROM control.verification_failure_reviews review WHERE verification_id=${checks[0].verification_id}`);assert.equal(trusted.evidence.classification,'PRODUCT_DEFECT');save('original-product-defect.json',trusted)
  deadline=Date.now()+120000;let operation;const future=injectedFault==='retry-finalization-future'
  while(Date.now()<deadline){invoke(future?source:baseline,['run-supervise',runId]);operation=json(`SELECT coalesce((SELECT to_jsonb(o) FROM control.runtime_operations o JOIN control.executions e USING(execution_id) WHERE e.task_id='${first}' AND e.attempt=2 AND o.action='task-retry' ORDER BY o.created_at DESC LIMIT 1),'null')`);if(future?operation?.status==='consumed'&&sql(`SELECT coalesce(metadata->>'mandatory_verification_pending','false') FROM control.executions WHERE execution_id=${operation.execution_id}`)==='true':operation?.result?.payload?.error==='repair_verifier_recovery_required')break;await pause(200)}
  if(!future){assert.equal(operation?.result?.payload?.error,'repair_verifier_recovery_required',JSON.stringify(operation));assert.equal(operation.status,'consumed')}else assert.equal(sql(`SELECT metadata->>'verification_probe_passed' FROM control.executions WHERE execution_id=${operation.execution_id}`),'false');recoveredExecution=operation.execution_id
  assert.equal(sql(`SELECT status FROM control.executions WHERE execution_id=${recoveredExecution}`),future?'succeeded':'running');assert.equal(counts().attempts,2);assert.equal(counts().consumed,1)
  save('reproduced-installed-orphan.json',{operation,counts:counts()})
  // A durable wake must drive the corrected service's actual finalization and
  // mandatory verifier, without creating another implementation invocation.
  writeFileSync(path.join(bin,'psql'),`#!/bin/sh\nexec docker exec -i ${container} stdbuf -oL psql "$@"\n`,{mode:0o700})
  let logs='';const service=spawn(process.execPath,[path.join(source,'tooling/control-plane/runner/supervisor-service.mjs')],{cwd:env.BS_CONTROL_REPOSITORY_ROOT,env,stdio:['ignore','pipe','pipe']});service.stdout.on('data',d=>logs+=d);service.stderr.on('data',d=>logs+=d)
  try{
   sql(`SELECT control.enqueue_supervisor_wake('${runId}')`);deadline=Date.now()+120000
   while(Date.now()<deadline){if(Number(sql(`SELECT count(*) FROM control.verification_runs WHERE execution_id=${recoveredExecution} AND status='failed'`))>0)break;await pause(250)}
  }finally{const ended=new Promise(r=>service.once('exit',r));if(service.exitCode===null){service.kill('SIGTERM');await ended}writeFileSync(path.join(output,'focused-supervisor.log'),logs)}
  assert.equal(sql(`SELECT status FROM control.executions WHERE execution_id=${recoveredExecution}`),'succeeded');assert.equal(counts().attempts,2)
  assert.deepEqual(json(`SELECT result FROM control.runtime_operations WHERE operation_id='${operation.operation_id}'`),operation.result,'original failed outer receipt is immutable history')
  const failed=json(`SELECT jsonb_agg(to_jsonb(v)) FROM control.verification_results v WHERE execution_id=${recoveredExecution} AND status='fail'`);assert.equal(failed.length,1);assert.equal(failed[0].check_name,'synthetic-staging-evidence')
  const external=failureEvidence({execution_id:recoveredExecution,verification_run_id:failed[0].verification_run_id,check:failed[0],artifact:readFileSync(failed[0].log_path),classification:'EXTERNAL_EVIDENCE',origin:'external-evidence',review:{root_cause:'The required independent disposable staging receipt is still pending; product assertion passed',source:[{path:'src/result.mjs',sha256:evidenceDigest(readFileSync(path.join(worktree,'src/result.mjs')))}]}})
  sql(`SET ROLE bs_control_verifier;SELECT control.review_verification_failure(${failed[0].verification_id},${quote(JSON.stringify(external))}::jsonb);RESET ROLE`)
  invoke(source,['run-supervise',runId]);const before=counts();for(let i=0;i<3;i++)invoke(source,['run-supervise',runId]);assert.deepEqual(counts(),before,'missing staging cannot loop or create another attempt');assert.equal(before.credits,0)
  assert.deepEqual(json(`SELECT to_jsonb(review) FROM control.verification_failure_reviews review WHERE verification_id=${checks[0].verification_id}`),trusted,'historical trusted product evidence stays immutable')
  assert.equal(json(`SELECT control.current_lifecycle_failure('${first}')`).classification,'EXTERNAL_EVIDENCE')
  assert.equal(sql(`SELECT next_action FROM control.recovery_states WHERE current_task_id='${first}' AND status='active' ORDER BY updated_at DESC LIMIT 1`),'wait-external')
  assert.equal(Number(sql(`SELECT count(*) FROM control.executions WHERE task_id='CP-E2E-002'`)),0,'next task waits for actual verification and publication, never fabricated credit')
  assert.equal(Number(sql('SELECT count(*) FROM control.dot_model_invocations')),0)
  save('focused-repair-proof.json',{...proof,original_execution:checks[0].execution_id,recovered_execution:recoveredExecution,attempt:2,counts:before,consumed_receipt_preserved:true,unchanged_verification_blocked:true,staging_gate_preserved:true,no_new_attempt:true,claimed_wake_task_action:true,dot_calls:0,settled_replay_unchanged:true,exact_credits:0,publication_blocked:true})
  return

 }
 // Real service consumes a durable wake; a dependent run must acquire only after
 // the first task earns its exact completion credit.
 sql(`INSERT INTO control.suits(slug,display_name,stack_key,status) VALUES('synthetic-shared','Shared','synthetic-shared','active');INSERT INTO control.workstreams(project_id,slug,suit_slug,display_name,stack_key,application_path,publication_config) SELECT project_id,'synthetic-shared','synthetic-shared','Shared','synthetic-shared','src/',publication_config FROM control.workstreams WHERE slug='synthetic-e2e';INSERT INTO control.tasks(task_id,suit_slug,project_id,workstream_slug,title,description,status,acceptance_criteria,verification_plan,metadata,retry_policy_id) SELECT 'CP-E2E-SHARED','synthetic-shared',project_id,'synthetic-shared','Shared dependency','Write the bounded fixture output in src/result.mjs','planned','["Write src/result.mjs"]','["git diff --check"]','{"allowed_paths":["src/**"]}','standard-five' FROM control.projects WHERE slug='synthetic-e2e';SELECT control.refresh_publication_readiness_contract('CP-E2E-SHARED','dependency-proof');INSERT INTO control.task_dependencies VALUES('CP-E2E-SHARED','${first}','hard')`)
 const shared=agent(['run-start','synthetic-shared','1']),sharedRun=shared.run?.run_id??shared.run_id??shared.result?.run_id;assert.ok(sharedRun)
 sql(`SELECT control.authorize_ordinary_bounded_run('${sharedRun}','["CP-E2E-SHARED"]','Disposable owner');SELECT control.reconcile_ordinary_run_publication('${sharedRun}')`);agent(['run-supervise',sharedRun]);assert.equal(Number(sql("SELECT count(*) FROM control.executions WHERE task_id='CP-E2E-SHARED'")),0)
 writeFileSync(path.join(bin,'psql'),`#!/bin/sh\nexec docker exec -i ${container} stdbuf -oL psql "$@"\n`,{mode:0o700})
 let service,log='',restarted=false
 const launch=()=>{const p=spawn(process.execPath,[path.join(source,'tooling/control-plane/runner/supervisor-service.mjs')],{cwd:env.BS_CONTROL_REPOSITORY_ROOT,env,stdio:['ignore','pipe','pipe']});p.stdout.on('data',d=>log+=d);p.stderr.on('data',d=>log+=d);return p}
 const stop=async()=>{if(service?.exitCode===null){const ended=new Promise(r=>service.once('exit',r));service.kill('SIGTERM');await ended}}
 try{
  service=launch();const deadline=Date.now()+240000
  while(Date.now()<deadline){const state=controlSnapshot();if(!restarted&&state.executions.some(e=>e.status==='running')){await stop();service=launch();restarted=true}if(state.status==='limit_reached'&&sql(`SELECT status FROM control.workflow_runs WHERE run_id='${sharedRun}'`)==='limit_reached')break;await pause(250)}
  await stop();assert.equal(controlSnapshot().status,'limit_reached','automatic publication, exact credit and next acquisition');assert.equal(sql(`SELECT status FROM control.workflow_runs WHERE run_id='${sharedRun}'`),'limit_reached')
  const settled=controlSnapshot(),before=counts();for(let i=0;i<3;i++){agent(['run-supervise',runId]);agent(['run-recover',runId])};assert.deepEqual(controlSnapshot(),settled);assert.deepEqual(counts(),before)
  assert.equal(before.credits,2);assert.equal(before.publications,1);assert.equal(before.attempts,injectedFault==='owner-scope'?1:2);assert.equal(before.consumed,injectedFault==='owner-scope'?0:1)
  assert.equal(Number(sql(`SELECT count(*) FROM control.workflow_run_task_credits WHERE run_id='${sharedRun}'`)),1);assert.equal(Number(sql('SELECT count(*) FROM control.dot_model_invocations')),0)
  if(injectedFault==='owner-scope'){const r=spawnSync(process.execPath,[path.join(source,'tooling/control-plane/runner/operator-gate.mjs'),runId,sql(`SELECT gate_fingerprint FROM control.operator_authority_events WHERE run_id='${runId}' AND response='approve' ORDER BY event_id DESC LIMIT 1`),'revoke',actor],{cwd:env.BS_CONTROL_REPOSITORY_ROOT,env:{...env,BS_OPERATOR_DB_USER:'cp_fixture_operator'},encoding:'utf8'});assert.equal(r.status,1,'published work cannot be silently undone by revocation')}
  save('focused-repair-proof.json',{...proof,counts:before,restarted,exact_credits:2,shared_credit:1,dot_calls:0,terminal_replay_unchanged:true})
 }finally{await stop();writeFileSync(path.join(output,'focused-supervisor.log'),log)}
}
