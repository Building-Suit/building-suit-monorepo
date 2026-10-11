import test from 'node:test'
import assert from 'node:assert/strict'
import {migrationSourceRecord,compareMigrationLedger,cloudSynchronizationManifest} from '../runner/control-release-provenance.mjs'
const args={filename:'067_control_release_provenance.sql',bytes:Buffer.from('SELECT 1;'),commit:'a'.repeat(40),projectRef:'b'.repeat(20)}
test('control migration ledger binds exact bytes, commit and immutable project',()=>{
 const source=migrationSourceRecord(args);assert.equal(compareMigrationLedger([source],[source]).verified,true)
 const changed=migrationSourceRecord({...args,bytes:Buffer.from('SELECT 2;')});assert.deepEqual(compareMigrationLedger([changed],[source]).mismatched,[args.filename])
 assert.equal(compareMigrationLedger([source],[]).verified,false)
 assert.throws(()=>migrationSourceRecord({...args,filename:'20261007_product.sql'}),/control_migration/)
 assert.throws(()=>migrationSourceRecord({...args,evidenceKind:'baseline_snapshot'}),/attestation/)
})
test('portable manifest preserves unproven cloud state and cannot authorize product effects',()=>{
 const source=migrationSourceRecord(args),manifest=cloudSynchronizationManifest({release:{release_id:'c'.repeat(64),commit:args.commit},ledger:[source],sourceMigrations:[source],schemaFingerprint:'schema',workflows:[{id:'BS22',active:true,normalized_graph:{nodes:[]}}],components:{adapter:'sha'},environment:{control_project_ref:args.projectRef,environment:'control-production'}})
 assert.equal(manifest.cloud_parity,'UNPROVEN');assert.equal(manifest.cloud_modified,false);assert.equal(manifest.authorization.hosted_product_migrations,false)
 assert.equal(manifest.workflows[0].normalized_hash.length,64)
})
