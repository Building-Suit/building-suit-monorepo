/** Disposable PGlite and synthetic CLI evidence only. No hosted calls. */
import test from 'node:test'
import {
 verifyRepositoryWorkerCompatibilityV2,verifyReviewedProductionWorker,
} from './repository-worker-compatibility-v2-checks.mjs'

for(const historical of [false,true])test(`exact-pair v2 preserves ${historical?'historical':'v1-compatible'} evidence and denies candidate qualification`,async t=>{
 await verifyRepositoryWorkerCompatibilityV2({historical,testStep:(name,run)=>t.test(name,run),report:value=>t.diagnostic(value)})
})

test('production worker is the exact SQL-admitted reviewed v2 version',verifyReviewedProductionWorker)
