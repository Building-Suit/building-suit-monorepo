import test from 'node:test'
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {fileURLToPath} from 'node:url'
import {adoptControlSchema,adoptionHistorySql} from '../runner/control-adoption.mjs'
import {migrationChecksums,schemaFingerprintSql} from '../runner/schema-provenance.mjs'
const sourceRoot=fileURLToPath(new URL('../../../',import.meta.url))
function fixture({drift=false,historyChanged=false}={}){
 const sourceCommit='a'.repeat(40),canonicalSnapshot=[{identity:'schema:control',definition:{owner:'bs_control_migration_owner'}}],events=[]
 const releaseManifest={commit:sourceCommit,schema_version:91,files:Object.fromEntries(migrationChecksums(sourceRoot).map(x=>['tooling/control-plane/sql/'+x.file,x.sha256])),acceptance:{tested:true}}
 releaseManifest.release_id=createHash('sha256').update(JSON.stringify(releaseManifest)).digest('hex')
 let historyReads=0
 const transaction=async operation=>{
  events.push('begin')
  try{const result=await operation(async sql=>{
   events.push(sql)
   if(sql===adoptionHistorySql)return {executions:{count:++historyReads===2&&historyChanged?2:1,digest:'same'}}
   if(sql===schemaFingerprintSql)return drift?[...canonicalSnapshot,{identity:'function:unexpected()',definition:'unsafe'}]:canonicalSnapshot
   if(sql.includes('RETURNING to_jsonb(control_schema_adoption_baselines)'))return {baseline_id:'00000000-0000-4000-8000-000000000001'}
   return null
  });events.push('commit');return result}catch(error){events.push('rollback');throw error}
 }
 return {args:{sourceRoot,sourceCommit,projectRef:'a'.repeat(20),releaseManifest,canonicalSnapshot,transaction},events}
}
test('adoption rejects substituted migration bytes before beginning the privileged transaction',async()=>{
 const f=fixture();f.args.releaseManifest.files['tooling/control-plane/sql/060_trusted_verifier_receipts.sql']='b'.repeat(64)
 await assert.rejects(adoptControlSchema(f.args),/release_bound_canonical_migration_bytes_required/);assert.deepEqual(f.events,[])
})
test('schema or preserved business-history drift rolls back the entire adoption',async()=>{
 for(const options of [{drift:true},{historyChanged:true}]){
  const f=fixture(options);await assert.rejects(adoptControlSchema(f.args),options.drift?/schema_reconciliation_required/:/changed_business_history/)
  assert.equal(f.events.at(-1),'rollback');assert.equal(f.events.includes('commit'),false)
  assert.equal(f.events.some(x=>x.startsWith('INSERT INTO control.migration_release_ledger')),false)
 }
})
test('successful adoption records historical snapshots separately from newly executed migrations',async()=>{
 const f=fixture(),proof=await adoptControlSchema(f.args),ledger=f.events.filter(x=>x.startsWith('INSERT INTO control.migration_release_ledger'))
 assert.equal(proof.historical_rows_preserved,true);assert.equal(f.events.at(-1),'commit');assert.equal(ledger.length,91)
 assert.equal(ledger.filter(x=>x.includes("'baseline_snapshot'")).length,59)
 assert.equal(ledger.filter(x=>x.includes("'applied_transaction'")).length,32)
 assert.ok(ledger.every(x=>x.includes('"pre_ledger_application_order_asserted":false')))
})
