import {createHash} from 'node:crypto'
const digest=value=>createHash('sha256').update(Buffer.isBuffer(value)||typeof value==='string'?value:JSON.stringify(value)).digest('hex')
export function migrationSourceRecord({filename,bytes,commit,projectRef,evidenceKind='applied_transaction',evidence={}}) {
 if(!/^[0-9]{3}_[a-z0-9_]+\.sql$/.test(filename)||!Buffer.isBuffer(bytes)||!/^[a-f0-9]{40}$/.test(commit)||!/^[a-z]{20}$/.test(projectRef))throw Error('immutable_control_migration_provenance_required')
 if(!['applied_transaction','baseline_snapshot'].includes(evidenceKind))throw Error('migration_evidence_kind_required')
 if(evidenceKind==='baseline_snapshot'&&!evidence.schema_fingerprint)throw Error('baseline_schema_attestation_required')
 return {migration_name:filename,source_sha256:digest(bytes),source_commit:commit,project_ref:projectRef,evidence_kind:evidenceKind,evidence}
}
export function compareMigrationLedger(source,ledger) {
 const recorded=new Map(ledger.map(row=>[row.migration_name,row]))
 const mismatched=source.filter(row=>recorded.has(row.migration_name)&&recorded.get(row.migration_name).source_sha256!==row.source_sha256).map(row=>row.migration_name)
 const missing=source.filter(row=>!recorded.has(row.migration_name)).map(row=>row.migration_name)
 const baseline=ledger.filter(row=>row.evidence_kind==='baseline_snapshot').map(row=>row.migration_name)
 return {verified:mismatched.length===0&&missing.length===0,mismatched,missing,baseline_attestations:baseline}
}
export function cloudSynchronizationManifest({release,ledger,sourceMigrations,schemaFingerprint,workflows,components,environment}) {
 const parity=compareMigrationLedger(sourceMigrations,ledger)
 if(!release?.release_id||!schemaFingerprint||!Array.isArray(workflows)||!components||!environment?.control_project_ref)throw Error('portable_release_provenance_required')
 return {version:1,local_release_id:release.release_id,source_commit:release.commit,
 schema_fingerprint:schemaFingerprint,migration_ledger:ledger,migration_parity:parity,
 workflows:workflows.map(w=>({id:w.id,active:w.active===true,normalized_hash:digest(w.normalized_graph)})),
 component_hashes:components,required_roles:['runtime','trusted-verifier','operator','release-installer'],
 control_environment:{project_ref:environment.control_project_ref,environment:environment.environment},
 authorization:{product_merge:false,product_deploy:false,hosted_product_migrations:false,cloud_cutover:false},
 cloud_parity:'UNPROVEN',cloud_modified:false}
}
