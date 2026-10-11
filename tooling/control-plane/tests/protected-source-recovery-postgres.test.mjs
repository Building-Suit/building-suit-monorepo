import test from 'node:test'
import assert from 'node:assert/strict'
import {spawnSync} from 'node:child_process'
import {durableProtectedApprovalSql} from '../runner/durable-protected-approval.mjs'

test('durable protected receipt survives scheduling only; exact authority changes deny', {skip:!process.env.CP_EGRESS_TEST_CONTAINER},()=>{
 const container=process.env.CP_EGRESS_TEST_CONTAINER
 assert.match(container,/^cp-.*disposable[-a-z0-9]*$/)
 const database='cp_protected_receipt_'+process.pid+'_'+Date.now()
 const run=(args,input)=>spawnSync('docker',['exec','-i',container,...args],{input,encoding:'utf8',timeout:60000})
 const query=sql=>{const result=run(['psql','-U','postgres','-d',database,'-XqAt','-v','ON_ERROR_STOP=1'],sql);assert.equal(result.status,0,result.stderr);return result.stdout.trim()}
 assert.equal(run(['createdb','-U','postgres',database]).status,0)
 try {
 query(`CREATE SCHEMA control;
 CREATE TABLE control.tasks(task_id text,project_id text,workstream_slug text,status text,metadata jsonb,acceptance_criteria jsonb,title text,description text,verification_plan jsonb);
 CREATE TABLE control.publication_readiness_contracts(task_id text,contract_fingerprint text,input_generation bigint,valid boolean);
 CREATE TABLE control.task_admission_generations(task_id text,input_generation bigint);
 CREATE TABLE control.projects(project_id text,verification_config jsonb);
 CREATE TABLE control.workstreams(project_id text,slug text,verification_config jsonb);
 CREATE TABLE control.task_requirements(task_id text,requirement_id text);
 CREATE TABLE control.task_decisions(task_id text,decision_id text);
 CREATE TABLE control.executions(task_id text,execution_id bigint,attempt int,status text);
 CREATE TABLE control.verification_runs(execution_id bigint,verification_run_id bigint,status text,metadata jsonb);
 CREATE TABLE control.operator_authority_events(event_id bigint,task_id text,run_id text,actor_id text,action text,response text,offer jsonb,gate_fingerprint text);
 CREATE TABLE control.operator_actors(actor_id text,enabled boolean);
 CREATE TABLE control.workflow_runs(run_id text,current_task_id text,status text,stop_requested boolean,maintenance_requested boolean,completed_tasks int,max_tasks int,run_revision int);
 CREATE TABLE control.frozen_queue(current boolean);
 CREATE FUNCTION control.unattended_queue_task_current(text,text) RETURNS boolean LANGUAGE sql AS 'SELECT current FROM control.frozen_queue';
 INSERT INTO control.tasks VALUES('T','P','W','passed','{"allowed_paths":["apps/p/**"]}','[]','Task','Source','[]');
 INSERT INTO control.publication_readiness_contracts VALUES('T','contract',13,true);
 INSERT INTO control.task_admission_generations VALUES('T',13);
 INSERT INTO control.projects VALUES('P','{}');INSERT INTO control.workstreams VALUES('P','W','{}');
 INSERT INTO control.executions VALUES('T',320,1,'succeeded');
 INSERT INTO control.verification_runs VALUES(320,353,'passed','{"verified_state":{"fingerprint":"state","files":[{"file":"apps/p/supabase/migrations/exact.sql","object":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}]}}');
 INSERT INTO control.operator_actors VALUES('owner',true);
 INSERT INTO control.workflow_runs VALUES('run','T','running',false,false,5,14,13);
 INSERT INTO control.frozen_queue VALUES(true);
 INSERT INTO control.operator_authority_events SELECT 15,'T','run','owner','protected-publication','approve',
 jsonb_build_object('max_tasks',14,'contract_fingerprint','contract','input_generation',13,'execution_id',320,'verification_run_id',353,'verified_state_fingerprint','state',
 'verification_fingerprint',md5(jsonb_build_object('task_id','T','verification_plan','[]'::jsonb,'project_verification_config','{}'::jsonb,'workstream_verification_config','{}'::jsonb)::text),
 'scope_fingerprint',md5(jsonb_build_object('allowed_paths','["apps/p/**"]'::jsonb,'acceptance','[]'::jsonb,'title','Task','description','Source','requirements',null,'decisions',null)::text),
 'protected_files','[{"path":"apps/p/supabase/migrations/exact.sql","object":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}]'::jsonb),'gate';
 GRANT USAGE ON SCHEMA control TO bs_runtime_executor;
 GRANT SELECT ON ALL TABLES IN SCHEMA control TO bs_runtime_executor;
 GRANT EXECUTE ON FUNCTION control.unattended_queue_task_current(text,text) TO bs_runtime_executor;`)
 const receipt=()=>JSON.parse(query(`SET ROLE bs_runtime_executor;${durableProtectedApprovalSql.replaceAll(":'task_id'", "'T'")}RESET ROLE;`))
 assert.equal(receipt().authorized,true)
 query('UPDATE control.workflow_runs SET run_revision=14');assert.equal(receipt().authorized,true)
 query("UPDATE control.workflow_runs SET current_task_id=null;UPDATE control.tasks SET status='blocked'")
 assert.equal(receipt().subject_current,true);assert.equal(receipt().authorized,false)
 query("UPDATE control.workflow_runs SET current_task_id='T';UPDATE control.tasks SET status='passed'")
 for(const mutation of ["UPDATE control.operator_actors SET enabled=false","UPDATE control.frozen_queue SET current=false","UPDATE control.publication_readiness_contracts SET contract_fingerprint='changed'","UPDATE control.task_admission_generations SET input_generation=14","UPDATE control.tasks SET title='changed'","UPDATE control.workstreams SET verification_config='{\"changed\":true}'","UPDATE control.executions SET execution_id=321","UPDATE control.verification_runs SET verification_run_id=354","UPDATE control.verification_runs SET status='failed'","UPDATE control.verification_runs SET metadata=jsonb_set(metadata,'{verified_state,fingerprint}','\"changed\"')","UPDATE control.verification_runs SET metadata=jsonb_set(metadata,'{verified_state,files,0,object}','\"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb\"')","UPDATE control.workflow_runs SET stop_requested=true","UPDATE control.workflow_runs SET max_tasks=15","INSERT INTO control.operator_authority_events SELECT 16,task_id,run_id,actor_id,action,'revoke',offer,gate_fingerprint FROM control.operator_authority_events WHERE event_id=15"]){
  const actual=JSON.parse(query(`BEGIN;${mutation};SET ROLE bs_runtime_executor;${durableProtectedApprovalSql.replaceAll(":'task_id'", "'T'")}RESET ROLE;ROLLBACK;`))
  assert.notEqual(actual.authorized,true,mutation)
 }
 assert.equal(receipt().authorized,true)
 } finally { assert.equal(run(['dropdb','--force','-U','postgres',database]).status,0) }
})
