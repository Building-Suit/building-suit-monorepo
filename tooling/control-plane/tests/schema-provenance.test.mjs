import test from 'node:test'
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {exactMigrationTransaction,compareSchemaSnapshots,fingerprintSchema} from '../runner/schema-provenance.mjs'
test('future migration is one serialized checksum-bound transaction after a real adoption baseline',()=>{
 const sql='BEGIN;\nCREATE TABLE control.synthetic_fixture(id integer);\nCOMMIT;'
 const args={migrationName:'081_synthetic_fixture.sql',sql,expectedChecksum:createHash('sha256').update(sql).digest('hex'),sourceCommit:'a'.repeat(40),projectRef:'a'.repeat(20),baselineId:'a0000000-0000-4000-8000-000000000001'}
 const transaction=exactMigrationTransaction(args)
 assert.equal((transaction.match(/^BEGIN;/gm)??[]).length,1)
 assert.equal((transaction.match(/^COMMIT;/gm)??[]).length,1)
 assert.ok(transaction.indexOf('CREATE TABLE')<transaction.indexOf('INSERT INTO control.migration_release_ledger'))
 assert.match(transaction,/pg_advisory_xact_lock/)
 assert.match(transaction,/verified_control_adoption_baseline_required/)
 assert.throws(()=>exactMigrationTransaction({...args,sql:sql+'\n-- substituted bytes'}),/exact_environment_bound/)
 assert.throws(()=>exactMigrationTransaction({...args,projectRef:'production'}),/exact_environment_bound/)
})
test('schema attestation distinguishes definition and grant drift without asserting history',()=>{
 const canonical=[{identity:'function:control.fixture()',definition:{owner:'migration',acl:'executor=EXECUTE',sql:'SELECT 1'}}]
 const changed=[{identity:'function:control.fixture()',definition:{owner:'migration',acl:'PUBLIC=EXECUTE',sql:'SELECT 1'}}]
 assert.notEqual(fingerprintSchema(canonical),fingerprintSchema(changed))
 assert.equal(compareSchemaSnapshots(canonical,changed).length,1)
 assert.deepEqual(compareSchemaSnapshots(canonical,canonical),[])
})
test('ACL attestation ignores grant ordering and redundant owner rights but preserves grant options',()=>{
 const snapshot=acl=>[{identity:'relation:fixture',definition:{owner:'migration',acl}}]
 assert.equal(fingerprintSchema(snapshot('{migration=arwdDxt/migration,observer=r/migration,executor=rw/migration}')),fingerprintSchema(snapshot('{executor=wr/migration,migration=arwdDxtm/migration,observer=r/migration}')))
 assert.notEqual(fingerprintSchema(snapshot('{executor=r*w/migration}')),fingerprintSchema(snapshot('{executor=rw*/migration}')))
 assert.notEqual(fingerprintSchema([{identity:'function:control.fixture()',definition:{owner:'migration',acl:''}}]),fingerprintSchema([{identity:'function:control.fixture()',definition:{owner:'migration',acl:'{migration=X/migration}'}}]))
})
