import test from 'node:test'
import assert from 'node:assert/strict'
import {ordinarySourceReviews,reviewedOrdinarySourcePaths} from '../runner/reviewed-source-artifacts.mjs'
import {unattendedSensitiveFiles} from '../runner/unattended-publication.mjs'
import {supersededPublicationHold} from '../runner/bounded-publication.mjs'

for(const review of ordinarySourceReviews)test(`exact ordinary API content review: ${review.task_id}`,()=>{
 const input={task:{task_id:review.task_id},execution:{execution_id:review.execution_id,parent_sha:review.parent_sha},verification:{status:'passed',execution_id:review.execution_id,verified_state:{files:[{file:review.path,object:review.object}]}},objects:{[review.path]:review.object,[review.witness_path]:review.witness_object}}
 assert.deepEqual(reviewedOrdinarySourcePaths(input),[review.path])
 for(const edit of [{task:{task_id:'OTHER'}},{execution:{...input.execution,execution_id:999}},{execution:{...input.execution,parent_sha:'wrong'}},{verification:{...input.verification,status:'failed'}},{objects:{...input.objects,[review.path]:'changed'}},{objects:{...input.objects,[review.witness_path]:'changed'}}])assert.deepEqual(reviewedOrdinarySourcePaths({...input,...edit}),[])
 assert.deepEqual(unattendedSensitiveFiles([review.path],{reviewedOrdinaryPaths:reviewedOrdinarySourcePaths(input)}),[])
 assert.deepEqual(unattendedSensitiveFiles([review.path]),[review.path])
})

test('an exact reviewed API does not allow service-role Audit POST or unknown auth/API/SQL source',()=>{
 const risky=['apps/super-admin-suit/server/api/activity.post.ts','packages/auth/src/session.ts']
 assert.deepEqual(unattendedSensitiveFiles(risky,{reviewedOrdinaryPaths:[ordinarySourceReviews[1].path]}),risky)
 // SQL publication still needs the separate protected gate; no claim of hosted execution.
 assert.equal(unattendedSensitiveFiles(risky).length,2)
})

const file='apps/shop-suit/supabase/config.toml',task={task_id:'SUPPORT'},execution={execution_id:320}
const verification={status:'passed',execution_id:320,verification_run_id:353,state_fingerprint:'state',verified_state:{files:[{file,object:'a'.repeat(40)}]}}
const grant={authorized:true,task_id:'SUPPORT',execution_id:320,verification_run_id:353,verified_state_fingerprint:'state',protected_files:[{path:file,object:'a'.repeat(40)}]}
test('recovery returns to publisher only when every protected waiting file is actually authorized',()=>{
 const snapshot={packet:{task:{...task,status:'passed'},publication_boundaries:{task_paths:['apps/shop-suit/**'],project_paths:['apps/']}},protected_publication_authority:grant,executions:[execution],verification_runs:[{...verification,metadata:{verified_state:{...verification.verified_state,fingerprint:'state'}}}],recovery:{next_action:'wait-operator',error_code:'publication_protected_path_operator_wait',failure_id:1},failures:[{failure_id:1,execution_id:320,error_code:'publication_protected_path_operator_wait',metadata:{protected_paths:[file]}}],run_publication_authority:{authorized:true,mode:'ordinary-draft',task_id:'SUPPORT',run_id:'run',contract_fingerprint:'contract'}}
 assert.equal(supersededPublicationHold(snapshot),true)
 snapshot.failures[0].metadata.protected_paths.push('apps/shop-suit/supabase/migrations/unapproved.sql')
 assert.equal(supersededPublicationHold(snapshot),false)
})
