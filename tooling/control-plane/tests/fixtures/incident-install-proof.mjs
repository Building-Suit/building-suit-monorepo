import assert from 'node:assert/strict'
import {spawnSync} from 'node:child_process'
import {mkdirSync,writeFileSync,readFileSync,symlinkSync,readlinkSync,existsSync} from 'node:fs'
import path from 'node:path'
import {prepareRuntimeRelease,verifyRuntimeRelease} from '../../runner/runtime-release.mjs'
import {evidenceDigest} from '../../runner/failure-evidence.mjs'

export function incidentInstallProof({source,output,bin,env,sql,agent,runId,task}){
 const root=path.join(output,'incident-repository'),home=path.join(output,'incident-runtime')
 const run=(program,args,options={})=>{const r=spawnSync(program,args,{encoding:'utf8',timeout:360000,maxBuffer:16*1024*1024,...options});assert.equal(r.status,0,r.stderr||r.stdout);return r.stdout.trim()}
 run('git',['clone','--shared','--quiet',source,root])
 run('git',['config','user.name','Disposable incident'],{cwd:root});run('git',['config','user.email','incident@example.invalid'],{cwd:root})
 const repositoryRoot=run('git',['rev-parse','--git-common-dir'],{cwd:source})
 const mainRoot=path.dirname(path.resolve(source,repositoryRoot))
 for(const name of ['node_modules','apps/building-suit-docs/.nuxt'])symlinkSync(path.join(mainRoot,name),path.join(root,name))
 mkdirSync(home,{recursive:true})
 const commit=run('git',['rev-parse','HEAD'],{cwd:source})
 assert.equal(run('git',['status','--porcelain','--','tooling/control-plane'],{cwd:source}),'','Incident proof requires committed source')
 const files=run('git',['ls-files','tooling/control-plane','tooling/git'],{cwd:source}).split('\n')
 const previous=prepareRuntimeRelease({sourceRoot:source,releaseHome:home,commit,files,schemaVersion:97,acceptance:{disposable_source:true},metadata:{protocol:'cp-batch-v2'}})
 symlinkSync(previous.directory,path.join(home,'current'))
 sql("DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='cp_fixture_installer') THEN CREATE ROLE cp_fixture_installer LOGIN;END IF;END $$;GRANT bs_control_release_installer TO cp_fixture_installer;")
 const normal=readFileSync(path.join(bin,'codex'));writeFileSync(path.join(bin,'codex-normal'),normal,{mode:0o700})
 const repairProgram=`#!${process.execPath}\nimport {spawnSync} from 'node:child_process';import {writeFileSync} from 'node:fs';if(!process.cwd().includes('/dot-incident-')){const r=spawnSync(${JSON.stringify(path.join(bin,'codex-normal'))},process.argv.slice(2),{stdio:'inherit'});process.exit(r.status??1)}process.stdin.resume();process.stdin.on('end',()=>{writeFileSync('tooling/control-plane/runner/disposable-incident-repair.mjs','export const repaired=true\\n');writeFileSync('tooling/control-plane/tests/disposable-incident-repair.test.mjs',"import test from 'node:test';import assert from 'node:assert/strict';import {repaired} from '../runner/disposable-incident-repair.mjs';test('disposable missing runtime helper is repaired',()=>assert.equal(repaired,true))\\n");writeFileSync('recovery-plan.json',JSON.stringify({root_family:'unknown-synthetic-repair',regression_test:'tooling/control-plane/tests/disposable-incident-repair.test.mjs',failure_class:'CONFIGURATION',summary:'Install the missing disposable runtime helper with an executable regression'}));console.log(JSON.stringify({type:'turn.completed',usage:{input_tokens:1,output_tokens:1}}))})\n`
 writeFileSync(path.join(bin,'codex'),repairProgram,{mode:0o700})
 const pidFile=path.join(output,'incident-health.pid'),port=18879
 const testEnv={...env,BS_CONTROL_REPOSITORY_ROOT:root,BS_CONTROL_RELEASE_HOME:home,BS_CONTROL_RELEASE_INSTALLER_USER:'cp_fixture_installer',BS_CONTROL_INCIDENT_TEST_CONTAINER:'cp-remediation-disposable-20261007',BS_DOT_HEALTH_PORT:String(port)}
 const bootstrap=path.join(source,'tooling/control-plane/runner/runtime-bootstrap.mjs')
 const serviceProgram=`#!${process.execPath}\nimport {spawn} from 'node:child_process';import {existsSync,readFileSync,writeFileSync} from 'node:fs';if(existsSync(${JSON.stringify(pidFile)})){try{process.kill(Number(readFileSync(${JSON.stringify(pidFile)})),'SIGTERM')}catch{/* Already stopped disposable observer. */}}const child=spawn(${JSON.stringify(process.execPath)},[${JSON.stringify(bootstrap)},'health'],{env:process.env,detached:true,stdio:'ignore'});writeFileSync(${JSON.stringify(pidFile)},String(child.pid));child.unref();setTimeout(()=>process.exit(0),2000);\n`
 writeFileSync(path.join(bin,'systemctl'),serviceProgram,{mode:0o700})
 writeFileSync(path.join(bin,'psql'),'#!/bin/sh\nexec docker exec -i cp-remediation-disposable-20261007 stdbuf -oL psql "$@"\n',{mode:0o700})
 const health={key:'run:'+runId,run_id:runId,task_id:task,state:'STUCK',why:'Disposable runtime helper is missing',observed_at:new Date().toISOString(),operator_action_required:false,worker_alive:false}
 const quote=v=>"'"+String(v).replaceAll("'","''")+"'"
 sql(`SELECT control.record_dot_health(${quote(JSON.stringify([health]))}::jsonb);`)
 const claimed=JSON.parse(sql(`SELECT control.claim_dot_recovery('${runId}','synthetic-repair-install','unknown-synthetic-repair','{"cause_fingerprint":"${evidenceDigest('synthetic-missing-helper')}","semantic":{"fixture":"missing-helper"}}');`))
 assert.equal(claimed.claimed,true);const incident=claimed.job.incident_id
 try{
  run(process.execPath,[path.join(source,'tooling/control-plane/runner/dot-recovery-worker.mjs'),incident,'--locked'],{cwd:root,env:testEnv})
  const pointer=readlinkSync(path.join(home,'current')),release=verifyRuntimeRelease(pointer)
  assert.notEqual(release.release_id,previous.release_id);assert.equal(release.metadata.regression.skipped,0);assert.equal(release.metadata.regression.failed,0)
  assert.equal(Number(sql(`SELECT count(*) FROM control.dot_model_invocations WHERE incident_id='${incident}' AND launched_at IS NOT NULL;`)),1)
  assert.equal(sql(`SELECT status FROM control.dot_recovery_jobs WHERE incident_id='${incident}';`),'resolved')
  assert.equal(Number(sql(`SELECT count(*) FROM control.runtime_activation_events WHERE release_id='${release.release_id}';`)),1)
  assert.equal(Number(sql(`SELECT count(*) FROM control.dot_semantic_recovery_catalog WHERE learned_from='${incident}';`)),1)
  const state=JSON.parse(sql(`SELECT jsonb_build_object('run_id',run_id,'max_tasks',max_tasks,'current_task_id',current_task_id,'status',status) FROM control.workflow_runs WHERE run_id='${runId}';`));assert.equal(state.run_id,runId);assert.equal(state.max_tasks,2);assert.equal(state.status,'running')
  writeFileSync(path.join(output,'unknown-install-proof.json'),JSON.stringify({passed:true,incident_id:incident,actual_model_starts:1,previous:previous.release_id,release:release.release_id,source:release.commit,regression:release.metadata.regression,run:state},null,2))
 }finally{
  writeFileSync(path.join(bin,'codex'),normal,{mode:0o700});if(existsSync(pidFile)){try{process.kill(Number(readFileSync(pidFile)),'SIGTERM')}catch{/* Already stopped disposable observer. */}}
 }
 // The same authorized run's ordinary engine settles any detached operation.
 agent(['run-supervise',runId])
}
