#!/usr/bin/env node
import assert from 'node:assert/strict'
import {spawnSync} from 'node:child_process'
import {writeFileSync} from 'node:fs'
const database=process.argv[2],output=process.argv[3]
if(!/^cp_[a-z0-9_]+$/.test(database??'')||!output?.startsWith('/'))throw Error('explicit_disposable_database_and_evidence_required')
function query(user,sql,expectedSuccess=true){const r=spawnSync('docker',['exec','-i','cp-remediation-disposable-20261007','psql','-h','localhost','-U',user,'-d',database,'-XqAt','-v','ON_ERROR_STOP=1'],{input:sql,encoding:'utf8'});assert.equal(r.status===0,expectedSuccess,r.stderr);return r.stdout.trim()}
query('postgres',"DO $$ BEGIN FOR i IN 1..3 LOOP IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='cp_login_proof_'||i) THEN EXECUTE format('CREATE ROLE cp_login_proof_%s LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS',i);END IF;END LOOP;END $$;GRANT bs_control_observer TO cp_login_proof_1;GRANT bs_control_executor TO cp_login_proof_2;GRANT bs_control_operator TO cp_login_proof_3;")
const checks=[]
for(const [user,capability] of [['cp_login_proof_1','observer'],['cp_login_proof_2','executor'],['cp_login_proof_3','operator'],['cp_fixture_verifier','verifier']]){
 assert.equal(query(user,'SELECT current_user'),user)
 assert.equal(query(user,"SELECT pg_has_role(current_user,'bs_control_migration_owner','MEMBER')"),'f')
 for(const table of ['task_events','executions','workflow_run_task_credits','decisions','tasks','publication_preexecution_authorizations','run_ordinary_publication_authorizations','run_task_publication_authorities','publication_scope_authorizations','operator_authority_events','dot_recovery_jobs','migration_release_ledger']){
  assert.equal(query(user,`SELECT has_table_privilege(current_user,'control.${table}','INSERT,UPDATE,DELETE')`),'f')
  query(user,`DELETE FROM control.${table} WHERE false`,false)
 }
 query(user,'CREATE TABLE control.forbidden_capability_probe(id integer)',false)
 checks.push({user,capability,separate_login:true,no_migration_owner:true,no_direct_history_authority_mutation:true})
}
assert.equal(query('cp_login_proof_1','SELECT count(*)>=0 FROM control.workflow_runs'),'t')
query('cp_login_proof_1',"SELECT control.record_dot_cycle('[]')",false)
query('cp_login_proof_2',"SELECT control.resolve_authenticated_operator_gate('a0000000-0000-4000-8000-000000000099','a0000000-0000-4000-8000-000000000098','fake','approve')",false)
query('cp_login_proof_2',"SELECT control.record_workflow_task_success('fake')",false)
query('cp_fixture_verifier',"SELECT control.claim_next_task('fake')",false)
const proof={passed:true,database,checks,executor_cannot_operator:true,executor_cannot_anonymous_credit:true,observer_cannot_lifecycle:true,verifier_cannot_claim:true}
writeFileSync(output,JSON.stringify(proof,null,2));console.log(JSON.stringify(proof))
