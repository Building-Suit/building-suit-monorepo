import test from 'node:test'
import assert from 'node:assert/strict'
import { validateVerifierOnlyReacceptance } from '../runner/verifier-only-reacceptance.mjs'
import { publicationStateFingerprint } from '../runner/publication-preflight.mjs'
function fixture() {
 const original={base_sha:'base',files:[{file:'apps/shop-suit/supabase/migrations/001.sql',object:'product'},{file:'apps/shop-suit/supabase/tests/shop_billing.sql',object:'old-test'}]}
 const currentState={...original,files:[original.files[0],{...original.files[1],object:'fixed-test'}]}
 const execution={execution_id:267,attempt:5,status:'failed',metadata:{verification_probe_verified_state:original,verification_probe_failures:[{name:'shop-database-regression'},{name:'shop-payment-evidence-http'}]}}
 const probe={ok:true,passed:true,verified_state:{...currentState,fingerprint:publicationStateFingerprint(currentState)},checks:[{name:'shop-database-regression',status:'pass',required:true},{name:'shop-payment-evidence-http',status:'pass',required:true}]}
 return {execution,probe,currentState,verifierPaths:['apps/shop-suit/supabase/tests/shop_billing.sql'],requiredChecks:['shop-database-regression','shop-payment-evidence-http']}
}
test('passing verifier repair preserves failed execution/attempt and complete input history',()=>{const f=fixture(),before=JSON.stringify(f);assert.equal(validateVerifierOnlyReacceptance(f).preserved_attempt,5);assert.equal(JSON.stringify(f),before)})
test('real HTTP upload failure cannot reaccept exhausted attempt',()=>{const f=fixture();f.probe.passed=false;f.probe.checks[1].status='fail';assert.throws(()=>validateVerifierOnlyReacceptance(f),/passing_probe/);f.probe.passed=true;assert.throws(()=>validateVerifierOnlyReacceptance(f),/mandatory_check/);f.probe.checks[1].status='skipped';assert.throws(()=>validateVerifierOnlyReacceptance(f),/mandatory_check/)})
test('omitted original failure, changed product source, changed probe and migration exemptions reject',()=>{
 let f=fixture();f.probe.checks.pop();assert.throws(()=>validateVerifierOnlyReacceptance(f),/required_check_set/)
 f=fixture();f.currentState.files[0]={...f.currentState.files[0],object:'changed'};f.probe.verified_state.fingerprint=publicationStateFingerprint(f.currentState);assert.throws(()=>validateVerifierOnlyReacceptance(f),/product_source_changed/)
 f=fixture();f.probe.verified_state.fingerprint='stale';assert.throws(()=>validateVerifierOnlyReacceptance(f),/probe_source_changed/)
 f=fixture();f.verifierPaths.push('apps/shop-suit/supabase/migrations/001.sql');assert.throws(()=>validateVerifierOnlyReacceptance(f),/verifier_paths_only/)
})