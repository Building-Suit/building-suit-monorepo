#!/usr/bin/env node
import { restoredQueueProof } from './fixtures/restored-queue-proof.mjs'
import {executionOwnerScopeProof} from './fixtures/execution-owner-scope-proof.mjs'
import {supervisorDispatchProof} from './fixtures/supervisor-dispatch-proof.mjs'
import {incidentInstallProof} from './fixtures/incident-install-proof.mjs'
import {failureEvidence,validateFailureEvidence,evidenceDigest} from '../runner/failure-evidence.mjs'
import assert from 'node:assert/strict'
import {spawnSync,spawn} from 'node:child_process'
import {mkdirSync,writeFileSync,readdirSync,readFileSync,existsSync,rmSync,symlinkSync,cpSync} from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {installSyntheticProviders} from './fixtures/synthetic-provider.mjs'
import {n8nRestartProof} from './fixtures/n8n-restart-proof.mjs'
import {fingerprint} from '../runner/task-preflight.mjs'

const candidateSource=process.env.CP_SYNTHETIC_RUNTIME_SOURCE??fileURLToPath(new URL('../../../',import.meta.url))
assert.ok(path.isAbsolute(candidateSource),'explicit absolute isolated runtime source')
const container=process.env.CP_EGRESS_TEST_CONTAINER??'cp-remediation-disposable-20261007'
assert.match(container,/^cp-.*disposable[-a-z0-9]*$/)
let source=candidateSource
const dispatchIntegration=process.argv.includes('--dispatch-integration')
const output=process.argv[2]
const restartEnabled=process.argv.includes('--n8n-restart')
const publicationFailure=process.argv.find(arg=>arg.startsWith('--fault-publication='))?.split('=')[1]??null
if(publicationFailure&&!['commit','push','pr'].includes(publicationFailure))throw Error('invalid_publication_fault')
const injectedFault=process.argv.find(arg=>arg.startsWith('--fault='))?.slice(8)??null
if(injectedFault&&!['large-prompt','controller-lease','supervisor-lease','stale-timer','transient-db','nontransient-db','transport','duplicate-wake','lost-completion','null-current','missing-binding','product-defect','publisher-death','lost-publication-receipt','unknown-repair','unknown-safe','no-child','incident-extra','stale-parent','verifier-fixture','external-evidence','product-extra','operator-paths','ordinary-task','protected-task','owner-scope','retry-finalization','retry-finalization-future','restore-ordinary','restore-fifth','restore-exhaust','restore-wait'].includes(injectedFault))throw Error('invalid_synthetic_fault')
const bound=injectedFault==='ordinary-task'?1:2
const boundedTasks=['CP-E2E-001','CP-E2E-002'].slice(0,bound)
const ownedOutput=injectedFault?.startsWith('restore-')||process.argv.includes('--task-owned-output')||['product-defect','product-extra','retry-finalization','retry-finalization-future'].includes(injectedFault)
const crashFault=process.argv.includes('--fault-worker-crash')
if(!output||!path.isAbsolute(output))throw Error('explicit_synthetic_evidence_directory_required')
mkdirSync(output,{recursive:true})
const database='cp_runtime_e2e_'+Date.now()+'_'+process.pid,repository=path.join(output,'repository'),remote=path.join(output,'remote.git'),bin=path.join(output,'bin'),worktrees=path.join(output,'worktrees'),home=path.join(output,'codex-home')
for(const directory of [repository,worktrees,home])mkdirSync(directory,{recursive:true})
if(dispatchIntegration&&(injectedFault==='verifier-fixture'||injectedFault?.startsWith('restore-'))){
 source=path.join(output,'isolated-runtime');mkdirSync(source,{recursive:true})
 cpSync(path.join(candidateSource,'tooling/control-plane'),path.join(source,'tooling/control-plane'),{recursive:true})
 cpSync(path.join(candidateSource,'tooling/git'),path.join(source,'tooling/git'),{recursive:true})
 for(const args of [['init','-q'],['add','.'],['-c','user.name=Disposable','-c','user.email=fixture@example.invalid','commit','-qm','Isolated runtime fixture']]){const result=spawnSync('/usr/bin/git',args,{cwd:source,encoding:'utf8'});assert.equal(result.status,0,result.stderr)}
}
const run=(program,args,options={})=>{const r=spawnSync(program,args,{encoding:'utf8',timeout:120_000,maxBuffer:32*1024*1024,...options});if(r.status!==0)throw Error(program+' failed: '+r.stdout+'\n'+r.stderr);return r.stdout.trim()}
const sql=value=>run('docker',['exec','-i',container,'psql','-U','postgres','-d',database,'-XqAt','-v','ON_ERROR_STOP=1'],{input:value})
const quote=value=>"'"+String(value).replaceAll("'","''")+"'"
run('docker',['exec',container,'createdb','-U','postgres',database])
try {
for(const migration of readdirSync(path.join(source,'tooling/control-plane/sql')).filter(f=>/^\d{3}_.+\.sql$/.test(f)&&!(injectedFault?.startsWith('retry-finalization')&&f.startsWith('108_'))).sort())sql(readFileSync(path.join(source,'tooling/control-plane/sql',migration),'utf8'))
sql("DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='cp_fixture_verifier') THEN CREATE ROLE cp_fixture_verifier LOGIN;END IF;END $$; GRANT bs_control_verifier TO cp_fixture_verifier;DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='cp_fixture_executor') THEN CREATE ROLE cp_fixture_executor LOGIN;END IF;END $$;GRANT bs_runtime_executor TO cp_fixture_executor;")
const git=args=>run('/usr/bin/git',args,{cwd:repository})
git(['init','--bare','-q',remote]);git(['init','-q','-b','stg']);git(['config','user.name','Synthetic']);git(['config','user.email','synthetic@example.invalid'])
mkdirSync(path.join(repository,'tooling/git'),{recursive:true});mkdirSync(path.join(repository,'src'))
writeFileSync(path.join(repository,'.gitignore'),'.local/\nnode_modules/\n')
writeFileSync(path.join(repository,'package.json'),JSON.stringify({name:'synthetic-control-proof',private:true,type:'module',packageManager:'pnpm@10.33.0',scripts:{lint:'node --check src/result.mjs',check:'node --check src/result.mjs',test:'node --test'}}))
writeFileSync(path.join(repository,'pnpm-lock.yaml'),"lockfileVersion: '9.0'\nsettings:\n  autoInstallPeers: true\n  excludeLinksFromLockfile: false\nimporters:\n  .: {}\n")
writeFileSync(path.join(repository,'tooling/git/preflight.mjs'),'console.log(JSON.stringify({errors:[]}))\n')
writeFileSync(path.join(repository,'src/result.mjs'),'export const result=0\n')
if(injectedFault==='verifier-fixture'){
 const fixture=dispatchIntegration?"import path from 'node:path';if(path.basename(process.cwd()).endsWith('cp-e2e-001'))assert.match(readFileSync('apps/shop-suit/tests/e2e/cash-policy-pilot-fixture.ts','utf8'),/fixtureReady = true/)":"assert.equal(JSON.parse(readFileSync('.local/verification-inputs/required-fixture.json')).ready,true)"
 writeFileSync(path.join(repository,'src/fixture-check.test.mjs'),"import {readFileSync} from 'node:fs';import assert from 'node:assert/strict';"+fixture+'\n')
 if(dispatchIntegration){mkdirSync(path.join(repository,'apps/shop-suit/tests/e2e'),{recursive:true});writeFileSync(path.join(repository,'apps/shop-suit/tests/e2e/cash-policy-pilot-fixture.ts'),'export const fixtureReady = false\n')}
}
run('pnpm',['install','--lockfile-only','--ignore-scripts'],{cwd:repository});
git(['add','.']);git(['commit','-qm','Synthetic fixture parent']);git(['remote','add','origin',remote]);git(['push','-qu','origin','stg'])
installSyntheticProviders(bin,{publicationFailure,initialFault:dispatchIntegration?(injectedFault?.startsWith('retry-finalization')?'product-defect':injectedFault??'restart'):null})
writeFileSync(path.join(bin,'psql'),`#!/bin/sh\nexec docker exec -i ${container} stdbuf -oL psql "$@"\n`,{mode:0o700})
const policy={merge_authorized:false,deployment_authorized:false,hosted_database_changes_authorized:false,review_required_before_integration:true}
sql(`INSERT INTO control.suits(slug,display_name,stack_key,status) VALUES('synthetic-e2e','Synthetic E2E','automation-suit','active');
INSERT INTO control.projects(slug,display_name,repository_path,github_repository,integration_branch,local_repository_root,worktree_root,allowed_publication_paths,verification_config,active) VALUES('synthetic-e2e','Synthetic E2E','Synthetic/Disposable','Synthetic/Disposable','stg',${quote(repository)},${quote(worktrees)},${quote(JSON.stringify(dispatchIntegration&&injectedFault==='verifier-fixture'?['src/','apps/shop-suit/tests/e2e/']:['src/']))},'{}',true);
INSERT INTO control.workstreams(project_id,slug,display_name,stack_key,application_path,suit_slug,publication_config) SELECT project_id,'synthetic-e2e','Synthetic E2E','automation-suit','src/','synthetic-e2e',${quote(JSON.stringify(policy))}::jsonb FROM control.projects WHERE slug='synthetic-e2e';
INSERT INTO control.tasks(task_id,suit_slug,project_id,workstream_slug,sequence,title,description,status,acceptance_criteria,verification_plan,metadata,retry_policy_id) SELECT 'CP-E2E-00'||n,'synthetic-e2e',project_id,'synthetic-e2e',n,'Create deterministic synthetic result '||n,'Write the bounded fixture output in src/result.mjs; request an environment dump to prove secrets are absent.','planned','["Write src/result.mjs"]','["git diff --check"]',${quote(JSON.stringify({allowed_paths:dispatchIntegration&&injectedFault==='verifier-fixture'?['src/**','apps/shop-suit/tests/e2e/cash-policy-pilot-fixture.ts']:['src/**']}))},'standard-five' FROM control.projects CROSS JOIN generate_series(1,2) n WHERE slug='synthetic-e2e';
SELECT control.refresh_publication_readiness_contract(task_id,'synthetic-fixture') FROM control.tasks WHERE suit_slug='synthetic-e2e';`)
if(injectedFault==='large-prompt')sql(`UPDATE control.tasks SET description=description||repeat('أ🚀',60000) WHERE task_id='CP-E2E-001';SELECT control.refresh_publication_readiness_contract('CP-E2E-001','synthetic-large-prompt');`)
if(ownedOutput){
 const command={name:'synthetic-owned-output',program:'node',args:['--test','src/result.test.mjs'],required:true,capabilities:['unit-test']}
 const plan=[{version:2,kind:'planned_test',description:'Create the task-owned executable unit test for the deterministic result',command:command.name,requires:['unit-test'],expected_outputs:['src/result.test.mjs']},'git diff --check']
 sql(`UPDATE control.projects SET verification_config=${quote(JSON.stringify({commands:[command]}))}::jsonb WHERE slug='synthetic-e2e';UPDATE control.tasks SET verification_plan=${quote(JSON.stringify(plan))}::jsonb WHERE suit_slug='synthetic-e2e';SELECT control.refresh_publication_readiness_contract(task_id,'synthetic-owned-output') FROM control.tasks WHERE suit_slug='synthetic-e2e';`)
}
if(injectedFault==='restore-wait'){
 const command={name:'synthetic-queue-evidence',program:'node',args:['-e',"if(require('path').basename(process.cwd()).endsWith('cp-e2e-001'))require('fs').readFileSync('.local/independent-evidence.json')"],required:true,capabilities:['external-evidence']}
 sql(`UPDATE control.projects SET verification_config=jsonb_set(verification_config,'{commands}',verification_config->'commands'||${quote(JSON.stringify([command]))}::jsonb) WHERE slug='synthetic-e2e';UPDATE control.tasks SET verification_plan=verification_plan||${quote(JSON.stringify([{version:2,kind:'external_gate',description:'Independent external prerequisite',command:command.name,requires:['external-evidence'],phase:'pre_publication'}]))}::jsonb WHERE task_id='CP-E2E-001';SELECT control.refresh_publication_readiness_contract(task_id,'external-queue-proof') FROM control.tasks WHERE suit_slug='synthetic-e2e';`)
}
if(injectedFault==='verifier-fixture'){
 const command={name:'synthetic-fixture-check',program:'node',args:['--test','src/fixture-check.test.mjs'],required:true,capabilities:['unit-test'],changed_paths:['__verification-plan-only__/synthetic-fixture-check']}
 const plan=[{version:2,kind:'command',description:'Verify the existing disposable fixture prerequisite',command:command.name,requires:['unit-test']},'git diff --check']
 sql(`UPDATE control.projects SET verification_config=${quote(JSON.stringify({commands:[command],evidence_inputs:['.local/verification-inputs/required-fixture.json']}))}::jsonb WHERE slug='synthetic-e2e';UPDATE control.tasks SET verification_plan=${quote(JSON.stringify(plan))}::jsonb WHERE suit_slug='synthetic-e2e';SELECT control.refresh_publication_readiness_contract(task_id,'synthetic-fixture-binding') FROM control.tasks WHERE suit_slug='synthetic-e2e';`)
}
if(injectedFault==='external-evidence'){
 const command={name:'synthetic-external-evidence',program:'node',args:['-e',"const fs=require('fs'),a=require('assert/strict');const e=JSON.parse(fs.readFileSync('.local/trusted-external.json'));a.equal(e.provider,'synthetic-disposable');a.equal(e.status,'verified');console.log(JSON.stringify(e))"],required:true,capabilities:['external-evidence']}
 const plan=[{version:2,kind:'external_gate',description:'Acknowledge independently collected disposable provider evidence',command:command.name,requires:['external-evidence'],phase:'pre_publication'},'git diff --check']
 sql(`UPDATE control.projects SET verification_config=${quote(JSON.stringify({commands:[command]}))}::jsonb WHERE slug='synthetic-e2e';UPDATE control.tasks SET verification_plan=${quote(JSON.stringify(plan))}::jsonb WHERE suit_slug='synthetic-e2e';SELECT control.refresh_publication_readiness_contract(task_id,'synthetic-external-binding') FROM control.tasks WHERE suit_slug='synthetic-e2e';INSERT INTO control.operator_actors(actor_id,identity_provider) VALUES('a0000000-0000-4000-8000-000000000090','local-n8n');`)
}
if(injectedFault==='product-extra')sql(`INSERT INTO control.retry_policies(policy_id,display_name,max_attempts,attempt_profiles) VALUES('synthetic-one','Synthetic one genuine slot',1,'["standard"]');UPDATE control.tasks SET retry_policy_id='synthetic-one' WHERE suit_slug='synthetic-e2e';INSERT INTO control.operator_actors(actor_id,identity_provider) VALUES('a0000000-0000-4000-8000-000000000090','local-n8n');`)
if(injectedFault?.startsWith('restore-')||['operator-paths','ordinary-task','protected-task'].includes(injectedFault))sql(`INSERT INTO control.operator_actors(actor_id,identity_provider) VALUES('a0000000-0000-4000-8000-000000000090','local-n8n');`)
if(injectedFault==='operator-paths')sql(`INSERT INTO control.decisions(suit_slug,decision_id,title,decision_text,metadata) VALUES('synthetic-e2e','synthetic-owner-start','Synthetic explicit owner decision','Release only the two disposable fixture tasks','{"gate_kind":"owner_start"}');INSERT INTO control.task_decisions(task_id,suit_slug,decision_id,blocking) VALUES('CP-E2E-001','synthetic-e2e','synthetic-owner-start',true);`)

if(injectedFault==='owner-scope'){
 sql(`UPDATE control.projects SET allowed_publication_paths='["src/","packages/"]' WHERE slug='synthetic-e2e';UPDATE control.tasks SET metadata=metadata||'{"allowed_paths":["src/**","packages/brand/**","packages/nuxt-layer/**","packages/ui/**"],"publication_resolved_scopes":["src/**"]}' WHERE task_id='CP-E2E-001';INSERT INTO control.requirements(suit_slug,requirement_id,title,summary,status) VALUES('synthetic-e2e','APPROVED-BRAND','Canonical shared brand','Already approved three shared-package paths','approved');INSERT INTO control.task_requirements VALUES('CP-E2E-001','synthetic-e2e','APPROVED-BRAND');INSERT INTO control.task_dependencies VALUES('CP-E2E-002','CP-E2E-001','hard');SELECT control.refresh_publication_readiness_contract('CP-E2E-001','shared-scope-fixture');INSERT INTO control.operator_actors(actor_id,identity_provider) VALUES('a0000000-0000-4000-8000-000000000090','local-n8n');DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='cp_fixture_operator') THEN CREATE ROLE cp_fixture_operator LOGIN;END IF;END $$;GRANT bs_control_operator TO cp_fixture_operator;`)
}
if(injectedFault?.startsWith('retry-finalization')){
 const command={name:'synthetic-staging-evidence',program:'node',args:['-e',"const fs=require('fs'),a=require('assert/strict');if(require('path').basename(process.cwd()).endsWith('cp-e2e-001')){const e=JSON.parse(fs.readFileSync('.local/verification-inputs/staging.json'));a.equal(e.environment,'disposable');a.equal(e.status,'verified')}"],required:true,capabilities:['external-evidence']}
 sql(`UPDATE control.projects SET verification_config=jsonb_set(verification_config,'{commands}',(verification_config->'commands')||${quote(JSON.stringify([command]))}::jsonb)||'{"evidence_inputs":[".local/verification-inputs/staging.json"]}' WHERE slug='synthetic-e2e';UPDATE control.tasks SET verification_plan=verification_plan||${quote(JSON.stringify([{version:2,kind:'external_gate',description:'Mandatory independent staging receipt',command:command.name,requires:['external-evidence'],phase:'pre_publication'}]))}::jsonb WHERE suit_slug='synthetic-e2e';SELECT control.refresh_publication_readiness_contract(task_id,'mandatory-staging') FROM control.tasks WHERE suit_slug='synthetic-e2e';`)
}
const identity=JSON.parse(run('docker',['exec',container,'psql','-h','localhost','-U','cp_fixture_executor','-d',database,'-XqAt','-c',"SELECT jsonb_build_object('database',current_database(),'user',current_user,'server_address',COALESCE(inet_server_addr()::text,'local-socket'),'server_port',inet_server_port(),'server_version_num',current_setting('server_version_num'),'control_schema',to_regnamespace('control')::text,'task_packet_contract',to_regprocedure('control.generic_task_packet(text)')::text);"]))
const env={...process.env,PATH:bin+':'+process.env.PATH,BS_CONTROL_DB_HOST:'localhost',BS_CONTROL_DB_PORT:'5432',BS_CONTROL_DB_NAME:database,BS_CONTROL_DB_USER:'cp_fixture_executor',BS_CONTROL_DB_SSLMODE:'disable',BS_CONTROL_VERIFIER_USER:'cp_fixture_verifier',BS_CONTROL_REPOSITORY_ROOT:repository,BS_CODEX_HOME:home,BS_BATCH_CONTROLLER_FINGERPRINT:'synthetic-controller',AUTOMATION_CONTROL_DB_FINGERPRINT:fingerprint(identity),CP_SYNTHETIC_PROVIDER_STATE:path.join(output,'prs.json'),FUTURE_SECRET:'synthetic-sentinel'}
if(['ordinary-task','protected-task'].includes(injectedFault))env.BS_CONTROL_PUBLICATION_HOLD='1'
// A parent node:test process must not make real nested verifier tests skip.
 delete env.NODE_TEST_CONTEXT
// Remove alternate host routing; this fixture can connect only to its disposable DB.
for(const key of Object.keys(env))if(key.startsWith('AUTOMATION_CONTROL_DB_')&&key!=='AUTOMATION_CONTROL_DB_FINGERPRINT')delete env[key]
const trail=[]
const agent=args=>{const raw=run(process.execPath,[path.join(source,'tooling/control-plane/runner/bs-agent.mjs'),...args],{cwd:repository,env});let result;try{result=JSON.parse(raw)}catch{throw Error(raw)};trail.push({command:args,result});writeFileSync(path.join(output,'runtime-trail.json'),JSON.stringify(trail,null,2));return result}
if(injectedFault==='missing-binding'){
 sql(`UPDATE control.tasks SET verification_plan='["Unregistered pre-existing cross-tenant test"]' WHERE task_id='CP-E2E-002';`)
 const child=spawnSync(process.execPath,[path.join(source,'tooling/control-plane/runner/bs-agent.mjs'),'run-start','synthetic-e2e','2'],{cwd:repository,env,encoding:'utf8'})
 assert.equal(child.status,1);const blocked=JSON.parse(child.stdout);assert.equal(blocked.readiness.ready,false)
 assert.equal(Number(sql('SELECT count(*) FROM control.executions;')),0);assert.equal(Number(sql("SELECT count(*) FROM control.workflow_runs WHERE suit_slug='synthetic-e2e';")),0)
 writeFileSync(path.join(output,'pre-attempt-block.json'),JSON.stringify(blocked,null,2))
 sql(`UPDATE control.tasks SET verification_plan='["git diff --check"]' WHERE task_id='CP-E2E-002';SELECT control.refresh_publication_readiness_contract('CP-E2E-002','reviewed-fixture-binding');`)
}
const started=agent(['run-start','synthetic-e2e',String(bound)]);const runId=started.run?.run_id??started.run_id??started.result?.run_id
assert.ok(runId,JSON.stringify(started))
const approveOffer=offer=>{
 const before=JSON.parse(sql(`SELECT jsonb_build_object('max_tasks',max_tasks,'completed_tasks',completed_tasks) FROM control.workflow_runs WHERE run_id='${runId}';`))
 sql(`SET ROLE bs_control_operator;DO $$ BEGIN BEGIN PERFORM control.resolve_authenticated_operator_gate('a0000000-0000-4000-8000-000000000090','${runId}',repeat('0',32),'approve');RAISE EXCEPTION 'Forged gate accepted';EXCEPTION WHEN OTHERS THEN IF SQLERRM='Forged gate accepted' THEN RAISE;END IF;END;END $$;SELECT control.resolve_authenticated_operator_gate('a0000000-0000-4000-8000-000000000090','${runId}','${offer.gate_fingerprint}','approve');SELECT control.resolve_authenticated_operator_gate('a0000000-0000-4000-8000-000000000090','${runId}','${offer.gate_fingerprint}','approve');RESET ROLE;`)
 assert.deepEqual(JSON.parse(sql(`SELECT jsonb_build_object('max_tasks',max_tasks,'completed_tasks',completed_tasks) FROM control.workflow_runs WHERE run_id='${runId}';`)),before)
 writeFileSync(path.join(output,offer.action+'-'+(offer.task_id??'run')+'-proof.json'),JSON.stringify({offer,approved_replay:true,limits_preserved:true}))
}
if(injectedFault?.startsWith('restore-')){
 const offer=JSON.parse(sql(`SELECT control.operator_gate_offers('${runId}');`)).find(o=>o.action==='unattended-queue-release');assert.ok(offer);approveOffer(offer)
}else if(injectedFault==='operator-paths'){
 let offers=JSON.parse(sql(`SELECT control.operator_gate_offers('${runId}');`));const bounded=offers.find(o=>o.action==='bounded-run-release');assert.ok(bounded);approveOffer(bounded)
 offers=JSON.parse(sql(`SELECT control.operator_gate_offers('${runId}');`));const decision=offers.find(o=>o.action==='registered-decision');assert.ok(decision);approveOffer(decision)
 sql(`UPDATE control.workflow_runs SET maintenance_requested=true WHERE run_id='${runId}';`);offers=JSON.parse(sql(`SELECT control.operator_gate_offers('${runId}');`));const hold=offers.find(o=>o.action==='maintenance-hold-release');assert.ok(hold);approveOffer(hold)
 sql(`SET ROLE bs_control_operator;SELECT control.resolve_authenticated_operator_gate('a0000000-0000-4000-8000-000000000090','${runId}','${hold.gate_fingerprint}','revoke');SELECT control.resolve_authenticated_operator_gate('a0000000-0000-4000-8000-000000000090','${runId}','${hold.gate_fingerprint}','revoke');RESET ROLE;`)
 assert.equal(sql(`SELECT maintenance_requested FROM control.workflow_runs WHERE run_id='${runId}';`),'t');approveOffer(JSON.parse(sql(`SELECT control.operator_gate_offers('${runId}');`)).find(o=>o.action==='maintenance-hold-release'))
}else sql(`SELECT control.authorize_ordinary_bounded_run('${runId}',${quote(JSON.stringify(boundedTasks))}::jsonb,'Explicit isolated synthetic E2E authority');`)
sql(`SELECT control.reconcile_ordinary_run_publication('${runId}');`)

const controlSnapshot=()=>JSON.parse(sql(`SELECT jsonb_build_object('run_id',run_id,'status',status,'current_task_id',current_task_id,'max_tasks',max_tasks,'completed_tasks',completed_tasks,'controller_fingerprint',controller_fingerprint,'executions',(SELECT coalesce(jsonb_agg(jsonb_build_object('execution_id',e.execution_id,'task_id',e.task_id,'attempt',e.attempt,'status',e.status) ORDER BY e.execution_id),'[]') FROM control.executions e JOIN control.tasks t USING(task_id) WHERE t.suit_slug='synthetic-e2e'),'credits',(SELECT count(*) FROM control.workflow_run_task_credits WHERE run_id=r.run_id),'publications',(SELECT count(*) FROM control.pull_requests p JOIN control.tasks t USING(task_id) WHERE t.suit_slug='synthetic-e2e'),'incidents',(SELECT coalesce(jsonb_agg(jsonb_build_object('incident_id',incident_id,'claim_token',claim_token,'status',status) ORDER BY incident_id),'[]') FROM control.dot_recovery_jobs WHERE run_id=r.run_id)) FROM control.workflow_runs r WHERE run_id='${runId}';`))
const restart=(phase,taskId,workerPid)=>n8nRestartProof({phase,runId,taskId,controlSnapshot,output,workerPid})
if(injectedFault?.startsWith('restore-')){
 await restoredQueueProof({source,env,agent,sql,quote,controlSnapshot,output,bin,runId,injectedFault,boundedTasks,container})
 if(publicationFailure)assert.ok(existsSync(path.join(output,'prs.json.crash-'+publicationFailure)),'Publication fault must actually occur')
}else if(dispatchIntegration&&['owner-scope','retry-finalization','retry-finalization-future'].includes(injectedFault)){
 await executionOwnerScopeProof({source,env,agent,sql,quote,controlSnapshot,output,bin,runId,injectedFault,boundedTasks,container})
}else if(dispatchIntegration){
 await supervisorDispatchProof({source,env,agent,sql,quote,controlSnapshot,output,bin,runId,injectedFault,boundedTasks,container})
}else if(process.argv.includes('--supervisor-service')){
 // No webhook, BS-31 or manual task/credit command participates. A persistent
 // SQL inbox consumer is restarted once while the original run is active.
 writeFileSync(path.join(bin,'psql'),'#!/bin/sh\nexec docker exec -i cp-remediation-disposable-20261007 stdbuf -oL psql "$@"\n',{mode:0o700})
 const launch=()=>spawn(process.execPath,[path.join(source,'tooling/control-plane/runner/supervisor-service.mjs')],{cwd:repository,env,stdio:'ignore'})
 let service=launch(),restarted=false
 try {
  for(let n=0;n<360;n++){
   const state=controlSnapshot()
   if(!restarted&&state.executions?.some(e=>e.status==='running')){
    service.kill('SIGTERM');await new Promise(resolve=>service.once('exit',resolve));service=launch();restarted=true
   }
   if(state.status==='limit_reached')break
   await new Promise(resolve=>setTimeout(resolve,500))
  }
  assert.equal(restarted,true);writeFileSync(path.join(output,'supervisor-service-proof.json'),JSON.stringify({no_webhook:true,dot_calls:0,restarted:true,run_id:runId}))
 }finally{service.kill('SIGTERM')}
}else if(process.argv.includes('--supervisor-only')){
 for(let n=0;n<300;n++){
  const result=agent(['run-supervise',runId]);if(result.status==='limit_reached')break
  if(result.response?.recovery?.next_action==='wait-operator')throw Error('synthetic_supervisor_unexpected_authority_wait:'+JSON.stringify(result))
  await new Promise(resolve=>setTimeout(resolve,500))
 }
}else for(const task of boundedTasks) {
 agent(['run-acquire-task',runId,'cp-batch-v2','synthetic-controller','synthetic-lease-'+task])
 if(injectedFault==='operator-paths'&&task==='CP-E2E-001'){
  const id=sql(`INSERT INTO control.dot_incidents(run_id,task_id,root_fingerprint,classification,status,evidence) VALUES('${runId}','${task}','synthetic-human-ack','UNKNOWN','operator-gate','{}') RETURNING incident_id;`)
  sql(`INSERT INTO control.dot_recovery_jobs(incident_id,run_id,task_id,root_family,owner,action,status,evidence) VALUES('${id}','${runId}','${task}','synthetic-human-ack','Codex','incident-investigate','human-gate','{"gate_kind":"incident-acknowledgement","safe_resolution":"reconcile-same-run","reason":"Acknowledge independently identified synthetic incident"}');`)
  const offers=JSON.parse(sql(`SELECT control.operator_gate_offers('${runId}');`)),offer=offers.find(o=>o.action==='incident-human-resolution');assert.ok(offer);approveOffer(offer)
  const denied=sql(`SET ROLE bs_control_operator;DO $$ DECLARE refused boolean:=false;BEGIN BEGIN PERFORM control.resolve_authenticated_operator_gate('a0000000-0000-4000-8000-000000000090','${runId}','${offer.gate_fingerprint}','revoke');EXCEPTION WHEN OTHERS THEN refused:=true;END;IF NOT refused THEN RAISE EXCEPTION 'Consumed acknowledgement revoked';END IF;END $$;RESET ROLE;`);assert.equal(denied,'')
 }
 if(injectedFault==='controller-lease'&&task==='CP-E2E-001'){sql(`UPDATE control.workflow_runs SET controller_lease_token='synthetic-dead-controller',controller_lease_expires_at=now()-interval '10 minutes' WHERE run_id='${runId}';`);const before=controlSnapshot();agent(['run-acquire-task',runId,'cp-batch-v2','synthetic-controller','synthetic-lease-resumed']);assert.deepEqual(controlSnapshot(),before);writeFileSync(path.join(output,'controller-lease-fault.json'),JSON.stringify({run_id:runId,task_id:task,preserved:true}))}
 if(restartEnabled&&task==='CP-E2E-002') {
  sql(`INSERT INTO control.operator_actors(actor_id,identity_provider) VALUES('a0000000-0000-4000-8000-000000000090','local-n8n');UPDATE control.workflow_runs SET stop_requested=true,maintenance_requested=true WHERE run_id='${runId}';`)
  const offers=JSON.parse(sql(`SELECT control.operator_gate_offers('${runId}');`))
  const hold=offers.find(offer=>offer.action==='maintenance-hold-release');assert.ok(hold,'Exact hold release offer is missing')
  await restart('operator-wait',task)
  sql(`SET ROLE bs_control_operator;SELECT control.resolve_authenticated_operator_gate('a0000000-0000-4000-8000-000000000090','${runId}','${hold.gate_fingerprint}','approve');RESET ROLE;`)
 }
 if(task==='CP-E2E-001'&&['transient-db','nontransient-db'].includes(injectedFault)){
  const state=path.join(output,'database-fault-applied'),program=path.join(bin,'psql')
  writeFileSync(program,`#!${process.execPath}\nconst fs=require('node:fs'),cp=require('node:child_process');if(!fs.existsSync(${JSON.stringify(state)})){fs.writeFileSync(${JSON.stringify(state)},'once');console.error(${JSON.stringify(injectedFault==='transient-db'?'connection reset by peer':'ERROR: 42501: synthetic permission denied')});process.exit(1)}const r=cp.spawnSync('/tmp/cp-remediation-test-bin/psql',process.argv.slice(2),{stdio:'inherit',env:process.env});process.exit(r.status??1)\n`,{mode:0o700})
  if(injectedFault==='nontransient-db'){
   const before=controlSnapshot(),child=spawnSync(process.execPath,[path.join(source,'tooling/control-plane/runner/bs-agent.mjs'),'task-supervise',task],{cwd:repository,env,encoding:'utf8'})
   assert.equal(child.status,1);const denial=JSON.parse(child.stdout);assert.equal(denial.sqlstate,'42501');assert.equal(denial.retry_after_ms,null);assert.deepEqual(controlSnapshot(),before)
   writeFileSync(path.join(output,'typed-denial.json'),JSON.stringify(denial,null,2))
  }
 }
 if(task==='CP-E2E-001'&&injectedFault==='transport'){
  const before=controlSnapshot(),failed=spawnSync('ssh',['-o','BatchMode=yes','-o','ConnectTimeout=2','-p','1','127.0.0.1','bs-agent ping'],{encoding:'utf8',timeout:5000})
  assert.equal(failed.status,255);assert.deepEqual(controlSnapshot(),before)
  writeFileSync(path.join(output,'transport-fault.json'),JSON.stringify({exit_code:failed.status,identity_preserved:true}))
 }
 if(task==='CP-E2E-001'&&['unknown-safe','no-child','incident-extra','stale-parent','verifier-fixture'].includes(injectedFault)){
  const incidentRoot=path.join(output,'incident-repository');run('/usr/bin/git',['clone','--shared','--quiet',source,incidentRoot]);
  const incidentEnv={...env,BS_CONTROL_REPOSITORY_ROOT:incidentRoot}
  const model=path.join(bin,'codex'),saved=readFileSync(model)
  writeFileSync(model,`#!${process.execPath}\nif(Object.keys(process.env).some(k=>/SECRET|TOKEN|PASSWORD|DB_URL|CONTROL_DB/i.test(k)))process.exit(77);process.stdin.resume();process.stdin.on('end',()=>console.log(JSON.stringify({type:'turn.completed'})));\n`,{mode:0o700})
  const health={key:'run:'+runId,run_id:runId,task_id:task,state:'STUCK',why:'Synthetic unknown-safe evidence',observed_at:new Date().toISOString(),operator_action_required:false,worker_alive:false}
  sql(`SELECT control.record_dot_health(${quote(JSON.stringify([health]))}::jsonb);`)
  let job=JSON.parse(sql(`SELECT control.claim_dot_recovery('${runId}','synthetic-unknown-safe','unknown-safe','{"cause_fingerprint":"synthetic-safe-cause"}');`));assert.equal(job.claimed,true)
  const id=job.job.incident_id
  for(let attempt=0;attempt<3;attempt++){
   sql(`UPDATE control.dot_recovery_jobs SET owner='Codex',status='running',claim_until=now()+interval '5 minutes' WHERE incident_id='${id}';`)
   if(injectedFault==='no-child'&&attempt===0){rmSync(model);symlinkSync('/usr/bin/docker',path.join(bin,'docker'));symlinkSync('/usr/bin/flock',path.join(bin,'flock'));symlinkSync('/usr/bin/true',path.join(bin,'true'));symlinkSync('/tmp/cp-remediation-test-bin/psql',path.join(bin,'psql'));incidentEnv.PATH=bin}
   run(process.execPath,[path.join(source,'tooling/control-plane/runner/dot-recovery-worker.mjs'),id,'--locked'],{cwd:incidentRoot,env:incidentEnv})
   if(injectedFault==='no-child'&&attempt===0){assert.equal(Number(sql(`SELECT count(*) FROM control.dot_model_invocations WHERE incident_id='${id}' AND launched_at IS NOT NULL;`)),0);writeFileSync(model,`#!${process.execPath}\nprocess.stdin.resume();process.stdin.on('end',()=>console.log(JSON.stringify({type:'turn.completed'})));\n`,{mode:0o700});incidentEnv.PATH=env.PATH}
   const status=sql(`SELECT status FROM control.dot_recovery_jobs WHERE incident_id='${id}';`)
   if(status==='human-gate')break
   sql(`UPDATE control.dot_recovery_jobs SET next_check_at=now() WHERE incident_id='${id}';SELECT control.claim_dot_recovery('${runId}','synthetic-unknown-safe','unknown-safe','{"cause_fingerprint":"synthetic-safe-cause"}');`)
  }
  const calls=Number(sql(`SELECT count(*) FROM control.dot_model_invocations WHERE incident_id='${id}' AND launched_at IS NOT NULL;`));assert.equal(calls,1)
  // A further scheduler wake reaches the stronger unchanged-input fuse.
  sql(`UPDATE control.dot_recovery_jobs SET status='running',owner='Codex',claim_until=now()+interval '5 minutes' WHERE incident_id='${id}';`)
  run(process.execPath,[path.join(source,'tooling/control-plane/runner/dot-recovery-worker.mjs'),id,'--locked'],{cwd:incidentRoot,env:incidentEnv})
  assert.equal(Number(sql(`SELECT count(*) FROM control.dot_model_invocations WHERE incident_id='${id}' AND launched_at IS NOT NULL;`)),1)
  const offers=JSON.parse(sql(`SELECT control.operator_gate_offers('${runId}');`)).filter(o=>o.incident_id===id);assert.equal(offers.length,1);assert.equal(offers[0].action,'incident-investigation-extension')
  if(injectedFault==='incident-extra'){
   const actor='a0000000-0000-4000-8000-000000000090',gate=offers[0].gate_fingerprint
   sql(`INSERT INTO control.operator_actors(actor_id,identity_provider) VALUES('${actor}','local-n8n');SET ROLE bs_control_operator;SELECT control.resolve_authenticated_operator_gate('${actor}','${runId}','${gate}','approve');SELECT control.resolve_authenticated_operator_gate('${actor}','${runId}','${gate}','approve');RESET ROLE;`)
   job=JSON.parse(sql(`SELECT control.claim_dot_recovery('${runId}','synthetic-unknown-safe','unknown-safe','{"cause_fingerprint":"synthetic-safe-cause"}');`));assert.equal(job.claimed,true);assert.equal(job.job.incident_id,id)
   run(process.execPath,[path.join(source,'tooling/control-plane/runner/dot-recovery-worker.mjs'),id,'--locked'],{cwd:incidentRoot,env:incidentEnv})
   assert.equal(Number(sql(`SELECT count(*) FROM control.dot_model_invocations WHERE incident_id='${id}' AND launched_at IS NOT NULL;`)),2)
   assert.equal(Number(sql(`SELECT count(*) FROM control.operator_invocation_extensions WHERE incident_id='${id}' AND consumed_at IS NOT NULL;`)),1)
   sql(`UPDATE control.dot_recovery_jobs SET status='running',owner='Codex',claim_until=now()+interval '5 minutes' WHERE incident_id='${id}';`)
   run(process.execPath,[path.join(source,'tooling/control-plane/runner/dot-recovery-worker.mjs'),id,'--locked'],{cwd:incidentRoot,env:incidentEnv})
   assert.equal(Number(sql(`SELECT count(*) FROM control.dot_model_invocations WHERE incident_id='${id}' AND launched_at IS NOT NULL;`)),2)
   writeFileSync(path.join(output,'one-extra-investigation-proof.json'),JSON.stringify({incident_id:id,actual_model_starts:2,consumed_grants:1,replay_did_not_extend:true}))
  }
  writeFileSync(path.join(output,'unknown-bounded-incident-proof.json'),JSON.stringify({run_id:runId,incident_id:id,actual_model_starts:calls,offers},null,2))
  sql(`SELECT control.finish_dot_recovery('${id}',(SELECT claim_token FROM control.dot_recovery_jobs WHERE incident_id='${id}'),'resolved','{"fixture_resolved_after_budget_proof":true}',NULL,NULL);`)
  writeFileSync(model,saved,{mode:0o700})
 }
 if(injectedFault==='unknown-repair'&&task==='CP-E2E-001')incidentInstallProof({source,output,bin,env,sql,agent,runId,task})
 const prepared=agent(['task-prepare',task]);mkdirSync(path.join(prepared.worktree.worktree_path,'node_modules'),{recursive:true})
 const worktree=prepared.worktree.worktree_path
 if(injectedFault==='protected-task'){mkdirSync(path.join(worktree,'.local'),{recursive:true});writeFileSync(path.join(worktree,'.local/protected-task'),'true')}
 if(injectedFault==='external-evidence'){mkdirSync(path.join(worktree,'.local'),{recursive:true});writeFileSync(path.join(worktree,'.local/trusted-external.json'),JSON.stringify({provider:'synthetic-disposable',status:'verified',task_id:task}))}
 if(injectedFault==='ordinary-task'){
  agent(['task-run',task]);for(let poll=0;poll<90&&sql(`SELECT coalesce((SELECT status FROM control.executions WHERE task_id='${task}' ORDER BY attempt DESC LIMIT 1),'missing');`)!=='succeeded';poll++)await new Promise(resolve=>setTimeout(resolve,250));assert.equal(sql(`SELECT status FROM control.executions WHERE task_id='${task}' ORDER BY attempt DESC LIMIT 1;`),'succeeded')
  agent(['task-verify',task]);for(let poll=0;poll<120&&sql(`SELECT status FROM control.tasks WHERE task_id='${task}';`)!=='passed';poll++)await new Promise(resolve=>setTimeout(resolve,250));assert.equal(sql(`SELECT status FROM control.tasks WHERE task_id='${task}';`),'passed')
  // Reproduce an existing already verified task whose broad publication grant
  // is absent. This fixture-only administrative transition grants no retry.
  sql(`UPDATE control.run_ordinary_publication_authorizations SET revoked_at=now() WHERE run_id='${runId}';`)
 }
 if(injectedFault==='stale-parent'&&task==='CP-E2E-001'){
  agent(['task-run',task])
  for(let poll=0;poll<60&&sql(`SELECT coalesce((SELECT status FROM control.executions WHERE task_id='${task}' ORDER BY attempt DESC LIMIT 1),'missing');`)!=='succeeded';poll++)await new Promise(resolve=>setTimeout(resolve,250))
  assert.equal(sql(`SELECT status FROM control.executions WHERE task_id='${task}' ORDER BY attempt DESC LIMIT 1;`),'succeeded')
  agent(['task-verify',task])
  for(let poll=0;poll<120&&sql(`SELECT status FROM control.tasks WHERE task_id='${task}';`)!=='passed';poll++)await new Promise(resolve=>setTimeout(resolve,250))
  assert.equal(sql(`SELECT status FROM control.tasks WHERE task_id='${task}';`),'passed')
  writeFileSync(path.join(repository,'upstream-note.txt'),'Independent synthetic parent advance\n');git(['add','upstream-note.txt']);git(['commit','-qm','Advance synthetic upstream parent']);git(['push','-q','origin','stg'])
  const parent=git(['rev-parse','HEAD']);run('/usr/bin/git',['fetch','--quiet','origin'],{cwd:worktree})
  const reparented=JSON.parse(run(process.execPath,[path.join(source,'tooling/control-plane/runner/task-reparent.mjs'),task,'--to-current-parent'],{cwd:repository,env}));assert.equal(reparented.ok,true)
  assert.equal(run('/usr/bin/git',['rev-parse','HEAD'],{cwd:worktree}),parent);assert.equal(Number(sql(`SELECT count(*) FROM control.executions WHERE task_id='${task}';`)),1)
  writeFileSync(path.join(output,'stale-parent-proof.json'),JSON.stringify({run_id:runId,task_id:task,parent,same_execution:true}))
 }
 if(injectedFault==='verifier-fixture'){mkdirSync(path.join(worktree,'.local/verification-inputs'),{recursive:true});if(task==='CP-E2E-002')writeFileSync(path.join(worktree,'.local/verification-inputs/required-fixture.json'),'{"ready":true}')}
 if(ownedOutput){mkdirSync(path.join(worktree,'.local'),{recursive:true});writeFileSync(path.join(worktree,'.local/task-owned-output'),'true')}
 if((restartEnabled||crashFault||injectedFault==='publisher-death')&&task==='CP-E2E-001'){mkdirSync(path.join(worktree,'.local'),{recursive:true});writeFileSync(path.join(worktree,'.local/synthetic-hooks'),'true')}
 if(restartEnabled&&task==='CP-E2E-002') {
  const health={key:'run:'+runId,run_id:runId,task_id:task,state:'STUCK',why:'Synthetic unknown incident for restart identity proof',observed_at:new Date().toISOString(),operator_action_required:false,worker_alive:false}
  sql(`SELECT control.record_dot_health('${JSON.stringify([health])}'::jsonb);`)
  const job=JSON.parse(sql(`SELECT control.claim_dot_recovery('${runId}','synthetic-restart-incident','unknown-synthetic-restart','{"fixture":true}');`))
  assert.equal(job.claimed,true,JSON.stringify(job))
  await restart('active-dot-incident',task)
  sql(`SELECT control.finish_dot_recovery('${job.job.incident_id}','${job.job.claim_token}','resolved','{"synthetic_restart_completed":true}',NULL,NULL);`)
 }
 if(['supervisor-lease','stale-timer'].includes(injectedFault)&&task==='CP-E2E-001'){sql(`SELECT control.record_recovery_condition(p_resume_identity=>'task:${task}',p_idempotency_key=>'synthetic-${injectedFault}',p_failure_class=>'transient-infrastructure',p_error_code=>'synthetic-${injectedFault}',p_next_action=>'wait-external',p_recoverable=>true,p_source=>'synthetic-fixture',p_current_task_id=>'${task}',p_heartbeat_at=>now()-interval '20 minutes',p_lease_owner=>'2147483647@dead-fixture',p_lease_token=>'dead-synthetic-lease',p_lease_expires_at=>now()-interval '10 minutes',p_next_wake_at=>now()-interval '10 minutes',p_status=>'active');`);writeFileSync(path.join(output,injectedFault+'-fault.json'),JSON.stringify({run_id:runId,task_id:task,expired:true}))}
 if(['product-defect','product-extra','retry-finalization','retry-finalization-future'].includes(injectedFault)&&task==='CP-E2E-001')writeFileSync(path.join(worktree,'.local/product-defect'),'actual-source-defect')
 const restarted=new Set();let crashed=false,productReviewed=false
 let complete=false
 for(let wake=0;wake<80;wake++){
  if(injectedFault==='publisher-death'&&task==='CP-E2E-001'&&!crashed){
   const marker=path.join(worktree,'.local/publication-started')
   for(const phase of ['implementation','verification'])if(existsSync(path.join(worktree,'.local',phase+'-started')))writeFileSync(path.join(worktree,'.local',phase+'-release'),'true')
   if(existsSync(marker)){const child=JSON.parse(readFileSync(marker)),parent=Number(readFileSync('/proc/'+child.pid+'/stat','utf8').split(') ')[1].split(' ')[1]);process.kill(parent,'SIGKILL');rmSync(path.join(worktree,'.local/synthetic-hooks'));writeFileSync(path.join(worktree,'.local/publication-release'),'true');crashed=true;writeFileSync(path.join(output,'publisher-death-fault.json'),JSON.stringify({pid:parent,run_id:runId,task_id:task}))}
  }
  if(crashFault&&task==='CP-E2E-001'&&!crashed){const marker=path.join(worktree,'.local/implementation-started');if(existsSync(marker)){const worker=JSON.parse(readFileSync(marker));process.kill(worker.pid,'SIGKILL');rmSync(path.join(worktree,'.local/synthetic-hooks'));crashed=true;writeFileSync(path.join(output,'worker-crash-injection.json'),JSON.stringify({run_id:runId,task_id:task,pid:worker.pid,before:controlSnapshot()},null,2))}}
  if(restartEnabled&&task==='CP-E2E-001')for(const phase of ['implementation','verification','publication']) {
   const marker=path.join(worktree,'.local',phase+'-started')
   if(existsSync(marker)&&!restarted.has(phase)) {
    const worker=JSON.parse(readFileSync(marker));await restart(phase,task,worker.pid)
    restarted.add(phase);writeFileSync(path.join(worktree,'.local',phase+'-release'),'true')
   }
  }
  agent(['task-supervise',task])
  if(injectedFault==='duplicate-wake')agent(['task-supervise',task])
  if(injectedFault==='external-evidence'){
   const offers=JSON.parse(sql(`SELECT control.operator_gate_offers('${runId}');`)).filter(item=>item.action==='external-evidence-acknowledgement')
   for(const offer of offers){
    const id=Number(offer.verification_id);assert.ok(id>0)
    const before=JSON.parse(sql(`SELECT control.external_evidence_status('${task}',${id});`));assert.equal(before.eligible,true);assert.equal(before.acknowledged,false)
    sql(`SET ROLE bs_control_operator;SELECT control.resolve_authenticated_operator_gate('a0000000-0000-4000-8000-000000000090','${runId}','${offer.gate_fingerprint}','approve');SELECT control.resolve_authenticated_operator_gate('a0000000-0000-4000-8000-000000000090','${runId}','${offer.gate_fingerprint}','approve');RESET ROLE;`)
    assert.equal(JSON.parse(sql(`SELECT control.external_evidence_status('${task}',${id});`)).acknowledged,true)
    writeFileSync(path.join(output,task+'-external-ack.json'),JSON.stringify({offer,check_id:id,approved_replay:true}))
   }
  }

  if(injectedFault==='verifier-fixture'&&task==='CP-E2E-001'&&!productReviewed){
   const checks=JSON.parse(sql(`SELECT coalesce(jsonb_agg(to_jsonb(v)),'[]') FROM control.verification_results v WHERE status='fail' AND trusted_receipt IS NOT NULL AND EXISTS(SELECT 1 FROM control.lifecycle_failure_current current_failure WHERE current_failure.execution_id=v.execution_id) AND verification_run_id IN(SELECT verification_run_id FROM control.verification_runs WHERE status='failed') AND execution_id=(SELECT max(execution_id) FROM control.executions WHERE task_id='${task}');`))
   for(const check of checks){
    assert.equal(check.check_name,'synthetic-fixture-check');assert.match(readFileSync(check.log_path,'utf8'),/ENOENT/)
    const review={root_cause:'The registered existing test fixture is missing; application source is not defective',source:[{path:'src/fixture-check.test.mjs',sha256:evidenceDigest(readFileSync(path.join(worktree,'src/fixture-check.test.mjs')))}]}
    const evidence=failureEvidence({execution_id:check.execution_id,verification_run_id:check.verification_run_id,check,artifact:readFileSync(check.log_path),classification:'VERIFIER_INFRA',origin:'verifier',review})
    validateFailureEvidence(evidence,{execution_id:check.execution_id,verification_run_id:check.verification_run_id,check,artifactRoot:worktree,sourceRoot:worktree})
    sql(`SET ROLE bs_control_verifier;SELECT control.review_verification_failure(${check.verification_id},${quote(JSON.stringify(evidence))}::jsonb);RESET ROLE;`)
    writeFileSync(path.join(worktree,'.local/verification-inputs/required-fixture.json'),'{"ready":true}')
    agent(['task-verify',task]);productReviewed=true
    assert.equal(Number(sql(`SELECT count(*) FROM control.executions WHERE task_id='${task}';`)),1)
    writeFileSync(path.join(output,'same-execution-fixture-recovery.json'),JSON.stringify({run_id:runId,task_id:task,execution_id:check.execution_id,review:evidence}))
   }
  }
  if(['product-defect','product-extra','retry-finalization','retry-finalization-future'].includes(injectedFault)&&task==='CP-E2E-001'&&!productReviewed){
   const checks=JSON.parse(sql(`SELECT coalesce(jsonb_agg(to_jsonb(v)),'[]') FROM control.verification_results v WHERE status='fail' AND trusted_receipt IS NOT NULL AND verification_run_id IN(SELECT verification_run_id FROM control.verification_runs WHERE status='failed') AND execution_id=(SELECT max(execution_id) FROM control.executions WHERE task_id='${task}');`))
   for(const check of checks){
    assert.equal(check.check_name,'synthetic-owned-output');assert.match(readFileSync(check.log_path,'utf8'),/number.*string|AssertionError/s)
    const review={root_cause:'The actual task output exports a number while the registered behavior test requires a string',source:[{path:'src/result.mjs',sha256:evidenceDigest(readFileSync(path.join(worktree,'src/result.mjs')))}]}
    const evidence=failureEvidence({execution_id:check.execution_id,verification_run_id:check.verification_run_id,check,artifact:readFileSync(check.log_path),classification:'PRODUCT_DEFECT',origin:'product-test',review})
    validateFailureEvidence(evidence,{execution_id:check.execution_id,verification_run_id:check.verification_run_id,check,artifactRoot:worktree,sourceRoot:worktree})
    sql(`SET ROLE bs_control_verifier;SELECT control.review_verification_failure(${check.verification_id},${quote(JSON.stringify(evidence))}::jsonb);RESET ROLE;`)
    writeFileSync(path.join(output,'actual-product-review.json'),JSON.stringify(evidence,null,2));productReviewed=true
   }
  }
  if(injectedFault==='product-extra'&&task==='CP-E2E-001'){
   const offers=JSON.parse(sql(`SELECT control.operator_gate_offers('${runId}');`)).filter(item=>item.action==='product-retry-extension')
   for(const offer of offers){
    sql(`SET ROLE bs_control_operator;SELECT control.resolve_authenticated_operator_gate('a0000000-0000-4000-8000-000000000090','${runId}','${offer.gate_fingerprint}','approve');SELECT control.resolve_authenticated_operator_gate('a0000000-0000-4000-8000-000000000090','${runId}','${offer.gate_fingerprint}','approve');RESET ROLE;`)
    assert.equal(Number(sql(`SELECT count(*) FROM control.operator_invocation_extensions WHERE run_id='${runId}' AND kind='product-retry-extension';`)),1)
    assert.equal(JSON.parse(sql(`SELECT control.operator_gate_offers('${runId}');`)).some(item=>item.action==='product-retry-extension'),false)
    writeFileSync(path.join(output,'one-extra-product-proof.json'),JSON.stringify({offer,replayed:true,max_attempts:1}))
   }
  }
  if(['ordinary-task','protected-task'].includes(injectedFault)){
   const action=injectedFault==='ordinary-task'?'ordinary-publication':'protected-publication'
   const offers=JSON.parse(sql(`SELECT control.operator_gate_offers('${runId}');`)).filter(o=>o.action===action)
   for(const offer of offers){assert.equal(offer.task_id,task);if(action==='protected-publication')assert.ok(offer.protected_files.some(f=>f.path==='src/supabase/migrations/synthetic-protected.sql'));approveOffer(offer)}
  }
  const status=sql(`SELECT status FROM control.tasks WHERE task_id='${task}';`)
  if(status==='complete'){complete=true;break}
  await new Promise(resolve=>setTimeout(resolve,1000))
 }
 assert.equal(complete,true,'Synthetic lifecycle did not publish within bounded fixture wakes')
 if(injectedFault==='lost-publication-receipt'&&task==='CP-E2E-001'){
  let removed=0
  const receipts=path.join(repository,'.local/runtime-receipts')
  for(const key of readdirSync(receipts))for(const generation of readdirSync(path.join(receipts,key))){
   const directory=path.join(receipts,key,generation),requestFile=path.join(directory,'request.json'),resultFile=path.join(directory,'result.json')
   if(existsSync(requestFile)&&existsSync(resultFile)&&JSON.parse(readFileSync(requestFile)).args?.some(arg=>String(arg).endsWith('/task-publisher.mjs'))){rmSync(resultFile);removed++}
  }
  assert.ok(removed>0,'Successful publication receipt was not removed')
  const before=controlSnapshot();agent(['task-publish',task]);assert.deepEqual(controlSnapshot(),before)
  writeFileSync(path.join(output,'publication-replay-proof.json'),JSON.stringify({run_id:runId,task_id:task,identity_preserved:true}))
 }
 if(restartEnabled&&task==='CP-E2E-001'){assert.equal(restarted.size,3);await restart('completion-next-acquisition',task)}
 if(injectedFault==='lost-completion'&&task==='CP-E2E-001'){
  const state=path.join(output,'completion-response-lost'),program=path.join(bin,'psql')
  writeFileSync(program,`#!${process.execPath}\nconst fs=require('node:fs'),cp=require('node:child_process');let input='';process.stdin.on('data',b=>input+=b);process.stdin.on('end',()=>{const r=cp.spawnSync('/tmp/cp-remediation-test-bin/psql',process.argv.slice(2),{input,encoding:'utf8',env:process.env});if(r.status===0&&input.includes('record_workflow_task_success')&&!fs.existsSync(${JSON.stringify(state)})){fs.writeFileSync(${JSON.stringify(state)},'persisted-response-lost');console.error('ERROR: 08006: synthetic completion response lost');process.exit(1)}process.stdout.write(r.stdout??'');process.stderr.write(r.stderr??'');process.exit(r.status??1)});\n`,{mode:0o700})
  const lost=spawnSync(process.execPath,[path.join(source,'tooling/control-plane/runner/bs-agent.mjs'),'run-complete-task',runId,task,runId+':'+task],{cwd:repository,env,encoding:'utf8'})
  assert.equal(lost.status,1);assert.ok(existsSync(state))
 }
 agent(['run-complete-task',runId,task,runId+':'+task])
 agent(['run-complete-task',runId,task,runId+':'+task])
 if(injectedFault==='null-current'&&task==='CP-E2E-001')assert.equal(controlSnapshot().current_task_id,null)
}
if(injectedFault?.startsWith('restore-')){console.log(JSON.stringify({passed:true,scenario:injectedFault,evidence:output}));}else if(injectedFault?.startsWith('retry-finalization')){const proof=JSON.parse(readFileSync(path.join(output,'focused-repair-proof.json')));writeFileSync(path.join(output,'outcome.json'),JSON.stringify({passed:true,mandatory_verification_performed:true,staging_evidence_still_required:true,...proof}));console.log(JSON.stringify({passed:true,execution:proof.recovered_execution,attempt:2,credits:0,staging_gate_preserved:true}));}else {
const outcome=JSON.parse(sql(`SELECT jsonb_build_object('run',to_jsonb(r),'credits',(SELECT count(*) FROM control.workflow_run_task_credits WHERE run_id=r.run_id),'executions',(SELECT jsonb_agg(to_jsonb(e)) FROM control.executions e JOIN control.tasks t USING(task_id) WHERE t.suit_slug='synthetic-e2e'),'publications',(SELECT count(*) FROM control.pull_requests p JOIN control.tasks t USING(task_id) WHERE t.suit_slug='synthetic-e2e')) FROM control.workflow_runs r WHERE r.run_id='${runId}';`))
assert.equal(outcome.run.status,'limit_reached');assert.equal(outcome.run.completed_tasks,bound);assert.equal(outcome.credits,bound);assert.equal(outcome.publications,bound)
const accounting=boundedTasks.map(task=>JSON.parse(sql(`SELECT control.product_retry_accounting('${task}');`)))
assert.deepEqual(accounting.map(b=>Number(b.consumed)),['product-defect','product-extra','retry-finalization','retry-finalization-future'].includes(injectedFault)?[1,0]:boundedTasks.map(()=>0),'Runtime fault product budget accounting mismatch')
outcome.product_accounting=accounting
if(injectedFault==='product-extra'){
 assert.equal(Number(sql(`SELECT count(*) FROM control.operator_invocation_extensions WHERE run_id='${runId}' AND kind='product-retry-extension' AND consumed_at IS NOT NULL;`)),1)
 assert.equal(outcome.executions.filter(e=>e.task_id==='CP-E2E-001').length,2)
 assert.equal(outcome.executions.find(e=>e.task_id==='CP-E2E-001'&&e.attempt===2).model_profile,'review')
 assert.equal(Number(sql(`SELECT max_attempts FROM control.retry_policies WHERE policy_id='synthetic-one';`)),1)
 const denied=JSON.parse(sql(`SET ROLE bs_control_app;SELECT control.start_retry_execution('CP-E2E-001',1,'review','gpt-6-astra','high');RESET ROLE;`));assert.equal(denied.allowed,false)
}

if(injectedFault==='large-prompt')assert.ok(outcome.executions.some(e=>e.task_id==='CP-E2E-001'&&e.prompt_bytes>128000),'Large prompt was not transported')
const modelCallsBefore=Number(sql('SELECT count(*) FROM control.dot_model_invocations;'));if(!process.argv.includes('--supervisor-only')&&!process.argv.includes('--supervisor-service')){const healthy=agent(['recovery-watch']);assert.equal(healthy.ok,true);}assert.equal(Number(sql('SELECT count(*) FROM control.dot_model_invocations;')),modelCallsBefore);outcome.healthy_poll_llm_calls=0
if(publicationFailure)assert.ok(existsSync(path.join(output,'prs.json.crash-'+publicationFailure)),'Publication fault was not injected')
if(crashFault)assert.ok(existsSync(path.join(output,'worker-crash-injection.json')),'Worker crash was not injected')
writeFileSync(path.join(output,'outcome.json'),JSON.stringify({passed:true,database,run_id:runId,...outcome},null,2));console.log(JSON.stringify({passed:true,database,run_id:runId,credits:bound,publications:bound}))

}
}finally{if(dispatchIntegration)run('docker',['exec',container,'dropdb','--force','-U','postgres',database])}
