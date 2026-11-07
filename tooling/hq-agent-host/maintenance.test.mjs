import test from 'node:test'
import assert from 'node:assert/strict'
import { maintenanceGate, checkApiContract, REQUIRED_RPCS } from './maintenance.mjs'

const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done }); return { promise, resolve } }

test('pause is immediate; claim in flight completes work/delivery without another claim or abort', async () => {
  const gate = maintenanceGate(), claim = deferred(), calls = []
  const running = gate.run(async () => {
    calls.push('claim'); await claim.promise
    calls.push('lease-renewal', 'inference', 'journal', 'delivery')
    if (!gate.snapshot().paused) calls.push('next-claim')
  })
  gate.pause()
  assert.deepEqual(gate.snapshot(), { paused: true, busy: 1, uncertain: false })
  assert.equal(await gate.run(() => calls.push('roster-or-publication')), false)
  claim.resolve(); await running
  assert.deepEqual(calls, ['claim', 'lease-renewal', 'inference', 'journal', 'delivery'])
  assert.equal(gate.snapshot().busy, 0)
})

test('every operation counts; slow roster, recovery, publication and presence defer drain', async () => {
  const gate = maintenanceGate(), operation = deferred()
  const running = gate.run(() => operation.promise)
  gate.pause()
  assert.throws(() => gate.resume(), /unsettled/)
  assert.equal(gate.snapshot().busy, 1)
  operation.resolve(); await running
  gate.resume(); assert.equal(gate.snapshot().paused, false)
})

test('uncertain claim or delivery poisons admission persistently and fails closed', async () => {
  let poisoned = false
  const gate = maintenanceGate({ poison: async () => { poisoned = true } })
  await assert.rejects(gate.run(async () => { throw Error('network-unknown-outcome') }))
  assert.equal(poisoned, true)
  assert.deepEqual(gate.snapshot(), { paused: true, busy: 0, uncertain: true })
  assert.throws(() => gate.resume(), /unsettled/)
  const restarted = maintenanceGate({ uncertain: poisoned })
  assert.equal(await restarted.run(() => assert.fail('must not claim')), false)
})

test('candidate boot stays paused until explicit acceptance', async () => {
  const gate = maintenanceGate({ paused: true })
  assert.equal(await gate.run(() => assert.fail('candidate claimed work')), false)
  gate.resume()
  let ran = false; await gate.run(() => { ran = true })
  assert.equal(ran, true)
})

test('authenticated status proof fails closed on missing signatures, grants or semantic capabilities', () => {
  const valid = {contract:2,trialDelivery:1,trialSkills:1,trialFailureSettlement:1,activeJobs:0,
    api:{version:1,role:'authenticated',schemaUsage:true,execute:true,rpcs:REQUIRED_RPCS}}
  assert.equal(checkApiContract(valid),2)
  for (const mutate of [s=>delete s.api, s=>s.api.version=0, s=>s.api.role='service_role',
    s=>s.api.schemaUsage=false, s=>s.api.execute=false, s=>delete s.api.rpcs.hq_worker_finish_v4,
    s=>s.api.rpcs.hq_worker_claim.pop(), s=>s.api.rpcs.hq_worker_claim[0]='wrong',
    s=>s.trialDelivery=0, s=>s.trialSkills=0, s=>s.trialFailureSettlement=0, s=>s.contract=1,
    s=>s.activeJobs=-1, s=>s.activeJobs=null]) {
    const bad=structuredClone(valid);mutate(bad);assert.throws(()=>checkApiContract(bad),/schema-incompatible/)
  }
  assert.throws(()=>checkApiContract({}),/schema-incompatible/)
})
