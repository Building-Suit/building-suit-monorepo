import test from 'node:test'
import assert from 'node:assert/strict'
import {spawnSync} from 'node:child_process'
import {readFileSync,readdirSync} from 'node:fs'
import {createHash} from 'node:crypto'
import {fileURLToPath} from 'node:url'
import path from 'node:path'
import {exactMigrationTransaction,fingerprintSchema,schemaFingerprintSql} from '../runner/schema-provenance.mjs'

test('105 -> 108 is independent, checksum-bound, owner-installable, append-only and replay-safe',{skip:process.env.CP_BATCH_READY_TEST_REQUIRE_POSTGRES!=='1'&&!process.env.CP_EGRESS_TEST_CONTAINER,timeout:180000},t=>{
 const container=process.env.CP_EGRESS_TEST_CONTAINER;assert.match(container??'',/^cp-.*disposable[-a-z0-9]*$/)
 const database='cp_task_scope_'+process.pid+'_'+Date.now(),root=fileURLToPath(new URL('../../../',import.meta.url)),directory=path.join(root,'tooling/control-plane/sql')
 const run=(args,input)=>spawnSync('docker',['exec','-i',container,...args],{input,encoding:'utf8',timeout:120000,maxBuffer:16*1024*1024})
 const query=sql=>{const r=run(['psql','-U','postgres','-d',database,'-XqAt','-v','ON_ERROR_STOP=1'],sql);assert.equal(r.status,0,r.stderr);return r.stdout.trim()}
 assert.equal(run(['createdb','-U','postgres',database]).status,0)
 try{
  const baseline=readdirSync(directory).filter(n=>/^\d{3}_.+\.sql$/.test(n)&&Number(n.slice(0,3))<=105).sort();assert.equal(baseline.at(-1),'105_recovery_progress_guards.sql');assert.equal(baseline.some(n=>n.startsWith('104_')),false)
  for(const file of baseline)query(readFileSync(path.join(directory,file),'utf8'))
  const snapshot=()=>JSON.parse(query(schemaFingerprintSql)),beforeSchema=snapshot(),beforeFingerprint=fingerprintSchema(beforeSchema)
  const history=()=>query("SELECT jsonb_build_object('runs',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY run_id),'[]') FROM control.workflow_runs x),'tasks',(SELECT jsonb_agg(to_jsonb(x) ORDER BY task_id) FROM control.tasks x),'executions',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY execution_id),'[]') FROM control.executions x),'grants',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY run_id),'[]') FROM control.run_ordinary_publication_authorizations x),'credits',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY run_id,task_id),'[]') FROM control.workflow_run_task_credits x))")
  const beforeHistory=history(),baselineId='a0000000-0000-4000-8000-000000000108',projectRef='a'.repeat(20),sourceCommit='590ccbf3941fb358c915a0981430d9612c7918ca'
  query(`INSERT INTO control.control_schema_adoption_baselines(baseline_id,project_ref,source_sha,canonical_migrations,canonical_schema_fingerprint,live_schema_fingerprint,active_release_id,note) VALUES('${baselineId}','${projectRef}','${sourceCommit}','[]','${beforeFingerprint}','${beforeFingerprint}','${'a'.repeat(64)}','Schema adoption snapshot; pre-ledger historical application order is not asserted.')`)
  const migrationName='108_task_shared_package_authority.sql',sql=readFileSync(path.join(directory,migrationName),'utf8'),checksum=createHash('sha256').update(sql).digest('hex')
  const transaction=exactMigrationTransaction({migrationName,sql,expectedChecksum:checksum,sourceCommit,projectRef,baselineId})
  query(transaction);assert.equal(history(),beforeHistory);assert.notEqual(fingerprintSchema(snapshot()),beforeFingerprint)
  const row=JSON.parse(query(`SELECT to_jsonb(x) FROM control.migration_release_ledger x WHERE migration_name='${migrationName}'`));assert.equal(row.source_sha256,checksum);assert.equal(row.evidence.serialized,true)
  assert.equal(query("SELECT count(*) FROM control.migration_release_ledger WHERE migration_name ~ '^(104|106|107)_'"),'0')
  assert.equal(query("SELECT has_function_privilege('bs_runtime_executor','control.resolve_authenticated_operator_gate(uuid,uuid,text,text)','EXECUTE')"),'f')
  assert.equal(query("SELECT has_function_privilege('bs_control_operator','control.resolve_authenticated_operator_gate(uuid,uuid,text,text)','EXECUTE')"),'t')
  for(const role of ['bs_runtime_executor','bs_control_operator','bs_control_observer','bs_control_verifier'])assert.equal(query(`SELECT has_function_privilege('${role}','control.resolve_authenticated_operator_gate_before_task_shared_scope(uuid,uuid,text,text)','EXECUTE')`),'f')
  assert.equal(query("SELECT has_table_privilege('bs_control_operator','control.task_shared_package_authorizations','INSERT,UPDATE,DELETE')"),'f')
  assert.equal(query("SELECT pg_get_userbyid(relowner)||':'||relrowsecurity::text FROM pg_class WHERE oid='control.task_shared_package_authorizations'::regclass"),'bs_control_migration_owner:true')
  const replay=run(['psql','-U','postgres','-d',database,'-XqAt','-v','ON_ERROR_STOP=1'],transaction);assert.notEqual(replay.status,0);assert.match(replay.stderr,/migration_already_recorded_requires_checksum_reconciliation/);assert.equal(history(),beforeHistory)
  t.diagnostic(JSON.stringify({baseline:105,candidate:108,excluded:[104,106,107],checksum,history_unchanged:true,least_privilege:true,guarded_replay_rejected:true}))
 }finally{assert.equal(run(['dropdb','--force','-U','postgres',database]).status,0)}
})
