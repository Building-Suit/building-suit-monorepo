import test from 'node:test'
import assert from 'node:assert/strict'
import {semanticRecoveryCause,catalogApplies} from '../runner/recovery-catalog.mjs'
test('same broad family does not match different semantic causes',()=>{
 const one=semanticRecoveryCause('unknown-lifecycle',{recovery:{error_code:'binding_missing'}})
 const two=semanticRecoveryCause('unknown-lifecycle',{recovery:{error_code:'publisher_missing'}})
 assert.notEqual(one.cause_fingerprint,two.cause_fingerprint)
 assert.equal(one.cause_fingerprint,semanticRecoveryCause('unknown-lifecycle',{recovery:{error_code:'binding_missing',updated_at:'later'},claim:99}).cause_fingerprint)
})
test('catalog requires exact cause, protocol/schema, executed regression and live predicates',()=>{
 const entry={root_family:'unknown-lifecycle',cause_fingerprint:'cause',handler_id:'run-recover',handler_version:1,protocol:'cp-batch-v2',schema_min:64,schema_max:64,regression_version:'hash',runtime_release:'release',required_preconditions:['same_subject'],required_evidence:['bound_receipt'],safety_boundary:'existing-bounded-run'}
 const context={root_family:'unknown-lifecycle',cause_fingerprint:'cause',protocol:'cp-batch-v2',schema_version:64,regression_version:'hash',preconditions:{same_subject:true},evidence:{bound_receipt:true}}
 assert.equal(catalogApplies(entry,context),true)
 for(const change of [{cause_fingerprint:'other'},{schema_version:65},{protocol:'legacy'},{regression_version:'stale'},{evidence:{bound_receipt:false}},{preconditions:{same_subject:false}}])assert.equal(catalogApplies(entry,{...context,...change}),false)
 assert.equal(catalogApplies({...entry,required_evidence:[]},context),false)
 assert.equal(catalogApplies(null,context),false)
})
