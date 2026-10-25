import { verifySupplierOrderRaces } from './shop-supplier-order-concurrency.mjs'
import { verifyOrderReservationRaces } from './shop-order-reservation-concurrency.mjs'
import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import { verifyPhysicalReelRace } from './shop-reel-concurrency.mjs'
// The workflow owns and destroys this fixed local backend. No hosted URL,
// alternate container, or caller-supplied credential is accepted.
assert.equal(process.env.SHOP_REEL_RACE_DISPOSABLE,'1','Disposable fixture acknowledgement required')
assert.equal(process.env.RUNNER_ENVIRONMENT,'github-hosted','Run only in the owned GitHub disposable backend job')
const args = ['exec','-i','supabase_db_building-suit-shop','psql','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-Atq']
const sql = statement => {
 const result = spawnSync('docker',args,{input:statement,encoding:'utf8',timeout:120000})
 assert.equal(result.status,0,result.stderr || String(result.error))
 return result.stdout.trim()
}
const parallel = statement => new Promise((resolve,reject) => {
 const child = spawn('docker',args);let stdout = '',stderr = ''
 child.stdout.on('data',part => { stdout+=part });child.stderr.on('data',part => { stderr+=part })
 child.on('error',reject);child.on('close',code => resolve({ code, stdout, stderr }));child.stdin.end(statement)
})
await verifyPhysicalReelRace(sql,parallel)

await verifyOrderReservationRaces(sql,parallel)
await verifySupplierOrderRaces(sql,parallel)
