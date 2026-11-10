import test from 'node:test'
import {preparedWorker,historicalWorker,setFutureWorker,repositoryFixture} from './public-repository-db-fixture.mjs'
import {repositoryReviewFixture,verifyRepositoryReviewPlanning} from './repository-review-planning-checks.mjs'
for(const historical of [false,true])test(`repository review preserves ${historical?'historical':'compatible'} proof and bounds repeated planning for the actual trial mix`,async t=>{
 const prepared=await preparedWorker(),old=historical?await historicalWorker():null;setFutureWorker(prepared);let h
 try{const f=await repositoryFixture();h=f.h;await repositoryReviewFixture(f,old?{invoke:old.invoke}:{});await verifyRepositoryReviewPlanning(h,{report:value=>t.diagnostic(JSON.stringify(value))})}
 finally{await h?.db.close();await prepared.close();await old?.close()}
})
