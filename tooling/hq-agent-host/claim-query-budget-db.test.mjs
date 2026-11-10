import test from 'node:test'
import assert from 'node:assert/strict'
import { preparedWorker, setFutureWorker, repositoryFixture } from './public-repository-db-fixture.mjs'
import { verify, prepareQueuedTrial, observeClaim } from './claim-query-budget-checks.mjs'
test('skill evidence plan reuse preserves predicate, status, authority, receipts and fresh binding reads',async()=>{
 const prepared=await preparedWorker();setFutureWorker(prepared)
 let h
 try{const f=await repositoryFixture();h=f.h;await prepareQueuedTrial(f);const before=await observeClaim(f);await verify(h);assert.deepEqual(await observeClaim(f),before)}
 finally{await h?.db.close();await prepared.close()}
})
