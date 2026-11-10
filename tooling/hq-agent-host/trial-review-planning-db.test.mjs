import test from 'node:test'
import {preparedWorker,setFutureWorker,repositoryFixture} from './public-repository-db-fixture.mjs'
import {trialReviewFixture,verifyTrialReviewPlanning} from './trial-review-planning-checks.mjs'
test('trial review preserves exact proof while bounding planning and skipping impossible lifecycle states',async t=>{
 const prepared=await preparedWorker();setFutureWorker(prepared);let h
 try{const f=await repositoryFixture();h=f.h;await trialReviewFixture(f);await verifyTrialReviewPlanning(h,{report:value=>t.diagnostic(JSON.stringify(value))})}
 finally{await h?.db.close();await prepared.close()}
})
