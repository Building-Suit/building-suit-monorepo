/** Generated synthetic PostgreSQL + actual worker/CLI contract. No hosted calls. */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { failedToolEvidence, checkRepositoryContract } from './worker.mjs'
import { REQUIRED_RPCS } from './maintenance.mjs'
import {  } from './departmentWorkflow.mjs'

import { root, founder, worker, sourcePreset, ciPreset, sourceSha, hash, preparedWorker, historicalWorker, checkRepositoryWorkerCompatibility, scalar, delivery, entryFor, output, repositoryItem, finishReviews, repositoryFixture, freeze, repositoryWork, ordinaryWork, rejects, transaction, count, trialReviewPlanCacheMigration, compatibilityMigration, compatibilityProposal, historicalWorkerDigest, compatibleWorkerDigest, setFutureWorker } from './public-repository-db-fixture.mjs'
let futureWorker

test('repository read capability is founder-frozen, lease-bound, independently reviewed and durable without upgrading ordinary qualification',async t=>{
 futureWorker=await preparedWorker();setFutureWorker(futureWorker)
 const oldWorker=await historicalWorker(),f=await repositoryFixture(),{h,claim}=f
 try{
  await t.test('old contract remains exact; repository API is separate and authority starts absent',async()=>{
   await h.as('worker');const status=await h.rpc('hq_worker_release_status',[worker])
   assert.deepEqual(status.api.rpcs,REQUIRED_RPCS)
   assert.deepEqual(status.researchApi.rpcs,{hq_worker_research_claim:['p_worker_id','p_lease_seconds','p_meeting_protocol']})
   assert.deepEqual(status.roleApi.rpcs,{hq_worker_role_claim:['p_worker_id','p_lease_seconds','p_meeting_protocol']})
   assert.equal(checkRepositoryContract(status),true)
   assert.equal((await scalar(h,"select has_function_privilege('authenticated','hq_private.guard_repository_claim()','EXECUTE') allowed")).allowed,false)
   for(const table of ['repository_bundles','repository_reservations','repository_receipts','repository_qualifications'])assert.equal(await count(h,table),0)
   await h.as('worker');await assert.rejects(()=>h.rpc('hq_freeze_repository_bundle',['AG-DEV-002',sourcePreset,'snapshot',sourceSha,null,null,randomUUID()]),/HQ_FOUNDER_REQUIRED/)
  })
  let mazen
  await t.test('actual MCP bundle and current model/module proof reaches Adam and Iris before separate repository approval',async()=>{
   const key=randomUUID(),frozen=await freeze(h,'AG-DEV-002',sourcePreset,sourceSha,null,key)
   assert.equal((await freeze(h,'AG-DEV-002',sourcePreset,sourceSha,null,key)).bundleId,frozen.bundleId)
   await assert.rejects(()=>freeze(h,'AG-DEV-002',sourcePreset,'b'.repeat(40),null,key),/HQ_REPOSITORY_REQUEST_CONFLICT/)
   const{trial,j}=await repositoryWork(f,'AG-DEV-002',frozen.bundleId),wire=repositoryItem(j)
   assert.equal(await count(h,'repository_reservations'),1)
   assert.equal((await scalar(h,'select sum(charged_attempts)::int n from hq_private.repository_reservations')).n,12)
   const newOutput=await output(j,{repository:true,events:[wire.event]})
   assert.equal(newOutput.modelBindingEvidence.workerSourceDigest,compatibleWorkerDigest)
   await transaction(h,()=>rejects(h,async()=>{await h.as('worker');return h.rpc('hq_worker_finish_v4',[j.id,j.lease_token,worker,newOutput.reply,null,JSON.stringify(newOutput.evidence),null,JSON.stringify(newOutput.modelBindingEvidence)])},/HQ_REPOSITORY_HOST_INVALID/))
   const out=await output(j,{repository:true,events:[wire.event],invoke:oldWorker.invoke}),entry=entryFor(j,out)
   assert.equal(out.modelBindingEvidence.workerSourceDigest,historicalWorkerDigest)
   assert.equal(out.evidence[0].bundleText,JSON.stringify(wire.bundle));assert.equal(out.evidence[0].bundleSha256,hash(out.evidence[0].bundleText))
   const delivered=await delivery(h,entry)
   assert.equal(delivered.repositoryReceiptAccepted,true);assert.equal(delivered.publicDiscoveryReceiptAccepted,true);assert.equal(delivered.trialReceiptAccepted,true)
   assert.deepEqual(await delivery(h,entry),delivered,'exact lost-response replay returns the cached result')
   await assert.rejects(()=>delivery(h,{...entry,reply:entry.reply+' changed'}),/HQ_REPOSITORY_/)
   await h.as('founder');await assert.rejects(()=>h.rpc('hq_issue_repository_qualification',[trial.trialId]),/HQ_REPOSITORY_/)
   const artifact=await finishReviews(h,claim)
   await h.as('founder');const qualified=await h.rpc('hq_issue_repository_qualification',[trial.trialId]);assert.equal(qualified.accepted,true)
   assert.equal((await h.rpc('hq_issue_repository_qualification',[trial.trialId])).receiptId,qualified.receiptId)
   await h.db.exec('reset role')
   assert.deepEqual((await h.db.query('select receipt_id,binding_digest,host_execution_id from hq_private.workforce_qualification_receipts order by receipt_id')).rows,f.ordinary)
   mazen={trial,artifact,bundleId:frozen.bundleId,entry,result:delivered}
  })
  if(!mazen)return // Later scenarios require the genuinely reviewed first artifact.
  await t.test('forward worker compatibility preserves historical evidence, qualifications, readiness and private API boundaries',async()=>{
   const history=async()=>{
    await h.db.exec('reset role')
    const result={}
    for(const table of ['repository_bundles','repository_reservations','repository_receipts','repository_host_executions','repository_qualifications','workforce_qualification_receipts'])result[table]=(await h.db.query(`select to_jsonb(x) data from hq_private.${table} x order by to_jsonb(x)::text`)).rows
    return result
   }
   const readiness=()=>scalar(h,'select hq_private.repository_source_valid($1,$2) source,hq_private.repository_review_ready($3) review,hq_private.repository_predecessor_valid($2,$4,$5) predecessor',[mazen.trial.taskId,mazen.artifact.id,mazen.trial.trialId,founder,sourceSha])
   const before=await history(),ready=await readiness()
   assert.deepEqual(ready,{source:true,review:true,predecessor:true})
   await h.as('worker');const status=await h.rpc('hq_worker_release_status',[worker])
   await assert.rejects(()=>checkRepositoryWorkerCompatibility(status),/repository-worker-incompatible/,'actual new worker rejects genuine old SQL response before activation')
   const functionMetadata=()=>scalar(h,`select jsonb_agg(jsonb_build_object('oid',p.oid,'owner',p.proowner,'acl',p.proacl,'name',p.proname,'args',p.proargtypes::text,'return',p.prorettype,'security',p.prosecdef,'config',p.proconfig) order by p.proname) functions from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='hq_private' and p.proname in ('repository_validate_host','repository_source_valid','repository_review_ready')`)
   const releaseMetadata=()=>scalar(h,`select p.oid,p.proowner,p.proacl,p.proargtypes::text,p.prorettype,p.prosecdef,p.proconfig from pg_proc p where p.oid='public.hq_worker_release_status(uuid)'::regprocedure`)
   const checkStatusAccess=async()=>{
    for(const role of ['anon','service_role']){await h.db.exec('reset role;set role '+role);await assert.rejects(()=>h.rpc('hq_worker_release_status',[worker]),/permission denied/)}
    await h.as('founder');await assert.rejects(()=>h.rpc('hq_worker_release_status',[worker]),/HQ_WORKER_REQUIRED/)
    await h.as('worker');await assert.rejects(()=>h.rpc('hq_worker_release_status',[randomUUID()]),/HQ_WORKER_REQUIRED/)
   }
   await checkStatusAccess()
   const originalReleaseMetadata=await releaseMetadata(),metadata=await functionMetadata()
   const definitions=await scalar(h,`select pg_get_functiondef('hq_private.repository_validate_host(public.hq_agent_jobs,jsonb,boolean)'::regprocedure) host,pg_get_functiondef('hq_private.repository_source_valid(uuid,uuid)'::regprocedure) source,pg_get_functiondef('hq_private.repository_review_ready(uuid)'::regprocedure) review`)
   const proposal=await readFile(compatibilityMigration,'utf8')
   assert.equal(await readFile(compatibilityProposal,'utf8'),proposal,'canonical migration and reviewed proposal remain byte-identical')
   const drifted=definitions.host.replace("p_proof->>'workerSourceDigest' is distinct from hq_private.repository_worker_digest()","p_proof->>'workerSourceDigest'  is distinct from hq_private.repository_worker_digest()")
   assert.notEqual(drifted,definitions.host)
   await h.db.exec(drifted)
   try{await assert.rejects(()=>h.db.exec(proposal),/HQ_REPOSITORY_WORKER_COMPATIBILITY_SOURCE_MISMATCH/)}finally{await h.db.exec('rollback;reset role')}
   for(const helper of ['repository_worker_digests()','repository_worker_digest_allowed(text)','repository_worker_compatibility()'])assert.equal((await scalar(h,'select to_regprocedure($1)::text helper',['hq_private.'+helper])).helper,null,'drift refusal rolls back every helper creation')
   await h.db.exec(definitions.host)
   await h.db.exec(proposal)
   assert.deepEqual(await history(),before,'migration must not rewrite a historical row or proof')
   assert.deepEqual(await readiness(),ready,'reviewed historical work and predecessor remain usable')
   assert.equal((await scalar(h,'select hq_private.repository_worker_digest() digest')).digest,historicalWorkerDigest,'legacy singleton stays historical')
   for(const digest of [historicalWorkerDigest,compatibleWorkerDigest,null,'','a'.repeat(64),'malformed',compatibleWorkerDigest.toUpperCase(),compatibleWorkerDigest+' '])assert.equal((await scalar(h,'select hq_private.repository_worker_digest_allowed($1) allowed',[digest])).allowed,[historicalWorkerDigest,compatibleWorkerDigest].includes(digest))
   for(const role of ['anon','authenticated','service_role'])for(const helper of ['repository_worker_digests()','repository_worker_digest_allowed(text)','repository_worker_compatibility()'])assert.equal((await scalar(h,"select has_function_privilege($1,$2,'EXECUTE') allowed",[role,'hq_private.'+helper])).allowed,false)
   await h.as('worker');const advertised=await h.rpc('hq_worker_release_status',[worker])
   const {repositoryWorkerCompatibility,...unchanged}=advertised
   assert.equal(status.repositoryWorkerCompatibility,undefined)
   assert.deepEqual(unchanged,status,'only the additive worker capability changes')
   assert.deepEqual(repositoryWorkerCompatibility,{version:1,policyId:'hq-public-github-read-v1',moduleSha256:hash(await readFile(new URL('./departmentWorkflow.mjs',import.meta.url))),workerSourceDigests:[historicalWorkerDigest,compatibleWorkerDigest]})
   assert.deepEqual((await scalar(h,'select hq_private.repository_worker_digests() digests,hq_private.repository_worker_compatibility() capability')).digests,repositoryWorkerCompatibility.workerSourceDigests)
   assert.deepEqual((await scalar(h,'select hq_private.repository_worker_compatibility() capability')).capability,repositoryWorkerCompatibility)
   assert.equal(oldWorker.checkRepositoryContract(advertised),true,'actual historical worker accepts additive capability')
   assert.equal(checkRepositoryContract(advertised),true)
   await assert.doesNotReject(()=>checkRepositoryWorkerCompatibility(advertised),'actual final worker accepts genuine SQL capability using its own source and module bytes')
   for(const mutate of [
    x=>delete x.repositoryWorkerCompatibility,
    x=>x.repositoryWorkerCompatibility.version=2,
    x=>x.repositoryWorkerCompatibility.policyId='forged-policy',
    x=>x.repositoryWorkerCompatibility.moduleSha256='0'.repeat(64),
    x=>x.repositoryWorkerCompatibility.workerSourceDigests=[historicalWorkerDigest,'0'.repeat(64)],
    x=>x.repositoryWorkerCompatibility.workerSourceDigests=[compatibleWorkerDigest],
    x=>x.repositoryWorkerCompatibility.workerSourceDigests=[historicalWorkerDigest,historicalWorkerDigest],
    x=>x.repositoryWorkerCompatibility.extra='forged',
   ]){const invalid=structuredClone(advertised);mutate(invalid);await assert.rejects(()=>checkRepositoryWorkerCompatibility(invalid),/repository-worker-incompatible/)}
   await checkStatusAccess()
   assert.deepEqual(await releaseMetadata(),originalReleaseMetadata,'release RPC signature, ownership, OID and grants remain unchanged')
   const after=await scalar(h,`select pg_get_functiondef('hq_private.repository_validate_host(public.hq_agent_jobs,jsonb,boolean)'::regprocedure) host,pg_get_functiondef('hq_private.repository_source_valid(uuid,uuid)'::regprocedure) source,pg_get_functiondef('hq_private.repository_review_ready(uuid)'::regprocedure) review`)
   const substitutions={
    host:["p_proof->>'workerSourceDigest' is distinct from hq_private.repository_worker_digest()","not hq_private.repository_worker_digest_allowed(p_proof->>'workerSourceDigest')"],
    source:["x.proof->>'workerSourceDigest'=hq_private.repository_worker_digest()","hq_private.repository_worker_digest_allowed(x.proof->>'workerSourceDigest')"],
    review:["execution.proof->>'workerSourceDigest'=hq_private.repository_worker_digest()","hq_private.repository_worker_digest_allowed(execution.proof->>'workerSourceDigest')"],
   }
   for(const [key,[oldExpression,newExpression]] of Object.entries(substitutions)){
    assert.equal(definitions[key].split(oldExpression).length,2,'exactly one worker comparison exists')
    assert.equal(after[key],definitions[key].replace(oldExpression,newExpression),'every non-worker expression remains byte-identical')
   }
   assert.deepEqual(await functionMetadata(),metadata,'existing function OIDs, owners, grants and signatures remain unchanged')
   await h.as('founder');assert.equal((await h.rpc('hq_issue_repository_qualification',[mazen.trial.trialId])).accepted,true)
   assert.deepEqual(await history(),before)
  })

  await t.test('Farah accepts only the same-SHA completed Mazen predecessor; Samir gets the fixed CI preset',async()=>transaction(h,async()=>{
   await rejects(h,()=>freeze(h,'AG-DEV-003',sourcePreset,sourceSha,null),/HQ_REPOSITORY_BUNDLE_INVALID/)
   await rejects(h,()=>freeze(h,'AG-DEV-003',sourcePreset,'b'.repeat(40),mazen.artifact.id),/HQ_REPOSITORY_SETUP_REQUIRED/)
   const farah=await freeze(h,'AG-DEV-003',sourcePreset,sourceSha,mazen.artifact.id)
   let work=await repositoryWork(f,'AG-DEV-003',farah.bundleId)
   assert.equal(work.j.context.repositoryPredecessor.artifactId,mazen.artifact.id)
   assert.equal(work.j.context.repositoryPredecessor.digest,mazen.artifact.digest)
   assert.equal(work.j.context.repositoryPredecessor.evidence.selection.sha,sourceSha)
   let wire=repositoryItem(work.j);await delivery(h,entryFor(work.j,await output(work.j,{repository:true,events:[wire.event]})))
   await finishReviews(h,claim);await h.as('founder');assert.equal((await h.rpc('hq_issue_repository_qualification',[work.trial.trialId])).accepted,true)
   await rejects(h,()=>freeze(h,'AG-DEV-004',sourcePreset),/HQ_REPOSITORY_BUNDLE_INVALID/)
   work=await repositoryWork(f,'AG-DEV-004');assert.equal(work.j.context.publicRepositoryPermit.selection.preset,ciPreset)
   wire=repositoryItem(work.j);assert.equal(wire.bundle.requiredChecksVerified,false)
   await delivery(h,entryFor(work.j,await output(work.j,{repository:true,events:[wire.event]})))
   await finishReviews(h,claim);await h.as('founder');assert.equal((await h.rpc('hq_issue_repository_qualification',[work.trial.trialId])).accepted,true)
   assert.equal((await scalar(h,'select sum(charged_attempts)::int n from hq_private.repository_reservations')).n,36)
  }))
  await t.test('ordinary Adam selection freezes only the original task; repair reuses original reservation with no MCP or qualification upgrade',async()=>transaction(h,async()=>{
   const j=await ordinaryWork(f,mazen.bundleId,{ackMutations:[x=>x.extra='private',x=>x.publicRepositoryBundleId=randomUUID(),x=>x.delegateId='AG-DEV-003']})
   const wire=repositoryItem(j),out=await output(j,{repository:true,events:[wire.event]}),entry=entryFor(j,out)
   const oldOut=await output(j,{repository:true,events:[wire.event],invoke:oldWorker.invoke})
   assert.equal(oldOut.modelBindingEvidence.workerSourceDigest,historicalWorkerDigest)
   assert.equal(out.modelBindingEvidence.workerSourceDigest,compatibleWorkerDigest)
   for(const proof of [oldOut.modelBindingEvidence,out.modelBindingEvidence])await scalar(h,'select hq_private.repository_validate_host(j,$2::jsonb,true) from public.hq_agent_jobs j where j.id=$1',[j.id,JSON.stringify(proof)])
   assert.equal(out.modelBindingEvidence.trialId,null)
   const result=await delivery(h,entry);assert.equal(result.repositoryReceiptAccepted,true)
   assert.equal(result.publicDiscoveryReceiptAccepted,true);assert.equal(result.trialReceiptAccepted,true,'old runtime compatibility acknowledgment does not grant ordinary qualification')
   let review=await claim();await h.finish(review,{accepted:false,summary:'Repair wording using only the same literal read.',artifactDigest:review.context.artifact.digest})
   let repair=await claim();assert.equal(repair.context.mode,'task-start');assert.equal(repair.context.task.attempt,1)
   await rejects(h,()=>h.finish(repair,{message:'Change scope.',publicRepositoryBundleId:mazen.bundleId}),/HQ_REPOSITORY_/)
   await h.finish(repair,{message:'I will repair text using the original source receipt.'})
   repair=await claim();assert.equal(repair.context.task.attempt,1)
   assert.equal(repair.context.publicRepositoryPermit.reservationId,j.context.publicRepositoryPermit.reservationId)
   assert.equal(repair.context.publicRepositoryPermit.jobId,repair.id)
   assert.equal(repair.context.repositoryEvidence.length,1)
   assert.equal(repair.context.repositoryEvidence[0].jobId,j.id)
   assert.equal(repair.context.repositoryEvidence[0].evidence.bundleSha256,out.evidence[0].bundleSha256)
   const repaired=await output(repair);assert.deepEqual(repaired.evidence,[])
   assert.deepEqual(repaired.modelBindingEvidence.invocation.protocol.threadStart.params.config.mcp_servers,{})
   await delivery(h,entryFor(repair,repaired));await finishReviews(h,claim,'AG-DEV-001','AG-CEO-001',true)
   assert.equal(await count(h,'repository_reservations'),2,'repair never buys another network read')
   await h.db.exec('reset role');assert.deepEqual((await h.db.query('select receipt_id,binding_digest,host_execution_id from hq_private.workforce_qualification_receipts order by receipt_id')).rows,f.ordinary)
  }))
  await t.test('malformed scope, freeform/secret-shaped inputs and extra arguments cannot become founder-frozen authority',async()=>transaction(h,async()=>{
   for(const args of [
    ['AG-DEV-002','tooling/private','snapshot',sourceSha,null,null,randomUUID()],
    ['AG-DEV-002',sourcePreset,'https://example.invalid/?token=synthetic',sourceSha,null,null,randomUUID()],
    ['AG-DEV-002',sourcePreset,'snapshot','sb_secret_synthetic_not_a_credential',null,null,randomUUID()],
    ['AG-DEV-002',sourcePreset,'approved-pr',sourceSha,null,null,randomUUID()],
    ['AG-DEV-002',sourcePreset,'snapshot',sourceSha,123,null,randomUUID()],
   ])await rejects(h,async()=>{await h.as('founder');return h.rpc('hq_freeze_repository_bundle',args)},/HQ_REPOSITORY_BUNDLE_INVALID/)
   await rejects(h,async()=>{await h.as('founder');return h.rpc('hq_freeze_repository_bundle',['AG-DEV-002',sourcePreset,'snapshot',sourceSha,null,null,randomUUID(),'extra'])},/does not exist/)
   const expired=await scalar(h,`insert into hq_private.repository_bundles select (jsonb_populate_record(null::hq_private.repository_bundles,to_jsonb(b)||jsonb_build_object(
    'id',gen_random_uuid(),'request_key',gen_random_uuid(),'created_at',clock_timestamp()-interval '25 hours','expires_at',clock_timestamp()-interval '2 hours'))).* from hq_private.repository_bundles b where b.id=$1 returning id`,[mazen.bundleId])
   await rejects(h,async()=>{await h.as('founder');return h.rpc('hq_begin_repository_trial',['AG-DEV-002',expired.id,randomUUID()])},/HQ_REPOSITORY_SETUP_REQUIRED/)
  }))
  await t.test('first delivery rejects malformed/raw-hash/current-model proof; source, reviewer and manager drift settle blocked and replay without promotion',async()=>transaction(h,async()=>{
   const j=await ordinaryWork(f,mazen.bundleId),wire=repositoryItem(j),out=await output(j,{repository:true,events:[wire.event]}),entry=entryFor(j,out)
   const rpcEntry=async e=>{await h.as('worker');return h.rpc('hq_worker_finish_v4',[j.id,j.lease_token,worker,e.reply,e.error,JSON.stringify(e.evidence),JSON.stringify(e.modelExecutionEvidence),JSON.stringify(e.modelBindingEvidence)])}
   for(const mutate of [
    x=>x.evidence[0].bundleSha256='0'.repeat(64),
    x=>x.evidence[0].bundleText+=' ',
    x=>x.evidence[0].extra='untrusted',
    x=>x.modelBindingEvidence.configuredModel='gpt-6-luna',
    x=>x.modelBindingEvidence.hostResolution.model='gpt-6-luna',
    x=>x.modelBindingEvidence.publicRepositoryPolicy.moduleSha256='0'.repeat(64),
    x=>x.modelBindingEvidence.workerSourceDigest='0'.repeat(64),
    x=>delete x.modelBindingEvidence.workerSourceDigest,
    x=>x.modelBindingEvidence.workerSourceDigest=null,
    x=>x.modelBindingEvidence.workerSourceDigest='not-a-digest',
    x=>x.modelBindingEvidence.publicRepositoryPolicy.policyId='forged-policy',
   ]){const bad=structuredClone(entry);mutate(bad);await rejects(h,()=>rpcEntry(bad),/HQ_REPOSITORY_(EVIDENCE|HOST)_INVALID/)}
   const badItem=structuredClone(wire.item);badItem.arguments={query:'synthetic private input must not reach a tool'}
   await assert.rejects(()=>output(j,{repository:true,events:[{method:'item/completed',params:{item:badItem}}]}),/provider-tool-rejected/)
   for(const options of [
    {cliVersion:'codex-cli 0.0.0'},
    {appServer:{missingSettings:true}},
    {appServer:{modelMismatch:true}},
    {events:[{method:'model/rerouted',params:{fromModel:'gpt-6.1-terra',toModel:'gpt-6-luna',reason:'synthetic capacity'}}]},
    {signal:AbortSignal.abort()},
   ]){
    await h.db.exec('reset role;savepoint repository_failed_execution')
    try{
     let failure;try{await output(j,{repository:true,...options})}catch(error){failure=error}
     assert.ok(failure?.code,'a real worker failure must be emitted')
     const failed={...entryFor(j,{reply:'',evidence:failedToolEvidence(failure),modelBindingEvidence:failure.modelBindingEvidence,modelExecutionEvidence:failure.modelExecutionEvidence}),error:failure.code}
     const blocked=await delivery(h,failed);assert.equal(blocked.repositoryReceiptAccepted,true)
     assert.deepEqual(await delivery(h,failed),blocked)
     assert.equal((await scalar(h,'select count(*)::int n from public.hq_task_artifacts where job_id=$1',[j.id])).n,0)
     assert.equal(await count(h,'repository_reservations'),2)
    }finally{await h.db.exec('rollback to savepoint repository_failed_execution;release savepoint repository_failed_execution')}
   }
   for(const file of ['synthetic_developer_profile_0','profile_source_3','profile_source_9']){
    await h.db.exec('reset role;savepoint repository_binding_drift')
    try{
     await h.db.query("update hq_private.brain_files set source_version='2' where file_id=$1",[file])
     const blocked=await delivery(h,entry);assert.equal(blocked.discarded,true);assert.equal(blocked.bindingStale,true)
     assert.deepEqual(await delivery(h,entry),blocked)
     assert.equal((await scalar(h,'select count(*)::int n from public.hq_task_artifacts where job_id=$1',[j.id])).n,0)
    }finally{await h.db.exec('rollback to savepoint repository_binding_drift;release savepoint repository_binding_drift')}
   }
   await h.db.exec('reset role;savepoint repository_task_drift')
   try{
    await h.db.query("update public.hq_business_tasks set brief=brief||' changed synthetic scope' where id=$1",[j.context.task.id])
    const blocked=await delivery(h,entry);assert.equal(blocked.discarded,true);assert.equal(blocked.bindingStale,true)
    assert.deepEqual(await delivery(h,entry),blocked)
    assert.equal((await scalar(h,'select count(*)::int n from public.hq_task_artifacts where job_id=$1',[j.id])).n,0)
   }finally{await h.db.exec('rollback to savepoint repository_task_drift;release savepoint repository_task_drift')}
   const settled=await delivery(h,entry);assert.equal(settled.repositoryReceiptAccepted,true)
  }))
  await t.test('network reservations survive model failure and cancellation; three charge 36 of the global rolling 40 and a fourth cannot start',async()=>transaction(h,async()=>{
   let work=await repositoryWork(f),wire=repositoryItem(work.j),failure
   try{await output(work.j,{repository:true,events:[wire.event],turnStatus:'failed'})}catch(error){failure=error}
   assert.ok(failure);const failed={...entryFor(work.j,{reply:'',evidence:failedToolEvidence(failure),modelBindingEvidence:failure.modelBindingEvidence,modelExecutionEvidence:failure.modelExecutionEvidence}),error:failure.code}
   const blocked=await delivery(h,failed);assert.equal(blocked.repositoryReceiptAccepted,true)
   assert.deepEqual(await delivery(h,failed),blocked);assert.equal(await claim(),null)
   assert.equal(await count(h,'repository_reservations'),2)
   work=await repositoryWork(f);wire=repositoryItem(work.j)
   const out=await output(work.j,{repository:true,events:[wire.event]})
   assert.equal(await claim(),null,'a second claim does not replay a leased original')
   await h.as('founder');await h.rpc('hq_cancel_task',[work.trial.taskId])
   const canceled=await delivery(h,entryFor(work.j,out));assert.equal(canceled.discarded,true)
   assert.equal(await count(h,'repository_reservations'),3)
   assert.equal((await scalar(h,'select sum(charged_attempts)::int n from hq_private.repository_reservations')).n,36)
   assert.equal((await scalar(h,'select hq_private.repository_budget_remaining() n')).n,4)
   const frozen=await freeze(h,'AG-DEV-004',ciPreset)
   await rejects(h,async()=>{await h.as('founder');return h.rpc('hq_begin_repository_trial',['AG-DEV-004',frozen.bundleId,randomUUID()])},/HQ_REPOSITORY_SETUP_REQUIRED/)
   assert.equal((await scalar(h,'select count(*)::int n from public.hq_task_artifacts where job_id=$1',[work.j.id])).n,0)
  }))
  await t.test('expired lease cannot reclaim an original reservation or reset its charge',async()=>transaction(h,async()=>{
   const{j}=await repositoryWork(f)
   const reservation=j.context.publicRepositoryPermit.reservationId
   await h.db.exec('reset role');await h.db.query("update public.hq_agent_jobs set lease_expires_at=clock_timestamp()-interval '1 second' where id=$1",[j.id])
   assert.equal(await claim(),null)
   assert.equal(await count(h,'repository_reservations'),2)
   assert.equal((await scalar(h,'select id,charged_attempts from hq_private.repository_reservations where job_id=$1',[j.id])).id,reservation)
   assert.equal((await scalar(h,'select sum(charged_attempts)::int n from hq_private.repository_reservations')).n,24)
  }))
 }finally{await h.db.close();await oldWorker.close();await futureWorker.close()}
})

test('trial review plan cache preserves the exact predicate, permissions and current evidence',async t=>{
 futureWorker=await preparedWorker();setFutureWorker(futureWorker)
 const {h}=await repositoryFixture({cachedReview:false})
 try{
  await h.db.exec('reset role')
  const snapshot=async()=>(await h.db.query(`select
   (select md5(jsonb_agg(to_jsonb(a) order by id)::text) from public.hq_task_artifacts a) artifacts,
   (select md5(jsonb_agg(to_jsonb(r) order by id)::text) from hq_private.workforce_trial_host_execution_receipts r) host,
   (select md5(jsonb_agg(to_jsonb(q) order by receipt_id)::text) from hq_private.workforce_qualification_receipts q) qualification`)).rows[0]
  const metadata=async()=>(await h.db.query(`select oid,proowner,provolatile,prosecdef,proconfig,proacl,
   proparallel,proleakproof,proisstrict,procost,prorows,proargtypes,prorettype,prokind,proretset
   from pg_proc where oid='hq_private.trial_review_ready(uuid)'::regprocedure`)).rows[0]
  const evidenceBefore=await snapshot(),metadataBefore=await metadata()
  const original=(await h.db.query("select pg_get_functiondef(oid) definition,prosrc from pg_proc where oid='hq_private.trial_review_ready(uuid)'::regprocedure")).rows[0]
  await h.as('founder');const statusBefore=await h.rpc('hq_workforce_trial_status')
  await h.db.exec('reset role')
  // A disposable comparison function, never part of the deployed migration.
  await h.db.exec(original.definition.replace('FUNCTION hq_private.trial_review_ready(', 'FUNCTION hq_private.trial_review_ready_original('))
  await h.db.exec(await readFile(new URL(trialReviewPlanCacheMigration,root),'utf8'))
  await t.test('OID, owner, execution contract and ACL remain exact',async()=>assert.deepEqual(await metadata(),metadataBefore))
  await t.test('only the procedural plan boundary changes, not the SELECT predicate',async()=>{
   const candidate=(await h.db.query("select l.lanname,p.prosrc from pg_proc p join pg_language l on l.oid=p.prolang where p.oid='hq_private.trial_review_ready(uuid)'::regprocedure")).rows[0]
   assert.equal(candidate.lanname,'plpgsql')
   assert.equal(candidate.prosrc.trim(),'begin\n return ('+original.prosrc.trim().replace(/;$/,'')+');\nend')
  })
  await t.test('complete founder trial status remains identical',async()=>{
   await h.as('founder');assert.deepEqual(await h.rpc('hq_workforce_trial_status'),statusBefore);await h.db.exec('reset role')
  })
  const trial=(await h.db.query("select id,skill_file_id,review_job_id from hq_private.workforce_trials where agent_id='AG-HR-003'")).rows[0]
  const compare=async(expected)=>{
   const row=(await h.db.query('select hq_private.trial_review_ready_original($1) original,hq_private.trial_review_ready($1) candidate',[trial.id])).rows[0]
   assert.equal(row.candidate,row.original);assert.equal(row.candidate,expected)
  }
  await t.test('valid exact original evaluator evidence remains ready',()=>compare(true))
  await t.test('all five fixture trials and null or missing IDs match',async()=>{
   const ids=(await h.db.query('select id from hq_private.workforce_trials')).rows.map(row=>row.id)
   assert.equal(ids.length,5)
   for(const id of [...ids,null,'00000000-0000-0000-0000-000000000000']){
    const row=(await h.db.query('select hq_private.trial_review_ready_original($1) original,hq_private.trial_review_ready($1) candidate',[id])).rows[0]
    assert.equal(row.candidate,row.original)
   }
  })
  for(const [name,sql,args=[],expectedError]of[
   ['profile version changed',"update hq_private.brain_files set source_version='2' where file_id=(select profile_file_id from hq_private.agent_roster where id='AG-HR-003')"],
   ['skill version changed',"update hq_private.brain_files set source_version='2' where file_id=$1",[trial.skill_file_id]],
   ['reviewer profile version changed',"update hq_private.brain_files set source_version='2' where file_id=(select profile_file_id from hq_private.agent_roster where id='AG-CEO-001')"],
   ['agent disabled',"update hq_private.agent_roster set enabled=false where id='AG-HR-003'"],
   ['manager disabled',"update hq_private.agent_roster set enabled=false where id='AG-HR-001'"],
   ['reviewer disabled',"update hq_private.agent_roster set enabled=false where id='AG-CEO-001'"],
   ['manager reassigned',"update hq_private.agent_roster set manager_id='AG-RES-001' where id='AG-HR-003'"],
   ['configured model changed',"update hq_private.agent_roster set model='gpt-6-luna' where id='AG-HR-003'"],
   ['configured effort changed',"update hq_private.agent_roster set effort='high' where id='AG-HR-003'"],
   ['agent lifecycle suspended',"update hq_private.agent_roster set lifecycle='suspended' where id='AG-HR-003'"],
   ['trial failed',"update hq_private.workforce_trials set status='failed' where id=$1",[trial.id]],
   ['completion after expiry',"update hq_private.workforce_trials set completed_at=expires_at+interval '1 second' where id=$1",[trial.id]],
   ['immutable host evidence rejects mutation',"update hq_private.workforce_trial_host_execution_receipts set host_returned_model='gpt-6-luna' where trial_id=$1",[trial.id],/HQ_IMMUTABLE_RECORD/],
   ['review rejection',"update public.hq_agent_jobs set result_text=jsonb_set(result_text::jsonb,'{accepted}','false'::jsonb)::text where id=$1",[trial.review_job_id]],
   ['review artifact digest differs',"update public.hq_agent_jobs set result_text=jsonb_set(result_text::jsonb,'{artifactDigest}',to_jsonb(repeat('f',64)))::text where id=$1",[trial.review_job_id]],
   ['head review rejection',"update public.hq_agent_jobs set result_text=jsonb_set(result_text::jsonb,'{accepted}','false'::jsonb)::text where id=(select depends_on from public.hq_agent_jobs where id=$1)",[trial.review_job_id]],
   ['head review artifact digest differs',"update public.hq_agent_jobs set result_text=jsonb_set(result_text::jsonb,'{artifactDigest}',to_jsonb(repeat('f',64)))::text where id=(select depends_on from public.hq_agent_jobs where id=$1)",[trial.review_job_id]],
  ]){
   await t.test(name,async()=>{
    await h.db.exec('begin')
    try{
     if(expectedError)await assert.rejects(()=>h.db.query(sql,args),expectedError)
     else{await h.db.query(sql,args);await compare(false)}
    }finally{await h.db.exec('rollback')}
   })
   await t.test(name+': fresh reads after rollback',()=>compare(true))
  }
  await t.test('all original artifact, host and qualification rows are preserved',async()=>assert.deepEqual(await snapshot(),evidenceBefore))
  for(const role of ['anon','authenticated','service_role'])await t.test(role+' still cannot call the private helper directly',async()=>{
   await h.db.exec('set role '+role)
   try{await assert.rejects(()=>h.db.query('select hq_private.trial_review_ready($1)',[trial.id]),error=>error.code==='42501')}
   finally{await h.db.exec('reset role')}
  })
 }finally{await h.db.close();await futureWorker.close()}
})
