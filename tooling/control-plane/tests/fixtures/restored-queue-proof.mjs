import assert from 'node:assert/strict'
import {spawn} from 'node:child_process'
import {readFileSync,writeFileSync} from 'node:fs'
import path from 'node:path'
import {failureEvidence,validateFailureEvidence,evidenceDigest} from '../../runner/failure-evidence.mjs'

export async function restoredQueueProof({source,env,agent,sql,quote,controlSnapshot,output,bin,runId,injectedFault,boundedTasks,container}) {
 const first=boundedTasks[0],pause=ms=>new Promise(resolve=>setTimeout(resolve,ms)),json=q=>JSON.parse(sql(q))
 writeFileSync(path.join(bin,'psql'),`#!/bin/sh\nexec docker exec -i ${container} stdbuf -oL psql "$@"\n`,{mode:0o700})
 const ownerBefore=sql(`SELECT count(*) FROM control.operator_authority_events WHERE run_id='${runId}' AND response='approve'`)
 assert.equal(ownerBefore,'1','one real authenticated fixture owner response')
 const reviewed=new Set();let service,log='',restarted=false
 const launch=()=>{const p=spawn(process.execPath,[path.join(source,'tooling/control-plane/runner/supervisor-service.mjs')],{cwd:env.BS_CONTROL_REPOSITORY_ROOT,env,stdio:['ignore','pipe','pipe']});p.stdout.on('data',b=>log+=b);p.stderr.on('data',b=>log+=b);return p}
 const stop=async()=>{const previous=service;service=null;if(previous?.exitCode===null&&previous?.signalCode===null){const ended=new Promise(r=>previous.once('exit',r));const timer=setTimeout(()=>previous.kill('SIGKILL'),10000);previous.kill('SIGTERM');await ended;clearTimeout(timer)}}
 const counts=()=>json(`SELECT jsonb_build_object('executions',(SELECT count(*) FROM control.executions WHERE task_id='${first}'),'product',(control.product_retry_accounting('${first}')->>'consumed')::int,'credits',(SELECT count(*) FROM control.workflow_run_task_credits WHERE run_id='${runId}'),'publications',(SELECT count(*) FROM control.pull_requests WHERE task_id IN('${first}','CP-E2E-002')),'approvals',(SELECT count(*) FROM control.operator_authority_events WHERE run_id='${runId}' AND response='approve'))`)
 try {
 service=launch();const deadline=Date.now()+600000
 while(Date.now()<deadline){
  const state=controlSnapshot()
  if(!restarted&&state.executions.some(e=>e.status==='running')){await stop();service=launch();restarted=true}
  const checks=json(`SELECT coalesce(jsonb_agg(to_jsonb(v)),'[]') FROM control.verification_results v JOIN control.verification_runs vr USING(verification_run_id) JOIN control.executions e ON e.execution_id=v.execution_id WHERE e.task_id='${first}' AND vr.status='failed' AND v.status='fail' AND v.trusted_receipt IS NOT NULL AND NOT EXISTS(SELECT 1 FROM control.verification_failure_reviews review WHERE review.verification_id=v.verification_id)`)
  for(const check of checks){
   if(reviewed.has(check.verification_id))continue
   const worktree=sql(`SELECT worktree_path FROM control.executions WHERE execution_id=${check.execution_id}`)
   const external=injectedFault==='restore-wait';assert.equal(check.check_name,external?'synthetic-queue-evidence':'synthetic-owned-output')
   const artifact=readFileSync(check.log_path);assert.match(artifact.toString(),external?/ENOENT/:/AssertionError|number.*string/s)
   const classification=external?'EXTERNAL_EVIDENCE':'PRODUCT_DEFECT'
   const evidence=failureEvidence({execution_id:check.execution_id,verification_run_id:check.verification_run_id,check,artifact,classification,origin:external?'external-evidence':'product-test',review:{root_cause:external?'The independent evidence file is absent; retain the required gate':'The task exports numeric zero; the registered product test requires a string',source:[{path:'src/result.mjs',sha256:evidenceDigest(readFileSync(path.join(worktree,'src/result.mjs')))}]}})
   validateFailureEvidence(evidence,{execution_id:check.execution_id,verification_run_id:check.verification_run_id,check,artifactRoot:worktree,sourceRoot:worktree})
   sql(`SET ROLE bs_control_verifier;SELECT control.review_verification_failure(${check.verification_id},${quote(JSON.stringify(evidence))}::jsonb);RESET ROLE`)
   reviewed.add(check.verification_id)
   writeFileSync(path.join(output,'review-'+check.verification_id+'.json'),JSON.stringify(evidence,null,2))
  }
  const c=counts()
  if(['restore-exhaust','restore-wait'].includes(injectedFault)){
   if(c.credits===1&&sql(`SELECT status FROM control.tasks WHERE task_id='${first}'`)==='blocked'&&(injectedFault==='restore-wait'||c.product===5))break
  }else if(state.status==='limit_reached')break
  await pause(500)
 }
 await stop()
 const final=controlSnapshot(),c=counts();assert.ok(restarted,'persistent consumer crash/restart exercised');assert.equal(c.approvals,1,'no recurring owner approval');assert.equal(Number(sql('SELECT count(*) FROM control.dot_model_invocations')),0,'no assessor/investigator participates')
 if(injectedFault==='restore-fifth'){assert.equal(final.status,'limit_reached');assert.equal(c.executions,5);assert.equal(c.product,4);assert.equal(c.credits,2);assert.equal(c.publications,2);assert.equal(reviewed.size,4)}
 if(injectedFault==='restore-ordinary'){assert.equal(final.status,'limit_reached');assert.equal(c.executions,1);assert.equal(c.product,0);assert.equal(c.credits,2);assert.equal(c.publications,2);assert.equal(json(`SELECT control.operator_gate_offers('${runId}')`).filter(g=>['ordinary-publication','task-shared-package-scope'].includes(g.action)).length,0)}
 if(['restore-exhaust','restore-wait'].includes(injectedFault)){
  assert.equal(final.status,'running');assert.equal(final.current_task_id,null);assert.equal(c.credits,1);assert.equal(c.publications,1);assert.equal(c.executions,injectedFault==='restore-exhaust'?5:1);assert.equal(c.product,injectedFault==='restore-exhaust'?5:0)
  assert.equal(Number(sql(`SELECT count(*) FROM control.unattended_queue_waits WHERE run_id='${runId}' AND task_id='${first}' AND resumed_at IS NULL`)),1)
  assert.equal(agent(['run-supervise',runId]).status,'idle')
 }
 const settled=counts();for(let i=0;i<3;i++)agent(['run-supervise',runId]);assert.deepEqual(counts(),settled,'crash replay cannot duplicate credit or attempt')
 const prs=JSON.parse(readFileSync(env.CP_SYNTHETIC_PROVIDER_STATE));assert.equal(prs.length,c.publications);assert.ok(prs.every(pr=>pr.isDraft&&pr.headRefName.startsWith('codex/')&&pr.baseRefName!=='main'))
 const actualRemote=sql(`SELECT count(*) FROM control.pull_requests WHERE task_id IN('${first}','CP-E2E-002') AND state='open' AND is_draft`);assert.equal(Number(actualRemote),c.publications)
 let independentlyAuthorizedResume = null
 if(injectedFault==='restore-wait'){
  sql(`INSERT INTO control.suits(slug,display_name,stack_key,status) VALUES('synthetic-new-queue','New independently authorized queue','synthetic-new-queue','active');
  INSERT INTO control.workstreams(project_id,slug,suit_slug,display_name,stack_key,application_path,publication_config) SELECT project_id,'synthetic-new-queue','synthetic-new-queue','New authorized queue','synthetic-new-queue','src/',publication_config FROM control.workstreams WHERE slug='synthetic-e2e';
  INSERT INTO control.tasks(task_id,suit_slug,project_id,workstream_slug,title,description,status,acceptance_criteria,verification_plan,metadata,retry_policy_id) SELECT 'CP-E2E-NEW','synthetic-new-queue',project_id,'synthetic-new-queue','New independent ordinary task','Write src/result.mjs','planned','["Write src/result.mjs"]','["git diff --check"]','{"allowed_paths":["src/**"]}','standard-five' FROM control.projects WHERE slug='synthetic-e2e';
  SELECT control.refresh_publication_readiness_contract('CP-E2E-NEW','new-independent-queue');`)
  const started=agent(['run-start','synthetic-new-queue','1']),nextRun=started.run?.run_id??started.run_id??started.result?.run_id;assert.ok(nextRun)
  const offer=json(`SELECT control.operator_gate_offers('${nextRun}')`).find(o=>o.action==='unattended-queue-release');assert.ok(offer)
  sql(`SET ROLE bs_control_operator;SELECT control.resolve_authenticated_operator_gate('a0000000-0000-4000-8000-000000000090','${nextRun}','${offer.gate_fingerprint}','approve');RESET ROLE`)
  service=launch();const until=Date.now()+180000
  while(Date.now()<until&&sql(`SELECT status FROM control.workflow_runs WHERE run_id='${nextRun}'`)!=='limit_reached')await pause(500)
  await stop();assert.equal(sql(`SELECT status FROM control.workflow_runs WHERE run_id='${nextRun}'`),'limit_reached')
  assert.deepEqual(counts(),settled,'new independent authority never changes blocked old queue lineage')
  assert.equal(sql(`SELECT count(*) FROM control.operator_authority_events WHERE run_id='${nextRun}' AND response='approve'`),'1')
  assert.equal(sql(`SELECT count(*) FROM control.workflow_run_task_credits WHERE run_id='${nextRun}'`),'1')
  independentlyAuthorizedResume={run_id:nextRun,one_new_bounded_owner_response:true,automatic_service_acquisition:true,old_queue_unchanged:true}
 }
 writeFileSync(path.join(output,'restored-queue-proof.json'),JSON.stringify({independentlyAuthorizedResume,scenario:injectedFault,passed:true,actual_cli:true,actual_postgres:true,actual_service:true,real_git_publication:true,synthetic_github:true,synthetic_model:true,one_owner_response:true,restarted,reviewed_failures:reviewed.size,counts:c,final},null,2))
 }finally{await stop();writeFileSync(path.join(output,'restored-service.log'),log)}
}
