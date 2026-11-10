import test from 'node:test'
import {readFile} from 'node:fs/promises'
import assert from 'node:assert/strict'
import { preparedWorker,setFutureWorker,repositoryFixture,compatibilityMigration,repositoryWork,repositoryItem,delivery,entryFor,output,finishReviews } from './public-repository-db-fixture.mjs'
import { verify } from './claim-query-budget-checks.mjs'
import { tenWorkerFixture,verifyStatusProjection } from './trial-status-projection-checks.mjs'
test('ten-worker status reuses evidence and preserves all wrapper output, current authority and immutable receipts',async t=>{
 const prepared=await preparedWorker();setFutureWorker(prepared);let h
 try{const f=await repositoryFixture();h=f.h;await verify(h);await tenWorkerFixture(f);await verifyStatusProjection(h,{report:value=>t.diagnostic(JSON.stringify(value))})}
 finally{await h?.db.close();await prepared.close()}
})

test('qualified repository status retains nested source and review validation',async t=>{
 const prepared=await preparedWorker();setFutureWorker(prepared);let h
 try{
  const f=await repositoryFixture();h=f.h;await verify(h);await tenWorkerFixture(f)
  await h.db.exec(await readFile(compatibilityMigration,'utf8'))
  const {trial,j}=await repositoryWork(f,'AG-DEV-002'),wire=repositoryItem(j)
  await delivery(h,entryFor(j,await output(j,{repository:true,events:[wire.event]})))
  await finishReviews(h,f.claim);await h.as('founder')
  assert.equal((await h.rpc('hq_issue_repository_qualification',[trial.trialId])).accepted,true)
  await verifyStatusProjection(h,{qualifiedRepository:true,report:value=>t.diagnostic(JSON.stringify(value))})
 }finally{await h?.db.close();await prepared.close()}
})
