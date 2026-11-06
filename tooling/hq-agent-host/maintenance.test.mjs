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

test('schema shape fails closed on missing RPCs, arguments or references', () => {
  const spec = { paths: {}, definitions: {} }
  for (const [name, args] of Object.entries(REQUIRED_RPCS)) {
    spec.paths['/rpc/' + name] = { post: { parameters: [{ in: 'body', schema: { $ref: '#/definitions/' + name } }] } }
    spec.definitions[name] = { properties: Object.fromEntries(args.map(key => [key, { type: 'string' }])) }
  }
  assert.equal(checkApiContract(spec), 1)
  delete spec.definitions.hq_worker_claim.properties.p_meeting_protocol
  assert.throws(() => checkApiContract(spec), /schema-incompatible/)
  assert.throws(() => checkApiContract({}), /schema-incompatible/)
})
