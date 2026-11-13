/** Identical synthetic compatibility assertions for PGlite and fixed native PostgreSQL. */
import assert from 'node:assert/strict'
import { readFile, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { randomUUID } from 'node:crypto'
import { checkRepositoryWorkerCompatibility as checkProductionWorker, invokeCodex as invokeProductionWorker } from './worker.mjs'
import {
 root,worker,hash,setFutureWorker,repositoryFixture,materializeLegacyWorker,
 compatibilityMigration,historicalWorkerDigest,compatibleWorkerDigest,fixedModuleDigest,
 repositoryWork,repositoryItem,output,entryFor,delivery,finishReviews,scalar,transaction,rejects,freeze,sourcePreset,sourceSha,
} from './public-repository-db-fixture.mjs'

const candidateDigest='7096b79833132b46cefbe464738a9f3671acbd29666e7dcbc8c3761573783c40'
const parallelDigest='d768ee8a7ed2717c8fd1dbf09d0159b9aca0607b14f95e5608d5ea5980439ce9'
const parallelMigration=new URL('20261112140052_hq_bounded_employee_parallelism.sql',root)
const shopCompatibilityMigration=new URL('20261113023924_hq_shop_suit_worker_compatibility.sql',root)
async function preparedVersion(filename,digest){
 const directory=await mkdtemp(join(tmpdir(),'hq-compatibility-v2-'))
 try{
  const bytes=await readFile(new URL('./test-fixtures/'+filename,import.meta.url))
  assert.equal(hash(bytes),digest,'inert source bytes must match the exact reviewed version')
  const release=await readFile(new URL('./release.py',import.meta.url),'utf8')
  assert.deepEqual(release.match(/^FILES = \((.+)\)$/m)?.[1]?.match(/'[^']+'/g)?.map(value=>value.slice(1,-1)),
   ['worker.mjs','workforceRoster.mjs','brainPublisher.mjs','maintenance.mjs','departmentWorkflow.mjs'],'release excludes inert fixtures')
  await materializeLegacyWorker(directory,bytes)
  const module=await import(pathToFileURL(join(directory,'worker.mjs')).href)
  return{...module,invoke:module.invokeCodex,close:()=>rm(directory,{recursive:true,force:true})}
 }catch(error){await rm(directory,{recursive:true,force:true});throw error}
}
const migration=new URL('20261111020000_hq_repository_worker_compatibility_v2.sql',root)
const reviewMigration=new URL('20261110165424_hq_repository_review_planning.sql',root)
const preserved=[
 'hq_private.repository_worker_digest()',
 'hq_private.repository_module_digest()',
 'hq_private.repository_worker_digests()',
 'hq_private.repository_worker_digest_allowed(text)',
 'hq_private.repository_worker_compatibility()',
 'hq_private.repository_qualified(text)',
]
const modified=[
 'hq_private.repository_validate_host(public.hq_agent_jobs,jsonb,boolean)',
 'hq_private.repository_source_valid(uuid,uuid)',
 'hq_private.repository_review_ready(uuid)',
 'hq_private.worker_release_status(uuid)',
 'hq_private.issue_repository_qualification(uuid)',
]
const added=[
 'hq_private.repository_worker_pairs_v2()',
 'hq_private.repository_worker_pair_allowed_v2(text,text)',
 'hq_private.repository_worker_compatibility_v2()',
]
const metadata=async h=>(await scalar(h,`select jsonb_agg(to_jsonb(p)-'prosrc' order by p.oid) data
 from pg_proc p where p.oid=any($1::regprocedure[])`,[[...preserved,...modified,'public.hq_worker_release_status(uuid)']])).data
async function definitions(h){
 await h.db.exec('reset role')
 return new Map((await h.db.query(`select signature,pg_get_functiondef(signature::regprocedure) definition,
 (select prosrc from pg_proc where oid=signature::regprocedure) source
 from unnest($1::text[]) signature`,[[...preserved,...modified]])).rows.map(row=>[row.signature,row]))
}
async function history(h){
 await h.db.exec('reset role');const value={}
 for(const table of ['repository_bundles','repository_reservations','repository_receipts','repository_host_executions','repository_qualifications','workforce_qualification_receipts']){
  value[table]=(await h.db.query(`select to_jsonb(x) data from hq_private.${table} x order by to_jsonb(x)::text`)).rows
 }
 return value
}
const status=async h=>{await h.as('worker');return h.rpc('hq_worker_release_status',[worker])}
const ready=async(h,trial,artifact)=>scalar(h,`select hq_private.repository_source_valid($1,$2) source,
 hq_private.repository_review_ready($3) review`,[trial.taskId,artifact.id,trial.trialId])

export async function verifyRepositoryWorkerCompatibilityV2({database=null,historical=false,testStep=async(_name,run)=>run(),report=()=>{},beforeApply=null}={}){
 const prepared=await preparedVersion('repository-compatible-worker.mjs.txt',compatibleWorkerDigest),old=historical?await preparedVersion('repository-historical-worker.mjs.txt',historicalWorkerDigest):null
 const candidateWorker=await preparedVersion('retail-v2-worker.mjs.txt',candidateDigest)
 const {invokeCodex,checkRepositoryWorkerCompatibility}=candidateWorker
 setFutureWorker(prepared);let h
 try{
  const f=await repositoryFixture({database});h=f.h
  await h.db.exec('reset role')
  await h.db.exec(await readFile(compatibilityMigration,'utf8'))
  await h.db.exec(await readFile(reviewMigration,'utf8'))
  const legacy=await repositoryWork(f,'AG-DEV-002'),legacyWire=repositoryItem(legacy.j)
  const legacyOutput=await output(legacy.j,{repository:true,events:[legacyWire.event],invoke:old?.invoke??prepared.invoke})
  assert.equal(legacyOutput.modelBindingEvidence.workerSourceDigest,historical?historicalWorkerDigest:compatibleWorkerDigest)
  const legacyEntry=entryFor(legacy.j,legacyOutput),legacyResult=await delivery(h,legacyEntry)
  const legacyArtifact=await finishReviews(h,f.claim)
  await h.as('founder');const qualification=await h.rpc('hq_issue_repository_qualification',[legacy.trial.trialId])
  assert.equal(qualification.accepted,true)
  const previousStatus=await status(h),beforeDefinitions=await definitions(h),beforeMetadata=await metadata(h)
  await assert.rejects(()=>checkRepositoryWorkerCompatibility(previousStatus),/repository-worker-incompatible/)
  await assert.doesNotReject(()=>prepared.checkRepositoryWorkerCompatibility(previousStatus))

  // Generate actual candidate host evidence before SQL admits it.
  const candidate=await repositoryWork(f,'AG-DEV-004'),wire=repositoryItem(candidate.j)
  const candidateOutput=await output(candidate.j,{repository:true,events:[wire.event],invoke:invokeCodex})
  assert.equal(hash(await readFile(new URL('./test-fixtures/retail-v2-worker.mjs.txt',import.meta.url))),candidateDigest)
  assert.equal(candidateOutput.modelBindingEvidence.workerSourceDigest,candidateDigest)
  assert.equal(candidateOutput.modelBindingEvidence.publicRepositoryPolicy.moduleSha256,fixedModuleDigest)
  const validate=proof=>scalar(h,'select hq_private.repository_validate_host(j,$2::jsonb,true) from public.hq_agent_jobs j where j.id=$1',[candidate.j.id,JSON.stringify(proof)])
  await assert.rejects(()=>validate(candidateOutput.modelBindingEvidence),/HQ_REPOSITORY_HOST_INVALID/)
  const beforeMigrationStatus=await status(h),beforeHistory=await history(h),sql=await readFile(migration,'utf8')

  await testStep('full predecessor and metadata drift refuse atomically',async()=>{
   const drifts=[...beforeDefinitions.values()].map(row=>row.definition.replace(row.source,()=>row.source+'\n'))
   for(const suffix of ["volatile","security invoker","strict","set search_path='public'","reset join_collapse_limit",'rename to fixture_missing_review']){
    drifts.push('alter function hq_private.repository_review_ready(uuid) '+suffix)
   }
   for(const drift of drifts){
    await h.db.exec('reset role;begin')
    try{await h.db.exec(drift);await assert.rejects(()=>h.db.exec(sql),/HQ_REPOSITORY_COMPATIBILITY_V2_PREDECESSOR_MISMATCH/)}
    finally{await h.db.exec('rollback;reset role')}
    for(const signature of added)assert.equal((await scalar(h,'select to_regprocedure($1)::text value',[signature])).value,null)
    assert.deepEqual(await definitions(h),beforeDefinitions)
   }
   assert.deepEqual(await history(h),beforeHistory)
  })

  assert.equal(hash(sql),'6259a67b2633173b3d7e34d5184b120921dc3b6dc322fd5f18e23abfbc1cc053','execute the exact reviewed migration on both engines')
  if(beforeApply){
   await beforeApply({h,sql})
   for(const signature of added)assert.equal((await scalar(h,'select to_regprocedure($1)::text value',[signature])).value,null)
   assert.deepEqual(await definitions(h),beforeDefinitions,'concurrency refusal preserves every predecessor definition')
   assert.deepEqual(await metadata(h),beforeMetadata)
   assert.deepEqual(await history(h),beforeHistory,'concurrency refusal changes no receipts or qualification')
   assert.deepEqual(await status(h),beforeMigrationStatus)
   await h.db.exec('reset role')
  }
  await h.db.exec(sql)
  assert.deepEqual(await history(h),beforeHistory,'migration does not rewrite evidence or issue qualification')
  assert.deepEqual(await metadata(h),beforeMetadata,'all existing OIDs, grants, owners, signatures and configuration remain unchanged')
  const afterDefinitions=await definitions(h)
  for(const signature of preserved)assert.deepEqual(afterDefinitions.get(signature),beforeDefinitions.get(signature))
  const expressions=[
   [modified[0],"not hq_private.repository_worker_digest_allowed(p_proof->>'workerSourceDigest')","not hq_private.repository_worker_pair_allowed_v2(p_proof->>'workerSourceDigest',p_proof->'publicRepositoryPolicy'->>'moduleSha256')"],
   [modified[1],"hq_private.repository_worker_digest_allowed(x.proof->>'workerSourceDigest')","hq_private.repository_worker_pair_allowed_v2(x.proof->>'workerSourceDigest',x.proof->'publicRepositoryPolicy'->>'moduleSha256')"],
   [modified[2],"hq_private.repository_worker_digest_allowed(execution.proof->>'workerSourceDigest')","hq_private.repository_worker_pair_allowed_v2(execution.proof->>'workerSourceDigest',execution.proof->'publicRepositoryPolicy'->>'moduleSha256')"],
   [modified[3],"'repositoryWorkerCompatibility',hq_private.repository_worker_compatibility()","'repositoryWorkerCompatibility',hq_private.repository_worker_compatibility(),'repositoryWorkerCompatibilityV2',hq_private.repository_worker_compatibility_v2()"],
  ]
  for(const [signature,from,to]of expressions){
   const original=beforeDefinitions.get(signature).definition
   assert.equal(original.split(from).length,2)
   assert.equal(afterDefinitions.get(signature).definition,original.replace(from,to),'all other body bytes stay unchanged')
  }
  const issuance=afterDefinitions.get(modified[4]).source
  const guardStart=issuance.indexOf('-- Compatibility admits source/review evidence, not a new qualification policy.')
  const guardEnd=issuance.indexOf('insert into hq_private.repository_qualifications',guardStart)
  assert.ok(guardStart>0&&guardEnd>guardStart)
  assert.equal(issuance.slice(0,guardStart)+issuance.slice(guardEnd),beforeDefinitions.get(modified[4]).source,'old issuance checks remain byte-identical')

  const advertised=await status(h),{repositoryWorkerCompatibilityV2,...unchanged}=advertised
  assert.deepEqual(unchanged,beforeMigrationStatus)
  assert.deepEqual(repositoryWorkerCompatibilityV2,{version:2,policyId:'hq-public-github-read-v1',sourcePairs:[{workerSourceDigest:candidateDigest,moduleSha256:fixedModuleDigest}]})
  await assert.doesNotReject(()=>checkRepositoryWorkerCompatibility(advertised))
  await assert.doesNotReject(()=>prepared.checkRepositoryWorkerCompatibility(advertised))
  if(old)assert.equal(old.checkRepositoryContract(advertised),true)
  for(const mutate of [
   x=>delete x.repositoryWorkerCompatibility,
   x=>delete x.repositoryWorkerCompatibilityV2,
   x=>x.repositoryWorkerCompatibilityV2.sourcePairs=[],
   x=>x.repositoryWorkerCompatibilityV2.sourcePairs.push(x.repositoryWorkerCompatibilityV2.sourcePairs[0]),
   x=>x.repositoryWorkerCompatibilityV2.sourcePairs[0].moduleSha256='0'.repeat(64),
   x=>x.repositoryWorkerCompatibilityV2.extra=true,
   x=>x.repositoryWorkerCompatibilityV2.sourcePairs[0].extra=true,
   x=>x.repositoryWorkerCompatibilityV2.version=1,
  ]){const bad=structuredClone(advertised);mutate(bad);await assert.rejects(()=>checkRepositoryWorkerCompatibility(bad),/repository-worker-incompatible/)}
  for(const digest of [historicalWorkerDigest,compatibleWorkerDigest,candidateDigest,null,'','0'.repeat(64),candidateDigest.toUpperCase(),candidateDigest+' ']){
   for(const module of [fixedModuleDigest,null,'','0'.repeat(64),fixedModuleDigest.toUpperCase(),candidateDigest]){
    assert.equal((await scalar(h,'select hq_private.repository_worker_pair_allowed_v2($1,$2) allowed',[digest,module])).allowed,
     [historicalWorkerDigest,compatibleWorkerDigest,candidateDigest].includes(digest)&&module===fixedModuleDigest)
   }
   assert.equal((await scalar(h,'select hq_private.repository_worker_digest_allowed($1) allowed',[digest])).allowed,[historicalWorkerDigest,compatibleWorkerDigest].includes(digest))
  }
  for(const role of ['anon','authenticated','service_role'])for(const signature of added){
   assert.equal((await scalar(h,"select has_function_privilege($1,$2,'EXECUTE') allowed",[role,signature])).allowed,false)
  }
  for(const role of ['anon','service_role']){
   await h.db.exec('reset role;set role '+role)
   await assert.rejects(()=>h.rpc('hq_worker_release_status',[worker]),/permission denied/)
  }
  await h.as('founder');await assert.rejects(()=>h.rpc('hq_worker_release_status',[worker]),/HQ_WORKER_REQUIRED/)
  await h.as('worker');await assert.rejects(()=>h.rpc('hq_worker_release_status',[randomUUID()]),/HQ_WORKER_REQUIRED/)
  await validate(candidateOutput.modelBindingEvidence)
  for(const mutate of [
   x=>x.workerSourceDigest='0'.repeat(64),
   x=>delete x.workerSourceDigest,
   x=>x.publicRepositoryPolicy.moduleSha256='0'.repeat(64),
   x=>x.publicRepositoryPolicy.manifestDigest='0'.repeat(64),
   x=>x.workerId=randomUUID(),
   x=>x.configuredModel='unreviewed',
  ]){const bad=structuredClone(candidateOutput.modelBindingEvidence);mutate(bad);await assert.rejects(()=>validate(bad),/HQ_REPOSITORY_HOST_INVALID/)}

  const candidateEntry=entryFor(candidate.j,candidateOutput),candidateResult=await delivery(h,candidateEntry)
  assert.equal(candidateResult.repositoryReceiptAccepted,true)
  assert.deepEqual(await delivery(h,candidateEntry),candidateResult)
  const candidateArtifact=await finishReviews(h,f.claim)
  assert.deepEqual(await ready(h,candidate.trial,candidateArtifact),{source:true,review:true})
  assert.deepEqual(await ready(h,legacy.trial,legacyArtifact),{source:true,review:true})
  const qualificationsBefore=(await history(h)).repository_qualifications
  await transaction(h,()=>rejects(h,async()=>{await h.as('founder');return h.rpc('hq_issue_repository_qualification',[candidate.trial.trialId])},/HQ_REPOSITORY_QUALIFICATION_WORKER_REQUIRED/))
  assert.deepEqual((await history(h)).repository_qualifications,qualificationsBefore)
  assert.deepEqual(await scalar(h,"select hq_private.repository_qualified('AG-DEV-002') legacy,hq_private.repository_qualified('AG-DEV-004') candidate"),{legacy:true,candidate:false})
  await h.as('founder');assert.deepEqual(await h.rpc('hq_issue_repository_qualification',[legacy.trial.trialId]),qualification)
  assert.deepEqual(await delivery(h,legacyEntry),legacyResult)
  assert.deepEqual((await history(h)).workforce_qualification_receipts,beforeHistory.workforce_qualification_receipts)

  // Positive issuance is new after migration, not merely a cached old receipt.
  const freshBundle=await freeze(h,'AG-DEV-003',sourcePreset,sourceSha,legacyArtifact.id)
  const fresh=await repositoryWork(f,'AG-DEV-003',freshBundle.bundleId),freshWire=repositoryItem(fresh.j)
  const freshOutput=await output(fresh.j,{repository:true,events:[freshWire.event],invoke:old?.invoke??prepared.invoke})
  assert.equal(freshOutput.modelBindingEvidence.workerSourceDigest,historical?historicalWorkerDigest:compatibleWorkerDigest)
  await delivery(h,entryFor(fresh.j,freshOutput));await finishReviews(h,f.claim)
  await h.as('founder');const freshQualification=await h.rpc('hq_issue_repository_qualification',[fresh.trial.trialId])
  assert.equal(freshQualification.accepted,true)
  assert.notEqual(freshQualification.receiptId,qualification.receiptId)
  assert.equal((await scalar(h,'select count(*)::int n from hq_private.repository_qualifications where trial_id=$1',[fresh.trial.trialId])).n,1)
  assert.equal((await scalar(h,'select count(*)::int n from hq_private.repository_qualifications where trial_id=$1',[candidate.trial.trialId])).n,0)
  // Accepted host evidence remains immutable even in this disposable fixture.
  await transaction(h,()=>rejects(h,()=>h.db.query("update hq_private.repository_host_executions set proof=jsonb_set(proof,'{workerSourceDigest}',to_jsonb(repeat('0',64))) where artifact_id=$1",[candidateArtifact.id]),/HQ_IMMUTABLE_RECORD/))

  // Drift or unsupported reapplication cannot partially modify the installed version.
  const installedHistory=await history(h),installedDefinitions=await definitions(h)
  try{await assert.rejects(()=>h.db.exec(sql),/HQ_REPOSITORY_COMPATIBILITY_V2_PREDECESSOR_MISMATCH/)}finally{await h.db.exec('rollback;reset role')}
  assert.deepEqual(await definitions(h),installedDefinitions)
  assert.deepEqual(await history(h),installedHistory)

  // Roll back worker first: actual preserved v1 accepts v2's additive status.
  await assert.doesNotReject(()=>prepared.checkRepositoryWorkerCompatibility(advertised))
  // Then restore all five SQL bodies transactionally, preserving every receipt.
  await h.db.exec('begin')
  for(const signature of modified)await h.db.exec(beforeDefinitions.get(signature).definition)
  await h.db.exec('drop function hq_private.repository_worker_pair_allowed_v2(text,text);drop function hq_private.repository_worker_compatibility_v2();drop function hq_private.repository_worker_pairs_v2();commit')
  assert.deepEqual(await definitions(h),beforeDefinitions)
  assert.deepEqual(await metadata(h),beforeMetadata)
  assert.deepEqual(await history(h),installedHistory)
  assert.deepEqual(await status(h),previousStatus)
  await assert.rejects(()=>checkRepositoryWorkerCompatibility(previousStatus),/repository-worker-incompatible/)
  await assert.doesNotReject(()=>prepared.checkRepositoryWorkerCompatibility(previousStatus))
  assert.deepEqual(await ready(h,legacy.trial,legacyArtifact),{source:true,review:true})
  assert.deepEqual(await ready(h,candidate.trial,candidateArtifact),{source:false,review:false})
  await h.as('founder');assert.deepEqual(await h.rpc('hq_issue_repository_qualification',[legacy.trial.trialId]),qualification)
  report('Exact current bytes, legacy evidence/status, qualification separation, drift guards and worker-first rollback verified in the disposable database.')
  await testStep('Shop connector admits the exact new pair without expanding qualification',async()=>{
   await h.db.exec('reset role')
   await h.db.exec(sql)
   await h.db.exec(await readFile(parallelMigration,'utf8'))
   const baseline=await status(h)
   const productionPair=await verifyReviewedProductionWorker()
   const newWire=repositoryItem(candidate.j)
   const newOutput=await output(candidate.j,{repository:true,events:[newWire.event],invoke:invokeProductionWorker})
   assert.equal(newOutput.modelBindingEvidence.workerSourceDigest,productionPair.workerSourceDigest)
   assert.equal(newOutput.modelBindingEvidence.publicRepositoryPolicy.moduleSha256,productionPair.moduleSha256)
   await assert.rejects(()=>checkProductionWorker(baseline),/repository-worker-incompatible/)
   await assert.rejects(()=>validate(newOutput.modelBindingEvidence),/HQ_REPOSITORY_HOST_INVALID/)
   const before=await history(h)
   const beforeShopDefinitions=await definitions(h),beforeShopMetadata=await metadata(h)
   const connectorSql=await readFile(shopCompatibilityMigration,'utf8')
   const source=beforeShopDefinitions.get(modified[1])
   await h.db.exec('begin')
   try{
    await h.db.exec(source.definition.replace(source.source,()=>source.source+'\n'))
    await assert.rejects(()=>h.db.exec(connectorSql),/HQ_SHOP_CONNECTOR_SOURCE_PREDECESSOR_MISMATCH/)
   }finally{await h.db.exec('rollback')}
   assert.deepEqual(await definitions(h),beforeShopDefinitions)
   assert.deepEqual(await status(h),baseline,'refusal must also roll back the pair addition')
   await h.db.exec('reset role')
   await h.db.exec(connectorSql)
   const accepted=await status(h)
   assert.deepEqual(accepted.repositoryWorkerCompatibilityV2.sourcePairs,[...baseline.repositoryWorkerCompatibilityV2.sourcePairs,productionPair])
   assert.deepEqual(accepted.repositoryWorkerCompatibility,baseline.repositoryWorkerCompatibility)
   assert.deepEqual(await metadata(h),beforeShopMetadata)
   const afterShopDefinitions=await definitions(h)
   assert.deepEqual(afterShopDefinitions.get(modified[4]),beforeShopDefinitions.get(modified[4]),'qualification issuance remains byte-identical')
   await assert.doesNotReject(()=>checkProductionWorker(accepted))
   await assert.doesNotReject(()=>prepared.checkRepositoryWorkerCompatibility(accepted))
   await validate(newOutput.modelBindingEvidence)
   await validate(candidateOutput.modelBindingEvidence)
   for(const pair of [
    {workerSourceDigest:productionPair.workerSourceDigest,moduleSha256:fixedModuleDigest},
    {workerSourceDigest:parallelDigest,moduleSha256:productionPair.moduleSha256},
   ]){
    const allowed=await scalar(h,'select hq_private.repository_worker_pair_allowed_v2($1,$2) allowed',[pair.workerSourceDigest,pair.moduleSha256])
    assert.equal(allowed.allowed,false,'a worker and workflow from separate releases cannot be combined')
   }
   await transaction(h,()=>rejects(h,async()=>{await h.as('founder');return h.rpc('hq_issue_repository_qualification',[candidate.trial.trialId])},/HQ_REPOSITORY_QUALIFICATION_WORKER_REQUIRED/))
   assert.deepEqual(await history(h),before,'admitting the connector leaves historical receipts and qualification unchanged')
  })
 }finally{await h?.db.close();await prepared.close();await old?.close();await candidateWorker.close()}
}

export async function verifyReviewedProductionWorker(){
 const production=await readFile(new URL('./worker.mjs',import.meta.url))
 assert.equal(hash(await readFile(new URL('./test-fixtures/retail-v2-worker.mjs.txt',import.meta.url))),candidateDigest,'historical v2 fixture remains immutable')
 const pair={workerSourceDigest:hash(production),moduleSha256:hash(await readFile(new URL('./departmentWorkflow.mjs',import.meta.url)))}
 const migration=await readFile(shopCompatibilityMigration,'utf8')
 assert.deepEqual([...migration.matchAll(/'workerSourceDigest','([a-f0-9]{64})',\s*'moduleSha256','([a-f0-9]{64})'/g)].at(-1)?.slice(1),
  [pair.workerSourceDigest,pair.moduleSha256],'worker deployment must use the exact reviewed and SQL-admitted Shop connector pair')
 assert.notEqual(pair.workerSourceDigest,parallelDigest)
 assert.notEqual(pair.moduleSha256,fixedModuleDigest)
 return pair
}
