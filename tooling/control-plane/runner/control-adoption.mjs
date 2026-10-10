import {readFileSync} from 'node:fs'
import path from 'node:path'
import {createHash} from 'node:crypto'
import {migrationChecksums, schemaFingerprintSql, fingerprintSchema, compareSchemaSnapshots, exactMigrationTransaction} from './schema-provenance.mjs'

const historicalTables=['workflow_runs','tasks','executions','task_events','workflow_run_task_credits','dot_recovery_jobs']
export const adoptionHistorySql=`SELECT jsonb_object_agg(name,value) FROM (${historicalTables.map(name=>`SELECT '${name}' name,jsonb_build_object('count',count(*),'digest',md5(coalesce(string_agg(to_jsonb(t)::text,E'\\n' ORDER BY to_jsonb(t)::text),''))) value FROM control.${name} t`).join(' UNION ALL ')}) history;`

// The caller supplies one privileged, environment-bound transaction. Nothing
// escapes the transaction until both schema and preserved history are checked.
export async function adoptControlSchema({transaction,sourceRoot,sourceCommit,projectRef,releaseManifest,canonicalSnapshot,preLedgerLastVersion=59}) {
 if(typeof transaction!=='function'||!/^[a-f0-9]{40}$/.test(sourceCommit)||!/^[a-z]{20}$/.test(projectRef)||releaseManifest.commit!==sourceCommit||!/^[a-f0-9]{64}$/.test(releaseManifest.release_id)||releaseManifest.schema_version!==91)throw Error('exact_control_adoption_identity_required')
 const migrations=migrationChecksums(sourceRoot).filter(item=>item.version<=91),canonicalFingerprint=fingerprintSchema(canonicalSnapshot)
 if(migrations.length!==91||migrations.some((item,index)=>item.version!==index+1))throw Error('complete_canonical_migration_set_required')
 const {release_id,...manifestBody}=releaseManifest
 if(createHash('sha256').update(JSON.stringify(manifestBody)).digest('hex')!==release_id||migrations.some(item=>releaseManifest.files?.['tooling/control-plane/sql/'+item.file]!==item.sha256))throw Error('release_bound_canonical_migration_bytes_required')
 return transaction(async query=>{
  await query("SELECT pg_advisory_xact_lock(hashtextextended('control-schema-migration',0));SET LOCAL lock_timeout='10s';SET LOCAL statement_timeout='120s';")
  const before=await query(adoptionHistorySql)
  for(const item of migrations.filter(item=>item.version>preLedgerLastVersion)){
   const sql=readFileSync(path.join(sourceRoot,'tooling/control-plane/sql',item.file),'utf8')
   // Reuse the exact-migration parser without executing its post-baseline wrapper.
   exactMigrationTransaction({migrationName:item.file,sql,expectedChecksum:item.sha256,sourceCommit,projectRef,baselineId:'00000000-0000-4000-8000-000000000001'})
   await query(sql.trim().replace(/^BEGIN;\s*/i,'').replace(/\s*COMMIT;$/i,''))
  }
  const snapshot=await query(schemaFingerprintSql)
  const differences=compareSchemaSnapshots(canonicalSnapshot,snapshot)
  if(differences.length){const error=Error('live_canonical_schema_reconciliation_required');error.differences=differences;throw error}
  const after=await query(adoptionHistorySql)
  if(JSON.stringify(before)!==JSON.stringify(after))throw Error('control_adoption_changed_business_history')
  const literal=value=>"'"+String(value).replaceAll("'","''")+"'"
  const json=value=>literal(JSON.stringify(value))+'::jsonb'
  await query(`SELECT control.register_verified_runtime_release(${json(releaseManifest)},${literal(canonicalFingerprint)});`)
  const baseline=await query(`INSERT INTO control.control_schema_adoption_baselines(project_ref,source_sha,canonical_migrations,canonical_schema_fingerprint,live_schema_fingerprint,active_release_id,note) VALUES(${literal(projectRef)},${literal(sourceCommit)},${json(migrations)},${literal(canonicalFingerprint)},${literal(canonicalFingerprint)},${literal(releaseManifest.release_id)},'Schema adoption snapshot; pre-ledger historical application order is not asserted.') RETURNING to_jsonb(control_schema_adoption_baselines);`)
  for(const item of migrations)await query(`INSERT INTO control.migration_release_ledger(migration_name,source_sha256,source_commit,project_ref,evidence_kind,evidence) VALUES(${literal(item.file)},${literal(item.sha256)},${literal(sourceCommit)},${literal(projectRef)},${literal(item.version<=preLedgerLastVersion?'baseline_snapshot':'applied_transaction')},${json({baseline_id:baseline.baseline_id,serialized:true,pre_ledger_application_order_asserted:false,executed_in_adoption_transaction:item.version>preLedgerLastVersion})});`)
  return {baseline_id:baseline.baseline_id,schema_fingerprint:canonicalFingerprint,migrations:migrations.length,historical_rows_preserved:true,release_id:releaseManifest.release_id}
 })
}
